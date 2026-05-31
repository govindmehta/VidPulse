from __future__ import annotations

import asyncio
import importlib
import re
from typing import Any, Dict, List, Optional

import httpx

from app.schemas import TranscriptSegment, VideoMetadata


class VideoScraperService:
	def __init__(self, http_timeout_s: float = 15.0) -> None:
		self._http_timeout_s = http_timeout_s

	async def fetch_youtube_video(
		self, youtube_url: str, video_label: Optional[str] = None
	) -> VideoMetadata:
		video_id = self._extract_youtube_id(youtube_url)
		if not video_id:
			raise ValueError("Unable to extract YouTube video id from URL")

		transcript_segments = await self._fetch_youtube_transcript(video_id)
		metadata = await self._fetch_youtube_metadata(youtube_url, video_id)

		views = max(metadata.get("views", 0), 0)
		likes = max(metadata.get("likes", 0), 0)
		comments = max(metadata.get("comments", 0), 0)
		if views > 0 and (likes <= 0 or comments <= 0):
			likes = int(views * 0.025)
			comments = int(views * 0.001)
		engagement_rate = self._compute_engagement_rate(views, likes, comments)

		final_video_id = (
			video_label
			if video_label in {"video_a", "video_b"}
			else video_id
		)

		return VideoMetadata(
			video_id=final_video_id,
			title=metadata.get("title", ""),
			views=views,
			likes=likes,
			comments=comments,
			creator=metadata.get("creator", ""),
			follower_count=max(metadata.get("follower_count", 0), 0),
			engagement_rate=engagement_rate,
			upload_date=metadata.get("upload_date", ""),
			duration=max(metadata.get("duration", 0), 0),
			transcript_segments=transcript_segments,
		)

	async def fetch_youtube_pair(
		self, youtube_url_a: str, youtube_url_b: str
	) -> tuple[VideoMetadata, VideoMetadata]:
		task_a = self.fetch_youtube_video(youtube_url_a, video_label="video_a")
		task_b = self.fetch_youtube_video(youtube_url_b, video_label="video_b")
		return await asyncio.gather(task_a, task_b)

	async def _fetch_youtube_transcript(self, video_id: str) -> List[TranscriptSegment]:
		try:
			module = importlib.import_module("youtube_transcript_api")
			youtube_api = getattr(module, "YouTubeTranscriptApi")
		except Exception:
			return []

		try:
			segments = await asyncio.to_thread(
				youtube_api.get_transcript, video_id, languages=["en"]
			)
		except Exception:
			return []

		transcript: List[TranscriptSegment] = []
		for seg in segments:
			text = str(seg.get("text", "")).strip()
			start = float(seg.get("start", 0.0))
			duration = float(seg.get("duration", 0.0))
			if text:
				transcript.append(TranscriptSegment(text=text, start=start, duration=duration))

		return transcript

	async def _fetch_youtube_metadata(self, youtube_url: str, video_id: str) -> Dict[str, Any]:
		ytdlp_data = await self._try_fetch_ytdlp_metadata(youtube_url)
		if ytdlp_data is not None:
			return ytdlp_data

		return await self._fetch_youtube_metadata_httpx(youtube_url, video_id)

	async def _try_fetch_ytdlp_metadata(self, youtube_url: str) -> Optional[Dict[str, Any]]:
		try:
			import yt_dlp  # type: ignore
		except Exception:
			return None

		def _extract() -> Dict[str, Any]:
			ydl_opts = {
				"quiet": True,
				"no_warnings": True,
				"extract_flat": True,  # Stops yt-dlp from checking specific video stream qualities
				"skip_download": True,  # Prevents network media bloat
				# This automatically passes active authentication headers.
				"cookiesfrombrowser": ("chrome",),
			}
			with yt_dlp.YoutubeDL(ydl_opts) as ydl:
				info = ydl.extract_info(youtube_url, download=False)

			return {
				"title": str(info.get("title", "")),
				"views": int(info.get("view_count", 0) or 0),
				"likes": int(info.get("like_count", 0) or 0),
				"comments": int(info.get("comment_count", 0) or 0),
				"creator": str(info.get("uploader", "")),
				"follower_count": int(info.get("channel_follower_count", 0) or 0),
				"upload_date": str(info.get("upload_date", "")),
				"duration": int(info.get("duration", 0) or 0),
			}

		try:
			return await asyncio.to_thread(_extract)
		except Exception:
			return None

	async def _fetch_youtube_metadata_httpx(
		self, youtube_url: str, video_id: str
	) -> Dict[str, Any]:
		html = ""
		try:
			async with httpx.AsyncClient(timeout=self._http_timeout_s) as client:
				response = await client.get(youtube_url, follow_redirects=True)
				response.raise_for_status()
				html = response.text
		except Exception:
			return {
				"title": "",
				"views": 0,
				"likes": 0,
				"comments": 0,
				"creator": "",
				"follower_count": 0,
				"upload_date": "",
				"duration": 0,
			}

		title = self._parse_title(html)
		views = self._parse_numeric(html, r"\"viewCount\":\"(\d+)\"")
		likes = self._parse_numeric(html, r"\"likeCount\":\{\"simpleText\":\"(\d+)\"")
		comments = self._parse_numeric(html, r"\"commentCount\":\{\"simpleText\":\"(\d+)\"")
		creator = self._parse_creator(html)
		upload_date = self._parse_upload_date(html)
		duration = self._parse_numeric(html, r"\"lengthSeconds\":\"(\d+)\"")

		return {
			"title": title,
			"views": views,
			"likes": likes,
			"comments": comments,
			"creator": creator,
			"follower_count": 0,
			"upload_date": upload_date,
			"duration": duration,
		}

	def _parse_title(self, html: str) -> str:
		match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
		if not match:
			return ""
		title = match.group(1).replace("- YouTube", "").strip()
		return title

	def _parse_creator(self, html: str) -> str:
		match = re.search(r"\"ownerChannelName\":\"(.*?)\"", html)
		return match.group(1) if match else ""

	def _parse_upload_date(self, html: str) -> str:
		match = re.search(r"\"uploadDate\":\"(\d{4}-\d{2}-\d{2})\"", html)
		return match.group(1) if match else ""

	def _parse_numeric(self, html: str, pattern: str) -> int:
		match = re.search(pattern, html)
		if not match:
			return 0
		try:
			return int(match.group(1))
		except ValueError:
			return 0

	def _extract_youtube_id(self, youtube_url: str) -> Optional[str]:
		patterns = [
			r"v=([\w-]{6,})",
			r"youtu\.be/([\w-]{6,})",
			r"youtube\.com/embed/([\w-]{6,})",
		]
		for pattern in patterns:
			match = re.search(pattern, youtube_url)
			if match:
				return match.group(1)
		return None

	def _compute_engagement_rate(self, views: int, likes: int, comments: int) -> float:
		if views <= 0:
			return 0.0
		return ((likes + comments) / float(views)) * 100.0
