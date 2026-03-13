import Link from "next/link";
import { Mic, Headphones, BookOpen, PenTool } from "lucide-react";

const modules = [
  {
    icon: <Mic className="w-8 h-8" />,
    title: "Speaking",
    description: "Real-time voice conversation with an AI examiner. Practice Parts 1, 2 & 3.",
    href: "/speaking",
    color: "from-indigo-500 to-purple-500",
    tag: "Live Voice",
  },
  {
    icon: <Headphones className="w-8 h-8" />,
    title: "Listening",
    description: "AI-generated audio scenarios with MCQ, fill-in-the-blank questions.",
    href: "/listening",
    color: "from-cyan-500 to-blue-500",
    tag: "Multi-Voice",
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: "Reading",
    description: "Upload passages or use AI-generated ones. True/False/Not Given and more.",
    href: "/reading",
    color: "from-emerald-500 to-teal-500",
    tag: "RAG Powered",
  },
  {
    icon: <PenTool className="w-8 h-8" />,
    title: "Writing",
    description: "Task 1 & 2 with real-time grading on all 4 official IELTS rubrics.",
    href: "/writing",
    color: "from-orange-500 to-rose-500",
    tag: "Auto-Grade",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background glow */}
      <div className="hero-glow absolute left-1/2 -translate-x-1/2 -top-50" />
      <div className="hero-glow absolute -right-25 -bottom-75 opacity-50" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold gradient-text">IELTS Prep</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light border border-accent/20 font-medium">
            AI
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span className="relative flex h-2 w-2">
            <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          System Online
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-8 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border text-sm text-text-muted mb-8">
          <span className="text-accent-light">✦</span>
          Powered by Groq + LangChain + MongoDB
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
          Master IELTS with
          <br />
          <span className="gradient-text">AI Precision</span>
        </h1>

        <p className="text-lg text-text-muted max-w-2xl mb-12 leading-relaxed">
          Practice all four IELTS modules with real-time AI feedback, voice interaction,
          and intelligent document analysis. Free. Open-source. No compromises.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link href="/speaking" className="px-8 py-3.5 rounded-full bg-accent text-white font-semibold text-base hover:bg-accent-light transition-all duration-300 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-105">
            Start Practicing
          </Link>
          <button className="px-8 py-3.5 rounded-full bg-surface border border-border text-foreground font-medium text-base hover:bg-surface-hover transition-all duration-300 cursor-pointer">
            View on GitHub
          </button>
        </div>
      </main>

      {/* Module Cards */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest text-center mb-10">
          Four Modules. One Platform.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((mod) => (
            <Link key={mod.title} href={mod.href} className="glass-card p-6 flex flex-col gap-4 cursor-pointer group no-underline text-foreground">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{mod.icon}</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full bg-linear-to-r ${mod.color} text-white opacity-80 group-hover:opacity-100 transition-opacity`}
                >
                  {mod.tag}
                </span>
              </div>
              <h3 className="text-xl font-semibold">{mod.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{mod.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-sm text-text-muted border-t border-border">
        Built with Next.js, FastAPI, Groq & MongoDB — 100% Free & Open Source
      </footer>
    </div>
  );
}
