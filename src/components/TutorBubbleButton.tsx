"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";

export default function TutorBubbleButton() {
  const pathname = usePathname();

  // Hide bubble on the tutor page itself.
  if (pathname === "/tutor") return null;

  return (
    <Link
      href="/tutor"
      className="fixed bottom-6 right-6 z-50 group animate-pop-in"
      aria-label="Open AI Tutor"
      title="Open AI Tutor"
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-accent/40 blur-lg opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="relative h-14 w-14 rounded-full bg-linear-to-br from-accent to-accent-light text-white border border-white/15 shadow-lg shadow-accent/40 flex items-center justify-center group-hover:scale-105 transition-transform">
          <MessageSquare className="w-6 h-6" />
        </div>
      </div>
    </Link>
  );
}
