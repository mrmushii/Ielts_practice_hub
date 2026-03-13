"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, Loader2, Paperclip, Mic, Layout, X } from "lucide-react";

export default function TutorPage() {
  const [messages, setMessages] = useState<{ role: "user" | "tutor", content: string }[]>([
    {
      role: "tutor",
      content: "Hello! I am your AI IELTS Tutor. I have access to Internet Search, official IELTS rules, and your reading materials. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCanvasContent, setActiveCanvasContent] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages 
        })
      });

      if (!res.ok) throw new Error("API Error");
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: "tutor", content: data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "tutor", content: "Sorry, I encountered an error connecting to my tools." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.pdf')) {
      alert("Please select a valid PDF file.");
      return;
    }

    setIsUploadingPdf(true);
    setMessages((prev) => [...prev, { role: "user", content: `(📎 Attached ${file.name})` }]);
    setMessages((prev) => [...prev, { role: "tutor", content: "I'm reading your document now. Please wait..." }]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setMessages((prev) => [...prev, { role: "tutor", content: "I've successfully read and memorized your document! What would you like to know about it?" }]);
      } else {
        throw new Error("Failed to process document");
      }
    } catch (err) {
      console.error("PDF upload failed:", err);
      setMessages((prev) => [...prev, { role: "tutor", content: "Sorry, I had trouble reading that document. Please try again." }]);
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleMic = async () => {
    if (isListening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
          const res = await fetch('http://localhost:8000/api/tutor/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.text) {
            setInput(prev => prev ? `${prev} ${data.text}` : data.text);
          }
        } catch (error) {
          console.error("Transcription error:", error);
        }

        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Please allow microphone access to use voice input.");
    }
  };

  return (
    <div className="flex pt-16 h-screen bg-background overflow-hidden">
      {/* Left Chat Pane */}
      <div className={`flex flex-col border-r border-border transition-all duration-300 ease-in-out ${activeCanvasContent ? 'w-[45%]' : 'w-full max-w-4xl mx-auto'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent/20 rounded-xl text-accent">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Omni-Tutor Chat</h1>
              <p className="text-text-muted text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Empowered with Search, OCR, and Deep RAG
              </p>
            </div>
          </div>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-surface/10">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`flex items-start gap-3 max-w-[90%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 mt-1 rounded-full shrink-0 flex items-center justify-center ${
                  msg.role === "user" ? "bg-emerald-500/20 text-emerald-500" : "bg-accent/20 text-accent"
                }`}>
                  {msg.role === "user" ? <span className="text-xs font-bold">U</span> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`p-4 rounded-2xl ${
                  msg.role === "user" 
                    ? "bg-accent text-white rounded-tr-sm" 
                    : "bg-surface border border-border text-foreground rounded-tl-sm prose prose-sm prose-invert max-w-none"
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
              
              {/* Show in Canvas Button for Tutor Messages */}
              {msg.role === "tutor" && msg.content.length > 80 && (
                <div className="mt-2 ml-11">
                  <button 
                    onClick={() => setActiveCanvasContent(msg.content)}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-light bg-accent/10 hover:bg-accent/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                    title="Project to Canvas Workspace"
                  >
                    <Layout className="w-3.5 h-3.5" />
                    Show in Canvas
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3 w-3/4">
               <div className="w-8 h-8 mt-1 rounded-full shrink-0 flex items-center justify-center bg-accent/20 text-accent">
                  <Sparkles className="w-4 h-4" />
               </div>
               <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-text-muted text-sm">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 Processing complex logic...
               </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4 shrink-0" />
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="p-4 border-t border-border bg-surface/50 shrink-0 mb-4 pb-8">
          <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={pdfInputRef} 
              onChange={handlePdfUpload} 
              title="Upload PDF material"
            />
            
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isUploadingPdf || isLoading}
              className="w-11 h-11 shrink-0 rounded-xl bg-surface border border-border flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
              title="Attach PDF Document"
            >
              {isUploadingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>

            {/* Mic Button */}
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
                placeholder="Message Tutor, attach a PDF, or use mic..."
                disabled={isLoading}
                className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                title="Input command"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                title="Send Message"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-light disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-3 opacity-70">
            Tutor can extract text via OCR, read PDFs via Deep Document RAG, and perform logic evaluation.
          </p>
        </form>
      </div>

      {/* Right Canvas Pane */}
      <div className={`transition-all duration-300 ease-in-out bg-surface/30 flex flex-col border-l border-border relative ${activeCanvasContent ? 'w-[55%]' : 'w-0'}`}>
        <div className="absolute inset-0 flex flex-col overflow-hidden min-w-[300px]">
           {/* Canvas Header */}
           <div className="h-[73px] shrink-0 border-b border-border bg-surface/50 backdrop-blur flex items-center justify-between px-6">
             <h2 className="text-lg font-semibold flex items-center gap-2.5 text-foreground">
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
           
           {/* Canvas Body */}
           <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
             <div className="max-w-2xl mx-auto prose prose-invert prose-accent prose-pre:bg-background prose-pre:border prose-pre:border-border">
               <div className="whitespace-pre-wrap text-foreground leading-relaxed text-[15px]">
                 {activeCanvasContent}
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
