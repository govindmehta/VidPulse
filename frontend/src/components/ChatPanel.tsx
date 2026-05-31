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
		<div className="flex h-[600px] lg:h-full flex-col glass-card rounded-3xl p-6 relative overflow-hidden group">
			{/* Subtle inner glow */}
			<div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

			<div className="mb-5 flex items-center justify-between relative z-10">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<span className={`h-2 w-2 rounded-full ${isSending ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'}`}></span>
						<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
							Live Analysis
						</p>
					</div>
					<h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-400">Chat Console</h3>
				</div>
				<div className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition-colors ${isSending ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
					{isSending ? "Streaming..." : "Ready"}
				</div>
			</div>

			<div
				ref={containerRef}
				className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/5 bg-slate-950/40 p-5 shadow-inner relative z-10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/50 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-track]:bg-transparent"
			>
				{messages.length === 0 ?
					(
						<div className="flex h-full flex-col items-center justify-center text-center p-6 animate-fade-in-up">
							<div className="h-12 w-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-white/5">
								<svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
								</svg>
							</div>
							<p className="text-sm font-medium text-slate-300 mb-2">Start the conversation</p>
							<p className="text-xs text-slate-500 max-w-[200px]">Ask about performance, hooks, or improvement ideas to begin.</p>
						</div>
					) :
					messages.map((message) => (
						<div
							key={message.id}
							className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
						>
							<div
								className={
									message.role === "user"
										? "max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-indigo-700 px-5 py-3.5 text-sm text-white shadow-lg shadow-indigo-500/20"
										: "max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-slate-800/60 backdrop-blur-sm px-5 py-3.5 text-sm text-slate-200 leading-relaxed shadow-md"
								}
							>
								{message.content}
								{message.role === "assistant" && message.content === "" && isSending && (
									<span className="inline-flex gap-1">
										<span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
										<span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
										<span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
									</span>
								)}
							</div>
						</div>
					))}
				<div ref={endRef} />
			</div>

			<div className="mt-5 flex gap-3 relative z-10">
				<div className="relative flex-1 group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none"></div>
					<input
						value={input}
						onChange={(event) => setInput(event.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
						placeholder="Ask for comparisons or ideas..."
						className="glass-input rounded-xl w-full relative z-10"
					/>
				</div>
				<button
					onClick={handleSend}
					disabled={isSending || !input.trim()}
					className="btn-primary rounded-xl flex items-center justify-center p-3 sm:px-5 shrink-0"
					aria-label="Send message"
				>
					<span className="hidden sm:inline">Send</span>
					<svg className="w-5 h-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
				</button>
			</div>
		</div>
	);
};

export default ChatPanel;
