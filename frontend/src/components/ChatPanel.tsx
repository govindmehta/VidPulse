import React, { useEffect, useRef, useState } from "react";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

type ChatPanelProps = {
	videoIds: string[];
};

const ChatPanel: React.FC<ChatPanelProps> = ({ videoIds }) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState<string>("");
	const [isSending, setIsSending] = useState<boolean>(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const endRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handle = requestAnimationFrame(() => {
			endRef.current?.scrollIntoView({ behavior: "smooth" });
		});
		return () => cancelAnimationFrame(handle);
	}, [messages]);

	const appendAssistantToken = (messageId: string, token: string) => {
		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === messageId
					? { ...msg, content: msg.content + token }
					: msg
			)
		);
	};

	const parseSseBuffer = (
		buffer: string,
		onToken: (token: string) => void
	): string => {
		const parts = buffer.split("\n\n");
		const remainder = parts.pop() ?? "";

		for (const part of parts) {
			const line = part
				.split("\n")
				.find((entry) => entry.startsWith("data:"));
			if (!line) continue;
			const token = line.replace(/^data:\s?/, "");
			if (token) onToken(token);
		}

		return remainder;
	};

	const handleSend = async () => {
		const query = input.trim();
		if (!query || isSending) return;

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: query,
		};
		const assistantMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
		};

		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setInput("");
		setIsSending(true);

		try {
			const response = await fetch("http://localhost:8000/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_query: query,
					video_ids: videoIds,
					chat_history: messages.map((msg) => ({
						role: msg.role,
						content: msg.content,
					})),
				}),
			});

			if (!response.body) {
				throw new Error("Streaming response not available");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				buffer = parseSseBuffer(buffer, (token) =>
					appendAssistantToken(assistantMessage.id, token)
				);
			}
		} catch (error) {
			appendAssistantToken(
				assistantMessage.id,
				"\n[Stream error] Unable to reach the analysis service."
			);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.3em] text-slate-500">
						Live Analysis
					</p>
					<h3 className="text-lg font-semibold text-slate-100">Chat Console</h3>
				</div>
				<div className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs text-slate-400">
					{isSending ? "Streaming" : "Ready"}
				</div>
			</div>

			<div
				ref={containerRef}
				className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4"
			>
				{messages.length === 0 ?
					(
						<div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-500">
							Ask about performance, hooks, or improvement ideas to start streaming analysis.
						</div>
					) :
					messages.map((message) => (
						<div
							key={message.id}
							className={
								message.role === "user"
									? "ml-auto max-w-[80%] rounded-2xl bg-slate-800/80 px-4 py-3 text-sm text-slate-100"
									: "max-w-[80%] rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
							}
						>
							{message.content}
						</div>
					))}
				<div ref={endRef} />
			</div>

			<div className="mt-4 flex gap-3">
				<input
					value={input}
					onChange={(event) => setInput(event.target.value)}
					placeholder="Ask for comparisons, hook analysis, or improvement ideas"
					className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-700 focus:outline-none"
				/>
				<button
					onClick={handleSend}
					disabled={isSending}
					className="rounded-xl border border-slate-800 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/30 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Send
				</button>
			</div>
		</div>
	);
};

export default ChatPanel;
