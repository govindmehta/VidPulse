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
	A: "bg-rose-500/15 text-rose-300 border-rose-400/30",
	B: "bg-red-500/15 text-red-300 border-red-400/30",
};

const platformIcon = () => (
	<svg
		aria-hidden
		viewBox="0 0 24 24"
		className="h-5 w-5 text-rose-400"
		fill="currentColor"
	>
		<path d="M23.5 6.2a2.9 2.9 0 0 0-2-2C19.7 3.8 12 3.8 12 3.8s-7.7 0-9.5.4a2.9 2.9 0 0 0-2 2C0 8 0 12 0 12s0 4 .5 5.8a2.9 2.9 0 0 0 2 2C4.3 20.2 12 20.2 12 20.2s7.7 0 9.5-.4a2.9 2.9 0 0 0 2-2c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8zM9.8 15.6V8.4l6.4 3.6-6.4 3.6z" />
	</svg>
);

const MetricRow: React.FC<{ label: string; value: number | string }> = ({
	label,
	value,
}) => (
	<div className="flex items-center justify-between text-sm text-slate-300">
		<span className="text-slate-500">{label}</span>
		<span className="font-medium text-slate-100">{value}</span>
	</div>
);

const VideoCard: React.FC<{ data: VideoMetrics }> = ({ data }) => (
	<div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800">
					{platformIcon()}
				</div>
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-slate-500">
						YouTube Video {data.slotLabel}
					</p>
					<h3 className="text-lg font-semibold text-slate-100">{data.title}</h3>
				</div>
			</div>
			<div
				className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
					badgeStyles[data.slotLabel]
				}`}
			>
				{data.engagement_rate.toFixed(2)}% ER
			</div>
		</div>

		<div className="mt-4 flex flex-1 flex-col gap-3">
			<div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6">
				<p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
				<div className="mt-3 flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/70">
						{platformIcon()}
					</div>
					<div>
						<p className="text-sm font-medium text-slate-200">{data.title}</p>
						<p className="text-xs text-slate-500">Video ID: {data.video_id}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-4">
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
