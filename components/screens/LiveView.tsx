"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta } from "@/types";
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  TrendingUp,
  Award,
  Users,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface LiveViewProps {
  meta: MatchMeta;
  balls: Ball[];
  onBackToRecap: () => void;
  onResetToGate: () => void;
}

export const LiveView: React.FC<LiveViewProps> = ({
  meta,
  balls,
  onBackToRecap,
  onResetToGate,
}) => {
  // Current live ball index in `balls` array
  // Live ball is Over 14, ball 2 -> find index of over 14, ball 2
  const initialLiveIndex = Math.max(
    0,
    balls.findIndex((b) => b.over === 14 && b.ball === 2)
  );

  const [currentIndex, setCurrentIndex] = useState<number>(
    initialLiveIndex !== -1 ? initialLiveIndex : 85
  );
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(true);
  const [recentFlash, setRecentFlash] = useState<string | null>(null);

  const currentBall = balls[currentIndex] || balls[balls.length - 1];
  const isMatchFinished = currentIndex >= balls.length - 1;

  // Auto-advance simulated live match every 4.5 seconds
  useEffect(() => {
    if (!isPlayingAuto || isMatchFinished) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < balls.length - 1) {
          const next = prev + 1;
          const nextBall = balls[next];
          if (nextBall.wicket) setRecentFlash("WICKET!");
          else if (nextBall.runs >= 6) setRecentFlash("SIX!");
          else if (nextBall.runs >= 4) setRecentFlash("FOUR!");
          else setRecentFlash(null);
          return next;
        }
        setIsPlayingAuto(false);
        return prev;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [isPlayingAuto, isMatchFinished, balls]);

  const handleStepNext = () => {
    if (currentIndex < balls.length - 1) {
      const next = currentIndex + 1;
      const nextBall = balls[next];
      if (nextBall.wicket) setRecentFlash("WICKET!");
      else if (nextBall.runs >= 6) setRecentFlash("SIX!");
      else if (nextBall.runs >= 4) setRecentFlash("FOUR!");
      else setRecentFlash(null);
      setCurrentIndex(next);
    }
  };

  const handleResetToLiveStart = () => {
    setCurrentIndex(initialLiveIndex !== -1 ? initialLiveIndex : 85);
    setRecentFlash(null);
  };

  // Compute live match metrics
  const totalTarget = meta.target;
  const currentRuns = currentBall.cumulativeScore;
  const currentWickets = currentBall.cumulativeWickets;
  const runsNeeded = Math.max(0, totalTarget - currentRuns);

  // Balls completed & remaining
  const ballsCompleted = (currentBall.over * 6) + currentBall.ball;
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);

  const crr = ballsCompleted > 0 ? ((currentRuns / ballsCompleted) * 6).toFixed(2) : "0.0";
  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.0";
  const winProb = Math.round(currentBall.winProbability * 100);

  // Recent 6 balls in the match
  const recentBalls = balls.slice(Math.max(0, currentIndex - 5), currentIndex + 1);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-fadeIn pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>LIVE MATCH CENTER</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">FanCode Feed</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToRecap}
            className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>View AI Recap</span>
          </button>
          <button
            type="button"
            onClick={onResetToGate}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main Scorecard Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden mb-5">
        {recentFlash && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-rose-600 text-white font-black text-xs rounded-full shadow-lg animate-bounce">
            {recentFlash}
          </div>
        )}

        {/* Team & Score */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              Target: {meta.target} • 2nd Innings
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {meta.team2}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-rose-500 font-mono tracking-tight">
                {currentRuns}/{currentWickets}
              </span>
              <span className="text-sm font-bold text-slate-400 font-mono">
                ({currentBall.over + 1}.{currentBall.ball} ov)
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Need to Win</div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
              {runsNeeded <= 0 ? "Target Achieved!" : `${runsNeeded} off ${ballsRemaining}b`}
            </div>
          </div>
        </div>

        {/* Rates & Win Probability Bar */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center mb-4">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">CRR</div>
            <div className="text-xs sm:text-sm font-bold text-slate-200 font-mono">{crr}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">RRR</div>
            <div className="text-xs sm:text-sm font-bold text-amber-400 font-mono">{rrr}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Win Prob (IND)</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">{winProb}%</div>
          </div>
        </div>

        {/* Win Probability Linear Progress */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${winProb}%` }}
          />
        </div>

        {/* On-Crease Batters & Bowler */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center justify-between bg-slate-800/40 px-3 py-2 rounded-lg">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {currentBall.batter}*
            </span>
            <span className="font-mono text-slate-400">On Strike</span>
          </div>

          <div className="flex items-center justify-between bg-slate-800/40 px-3 py-2 rounded-lg">
            <span className="font-medium text-slate-300">Bowler: {currentBall.bowler}</span>
            <span className="font-mono text-slate-400">Pace</span>
          </div>
        </div>
      </div>

      {/* Live Ball-by-Ball Ticker */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Current Over Delivery Feed
          </h3>

          <div className="flex items-center gap-1.5">
            {recentBalls.map((b, idx) => {
              const isCurrent = idx === recentBalls.length - 1;
              const isWicket = b.wicket;
              const isBoundary = b.runs >= 4;

              return (
                <div
                  key={idx}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-transform ${
                    isCurrent ? "scale-110 ring-2 ring-rose-400" : ""
                  } ${
                    isWicket
                      ? "bg-rose-600 text-white"
                      : isBoundary
                      ? "bg-emerald-600 text-white"
                      : b.runs === 0
                      ? "bg-slate-800 text-slate-400 border border-slate-700"
                      : "bg-slate-700 text-slate-200"
                  }`}
                >
                  {isWicket ? "W" : b.runs}
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest Ball Commentary Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-rose-400">
              Ball {currentBall.over + 1}.{currentBall.ball}:
            </span>
            <span className="text-xs font-semibold text-slate-300">
              {currentBall.bowler} to {currentBall.batter}
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {currentBall.commentary}
          </p>
        </div>

        {/* Simulator Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlayingAuto(!isPlayingAuto)}
              disabled={isMatchFinished}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isPlayingAuto
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {isPlayingAuto ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Live Feed</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Auto-Play Feed (4s)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStepNext}
              disabled={isMatchFinished}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Next Ball</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToLiveStart}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Over 14.2</span>
          </button>
        </div>
      </div>

      {/* Simulated Dream11 Watch-Along Chat Teaser */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            Creator Watch-Along Room (108,420 fans live)
          </span>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
            Synced (Zero Spoilers)
          </span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/60">
            <strong className="text-rose-400">R Ashwin:</strong> &ldquo;Tilak playing the spin down the ground rather than sweeping was the tactical masterstroke.&rdquo;
          </div>
          <div className="text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/40">
            <strong className="text-blue-400">CricketFan99:</strong> &ldquo;Thank god I caught up on that 10th over, didn&apos;t know Sodhi got 2 in 4 balls!&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
};
