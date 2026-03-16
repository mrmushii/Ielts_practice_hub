"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Mic, Clock } from "lucide-react";
import { backendUrl } from "@/utils/backend";

const API_BASE = backendUrl("/api/speaking");

type Message = {
  role: "examiner" | "candidate";
  content: string;
  audioUrl?: string;
};

type TestState = "idle" | "testing" | "complete";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

export default function SpeakingPage() {
  const [testState, setTestState] = useState<TestState>("idle");
  const [sessionId, setSessionId] = useState("");
  const [currentPart, setCurrentPart] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState(false);
  const [isSystemListening, setIsSystemListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("british_female");
  const [textInput, setTextInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(840); // 14 mins

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const localRecordingUrlsRef = useRef<string[]>([]);

  // Silence Detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasDetectedSpeechRef = useRef(false);
  const startRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const autoStartedFromTutorRef = useRef(false);

  const cleanupAudioResources = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

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
    const audio = new Audio(backendUrl(audioUrl));
    audioRef.current = audio;
    setIsExaminerSpeaking(true);
    
    audio.onended = () => {
      setIsExaminerSpeaking(false);
    };

    audio.onerror = () => {
      setIsExaminerSpeaking(false);
    };

    audio.play().catch(() => {
      setIsExaminerSpeaking(false);
    });
  }, []);

  // Start the test
  const startTest = async () => {
    setCallStatus(CallStatus.CONNECTING);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          voice: selectedVoice,
        }).toString(),
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setCurrentPart(data.part);
      setMessages([{ role: "examiner", content: data.examiner_text }]);
      setTestState("testing");
      setCallStatus(CallStatus.ACTIVE);
      playAudio(data.audio_url);
    } catch (err) {
      setCallStatus(CallStatus.INACTIVE);
      console.error("Failed to start test:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const shouldAutoStart =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tutor_start") === "1";
    if (!shouldAutoStart || autoStartedFromTutorRef.current) return;
    if (testState !== "idle" || isLoading) return;

    autoStartedFromTutorRef.current = true;
    void startTest();
  }, [testState, isLoading]);

  // Send text response
  const sendTextResponse = useCallback(async () => {
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
        setCallStatus(CallStatus.FINISHED);
      }
    } catch (err) {
      console.error("Failed to send response:", err);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, isLoading, sessionId, playAudio]);

  // Send audio response
  const sendAudioResponse = useCallback(async (blob: Blob) => {
    if (blob.size < 1500) {
      return;
    }

    setIsLoading(true);
    const localAudioUrl = URL.createObjectURL(blob);
    localRecordingUrlsRef.current.push(localAudioUrl);
    setMessages((prev) => [
      ...prev,
      {
        role: "candidate",
        content: "(voice response — transcribing...)",
        audioUrl: localAudioUrl,
      },
    ]);

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
          const transcriptText = data.candidate_text?.trim();
          updated[lastCandidate] = {
            ...updated[lastCandidate],
            content: transcriptText && transcriptText.length > 0 ? transcriptText : "(voice response)",
          };
        }
        return [...updated, { role: "examiner", content: data.examiner_text }];
      });

      setCurrentPart(data.part);
      playAudio(data.audio_url);

      if (data.is_complete) {
        setTestState("complete");
        setCallStatus(CallStatus.FINISHED);
      }
    } catch (err) {
      console.error("Failed to send audio:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, playAudio]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    if (isRecording || isLoading || testState !== "testing") {
      return;
    }

    try {
      cleanupAudioResources();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      // -- Silence Detection Setup --
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.35;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      hasDetectedSpeechRef.current = false;
      const dataArray = new Uint8Array(analyser.fftSize);
      const SILENCE_RMS_THRESHOLD = 0.018;
      
      const detectSilence = () => {
        if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          return;
        }

        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        
        if (rms > SILENCE_RMS_THRESHOLD) {
          hasDetectedSpeechRef.current = true;
          // Clear silence timer because they are talking
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // In manual mode, keep recording until user explicitly stops.
          if (hasDetectedSpeechRef.current && silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
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
        cleanupAudioResources();

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendAudioResponse(blob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsSystemListening(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [isRecording, isLoading, testState, sendAudioResponse, cleanupAudioResources]);

  // Assign to ref for circular dependency handling
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  // Stop recording manually
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsSystemListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudioResources();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      localRecordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localRecordingUrlsRef.current = [];
    };
  }, [cleanupAudioResources]);

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
    cleanupAudioResources();
    localRecordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localRecordingUrlsRef.current = [];
    setIsExaminerSpeaking(false);
    setIsSystemListening(false);
    setCallStatus(CallStatus.INACTIVE);
    setTestState("idle");
    setSessionId("");
    setMessages([]);
    setCurrentPart(1);
    setFeedback("");
    setShowFeedback(false);
    setTimeLeft(840);
  };

  const endConversation = () => {
    cleanupAudioResources();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsRecording(false);
    setIsExaminerSpeaking(false);
    setIsSystemListening(false);
    setCallStatus(CallStatus.FINISHED);
    setTestState("complete");
  };

  const statusText =
    callStatus === CallStatus.CONNECTING
      ? "Calling"
      : isExaminerSpeaking
      ? "Replying"
      : isSystemListening
      ? "Listening"
      : callStatus === CallStatus.ACTIVE
      ? "Active"
      : callStatus === CallStatus.FINISHED
      ? "Finished"
      : "Idle";

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
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  statusText === "Calling"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : statusText === "Replying"
                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                    : statusText === "Listening"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {statusText}
              </span>
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
                  {msg.role === "candidate" && (
                    <span className="text-xs text-emerald-100 font-semibold block mb-1">You</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "candidate" && msg.audioUrl && (
                    <audio controls preload="metadata" className="mt-3 w-full max-w-xs">
                      <source src={msg.audioUrl} type="audio/webm" />
                      Your browser does not support audio playback.
                    </audio>
                  )}
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
            <div className="px-6 py-4 border-t border-border bg-surface/50">
              <div className="flex items-center justify-end mb-2">
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
                  placeholder="Type your answer or use the microphone..."
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
                {isRecording ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording... click the mic again to send</> : "Press the mic to record or type your answer"}
              </p>
              <div className="mt-3 flex justify-center">
                <button
                  onClick={endConversation}
                  className="px-5 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 transition-colors cursor-pointer"
                >
                  End Conversation
                </button>
              </div>
            </div>
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
