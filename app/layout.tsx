import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatchUp AI | Dream11 Live Match Companion",
  description: "Zero-spoiler contextual time-machine for live cricket fans, powered by Dream11 Rhea AI & Groq.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
