"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Mic, Clock } from "lucide-react";

const API_BASE = "http://localhost:8000/api/speaking";

type Message = {
  role: "examiner" | "candidate";
  content: string;
};

type TestState = "idle" | "testing" | "complete";

export default function SpeakingPage() {
  const [testState, setTestState] = useState<TestState>("idle");
  const [sessionId, setSessionId] = useState("");
  const [currentPart, setCurrentPart] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("british_female");
  const [textInput, setTextInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(840); // 14 mins
  const [isAutoMode, setIsAutoMode] = useState(true); // Default to auto-mode

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Silence Detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (testState !== "testing" || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [testState, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Play examiner audio
  const playAudio = useCallback((audioUrl: string) => {
    if (!audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`http://localhost:8000${audioUrl}`);
    audioRef.current = audio;
    
    audio.onended = () => {
      if (isAutoMode && testState === "testing") {
        startRecording();
      }
    };

    audio.play().catch(() => {});
  }, [isAutoMode, testState]);

  // Start the test
  const startTest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `voice=${selectedVoice}`,
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setCurrentPart(data.part);
      setMessages([{ role: "examiner", content: data.examiner_text }]);
      setTestState("testing");
      playAudio(data.audio_url);
    } catch (err) {
      console.error("Failed to start test:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Send text response
  const sendTextResponse = async () => {
    if (!textInput.trim() || isLoading) return;
    const candidateText = textInput.trim();
    setTextInput("");
    setMessages((prev) => [...prev, { role: "candidate", content: candidateText }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, candidate_text: candidateText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "examiner", content: data.examiner_text }]);
      setCurrentPart(data.part);
      playAudio(data.audio_url);

      if (data.is_complete) {
        setTestState("complete");
      }
    } catch (err) {
      console.error("Failed to send response:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // -- Silence Detection Setup --
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.minDecibels = -60;
      analyser.smoothingTimeConstant = 0.2;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      isSpeakingRef.current = false;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const detectSilence = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Volume threshold
        if (average > 15) {
          isSpeakingRef.current = true;
          // Clear silence timer because they are talking
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // If they were speaking and are now quiet, start a countdown of 2 seconds
          if (isSpeakingRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
              }
            }, 1800); // Wait 1.8 seconds of silence before auto-sending
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(detectSilence);
      };
      
      detectSilence();
      // ----------------------------

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Cleanup detection
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (audioContextRef.current?.state !== "closed") {
          audioContextRef.current?.close();
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await sendAudioResponse(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  // Stop recording manually
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send audio response
  const sendAudioResponse = async (blob: Blob) => {
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "candidate", content: "(voice response — transcribing...)" }]);

    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("audio", blob, "recording.webm");

      const res = await fetch(`${API_BASE}/respond-audio`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      // Replace placeholder with actual transcription from examiner response context
      setMessages((prev) => {
        const updated = [...prev];
        const lastCandidate = updated.findLastIndex((m) => m.role === "candidate");
        if (lastCandidate >= 0 && updated[lastCandidate].content.includes("transcribing")) {
          updated[lastCandidate] = { role: "candidate", content: "(voice response)" };
        }
        return [...updated, { role: "examiner", content: data.examiner_text }];
      });

      setCurrentPart(data.part);
      playAudio(data.audio_url);

      if (data.is_complete) {
        setTestState("complete");
      }
    } catch (err) {
      console.error("Failed to send audio:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get feedback
  const getFeedback = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setFeedback(data.feedback);
      setShowFeedback(true);
    } catch (err) {
      console.error("Failed to get feedback:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset
  const resetTest = () => {
    setTestState("idle");
    setSessionId("");
    setMessages([]);
    setCurrentPart(1);
    setFeedback("");
    setShowFeedback(false);
    setTimeLeft(840);
  };

  const partLabels: Record<number, string> = {
    1: "Part 1 — Introduction & Interview",
    2: "Part 2 — Long Turn (Cue Card)",
    3: "Part 3 — Discussion",
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
        <Link href="/" className="text-lg font-bold gradient-text">
          IELTS Prep
        </Link>
        <div className="flex items-center gap-4">
          {testState === "testing" && (
            <>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background border border-border">
                <Clock className={`w-4 h-4 ${timeLeft < 180 ? 'text-rose-500 animate-pulse' : 'text-text-muted'}`} />
                <span className={`font-mono font-medium ${timeLeft < 180 ? 'text-rose-500' : 'text-foreground'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20">
                {partLabels[currentPart]}
              </span>
            </>
          )}
          <Mic className="w-6 h-6 text-foreground hidden sm:block" />
        </div>
      </header>

      {/* IDLE — Start screen */}
      {testState === "idle" && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="glass-card p-10 max-w-lg w-full text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-3xl bg-accent/10 border border-accent/20">
                <Mic className="w-12 h-12 text-accent" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">IELTS Speaking Test</h1>
            <p className="text-text-muted leading-relaxed">
              Practice all three parts of the IELTS Speaking test with an AI examiner.
              Choose your preferred examiner accent and begin.
            </p>

            {/* Voice selector */}
            <div className="space-y-2">
              <label className="text-sm text-text-muted font-medium">Examiner Voice</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "british_female", label: "🇬🇧 British (F)" },
                  { key: "british_male", label: "🇬🇧 British (M)" },
                  { key: "american_female", label: "🇺🇸 American (F)" },
                  { key: "american_male", label: "🇺🇸 American (M)" },
                  { key: "australian_female", label: "🇦🇺 Australian (F)" },
                  { key: "australian_male", label: "🇦🇺 Australian (M)" },
                ].map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setSelectedVoice(v.key)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      selectedVoice === v.key
                        ? "bg-accent text-white shadow-lg shadow-accent/25"
                        : "bg-surface-hover text-text-muted hover:text-foreground border border-border"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startTest}
              disabled={isLoading}
              className="w-full px-8 py-3.5 rounded-full bg-accent text-white font-semibold text-base hover:bg-accent-light transition-all duration-300 shadow-lg shadow-accent/25 hover:shadow-accent/40 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? "Starting..." : "Begin Speaking Test"}
            </button>
          </div>
        </main>
      )}

      {/* TESTING — Conversation */}
      {testState !== "idle" && (
        <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "examiner"
                      ? "bg-surface border border-border text-foreground rounded-bl-md"
                      : "bg-accent/90 text-white rounded-br-md"
                  }`}
                >
                  {msg.role === "examiner" && (
                    <span className="text-xs text-indigo-400 font-semibold block mb-1">Examiner</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface border border-border px-5 py-3.5 rounded-2xl rounded-bl-md">
                  <span className="text-xs text-indigo-400 font-semibold block mb-1">Examiner</span>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          {testState === "testing" && (
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div 
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${isAutoMode ? 'bg-accent' : 'bg-surface-hover border border-border'}`}
                    onClick={() => setIsAutoMode(!isAutoMode)}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isAutoMode ? 'translate-x-5' : 'translate-x-0 bg-text-muted'}`} />
                  </div>
                  <span className="text-xs font-medium text-text-muted group-hover:text-foreground transition-colors">Continuous Conversation Mode</span>
                </label>
                {isRecording && <span className="text-[10px] uppercase tracking-wider text-rose-500 font-bold animate-pulse flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> System Listening...</span>}
              </div>

              <div className="flex items-center gap-3">
                {/* Record button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                      : "bg-surface-hover text-text-muted hover:text-foreground border border-border hover:border-accent/30"
                  }`}
                  title={isRecording ? "Stop recording" : "Hold to record"}
                >
                  {isRecording ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </button>

                {/* Text input */}
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendTextResponse()}
                  placeholder={isAutoMode ? "System will auto-send when you stop speaking..." : "Type your answer or use the microphone..."}
                  disabled={isLoading || isRecording}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
                />

                {/* Send button */}
                <button
                  onClick={sendTextResponse}
                  disabled={isLoading || !textInput.trim()}
                  title="Send message"
                  className="shrink-0 w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-all disabled:opacity-30 cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-text-muted mt-2 text-center flex items-center justify-center gap-2">
                {isRecording ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording... Stop speaking for 1.8 seconds to auto-send, or click to send now</> : isAutoMode ? "System will automatically start listening after examiner finishes." : "Press the mic to record or type your answer"}
              </p>
          )}

          {/* Complete — Feedback area */}
          {testState === "complete" && (
            <div className="px-6 py-6 border-t border-border bg-surface/50 space-y-4">
              {!showFeedback ? (
                <div className="text-center space-y-4">
                  <p className="text-lg font-semibold">🎉 Speaking test complete!</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={getFeedback}
                      disabled={isLoading}
                      className="px-6 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-light transition-all shadow-lg shadow-accent/25 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? "Generating Feedback..." : "Get My IELTS Feedback"}
                    </button>
                    <button
                      onClick={resetTest}
                      className="px-6 py-3 rounded-full bg-surface border border-border text-foreground font-medium hover:bg-surface-hover transition-all cursor-pointer"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold gradient-text">Your IELTS Speaking Feedback</h2>
                  <div className="bg-background rounded-2xl border border-border p-6 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {feedback}
                  </div>
                  <button
                    onClick={resetTest}
                    className="px-6 py-3 rounded-full bg-surface border border-border text-foreground font-medium hover:bg-surface-hover transition-all cursor-pointer"
                  >
                    Take Another Test
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
