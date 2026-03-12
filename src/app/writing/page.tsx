"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PenTool, Upload, Loader2, Clock, Send, Sparkles, User, Bot, Paperclip } from "lucide-react";

const API_BASE = "http://localhost:8000/api/writing";

type Prompt = {
  id: string;
  text: string;
  image_url?: string;
};

type Feedback = {
  task_response_score: number;
  coherence_score: number;
  lexical_score: number;
  grammar_score: number;
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  improved_version: string;
};

type ChatMessage = {
  role: "user" | "tutor";
  content: string;
};

export default function WritingPage() {
  const [taskType, setTaskType] = useState<1 | 2>(2);
  const [prompts, setPrompts] = useState<{ task1: Prompt[]; task2: Prompt[] }>({ task1: [], task2: [] });
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [essayText, setEssayText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(40 * 60); // 40 mins for Task 2
  const [timerActive, setTimerActive] = useState(false);

  // Tutor Canvas State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "tutor", content: "Hi! I'm your Omni-Tutor. Start writing your essay on the right, and ask me any questions here. I can read what you're typing live!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll tutor chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Fetch prompts on mount
  useEffect(() => {
    fetch(`${API_BASE}/prompts`)
      .then((res) => res.json())
      .then((data) => {
        setPrompts(data);
        setSelectedPrompt(data.task2[0]);
      });
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleTaskSwitch = (type: 1 | 2) => {
    setTaskType(type);
    setSelectedPrompt(type === 1 ? prompts.task1[0] : prompts.task2[0]);
    setTimeLeft(type === 1 ? 20 * 60 : 40 * 60);
    setTimerActive(true);
    setEssayText("");
    setFeedback(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const wordCount = essayText.trim().split(/\s+/).filter((w) => w.length > 0).length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(",")[1];
        
        const res = await fetch(`${API_BASE}/upload_image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64String }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setEssayText((prev) => prev ? prev + "\n\n" + data.extracted_text : data.extracted_text);
        }
      };
    } catch (err) {
      console.error("OCR Failed:", err);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!essayText.trim() || !selectedPrompt) return;
    setIsSubmitting(true);
    setTimerActive(false);

    try {
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: taskType,
          prompt_text: selectedPrompt.text,
          essay_text: essayText,
        }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error("Failed to evaluate essay:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.pdf')) {
      alert("Please select a valid PDF file.");
      return;
    }

    setIsUploadingPdf(true);
    setChatMessages((prev) => [...prev, { role: "user", content: `(📎 Attached ${file.name})` }]);
    setChatMessages((prev) => [...prev, { role: "tutor", content: "I'm reading your document now. Please wait..." }]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setChatMessages((prev) => [...prev, { role: "tutor", content: "I've successfully read and memorized your document! What would you like to know about it?" }]);
      } else {
        throw new Error("Failed to process document");
      }
    } catch (err) {
      console.error("PDF upload failed:", err);
      setChatMessages((prev) => [...prev, { role: "tutor", content: "Sorry, I had trouble reading that document. Please try again." }]);
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleTutorChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          essay_context: essayText.trim() ? essayText : null
        })
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "tutor", content: data.response }]);
    } catch (err) {
      console.error("Failed to query tutor:", err);
      setChatMessages((prev) => [...prev, { role: "tutor", content: "Sorry, I encountered an error connecting to my servers." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
        <Link href="/" className="text-lg font-bold gradient-text">
          IELTS Prep
        </Link>
        <div className="flex items-center gap-4">
          
          {/* Universal Exam Timer */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background border border-border group relative">
            <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-rose-500 animate-pulse' : 'text-text-muted'}`} />
            <span className={`font-mono font-medium ${timeLeft < 300 ? 'text-rose-500' : 'text-foreground'}`}>
               {formatTime(timeLeft)}
            </span>
            <button 
              onClick={() => setTimerActive(!timerActive)} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title={timerActive ? "Pause Timer" : "Start Timer"}
            />
          </div>

          {/* Task selector */}
          <div className="hidden sm:flex bg-surface-hover rounded-full p-1 border border-border">
            <button
              onClick={() => handleTaskSwitch(1)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                taskType === 1 ? "bg-accent text-white shadow" : "text-text-muted hover:text-foreground"
              }`}
            >
              Task 1
            </button>
            <button
              onClick={() => handleTaskSwitch(2)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                taskType === 2 ? "bg-accent text-white shadow" : "text-text-muted hover:text-foreground"
              }`}
            >
              Task 2
            </button>
          </div>
          <PenTool className="w-6 h-6 text-foreground hidden md:block" />
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row w-full h-[calc(100vh-73px)] overflow-hidden gap-1 p-1 bg-surface-hover">
        
        {/* Left column: Omni-Tutor Canvas Chat */}
        <div className="w-full lg:w-1/3 flex flex-col bg-background rounded-l-2xl border border-border/50 shadow-inner overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border bg-surface/50">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-foreground">Omni-Tutor Canvas</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "tutor" && (
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 border border-accent/30">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-surface border border-border text-foreground rounded-br-sm" 
                    : "bg-surface-hover border border-border/50 text-foreground rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-text-muted" />
                  </div>
                )}
              </div>
            ))}
            {isChatLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 border border-accent/30">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
                <div className="bg-surface-hover border border-border/50 rounded-2xl rounded-bl-sm p-4 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent/50 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-accent/50 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-accent/50 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleTutorChat} className="p-4 border-t border-border bg-surface/50">
            <div className="relative flex items-center gap-2">
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={pdfInputRef} 
                onChange={handlePdfUpload} 
                title="Upload PDF rulebook or material"
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf || isChatLoading}
                className="w-10 h-10 shrink-0 rounded-xl bg-surface border border-border flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                title="Attach PDF Document"
              >
                {isUploadingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              
              <div className="relative flex-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for feedback on your draft..."
                  disabled={isChatLoading}
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light disabled:opacity-50 transition-colors cursor-pointer"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2 opacity-70">
              Tutor automatically reads your essay editor text when you message. Attach PDFs for specific rules.
            </p>
          </form>
        </div>

        {/* Right column: Prompt & Context Window */}
        <div className="w-full lg:w-2/3 flex flex-col bg-background rounded-r-2xl border border-border/50 overflow-hidden relative">
          
          {/* Top Panel: The Prompt Overview */}
          <div className="flex-none p-5 border-b border-border/50 bg-surface/30">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <PenTool className="w-4 h-4 text-text-muted" />
                Exam Prompt
              </h2>
              <button
                onClick={() => {
                  const list = taskType === 1 ? prompts.task1 : prompts.task2;
                  const currentIndex = list.findIndex((p) => p.id === selectedPrompt?.id);
                  const nextIndex = (currentIndex + 1) % list.length;
                  setSelectedPrompt(list[nextIndex]);
                }}
                className="text-xs font-medium text-accent hover:text-accent-light bg-accent/10 hover:bg-accent/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                title="Cycle through available exam prompts"
              >
                Cycle Prompt
              </button>
            </div>
            <div className="flex gap-6 max-h-[25vh] overflow-y-auto custom-scrollbar">
              <p className="text-text-muted leading-relaxed text-sm flex-1">
                {selectedPrompt ? selectedPrompt.text : "Loading..."}
              </p>
              {selectedPrompt?.image_url && (
                <div className="w-1/3 shrink-0 rounded-xl overflow-hidden border border-border shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={selectedPrompt.image_url} 
                    alt="Task Visual" 
                    className="w-full h-full object-contain bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Main Panel: The Editor OR Feedback */}
          {!feedback ? (
            <div className="flex-1 flex flex-col p-5 group relative">
              <div className="flex justify-between items-center mb-3 text-xs w-full">
                <span className="font-medium text-text-muted/70 uppercase tracking-widest">Essay Editor</span>
                <span className={`font-medium ${
                  (taskType === 1 && wordCount < 150) || (taskType === 2 && wordCount < 250)
                    ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {wordCount} / {taskType === 1 ? "150" : "250"} words
                </span>
              </div>
              
              <textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                disabled={isSubmitting}
                placeholder="Start typing your essay here. The Omni-Tutor on the left watches what you write and is ready to help..."
                title="Your Essay Editor"
                className="flex-1 w-full bg-transparent resize-none focus:outline-none text-foreground text-base leading-relaxed custom-scrollbar placeholder:text-text-muted/30"
              />

              {/* Editor Bottom HUD Controls */}
              <div className="flex justify-between items-center mt-4 border-t border-border/50 pt-4">
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    title="Upload handwritten essay image"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Upload handwritten essay for OCR extraction"
                    className="px-4 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-border text-text-muted hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Upload className="w-4 h-4" />}
                    <span>Extract Handwriting</span>
                  </button>
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || wordCount === 0}
                  className="px-6 py-2.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-light shadow-md shadow-accent/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Grading...
                    </>
                  ) : (
                    "Submit for Grading"
                  )}
                </button>
              </div>
            </div>
          ) : (
             <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-surface/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-2xl gradient-text">Results: Band {feedback.overall_score.toFixed(1)}</h2>
                <button onClick={() => setFeedback(null)} className="text-sm font-medium text-text-muted hover:text-foreground cursor-pointer underline underline-offset-4">
                  Return to Editor
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-8">
                <div className="bg-background p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center">
                  <span className="text-text-muted mb-1 text-[10px] uppercase font-bold tracking-widest text-center">Task Response</span>
                  <span className="font-bold text-2xl text-foreground">{feedback.task_response_score.toFixed(1)}</span>
                </div>
                <div className="bg-background p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center">
                  <span className="text-text-muted mb-1 text-[10px] uppercase font-bold tracking-widest text-center">Coherence</span>
                  <span className="font-bold text-2xl text-foreground">{feedback.coherence_score.toFixed(1)}</span>
                </div>
                <div className="bg-background p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center">
                  <span className="text-text-muted mb-1 text-[10px] uppercase font-bold tracking-widest text-center">Lexical Resource</span>
                  <span className="font-bold text-2xl text-foreground">{feedback.lexical_score.toFixed(1)}</span>
                </div>
                <div className="bg-background p-4 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center">
                  <span className="text-text-muted mb-1 text-[10px] uppercase font-bold tracking-widest text-center">Grammar</span>
                  <span className="font-bold text-2xl text-foreground">{feedback.grammar_score.toFixed(1)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5">
                  <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2"><span className="text-lg">✓</span> Strengths</h3>
                  <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => <li key={i} className="text-sm text-foreground/80 leading-relaxed">• {s}</li>)}
                  </ul>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5">
                  <h3 className="font-bold text-rose-400 mb-3 flex items-center gap-2"><span className="text-lg">×</span> Weaknesses</h3>
                  <ul className="space-y-2">
                    {feedback.weaknesses.map((w, i) => <li key={i} className="text-sm text-foreground/80 leading-relaxed">• {w}</li>)}
                  </ul>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                <h3 className="font-bold text-foreground mb-4">Masterclass Rewrite (Band 8+)</h3>
                <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                  {feedback.improved_version}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
