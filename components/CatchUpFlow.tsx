"use client";

import React, { useState, useEffect } from "react";
import { matchMeta as defaultMeta } from "@/lib/matchData";
import { Ball, MatchMeta, RecapPayload, SpoilerLevel } from "@/types";
import { SpoilerGate } from "@/components/screens/SpoilerGate";
import { RecapScreen } from "@/components/screens/RecapScreen";
import { LiveView } from "@/components/screens/LiveView";
import { AlertCircle, RotateCcw, Loader2 } from "lucide-react";

type AppState = "gate" | "loading" | "recap" | "live" | "error";

interface CatchUpFlowProps {
  initialMeta?: MatchMeta;
  initialBalls?: Ball[];
  initialSessionToken?: string;
}

export const CatchUpFlow: React.FC<CatchUpFlowProps> = ({
  initialMeta,
  initialBalls,
  initialSessionToken,
}) => {
  const [meta, setMeta] = useState<MatchMeta>(initialMeta || defaultMeta);
  const [balls, setBalls] = useState<Ball[]>(initialBalls || []);
  const [sessionToken, setSessionToken] = useState<string | undefined>(initialSessionToken);

  const [appState, setAppState] = useState<AppState>("gate");
  const [fromOver, setFromOver] = useState<number>(5); // default over index 5 (Over 6)
  const [toOver, setToOver] = useState<number>(meta.currentLiveOver);
  const [selectedSpoilerLevel, setSelectedSpoilerLevel] = useState<SpoilerLevel>("story-and-score");
  const [isWholeMatch, setIsWholeMatch] = useState<boolean>(false);
  const [holdBackAlerts, setHoldBackAlerts] = useState<boolean>(true);
  const [recapData, setRecapData] = useState<RecapPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If initial balls were not supplied via SSR, fetch public-only deliveries from /api/match
  useEffect(() => {
    if (balls.length === 0) {
      fetch("/api/match")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setMeta(json.data.meta);
            setBalls(json.data.balls);
            if (json.data.sessionToken) {
              setSessionToken(json.data.sessionToken);
            }
          }
        })
        .catch((err) => console.warn("Failed to load initial match balls:", err));
    }
  }, [balls.length]);

  const handleStartCatchUp = async (
    selectedFrom: number, 
    selectedTo: number, 
    spoilerLevel: SpoilerLevel = "story-and-score",
    isWhole = false,
    holdAlerts = true
  ) => {
    setFromOver(selectedFrom);
    setToOver(selectedTo);
    setSelectedSpoilerLevel(spoilerLevel);
    setIsWholeMatch(isWhole);
    setHoldBackAlerts(holdAlerts);
    setAppState("loading");
    setErrorMessage(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9500);

    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: meta.matchId,
          fromOver: selectedFrom,
          toOver: selectedTo,
          spoilerLevel,
          isWholeMatch: !!isWhole,
        }),
        signal: controller.signal,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate catch-up");
      }

      setRecapData(json.data);
      setAppState("recap");
    } catch (err: any) {
      console.error("Error generating catch up recap:", err);
      const isTimeout = err?.name === "AbortError";
      setErrorMessage(
        isTimeout 
          ? "Request timed out. Please retry or skip directly to the live match."
          : (err?.message || "Could not generate catch-up right now. Please retry.")
      );
      setAppState("error");
    } finally {
      clearTimeout(timer);
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
    <main className="min-h-screen flex flex-col font-sans">
      {/* Screen 1: Spoiler Gate */}
      {appState === "gate" && (
        <SpoilerGate
          meta={meta}
          onCatchUp={handleStartCatchUp}
          onJumpToLiveDirect={handleJumpToLiveDirect}
        />
      )}

      {/* Loading Transition State */}
      {appState === "loading" && (
        <div className="w-full max-w-sm mx-auto my-auto px-4 py-24 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-brand-red animate-spin" />

          <h2 className="text-base font-semibold text-slate-100 mb-1">
            Catching you up on overs {fromOver + 1} to {toOver}
          </h2>
          <p className="text-xs text-slate-400">
            Finding key moments and momentum shifts...
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleJumpToLiveDirect}
              className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
            >
              Skip directly to live match
            </button>
          </div>
        </div>
      )}

      {/* Screen 2: Recap Screen */}
      {appState === "recap" && recapData && (
        <RecapScreen
          meta={meta}
          recap={recapData}
          missedFromOver={fromOver}
          missedToOver={toOver}
          balls={balls}
          holdBackAlerts={holdBackAlerts}
          onBackToGate={handleBackToGate}
          onJumpToLive={handleJumpToLiveDirect}
        />
      )}

      {/* Screen 3: Live View */}
      {appState === "live" && (
        <LiveView
          meta={meta}
          balls={balls}
          sessionToken={sessionToken}
          fantasyImpact={recapData?.fantasyImpact}
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
              onClick={() => handleStartCatchUp(fromOver, toOver, selectedSpoilerLevel, isWholeMatch, holdBackAlerts)}
              className="px-3.5 py-2 rounded-chip bg-brand-surface border border-brand-border text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={handleJumpToLiveDirect}
              className="px-3.5 py-2 rounded-chip bg-brand-red hover:bg-brand-redHover text-xs font-semibold text-white transition-colors"
            >
              <span>Skip to live</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
