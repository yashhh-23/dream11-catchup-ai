"use client";

import React, { useState } from "react";
import { MatchMeta } from "@/types";
import { SlidersHorizontal, Lock, ArrowRight, Loader2 } from "lucide-react";

interface SpoilerGateProps {
  meta: MatchMeta;
  onCatchUp: (fromOver: number, toOver: number) => void;
  onJumpToLiveDirect: () => void;
  isLoading: boolean;
}

export const SpoilerGate: React.FC<SpoilerGateProps> = ({
  meta,
  onCatchUp,
  onJumpToLiveDirect,
  isLoading,
}) => {
  // Live point is Over 14.2 (14 completed overs, 2 balls into over 15)
  const liveTargetOver = meta.currentLiveOver; // 14.2

  // Presets: start over (1-based display number)
  const [selectedStartOver, setSelectedStartOver] = useState<number>(6);
  const [showCustomSlider, setShowCustomSlider] = useState<boolean>(false);

  const missedOversCount = Math.max(1, Math.floor(liveTargetOver) - selectedStartOver + 1);
  const readTimeEstimate = missedOversCount <= 5 ? "about 30 sec" : missedOversCount <= 10 ? "about 45 sec" : "about 1 min";

  const handleStartCatchUp = () => {
    if (isLoading) return;
    const fromIndex = Math.max(0, selectedStartOver - 1);
    // Slice right up to current live delivery (14.2) to eliminate the two-ball gap
    onCatchUp(fromIndex, liveTargetOver);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-12">
      {/* Simplified, uncluttered header */}
      <header className="flex items-center justify-between pb-4 mb-6 border-b border-[#262C36]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E11D48] flex items-center justify-center font-bold text-white text-sm">
            D
          </div>
          <span className="font-semibold text-sm text-[#F0F6FC]">
            Catch up
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live</span>
        </div>
      </header>

      {/* Single flattened container */}
      <div className="bg-[#161B22] border border-[#262C36] rounded-xl p-5 sm:p-6 space-y-6">
        {/* Match Details & Cricbuzz-style Two-Column Scorecard */}
        <div>
          <div className="text-xs text-slate-400 mb-3">
            {meta.title} · {meta.venue}
          </div>

          <div className="space-y-2.5">
            {/* Team 1: New Zealand */}
            <div className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-3.5 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                  NZ
                </span>
                <span className="font-medium text-[#F0F6FC]">{meta.team1}</span>
              </div>
              <div className="tabular-nums font-semibold text-slate-300">
                177/7 <span className="text-xs text-slate-400 font-normal">(20.0)</span>
              </div>
            </div>

            {/* Team 2: India (Score Shielded) */}
            <div className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-3.5 rounded-sm bg-blue-900 border border-blue-800 flex items-center justify-center text-[10px] font-bold text-blue-200">
                  IND
                </span>
                <span className="font-medium text-[#F0F6FC]">{meta.team2}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold tracking-widest text-slate-400 select-none">
                  ••• / •
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  (14.2 ov)
                </span>
                <span title="Live score shielded">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#262C36] text-xs text-slate-400 flex items-center justify-between">
            <span>Target {meta.target}</span>
            <span>Current over 14.2</span>
          </div>
        </div>

        {/* Human explanation line */}
        <div className="text-sm text-slate-200">
          You joined at over 14.2. Pick where you left off.
        </div>

        {/* Primary Controls: Quick Chips */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedStartOver(6)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                selectedStartOver === 6
                  ? "bg-[#E11D48] text-white border-[#E11D48]"
                  : "bg-[#0E1116] text-slate-300 border-[#262C36] hover:bg-[#1C2128]"
              }`}
            >
              <div className="font-semibold">Post-Powerplay</div>
              <div className="text-[11px] opacity-80">From over 6</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStartOver(10)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                selectedStartOver === 10
                  ? "bg-[#E11D48] text-white border-[#E11D48]"
                  : "bg-[#0E1116] text-slate-300 border-[#262C36] hover:bg-[#1C2128]"
              }`}
            >
              <div className="font-semibold">Middle overs</div>
              <div className="text-[11px] opacity-80">From over 10</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStartOver(1)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                selectedStartOver === 1
                  ? "bg-[#E11D48] text-white border-[#E11D48]"
                  : "bg-[#0E1116] text-slate-300 border-[#262C36] hover:bg-[#1C2128]"
              }`}
            >
              <div className="font-semibold">Full match</div>
              <div className="text-[11px] opacity-80">From over 1</div>
            </button>
          </div>

          {/* Optional Slider as an 'Adjust' toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustomSlider(!showCustomSlider)}
              className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showCustomSlider ? "Hide custom slider" : "Adjust exact over"}</span>
            </button>

            {showCustomSlider && (
              <div className="mt-3 p-3 bg-[#0E1116] border border-[#262C36] rounded-lg space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Start catch-up at:</span>
                  <span className="font-semibold text-white">Over {selectedStartOver}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.floor(liveTargetOver)}
                  step={1}
                  value={selectedStartOver}
                  onChange={(e) => setSelectedStartOver(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-[#262C36] rounded-lg appearance-none cursor-pointer accent-[#E11D48]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Over 1</span>
                  <span>Over {Math.floor(liveTargetOver)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Read time summary line */}
        <div className="text-xs text-slate-400 flex items-center justify-between pt-2">
          <span>{missedOversCount} overs · {readTimeEstimate}</span>
          <span className="text-slate-400">Spoiler-free</span>
        </div>

        {/* Primary Action Button (Flat fill, no glow) */}
        <button
          type="button"
          onClick={handleStartCatchUp}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-[#E11D48] hover:bg-[#BE123C] text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating recap...</span>
            </>
          ) : (
            <>
              <span>Catch me up (Overs {selectedStartOver}–{liveTargetOver})</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Clear, readable escape hatch */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onJumpToLiveDirect}
            className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
          >
            I don&apos;t mind spoilers — Jump straight to live score
          </button>
        </div>
      </div>
    </div>
  );
};
