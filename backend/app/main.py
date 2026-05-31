from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas import VideoAnalysisRequest, VideoMetadata
from app.services.rag_engine import VectorStorageService, VideoRAGOrchestrator
from app.services.scraper import VideoScraperService

logger = logging.getLogger(__name__)

app = FastAPI(title="VidPulse API")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class ChatRequest(BaseModel):
	user_query: str = Field(..., min_length=1)
	video_ids: List[str]
	chat_history: List[Dict[str, str]]


@app.on_event("startup")
async def startup_event() -> None:
	try:
		app.state.scraper_service = VideoScraperService()
		app.state.vector_service = VectorStorageService()
		app.state.orchestrator = VideoRAGOrchestrator(app.state.vector_service)
		logger.info("Services initialized")
	except Exception:
		logger.exception("Failed to initialize services")
		raise


@app.post("/api/ingest") 
async def ingest_videos(payload: VideoAnalysisRequest) -> Dict[str, Any]:
	try:
		scraper: VideoScraperService = app.state.scraper_service
		vector_service: VectorStorageService = app.state.vector_service

		youtube_a, youtube_b = await scraper.fetch_youtube_pair(
			payload.youtube_url_a, payload.youtube_url_b
		)

		youtube_a_segments = [seg.model_dump() for seg in youtube_a.transcript_segments]
		youtube_b_segments = [seg.model_dump() for seg in youtube_b.transcript_segments]

		logger.info("Indexing start: video_a=%s", youtube_a.video_id)
		await vector_service.index_video_transcript(
			youtube_a.video_id, youtube_a_segments, video_label="video_a"
		)
		logger.info("Indexing complete: video_a=%s", youtube_a.video_id)

		logger.info("Indexing start: video_b=%s", youtube_b.video_id)
		await vector_service.index_video_transcript(
			youtube_b.video_id, youtube_b_segments, video_label="video_b"
		)
		logger.info("Indexing complete: video_b=%s", youtube_b.video_id)

		return {
			"youtube_a": youtube_a.model_dump(),
			"youtube_b": youtube_b.model_dump(),
		}
	except Exception as exc:
		logger.exception("Ingest failed")
		raise HTTPException(status_code=500, detail=str(exc)) from exc


async def _stream_events(tokens: AsyncGenerator[str, None]) -> AsyncGenerator[str, None]:
	async for token in tokens:
		yield f"data: {token}\n\n"


@app.post("/api/chat")
async def chat(payload: ChatRequest) -> StreamingResponse:
	try:
		orchestrator: VideoRAGOrchestrator = app.state.orchestrator

		metadata_context: Dict[str, Dict[str, Any]] = {}
		normalized_ids = [vid for vid in payload.video_ids if vid]
		if normalized_ids:
			metadata_context["video_a"] = {"video_id": "video_a"}
		if len(normalized_ids) > 1:
			metadata_context["video_b"] = {"video_id": "video_b"}

		token_stream = orchestrator.stream_analysis_response(
			user_query=payload.user_query,
			chat_history=payload.chat_history,
			video_metadata_context=metadata_context,
		)

		return StreamingResponse(
			_stream_events(token_stream), media_type="text/event-stream"
		)
	except Exception as exc:
		logger.exception("Chat request failed")
		raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
async def healthcheck() -> Dict[str, Any]:
	return {
		"status": "ok",
		"host": settings.HOST,
		"port": settings.PORT,
	}
