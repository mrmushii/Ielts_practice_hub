"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, X, Bot, User, Expand, Headphones, Mic, BookOpen, PenTool } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import TutorRichText from "@/components/TutorRichText";
import { backendUrl } from "@/utils/backend";
import { buildTutorRoute, TutorAction, TutorChatResponse } from "@/utils/tutor-actions";

type TutorMessage = { role: "user" | "tutor"; content: string; actions?: TutorAction[] };

export default function TutorBubbleButton() {
  const router = useRouter();
  const pathname = usePathname();
  const hideOnTutorPage = pathname === "/tutor";
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      role: "tutor",
      content: "Hi, I am your AI Tutor. Ask me anything about IELTS and I will respond with grounded guidance.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = "tutor_popup_session_id";
    const existing = localStorage.getItem(key);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `popup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, generated);
    setSessionId(generated);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const executeAction = (action: TutorAction) => {
    if (action.requires_confirmation) {
      const allowed = window.confirm(`Open ${action.module} now?`);
      if (!allowed) return;
    }

    const safeRoute = ["/speaking", "/listening", "/reading", "/writing", "/tutor"].includes(action.route)
      ? action.route
      : "/tutor";
    router.push(buildTutorRoute(safeRoute, sessionId));
    setIsOpen(false);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    const messageHistory = messages.map((msg) => ({ role: msg.role, content: msg.content }));

    try {
      const res = await fetch(backendUrl("/api/tutor/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messageHistory,
          session_id: sessionId,
        }),
      });

      if (!res.ok) throw new Error("Tutor API failed");
      const data: TutorChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: data.response,
          actions: data.actions || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "tutor", content: "I hit a connection issue. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (hideOnTutorPage) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-90 max-w-[calc(100vw-24px)] h-140 max-h-[calc(100vh-120px)] animate-slide-up-fade">
          <div className="h-full rounded-2xl border border-white/15 bg-surface/85 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-surface/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent-light flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Control Tutor</p>
                  <p className="text-[11px] text-text-muted">One stop for every IELTS task</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/tutor"
                  className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface-hover flex items-center justify-center transition-colors"
                  title="Open full workspace"
                >
                  <Expand className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-foreground hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer"
                  title="Close assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-border bg-surface/40">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Speaking", route: "/speaking", icon: <Mic className="w-3.5 h-3.5" /> },
                  { label: "Listening", route: "/listening", icon: <Headphones className="w-3.5 h-3.5" /> },
                  { label: "Reading", route: "/reading", icon: <BookOpen className="w-3.5 h-3.5" /> },
                  { label: "Writing", route: "/writing", icon: <PenTool className="w-3.5 h-3.5" /> },
                ].map((item) => (
                  <button
                    key={item.route}
                    onClick={() => router.push(buildTutorRoute(item.route, sessionId))}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm ${msg.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wide opacity-80">
                      {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      <span>{msg.role === "user" ? "You" : "Tutor"}</span>
                    </div>
                    {msg.role === "tutor" ? (
                      <TutorRichText content={msg.content} className="text-foreground" />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {msg.role === "tutor" && msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => executeAction(action)}
                            className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent-light hover:bg-accent/20 transition-colors cursor-pointer"
                            title={action.description}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-surface border border-border px-3 py-2 text-xs text-text-muted flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={sendMessage} className="p-3 border-t border-border bg-surface/60">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your IELTS question..."
                  disabled={isLoading}
                  className="w-full bg-background border border-border rounded-xl pl-3 pr-11 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 group animate-pop-in"
        aria-label="Open AI Tutor"
        title="Open AI Tutor"
      >
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-accent/40 blur-lg opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="relative h-14 w-14 rounded-full bg-linear-to-br from-accent to-accent-light text-white border border-white/15 shadow-lg shadow-accent/40 flex items-center justify-center group-hover:scale-105 transition-transform">
            {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          </div>
        </div>
      </button>
    </>
  );
}
