"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Ball, MatchMeta } from "@/types";
import { classifyBall, EVENT_STYLE } from "@/lib/matchUtils";
import {
  ArrowLeft,
  Sparkles,
  SlidersHorizontal,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Trophy,
} from "lucide-react";

interface LiveViewProps {
  meta: MatchMeta;
  balls: Ball[];
  onBackToRecap: () => void;
  onResetToGate: () => void;
}

const CHAT_MESSAGES = [
  {
    avatar: "RA",
    name: "R Ashwin",
    message: "Tilak playing the spin down the ground rather than sweeping was the tactical masterstroke.",
  },
  {
    avatar: "CF",
    name: "CricketFan99",
    message: "Thank god I caught up on that 10th over, didn't know Sodhi got 2 in 4 balls!",
  },
] as const;

export const LiveView: React.FC<LiveViewProps> = ({
  meta,
  balls: initialBalls,
  onBackToRecap,
  onResetToGate,
}) => {
  const initialLiveIndex = meta.liveBallIndex ?? 85;

  const [liveBalls, setLiveBalls] = useState<Ball[]>(initialBalls);
  const [currentIndex, setCurrentIndex] = useState<number>(initialLiveIndex);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(true);
  const [showDemoControls, setShowDemoControls] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const currentBall = liveBalls[currentIndex] || liveBalls[liveBalls.length - 1];

  const fetchNextDelta = useCallback(async (targetIdx: number) => {
    if (targetIdx < liveBalls.length) {
      setCurrentIndex(targetIdx);
      return;
    }

    try {
      const res = await fetch(`/api/match/delta?matchId=${meta.matchId}&index=${targetIdx}`);
      const json = await res.json();

      if (json.success && json.data) {
        if (json.data.ball) {
          setLiveBalls(prev => [...prev, json.data.ball]);
          setCurrentIndex(targetIdx);
        }
        if (json.data.isMatchFinished) {
          setIsFinished(true);
          setIsPlayingAuto(false);
        }
      }
    } catch (e) {
      console.warn("Could not fetch next delta ball:", e);
      setIsPlayingAuto(false);
    }
  }, [liveBalls.length, meta.matchId]);

  useEffect(() => {
    if (!isPlayingAuto || isFinished) return;

    const timer = setInterval(() => {
      fetchNextDelta(currentIndex + 1);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPlayingAuto, isFinished, currentIndex, fetchNextDelta]);

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
  const currentRuns = currentBall?.cumulativeScore ?? 124;
  const currentWickets = currentBall?.cumulativeWickets ?? 3;
  const runsNeeded = Math.max(0, totalTarget - currentRuns);

  const ballsCompleted = ((currentBall?.over ?? 14) * 6) + (currentBall?.ball ?? 2);
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);

  const crr = ballsCompleted > 0 ? ((currentRuns / ballsCompleted) * 6).toFixed(2) : "0.0";
  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.0";
  const winProb = Math.round((currentBall?.winProbability ?? 0.8) * 100);

  // Deliveries strictly belonging to the current over up to current ball
  const currentOverBalls = liveBalls.filter(
    b => b.over === currentBall.over && b.ball <= currentBall.ball
  );

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
          <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span>IndiaXI · 482 pts</span>
          </span>

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
                ({currentBall.over}.{currentBall.ball} ov)
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
              Over {currentBall.over}.{currentBall.ball} · {currentBall.bowler} to {currentBall.batter}
            </div>
            <p className="text-slate-300 leading-relaxed">
              {currentBall.commentary}
            </p>
          </div>
        </div>

        <div className="border-t border-brand-border" />

        {/* Creator Watch-Along */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Creator watch-along · 108k fans live
            </span>
            <span className="text-emerald-400">Zero spoilers</span>
          </div>

          <div className="divide-y divide-brand-border text-xs">
            {CHAT_MESSAGES.map((chat, idx) => (
              <div key={idx} className="flex items-start gap-2.5 py-2">
                <div className="w-6 h-6 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-[10px] font-semibold text-slate-300 shrink-0">
                  {chat.avatar}
                </div>
                <div className="space-y-0.5">
                  <span className="font-medium text-slate-200 mr-2">
                    {chat.name}:
                  </span>
                  <span className="text-slate-400">
                    {chat.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
                  title="Reset to Over 14.2"
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
