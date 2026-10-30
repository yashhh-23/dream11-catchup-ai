"use client";

import React, { useState } from "react";
import { Ball, TurningPointMoment } from "@/types";

interface WinProbChartProps {
  balls: Ball[];
  missedFromOver: number;
  missedToOver: number;
  topMoments: TurningPointMoment[];
}

export const WinProbChart: React.FC<WinProbChartProps> = ({
  balls,
  missedFromOver,
  missedToOver,
  topMoments,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    overText: string;
    prob: number;
    score: string;
    commentary: string;
    x: number;
    y: number;
  } | null>(null);

  if (!balls || balls.length === 0) return null;

  // Chart coordinate constants
  const width = 640;
  const height = 180;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 26;
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

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Match Win Probability (India)
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Missed Phase
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Wicket
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Boundary/Six
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Shaded Area Gradient */}
            <linearGradient id="probAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Missed Window Highlight */}
            <linearGradient id="windowHighlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
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
              opacity="0.7"
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
                  stroke={isMid ? "#475569" : "#334155"}
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

          {/* Interactive ball points */}
          {balls.map((b, i) => {
            const isWicket = b.wicket;
            const isSix = b.runs >= 6;
            const isFour = b.runs >= 4 && b.runs < 6;
            const isSignificant = isWicket || isSix || isFour;

            const cx = getX(i);
            const cy = getY(b.winProbability);

            if (!isSignificant) return null;

            return (
              <g
                key={i}
                className="cursor-pointer transition-transform hover:scale-125"
                onMouseEnter={() => {
                  setHoveredPoint({
                    overText: `Ov ${b.over + 1}.${b.ball}`,
                    prob: Math.round(b.winProbability * 100),
                    score: `${b.cumulativeScore}/${b.cumulativeWickets}`,
                    commentary: b.commentary,
                    x: cx,
                    y: cy,
                  });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isWicket ? 5.5 : 4}
                  fill={isWicket ? "#ef4444" : isSix ? "#10b981" : "#3b82f6"}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-2xl backdrop-blur-md max-w-[220px]"
            style={{
              left: `${Math.min(Math.max(hoveredPoint.x - 70, 10), width - 180)}px`,
              top: `${Math.max(hoveredPoint.y - 65, 0)}px`,
            }}
          >
            <div className="flex justify-between items-center font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">
              <span>{hoveredPoint.overText}</span>
              <span className="text-emerald-400">{hoveredPoint.prob}% Win</span>
            </div>
            <div className="text-[11px] text-slate-400 line-clamp-2">
              {hoveredPoint.commentary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
