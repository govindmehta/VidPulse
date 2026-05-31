import "./App.css";
import { useEffect, useMemo, useState } from "react";

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

type Session = {
  id: string;
  title: string;
  date: string;
  data: IngestResponse;
};

// SVG Icons
const SunIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
);
const MoonIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
);
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);
const HistoryIcon = () => (
  <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [youtubeUrlA, setYoutubeUrlA] = useState<string>("");
  const [youtubeUrlB, setYoutubeUrlB] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Apply theme to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const activeData = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId)?.data || null;
  }, [sessions, activeSessionId]);

  const videoCards = useMemo<{
    videoA: VideoMetrics;
    videoB: VideoMetrics;
  } | null>(() => {
    if (!activeData) return null;

    return {
      videoA: { ...activeData.youtube_a, platform: "YouTube", slotLabel: "A" },
      videoB: { ...activeData.youtube_b, platform: "YouTube", slotLabel: "B" },
    };
  }, [activeData]);

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
      
      const newSession: Session = {
        id: crypto.randomUUID(),
        title: `${payload.youtube_a.title} vs ${payload.youtube_b.title}`,
        date: new Date().toLocaleDateString(),
        data: payload
      };

      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      
      // Clear inputs
      setYoutubeUrlA("");
      setYoutubeUrlB("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setYoutubeUrlA("");
    setYoutubeUrlB("");
    setError(null);
  };

  return (
    <div className="flex h-screen w-full gradient-bg text-slate-800 dark:text-slate-100 relative overflow-hidden transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-slate-900/40 backdrop-blur-xl flex flex-col z-20 shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600 dark:bg-indigo-500"></span>
            </span>
            <span className="font-bold tracking-widest text-sm text-indigo-900 dark:text-indigo-400 uppercase">VidPulse</span>
          </div>
          <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-400">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        <div className="px-4 pb-4">
          <button onClick={startNewSession} className="w-full flex items-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors rounded-xl px-4 py-3 text-sm font-semibold shadow-sm">
            <PlusIcon />
            <span>New Comparison</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-hide">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-2">Recent</p>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 px-2">No past comparisons yet.</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`sidebar-item group ${activeSessionId === s.id ? 'sidebar-item-active' : ''}`}
              >
                <HistoryIcon />
                <span className="truncate flex-1">{s.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Ambient lighting blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-600/20 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-600/20 blur-[120px] pointer-events-none"></div>

        {!activeData ? (
          /* Empty State / Prompt Area */
          <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 w-full max-w-3xl mx-auto animate-fade-in-up">
            <div className="text-center mb-10 text-slate-900 dark:text-white">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                What do you want to <span className="gradient-text">analyze?</span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                Drop two YouTube video links to uncover hooks, performance gaps, and strategy insights in real-time.
              </p>
            </div>

            <div className="w-full glass-panel rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col gap-4">
                <input
                  value={youtubeUrlA}
                  onChange={(event) => setYoutubeUrlA(event.target.value)}
                  placeholder="Paste YouTube Link A..."
                  className="glass-input rounded-xl w-full"
                />
                <input
                  value={youtubeUrlB}
                  onChange={(event) => setYoutubeUrlB(event.target.value)}
                  placeholder="Paste YouTube Link B..."
                  className="glass-input rounded-xl w-full"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-rose-500 dark:text-rose-400 font-medium px-2">
                    {error}
                  </div>
                  <button
                    onClick={handleIngest}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2 self-end"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                      </>
                    ) : "Analyze Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Analysis View */
          <div className="flex-1 overflow-y-auto p-6 md:p-8 z-10 w-full max-w-7xl mx-auto space-y-6 animate-fade-in-up">
            <header className="mb-2">
             <h2 className="text-2xl font-bold dark:text-white">Analysis Dashboard</h2>
             <p className="text-sm text-slate-500">Video metrics and AI comparison</p>
            </header>
            
            {videoCards && (
              <div className="grid gap-6 lg:grid-cols-2">
                <VideoCards videoA={videoCards.videoA} videoB={videoCards.videoB} />
              </div>
            )}
            
            <div className="h-[600px] mt-6">
              <ChatPanel videoIds={videoCards ? [videoCards.videoA.video_id, videoCards.videoB.video_id] : []} />
            </div>
            
            {/* Added spacer for scrolling comfort */}
            <div className="h-10"></div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
