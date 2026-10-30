import type { 
  Ball, 
  BallEventKind,
  TurningPointMoment, 
  FantasyTeamPerformance, 
  ThrillRating, 
  WhatToWatchNext, 
  MatchMeta 
} from "../types/index.ts";

/**
 * Single source of truth for cricket ball classification.
 * Uses explicit flags if present to avoid extras (byes, overthrows) counting as boundaries.
 */
export function classifyBall(ball: Ball): BallEventKind {
  if (ball.wicket) return "wicket";
  if (ball.isSix || (!ball.wicket && ball.runs === 6)) return "six";
  if (ball.isBoundaryFour || (!ball.wicket && ball.runs === 4)) return "four";
  if (ball.runs === 0) return "dot";
  return "run";
}

export const EVENT_STYLE: Record<
  BallEventKind,
  { label: string; badge: string; circle: string; chartColor: string }
> = {
  wicket: {
    label: "Wicket",
    badge: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    circle: "bg-rose-600 text-white",
    chartColor: "#EF4444",
  },
  six: {
    label: "Six",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    circle: "bg-emerald-600 text-white",
    chartColor: "#10B981",
  },
  four: {
    label: "Four",
    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    circle: "bg-blue-600 text-white",
    chartColor: "#3B82F6",
  },
  dot: {
    label: "Dot",
    badge: "bg-slate-800 text-slate-400 border border-slate-700",
    circle: "bg-slate-800 text-slate-400 border border-slate-700",
    chartColor: "#64748B",
  },
  run: {
    label: "Run",
    badge: "bg-slate-800 text-slate-300 border border-slate-700",
    circle: "bg-slate-800 text-slate-200 border border-slate-700",
    chartColor: "#94A3B8",
  },
};

/**
 * Checks whether a delivery falls within the [fromOver, toOver] window.
 * Supports fractional overs (e.g. 14.2 represents over index 14, ball 2).
 */
export function isBallInRange(ball: Ball, fromOver: number, toOver: number): boolean {
  const isAfterStart = ball.over >= fromOver;
  const toCompleted = Math.floor(toOver);
  const toFraction = Math.round((toOver - toCompleted) * 10);

  let isBeforeEnd: boolean;
  if (toFraction > 0) {
    isBeforeEnd = ball.over < toCompleted || (ball.over === toCompleted && ball.ball <= toFraction);
  } else {
    isBeforeEnd = ball.over < toCompleted;
  }

  return isAfterStart && isBeforeEnd;
}

export function sliceBalls(balls: Ball[], fromOver: number, toOver: number): Ball[] {
  return balls.filter(b => isBallInRange(b, fromOver, toOver));
}

export function formatOver(over: number, ball: number): string {
  return `${over}.${ball}`;
}

export function formatWinProb(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

export function calculateLiveWinProbability(
  target: number,
  currentRuns: number,
  currentWickets: number,
  ballsBowled: number,
  totalOvers: number = 20
): number {
  if (currentRuns >= target) return 1.0;
  if (currentWickets >= 10) return 0.0;

  const totalBalls = totalOvers * 6;
  const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
  if (ballsRemaining === 0) return 0.0;

  const runsNeeded = Math.max(0, target - currentRuns);
  const rrr = (runsNeeded / ballsRemaining) * 6;

  if (ballsBowled === 0) {
    return 0.50;
  }

  const crr = (currentRuns / ballsBowled) * 6;
  const expectedWickets = (ballsBowled / totalBalls) * 5.5;
  const wicketSurplus = expectedWickets - currentWickets;

  let z = 0.35 * (crr - rrr) + 0.45 * wicketSurplus;

  if (ballsRemaining <= 30 && rrr > 10.0) {
    z -= (rrr - 10.0) * 0.35;
  }
  if (currentWickets >= 7) {
    z -= (currentWickets - 6) * 0.5;
  }

  const rawProb = 1 / (1 + Math.exp(-z));
  return Math.max(0.01, Math.min(0.99, Number(rawProb.toFixed(2))));
}

export function getTopMomentsFallback(balls: Ball[], maxMoments = 3): TurningPointMoment[] {
  if (!balls || balls.length === 0) return [];

  const candidates: { ball: Ball; prevProb: number; delta: number; kind: BallEventKind }[] = [];

  for (let i = 0; i < balls.length; i++) {
    const cur = balls[i];
    const prevProb = i > 0 ? balls[i - 1].winProbability : cur.winProbability;
    const delta = Math.abs(cur.winProbability - prevProb);
    const kind = classifyBall(cur);

    const priorityBoost = kind === "wicket" ? 0.25 : (kind === "six" ? 0.15 : (kind === "four" ? 0.08 : 0));
    candidates.push({
      ball: cur,
      prevProb,
      delta: delta + priorityBoost,
      kind,
    });
  }

  candidates.sort((a, b) => b.delta - a.delta);
  const selected = candidates.slice(0, maxMoments);

  return selected.map(({ ball, prevProb, kind }) => {
    let label: TurningPointMoment["label"] = "CRITICAL MOMENT";
    let desc = ball.commentary;
    let impact = "Shifted the match momentum significantly.";

    if (kind === "wicket") {
      label = "WICKET";
      desc = `${ball.dismissedPlayer || ball.batter} dismissed (${ball.wicketType || "out"}).`;
      impact = `Major breakthrough for the bowling attack. Win probability dropped to ${formatWinProb(ball.winProbability)}.`;
    } else if (kind === "six") {
      label = "SIX";
      desc = `Massive SIX by ${ball.batter} off ${ball.bowler}.`;
      impact = "Counter-attacking blow that injected vital momentum into the chase.";
    } else if (kind === "four") {
      label = "BOUNDARY";
      desc = `Boundary struck by ${ball.batter} off ${ball.bowler}.`;
      impact = "Relieved required-rate pressure.";
    }

    return {
      over: formatOver(ball.over, ball.ball),
      label,
      player: ball.wicket ? (ball.dismissedPlayer || ball.batter) : ball.batter,
      description: desc,
      impact,
      winProbBefore: prevProb,
      winProbAfter: ball.winProbability,
      swingDelta: Math.abs(ball.winProbability - prevProb),
    };
  });
}

export function calculateOverStats(balls: Ball[]) {
  if (!balls || balls.length === 0) {
    return {
      runs: 0,
      wickets: 0,
      boundaries: 0,
      sixes: 0,
      totalBalls: 0,
      runRate: 0,
      runRateFormatted: "0.00",
    };
  }

  let runs = 0;
  let wickets = 0;
  let fours = 0;
  let sixes = 0;

  balls.forEach(b => {
    runs += b.runs;
    const kind = classifyBall(b);
    if (kind === "wicket") wickets++;
    else if (kind === "four") fours++;
    else if (kind === "six") sixes++;
  });

  const oversCount = balls.length / 6;
  const runRate = oversCount > 0 ? Number((runs / oversCount).toFixed(2)) : 0;

  return {
    runs,
    wickets,
    boundaries: fours,
    sixes,
    totalBalls: balls.length,
    runRate,
    runRateFormatted: runRate.toFixed(2),
  };
}

export function validateRecapAgainstBallData(
  moments: TurningPointMoment[],
  balls: Ball[]
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const validOvers = new Set(balls.map(b => formatOver(b.over, b.ball)));
  const validPlayers = new Set<string>();

  balls.forEach(b => {
    if (b.batter) validPlayers.add(b.batter.toLowerCase());
    if (b.bowler) validPlayers.add(b.bowler.toLowerCase());
    if (b.dismissedPlayer) validPlayers.add(b.dismissedPlayer.toLowerCase());
  });

  moments.forEach((m, idx) => {
    if (!validOvers.has(m.over)) {
      issues.push(`Moment ${idx + 1} references over "${m.over}", which does not exist in the selected ball data.`);
    }
    const playerLower = m.player.toLowerCase();
    const playerFound = Array.from(validPlayers).some(vp => vp.includes(playerLower) || playerLower.includes(vp));
    if (!playerFound) {
      issues.push(`Moment ${idx + 1} references player "${m.player}", who did not participate in this phase.`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function calculateFantasyPerformance(
  balls: Ball[],
  captainName = "Hardik Pandya",
  vcName = "Rohit Sharma"
): FantasyTeamPerformance {
  let capRuns = 0, capFours = 0, capSixes = 0, capWickets = 0, capOut = false;
  let vcRuns = 0, vcFours = 0, vcSixes = 0, vcWickets = 0, vcOut = false;

  balls.forEach(b => {
    const kind = classifyBall(b);
    if (b.batter === captainName) {
      capRuns += b.runs;
      if (kind === "four") capFours++;
      if (kind === "six") capSixes++;
    }
    if (b.dismissedPlayer === captainName) capOut = true;

    if (b.batter === vcName) {
      vcRuns += b.runs;
      if (kind === "four") vcFours++;
      if (kind === "six") vcSixes++;
    }
    if (b.dismissedPlayer === vcName) vcOut = true;
  });

  const capRaw = capRuns + (capFours * 1) + (capSixes * 2) + (capOut && capRuns === 0 ? -2 : 0);
  const vcRaw = vcRuns + (vcFours * 1) + (vcSixes * 2) + (vcOut && vcRuns === 0 ? -2 : 0);

  const capPts = Math.round(capRaw * 2);
  const vcPts = Math.round(vcRaw * 1.5);
  const totalPhase = capPts + vcPts;

  let capSummary = `${captainName}: ${capRuns} runs (${capSixes} sixes, ${capFours} fours)`;
  if (capSixes >= 2) capSummary = `Captain smashed ${capSixes} sixes to ignite your fantasy score! (+${capPts} pts)`;
  else if (capRuns > 0) capSummary = `Captain contributed ${capRuns} crucial runs (+${capPts} pts)`;

  let vcSummary = `${vcName}: ${vcRuns} runs (+${vcPts} pts)`;
  if (vcOut && vcRuns === 0) vcSummary = "Vice-Captain dismissed for a duck (-2 pts)";
  else if (vcOut) vcSummary = `Vice-Captain fell after making ${vcRuns} runs (+${vcPts} pts)`;

  const rankBefore = totalPhase >= 30 ? "2.3L" : "1.8L";
  const rankAfter = totalPhase >= 30 ? "41K" : totalPhase >= 15 ? "89K" : "2.1L";
  const rankDirection = totalPhase >= 15 ? "up" : "down";

  return {
    teamName: "IndiaXI Masters",
    captain: {
      name: captainName,
      role: "Captain",
      runs: capRuns,
      wickets: capWickets,
      sixes: capSixes,
      fours: capFours,
      pointsEarned: capPts,
      summary: capSummary,
    },
    viceCaptain: {
      name: vcName,
      role: "Vice Captain",
      runs: vcRuns,
      wickets: vcWickets,
      sixes: vcSixes,
      fours: vcFours,
      pointsEarned: vcPts,
      summary: vcSummary,
    },
    phasePoints: totalPhase,
    rankBefore,
    rankAfter,
    rankDirection,
  };
}

export function computeThrillRating(balls: Ball[]): ThrillRating {
  if (!balls || balls.length === 0) {
    return { rating: 8.5, verdict: "Competitive match with good phase battles", worthReplay: true };
  }

  let highSwingMoments = 0;
  for (let i = 1; i < balls.length; i++) {
    const delta = Math.abs(balls[i].winProbability - balls[i - 1].winProbability);
    if (delta >= 0.12) highSwingMoments++;
  }

  const rating = Math.min(9.8, Math.max(7.8, Number((8.2 + (highSwingMoments * 0.35)).toFixed(1))));
  const verdict = highSwingMoments >= 3 
    ? "Went down to the wire with 3 dramatic lead changes!"
    : "High-intensity contest with pivotal middle-over counterpunches.";

  return {
    rating,
    verdict,
    worthReplay: rating >= 8.5,
  };
}

export function getWhatToWatchNext(lastBall: Ball, meta: MatchMeta): WhatToWatchNext {
  const ballsCompleted = (lastBall.over * 6) + lastBall.ball;
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);
  const runsNeeded = Math.max(0, meta.target - lastBall.cumulativeScore);

  return {
    onStrike: lastBall.batter,
    nonStriker: lastBall.batter === "Hardik Pandya" ? "Tilak Varma" : "Hardik Pandya",
    upcomingBowler: "Lockie Ferguson (148+ kph thunderbolts)",
    equation: `Need ${runsNeeded} runs from ${ballsRemaining} balls`,
    tacticalNote: "Ferguson targeting express hard lengths; Hardik backing away to clear wide long-on.",
  };
}
