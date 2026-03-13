"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Headphones, SkipBack, Play, Pause, Clock } from "lucide-react";

const API_BASE = "http://localhost:8000/api/listening";

type Question = {
  id: string;
  text: string;
  type: string;
  options: string[] | null;
  correct_answer: string;
};

type DialogueLine = {
  id: string;
  speaker: string;
  text: string;
  audio_url: string;
};

type TestData = {
  title: string;
  dialogue: DialogueLine[];
  questions: Question[];
};

const LISTENING_TOPICS = [
  "A customer discussing a damaged parcel at a courier office",
  "Two university students planning a climate awareness event",
  "A tenant calling a landlord about apartment maintenance",
  "A traveler changing a train booking due to delays",
  "A parent enrolling a child in a weekend art club",
  "Two colleagues arranging a professional training workshop",
  "A student asking about volunteering opportunities at a museum",
  "A visitor inquiring about a guided nature park tour",
  "A candidate discussing interview logistics with HR",
  "A customer comparing internet packages with a service agent",
];

export default function ListeningPage() {
  const [testData, setTestData] = useState<TestData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Audio playback state
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState(2400); // 40 minutes

  // User answers
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const generateTest = async () => {
    setIsGenerating(true);
    setTestData(null);
    setCurrentLineIndex(-1);
    setIsPlaying(false);
    setShowResults(false);
    setAnswers({});
    
    try {
      const topic = LISTENING_TOPICS[Math.floor(Math.random() * LISTENING_TOPICS.length)];
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          seed: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const data = await res.json();
      setTestData(data);
      setTimeLeft(2400);
    } catch (err) {
      console.error("Failed to generate test:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!testData || showResults || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [testData, showResults, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const playAudioTimeline = (startIndex: number) => {
    if (!testData || startIndex >= testData.dialogue.length) {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
      return;
    }
    
    setIsPlaying(true);
    setCurrentLineIndex(startIndex);
    
    const line = testData.dialogue[startIndex];
    if (audioRef.current) {
      // audio_url from backend looks like "/api/core/audio/<filename>"
      // which matches our AUDIO_BASE if we construct it properly or just use the full hostname
      const fullUrl = `http://localhost:8000${line.audio_url}`;
      audioRef.current.src = fullUrl;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => console.error("Audio playback error:", error));
      }
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const resumeAudio = () => {
    if (currentLineIndex === -1) {
      playAudioTimeline(0);
    } else {
      if (audioRef.current) {
        audioRef.current.play();
      }
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    // Play next line automatically
    if (testData && currentLineIndex < testData.dialogue.length - 1) {
      playAudioTimeline(currentLineIndex + 1);
    } else {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const calculateScore = () => {
    if (!testData) return 0;
    let correct = 0;
    testData.questions.forEach((q) => {
      if (answers[q.id]?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()) {
        correct++;
      }
    });
    return correct;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-accent/5 backdrop-blur-3xl -z-10" />
      <div className="hero-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 -z-10" />

      {/* Top bar */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-md z-10">
        <Link href="/" className="text-lg font-bold gradient-text">
          IELTS Prep
        </Link>
        <div className="flex items-center gap-4">
          
          {/* Universal Exam Timer */}
          {testData && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background border border-border">
              <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-rose-500 animate-pulse' : 'text-text-muted'}`} />
              <span className={`font-mono font-medium ${timeLeft < 300 ? 'text-rose-500' : 'text-foreground'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}

          <span className="hidden md:inline-flex px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-medium border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            Generative Audio
          </span>
          <Headphones className="w-6 h-6 text-foreground hidden sm:block" />
        </div>
      </header>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        className="hidden" 
      />

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-6 md:p-8 gap-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              Listening Practice
            </h1>
            <p className="text-text-muted text-sm">
              AI will generate a unique scenario, synthesize multiple voices, and create comprehension questions.
            </p>
          </div>
          <button
            onClick={generateTest}
            disabled={isGenerating}
            className="whitespace-nowrap px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-light shadow-lg shadow-accent/25 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Prompt...
              </>
            ) : (
              "Generate New Test"
            )}
          </button>
        </div>

        {testData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Left: Audio Player & Setup */}
            <div className="space-y-6">
              <div className="glass-card p-8 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-accent/10 border-4 border-accent/20 flex items-center justify-center mb-6 relative text-accent">
                  <Headphones className="w-10 h-10" />
                  {isPlaying && (
                    <div className="absolute inset-0 rounded-full border-2 border-accent animate-ping" />
                  )}
                </div>
                
                <h2 className="text-xl font-bold text-foreground mb-2">{testData.title}</h2>
                <p className="text-sm text-text-muted mb-8">
                  Click play to listen to the scenario. Do not read the transcript below until you finish answering!
                </p>

                <div className="flex items-center gap-4 w-full justify-center">
                  <button
                    onClick={() => playAudioTimeline(0)}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-surface hover:bg-surface-hover border border-border transition-colors group cursor-pointer" title="Restart audio" aria-label="Restart audio"
                  >
                    <SkipBack className="w-5 h-5 text-foreground group-hover:text-accent transition-colors" />
                  </button>
                  
                  {isPlaying ? (
                    <button
                      onClick={pauseAudio}
                      className="w-16 h-16 rounded-full bg-accent hover:bg-accent-light text-white shadow-lg shadow-accent/30 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                      title="Pause audio"
                      aria-label="Pause audio"
                    >
                      <Pause className="w-8 h-8" />
                    </button>
                   ) : (
                    <button
                      onClick={resumeAudio}
                      className="w-16 h-16 rounded-full bg-accent hover:bg-accent-light text-white shadow-lg shadow-accent/30 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                      title="Play audio"
                      aria-label="Play audio"
                    >
                      <Play className="w-8 h-8 ml-1" />
                    </button>
                   )}
                </div>

                {/* Live Transcript (Optional/Hidden initially) */}
                <div className="w-full mt-8 text-left border-t border-border pt-6">
                  <details className="text-sm">
                    <summary className="text-text-muted cursor-pointer hover:text-foreground transition-colors font-medium select-none">
                      Show Transcript (Cheating!)
                    </summary>
                    <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {testData.dialogue.map((line, idx) => (
                        <div 
                          key={line.id} 
                          className={`p-3 rounded-lg transition-colors duration-300 ${
                            currentLineIndex === idx ? "bg-accent/10 border-accent/30 border" : "bg-surface-hover"
                          }`}
                        >
                          <span className="font-bold text-accent-light text-xs uppercase tracking-wider block mb-1">
                            {line.speaker}
                          </span>
                          <span className={`${currentLineIndex === idx ? "text-foreground" : "text-text-muted"}`}>
                            {line.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* Right: Questions Area */}
            <div className="space-y-6">
              <div className="glass-card p-6 md:p-8">
                <div className="flex justify-between items-end mb-6 border-b border-border pb-4">
                  <h2 className="text-2xl font-bold">Questions</h2>
                  {showResults && (
                    <div className="text-lg font-bold text-emerald-400">
                      Score: {calculateScore()} / {testData.questions.length}
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                  {testData.questions.map((q, idx) => {
                    const userAnswer = answers[q.id] || "";
                    const isCorrect = userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();

                    return (
                      <div key={q.id} className="space-y-3">
                        <p className="font-medium text-foreground">
                          <span className="text-accent-light mr-2 select-none">{idx + 1}.</span> 
                          {q.text}
                        </p>
                        
                        {q.type === "mcq" && q.options ? (
                          <div className="space-y-2">
                            {q.options.map((opt, i) => (
                              <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors has-checked:border-accent has-checked:bg-accent/5">
                                <input
                                  type="radio"
                                  name={`question_${q.id}`}
                                  value={opt}
                                  checked={userAnswer === opt}
                                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                  disabled={showResults}
                                  className="accent-accent w-4 h-4 cursor-pointer"
                                />
                                <span className="text-sm text-foreground/90">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            disabled={showResults}
                            placeholder="Type exactly 1-3 words..."
                            className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:bg-background transition-colors"
                          />
                        )}

                        {/* Grading UI */}
                        {showResults && (
                          <div className={`mt-2 p-3 rounded-lg text-sm font-medium ${isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isCorrect ? (
                              "✅ Correct"
                            ) : (
                              <>
                                ❌ Incorrect. The correct answer is: <span className="font-bold underline underline-offset-2">{q.correct_answer}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!showResults ? (
                  <button
                    onClick={() => setShowResults(true)}
                    disabled={Object.keys(answers).length !== testData.questions.length || isPlaying}
                    className="w-full mt-8 py-3 rounded-xl bg-accent text-white font-bold hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-accent/20"
                  >
                    Submit Answers
                  </button>
                ) : (
                  <button
                    onClick={generateTest}
                    className="w-full mt-8 py-3 rounded-xl bg-surface hover:bg-surface-hover border border-border text-foreground font-bold transition-colors cursor-pointer"
                  >
                    Try Another Scenario
                  </button>
                )}

              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
