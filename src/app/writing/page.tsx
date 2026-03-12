"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PenTool, Upload, Loader2, Clock } from "lucide-react";

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

      <main className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-6 gap-6">
        {/* Left column: Left Prompt / Output feedback */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg text-foreground">The Prompt</h2>
              <button
                onClick={() => {
                  const list = taskType === 1 ? prompts.task1 : prompts.task2;
                  const currentIndex = list.findIndex((p) => p.id === selectedPrompt?.id);
                  const nextIndex = (currentIndex + 1) % list.length;
                  setSelectedPrompt(list[nextIndex]);
                }}
                className="text-xs font-medium text-accent hover:text-accent-light bg-accent/10 hover:bg-accent/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                Change Prompt
              </button>
            </div>
            <p className="text-text-muted leading-relaxed text-sm">
              {selectedPrompt ? selectedPrompt.text : "Loading..."}
            </p>
            {selectedPrompt?.image_url && (
              <div className="mt-4 rounded-xl overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={selectedPrompt.image_url} 
                  alt="Task 1 Chart" 
                  className="w-full h-auto object-contain bg-white"
                />
              </div>
            )}
          </div>

          {!feedback && (
            <div className="flex-1 glass-card p-6 flex flex-col items-center justify-center text-center text-text-muted border-dashed border-2">
              <span className="text-4xl mb-4 opacity-50">🤖</span>
              <p>Your AI examiner feedback will appear here once you submit your essay.</p>
            </div>
          )}

          {feedback && (
            <div className="flex-1 glass-card p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
              <div>
                <h2 className="font-bold text-xl mb-4 gradient-text">Band Score: {feedback.overall_score.toFixed(1)}</h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="block text-text-muted mb-1 text-xs uppercase tracking-wider">Task Resp.</span>
                    <span className="font-semibold text-lg">{feedback.task_response_score.toFixed(1)}</span>
                  </div>
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="block text-text-muted mb-1 text-xs uppercase tracking-wider">Coherence</span>
                    <span className="font-semibold text-lg">{feedback.coherence_score.toFixed(1)}</span>
                  </div>
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="block text-text-muted mb-1 text-xs uppercase tracking-wider">Lexical</span>
                    <span className="font-semibold text-lg">{feedback.lexical_score.toFixed(1)}</span>
                  </div>
                  <div className="bg-surface p-3 rounded-xl border border-border text-center">
                    <span className="block text-text-muted mb-1 text-xs uppercase tracking-wider">Grammar</span>
                    <span className="font-semibold text-lg">{feedback.grammar_score.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-emerald-400 mb-2">Strengths</h3>
                <ul className="list-disc pl-5 text-sm text-text-muted space-y-1">
                  {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-rose-400 mb-2">Areas for Improvement</h3>
                <ul className="list-disc pl-5 text-sm text-text-muted space-y-1">
                  {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-accent-light mb-2">Band 8+ Rewrite Example</h3>
                <div className="bg-surface-hover p-4 rounded-xl text-sm text-foreground italic border-l-4 border-accent">
                  {feedback.improved_version}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Editor */}
        <div className="w-full lg:w-2/3 flex flex-col gap-4">
          <div className="flex justify-between items-center px-2">
            <div className={`text-sm font-medium ${
              (taskType === 1 && wordCount < 150) || (taskType === 2 && wordCount < 250)
                ? "text-amber-400"
                : "text-emerald-400"
            }`}>
              Words: {wordCount} / {taskType === 1 ? "150" : "250"} minimum
            </div>
          </div>

          <textarea
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            disabled={isSubmitting}
            placeholder="Start writing your essay here..."
            className="flex-1 w-full glass-card p-6 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-foreground text-base leading-relaxed"
          />

          <div className="flex justify-between items-center pt-2">
            <div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                title="Upload handwritten essay image"
                aria-label="Upload handwritten essay image"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload image for OCR"
                aria-label="Upload image for OCR"
                className="px-6 py-3 rounded-full bg-surface border border-border text-foreground font-semibold hover:bg-surface-hover transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-text-muted" /> : <Upload className="w-5 h-5 text-text-muted" />}
                <span className="text-sm">Upload Handwritten Essay (OCR)</span>
              </button>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || wordCount === 0}
              className="px-8 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-light shadow-lg shadow-accent/25 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Grading Essay...
                </>
              ) : (
                "Submit for AI Grading"
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
