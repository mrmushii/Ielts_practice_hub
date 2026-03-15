"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Layout,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Send,
  User,
  X,
} from "lucide-react";
import TutorRichText from "@/components/TutorRichText";
import { backendUrl } from "@/utils/backend";

type TutorMessage = { role: "user" | "tutor"; content: string };

export default function TutorPage() {
  const router = useRouter();

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      role: "tutor",
      content:
        "Welcome to your AI IELTS Tutor. Ask me anything about Speaking, Writing, Reading, or Listening. I can also ground answers with live web search and your uploaded PDFs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeCanvasContent, setActiveCanvasContent] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const storageKey = "tutor_session_id";
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      setSessionId(existing);
      return;
    }

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    localStorage.setItem(storageKey, generated);
    setSessionId(generated);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch(backendUrl("/api/tutor/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          session_id: sessionId,
        }),
      });

      if (!res.ok) throw new Error("Tutor API failed");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "tutor", content: data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "tutor", content: "I hit a connection issue. Please try again in a moment." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }

    setIsUploadingPdf(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `(Attached ${file.name})` },
      { role: "tutor", content: "Reading your document now..." },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(backendUrl("/api/documents/upload"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("PDF upload failed");

      setMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: "Document indexed successfully. Ask me questions and I will ground answers on your file.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: "I could not read that PDF. Please try another file.",
        },
      ]);
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const toggleMic = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await fetch(backendUrl("/api/tutor/transcribe"), {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          if (data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              role: "tutor",
              content: "I could not transcribe the recording. Please try again.",
            },
          ]);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setIsListening(true);
    } catch {
      alert("Please allow microphone access to use voice input.");
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent-light">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">AI Tutor Workspace</h1>
              <p className="truncate text-xs text-text-muted">Stable chat, live grounding, PDF support, and voice input</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/"
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              Home
            </Link>
            <Link
              href="/writing"
              className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent-light transition-colors hover:bg-accent/20"
            >
              Writing
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid min-h-[calc(100dvh-110px)] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="glass-card flex min-h-[70dvh] flex-col overflow-hidden xl:min-h-0">
            <div className="border-b border-border bg-surface/60 px-4 py-3 sm:px-5">
              <p className="text-sm text-text-muted">Ask detailed IELTS questions and open good tutor responses in Canvas.</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-surface/10 p-4 sm:p-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[92%] sm:max-w-[85%]">
                    <div className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          msg.role === "user" ? "bg-emerald-500/20 text-emerald-400" : "bg-accent/20 text-accent"
                        }`}
                      >
                        {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "rounded-tr-sm bg-accent text-white"
                            : "rounded-tl-sm border border-border bg-surface text-foreground"
                        }`}
                      >
                        {msg.role === "tutor" ? (
                          <TutorRichText content={msg.content} className="text-foreground" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>

                    {msg.role === "tutor" && msg.content.length > 80 && (
                      <div className="mt-2 ml-10 sm:ml-11">
                        <button
                          onClick={() => setActiveCanvasContent(msg.content)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 hover:text-accent-light"
                          title="Show in Canvas"
                        >
                          <Layout className="h-3.5 w-3.5" />
                          Show in Canvas
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking and grounding response...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="border-t border-border bg-surface/60 p-3 sm:p-4">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
                title="Upload PDF"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploadingPdf || isLoading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                  title="Attach PDF"
                >
                  {isUploadingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isUploadingPdf || isLoading}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
                    isListening
                      ? "animate-pulse border-red-500/50 bg-red-500/20 text-red-500"
                      : "border-border bg-surface text-text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
                  title="Voice input"
                >
                  <Mic className="h-5 w-5" />
                </button>

                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your IELTS question..."
                    disabled={isLoading}
                    className="w-full rounded-xl border border-border bg-background py-3 pl-4 pr-12 text-sm text-foreground placeholder:text-text-muted focus:border-accent/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="glass-card hidden min-h-[70dvh] flex-col overflow-hidden xl:flex">
            <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layout className="h-4 w-4 text-accent" />
                Artifact Canvas
              </h2>
              {activeCanvasContent && (
                <button
                  onClick={() => setActiveCanvasContent(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  title="Close canvas"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeCanvasContent ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{activeCanvasContent}</div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-sm text-text-muted">
                  Open any tutor response in Canvas to focus on long feedback, outlines, and writing plans.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {activeCanvasContent && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 xl:hidden">
          <div className="glass-card flex max-h-[82dvh] w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface/70 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layout className="h-4 w-4 text-accent" />
                Artifact Canvas
              </h3>
              <button
                onClick={() => setActiveCanvasContent(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                title="Close canvas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{activeCanvasContent}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
