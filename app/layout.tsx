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
      <body className="font-sans min-h-screen antialiased selection:bg-brand-red selection:text-white">
        {children}
      </body>
    </html>
  );
}
