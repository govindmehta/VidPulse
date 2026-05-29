from __future__ import annotations

import importlib
import logging
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)
DocumentType = Any


class VectorStorageService:
	def __init__(
		self,
		collection_name: str = "video_transcripts",
		qdrant_path: Optional[str] = None,
	) -> None:
		deps = self._load_dependencies()
		self._Document = deps["Document"]
		self._TextSplitter = deps["RecursiveCharacterTextSplitter"]
		self._Filter = deps["Filter"]
		self._FieldCondition = deps["FieldCondition"]
		self._MatchAny = deps["MatchAny"]
		# This embedding model runs fully local on CPU, avoiding external APIs or token fees.
		self._embeddings = deps["HuggingFaceEmbeddings"](model_name="all-MiniLM-L6-v2")

		if qdrant_path:
			self._qdrant_client = deps["QdrantClient"](path=qdrant_path)
		else:
			self._qdrant_client = deps["QdrantClient"](":memory:")

		self._collection_name = collection_name
		self._vectorstore = deps["Qdrant"](
			client=self._qdrant_client,
			collection_name=self._collection_name,
			embeddings=self._embeddings,
		)

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
		}

	def index_video_transcript(
		self, video_id: str, transcript_segments: List[Dict[str, Any]]
	) -> int:
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
					"video_id": video_id,
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
				video_id,
				min(chunk_sizes),
				max(chunk_sizes),
			)
		else:
			logger.info("No transcript chunks to index for video_id=%s", video_id)

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
			raise exc
