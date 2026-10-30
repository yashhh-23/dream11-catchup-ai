"use client";

import React, { useState } from "react";
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
  const [pinnedPoint, setPinnedPoint] = useState<PointDetails | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<PointDetails | null>(null);

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

  const points = balls.map((b, i) => `${getX(i).toFixed(1)},${getY(b.winProbability).toFixed(1)}`);
  const pathD = `M ${points.join(" L ")}`;

  const startIdx = Math.max(0, balls.findIndex(b => isBallInRange(b, missedFromOver, missedToOver)));
  let lastMatchingIdx = -1;
  for (let i = balls.length - 1; i >= 0; i--) {
    if (isBallInRange(balls[i], missedFromOver, missedToOver)) {
      lastMatchingIdx = i;
      break;
    }
  }
  const safeEndIdx = lastMatchingIdx === -1 ? totalBalls - 1 : lastMatchingIdx;

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
      <div className="w-full overflow-hidden rounded-container bg-brand-bg border border-brand-border p-1">
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
              strokeDasharray="3 3"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
          )}

          {/* Horizontal Grid lines */}
          {[0.25, 0.5, 0.75].map((level) => {
            const y = getY(level);
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
          {[
            { label: "Ov 1", ballIdx: 0 },
            { label: "Ov 6", ballIdx: 35 },
            { label: "Ov 10", ballIdx: 59 },
            { label: "Ov 15", ballIdx: 89 },
          ].map((tick) => {
            const x = getX(tick.ballIdx);
            return (
              <text
                key={tick.label}
                x={x}
                y={padTop + chartH + 15}
                fontSize={9}
                fill="#64748b"
                textAnchor="middle"
                className="font-mono"
              >
                {tick.label}
              </text>
            );
          })}

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
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
          )}

          {/* Key Deliveries */}
          {balls.map((b, i) => {
            const kind = classifyBall(b);
            const isSignificant = kind === "wicket" || kind === "six" || kind === "four";

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
              isWicket: kind === "wicket",
              isSix: kind === "six",
              isFour: kind === "four",
              batter: b.batter,
              bowler: b.bowler,
              runs: b.runs,
              cx,
              cy,
            };

            const fillColor = EVENT_STYLE[kind].chartColor;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePointClick(pointData);
                }}
                onMouseEnter={() => setHoveredPoint(pointData)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={12}
                  fill="transparent"
                  className="cursor-pointer"
                />

                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={fillColor}
                    opacity={0.3}
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 4.5 : 3.5}
                  fill={fillColor}
                  stroke="#161B22"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stable Details Container */}
      <div className="min-h-[72px] flex items-center">
        {activePoint ? (
          <div className="w-full p-3 rounded-chip bg-brand-bg border border-brand-border text-xs space-y-1.5 transition-all">
            <div className="flex items-center justify-between">
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
                      ? EVENT_STYLE.wicket.badge
                      : activePoint.isSix
                      ? EVENT_STYLE.six.badge
                      : EVENT_STYLE.four.badge
                  }`}
                >
                  {activePoint.isWicket ? "WICKET" : activePoint.isSix ? "SIX" : "FOUR"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="tabular-nums font-bold text-emerald-400">
                    {activePoint.prob}%
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">
                    ({activePoint.score})
                  </span>
                </div>
                {pinnedPoint && (
                  <button
                    type="button"
                    onClick={() => setPinnedPoint(null)}
                    className="p-1 rounded hover:bg-brand-surface text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              {activePoint.commentary}
            </p>
          </div>
        ) : (
          <div className="w-full py-2.5 px-3 rounded-chip bg-brand-bg/50 border border-brand-border/40 text-center text-[11px] text-slate-500">
            Tap a dot for details
          </div>
        )}
      </div>
    </div>
  );
};
