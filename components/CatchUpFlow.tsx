"use client";

import React, { useState } from "react";
import { matchBalls, matchMeta } from "@/lib/matchData";
import { RecapPayload, SpoilerLevel } from "@/types";
import { SpoilerGate } from "@/components/screens/SpoilerGate";
import { RecapScreen } from "@/components/screens/RecapScreen";
import { LiveView } from "@/components/screens/LiveView";
import { AlertCircle, RotateCcw, Loader2 } from "lucide-react";

type AppState = "gate" | "loading" | "recap" | "live" | "error";

export const CatchUpFlow: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("gate");
  const [fromOver, setFromOver] = useState<number>(5); // default over index 5 (Over 6)
  const [toOver, setToOver] = useState<number>(14.2);  // default live cutoff 14.2 (Zero two-ball gap)
  const [recapData, setRecapData] = useState<RecapPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartCatchUp = async (
    selectedFrom: number, 
    selectedTo: number, 
    spoilerLevel?: SpoilerLevel,
    isWholeMatch?: boolean
  ) => {
    setFromOver(selectedFrom);
    setToOver(selectedTo);
    setAppState("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: matchMeta.matchId,
          fromOver: selectedFrom,
          toOver: selectedTo,
          spoilerLevel: spoilerLevel || "story-and-score",
          isWholeMatch: !!isWholeMatch,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate catch-up");
      }

      setRecapData(json.data);
      setAppState("recap");
    } catch (err: any) {
      console.error("Error generating catch up recap:", err);
      setErrorMessage(
        err?.message || "Could not generate catch-up right now. Please retry."
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
    <main className="min-h-screen bg-[#0E1116] text-[#F0F6FC] flex flex-col font-sans selection:bg-[#E11D48] selection:text-white">
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
        <div className="w-full max-w-sm mx-auto my-auto px-4 py-24 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-[#E11D48] animate-spin" />

          <h2 className="text-base font-semibold text-slate-100 mb-1">
            Catching you up on overs {fromOver + 1} to {toOver}
          </h2>
          <p className="text-xs text-slate-400">
            Finding key moments and momentum shifts...
          </p>
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
        <div className="w-full max-w-sm mx-auto my-auto px-4 py-20 text-center">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1">
            Couldn&apos;t load catch-up
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {errorMessage || "Please try again or skip directly to live."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleStartCatchUp(fromOver, toOver)}
              className="px-3.5 py-2 rounded-lg bg-[#161B22] border border-[#262C36] text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={handleJumpToLiveDirect}
              className="px-3.5 py-2 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white transition-colors"
            >
              <span>Skip to live</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
