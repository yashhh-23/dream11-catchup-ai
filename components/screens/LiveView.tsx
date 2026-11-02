"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Ball, MatchMeta, FantasyTeamPerformance, SpoilerLevel } from "@/types";
import { classifyBall, EVENT_STYLE, SIMULATOR_SECONDS_PER_BALL } from "@/lib/matchUtils";
import {
  ArrowLeft,
  Sparkles,
  SlidersHorizontal,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Trophy,
  Send,
  MessageSquare,
} from "lucide-react";

interface LiveViewProps {
  meta: MatchMeta;
  balls: Ball[];
  sessionToken?: string;
  fantasyImpact?: FantasyTeamPerformance;
  spoilerLevel?: SpoilerLevel;
  onBackToRecap: () => void;
  onResetToGate: () => void;
}

interface ChatMessage {
  id: string;
  avatar: string;
  name: string;
  message: string;
  isUser?: boolean;
  timestamp?: string;
}

export const LiveView: React.FC<LiveViewProps> = ({
  meta,
  balls: initialBalls,
  sessionToken,
  fantasyImpact,
  spoilerLevel,
  onBackToRecap,
  onResetToGate,
}) => {
  const initialLiveIndex = meta.liveBallIndex !== undefined 
    ? meta.liveBallIndex 
    : (initialBalls.length > 0 ? initialBalls.length - 1 : 0);

  const [liveBalls, setLiveBalls] = useState<Ball[]>(initialBalls);
  const [currentIndex, setCurrentIndex] = useState<number>(initialLiveIndex);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [showDemoControls, setShowDemoControls] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [cadenceNotice, setCadenceNotice] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | undefined>(sessionToken);

  useEffect(() => {
    if (sessionToken) {
      setActiveToken(sessionToken);
    } else {
      fetch(`/api/match/delta?matchId=${encodeURIComponent(meta.matchId)}&action=live_token`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.token) {
            setActiveToken(json.data.token);
          }
        })
        .catch((e) => console.warn("Could not fetch live stream token:", e));
    }
  }, [sessionToken, meta.matchId]);

  const isMountedRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const liveBallsRef = useRef<Ball[]>(initialBalls);
  liveBallsRef.current = liveBalls;
  const currentIndexRef = useRef<number>(initialLiveIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Sync with incoming balls prop if initialBalls was empty on mount (Bug 1 escape hatch fix)
  useEffect(() => {
    if (initialBalls && initialBalls.length > 0) {
      setLiveBalls(prev => (prev.length === 0 ? initialBalls : prev));
      if (liveBallsRef.current.length === 0) {
        const targetIdx = meta.liveBallIndex !== undefined 
          ? meta.liveBallIndex 
          : (initialBalls.length - 1);
        setCurrentIndex(targetIdx);
      }
    }
  }, [initialBalls, meta.liveBallIndex]);

  const currentBall = liveBalls[currentIndex] || liveBalls[liveBalls.length - 1];

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: "m1",
      avatar: "CA",
      name: "Cricket Analyst",
      message: `${meta.team2} stabilizing under intense bowling pressure. Strike rotation is key here in this live spell!`,
      timestamp: "Just now",
    },
    {
      id: "m2",
      avatar: "DF",
      name: "D11 Fan",
      message: "Atmosphere under the lights is electric! Glad I caught up on the delta recap before this over.",
      timestamp: "Just now",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleSendChat = (customText?: string) => {
    const text = (customText || chatInput).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      avatar: "YOU",
      name: "You",
      message: text,
      isUser: true,
      timestamp: "Just now",
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    setTimeout(() => {
      const communityReplies = [
        "Spot on! Every single run is pure gold right now.",
        "Crucial delivery coming up! Fielders placed deep.",
        "That momentum shift from the recap was huge.",
        "Need a clean strike here to ease the required rate!",
      ];
      const replyMsg: ChatMessage = {
        id: `com-${Date.now()}`,
        avatar: "FC",
        name: "FanCode Member",
        message: communityReplies[Math.floor(Math.random() * communityReplies.length)],
        timestamp: "Just now",
      };
      setChatMessages((prev) => [...prev, replyMsg]);
    }, 1100);
  };

  const liveFanCount = useMemo(() => {
    const base = 94850;
    const offset = Math.round(((currentIndex * 137) % 1500) - 750);
    return (base + offset).toLocaleString();
  }, [currentIndex]);

  const fetchNextDelta = useCallback(async (targetIdx: number) => {
    if (isFetchingRef.current) return;

    if (targetIdx < liveBallsRef.current.length) {
      setCurrentIndex(targetIdx);
      setCadenceNotice(null);
      return;
    }

    isFetchingRef.current = true;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const tokenToUse = activeToken || sessionToken;
      const headers: Record<string, string> = {
        ...(tokenToUse ? { "x-simulator-token": tokenToUse } : {}),
        ...(spoilerLevel ? { "x-spoiler-level": spoilerLevel } : {}),
      };
      const res = await fetch(
        `/api/match/delta?matchId=${meta.matchId}&index=${targetIdx}&spoilerLevel=${spoilerLevel || "story-and-score"}`,
        {
          headers,
          signal: controller.signal,
        }
      );
      const json = await res.json();

      if (!isMountedRef.current) return;

      if (json.success && json.data) {
        setCadenceNotice(null);
        if (json.data.ball) {
          setLiveBalls(prev => [...prev, json.data.ball]);
          setCurrentIndex(targetIdx);
        }
        if (json.data.isMatchFinished) {
          setIsFinished(true);
          setIsPlayingAuto(false);
        }
      } else if (!json.success && json.error) {
        if (res.status === 403) {
          setCadenceNotice(`Ball locked to real match cadence (~${SIMULATOR_SECONDS_PER_BALL.toFixed(1)}s per delivery)`);
        }
        setIsPlayingAuto(false);
      }
    } catch (e: any) {
      if (!isMountedRef.current || e?.name === "AbortError") return;
      console.warn("Could not fetch next delta ball:", e);
      setIsPlayingAuto(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [meta.matchId, sessionToken, activeToken]);

  useEffect(() => {
    if (!isPlayingAuto || isFinished) return;

    const timer = setInterval(() => {
      fetchNextDelta(currentIndexRef.current + 1);
    }, SIMULATOR_SECONDS_PER_BALL * 1000);

    return () => clearInterval(timer);
  }, [isPlayingAuto, isFinished, fetchNextDelta]);

  const handleStepNext = () => {
    if (!isFinished) {
      fetchNextDelta(currentIndex + 1);
    }
  };

  const handleResetToLiveStart = () => {
    setCurrentIndex(initialLiveIndex);
    setIsFinished(false);
  };

  const totalTarget = meta.target;
  const currentRuns = currentBall ? currentBall.cumulativeScore : 0;
  const currentWickets = currentBall ? currentBall.cumulativeWickets : 0;
  const runsNeeded = Math.max(0, totalTarget - currentRuns);

  const ballsCompleted = currentBall ? (currentBall.over * 6 + Math.min(6, currentBall.legalBall || currentBall.ball)) : 0;
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);

  const crr = ballsCompleted > 0 ? ((currentRuns / ballsCompleted) * 6).toFixed(2) : "0.0";
  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.0";
  const winProb = Math.round((currentBall?.winProbability ?? 0.5) * 100);

  // Deliveries strictly belonging to the current over up to current ball
  const currentOverBalls = currentBall
    ? liveBalls.slice(0, currentIndex + 1).filter(b => b.over === currentBall.over)
    : [];

  if (liveBalls.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-10 h-10 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-semibold text-white">Connecting to live match feed...</div>
        <p className="text-xs text-slate-400">Loading deliveries up to over {meta.currentLiveOver}</p>
        <button
          type="button"
          onClick={onResetToGate}
          className="text-xs text-slate-400 hover:text-white underline pt-4"
        >
          Cancel and return to spoiler shield
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 mb-6 border-b border-brand-border">
        <button
          type="button"
          onClick={onResetToGate}
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Match center</span>
        </button>

        <div className="flex items-center gap-2">
          {fantasyImpact ? (
            fantasyImpact.isShielded ? (
              <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Picks: {fantasyImpact.captain.name} (C) · Points Shielded 🔒</span>
              </span>
            ) : (
              <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Phase pts: +{fantasyImpact.phasePoints}</span>
              </span>
            )
          ) : (
            <span className="text-[11px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
              <Trophy className="w-3 h-3 text-slate-500" />
              <span>Match Live</span>
            </span>
          )}

          <button
            type="button"
            onClick={onBackToRecap}
            className="text-xs px-2.5 py-1 rounded-chip bg-brand-bg border border-brand-border text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-brand-red" />
            <span>Recap</span>
          </button>
        </div>
      </header>

      {cadenceNotice && (
        <div className="mb-4 px-3 py-2 rounded-chip bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <span>{cadenceNotice}</span>
          <button
            type="button"
            onClick={() => setCadenceNotice(null)}
            className="text-amber-400 hover:text-white font-bold text-xs ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-brand-surface border border-brand-border rounded-container p-5 sm:p-6 space-y-6">
        {/* Match State & Score */}
        <div>
          <div className="text-xs text-slate-400 mb-2">
            Target {meta.target} · 2nd innings
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {meta.team2}
              </span>
              <span className="tabular-nums font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {currentRuns}/{currentWickets}
              </span>
              <span className="tabular-nums text-xs text-slate-400">
                ({currentBall.over}.{Math.min(6, currentBall.legalBall || currentBall.ball)} ov)
              </span>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {runsNeeded <= 0 ? "Target achieved" : `Need ${runsNeeded} off ${ballsRemaining}`}
              </div>
            </div>
          </div>

          {/* CRR / RRR / Win Prob */}
          <div className="grid grid-cols-3 gap-2 pt-4 text-xs text-slate-400">
            <div>
              <span>CRR </span>
              <span className="tabular-nums text-slate-200 font-semibold">{crr}</span>
            </div>
            <div>
              <span>RRR </span>
              <span className="tabular-nums text-slate-200 font-semibold">{rrr}</span>
            </div>
            <div className="text-right">
              <span>Win prob </span>
              <span className="tabular-nums text-emerald-400 font-semibold">{winProb}%</span>
            </div>
          </div>

          <div className="w-full h-1 bg-brand-border rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${winProb}%` }}
            />
          </div>

          {/* Current Batsman & Bowler */}
          <div className="flex items-center justify-between pt-3 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium text-white">{currentBall.batter}*</span>
            </div>
            <div>
              <span className="text-slate-400">Bowler: </span>
              <span className="font-medium text-white">{currentBall.bowler}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-brand-border" />

        {/* Current Over Delivery Feed */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Current over
            </span>

            {/* Balls strip */}
            <div className="flex items-center gap-1.5">
              {currentOverBalls.map((b, idx) => {
                const kind = classifyBall(b);
                const isCurrent = idx === currentOverBalls.length - 1;
                const circleStyle = EVENT_STYLE[kind].circle;

                return (
                  <div
                    key={idx}
                    className={`w-6 h-6 rounded-full flex items-center justify-center tabular-nums text-xs font-semibold transition-all ${circleStyle} ${
                      isCurrent ? "ring-2 ring-white ring-offset-1 ring-offset-brand-surface" : ""
                    }`}
                  >
                    {kind === "wicket" ? "W" : b.runs}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commentary Block */}
          <div className="p-3.5 rounded-chip bg-brand-bg border border-brand-border space-y-1 text-xs">
            <div className="font-semibold text-slate-300">
              Over {currentBall.over}.{Math.min(6, currentBall.legalBall || currentBall.ball)}{currentBall.isExtra ? ` (${currentBall.extraType || "extra"})` : ""} · {currentBall.bowler} to {currentBall.batter}
            </div>
            <p className="text-slate-300 leading-relaxed">
              {currentBall.commentary}
            </p>
          </div>
        </div>

        <div className="border-t border-brand-border" />

        {/* Interactive Watch-Along Fan Chat */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-slate-200">
                Live Watch-Along · ~{liveFanCount} fans streaming
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Zero-Spoiler Shield</span>
          </div>

          {/* Messages Container */}
          <div
            ref={chatScrollRef}
            className="max-h-48 overflow-y-auto divide-y divide-brand-border text-xs rounded-chip bg-brand-bg/50 border border-brand-border p-2 space-y-1"
          >
            {chatMessages.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-start gap-2.5 py-1.5 px-2 rounded ${
                  chat.isUser ? "bg-brand-red/10 border border-brand-red/20" : ""
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                    chat.isUser
                      ? "bg-brand-red text-white"
                      : "bg-brand-bg border border-brand-border text-slate-300"
                  }`}
                >
                  {chat.avatar}
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium mr-2 ${chat.isUser ? "text-brand-red" : "text-slate-200"}`}>
                      {chat.name}
                    </span>
                    {chat.timestamp && (
                      <span className="text-[10px] text-slate-500">{chat.timestamp}</span>
                    )}
                  </div>
                  <p className="text-slate-300 break-words">{chat.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Reaction Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            {["🇮🇳 Come on India!", "🔥 Big over coming!", "🛡️ Rotate strike!"].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendChat(chip)}
                className="px-2.5 py-1 rounded-full bg-brand-surface hover:bg-brand-border border border-brand-border text-slate-300 whitespace-nowrap transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Interactive Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Join the live watch-along discussion..."
              className="flex-1 px-3 py-2 rounded-container bg-brand-bg border border-brand-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-red/60 transition-colors"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-container bg-brand-red hover:bg-brand-redHover disabled:opacity-40 text-white transition-colors"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Demo Controls */}
        <div className="pt-2 border-t border-brand-border">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDemoControls(!showDemoControls)}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{showDemoControls ? "Hide demo controls" : "Demo controls"}</span>
            </button>

            {showDemoControls && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlayingAuto(!isPlayingAuto)}
                  disabled={isFinished}
                  className="px-2.5 py-1 rounded bg-brand-bg hover:bg-brand-surface text-[11px] font-medium text-slate-300 flex items-center gap-1 border border-brand-border disabled:opacity-50"
                >
                  {isPlayingAuto ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Play (4s)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStepNext}
                  disabled={isFinished}
                  className="px-2.5 py-1 rounded bg-brand-bg hover:bg-brand-surface text-[11px] font-medium text-slate-300 flex items-center gap-1 border border-brand-border disabled:opacity-50"
                >
                  <SkipForward className="w-3 h-3" />
                  <span>Next ball</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToLiveStart}
                  className="p-1 rounded bg-brand-bg hover:bg-brand-surface text-slate-400 hover:text-slate-200 border border-brand-border"
                  title={`Reset to Over ${meta.currentLiveOver}`}
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
