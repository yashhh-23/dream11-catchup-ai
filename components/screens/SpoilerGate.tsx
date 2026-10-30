"use client";

import React, { useState, useEffect } from "react";
import { MatchMeta, SpoilerLevel } from "@/types";
import { Lock, ArrowRight, SlidersHorizontal, Clock, BellOff, Sparkles, ShieldCheck } from "lucide-react";

interface SpoilerGateProps {
  meta: MatchMeta;
  onCatchUp: (fromOver: number, toOver: number, spoilerLevel?: SpoilerLevel, isWholeMatch?: boolean) => void;
  onJumpToLiveDirect: () => void;
}

const PRESETS = [
  { id: 6, title: "Post-Powerplay", desc: "From over 6", isWhole: false },
  { id: 10, title: "Middle overs", desc: "From over 10", isWhole: false },
  { id: 1, title: "Full match", desc: "From over 1 (Start)", isWhole: true },
] as const;

export const SpoilerGate: React.FC<SpoilerGateProps> = ({
  meta,
  onCatchUp,
  onJumpToLiveDirect,
}) => {
  const liveTargetOver = meta.currentLiveOver;

  // Start over (1-based display number)
  const [selectedStartOver, setSelectedStartOver] = useState<number>(6);
  const [showCustomSlider, setShowCustomSlider] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<"time" | "overs">("overs");
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>("story-and-score");
  const [dndShieldActive, setDndShieldActive] = useState<boolean>(true);
  const [isWholeMatchSelected, setIsWholeMatchSelected] = useState<boolean>(false);

  // Prefetch default recap window (6 -> liveTargetOver) on gate load to make click instant
  useEffect(() => {
    fetch("/api/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: meta.matchId,
        fromOver: 5,
        toOver: liveTargetOver,
        spoilerLevel: "story-and-score",
      }),
    }).catch(() => {});
  }, [meta.matchId, liveTargetOver]);

  const missedOversCount = Math.max(1, Math.floor(liveTargetOver) - selectedStartOver + 1);
  const readTimeEstimate = missedOversCount <= 5 ? "about 30 sec" : missedOversCount <= 10 ? "about 45 sec" : "about 1 min";

  const handleStartCatchUp = () => {
    const fromIndex = Math.max(0, selectedStartOver - 1);
    onCatchUp(fromIndex, liveTargetOver, spoilerLevel, isWholeMatchSelected);
  };

  const handleTimeSelect = (minutes: number) => {
    const oversMissed = Math.round(minutes / 4.2);
    const calculatedStart = Math.max(1, Math.floor(liveTargetOver) - oversMissed);
    setSelectedStartOver(calculatedStart);
    setIsWholeMatchSelected(false);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 mb-6 border-b border-brand-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-chip bg-brand-red flex items-center justify-center font-bold text-white text-sm">
            D
          </div>
          <span className="font-semibold text-sm text-[#F0F6FC]">
            Dream11 CatchUp AI
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live · Over {meta.currentLiveOver}</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="bg-brand-surface border border-brand-border rounded-container p-5 sm:p-6 space-y-6">
        {/* Match Details & Two-Column Scorecard */}
        <div>
          <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
            <span>{meta.title} · {meta.venue}</span>
            <span className="text-[11px] bg-brand-bg text-slate-300 px-2 py-0.5 rounded-chip border border-brand-border">
              Zero-Spoiler Shield
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              { code: "NZ", name: meta.team1, score: "177/7", over: "(20.0)", badgeBg: "bg-slate-800 border-slate-700 text-slate-300", masked: false },
              { code: "IND", name: meta.team2, score: "••• / •", over: `(${meta.currentLiveOver} ov)`, badgeBg: "bg-blue-900 border-blue-800 text-blue-200", masked: true },
            ].map((team, idx) => (
              <div
                key={team.code}
                className={`flex items-center justify-between text-sm py-1 ${idx > 0 ? "border-t border-brand-border" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] font-bold ${team.badgeBg}`}>
                    {team.code}
                  </span>
                  <span className="font-medium text-[#F0F6FC]">{team.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`tabular-nums font-semibold ${team.masked ? "tracking-widest text-slate-400 select-none" : "text-slate-300"}`}>
                    {team.score}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    {team.over}
                  </span>
                  {team.masked && (
                    <span title="Live score shielded to preserve match tension">
                      <Lock className="w-3.5 h-3.5 text-brand-red" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-brand-border text-xs text-slate-400 flex items-center justify-between">
            <span>Target {meta.target}</span>
            <span>Live point {meta.currentLiveOver} ov</span>
          </div>
        </div>

        {/* Input Selector Mode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Where did you leave off?
            </span>
            <div className="flex items-center gap-1 bg-brand-bg p-0.5 rounded-chip border border-brand-border text-[11px]">
              <button
                type="button"
                onClick={() => setInputMode("overs")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  inputMode === "overs" ? "bg-brand-border text-white font-medium" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                By over
              </button>
              <button
                type="button"
                onClick={() => setInputMode("time")}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  inputMode === "time" ? "bg-brand-border text-white font-medium" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Time away</span>
              </button>
            </div>
          </div>

          {inputMode === "overs" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {PRESETS.map((p) => {
                const isSelected = p.isWhole ? isWholeMatchSelected : selectedStartOver === p.id && !isWholeMatchSelected;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedStartOver(p.id);
                      setIsWholeMatchSelected(p.isWhole);
                    }}
                    className={`px-3 py-2.5 rounded-chip text-xs font-medium text-left transition-colors border ${
                      isSelected
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-brand-bg text-slate-300 border-brand-border hover:bg-brand-surfaceHover"
                    }`}
                  >
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-[11px] opacity-80">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { label: "~15 mins", mins: 15, overDesc: "Around ov 11" },
                { label: "~30 mins", mins: 30, overDesc: "Around ov 8" },
                { label: "~45 mins", mins: 45, overDesc: "Around ov 5" },
                { label: "Whole match", mins: 90, overDesc: "From ov 1" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleTimeSelect(item.mins)}
                  className="p-2.5 rounded-chip text-xs text-left bg-brand-bg border border-brand-border hover:bg-brand-surfaceHover text-slate-300 transition-colors"
                >
                  <div className="font-semibold text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-400">{item.overDesc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Slider for fine tuning */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCustomSlider(!showCustomSlider)}
              className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showCustomSlider ? "Hide fine adjustment" : "Fine-tune starting over"}</span>
            </button>

            {showCustomSlider && (
              <div className="mt-2.5 p-3 bg-brand-bg border border-brand-border rounded-chip space-y-2">
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
                  onChange={(e) => {
                    setSelectedStartOver(parseInt(e.target.value, 10));
                    setIsWholeMatchSelected(parseInt(e.target.value, 10) === 1);
                  }}
                  className="w-full h-1.5 bg-brand-border rounded-chip appearance-none cursor-pointer accent-brand-red"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Over 1</span>
                  <span>Over {Math.floor(liveTargetOver)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thrill Rating Preview */}
        {isWholeMatchSelected && (
          <div className="p-3 rounded-chip bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <span>Spoiler-Free Thrill Rating: 9.4 / 10</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200">Replay Worthy</span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Went down to the wire with 3 dramatic momentum flips. Highly recommended to catch up or watch!
              </p>
            </div>
          </div>
        )}

        {/* Spoiler Levels */}
        <div className="space-y-2 pt-1 border-t border-brand-border">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Spoiler protection level:</span>
            <span className="text-[11px] text-slate-400 capitalize">{spoilerLevel.replace(/-/g, " ")}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { id: "story-only", title: "Story only", desc: "No scores at all" },
              { id: "story-and-score", title: "Story + Phase", desc: "Score at phase end" },
              { id: "full", title: "Full Context", desc: "Full breakdown" },
            ].map(lvl => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setSpoilerLevel(lvl.id as SpoilerLevel)}
                className={`p-2 rounded-chip text-left border transition-colors ${
                  spoilerLevel === lvl.id
                    ? "bg-brand-border border-slate-500 text-white"
                    : "bg-brand-bg border-brand-border text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="font-medium text-slate-200 text-[11px]">{lvl.title}</div>
                <div className="text-[10px] text-slate-400">{lvl.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Lock Screen DND Shield */}
        <div className="p-3 rounded-chip bg-brand-bg border border-brand-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {dndShieldActive ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <BellOff className="w-4 h-4 text-slate-400" />
            )}
            <div>
              <div className="font-medium text-slate-200">Hold back lock screen spoilers</div>
              <div className="text-[10px] text-slate-400">Pause live push alerts until you catch up</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDndShieldActive(!dndShieldActive)}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
              dndShieldActive ? "bg-brand-red" : "bg-slate-700"
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
              dndShieldActive ? "translate-x-4" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Read time summary line */}
        <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
          <span>{missedOversCount} overs · {readTimeEstimate}</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Zero Spoilers Guaranteed</span>
          </span>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleStartCatchUp}
          className="w-full py-3 px-4 rounded-container font-semibold text-sm bg-brand-red hover:bg-brand-redHover text-white transition-colors flex items-center justify-center gap-2"
        >
          <span>Catch me up (Overs {selectedStartOver}–{liveTargetOver})</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Escape Hatch */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onJumpToLiveDirect}
            className="text-xs text-slate-300 hover:text-white underline underline-offset-4 transition-colors font-medium"
          >
            I don&apos;t mind spoilers · Jump directly to live match
          </button>
        </div>
      </div>
    </div>
  );
};
