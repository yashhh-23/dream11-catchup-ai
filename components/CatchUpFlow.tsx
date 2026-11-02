"use client";

import React, { useState, useEffect, useRef } from "react";
import { Ball, MatchMeta, RecapPayload, SpoilerLevel } from "@/types";
import { SpoilerGate } from "@/components/screens/SpoilerGate";
import { RecapScreen } from "@/components/screens/RecapScreen";
import { LiveView } from "@/components/screens/LiveView";
import { AlertCircle, RotateCcw, Loader2, Clock } from "lucide-react";
import { useAwayDetector } from "@/hooks/useAwayDetector";
import { track } from "@/lib/analytics";

type AppState = "gate" | "loading" | "recap" | "live" | "error";

interface CatchUpFlowProps {
  initialMeta: MatchMeta;
  initialBalls?: Ball[];
  initialSessionToken?: string;
}

export const CatchUpFlow: React.FC<CatchUpFlowProps> = ({
  initialMeta,
  initialBalls,
  initialSessionToken,
}) => {
  const [meta, setMeta] = useState<MatchMeta>(initialMeta);
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
  const [fantasyPicks, setFantasyPicks] = useState<{ captain: string; viceCaptain: string }>(() => {
    const squad = meta.squad && meta.squad.length >= 2 ? meta.squad : [];
    const defaultCap = squad[0] || "Key Batter";
    const defaultVc = squad.find(p => p !== defaultCap) || squad[1] || "Key All-Rounder";
    return { captain: defaultCap, viceCaptain: defaultVc };
  });

  // Dynamic squad sync when match or squad changes (match-agnostic defaults)
  useEffect(() => {
    try {
      const squad = meta.squad && meta.squad.length >= 2 ? meta.squad : [];
      if (squad.length === 0) return;
      const savedCap = localStorage.getItem("dream11_captain");
      const savedVc = localStorage.getItem("dream11_vice_captain");
      setFantasyPicks(prev => {
        const cap = (savedCap && squad.includes(savedCap)) ? savedCap : (squad.includes(prev.captain) ? prev.captain : squad[0]);
        const vc = (savedVc && squad.includes(savedVc) && savedVc !== cap)
          ? savedVc
          : (squad.includes(prev.viceCaptain) && prev.viceCaptain !== cap ? prev.viceCaptain : (squad.find(p => p !== cap) || squad[1] || cap));
        return { captain: cap, viceCaptain: vc };
      });
    } catch {}
  }, [meta.squad]);
  const reqId = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { isAwayDetected, simulatedMinutesAway, suggestedFromOver, dismiss } = useAwayDetector(
    meta.currentLiveOver,
    appState === "live" || appState === "gate"
  );

  useEffect(() => {
    track("gate_viewed", { matchId: meta.matchId });
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [meta.matchId]);

  // Deliveries are loaded strictly on demand when user enters live match or finishes recap (Zero-Spoiler isolation)
  useEffect(() => {
    if (balls.length === 0 && appState !== "gate" && appState !== "loading") {
      const matchQuery = `?matchId=${encodeURIComponent(meta.matchId)}`;
      fetch(`/api/match${matchQuery}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setMeta(json.data.meta);
            setBalls(json.data.balls);
            if (json.data.sessionToken) {
              setSessionToken(json.data.sessionToken);
            }
          } else {
            setErrorMessage("Failed to load match deliveries. Please retry.");
            setAppState("error");
          }
        })
        .catch((err) => {
          console.warn("Failed to load initial match balls:", err);
          setErrorMessage("Network error connecting to live match feed.");
          setAppState("error");
        });
    }
  }, [balls, appState, meta.matchId]);

  const handleSwitchMatch = (newMatchId: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("matchId", newMatchId);
      window.location.href = url.toString();
    }
  };

  const handleStartCatchUp = async (
    selectedFrom: number, 
    selectedTo: number, 
    spoilerLevel: SpoilerLevel = "story-and-score",
    isWhole = false,
    holdAlerts = true,
    fantasySelection?: { captain: string; viceCaptain: string }
  ) => {
    setFromOver(selectedFrom);
    setToOver(selectedTo);
    setSelectedSpoilerLevel(spoilerLevel);
    setIsWholeMatch(isWhole);
    setHoldBackAlerts(holdAlerts);
    if (fantasySelection) {
      setFantasyPicks(fantasySelection);
    }
    const activePicks = fantasySelection || fantasyPicks;
    setAppState("loading");
    setErrorMessage(null);

    track("recap_started", {
      matchId: meta.matchId,
      fromOver: selectedFrom,
      toOver: selectedTo,
      spoilerLevel,
    });

    const id = ++reqId.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 9500);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionToken) {
        headers["x-simulator-token"] = sessionToken;
      }

      // Concurrently fetch match balls if not already present to eliminate race condition
      // Pass spoilerLevel to ensure server-side Zero-Spoiler protection (no score leakage in Network tab)
      const matchPromise = balls.length === 0
        ? fetch(
            `/api/match?matchId=${encodeURIComponent(meta.matchId)}&spoilerLevel=${encodeURIComponent(spoilerLevel)}`,
            {
              headers: {
                "x-spoiler-level": spoilerLevel,
                ...(sessionToken ? { "x-simulator-token": sessionToken } : {}),
              },
              signal: controller.signal,
            }
          )
            .then(res => res.json())
            .then(json => {
              if (json.success && json.data) {
                setMeta(json.data.meta);
                setBalls(json.data.balls);
                if (json.data.sessionToken) {
                  setSessionToken(json.data.sessionToken);
                }
                return json.data.balls;
              }
              throw new Error("Failed to load match deliveries.");
            })
        : Promise.resolve(balls);

      const recapPromise = fetch("/api/recap", {
        method: "POST",
        headers,
        body: JSON.stringify({
          matchId: meta.matchId,
          fromOver: selectedFrom,
          toOver: selectedTo,
          spoilerLevel,
          isWholeMatch: !!isWhole,
          fantasySelection: activePicks,
        }),
        signal: controller.signal,
      }).then(res => res.json().then(json => ({ ok: res.ok, json })));

      const [, recapResult] = await Promise.all([matchPromise, recapPromise]);

      if (id !== reqId.current) return; // user skipped or restarted

      const { ok, json } = recapResult;
      if (!ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate catch-up");
      }

      setRecapData(json.data);
      if (json.sessionToken) {
        setSessionToken(json.sessionToken);
      }
      track("recap_completed", {
        matchId: meta.matchId,
        fromOver: selectedFrom,
        toOver: selectedTo,
        usedFallback: !!json.meta?.usedFallback,
      });
      setAppState("recap");
    } catch (err: any) {
      if (id !== reqId.current) return; // user skipped or restarted
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
    track("jump_to_live", { matchId: meta.matchId, liveOver: meta.currentLiveOver });
    reqId.current++;
    abortControllerRef.current?.abort();

    // Re-anchor live stream playback token to this exact moment
    fetch(`/api/match/delta?matchId=${encodeURIComponent(meta.matchId)}&action=live_token`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.token) {
          setSessionToken(json.data.token);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch fresh live stream token:", err);
      });

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
      {/* Away Detection Banner (Phase 4) */}
      {isAwayDetected && (
        <div className="w-full bg-[#1c1826] border-b border-amber-500/30 px-4 py-2.5 z-40 sticky top-0 shadow-lg">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>
                You were away ~{simulatedMinutesAway} min. Catch up on overs {suggestedFromOver + 1}–{meta.currentLiveOver}?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  dismiss();
                  handleStartCatchUp(suggestedFromOver, meta.currentLiveOver, selectedSpoilerLevel, false, true, fantasyPicks);
                }}
                className="px-2.5 py-1 rounded bg-brand-red hover:bg-brand-redHover text-white font-semibold text-[11px] transition-colors"
              >
                Catch me up
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-slate-400 hover:text-white text-[11px] px-1.5 py-1 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 1: Spoiler Gate */}
      {appState === "gate" && (
        <SpoilerGate
          meta={meta}
          onCatchUp={handleStartCatchUp}
          onJumpToLiveDirect={handleJumpToLiveDirect}
          onSwitchMatch={handleSwitchMatch}
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
          spoilerLevel={selectedSpoilerLevel}
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
              onClick={() => handleStartCatchUp(fromOver, toOver, selectedSpoilerLevel, isWholeMatch, holdBackAlerts, fantasyPicks)}
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
