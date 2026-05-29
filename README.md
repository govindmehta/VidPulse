# VidPulse

## 🚀 Project Overview & Vision
VidPulse is a high-performance, full-stack video RAG platform built to compare two YouTube videos side-by-side. It focuses on deterministic ingestion and low-latency analysis: synchronous metadata extraction, engagement rate calculation, local transcript chunking, and real-time conversational streaming over Server-Sent Events (SSE).

## 🛠️ Optimized Tech Stack & Cost Defense ($0 Footprint)
**Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Engineering Defense**: Kept intentionally lean to reduce main-thread overhead. The UI avoids heavy iframe embeds on initial render, using lightweight placeholders to prevent jank and improve first interaction.

**Backend**: FastAPI
- **Engineering Defense**: Async-first runtime that handles SSE token streaming without blocking I/O. The API can keep long-lived streaming connections without starving other requests.

**Orchestration**: LangGraph Compiled State Machine
- **Engineering Defense**: Deterministic routing at the code layer. Pure metric queries bypass vector retrieval, which saves latency and compute when a query doesn’t need semantic context.

**Free Vector Engine**: Local Persistent Qdrant + Local HuggingFace embeddings (`all-MiniLM-L6-v2`)
- **Engineering Defense**: All embeddings run on CPU locally, and Qdrant stores vectors on disk. This eliminates per-request embedding fees and avoids hosted vector database costs entirely.

**LLM**: Gemini 2.5 Flash
- **Engineering Defense**: Low-latency output with minimal cost per request. Fast streaming fits the real-time UX without needing a heavy model for every query.

## 📁 Repository & System Architecture
```
backend/
	app/
		__init__.py
		config.py
		main.py
		schemas.py
		services/
			__init__.py
			rag_engine.py
			scraper.py
	requirements.txt

frontend/
	src/
		App.tsx
		components/
			ChatPanel.tsx
			VideoCards.tsx
```

## ⚙️ Local Installation & Quickstart
**Backend (FastAPI)**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (Vite)**
```bash
cd frontend
npm install
npm run dev
```

**.env example**
```
GOOGLE_API_KEY=your_google_api_key
QDRANT_STORAGE_PATH=./qdrant_storage
```

## ⚡ Enterprise Scaling Blueprint (The Interview Defense)
**High-Volume Scraping**
- At scale, YouTube rate limiting is a hard constraint. Production scraping needs a rotating pool of residential proxy gateways (e.g., Bright Data) with IP rotation and randomized request pacing.

**Ingestion Queue & Hash Cache**
- Video URLs are normalized and mapped to deterministic SHA-256 hashes in Redis. If a video has already been indexed, ingestion is bypassed and the cached vector index is reused immediately. This cuts compute and avoids repeated transcript parsing for trending assets.