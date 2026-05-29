import "./App.css";
import { useMemo, useState } from "react";

import ChatPanel from "./components/ChatPanel";
import VideoCards from "./components/VideoCards";
import type { VideoMetrics } from "./components/VideoCards";

type IngestResponse = {
  youtube_a: {
    video_id: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    engagement_rate: number;
  };
  youtube_b: {
    video_id: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    engagement_rate: number;
  };
};

function App() {
  const [youtubeUrlA, setYoutubeUrlA] = useState<string>("");
  const [youtubeUrlB, setYoutubeUrlB] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestData, setIngestData] = useState<IngestResponse | null>(null);

  const videoCards = useMemo<{
    videoA: VideoMetrics;
    videoB: VideoMetrics;
  } | null>(() => {
    if (!ingestData) return null;

    return {
      videoA: {
        ...ingestData.youtube_a,
        platform: "YouTube",
        slotLabel: "A",
      },
      videoB: {
        ...ingestData.youtube_b,
        platform: "YouTube",
        slotLabel: "B",
      },
    };
  }, [ingestData]);

  const handleIngest = async () => {
    if (!youtubeUrlA.trim() || !youtubeUrlB.trim()) {
      setError("Provide both video URLs to start ingestion.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_url_a: youtubeUrlA.trim(),
          youtube_url_b: youtubeUrlB.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Ingestion failed. Check the backend logs.");
      }

      const payload = (await response.json()) as IngestResponse;
      setIngestData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-slate-500">
                VidPulse
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">
                Real-time video intelligence for creator strategy
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                Paste two YouTube videos to compare performance, engagement, and
                creative hooks with instant context-aware insights.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={youtubeUrlA}
                onChange={(event) => setYoutubeUrlA(event.target.value)}
                placeholder="YouTube Video URL A"
                className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-700 focus:outline-none"
              />
              <input
                value={youtubeUrlB}
                onChange={(event) => setYoutubeUrlB(event.target.value)}
                placeholder="YouTube Video URL B"
                className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-700 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleIngest}
                disabled={loading}
                className="rounded-xl border border-slate-800 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Ingest videos"}
              </button>
              {error ?
                <p className="text-sm text-rose-400">{error}</p>
              : null}
            </div>
          </div>
        </section>

        {videoCards ? (
          <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <VideoCards videoA={videoCards.videoA} videoB={videoCards.videoB} />
            </div>
            <ChatPanel
              videoIds={[videoCards.videoA.video_id, videoCards.videoB.video_id]}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default App;
