from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class VideoAnalysisRequest(BaseModel):
	youtube_url_a: str = Field(..., min_length=1)
	youtube_url_b: str = Field(..., min_length=1)


class TranscriptSegment(BaseModel):
	text: str
	start: float
	duration: float


class VideoMetadata(BaseModel):
	video_id: str
	title: str
	views: int
	likes: int
	comments: int
	creator: str
	follower_count: int
	engagement_rate: float
	upload_date: str
	duration: int
	transcript_segments: List[TranscriptSegment]
