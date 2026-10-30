import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatchUp AI | Dream11 Live Match Companion",
  description: "Zero-spoiler live catch-up companion for cricket fans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0E1116] text-[#F0F6FC] antialiased selection:bg-[#E11D48] selection:text-white">
        {children}
      </body>
    </html>
  );
}
