"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  Sparkles,
  Loader2,
  Paperclip,
  Mic,
  Layout,
  X,
  ArrowLeft,
  Bot,
  User,
} from "lucide-react";
import TutorRichText from "@/components/TutorRichText";

type TutorMessage = { role: "user" | "tutor"; content: string };

export default function TutorPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      role: "tutor",
      content:
        "Welcome to your AI IELTS Tutor. Ask me anything about Speaking, Writing, Reading, or Listening. I can also use live web grounding and your uploaded PDFs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCanvasContent, setActiveCanvasContent] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

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
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          session_id: sessionId,
        }),
      });

      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "tutor", content: data.response }]);
    } catch (error) {
      console.error(error);
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
    if (!file || !file.name.endsWith(".pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }

    setIsUploadingPdf(true);
    setMessages((prev) => [...prev, { role: "user", content: `(Attached ${file.name})` }]);
    setMessages((prev) => [...prev, { role: "tutor", content: "Reading your document now..." }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to process document");
      setMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: "Document indexed successfully. Ask me questions and I will ground answers on your file.",
        },
      ]);
    } catch (err) {
      console.error("PDF upload failed:", err);
      setMessages((prev) => [...prev, { role: "tutor", content: "I could not read that PDF. Please try another file." }]);
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await fetch("http://localhost:8000/api/tutor/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.text) setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
        } catch (error) {
          console.error("Transcription error:", error);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Please allow microphone access to use voice input.");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="hero-glow absolute left-1/2 -translate-x-1/2 -top-50" />
      <div className="hero-glow absolute -right-25 -bottom-75 opacity-45" />

      <header className="relative z-20 border-b border-border bg-surface/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border bg-surface text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent-light">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">AI Tutor Workspace</h1>
              <p className="text-xs text-text-muted truncate">Modern coaching with live search, OCR, mic input, and document grounding</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/" className="px-4 py-2 rounded-full bg-surface border border-border text-sm text-foreground hover:bg-surface-hover transition-colors">
              Home
            </Link>
            <Link href="/writing" className="px-4 py-2 rounded-full bg-accent/15 border border-accent/30 text-sm text-accent-light hover:bg-accent/25 transition-colors">
              Writing
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-[calc(100vh-130px)]">
          <section
            className={`glass-card overflow-hidden flex flex-col animate-slide-up-fade ${
              activeCanvasContent ? "xl:col-span-7" : "xl:col-span-12"
            }`}
          >
            <div className="px-5 py-4 border-b border-border bg-surface/60">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Professional IELTS tutoring with grounded responses
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-5 bg-surface/10">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[90%]">
                    <div className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 mt-1 rounded-full shrink-0 flex items-center justify-center ${
                        msg.role === "user" ? "bg-emerald-500/20 text-emerald-400" : "bg-accent/20 text-accent"
                      }`}
                    >
                      {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`p-4 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-accent text-white rounded-tr-sm"
                          : "bg-surface border border-border text-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "tutor" ? (
                        <TutorRichText content={msg.content} className="text-foreground" />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      )}
                    </div>
                    </div>

                    {msg.role === "tutor" && msg.content.length > 80 && (
                      <div className="mt-2 ml-11">
                        <button
                          onClick={() => setActiveCanvasContent(msg.content)}
                          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-light bg-accent/10 hover:bg-accent/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                          title="Show in Canvas"
                        >
                          <Layout className="w-3.5 h-3.5" />
                          Show in Canvas
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-text-muted text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking and grounding response...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} className="h-2 shrink-0" />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-border bg-surface/50">
              <div className="relative flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  title="Upload PDF material"
                />

                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploadingPdf || isLoading}
                  className="w-11 h-11 shrink-0 rounded-xl bg-surface border border-border flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                  title="Attach PDF Document"
                >
                  {isUploadingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isLoading || isUploadingPdf}
                  className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer ${
                    isListening
                      ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse"
                      : "bg-surface border-border hover:bg-surface-hover text-text-muted hover:text-foreground"
                  }`}
                  title="Voice Input"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask for IELTS help, upload a PDF, or use voice..."
                    disabled={isLoading}
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light disabled:opacity-50 transition-colors cursor-pointer"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-text-muted text-center mt-3 opacity-80">
                Live tutoring with real-time search grounding, PDF RAG, OCR support, and microphone input.
              </p>
            </form>
          </section>

          {activeCanvasContent && (
            <aside className="xl:col-span-5 glass-card overflow-hidden flex flex-col animate-slide-right-fade">
              <div className="h-18.25 shrink-0 border-b border-border bg-surface/60 flex items-center justify-between px-5">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                  <Layout className="w-5 h-5 text-accent" />
                  Artifact Canvas
                </h2>
                <button
                  onClick={() => setActiveCanvasContent(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-border hover:text-foreground transition-colors cursor-pointer"
                  title="Close Canvas"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="whitespace-pre-wrap text-foreground leading-relaxed text-[15px]">
                  {activeCanvasContent}
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
