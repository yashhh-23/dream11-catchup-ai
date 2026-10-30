"use client";

import React, { useState } from "react";
import { MatchMeta } from "@/types";
import { ShieldAlert, Sparkles, Play, EyeOff, Radio, Clock } from "lucide-react";

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
  // Current match is at Over 14.2 (i.e. over index 14)
  const currentOverCeil = Math.ceil(meta.currentLiveOver); // 15
  const currentOverIndex = Math.floor(meta.currentLiveOver); // 14

  // Default: fan missed from Over 6 (index 5) to Over 14
  const [fromOverDisplay, setFromOverDisplay] = useState<number>(6);

  // Edge cases
  const isZeroMissed = fromOverDisplay >= currentOverCeil;
  const missedOversCount = Math.max(0, currentOverCeil - fromOverDisplay);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setFromOverDisplay(val);
  };

  const handleStartCatchUp = () => {
    if (isZeroMissed || isLoading) return;
    // convert 1-based display to 0-based over index
    const fromIndex = Math.max(0, fromOverDisplay - 1);
    const toIndex = currentOverIndex;
    onCatchUp(fromIndex, toIndex);
  };

  const handleQuickPreset = (startOver: number) => {
    setFromOverDisplay(startOver);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col items-center animate-fadeIn">
      {/* Dream11 Rhea Live Banner */}
      <div className="w-full flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-rose-950/50">
            D
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-rose-500 font-extrabold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
              Dream11 Second Screen
            </span>
            <h1 className="text-sm font-semibold text-slate-200">CatchUp AI Companion</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          LIVE MATCH
        </div>
      </div>

      {/* Main Match Card with Shielded Live Score */}
      <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Match Header */}
        <div className="text-center mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            {meta.title}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <span>{meta.venue}</span>
            <span>•</span>
            <span>Target: {meta.target}</span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-100">{meta.team1}</div>
              <div className="text-xs text-slate-400 font-mono">177/7 (20.0)</div>
            </div>
            <div className="text-xs font-extrabold text-slate-500 bg-slate-800 px-2 py-1 rounded">
              VS
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-100">{meta.team2}</div>
              {/* SHIELDED SCORE */}
              <div className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1 bg-rose-950/40 border border-rose-500/30 rounded-full text-rose-300 text-xs font-medium animate-pulse">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Score Shielded</span>
              </div>
            </div>
          </div>
        </div>

        {/* The Spoiler Shield Box */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                You just tuned in late at Over {meta.currentLiveOver}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Don&apos;t get spoiled by raw scorecards or WhatsApp groups. Let Rhea AI brief you in 45 seconds on key wickets, momentum swings, and pitch conditions before jumping to live.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Over Slider */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Where did you stop watching?
            </span>
            <span className="font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
              {fromOverDisplay === 1 ? "Start of match (Over 1)" : `Over ${fromOverDisplay}`}
            </span>
          </div>

          <div className="relative pt-1">
            <input
              type="range"
              min={1}
              max={currentOverCeil}
              step={1}
              value={fromOverDisplay}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-none"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-mono">
              <span>Over 1 (Match Start)</span>
              <span>Over 6 (PP)</span>
              <span>Over 10 (Mid)</span>
              <span>Over {currentOverCeil} (Live)</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-[11px] text-slate-500">Quick picks:</span>
            <button
              type="button"
              onClick={() => handleQuickPreset(1)}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Missed All (Ovs 1–14)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(6)}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Post-Powerplay (Ovs 6–14)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(10)}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Middle Drama (Ovs 10–14)
            </button>
          </div>
        </div>

        {/* Dynamic Catch-up Action Button */}
        {isZeroMissed ? (
          <div className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-300 mb-3">
            You are fully caught up with the live over! Click below to jump straight in.
          </div>
        ) : (
          <div className="text-xs text-slate-400 mb-4 flex items-center justify-between px-1">
            <span>
              Delta to summarize: <strong className="text-slate-200">{missedOversCount} overs</strong>
            </span>
            <span className="text-rose-400 font-medium">~45 sec read/audio</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleStartCatchUp}
          disabled={isZeroMissed || isLoading}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            isZeroMissed || isLoading
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/40 hover:scale-[1.01] active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Synthesizing Context with Rhea AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Catch Me Up ({fromOverDisplay} → {currentOverCeil})</span>
            </>
          )}
        </button>

        {/* Bypass / Unshield CTA */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onJumpToLiveDirect}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5"
          >
            <span>I don&apos;t mind spoilers — Jump straight to Live Score</span>
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
