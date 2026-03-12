"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

const API_BASE = "http://localhost:8000/api/reading";

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
  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedPassage, setSelectedPassage] = useState<Passage | null>(null);
  
  // Track user answers keyed by question ID
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Track feedback keyed by question ID
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  
  // Track loading state keyed by question ID
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Fetch passages on mount
  useEffect(() => {
    fetch(`${API_BASE}/passages`)
      .then((res) => res.json())
      .then((data: Passage[]) => {
        setPassages(data);
        if (data.length > 0) setSelectedPassage(data[0]);
      });
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
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
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
            RAG Powered
          </span>
          <BookOpen className="w-6 h-6 text-foreground" />
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
          </div>
        </div>

      </main>
    </div>
  );
}
