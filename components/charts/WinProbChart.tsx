"use client";

import React, { useState, useMemo } from "react";
import { Ball } from "@/types";
import { isBallInRange, EVENT_STYLE, classifyBall } from "@/lib/matchUtils";
import { X } from "lucide-react";

interface WinProbChartProps {
  balls: Ball[];
  missedFromOver: number;
  missedToOver: number;
}

interface PointDetails {
  idx: number;
  overText: string;
  prob: number;
  score: string;
  commentary: string;
  isWicket: boolean;
  isSix: boolean;
  isFour: boolean;
  batter: string;
  bowler: string;
  runs: number;
  cx: number;
  cy: number;
}

export const WinProbChart: React.FC<WinProbChartProps> = ({
  balls,
  missedFromOver,
  missedToOver,
}) => {
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 600;
  const height = 180;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const totalBalls = balls.length;

  const {
    pathD,
    windowX1,
    windowW,
    allDots,
    significantDots,
    xTicks,
  } = useMemo(() => {
    const getX = (idx: number) => padLeft + (idx / Math.max(1, totalBalls - 1)) * chartW;
    const getY = (prob: number) => padTop + chartH - prob * chartH;

    const points = balls.map((b, i) => `${getX(i).toFixed(1)},${getY(b.winProbability).toFixed(1)}`);
    const path = `M ${points.join(" L ")}`;

    let startIdx = 0;
    while (startIdx < balls.length && balls[startIdx].over < missedFromOver) {
      startIdx++;
    }

    const toCompleted = Math.floor(missedToOver);
    const toFraction = Math.round((missedToOver - toCompleted) * 10);
    let endIdx = startIdx;
    while (endIdx < balls.length) {
      const b = balls[endIdx];
      const inRange = toFraction > 0
        ? (b.over < toCompleted || (b.over === toCompleted && b.ball <= toFraction))
        : (b.over < toCompleted);
      if (!inRange) break;
      endIdx++;
    }
    const safeEndIdx = Math.max(startIdx, endIdx - 1);

    const wX1 = getX(startIdx);
    const wX2 = getX(safeEndIdx);
    const wW = Math.max(0, wX2 - wX1);

    const dots: PointDetails[] = balls.map((b, idx) => {
      const kind = classifyBall(b);
      return {
        idx,
        overText: `Over ${b.over}.${b.ball}`,
        prob: Math.round(b.winProbability * 100),
        score: `${b.cumulativeScore}/${b.cumulativeWickets}`,
        commentary: b.commentary,
        isWicket: kind === "wicket",
        isSix: kind === "six",
        isFour: kind === "four",
        batter: b.batter,
        bowler: b.bowler,
        runs: b.runs,
        cx: getX(idx),
        cy: getY(b.winProbability),
      };
    });

    const sigDots = dots.filter(d => d.isWicket || d.isSix || d.isFour || isBallInRange(balls[d.idx], missedFromOver, missedToOver));

    const ticks = [
      { label: "Ov 1", x: getX(0) },
      { label: "Ov 6", x: getX(Math.min(35, totalBalls - 1)) },
      { label: "Ov 10", x: getX(Math.min(59, totalBalls - 1)) },
      { label: "Ov 15", x: getX(Math.min(85, totalBalls - 1)) },
    ];

    return {
      pathD: path,
      windowX1: wX1,
      windowW: wW,
      allDots: dots,
      significantDots: sigDots,
      xTicks: ticks,
    };
  }, [balls, missedFromOver, missedToOver, totalBalls, chartW, chartH]);

  const activeIdx = pinnedIdx ?? hoveredIdx;
  const activePoint = activeIdx !== null ? allDots[activeIdx] : null;

  const handlePointClick = (idx: number) => {
    setPinnedIdx(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="space-y-3">
      {/* Title & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-300">
          Win probability · India
        </h3>
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
                  {`${Math.round(level * 100)}%`}
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

          {/* Interactive Dots for Key Deliveries */}
          {significantDots.map((point) => {
            const isSelected = activePoint?.idx === point.idx;
            const isPinnedThis = pinnedIdx === point.idx;

            const fillColor = point.isWicket
              ? "#ef4444"
              : point.isSix
              ? "#10b981"
              : point.isFour
              ? "#3b82f6"
              : "#64748b";

            const radius = isSelected ? 5.5 : (point.isWicket || point.isSix ? 4 : 3);

            return (
              <g
                key={point.idx}
                className="cursor-pointer"
                onClick={() => handlePointClick(point.idx)}
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
                {activePoint.overText}
              </span>
              <span className="text-slate-400 text-xs">
                {activePoint.bowler} to {activePoint.batter}
              </span>
              {activePoint.isWicket && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  WICKET
                </span>
              )}
              {activePoint.isSix && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SIX
                </span>
              )}
              {activePoint.isFour && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  FOUR
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="tabular-nums font-semibold text-xs text-emerald-400">
                {activePoint.prob}% win
              </span>
              <span className="tabular-nums text-[11px] text-slate-400">
                ({activePoint.score})
              </span>
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
            {activePoint.commentary}
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
