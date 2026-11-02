"use client";

import React, { useState, useMemo } from "react";
import { Ball, SpoilerLevel } from "@/types";
import { findWindowIndices, EVENT_STYLE, classifyBall } from "@/lib/matchUtils";
import { X, ShieldCheck } from "lucide-react";

interface WinProbChartProps {
  balls: Ball[];
  missedFromOver: number;
  missedToOver: number;
  spoilerLevel?: SpoilerLevel;
  teamName?: string;
}

interface ChartDot {
  idx: number;
  cx: number;
  cy: number;
  kind: "wicket" | "six" | "four" | "dot" | "run";
}

export const WinProbChart: React.FC<WinProbChartProps> = ({
  balls,
  missedFromOver,
  missedToOver,
  spoilerLevel,
  teamName,
}) => {
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Guard against empty balls array during asynchronous data loading (Race Condition Fix)
  if (!balls || balls.length === 0) {
    return (
      <div className="w-full h-[180px] rounded-card bg-brand-surface border border-brand-border flex flex-col items-center justify-center p-4 text-center">
        <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading win probability momentum curve...</p>
      </div>
    );
  }

  const isStoryOnly = spoilerLevel === "story-only";

  const width = 600;
  const height = 180;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const totalBalls = balls.length;

  const getX = (idx: number) => padLeft + (idx / Math.max(1, totalBalls - 1)) * chartW;
  const getY = (prob: number) => padTop + chartH - prob * chartH;

  const {
    pathD,
    windowX1,
    windowW,
    significantDots,
    xTicks,
  } = useMemo(() => {
    // In story-only mode, calculate a smoothed narrative flow line that dampens individual delivery shocks
    // to prevent visual cliff drops from spoiling wickets
    const points = balls.map((b, i) => {
      let prob = b.winProbability;
      if (isStoryOnly) {
        // 7-ball rolling smoothed momentum dampened toward equilibrium
        const windowStart = Math.max(0, i - 3);
        const windowEnd = Math.min(balls.length - 1, i + 3);
        let sum = 0;
        for (let k = windowStart; k <= windowEnd; k++) {
          sum += balls[k].winProbability;
        }
        const avg = sum / (windowEnd - windowStart + 1);
        prob = 0.5 + (avg - 0.5) * 0.35;
      }
      return `${getX(i).toFixed(1)},${getY(prob).toFixed(1)}`;
    });
    const path = `M ${points.join(" L ")}`;

    const { startIdx, endIdx } = findWindowIndices(balls, missedFromOver, missedToOver);
    const safeEndIdx = Math.max(startIdx, endIdx > startIdx ? endIdx - 1 : startIdx);

    const wX1 = getX(startIdx);
    const wX2 = getX(safeEndIdx);
    const wW = Math.max(0, wX2 - wX1);

    // Only create dot objects for true key events (wickets, sixes, fours, window boundaries)
    // Avoids 13-field objects for every single delivery (Optimization E)
    const sigDots: ChartDot[] = [];
    if (isStoryOnly) {
      // In story-only mode, only mark window boundaries and major phase transitions
      // NEVER create individual wicket (red) or boundary (green/blue) markers!
      if (balls.length > 0) {
        sigDots.push({ idx: startIdx, cx: getX(startIdx), cy: getY(0.5), kind: "dot" });
        if (safeEndIdx > startIdx) {
          const midIdx = Math.floor((startIdx + safeEndIdx) / 2);
          sigDots.push({ idx: midIdx, cx: getX(midIdx), cy: getY(0.5), kind: "dot" });
          sigDots.push({ idx: safeEndIdx, cx: getX(safeEndIdx), cy: getY(0.5), kind: "dot" });
        }
      }
    } else {
      for (let idx = 0; idx < balls.length; idx++) {
        const b = balls[idx];
        const kind = classifyBall(b);
        const isKey = kind === "wicket" || kind === "six" || kind === "four" || idx === startIdx || idx === safeEndIdx;
        if (isKey) {
          sigDots.push({
            idx,
            cx: getX(idx),
            cy: getY(b.winProbability),
            kind,
          });
        }
      }
    }

    // Dynamic X-axis ticks (Bug 31)
    const maxOver = balls.length > 0 ? balls[balls.length - 1].over : 20;
    const step = maxOver <= 10 ? 2 : maxOver <= 15 ? 3 : 5;
    const ticks: { label: string; x: number }[] = [];
    for (let ov = 1; ov <= maxOver + 1; ov += step) {
      const ballIdx = Math.min((ov - 1) * 6, totalBalls - 1);
      ticks.push({ label: `Ov ${ov}`, x: getX(ballIdx) });
    }
    if (ticks.length > 0 && ticks[ticks.length - 1].x < padLeft + chartW - 25) {
      ticks.push({ label: `Ov ${maxOver + 1}`, x: getX(totalBalls - 1) });
    }

    return {
      pathD: path,
      windowX1: wX1,
      windowW: wW,
      significantDots: sigDots,
      xTicks: ticks,
    };
  }, [balls, missedFromOver, missedToOver, totalBalls]);

  const activeIdx = pinnedIdx ?? hoveredIdx;
  
  // Derive full details only on-demand for the single active ball (Optimization E)
  // In story-only mode, scores and exact delivery numbers are strictly shielded
  const activePoint = useMemo(() => {
    if (activeIdx === null || !balls[activeIdx]) return null;
    const b = balls[activeIdx];
    const kind = classifyBall(b);
    return {
      idx: activeIdx,
      overText: isStoryOnly ? "Key Delivery" : `Over ${b.over}.${b.ball}`,
      prob: isStoryOnly ? null : Math.round(b.winProbability * 100),
      score: isStoryOnly ? "Shielded" : `${b.cumulativeScore}/${b.cumulativeWickets}`,
      commentary: b.commentary,
      isWicket: kind === "wicket",
      isSix: kind === "six",
      isFour: kind === "four",
      batter: b.batter,
      bowler: b.bowler,
      runs: b.runs,
      cx: getX(activeIdx),
      cy: getY(b.winProbability),
    };
  }, [activeIdx, balls, totalBalls, isStoryOnly]);

  const displayedCommentary = useMemo(() => {
    if (!activePoint) return "";
    if (!isStoryOnly) return activePoint.commentary;
    return activePoint.commentary
      .replace(/\b\d+\/\d+\b/g, "[score shielded]")
      .replace(/\b\d+\s*(?:runs?|rpo|rrr|balls?|overs?|target)\b/gi, "[shielded]")
      .replace(/\d+/g, "");
  }, [activePoint, isStoryOnly]);

  const handlePointClick = (idx: number) => {
    setPinnedIdx(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="space-y-3">
      {/* Title & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-300">
          Win probability · {teamName || "Chasing Team"}
        </h3>
        {isStoryOnly ? (
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/20 border border-amber-400/50" />
              <span>Missed phase</span>
            </span>
            <span className="flex items-center gap-1 text-indigo-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Story Momentum (Events Shielded)</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/20 border border-amber-400/50" />
              <span>Missed phase</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Wicket</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Six</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Four</span>
            </span>
          </div>
        )}
      </div>

      {/* SVG Graph Canvas */}
      <div className="w-full overflow-hidden rounded-container bg-brand-bg border border-brand-border p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="windowFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Missed Phase Rect */}
          {windowW > 0 && (
            <rect
              x={windowX1}
              y={padTop}
              width={windowW}
              height={chartH}
              fill="url(#windowFill)"
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
          )}

          {/* Horizontal Grid lines */}
          {[0.25, 0.5, 0.75].map((level) => {
            const y = padTop + chartH - level * chartH;
            return (
              <g key={level}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + chartW}
                  y2={y}
                  stroke="#262C36"
                  strokeDasharray="2 2"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  fontSize={9}
                  fill="#64748b"
                  textAnchor="end"
                  className="font-mono tabular-nums"
                >
                  {spoilerLevel === "story-only"
                    ? (level === 0.75 ? "Bat" : level === 0.5 ? "Even" : "Bowl")
                    : `${Math.round(level * 100)}%`}
                </text>
              </g>
            );
          })}

          {/* X Axis ticks */}
          {xTicks.map((tick) => (
            <text
              key={tick.label}
              x={tick.x}
              y={padTop + chartH + 15}
              fontSize={9}
              fill="#64748b"
              textAnchor="middle"
              className="font-mono"
            >
              {tick.label}
            </text>
          ))}

          {/* Probability curve path */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Crosshair vertical line */}
          {activePoint && (
            <line
              x1={activePoint.cx}
              y1={padTop}
              x2={activePoint.cx}
              y2={padTop + chartH}
              stroke="#cbd5e1"
              strokeDasharray="2 2"
              strokeWidth={1}
              className="opacity-70 pointer-events-none"
            />
          )}

          {/* Interactive Dots for Key Deliveries (Keyboard & Touch Accessible) */}
          {significantDots.map((point) => {
            const isSelected = activePoint?.idx === point.idx;
            const isPinnedThis = pinnedIdx === point.idx;

            const fillColor = isStoryOnly
              ? "#818cf8"
              : point.kind === "wicket"
              ? "#ef4444"
              : point.kind === "six"
              ? "#10b981"
              : point.kind === "four"
              ? "#3b82f6"
              : "#64748b";

            const radius = isSelected ? 5.5 : (point.kind === "wicket" || point.kind === "six" ? 4 : 3);
            const ballItem = balls[point.idx];

            return (
              <g
                key={point.idx}
                role="button"
                tabIndex={0}
                aria-label={
                  isStoryOnly
                    ? `Key momentum event (${point.kind})`
                    : `Over ${ballItem?.over}.${ballItem?.ball}: ${ballItem?.runs} runs, Win probability ${Math.round((ballItem?.winProbability ?? 0.5) * 100)}%`
                }
                className="cursor-pointer focus:outline-none"
                onClick={() => handlePointClick(point.idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePointClick(point.idx);
                  }
                }}
                onMouseEnter={() => setHoveredIdx(point.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Hit target for easy tapping on mobile */}
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={14}
                  fill="transparent"
                />

                {/* Highlight ring if pinned */}
                {isPinnedThis && (
                  <circle
                    cx={point.cx}
                    cy={point.cy}
                    r={radius + 4}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                )}

                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={radius}
                  fill={fillColor}
                  stroke={isSelected ? "#ffffff" : "#0E1116"}
                  strokeWidth={isSelected ? 2 : 1}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Inspector Details Box below chart */}
      {activePoint ? (
        <div className="p-3.5 rounded-chip bg-brand-bg border border-brand-border animate-fadeIn relative">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-xs">
                {spoilerLevel === "story-only" ? "Key Delivery" : activePoint.overText}
              </span>
              <span className="text-slate-400 text-xs">
                {activePoint.bowler} to {activePoint.batter}
              </span>
              {!isStoryOnly && activePoint.isWicket && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  WICKET
                </span>
              )}
              {!isStoryOnly && activePoint.isSix && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SIX
                </span>
              )}
              {!isStoryOnly && activePoint.isFour && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  FOUR
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {spoilerLevel === "story-only" ? (
                <span className="font-semibold text-xs text-amber-400">
                  Momentum Shift
                </span>
              ) : (
                <>
                  <span className="tabular-nums font-semibold text-xs text-emerald-400">
                    {activePoint.prob}% win
                  </span>
                  <span className="tabular-nums text-[11px] text-slate-400">
                    ({activePoint.score})
                  </span>
                </>
              )}
              {pinnedIdx !== null && (
                <button
                  type="button"
                  onClick={() => setPinnedIdx(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                  title="Unpin details"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {displayedCommentary}
          </p>

          <div className="mt-1.5 text-[10px] text-slate-500 flex items-center justify-between">
            <span>
              {pinnedIdx !== null ? "Pinned delivery" : "Hovering to preview"}
            </span>
            <span>
              {pinnedIdx !== null ? "Click X to unpin" : "Click dot to keep details open"}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 text-center py-1">
          Hover or tap any dot on the chart to inspect ball details
        </div>
      )}
    </div>
  );
};
