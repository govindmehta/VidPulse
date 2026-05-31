import React from "react";

export type VideoMetrics = {
	video_id: string;
	title: string;
	views: number;
	likes: number;
	comments: number;
	engagement_rate: number;
	platform: "YouTube";
	slotLabel: "A" | "B";
};

type VideoCardsProps = {
	videoA: VideoMetrics;
	videoB: VideoMetrics;
};

const badgeStyles: Record<VideoMetrics["slotLabel"], string> = {
	A: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]",
	B: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]",
};

const platformIcon = () => (
	<svg
		aria-hidden
		viewBox="0 0 24 24"
		className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-300"
		fill="currentColor"
	>
		<path d="M23.5 6.2a2.9 2.9 0 0 0-2-2C19.7 3.8 12 3.8 12 3.8s-7.7 0-9.5.4a2.9 2.9 0 0 0-2 2C0 8 0 12 0 12s0 4 .5 5.8a2.9 2.9 0 0 0 2 2C4.3 20.2 12 20.2 12 20.2s7.7 0 9.5-.4a2.9 2.9 0 0 0 2-2c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8zM9.8 15.6V8.4l6.4 3.6-6.4 3.6z" />
	</svg>
);

const MetricRow: React.FC<{ label: string; value: number | string }> = ({
	label,
	value,
}) => (
	<div className="flex items-center justify-between text-sm py-1 border-b border-slate-200 dark:border-white/5 last:border-0 group/row">
		<span className="text-slate-500 dark:text-slate-400 group-hover/row:text-slate-800 dark:group-hover/row:text-slate-300 transition-colors">{label}</span>
		<span className="font-semibold text-slate-800 dark:text-slate-100 group-hover/row:text-black dark:group-hover/row:text-white transition-colors">{value}</span>
	</div>
);

const VideoCard: React.FC<{ data: VideoMetrics }> = ({ data }) => (
	<div className="flex flex-col h-full glass-card rounded-3xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 hover:border-slate-300 dark:hover:border-white/10 group">
		<div className="flex items-start justify-between mb-2">
			<div className="flex items-center gap-3">
				<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner ${data.slotLabel === 'A' ? 'from-indigo-400 to-indigo-600 shadow-indigo-500/50' : 'from-purple-400 to-purple-600 shadow-purple-500/50'}`}>
					{platformIcon()}
				</div>
				<div>
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
						YouTube Video {data.slotLabel}
					</p>
					<h3 className="text-base font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mt-0.5 group-hover:text-black dark:group-hover:text-white transition-colors" title={data.title}>{data.title}</h3>
				</div>
			</div>
			<div
				className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold uppercase backdrop-blur-md transition-all duration-300 ${
					badgeStyles[data.slotLabel]
				}`}
			>
				{data.engagement_rate.toFixed(2)}% ER
			</div>
		</div>

		<div className="mt-4 flex flex-1 flex-col gap-4">
			<div className="rounded-2xl border border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/40 p-4 relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-tr from-black/[0.02] dark:from-white/[0.02] to-transparent pointer-events-none"></div>
				<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Preview Context</p>
				<div className="flex items-center gap-4 relative z-10">
					<div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/10 relative overflow-hidden group/thumb">
					    <div className="absolute inset-0 bg-black/5 dark:bg-black/40 group-hover/thumb:bg-black/10 dark:group-hover/thumb:bg-black/20 transition-colors z-10"></div>
						<div className="relative z-20 text-slate-400 dark:text-white/50 group-hover/thumb:text-slate-600 dark:group-hover/thumb:text-white/90 group-hover/thumb:scale-110 transition-all duration-300">
							<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5v14l11-7z" /></svg>
						</div>
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-2">{data.title}</p>
						<p className="text-xs text-slate-500 font-mono mt-1 bg-slate-200/50 dark:bg-slate-900/50 inline-block px-2 py-0.5 rounded border border-slate-300/50 dark:border-white/5">ID: {data.video_id}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-slate-950/30 p-5 mt-auto">
				<MetricRow label="Views" value={data.views.toLocaleString()} />
				<MetricRow label="Likes" value={data.likes.toLocaleString()} />
				<MetricRow label="Comments" value={data.comments.toLocaleString()} />
			</div>
		</div>
	</div>
);

const VideoCards: React.FC<VideoCardsProps> = ({ videoA, videoB }) => {
	return (
		<div className="grid gap-5 lg:grid-cols-2">
			<VideoCard data={videoA} />
			<VideoCard data={videoB} />
		</div>
	);
};

export default VideoCards;
