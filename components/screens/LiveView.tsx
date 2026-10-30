"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta } from "@/types";
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

export const LiveView: React.FC<LiveViewProps> = ({
  meta,
  balls,
  onBackToRecap,
  onResetToGate,
}) => {
  // Initial live ball index in `balls` array: Over 14, ball 2
  const initialLiveIndex = Math.max(
    0,
    balls.findIndex((b) => b.over === 14 && b.ball === 2)
  );

  const [currentIndex, setCurrentIndex] = useState<number>(
    initialLiveIndex !== -1 ? initialLiveIndex : 85
  );
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(true);
  const [showDemoControls, setShowDemoControls] = useState<boolean>(false);

  const currentBall = balls[currentIndex] || balls[balls.length - 1];
  const isMatchFinished = currentIndex >= balls.length - 1;

  // Auto-advance simulated live match every 4.5 seconds
  useEffect(() => {
    if (!isPlayingAuto || isMatchFinished) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < balls.length - 1) {
          return prev + 1;
        }
        setIsPlayingAuto(false);
        return prev;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [isPlayingAuto, isMatchFinished, balls]);

  const handleStepNext = () => {
    if (currentIndex < balls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleResetToLiveStart = () => {
    setCurrentIndex(initialLiveIndex !== -1 ? initialLiveIndex : 85);
  };

  // Compute live match metrics
  const totalTarget = meta.target;
  const currentRuns = currentBall.cumulativeScore;
  const currentWickets = currentBall.cumulativeWickets;
  const runsNeeded = Math.max(0, totalTarget - currentRuns);

  const ballsCompleted = (currentBall.over * 6) + currentBall.ball;
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);

  const crr = ballsCompleted > 0 ? ((currentRuns / ballsCompleted) * 6).toFixed(2) : "0.0";
  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.0";
  const winProb = Math.round(currentBall.winProbability * 100);

  // Clean commentary of any debug strings
  const cleanCommentary = currentBall.commentary
    .replace(/\(CURRENT LIVE BALL\)/gi, "")
    .trim();

  // Recent deliveries in the over
  const recentBalls = balls.slice(Math.max(0, currentIndex - 5), currentIndex + 1);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 pb-20">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-4 mb-6 border-b border-[#262C36]">
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
            className="text-xs px-2.5 py-1 rounded-lg bg-[#0E1116] border border-[#262C36] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-[#E11D48]" />
            <span>Recap</span>
          </button>
        </div>
      </header>

      {/* Main Single Flattened Container */}
      <div className="bg-[#161B22] border border-[#262C36] rounded-xl p-5 sm:p-6 space-y-6">
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

          {/* Rates & Win Probability (Clean row without boxed border) */}
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

          {/* Win Probability Progress Bar (Clean single-color bar) */}
          <div className="w-full h-1 bg-[#262C36] rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${winProb}%` }}
            />
          </div>

          {/* Batters & Bowler row */}
          <div className="flex items-center justify-between text-xs text-slate-300 pt-3 border-t border-[#262C36] mt-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{currentBall.batter}*</span>
            </div>
            <div className="text-slate-400">
              Bowler: {currentBall.bowler}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#262C36]" />

        {/* Delivery Feed & Commentary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Current over
            </span>

            {/* Over ball pills (Outcome-based colors: 0 grey, 1-3 neutral, 4 blue, 6 green, W red) */}
            <div className="flex items-center gap-1.5">
              {recentBalls.map((b, idx) => {
                const isCurrent = idx === recentBalls.length - 1;
                const isWicket = b.wicket;
                const isSix = b.runs >= 6;
                const isFour = b.runs >= 4 && b.runs < 6;
                const isDot = b.runs === 0 && !isWicket;

                let colorClasses = "bg-slate-700 text-slate-100";
                if (isWicket) colorClasses = "bg-rose-600 text-white";
                else if (isSix) colorClasses = "bg-emerald-600 text-white";
                else if (isFour) colorClasses = "bg-blue-600 text-white";
                else if (isDot) colorClasses = "bg-slate-800 text-slate-400 border border-slate-700";

                return (
                  <div
                    key={idx}
                    className={`w-6 h-6 rounded-full flex items-center justify-center tabular-nums text-xs font-semibold transition-all ${colorClasses} ${
                      isCurrent ? "ring-2 ring-white ring-offset-1 ring-offset-[#161B22]" : ""
                    }`}
                  >
                    {isWicket ? "W" : b.runs}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commentary Block */}
          <div className="p-3.5 rounded-lg bg-[#0E1116] border border-[#262C36] space-y-1 text-xs">
            <div className="font-semibold text-slate-300">
              Over {currentBall.over}.{currentBall.ball} · {currentBall.bowler} to {currentBall.batter}
            </div>
            <p className="text-slate-300 leading-relaxed">
              {cleanCommentary}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#262C36]" />

        {/* Creator Watch-Along (List layout with avatars, no boxed rows) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Creator watch-along · 108k fans live
            </span>
            <span className="text-emerald-400">Zero spoilers</span>
          </div>

          <div className="divide-y divide-[#262C36] text-xs">
            <div className="flex items-start gap-2.5 py-2">
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-300 shrink-0">
                RA
              </div>
              <div>
                <span className="font-semibold text-slate-200">R Ashwin: </span>
                <span className="text-slate-300">
                  Tilak playing the spin down the ground rather than sweeping was the tactical masterstroke.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 py-2">
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-300 shrink-0">
                CF
              </div>
              <div>
                <span className="font-semibold text-slate-200">CricketFan99: </span>
                <span className="text-slate-300">
                  Thank god I caught up on that 10th over, didn&apos;t know Sodhi got 2 in 4 balls!
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Controls: Placed behind subtle toggle in corner */}
        <div className="pt-2 border-t border-[#262C36] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDemoControls(!showDemoControls)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{showDemoControls ? "Hide demo controls" : "Demo controls"}</span>
          </button>

          {showDemoControls && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlayingAuto(!isPlayingAuto)}
                disabled={isMatchFinished}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0E1116] border border-[#262C36] text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
              >
                {isPlayingAuto ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Play (4s)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleStepNext}
                disabled={isMatchFinished}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0E1116] border border-[#262C36] text-slate-300 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <SkipForward className="w-3 h-3" />
                <span>Next ball</span>
              </button>

              <button
                type="button"
                onClick={handleResetToLiveStart}
                className="text-xs text-slate-400 hover:text-white p-1"
                title="Reset to Over 14.2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
