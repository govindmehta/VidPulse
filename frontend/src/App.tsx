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
    <div className="min-h-screen gradient-bg text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none"></div>

      <div className="mx-auto w-full max-w-6xl px-6 py-12 relative z-10 flex flex-col flex-1">
        <section className="glass-panel rounded-3xl p-8 sm:p-12 animate-fade-in-up">
          <div className="flex flex-col gap-8">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                <p className="text-xs uppercase tracking-[0.3em] font-semibold text-indigo-400">
                  VidPulse
                </p>
              </div>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Real-time video intelligence <br className="hidden sm:block"/>
                <span className="gradient-text">for creator strategy</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-400 leading-relaxed sm:text-lg">
                Paste two YouTube videos to compare performance, engagement, and
                creative hooks with instant context-aware insights.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-2">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-xl blur opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
                <input
                  value={youtubeUrlA}
                  onChange={(event) => setYoutubeUrlA(event.target.value)}
                  placeholder="YouTube Video URL A"
                  className="glass-input rounded-xl w-full relative z-10"
                />
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-xl blur opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
                <input
                  value={youtubeUrlB}
                  onChange={(event) => setYoutubeUrlB(event.target.value)}
                  placeholder="YouTube Video URL B"
                  className="glass-input rounded-xl w-full relative z-10"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleIngest}
                disabled={loading}
                className="btn-primary w-full sm:w-auto"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Videos...
                  </span>
                ) : (
                  "Initiate Analysis"
                )}
              </button>
              {error ?
                <div className="rounded-lg bg-rose-500/10 px-4 py-2 border border-rose-500/20 text-rose-300 text-sm animate-fade-in-up">
                  {error}
                </div>
              : null}
            </div>
          </div>
        </section>

        {videoCards ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] flex-1 animate-fade-in-up-delay-1 pb-10">
            <div>
              <VideoCards videoA={videoCards.videoA} videoB={videoCards.videoB} />
            </div>
            <ChatPanel
              videoIds={[videoCards.videoA.video_id, videoCards.videoB.video_id]}
            />
          </section>
        ) : (
          <div className="mt-16 flex-1 flex flex-col items-center justify-center text-center opacity-50 animate-pulse-slow">
            <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-500 font-medium">Awaiting video inputs for comparison</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
