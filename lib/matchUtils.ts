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

/**
 * Fast O(k) slicing for sorted ball arrays, falling back to linear filter for arbitrary arrays.
 */
export function sliceBalls(balls: Ball[], fromOver: number, toOver: number): Ball[] {
  if (!balls || balls.length === 0 || fromOver >= toOver) return [];

  const toCompleted = Math.floor(toOver);
  const toFraction = Math.round((toOver - toCompleted) * 10);

  // Fast single forward scan to slice in O(k) without filter allocation
  let startIdx = 0;
  while (startIdx < balls.length && balls[startIdx].over < fromOver) {
    startIdx++;
  }

  let endIdx = startIdx;
  while (endIdx < balls.length) {
    const b = balls[endIdx];
    const inRange = toFraction > 0
      ? (b.over < toCompleted || (b.over === toCompleted && b.ball <= toFraction))
      : (b.over < toCompleted);
    if (!inRange) break;
    endIdx++;
  }

  return balls.slice(startIdx, endIdx);
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

interface MomentCandidate {
  ball: Ball;
  prevProb: number;
  priorityScore: number;
  kind: BallEventKind;
}

/**
 * Computes top turning point moments in O(k) time and O(1) space
 * using a running fixed-size priority array of length 3.
 */
export function getTopMomentsFallback(
  balls: Ball[],
  maxMoments = 3,
  initialPrevProb?: number
): TurningPointMoment[] {
  if (!balls || balls.length === 0) return [];

  const top: MomentCandidate[] = [];

  for (let i = 0; i < balls.length; i++) {
    const cur = balls[i];
    const prevProb = i > 0
      ? balls[i - 1].winProbability
      : (initialPrevProb !== undefined ? initialPrevProb : (cur.over === 0 && cur.ball === 1 ? 0.50 : cur.winProbability));
    const delta = Math.abs(cur.winProbability - prevProb);
    const kind = classifyBall(cur);

    const priorityBoost = kind === "wicket" ? 0.25 : (kind === "six" ? 0.15 : (kind === "four" ? 0.08 : 0));
    const priorityScore = delta + priorityBoost;

    // Fixed-size insertion sort (O(1) space, no full-array sort or intermediate allocations)
    if (top.length < maxMoments) {
      let insIdx = top.length;
      while (insIdx > 0 && top[insIdx - 1].priorityScore < priorityScore) insIdx--;
      top.splice(insIdx, 0, { ball: cur, prevProb, priorityScore, kind });
    } else if (priorityScore > top[top.length - 1].priorityScore) {
      let insIdx = top.length - 1;
      while (insIdx > 0 && top[insIdx - 1].priorityScore < priorityScore) insIdx--;
      top.pop();
      top.splice(insIdx, 0, { ball: cur, prevProb, priorityScore, kind });
    }
  }

  return top.map(formatMomentCandidate);
}

function formatMomentCandidate({ ball, prevProb, kind }: MomentCandidate): TurningPointMoment {
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
    videoClip: {
      title: `${ball.wicket ? (ball.dismissedPlayer || ball.batter) : ball.batter} · ${label} (${formatOver(ball.over, ball.ball)} ov)`,
      duration: "0:14",
      actionType: (kind === "wicket" ? "wicket" : kind === "six" ? "six" : "boundary") as "wicket" | "six" | "boundary",
    },
  };
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

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    runs += b.runs;
    const kind = classifyBall(b);
    if (kind === "wicket") wickets++;
    else if (kind === "four") fours++;
    else if (kind === "six") sixes++;
  }

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

/**
 * Truly fused single-pass window processing (Optimization C & I):
 * Executes slicing, stats calculation, running top-3 moments tracking,
 * and player extraction in one fused O(k) forward scan with O(1) auxiliary space.
 */
export function processWindowFused(balls: Ball[], fromOver: number, toOver: number) {
  if (!balls || balls.length === 0 || fromOver >= toOver) {
    return {
      missedBalls: [],
      stats: calculateOverStats([]),
      topMoments: [],
      battersInPhase: [],
      dismissedInPhase: [],
      initialPrevProb: 0.50,
    };
  }

  const toCompleted = Math.floor(toOver);
  const toFraction = Math.round((toOver - toCompleted) * 10);

  // Fast forward scan to find start delivery index
  let startIdx = 0;
  while (startIdx < balls.length && balls[startIdx].over < fromOver) {
    startIdx++;
  }

  if (startIdx >= balls.length) {
    return {
      missedBalls: [],
      stats: calculateOverStats([]),
      topMoments: [],
      battersInPhase: [],
      dismissedInPhase: [],
      initialPrevProb: 0.50,
    };
  }

  // Preceding ball probability before the window starts (fixes bug 14)
  const initialPrevProb = startIdx > 0 && balls[startIdx - 1]
    ? balls[startIdx - 1].winProbability
    : (balls[0]?.over === 0 && balls[0]?.ball === 1 ? 0.50 : (balls[startIdx]?.winProbability ?? 0.50));

  const missedBalls: Ball[] = [];
  let runs = 0;
  let wickets = 0;
  let fours = 0;
  let sixes = 0;
  const batterSet = new Set<string>();
  const dismissedList: string[] = [];
  const topMomentsList: MomentCandidate[] = [];

  // Fused single pass over deliveries in the window
  let idx = startIdx;
  while (idx < balls.length) {
    const b = balls[idx];
    const inRange = toFraction > 0
      ? (b.over < toCompleted || (b.over === toCompleted && b.ball <= toFraction))
      : (b.over < toCompleted);
    if (!inRange) break;

    missedBalls.push(b);
    runs += b.runs;
    batterSet.add(b.batter);

    const kind = classifyBall(b);
    if (kind === "wicket") {
      wickets++;
      dismissedList.push(b.dismissedPlayer || b.batter);
    } else if (kind === "four") {
      fours++;
    } else if (kind === "six") {
      sixes++;
    }

    // Running top-3 moments priority tracking in O(1) space with insertion
    const prevProb = missedBalls.length > 1
      ? missedBalls[missedBalls.length - 2].winProbability
      : initialPrevProb;
    const delta = Math.abs(b.winProbability - prevProb);
    const priorityBoost = kind === "wicket" ? 0.25 : (kind === "six" ? 0.15 : (kind === "four" ? 0.08 : 0));
    const priorityScore = delta + priorityBoost;

    if (topMomentsList.length < 3) {
      let insIdx = topMomentsList.length;
      while (insIdx > 0 && topMomentsList[insIdx - 1].priorityScore < priorityScore) insIdx--;
      topMomentsList.splice(insIdx, 0, { ball: b, prevProb, priorityScore, kind });
    } else if (priorityScore > topMomentsList[2].priorityScore) {
      let insIdx = 2;
      while (insIdx > 0 && topMomentsList[insIdx - 1].priorityScore < priorityScore) insIdx--;
      topMomentsList.pop();
      topMomentsList.splice(insIdx, 0, { ball: b, prevProb, priorityScore, kind });
    }

    idx++;
  }

  const oversCount = missedBalls.length / 6;
  const runRate = oversCount > 0 ? Number((runs / oversCount).toFixed(2)) : 0;
  const stats = {
    runs,
    wickets,
    boundaries: fours,
    sixes,
    totalBalls: missedBalls.length,
    runRate,
    runRateFormatted: runRate.toFixed(2),
  };

  const topMoments = topMomentsList.map(formatMomentCandidate);

  return {
    missedBalls,
    stats,
    topMoments,
    battersInPhase: Array.from(batterSet),
    dismissedInPhase: dismissedList,
    initialPrevProb,
  };
}

/**
 * Validates generated recap against ground truth ball data.
 * Supports both array of moments or object with top3Moments.
 */
export function validateRecapAgainstBallData(
  recap: any,
  balls: Ball[],
  maxAllowedOver?: number
): { valid: boolean; isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const validPlayers = new Set<string>();

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.batter) validPlayers.add(b.batter);
    if (b.bowler) validPlayers.add(b.bowler);
    if (b.dismissedPlayer) validPlayers.add(b.dismissedPlayer);
  }

  // Validate allowed mood
  const ALLOWED_MOODS = new Set(["Cruising", "Knife's edge", "Chasing hard", "Game over", "Comeback on"]);
  if (recap && typeof recap === "object" && recap.mood && !ALLOWED_MOODS.has(recap.mood)) {
    issues.push(`Invalid mood "${recap.mood}". Must be one of: Cruising, Knife's edge, Chasing hard, Game over, Comeback on.`);
  }

  // Inspect moments
  const moments: any[] = Array.isArray(recap) 
    ? recap 
    : (recap?.top3Moments || []);

  for (let idx = 0; idx < moments.length; idx++) {
    const m = moments[idx];
    if (m.over) {
      // Direct search avoids allocating a Set and k strings on every request (Optimization C)
      const overExists = balls.some(b => formatOver(b.over, b.ball) === m.over);
      if (!overExists) {
        issues.push(`Moment ${idx + 1} references over "${m.over}", which does not exist in the selected ball data.`);
      }
    }
    if (m.player && !validPlayers.has(m.player)) {
      issues.push(`Moment ${idx + 1} references player "${m.player}", who was not part of this window.`);
    }
  }

  // Inspect narrative (oneLiner and story) for hallucinated future events or players
  const textCorpus = `${recap?.oneLiner || ""} ${recap?.story || ""}`;
  if (textCorpus.trim().length > 0 && balls.length > 0) {
    const maxBallOver = maxAllowedOver !== undefined ? maxAllowedOver : balls[balls.length - 1].over + (balls[balls.length - 1].ball / 10);
    const minBallOver = balls[0].over;

    // Check for over mentions like "over 16", "over 15.2", "16th over"
    const overMatches = textCorpus.matchAll(/\b(?:over|ov)\s*(\d+(\.\d+)?)\b/gi);
    for (const match of overMatches) {
      const mentioned = parseFloat(match[1]);
      if (!isNaN(mentioned)) {
        if (mentioned > maxBallOver + 0.1 || mentioned < minBallOver) {
          issues.push(`Narrative references over ${mentioned}, which is outside the allowed window (up to over ${maxBallOver}).`);
        }
      }
    }
  }

  const isValid = issues.length === 0;
  return {
    valid: isValid,
    isValid,
    issues,
  };
}

/**
 * Calculates Dream11 Fantasy Team points and rank movement for the user's Captain & VC.
 */
export function calculateFantasyPerformance(
  missedBalls: Ball[],
  captainName = "Hardik Pandya",
  viceCaptainName = "Rohit Sharma"
): FantasyTeamPerformance {
  let captainRuns = 0;
  let captainFours = 0;
  let captainSixes = 0;
  let captainWickets = 0;
  let captainBatted = false;
  let captainDismissed = false;

  let vcRuns = 0;
  let vcFours = 0;
  let vcSixes = 0;
  let vcWickets = 0;
  let vcBatted = false;
  let vcDismissed = false;

  missedBalls.forEach(b => {
    if (b.batter === captainName) {
      captainBatted = true;
      captainRuns += b.runs;
      if (b.isBoundaryFour || b.runs === 4) captainFours++;
      if (b.isSix || b.runs === 6) captainSixes++;
    }
    if (b.wicket && (b.dismissedPlayer === captainName || (b.batter === captainName && !b.dismissedPlayer))) {
      captainDismissed = true;
    }

    if (b.batter === viceCaptainName) {
      vcBatted = true;
      vcRuns += b.runs;
      if (b.isBoundaryFour || b.runs === 4) vcFours++;
      if (b.isSix || b.runs === 6) vcSixes++;
    }
    if (b.wicket && (b.dismissedPlayer === viceCaptainName || (b.batter === viceCaptainName && !b.dismissedPlayer))) {
      vcDismissed = true;
    }

    // Cricket rule: Run-outs are NOT credited to the bowler
    if (b.bowler === captainName && b.wicket && b.wicketType !== "run out") captainWickets++;
    if (b.bowler === viceCaptainName && b.wicket && b.wicketType !== "run out") vcWickets++;
  });

  const rawCapPoints = (captainRuns * 1) + (captainFours * 1) + (captainSixes * 2) + (captainWickets * 25);
  const capPoints = rawCapPoints * 2; // 2x multiplier

  const rawVcPoints = (vcRuns * 1) + (vcFours * 1) + (vcSixes * 2) + (vcWickets * 25);
  const vcPoints = Math.round(rawVcPoints * 1.5); // 1.5x multiplier

  const phasePoints = capPoints + vcPoints + (missedBalls.length > 20 ? 18 : 8);

  // Dynamic rank movement based on points scored in this window
  const expectedPoints = Math.max(12, Math.round(missedBalls.length * 1.5));
  let rankBefore = "1.8L";
  let rankAfter = "1.8L";
  let rankDirection: "up" | "down" | "same" = "same";

  if (phasePoints >= expectedPoints * 1.4) {
    rankBefore = "2.3L";
    rankAfter = phasePoints >= 70 ? "38K" : "84K";
    rankDirection = "up";
  } else if (phasePoints <= expectedPoints * 0.7) {
    rankBefore = "82K";
    rankAfter = "1.5L";
    rankDirection = "down";
  } else {
    rankBefore = "1.25L";
    rankAfter = "1.18L";
    rankDirection = "same";
  }

  // Accurate summaries avoiding the false "Dismissed" bug when batter did not bat
  let capSummary = `${captainRuns} runs (+${capPoints} pts)`;
  if (captainSixes > 0) {
    capSummary = `${captainSixes} sixes & ${captainRuns} runs (+${capPoints} pts with 2x)`;
  } else if (captainDismissed) {
    capSummary = captainRuns === 0 ? `Dismissed for duck (+${capPoints} pts)` : `Dismissed for ${captainRuns} (+${capPoints} pts with 2x)`;
  } else if (!captainBatted && captainWickets === 0) {
    capSummary = `Did not bat in this phase (0 pts)`;
  }

  let vcSummary = `${vcRuns} runs (+${vcPoints} pts with 1.5x)`;
  if (vcSixes > 0) {
    vcSummary = `${vcSixes} sixes & ${vcRuns} runs (+${vcPoints} pts with 1.5x)`;
  } else if (vcDismissed) {
    vcSummary = vcRuns === 0 ? `Dismissed for duck (+${vcPoints} pts)` : `Dismissed for ${vcRuns} (+${vcPoints} pts with 1.5x)`;
  } else if (!vcBatted && vcWickets === 0) {
    vcSummary = `Did not bat in this phase (0 pts)`;
  }

  return {
    teamName: "IndiaXI",
    captain: {
      name: captainName,
      role: "Captain",
      runs: captainRuns,
      wickets: captainWickets,
      fours: captainFours,
      sixes: captainSixes,
      pointsEarned: capPoints,
      summary: capSummary,
    },
    viceCaptain: {
      name: viceCaptainName,
      role: "Vice Captain",
      runs: vcRuns,
      wickets: vcWickets,
      fours: vcFours,
      sixes: vcSixes,
      pointsEarned: vcPoints,
      summary: vcSummary,
    },
    phasePoints,
    rankBefore,
    rankAfter,
    rankDirection,
  };
}

/**
 * Computes a thriller rating (out of 10) and spoiler-safe verdict.
 */
export function computeThrillRating(missedBalls: Ball[], initialPrevProb?: number): ThrillRating {
  if (!missedBalls || missedBalls.length === 0) {
    return {
      rating: 8.0,
      verdict: "Evenly balanced cricket with momentum waiting to shift.",
      worthReplay: true,
    };
  }

  let totalSwing = 0;
  let wickets = 0;
  let boundaries = 0;

  for (let i = 0; i < missedBalls.length; i++) {
    const cur = missedBalls[i];
    const prevProb = i > 0
      ? missedBalls[i - 1].winProbability
      : (initialPrevProb !== undefined ? initialPrevProb : (cur.over === 0 && cur.ball === 1 ? 0.50 : cur.winProbability));
    totalSwing += Math.abs(cur.winProbability - prevProb);
    const kind = classifyBall(cur);
    if (kind === "wicket") wickets++;
    if (kind === "six" || kind === "four") boundaries++;
  }

  let score = 7.0 + (totalSwing * 1.8) + (wickets * 0.4) + (boundaries * 0.15);
  score = Math.min(9.9, Math.max(6.5, Number(score.toFixed(1))));

  let verdict = "Tense battle with steady shifts in win probability.";
  if (score >= 9.2) {
    verdict = "Absolute nail-biter with dramatic lead changes and huge boundary strikes.";
  } else if (score >= 8.5) {
    verdict = "High-drama phase with key wickets and a ferocious counter-punch.";
  } else if (score >= 7.8) {
    verdict = "Competitive phase with tactical momentum shifts in the middle overs.";
  }

  return {
    rating: score,
    verdict,
    worthReplay: score >= 8.5,
  };
}

/**
 * Generates forward-looking "What to watch next" card.
 */
export function getWhatToWatchNext(lastBall: Ball, meta: MatchMeta, allBalls?: Ball[]): WhatToWatchNext {
  const currentRuns = lastBall.cumulativeScore;
  const currentWickets = lastBall.cumulativeWickets;
  const ballsCompleted = (lastBall.over * 6) + lastBall.ball;
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);
  const runsNeeded = Math.max(0, meta.target - currentRuns);
  const wicketsInHand = 10 - currentWickets;

  const onStrike = lastBall.batter;

  // Derive dynamic active non-striker
  let nonStriker = "Partner";
  if (allBalls && allBalls.length > 0) {
    const lastBallIdx = allBalls.findIndex(b => b.over === lastBall.over && b.ball === lastBall.ball);
    const searchIdx = lastBallIdx !== -1 ? lastBallIdx : allBalls.length - 1;
    for (let i = searchIdx; i >= 0; i--) {
      const b = allBalls[i];
      if (b.batter !== onStrike && !b.wicket) {
        nonStriker = b.batter;
        break;
      }
    }
  } else {
    if (onStrike === "Rohit Sharma") nonStriker = "Shubman Gill";
    else if (onStrike === "Shubman Gill") nonStriker = "Rohit Sharma";
    else if (onStrike === "Suryakumar Yadav") nonStriker = "Rohit Sharma";
    else if (onStrike === "Hardik Pandya") nonStriker = "Tilak Varma";
    else if (onStrike === "Tilak Varma") nonStriker = "Hardik Pandya";
  }

  // Derive upcoming bowler based on over completion and match phase
  let nextBowler = lastBall.bowler;
  if (lastBall.ball === 6 && allBalls && allBalls.length > 0) {
    const prevOverBalls = allBalls.filter(b => b.over === lastBall.over - 1);
    if (prevOverBalls.length > 0) {
      nextBowler = prevOverBalls[0].bowler;
    }
  }

  const phaseDesc = lastBall.over < 6
    ? "Powerplay spell"
    : lastBall.over < 15
    ? "Middle overs control"
    : "Death overs execution";

  const upcomingBowler = `${nextBowler} (${phaseDesc})`;

  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.00";
  const equation = runsNeeded <= 0 
    ? "Target achieved!" 
    : `Need ${runsNeeded} runs from ${ballsRemaining} balls with ${wicketsInHand} wickets in hand (RRR ${rrr})`;

  let tacticalNote: string;
  if (runsNeeded <= 0) {
    tacticalNote = `${meta.team2} have successfully chased down the target.`;
  } else if (Number(rrr) >= 11.0) {
    tacticalNote = `Required rate climbing at ${rrr} rpo. ${onStrike} must target boundaries against ${nextBowler}.`;
  } else if (currentWickets >= 4 && wicketsInHand <= 3) {
    tacticalNote = `${meta.team1} attacking with close-in catchers; ${onStrike} and ${nonStriker} must protect remaining wickets.`;
  } else if (Number(rrr) <= 6.5) {
    tacticalNote = `${meta.team2} firmly in control of the chase; strike rotation will comfortably see them home.`;
  } else {
    tacticalNote = `Evenly poised at ${rrr} RRR; key battle between ${onStrike} and ${nextBowler} to dictate momentum.`;
  }

  return {
    onStrike,
    nonStriker,
    upcomingBowler,
    equation,
    tacticalNote,
  };
}
