"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BookOpen, Clock, RefreshCw } from "lucide-react";
import { backendUrl } from "@/utils/backend";

const API_BASE = backendUrl("/api/reading");

type Question = {
  id: string;
  text: string;
  type: string;
};

type Passage = {
  id: string;
  title: string;
  text: string;
  questions: Question[];
};

type Feedback = {
  is_correct: boolean;
  feedback: string;
  retrieved_context: string;
};

export default function ReadingPage() {
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  
  // Track user answers keyed by question ID
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Track feedback keyed by question ID
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  
  // Track loading state keyed by question ID
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes in seconds

  // Fetch new passage
  const fetchNewPassage = useCallback(async () => {
    setSelectedPassage(null);
    setAnswers({});
    setFeedbacks({});
    try {
      const res = await fetch(`${API_BASE}/generate`);
      if (res.ok) {
        const data: Passage = await res.json();
        setSelectedPassage(data);
        setTimeLeft(1200); // reset timer
      }
    } catch (err) {
      console.error("Failed to generate test:", err);
    }
  }, []);

  useEffect(() => {
    fetchNewPassage();
  }, [fetchNewPassage]);

  // Timer effect
  useEffect(() => {
    if (!selectedPassage || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [selectedPassage, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckAnswer = async (question: Question) => {
    const answer = answers[question.id] || "";
    if (!answer.trim() || !selectedPassage) return;

    setLoadingStates((prev) => ({ ...prev, [question.id]: true }));

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passage_id: selectedPassage.id,
          passage_text: selectedPassage.text,
          question: question.text,
          user_answer: answer,
        }),
      });
      
      const data: Feedback = await res.json();
      setFeedbacks((prev) => ({ ...prev, [question.id]: data }));
    } catch (err) {
      console.error("Failed to check answer:", err);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [question.id]: false }));
    }
  };

  if (!selectedPassage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <span className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-text-muted animate-pulse font-medium tracking-wide">AI is writing your personalized reading test...</p>
      </div>
    );
  }

  // Split passage into paragraphs for readability
  const paragraphs = selectedPassage.text.split("\n\n");

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Background glow */}
      <div className="hero-glow absolute -right-[200px] -top-[100px] opacity-30" />

      {/* Top bar */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-md z-10 relative">
        <Link href="/" className="text-lg font-bold gradient-text">
          IELTS Prep
        </Link>
        <div className="flex items-center gap-4">
          {/* Timer element */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border">
            <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-rose-500 animate-pulse' : 'text-text-muted'}`} />
            <span className={`font-mono font-medium ${timeLeft < 300 ? 'text-rose-500' : 'text-foreground'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <span className="hidden md:inline-flex px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
            AI Generated Exam
          </span>
          <BookOpen className="w-6 h-6 text-foreground hidden sm:block" />
        </div>
      </header>

      {/* Split Screen Container */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        
        {/* Left Side: Passage */}
        <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto border-r border-border">
          <div className="glass-card max-w-2xl mx-auto p-8 lg:p-10 shadow-lg">
            <h1 className="text-3xl font-bold mb-6 text-foreground tracking-tight">
              {selectedPassage.title}
            </h1>
            <div className="space-y-5 text-text-muted leading-relaxed text-base lg:text-lg">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Questions */}
        <div className="w-full md:w-1/2 p-6 md:p-8 bg-surface/30 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Questions</h2>
              <div className="text-sm text-text-muted">
                {selectedPassage.questions.length} questions
              </div>
            </div>

            {selectedPassage.questions.map((q, idx) => {
              const feedback = feedbacks[q.id];
              const isLoading = loadingStates[q.id];

              return (
                <div key={q.id} className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group">
                  {/* Decorative number */}
                  <div className="absolute -top-4 -right-4 text-8xl font-black text-foreground/5 pointer-events-none select-none transition-transform group-hover:scale-110">
                    {idx + 1}
                  </div>

                  <p className="font-medium text-foreground relative z-10">
                    <span className="text-accent-light mr-2">{idx + 1}.</span> 
                    {q.text}
                  </p>

                  <div className="flex gap-3 relative z-10">
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCheckAnswer(q)}
                      placeholder={q.type === "tfng" ? "True / False / Not Given" : "Type your answer..."}
                      className="flex-1 bg-background/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:bg-background transition-colors"
                      disabled={isLoading}
                    />
                    <button
                      onClick={() => handleCheckAnswer(q)}
                      disabled={isLoading || !(answers[q.id]?.trim())}
                      className="px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-light transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-accent/20"
                    >
                      {isLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        "Check AI"
                      )}
                    </button>
                  </div>

                  {/* Feedback Area */}
                  {feedback && (
                    <div className={`mt-2 p-4 rounded-xl border relative z-10 animate-in fade-in slide-in-from-top-2 duration-300 ${
                      feedback.is_correct 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    }`}>
                      <div className="flex items-center gap-2 font-bold mb-1.5">
                        {feedback.is_correct ? "✅ Correct" : "❌ Incorrect"}
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {feedback.feedback.replace(/^(CORRECT|INCORRECT)\.?\s*/i, '')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dynamic Next Generator */}
            <div className="pt-6 border-t border-border flex flex-col items-center gap-4">
              <p className="text-sm text-text-muted text-center">
                Finished practicing this academic passage?
              </p>
              <button
                onClick={fetchNewPassage}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface border border-border text-foreground font-medium hover:bg-surface-hover hover:border-accent/50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
              >
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                Generate New Passage
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
