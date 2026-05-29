from __future__ import annotations

import importlib
import logging
from typing import Any, AsyncGenerator, Dict, Iterable, List, Optional, TypedDict

logger = logging.getLogger(__name__)
DocumentType = Any


class VectorStorageService:
	def __init__(
		self,
		collection_name: str = "video_transcripts",
		qdrant_path: Optional[str] = None,
	) -> None:
		from app.config import settings

		deps = self._load_dependencies()
		self._Document = deps["Document"]
		self._TextSplitter = deps["RecursiveCharacterTextSplitter"]
		self._Filter = deps["Filter"]
		self._FieldCondition = deps["FieldCondition"]
		self._MatchAny = deps["MatchAny"]
		self._VectorParams = deps["VectorParams"]
		self._Distance = deps["Distance"]
		# This embedding model runs fully local on CPU, avoiding external APIs or token fees.
		self._embeddings = deps["HuggingFaceEmbeddings"](model_name="all-MiniLM-L6-v2")

		storage_path = qdrant_path or settings.QDRANT_STORAGE_PATH
		self._qdrant_client = deps["QdrantClient"](path=storage_path)

		self._collection_name = collection_name
		self._ensure_collection()
		self._vectorstore = deps["Qdrant"](
			client=self._qdrant_client,
			collection_name=self._collection_name,
			embeddings=self._embeddings,
		)

	def _ensure_collection(self) -> None:
		try:
			collections = self._qdrant_client.get_collections().collections
			collection_names = {item.name for item in collections}
			if self._collection_name in collection_names:
				return

			vector_size = len(self._embeddings.embed_query("init"))
			self._qdrant_client.create_collection(
				collection_name=self._collection_name,
				vectors_config=self._VectorParams(
					size=vector_size, distance=self._Distance.COSINE
				),
			)
		except Exception:
			logger.exception("Failed to ensure Qdrant collection")
			raise

	def _load_dependencies(self) -> Dict[str, Any]:
		try:
			lc_embeddings = importlib.import_module("langchain_community.embeddings")
			lc_vectorstores = importlib.import_module("langchain_community.vectorstores")
			lc_documents = importlib.import_module("langchain_core.documents")
			lc_splitters = importlib.import_module("langchain_text_splitters")
			qdrant = importlib.import_module("qdrant_client")
			qdrant_models = importlib.import_module("qdrant_client.http.models")
		except Exception as exc:
			raise ImportError(
				"Missing dependencies for VectorStorageService: "
				"langchain-community, langchain-text-splitters, qdrant-client. "
				"Install them to enable vector indexing."
			) from exc

		return {
			"HuggingFaceEmbeddings": lc_embeddings.HuggingFaceEmbeddings,
			"Qdrant": lc_vectorstores.Qdrant,
			"Document": lc_documents.Document,
			"RecursiveCharacterTextSplitter": lc_splitters.RecursiveCharacterTextSplitter,
			"QdrantClient": qdrant.QdrantClient,
			"FieldCondition": qdrant_models.FieldCondition,
			"Filter": qdrant_models.Filter,
			"MatchAny": qdrant_models.MatchAny,
			"VectorParams": qdrant_models.VectorParams,
			"Distance": qdrant_models.Distance,
		}

	def index_video_transcript(
		self,
		video_id: str,
		transcript_segments: List[Dict[str, Any]],
		video_label: Optional[str] = None,
	) -> int:
		normalized_id = (
			video_label
			if video_label in {"video_a", "video_b"}
			else video_id
		)
		splitter = self._TextSplitter(chunk_size=300, chunk_overlap=50)
		documents: List[DocumentType] = []
		chunk_sizes: List[int] = []

		for segment_index, segment in enumerate(transcript_segments):
			text = str(segment.get("text", "")).strip()
			if not text:
				continue

			chunks = splitter.split_text(text)
			for chunk in chunks:
				metadata = {
					"video_id": normalized_id,
					"segment_index": segment_index,
					"segment_start": segment.get("start"),
					"segment_duration": segment.get("duration"),
				}
				documents.append(self._Document(page_content=chunk, metadata=metadata))
				chunk_sizes.append(len(chunk))

		if chunk_sizes:
			logger.info(
				"Indexing %s chunks for video_id=%s (min=%s, max=%s)",
				len(chunk_sizes),
				normalized_id,
				min(chunk_sizes),
				max(chunk_sizes),
			)
		else:
			logger.info("No transcript chunks to index for video_id=%s", normalized_id)

		try:
			if documents:
				self._vectorstore.add_documents(documents)
		except Exception as exc:
			logger.exception("Failed to store vectors for video_id=%s", video_id)
			raise exc

		return len(documents)

	def retrieve_context(
		self, query: str, video_ids: Iterable[str], k: int = 4
	) -> List[DocumentType]:
		video_id_list = [vid for vid in video_ids if vid]
		if not video_id_list:
			return []

		# Filtering vectors by metadata BEFORE search prevents context bleed across sessions.
		qdrant_filter = self._Filter(
			must=[
				self._FieldCondition(
					key="video_id",
					match=self._MatchAny(any=video_id_list),
				)
			]
		)

		try:
			return self._vectorstore.similarity_search(query, k=k, filter=qdrant_filter)
		except Exception as exc:
			logger.exception("Failed to retrieve context for query=%s", query)
			return []


class AgentState(TypedDict):
	user_query: str
	chat_history: List[Dict[str, str]]
	video_metadata_context: Dict[str, Dict[str, Any]]
	retrieved_chunks: List[DocumentType]
	final_response: str


class VideoRAGOrchestrator:
	def __init__(self, vector_service: VectorStorageService) -> None:
		self._vector_service = vector_service
		self._graph = self._build_graph()

	def _build_graph(self) -> Any:
		langgraph = self._load_langgraph_dependencies()
		state_graph = langgraph["StateGraph"](AgentState)

		state_graph.add_node("context_router", self._context_router)
		state_graph.add_node("format_metadata", self._format_metadata)
		state_graph.add_node("retrieve_vectors", self._retrieve_vectors)
		state_graph.add_node("generate_response", self._generate_response)

		state_graph.add_conditional_edges(
			"context_router",
			self._route_context,
			{
				"metadata": "format_metadata",
				"vectors": "retrieve_vectors",
			},
		)
		state_graph.set_entry_point("context_router")
		state_graph.add_edge("retrieve_vectors", "generate_response")
		state_graph.add_edge("format_metadata", langgraph["END"])
		state_graph.add_edge("generate_response", langgraph["END"])

		return state_graph.compile()

	def _load_langgraph_dependencies(self) -> Dict[str, Any]:
		try:
			graph = importlib.import_module("langgraph.graph")
		except Exception as exc:
			raise ImportError(
				"Missing dependency: langgraph. Install it to enable RAG orchestration."
			) from exc

		return {
			"StateGraph": graph.StateGraph,
			"END": graph.END,
		}

	def _load_llm_dependencies(self) -> Dict[str, Any]:
		try:
			llm_mod = importlib.import_module("langchain_google_genai")
			messages_mod = importlib.import_module("langchain_core.messages")
		except Exception as exc:
			raise ImportError(
				"Missing dependency: langchain-google-genai and langchain-core. "
				"Install them to enable LLM responses."
			) from exc

		return {
			"ChatGoogleGenerativeAI": llm_mod.ChatGoogleGenerativeAI,
			"SystemMessage": messages_mod.SystemMessage,
			"HumanMessage": messages_mod.HumanMessage,
		}

	async def _context_router(self, state: AgentState) -> AgentState:
		return state

	async def _route_context(self, state: AgentState) -> str:
		query = state["user_query"].lower()
		metrics_keywords = {
			"views",
			"likes",
			"comments",
			"engagement",
			"engagement rate",
			"followers",
			"follower",
			"metrics",
		}
		context_keywords = {
			"compare",
			"analysis",
			"analyze",
			"hook",
			"story",
			"narrative",
			"improve",
			"suggest",
			"insight",
			"why",
			"strategy",
		}

		if any(keyword in query for keyword in metrics_keywords) and not any(
			keyword in query for keyword in context_keywords
		):
			return "metadata"

		return "vectors"

	async def _format_metadata(self, state: AgentState) -> AgentState:
		lines: List[str] = []
		for label, metadata in state["video_metadata_context"].items():
			engagement_rate = float(metadata.get("engagement_rate", 0.0))
			lines.append(
				(
					f"{label}: views={metadata.get('views', 0)}, "
					f"likes={metadata.get('likes', 0)}, "
					f"comments={metadata.get('comments', 0)}, "
					f"followers={metadata.get('follower_count', 0)}, "
					f"engagement_rate={engagement_rate:.2f}%"
				)
			)

		final_response = "\n".join(lines) if lines else "No metadata available."
		state["final_response"] = final_response
		return state

	async def _retrieve_vectors(self, state: AgentState) -> AgentState:
		video_ids = [
			meta.get("video_id", "")
			for meta in state["video_metadata_context"].values()
		]
		try:
			state["retrieved_chunks"] = self._vector_service.retrieve_context(
				state["user_query"], video_ids
			)
		except Exception:
			state["retrieved_chunks"] = []
		return state

	async def _generate_response(self, state: AgentState) -> AgentState:
		from app.config import settings

		deps = self._load_llm_dependencies()
		ChatGoogleGenerativeAI = deps["ChatGoogleGenerativeAI"]
		SystemMessage = deps["SystemMessage"]
		HumanMessage = deps["HumanMessage"]

		chunks = state.get("retrieved_chunks", [])
		chunk_lines: List[str] = []
		for idx, chunk in enumerate(chunks, start=1):
			metadata = getattr(chunk, "metadata", {}) or {}
			segment = metadata.get("segment_index", "")
			start = metadata.get("segment_start", "")
			chunk_lines.append(
				f"[chunk {idx}] (segment={segment}, start={start}) {chunk.page_content}"
			)

		system_prompt = (
			"You are a video analytics assistant comparing two YouTube videos. "
			"Ground every claim in the provided chunks, cite chunk numbers, and "
			"compare pacing, titles, descriptions, hooks, and creator framing. "
			"Use engagement_rate values as given. If the context is insufficient, "
			"say so clearly."
		)
		user_prompt = (
			f"User question: {state['user_query']}\n"
			f"Chat history: {state['chat_history']}\n\n"
			"Context chunks:\n"
			+ "\n".join(chunk_lines)
		)

		if not settings.GOOGLE_API_KEY:
			state["final_response"] = (
				"GOOGLE_API_KEY is not configured. Set it to enable LLM responses."
			)
			return state

		llm = ChatGoogleGenerativeAI(
			model="gemini-2.5-flash",
			streaming=True,
			google_api_key=settings.GOOGLE_API_KEY,
		)
		response = await llm.ainvoke(
			[SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
		)
		state["final_response"] = getattr(response, "content", str(response))
		return state

	async def stream_analysis_response(
		self,
		user_query: str,
		chat_history: List[Dict[str, str]],
		video_metadata_context: Dict[str, Dict[str, Any]],
	) -> AsyncGenerator[str, None]:
		state: AgentState = {
			"user_query": user_query,
			"chat_history": chat_history,
			"video_metadata_context": video_metadata_context,
			"retrieved_chunks": [],
			"final_response": "",
		}

		stream_method = getattr(self._graph, "astream_events", None)
		if stream_method is None:
			result = await self._graph.ainvoke(state)
			yield result.get("final_response", "")
			return

		async for event in stream_method(state, version="v1"):
			if event.get("event") == "on_chat_model_stream":
				chunk = event.get("data", {}).get("chunk")
				text = getattr(chunk, "content", None)
				if text:
					yield text
