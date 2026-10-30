"use client";

import React, { useState } from "react";
import { Ball, TurningPointMoment } from "@/types";
import { X } from "lucide-react";

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
  const [hoveredPoint, setHoveredPoint] = useState<PointDetails | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<PointDetails | null>(null);

  if (!balls || balls.length === 0) return null;

  // Chart coordinate constants
  const width = 640;
  const height = 180;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 24;
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

  const activePoint = pinnedPoint || hoveredPoint;

  const handlePointClick = (point: PointDetails) => {
    if (pinnedPoint && pinnedPoint.idx === point.idx) {
      setPinnedPoint(null);
    } else {
      setPinnedPoint(point);
    }
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
      <div className="w-full overflow-hidden rounded-lg bg-[#0E1116] border border-[#262C36] p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="flatAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

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
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
          )}

          {/* Grid lines */}
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
                  stroke={isMid ? "#334155" : "#1F2937"}
                  strokeDasharray={isMid ? "4 4" : "2 2"}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="end"
                  className="tabular-nums"
                >
                  {Math.round(lvl * 100)}%
                </text>
              </g>
            );
          })}

          {/* X Baseline */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            stroke="#262C36"
            strokeWidth="1"
          />

          {/* Over Markers */}
          {[0, 4, 9, 14, 19].map((ovr) => {
            const ballIdx = balls.findIndex(b => b.over === ovr);
            if (ballIdx === -1) return null;
            const x = getX(ballIdx);
            return (
              <g key={ovr}>
                <line x1={x} y1={padTop + chartH} x2={x} y2={padTop + chartH + 3} stroke="#475569" />
                <text
                  x={x}
                  y={padTop + chartH + 14}
                  fontSize="9"
                  fill="#8B949E"
                  textAnchor="middle"
                >
                  Ov {ovr + 1}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#flatAreaGrad)" />

          {/* Main Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Crosshair Guide */}
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={activePoint.cx}
                y1={padTop}
                x2={activePoint.cx}
                y2={padTop + chartH}
                stroke="#8B949E"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.cx}
                cy={activePoint.cy}
                r={pinnedPoint ? 8 : 6}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={pinnedPoint ? 2 : 1.5}
              />
            </g>
          )}

          {/* Interactive Delivery Dots */}
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
              overText: `Over ${b.over}.${b.ball}`,
              prob: Math.round(b.winProbability * 100),
              score: `${b.cumulativeScore}/${b.cumulativeWickets}`,
              commentary: b.commentary,
              isWicket,
              isSix,
              isFour,
              batter: b.batter,
              bowler: b.bowler,
              runs: b.runs,
              cx,
              cy,
            };

            const fillColor = isWicket ? "#EF4444" : isSix ? "#10B981" : "#3B82F6";

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(pointData)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => handlePointClick(pointData)}
              >
                {/* 14px hit target prevents cursor drop */}
                <circle cx={cx} cy={cy} r={14} fill="transparent" />

                {/* Visible dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isWicket ? 5 : 4}
                  fill={fillColor}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected || isHovered ? 2.5 : 1}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Inspector Details */}
      <div>
        {activePoint ? (
          <div className="p-3 rounded-lg bg-[#0E1116] border border-[#262C36] text-xs">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#262C36]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">
                  {activePoint.overText}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-300">
                  {activePoint.batter} vs {activePoint.bowler}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    activePoint.isWicket
                      ? "bg-rose-500/15 text-rose-400"
                      : activePoint.isSix
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-blue-500/15 text-blue-400"
                  }`}
                >
                  {activePoint.isWicket ? "Wicket" : activePoint.isSix ? "Six" : "Four"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-emerald-400">
                  {activePoint.prob}% win
                </span>
                <span className="tabular-nums text-slate-400">
                  ({activePoint.score})
                </span>
                {pinnedPoint && (
                  <button
                    type="button"
                    onClick={() => setPinnedPoint(null)}
                    className="text-slate-400 hover:text-white ml-1"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {activePoint.commentary}
            </p>
          </div>
        ) : (
          <div className="text-center text-xs text-slate-400 py-1">
            Tap a dot for details
          </div>
        )}
      </div>
    </div>
  );
};
