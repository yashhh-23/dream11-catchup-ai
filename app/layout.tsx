import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://dream11-wheat.vercel.app"),
  title: "CatchUp AI | Dream11 Live Match Companion",
  description: "Zero-spoiler live catch-up companion for cricket fans.",
  openGraph: {
    title: "CatchUp AI | Dream11 Live Match Companion",
    description: "Zero-spoiler live catch-up companion for cricket fans.",
    images: ["/api/share-card"],
  },
  twitter: {
    card: "summary_large_image",
    title: "CatchUp AI | Dream11 Live Match Companion",
    description: "Zero-spoiler live catch-up companion for cricket fans.",
    images: ["/api/share-card"],
  },
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
