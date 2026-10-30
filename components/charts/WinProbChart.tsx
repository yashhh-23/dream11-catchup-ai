"use client";

import React, { useState } from "react";
import { Ball, TurningPointMoment } from "@/types";
import { Info, X, Zap, ShieldAlert, Award } from "lucide-react";

interface WinProbChartProps {
  balls: Ball[];
  missedFromOver: number;
  missedToOver: number;
  topMoments: TurningPointMoment[];
}

interface PointDetails {
  idx: number;
  overText: string;
  prob: number;
  score: string;
  commentary: string;
  isWicket: boolean;
  isBoundary: boolean;
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
  const [hoveredPoint, setHoveredPoint] = useState<PointDetails | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<PointDetails | null>(null);

  if (!balls || balls.length === 0) return null;

  // Chart coordinate constants
  const width = 640;
  const height = 180;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const totalBalls = balls.length;

  const getX = (idx: number) => padLeft + (idx / Math.max(totalBalls - 1, 1)) * chartW;
  const getY = (prob: number) => padTop + (1 - prob) * chartH;

  // Build SVG path
  const points = balls.map((b, i) => `${getX(i).toFixed(1)},${getY(b.winProbability).toFixed(1)}`);
  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${getX(totalBalls - 1).toFixed(1)},${padTop + chartH} L ${padLeft},${padTop + chartH} Z`;

  // Find index bounds for the missed window
  const startIdx = Math.max(0, balls.findIndex(b => b.over >= missedFromOver));
  const endIdx = balls.findIndex(b => b.over >= missedToOver);
  const safeEndIdx = endIdx === -1 ? totalBalls - 1 : endIdx;

  const windowX1 = getX(startIdx);
  const windowX2 = getX(safeEndIdx);
  const windowW = Math.max(0, windowX2 - windowX1);

  // Active point prioritizes pinned (clicked) point, then hovered point
  const activePoint = pinnedPoint || hoveredPoint;

  const handlePointClick = (point: PointDetails) => {
    if (pinnedPoint && pinnedPoint.idx === point.idx) {
      setPinnedPoint(null); // toggle off if clicked again
    } else {
      setPinnedPoint(point); // lock in place
    }
  };

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Match Win Probability (India)
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/30 border border-amber-400" />
            <span>Missed Phase</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Wicket</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Boundary / 6</span>
          </span>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/60 border border-slate-800/80 p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Shaded Area Gradient */}
            <linearGradient id="probAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Missed Window Highlight */}
            <linearGradient id="windowHighlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Missed Window Rect */}
          {windowW > 0 && (
            <rect
              x={windowX1}
              y={padTop}
              width={windowW}
              height={chartH}
              fill="url(#windowHighlight)"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.8"
            />
          )}

          {/* Horizontal Grid lines */}
          {[0.25, 0.5, 0.75].map((lvl) => {
            const y = getY(lvl);
            const isMid = lvl === 0.5;
            return (
              <g key={lvl}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isMid ? "#475569" : "#1e293b"}
                  strokeDasharray={isMid ? "4 4" : "2 2"}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  fontSize="9"
                  fill="#64748b"
                  textAnchor="end"
                  fontFamily="sans-serif"
                >
                  {Math.round(lvl * 100)}%
                </text>
              </g>
            );
          })}

          {/* X Axis Baseline */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* X Axis Labels: Over 1, 5, 10, 15, 20 */}
          {[0, 4, 9, 14, 19].map((ovr) => {
            const ballIdx = balls.findIndex(b => b.over === ovr);
            if (ballIdx === -1) return null;
            const x = getX(ballIdx);
            return (
              <g key={ovr}>
                <line x1={x} y1={padTop + chartH} x2={x} y2={padTop + chartH + 4} stroke="#475569" />
                <text
                  x={x}
                  y={padTop + chartH + 15}
                  fontSize="9"
                  fill="#94a3b8"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  Ov {ovr + 1}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#probAreaGrad)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Crosshair Line (Fixed, no jitter) */}
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={activePoint.cx}
                y1={padTop}
                x2={activePoint.cx}
                y2={padTop + chartH}
                stroke={pinnedPoint ? "#38bdf8" : "#94a3b8"}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <circle
                cx={activePoint.cx}
                cy={activePoint.cy}
                r={pinnedPoint ? 9 : 7}
                fill="none"
                stroke={pinnedPoint ? "#38bdf8" : "#ffffff"}
                strokeWidth={pinnedPoint ? 2.5 : 1.5}
                opacity="0.9"
              />
            </g>
          )}

          {/* Interactive ball points */}
          {balls.map((b, i) => {
            const isWicket = b.wicket;
            const isSix = b.runs >= 6;
            const isFour = b.runs >= 4 && b.runs < 6;
            const isSignificant = isWicket || isSix || isFour;

            if (!isSignificant) return null;

            const cx = getX(i);
            const cy = getY(b.winProbability);
            const isSelected = pinnedPoint?.idx === i;
            const isHovered = hoveredPoint?.idx === i;

            const pointData: PointDetails = {
              idx: i,
              overText: `Over ${b.over + 1}.${b.ball}`,
              prob: Math.round(b.winProbability * 100),
              score: `${b.cumulativeScore}/${b.cumulativeWickets}`,
              commentary: b.commentary,
              isWicket,
              isBoundary: isSix || isFour,
              batter: b.batter,
              bowler: b.bowler,
              runs: b.runs,
              cx,
              cy,
            };

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(pointData)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => handlePointClick(pointData)}
              >
                {/* Invisible large hit area (14px radius) prevents mouse slipping */}
                <circle cx={cx} cy={cy} r={14} fill="transparent" />

                {/* Visible dot with static smooth radius */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isWicket ? 5.5 : 4}
                  fill={isWicket ? "#ef4444" : isSix ? "#10b981" : "#38bdf8"}
                  stroke="#ffffff"
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.2}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stable Delivery Inspector Box (Never blinks, clear read on mobile & desktop) */}
      <div className="mt-3">
        {activePoint ? (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              pinnedPoint
                ? "bg-slate-950 border-sky-500/50 shadow-lg shadow-sky-950/40"
                : "bg-slate-950/80 border-slate-700/80 shadow-md"
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                  {activePoint.overText}
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {activePoint.batter} vs {activePoint.bowler}
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    activePoint.isWicket
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : activePoint.runs >= 6
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}
                >
                  {activePoint.isWicket ? "WICKET" : activePoint.runs >= 6 ? "SIX" : `${activePoint.runs} RUNS`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {activePoint.prob}% Win
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                    ({activePoint.score})
                  </span>
                </div>
                {pinnedPoint && (
                  <button
                    type="button"
                    onClick={() => setPinnedPoint(null)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Close pinned view"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {activePoint.commentary}
            </p>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                {pinnedPoint ? (
                  <span className="text-sky-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Pinned Delivery
                  </span>
                ) : (
                  <span>Hovering • Click any dot to pin details</span>
                )}
              </span>
              <span className="text-slate-500">Tap dot again to unpin</span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Hover or tap any highlighted dot on the graph to inspect that ball&apos;s outcome & win probability</span>
          </div>
        )}
      </div>
    </div>
  );
};
