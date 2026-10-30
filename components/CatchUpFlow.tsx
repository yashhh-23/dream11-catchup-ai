"use client";

import React, { useState } from "react";
import { matchBalls, matchMeta } from "@/lib/matchData";
import { RecapPayload } from "@/types";
import { SpoilerGate } from "@/components/screens/SpoilerGate";
import { RecapScreen } from "@/components/screens/RecapScreen";
import { LiveView } from "@/components/screens/LiveView";
import { AlertCircle, RotateCcw, Sparkles } from "lucide-react";

type AppState = "gate" | "loading" | "recap" | "live" | "error";

export const CatchUpFlow: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("gate");
  const [fromOver, setFromOver] = useState<number>(5); // default over index 5 (Over 6)
  const [toOver, setToOver] = useState<number>(14);     // default over index 14 (Over 14)
  const [recapData, setRecapData] = useState<RecapPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartCatchUp = async (selectedFrom: number, selectedTo: number) => {
    setFromOver(selectedFrom);
    setToOver(selectedTo);
    setAppState("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromOver: selectedFrom,
          toOver: selectedTo,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate AI recap");
      }

      setRecapData(json.data);
      setAppState("recap");
    } catch (err: any) {
      console.error("Error generating catch up recap:", err);
      setErrorMessage(
        err?.message || "Network issue connecting to AI service. Please try again."
      );
      setAppState("error");
    }
  };

  const handleJumpToLiveDirect = () => {
    setAppState("live");
  };

  const handleBackToGate = () => {
    setAppState("gate");
  };

  const handleBackToRecap = () => {
    if (recapData) {
      setAppState("recap");
    } else {
      setAppState("gate");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Screen 1: Spoiler Gate */}
      {appState === "gate" && (
        <SpoilerGate
          meta={matchMeta}
          onCatchUp={handleStartCatchUp}
          onJumpToLiveDirect={handleJumpToLiveDirect}
          isLoading={false}
        />
      )}

      {/* Loading Overlay */}
      {appState === "loading" && (
        <div className="w-full max-w-md mx-auto my-auto px-4 py-20 text-center animate-fadeIn">
          <div className="w-14 h-14 mx-auto mb-6 relative">
            <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-rose-500 animate-spin" />
            <Sparkles className="w-5 h-5 text-amber-300 absolute inset-0 m-auto animate-pulse" />
          </div>

          <h2 className="text-lg font-bold text-slate-100 mb-2">
            Synthesizing Overs {fromOver + 1} to {toOver}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Rhea AI is analyzing win probability swings, wickets, and key tactical moments with Groq llama-3.1...
          </p>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            <span>Zero Spoilers Enforced</span>
          </div>
        </div>
      )}

      {/* Screen 2: Recap Screen */}
      {appState === "recap" && recapData && (
        <RecapScreen
          meta={matchMeta}
          recap={recapData}
          missedFromOver={fromOver}
          missedToOver={toOver}
          balls={matchBalls}
          onBackToGate={handleBackToGate}
          onJumpToLive={handleJumpToLiveDirect}
        />
      )}

      {/* Screen 3: Live View */}
      {appState === "live" && (
        <LiveView
          meta={matchMeta}
          balls={matchBalls}
          onBackToRecap={handleBackToRecap}
          onResetToGate={handleBackToGate}
        />
      )}

      {/* Error Fallback Screen */}
      {appState === "error" && (
        <div className="w-full max-w-md mx-auto my-auto px-4 py-16 text-center animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-100 mb-2">
            Couldn&apos;t Generate Catch-Up
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {errorMessage || "Something unexpected happened. You can retry or head directly into the live match."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleStartCatchUp(fromOver, toOver)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Recap</span>
            </button>
            <button
              type="button"
              onClick={handleJumpToLiveDirect}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg"
            >
              <span>Skip to Live Score</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
