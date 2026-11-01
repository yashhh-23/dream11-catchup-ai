"use client";

import React, { useState, useEffect, useMemo } from "react";
import { MatchMeta, SpoilerLevel } from "@/types";
import { Lock, ArrowRight, SlidersHorizontal, Clock, BellOff, Sparkles, ShieldCheck, X, CheckCircle2 } from "lucide-react";

interface SpoilerGateProps {
  meta: MatchMeta;
  onCatchUp: (
    fromOver: number,
    toOver: number,
    spoilerLevel?: SpoilerLevel,
    isWholeMatch?: boolean,
    holdAlerts?: boolean
  ) => void;
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
  const [showGuaranteeModal, setShowGuaranteeModal] = useState<boolean>(false);

  const timePresets = useMemo(() => {
    const live = meta.currentLiveOver;
    const calcOver = (minsAway: number) => {
      const oversAway = Math.round(minsAway / 4.2);
      return Math.max(1, Math.floor(live) - oversAway);
    };
    const p15 = calcOver(15);
    const p30 = calcOver(30);
    const p45 = calcOver(45);
    return [
      { id: "15m", label: "~15 mins", startOver: p15, desc: `From ov ${p15}`, isWhole: false },
      { id: "30m", label: "~30 mins", startOver: p30, desc: `From ov ${p30}`, isWhole: false },
      { id: "45m", label: "~45 mins", startOver: p45, desc: `From ov ${p45}`, isWhole: false },
      { id: "whole", label: "Whole match", startOver: 1, desc: "From ov 1", isWhole: true },
    ];
  }, [meta.currentLiveOver]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dream11_dnd_shield");
      if (stored !== null) {
        setDndShieldActive(stored === "true");
      }
    } catch {}
  }, []);

  const handleToggleDnd = () => {
    setDndShieldActive(prev => {
      const next = !prev;
      try {
        localStorage.setItem("dream11_dnd_shield", String(next));
      } catch {}
      return next;
    });
  };

  const missedOversCount = Math.max(1, Math.floor(liveTargetOver) - selectedStartOver + 1);
  const readTimeEstimate = missedOversCount <= 5 ? "about 30 sec" : missedOversCount <= 10 ? "about 45 sec" : "about 1 min";

  const handleStartCatchUp = () => {
    const fromIndex = Math.max(0, selectedStartOver - 1);
    onCatchUp(fromIndex, liveTargetOver, spoilerLevel, isWholeMatchSelected, dndShieldActive);
  };

  const handleTimeSelect = (item: { id: string; label: string; startOver: number; desc: string; isWhole: boolean }) => {
    setSelectedStartOver(item.startOver);
    setIsWholeMatchSelected(item.isWhole);
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
              {
                code: meta.team1 ? meta.team1.slice(0, 3).toUpperCase() : "TM1",
                name: meta.team1,
                score: meta.target ? `${meta.target - 1}/7` : "1st Innings",
                over: "(20.0)",
                badgeBg: "bg-slate-800 border-slate-700 text-slate-300",
                masked: false,
              },
              {
                code: meta.team2 ? meta.team2.slice(0, 3).toUpperCase() : "TM2",
                name: meta.team2,
                score: "••• / •",
                over: `(${meta.currentLiveOver} ov)`,
                badgeBg: "bg-blue-900 border-blue-800 text-blue-200",
                masked: true,
              },
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
              {timePresets.map((item) => {
                const isSelected = item.isWhole ? isWholeMatchSelected : selectedStartOver === item.startOver && !isWholeMatchSelected;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTimeSelect(item)}
                    className={`p-2.5 rounded-chip text-xs text-left border transition-colors ${
                      isSelected
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-brand-bg border-brand-border hover:bg-brand-surfaceHover text-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </button>
                );
              })}
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
                  <label htmlFor="fine-tune-start-over" className="text-xs text-slate-300">
                    Start catch-up at:
                  </label>
                  <span className="font-semibold text-white">Over {selectedStartOver}</span>
                </div>
                <input
                  id="fine-tune-start-over"
                  type="range"
                  aria-label="Fine-tune start over"
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
                <span>Spoiler-Free Thrill Indicator</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200">High Leverage</span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Multiple lead changes across the chase. Catch up safely from ball one without knowing the final winner.
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
            role="switch"
            aria-checked={dndShieldActive}
            onClick={handleToggleDnd}
            aria-label="Toggle lock screen spoilers shield"
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
          <button
            type="button"
            onClick={() => setShowGuaranteeModal(true)}
            className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span className="underline decoration-dotted underline-offset-2">Zero Spoilers Guaranteed</span>
          </button>
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

      {/* Zero-Spoiler Guarantee Modal */}
      {showGuaranteeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-surface border border-brand-border rounded-container max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm text-white">Zero-Spoiler Guarantee</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuaranteeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-chip"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Dream11 CatchUp AI uses 4 strict privacy and containment layers so you can catch up on your own terms without premature score leaks:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>1. Server-Only Bundle Isolation</span>
                </div>
                <p className="text-slate-400 text-[11px] pl-5 leading-normal">
                  All future match deliveries reside strictly in server memory (<code className="text-slate-300">server-only</code>) and are never bundled into client JavaScript.
                </p>
              </div>

              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>2. Cryptographic Live Delivery Clock</span>
                </div>
                <p className="text-slate-400 text-[11px] pl-5 leading-normal">
                  Live feed advances require HMAC-signed session tokens and rate-limiting. Premature API queries return 403 Forbidden.
                </p>
              </div>

              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>3. Server-Side Score Redaction</span>
                </div>
                <p className="text-slate-400 text-[11px] pl-5 leading-normal">
                  In &ldquo;Story-Only&rdquo; mode, numbers and live outcomes are stripped on the server before AI generation and chart rendering.
                </p>
              </div>

              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>4. DND Notification Shield</span>
                </div>
                <p className="text-slate-400 text-[11px] pl-5 leading-normal">
                  Mutes lock-screen notifications and push teasers until you finish reading and tap &ldquo;Jump to Live&rdquo;.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuaranteeModal(false)}
              className="w-full py-2 rounded-chip bg-brand-red hover:bg-brand-redHover text-white text-xs font-semibold transition-colors mt-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
