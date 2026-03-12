"use client";

import { useState } from "react";
import { MessageSquare, Send, Sparkles, Loader2 } from "lucide-react";

export default function TutorPage() {
  const [messages, setMessages] = useState<{ role: "user" | "tutor", content: string }[]>([
    {
      role: "tutor",
      content: "Hello! I am your AI IELTS Tutor. I have access to Internet Search, official IELTS rules, and your reading materials. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
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

  return (
    <div className="min-h-screen flex flex-col pt-20 px-4 max-w-4xl mx-auto pb-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <div className="p-3 bg-accent/20 rounded-xl text-accent">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Omni-Tutor Agent</h1>
          <p className="text-text-muted text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Empowered with Search, OCR, and Grounding Tools
          </p>
        </div>
      </div>

      <div className="flex-1 bg-surface border border-border rounded-2xl p-6 overflow-y-auto mb-4 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              msg.role === "user" 
                ? "bg-accent text-white rounded-tr-sm" 
                : "bg-surface-hover border border-border text-foreground rounded-tl-sm prose prose-invert"
            }`}>
              <div className="text-sm font-semibold mb-1 opacity-70">
                {msg.role === "user" ? "You" : "Sarah (AI Tutor)"}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-hover border border-border p-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
              Agent is using tools and thinking...
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me anything about IELTS..."
          className="w-full bg-surface border border-border rounded-xl px-6 py-4 pr-16 resize-none focus:outline-none focus:ring-2 ring-accent/50 text-foreground text-sm"
          rows={1}
          style={{ minHeight: "60px", maxHeight: "200px" }}
        />
        <button 
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
