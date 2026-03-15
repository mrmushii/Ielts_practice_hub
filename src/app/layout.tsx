import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TutorBubbleButton from "@/components/TutorBubbleButton";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IELTS Prep Platform — AI-Powered Practice",
  description:
    "Master all four IELTS modules — Speaking, Listening, Reading, and Writing — with real-time AI feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        {children}
        <TutorBubbleButton />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
