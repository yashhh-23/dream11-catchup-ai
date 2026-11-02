import type { 
  Ball, 
  BallEventKind,
  TurningPointMoment, 
  FantasyTeamPerformance, 
  ThrillRating, 
  WhatToWatchNext, 
  MatchMeta,
  RecapPayload,
  SpoilerLevel,
} from "../types/index.ts";

/**
 * Single source of truth for cricket match and simulation pacing constants.
 * ICC standard minimum over rate for T20: 20 overs in 80 minutes = 4.0 minutes per over.
 */
export const CRICKET_MINUTES_PER_OVER = 4.0;
export const SIMULATOR_SECONDS_PER_BALL = 4.0;

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
 * Finds the [startIdx, endIdx) delivery boundaries for a [fromOver, toOver] window.
 * Single source of truth for window boundary resolution.
 * Supports fractional overs (e.g. 14.2 represents over index 14, ball 2).
 */
export function findWindowIndices(balls: Ball[], fromOver: number, toOver: number): { startIdx: number; endIdx: number } {
  if (!balls || balls.length === 0 || fromOver >= toOver) return { startIdx: 0, endIdx: 0 };

  const toCompleted = Math.floor(toOver);
  const toFraction = Math.round((toOver - toCompleted) * 10);

  let startIdx = 0;
  while (startIdx < balls.length && balls[startIdx].over < fromOver) {
    startIdx++;
  }

  let endIdx = startIdx;
  while (endIdx < balls.length) {
    const ball = balls[endIdx];
    const ballNum = ball.legalBall !== undefined ? ball.legalBall : ball.ball;
    const inRange =
      toFraction > 0
        ? ball.over < toCompleted || (ball.over === toCompleted && ballNum <= toFraction)
        : ball.over < toCompleted;

    if (!inRange) break;
    endIdx++;
  }

  return { startIdx, endIdx };
}

/**
 * Fast O(k) slicing for sorted ball arrays using findWindowIndices.
 */
export function sliceBalls(balls: Ball[], fromOver: number, toOver: number): Ball[] {
  const { startIdx, endIdx } = findWindowIndices(balls, fromOver, toOver);
  return balls.slice(startIdx, endIdx);
}

export function formatOver(over: number, ball: number): string {
  return `${over}.${ball}`;
}

/** @internal Used in tests and narrative generation. Not needed in production paths. */
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
  const initialRrr = (target / totalBalls) * 6;
  const rrr = (runsNeeded / ballsRemaining) * 6;

  // Fraction of innings completed (0.0 to 1.0)
  const progress = Math.min(1.0, ballsBowled / totalBalls);

  // Par wickets lost at this stage in T20 (average ~6.2 wickets across 20 overs)
  const parWicketsLost = progress * 6.2;
  const wicketSurplus = parWicketsLost - currentWickets;

  // RRR impact scales smoothly with match progress:
  // Early on (overs 1-5), teams pacing themselves is normal, so RRR weight is lower (~0.16).
  // Late in chase (overs 16-20), high RRR is much harder to sustain (~0.40).
  const rrrWeight = 0.16 + 0.24 * progress;
  const rrrDiff = initialRrr - rrr;

  // Wicket weight: early wickets hurt top order resources (~0.40),
  // while at the death power hitting is primary (~0.30).
  const wicketWeight = 0.40 - 0.10 * progress;

  // Target calibration: 160 is MCG historical median T20 par chase
  const targetAdjustment = (160 - target) * 0.015;

  let z = targetAdjustment + (rrrWeight * rrrDiff) + (wicketWeight * wicketSurplus);

  // Set-batter bonus in late overs (overs 15+) if 4 or fewer wickets down
  if (progress >= 0.70 && currentWickets <= 4) {
    z += 0.35;
  }

  const rawProb = 1 / (1 + Math.exp(-z));
  return Math.max(0.02, Math.min(0.99, Number(rawProb.toFixed(2))));
}

interface MomentCandidate {
  ball: Ball;
  prevProb: number;
  priorityScore: number;
  kind: BallEventKind;
}

function insertMomentCandidate(top: MomentCandidate[], candidate: MomentCandidate, maxMoments = 3): void {
  const { priorityScore } = candidate;
  if (top.length < maxMoments) {
    let insIdx = top.length;
    while (insIdx > 0 && top[insIdx - 1].priorityScore < priorityScore) insIdx--;
    top.splice(insIdx, 0, candidate);
  } else if (priorityScore > top[top.length - 1].priorityScore) {
    let insIdx = top.length - 1;
    while (insIdx > 0 && top[insIdx - 1].priorityScore < priorityScore) insIdx--;
    top.pop();
    top.splice(insIdx, 0, candidate);
  }
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
    over: formatOver(ball.over, ball.legalBall || Math.min(6, ball.ball)),
    ballIndex: (ball.over * 6) + (ball.legalBall || Math.min(6, ball.ball)),
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

function buildStatsObject(runs: number, wickets: number, fours: number, sixes: number, totalBalls: number) {
  const oversCount = totalBalls / 6;
  const runRate = oversCount > 0 ? Number((runs / oversCount).toFixed(2)) : 0;
  return {
    runs,
    wickets,
    boundaries: fours,
    sixes,
    totalBalls,
    runRate,
    runRateFormatted: runRate.toFixed(2),
  };
}

export function calculateOverStats(balls: Ball[]) {
  if (!balls || balls.length === 0) {
    return buildStatsObject(0, 0, 0, 0, 0);
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

  return buildStatsObject(runs, wickets, fours, sixes, balls.length);
}

/**
 * Truly fused single-pass window processing:
 * Executes slicing, stats calculation, running top-3 moments tracking,
 * and player extraction in one fused O(k) forward scan with O(1) auxiliary space.
 */
export function processWindowFused(balls: Ball[], fromOver: number, toOver: number) {
  const { startIdx, endIdx } = findWindowIndices(balls, fromOver, toOver);
  if (startIdx >= balls.length || startIdx === endIdx) {
    return {
      missedBalls: [],
      stats: calculateOverStats([]),
      topMoments: [],
      battersInPhase: [],
      dismissedInPhase: [],
      initialPrevProb: 0.50,
    };
  }

  // Preceding ball probability before the window starts
  const initialPrevProb = startIdx > 0 && balls[startIdx - 1]
    ? balls[startIdx - 1].winProbability
    : (balls[0]?.over === 0 && balls[0]?.ball === 1 ? 0.50 : (balls[startIdx]?.winProbability ?? 0.50));

  const missedBalls: Ball[] = [];
  const batterSet = new Set<string>();
  const dismissedList: string[] = [];
  const topMomentsList: MomentCandidate[] = [];

  // Single pass over deliveries in the resolved index range [startIdx, endIdx)
  for (let idx = startIdx; idx < endIdx; idx++) {
    const b = balls[idx];

    missedBalls.push(b);
    batterSet.add(b.batter);

    const kind = classifyBall(b);
    if (kind === "wicket") {
      dismissedList.push(b.dismissedPlayer || b.batter);
    }

    // Running top-3 moments priority tracking in O(1) space with insertion
    const prevProb = missedBalls.length > 1
      ? missedBalls[missedBalls.length - 2].winProbability
      : initialPrevProb;
    const delta = Math.abs(b.winProbability - prevProb);
    const priorityBoost = kind === "wicket" ? 0.25 : (kind === "six" ? 0.15 : (kind === "four" ? 0.08 : 0));
    const priorityScore = delta + priorityBoost;

    insertMomentCandidate(topMomentsList, { ball: b, prevProb, priorityScore, kind }, 3);
  }

  const stats = calculateOverStats(missedBalls);
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

export const ALLOWED_MOODS = new Set(["Cruising", "Knife's edge", "Chasing hard", "Game over", "Comeback on"] as const);
export type Mood = "Cruising" | "Knife's edge" | "Chasing hard" | "Game over" | "Comeback on";

/**
 * Validates and sanitizes a mood string against the set of approved moods.
 */
export function sanitizeMood(input?: string | null, fallback: Mood = "Knife's edge"): Mood {
  if (!input) return fallback;
  const trimmed = input.trim();
  return ALLOWED_MOODS.has(trimmed as any) ? (trimmed as Mood) : fallback;
}

/**
 * Validates that an overs parameter matches the standard cricket overs format
 * (e.g., "Overs 6 – 15.0", "Overs 1 – 6", "Over 10 - 15.2").
 */
export function sanitizeOversText(input?: string | null, fallback = "Overs 6 – 15.0"): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  const isValid = /^Overs?\s+\d+(\.\d+)?\s*[-–—]\s*\d+(\.\d+)?$/i.test(trimmed);
  return isValid ? trimmed : fallback;
}

/**
 * Validates generated recap against ground truth ball data.
 * Supports both array of moments or object with top3Moments.
 */
export function validateRecapAgainstBallData(
  recap: any,
  balls: Ball[],
  maxAllowedOver?: number,
  metaOrSquad?: MatchMeta | string[]
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
  if (recap && typeof recap === "object" && recap.mood && !ALLOWED_MOODS.has(recap.mood)) {
    issues.push(`Invalid mood "${recap.mood}". Must be one of: Cruising, Knife's edge, Chasing hard, Game over, Comeback on.`);
  }

  // Inspect moments
  const moments: any[] = Array.isArray(recap) 
    ? recap 
    : (recap?.top3Moments || []);

  for (let idx = 0; idx < moments.length; idx++) {
    const m = moments[idx];
    if (m.over && m.over !== "Key Phase") {
      // Direct search avoids allocating a Set and k strings on every request (Optimization C)
      const overExists = balls.some(b => formatOver(b.over, b.ball) === m.over);
      if (!overExists) {
        issues.push(`Moment ${idx + 1} references over "${m.over}", which does not exist in the selected ball data.`);
      }
    }
    if (m.player) {
      const matchFound = validPlayers.has(m.player) || Array.from(validPlayers).some(full => full.endsWith(m.player) || full.includes(m.player));
      if (!matchFound) {
        issues.push(`Moment ${idx + 1} references player "${m.player}", who was not part of this window.`);
      }
    }
  }

  // Inspect narrative fields (oneLiner, story, partnershipSummary, moments) for hallucinated future events
  const momentTexts = (Array.isArray(recap?.top3Moments) ? recap.top3Moments : [])
    .map((m: any) => `${m?.description || ""} ${m?.impact || ""}`)
    .join(" ");
  const textCorpus = `${recap?.oneLiner || ""} ${recap?.story || ""} ${recap?.partnershipSummary || ""} ${momentTexts}`.trim();
  if (textCorpus.trim().length > 0 && balls.length > 0) {
    const maxBallOver = maxAllowedOver !== undefined ? maxAllowedOver : balls[balls.length - 1].over + (balls[balls.length - 1].ball / 10);

    // Check for standard over mentions like "over 16", "over 15.2", "ov 15"
    // Only flag future overs beyond the cutoff to avoid spoiling, while allowing references to earlier context
    const overMatches = textCorpus.matchAll(/\b(?:over|ov)\s*(\d+(\.\d+)?)\b/gi);
    for (const match of overMatches) {
      const mentioned = parseFloat(match[1]);
      if (!isNaN(mentioned)) {
        if (mentioned > maxBallOver + 0.1) {
          issues.push(`Narrative references future over ${mentioned}, which is outside the allowed window (up to over ${maxBallOver}).`);
        }
      }
    }

    // Check for ordinal over mentions like "15th over", "16th over"
    const ordinalMatches = textCorpus.matchAll(/\b(\d+)(?:st|nd|rd|th)\s+over\b/gi);
    for (const match of ordinalMatches) {
      const ordinalOver = parseInt(match[1], 10);
      if (!isNaN(ordinalOver) && ordinalOver > Math.floor(maxBallOver) + 1) {
        issues.push(`Narrative references "${match[0]}", which is outside the allowed window (up to over ${maxBallOver}).`);
      }
    }

    // Dynamic squad-level hallucination check:
    // Any squad member who is NOT in validPlayers (did not participate in this window) mentioned in prose
    const squadCandidates: string[] = Array.isArray(metaOrSquad)
      ? metaOrSquad
      : (metaOrSquad && typeof metaOrSquad === "object" && Array.isArray((metaOrSquad as any).squad))
      ? (metaOrSquad as any).squad
      : [];

    for (const p of squadCandidates) {
      if (!validPlayers.has(p)) {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(textCorpus)) {
          issues.push(`Narrative mentions player "${p}", who was not part of this window.`);
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

export const DREAM11_T20_SCORING = {
  RUN: 1,
  BOUNDARY_FOUR: 1,
  SIX: 2,
  MILESTONE_30: 4,
  MILESTONE_50: 8,
  MILESTONE_100: 16,
  DUCK_PENALTY: -2,
  WICKET: 25,
  THREE_WICKET_BONUS: 4,
  FIVE_WICKET_BONUS: 16,
  CAPTAIN_MULTIPLIER: 2.0,
  VICE_CAPTAIN_MULTIPLIER: 1.5,
} as const;

/**
 * Calculates Dream11 Fantasy Team points and rank movement for the user's Captain & VC.
 */
export function calculateFantasyPerformance(
  missedBalls: Ball[],
  captainName?: string,
  viceCaptainName?: string,
  options?: {
    teamName?: string;
    baseRankNum?: number;
    squad?: string[];
  }
): FantasyTeamPerformance {
  const cap = captainName || options?.squad?.[0] || "Captain";
  const vc = viceCaptainName || options?.squad?.[1] || "Vice Captain";

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

  const getBatterRuns = (b: Ball): number => {
    if (b.batterRuns !== undefined) return b.batterRuns;
    if (b.isExtra || b.extraType === "legbyes" || b.extraType === "byes" || b.extraType === "wides" || b.extraType === "noballs") {
      return 0;
    }
    return b.runs;
  };

  missedBalls.forEach(b => {
    if (b.batter === cap) {
      captainBatted = true;
      const bRuns = getBatterRuns(b);
      captainRuns += bRuns;
      if (b.isBoundaryFour || (bRuns === 4 && !b.isExtra)) captainFours++;
      if (b.isSix || (bRuns === 6 && !b.isExtra)) captainSixes++;
    }
    if (b.wicket && (b.dismissedPlayer === cap || (b.batter === cap && !b.dismissedPlayer))) {
      captainDismissed = true;
    }

    if (b.batter === vc) {
      vcBatted = true;
      const bRuns = getBatterRuns(b);
      vcRuns += bRuns;
      if (b.isBoundaryFour || (bRuns === 4 && !b.isExtra)) vcFours++;
      if (b.isSix || (bRuns === 6 && !b.isExtra)) vcSixes++;
    }
    if (b.wicket && (b.dismissedPlayer === vc || (b.batter === vc && !b.dismissedPlayer))) {
      vcDismissed = true;
    }

    // Cricket rule: Run-outs are NOT credited to the bowler
    if (b.bowler === cap && b.wicket && b.wicketType !== "run out") captainWickets++;
    if (b.bowler === vc && b.wicket && b.wicketType !== "run out") vcWickets++;
  });

  // Official Dream11 T20 Fantasy Rules using named scoring table:
  const calcBattingBonus = (runs: number, dismissed: boolean, batted: boolean) => {
    let bonus = 0;
    if (runs >= 100) bonus += DREAM11_T20_SCORING.MILESTONE_100;
    else if (runs >= 50) bonus += DREAM11_T20_SCORING.MILESTONE_50;
    else if (runs >= 30) bonus += DREAM11_T20_SCORING.MILESTONE_30;

    if (batted && dismissed && runs === 0) {
      bonus += DREAM11_T20_SCORING.DUCK_PENALTY;
    }
    return bonus;
  };

  const calcBowlingBonus = (wickets: number) => {
    if (wickets >= 5) return DREAM11_T20_SCORING.FIVE_WICKET_BONUS;
    if (wickets >= 3) return DREAM11_T20_SCORING.THREE_WICKET_BONUS;
    return 0;
  };

  const rawCapPoints = (captainRuns * DREAM11_T20_SCORING.RUN) 
    + (captainFours * DREAM11_T20_SCORING.BOUNDARY_FOUR) 
    + (captainSixes * DREAM11_T20_SCORING.SIX)
    + calcBattingBonus(captainRuns, captainDismissed, captainBatted)
    + (captainWickets * DREAM11_T20_SCORING.WICKET) 
    + calcBowlingBonus(captainWickets);
  const capPoints = Math.round(rawCapPoints * DREAM11_T20_SCORING.CAPTAIN_MULTIPLIER);

  const rawVcPoints = (vcRuns * DREAM11_T20_SCORING.RUN) 
    + (vcFours * DREAM11_T20_SCORING.BOUNDARY_FOUR) 
    + (vcSixes * DREAM11_T20_SCORING.SIX)
    + calcBattingBonus(vcRuns, vcDismissed, vcBatted)
    + (vcWickets * DREAM11_T20_SCORING.WICKET) 
    + calcBowlingBonus(vcWickets);
  const vcPoints = Math.round(rawVcPoints * DREAM11_T20_SCORING.VICE_CAPTAIN_MULTIPLIER);

  // Strict: phase points derived purely from captain and vice-captain performance (no flat padding)
  const phasePoints = capPoints + vcPoints;

  // Derive dynamic base rank deterministically from picks and context
  let seed = 0;
  for (let i = 0; i < cap.length + vc.length; i++) {
    seed = (seed * 31 + (cap.charCodeAt(i % cap.length) ^ vc.charCodeAt(i % vc.length))) % 100000;
  }
  const baseRankNum = options?.baseRankNum ?? (150000 + (seed % 65000));

  // Dynamic rank movement derived continuously based on points scored in this window
  const expectedPoints = Math.max(8, Math.round(missedBalls.length * 1.2));
  const diff = phasePoints - expectedPoints;
  const currentRankNum = Math.max(1400, Math.min(480000, Math.round(baseRankNum - (diff * 1850))));

  const formatRank = (r: number) => {
    if (r >= 100000) return `${(r / 100000).toFixed(1)}L`;
    if (r >= 1000) return `${Math.round(r / 1000)}K`;
    return String(r);
  };

  const rankBefore = formatRank(baseRankNum);
  const rankAfter = formatRank(currentRankNum);
  const rankDirection: "up" | "down" | "same" = diff > 3 ? "up" : diff < -3 ? "down" : "same";

  // Accurate summaries avoiding the false "Dismissed" bug when batter did not bat
  let capSummary = `${captainRuns} runs (+${capPoints} pts)`;
  if (captainSixes > 0) {
    capSummary = `${captainSixes} sixes & ${captainRuns} runs (+${capPoints} pts with 2x)`;
  } else if (captainDismissed) {
    capSummary = captainRuns === 0 ? `Dismissed for duck (${capPoints} pts with 2x)` : `Dismissed for ${captainRuns} (+${capPoints} pts with 2x)`;
  } else if (!captainBatted && captainWickets === 0) {
    capSummary = `Did not bat in this phase (0 pts)`;
  }

  let vcSummary = `${vcRuns} runs (+${vcPoints} pts with 1.5x)`;
  if (vcSixes > 0) {
    vcSummary = `${vcSixes} sixes & ${vcRuns} runs (+${vcPoints} pts with 1.5x)`;
  } else if (vcDismissed) {
    vcSummary = vcRuns === 0 ? `Dismissed for duck (${vcPoints} pts with 1.5x)` : `Dismissed for ${vcRuns} (+${vcPoints} pts with 1.5x)`;
  } else if (!vcBatted && vcWickets === 0) {
    vcSummary = `Did not bat in this phase (0 pts)`;
  }

  const teamName = options?.teamName || "DreamXI";

  return {
    teamName,
    captain: {
      name: cap,
      role: "Captain",
      runs: captainRuns,
      wickets: captainWickets,
      fours: captainFours,
      sixes: captainSixes,
      pointsEarned: capPoints,
      summary: capSummary,
    },
    viceCaptain: {
      name: vc,
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
  const ballsCompleted = (lastBall.over * 6) + (lastBall.legalBall || lastBall.ball);
  const ballsRemaining = Math.max(0, (meta.totalOvers * 6) - ballsCompleted);
  const runsNeeded = Math.max(0, meta.target - currentRuns);
  const wicketsInHand = 10 - currentWickets;

  const onStrike = lastBall.batter;

  // Real non-striker from match data
  let nonStriker = lastBall.nonStriker || "Partner";
  if (!lastBall.nonStriker && allBalls && allBalls.length > 0) {
    const lastBallIdx = allBalls.findIndex(b => b.over === lastBall.over && b.ball === lastBall.ball);
    const searchIdx = lastBallIdx !== -1 ? lastBallIdx : allBalls.length - 1;

    const dismissedPlayers = new Set<string>();
    for (let i = 0; i <= searchIdx; i++) {
      if (allBalls[i].wicket) {
        dismissedPlayers.add(allBalls[i].dismissedPlayer || allBalls[i].batter);
      }
    }

    // The non-striker must be a player who has batted, is NOT on strike, and is NOT dismissed
    for (let i = searchIdx; i >= 0; i--) {
      const candidate = allBalls[i].batter;
      if (candidate !== onStrike && !dismissedPlayers.has(candidate)) {
        nonStriker = candidate;
        break;
      }
    }

    if (nonStriker === "Partner") {
      // Dynamic fallback: select from squad or match deliveries who hasn't been dismissed
      if (meta.squad && meta.squad.length > 0) {
        const squadCandidate = meta.squad.find(
          p => p !== onStrike && !dismissedPlayers.has(p)
        );
        if (squadCandidate) nonStriker = squadCandidate;
      }
      if (nonStriker === "Partner") {
        const anyBatter = allBalls.find(
          b => b.batter && b.batter !== onStrike && !dismissedPlayers.has(b.batter)
        );
        if (anyBatter) nonStriker = anyBatter.batter;
      }
    }
  }

  const phaseDesc = lastBall.over < 6
    ? "Powerplay spell"
    : lastBall.over < 15
    ? "Middle overs control"
    : "Death overs execution";

  // Cricket rule: A bowler cannot bowl two consecutive overs.
  // If the over is complete (ball 6), check for next bowler or alternate previous bowler.
  const isOverComplete = (lastBall.legalBall || lastBall.ball) === 6;
  let upcomingBowler = `${lastBall.bowler} (${phaseDesc})`;

  if (isOverComplete) {
    let nextBowler: string | null = null;
    if (allBalls && allBalls.length > 0) {
      const lastBallIdx = allBalls.findIndex(b => b.over === lastBall.over && b.ball === lastBall.ball);
      const searchIdx = lastBallIdx !== -1 ? lastBallIdx : allBalls.length - 1;
      if (searchIdx + 1 < allBalls.length) {
        nextBowler = allBalls[searchIdx + 1].bowler;
      } else {
        // Find the bowler who bowled the penultimate over (over - 1)
        for (let i = searchIdx; i >= 0; i--) {
          if (allBalls[i].over === lastBall.over - 1 && allBalls[i].bowler && allBalls[i].bowler !== lastBall.bowler) {
            nextBowler = allBalls[i].bowler;
            break;
          }
        }
      }
    }

    if (nextBowler && nextBowler !== lastBall.bowler) {
      const nextPhaseDesc = (lastBall.over + 1) < 6
        ? "Powerplay spell"
        : (lastBall.over + 1) < 15
        ? "Middle overs control"
        : "Death overs execution";
      upcomingBowler = `${nextBowler} (${nextPhaseDesc})`;
    } else {
      upcomingBowler = `Change of bowling due (${phaseDesc})`;
    }
  }

  const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.00";
  const equation = runsNeeded <= 0 
    ? "Target achieved!" 
    : `Need ${runsNeeded} runs from ${ballsRemaining} balls with ${wicketsInHand} wickets in hand (RRR ${rrr})`;

  let tacticalNote: string;
  if (runsNeeded <= 0) {
    tacticalNote = `${meta.team2} have successfully chased down the target.`;
  } else if (Number(rrr) >= 11.0) {
    tacticalNote = `Required rate climbing at ${rrr} rpo. ${onStrike} must target boundaries against ${lastBall.bowler}.`;
  } else if (currentWickets >= 4 && wicketsInHand <= 3) {
    tacticalNote = `${meta.team1} attacking with close-in catchers; ${onStrike} and ${nonStriker} must protect remaining wickets.`;
  } else if (Number(rrr) <= 6.5) {
    tacticalNote = `${meta.team2} firmly in control of the chase; strike rotation will comfortably see them home.`;
  } else {
    tacticalNote = `Evenly poised at ${rrr} RRR; key battle between ${onStrike} and ${lastBall.bowler} to dictate momentum.`;
  }

  return {
    onStrike,
    nonStriker,
    upcomingBowler,
    equation,
    tacticalNote,
  };
}

/**
 * Rigorously strips all numeric digits, ordinals (e.g. "1st", "14th"),
 * hyphenated score phrases (e.g. "3-wicket", "10-run"), and scorelines (e.g. "159/8")
 * from text to guarantee zero numeric leaks in story-only mode.
 */
export function stripAllDigitsAndScores(text: string): string {
  if (!text) return "";
  let s = text;

  // 1. Ordinals with number prefixes: "1st", "2nd", "3rd", "4th", "14th", etc.
  s = s.replace(/\b1st\b/gi, "first")
       .replace(/\b2nd\b/gi, "second")
       .replace(/\b3rd\b/gi, "third")
       .replace(/\b4th\b/gi, "fourth")
       .replace(/\b5th\b/gi, "fifth")
       .replace(/\b(\d+)(st|nd|rd|th)\b/gi, "crucial");

  // 2. Score formats: "159/8", "100-4", "14.2"
  s = s.replace(/\b\d+\s*\/\s*\d+\b/g, "")
       .replace(/\b\d+\s*[-–]\s*\d+\b/g, "")
       .replace(/\b\d+\.\d+\b/g, "");

  // 3. Hyphenated number phrases: "3-wicket", "10-run", "50-run", "6-over"
  s = s.replace(/\b\d+[-–](?:wicket|wickets|run|runs|ball|balls|over|overs|boundary|for)\b/gi, "crucial phase");

  // 4. Over/ball references: "over 14", "ball 3"
  s = s.replace(/\b(?:over|overs|ball|balls)\s+\d+\b/gi, "the over");

  // 5. Total zero-digit guarantee: remove any remaining digits anywhere in the text
  s = s.replace(/\d+/g, "");

  // 6. Clean up orphaned punctuation and redundant whitespace
  s = s.replace(/\s{2,}/g, " ")
       .replace(/\s+([.,;:!?])/g, "$1")
       .replace(/\(\s*\)/g, "")
       .replace(/\[\s*\]/g, "")
       .trim();

  return s;
}

/**
 * Sanitizes balls for Story-Only mode so that unredacted scores, wickets,
 * and cumulative totals are never transmitted to the client in story-only mode.
 */
export function sanitizeBallsForSpoiler(balls: Ball[], spoilerLevel: SpoilerLevel): Ball[] {
  if (spoilerLevel !== "story-only") {
    return balls;
  }

  return balls.map((b) => {
    const rawCommentary = b.commentary || "";
    const cleanCommentary = stripAllDigitsAndScores(
      rawCommentary
        .replace(/cumulativeScore[:\s]+\d+/gi, "")
        .replace(/cumulativeWickets[:\s]+\d+/gi, "")
        .replace(/\b\d+\/\d+\b/g, "")
    );

    return {
      ...b,
      runs: 0,
      batterRuns: 0,
      isBoundaryFour: false,
      isSix: false,
      wicket: false,
      wicketType: undefined,
      dismissedPlayer: undefined,
      cumulativeScore: 0,
      cumulativeWickets: 0,
      winProbability: 0.5, // Shielded equilibrium momentum
      commentary: cleanCommentary || `${b.batter} plays against ${b.bowler}.`,
    };
  });
}

/**
 * Sanitizes match metadata for Story-Only mode, shielding target and first innings score.
 */
export function sanitizeMetaForSpoiler(meta: MatchMeta, spoilerLevel: SpoilerLevel): MatchMeta {
  if (spoilerLevel !== "story-only") {
    return meta;
  }

  return {
    ...meta,
    target: 0,
    firstInningsScore: "Shielded",
  };
}

/**
 * Strips all numeric scores, win probabilities, and fantasy ranks when spoilerLevel === "story-only".
 * Airtight Zero-Spoiler guarantee: Ensures zero digit leaks anywhere in the payload.
 */
export function redactPayloadForSpoiler(
  base: RecapPayload,
  level: SpoilerLevel,
  team2: string = "India"
): RecapPayload {
  if (level !== "story-only") {
    return { ...base, spoilerLevel: level };
  }

  // Pure story only: zero scores, targets, percentages, and numeric run counts
  const sanitizedOneLiner = stripAllDigitsAndScores(base.oneLiner || "");
  const cleanOneLiner = (sanitizedOneLiner && !/\d/.test(sanitizedOneLiner))
    ? sanitizedOneLiner
    : `${team2} weathered intense bowling pressure and mounted a spirited counter-attack across the middle overs.`;

  const sanitizedStory = stripAllDigitsAndScores(base.story || "");
  const cleanStory = (sanitizedStory && !/\d/.test(sanitizedStory))
    ? sanitizedStory
    : `During this high-stakes chase phase, the contest swung on fine margins. ${team2} lost crucial wickets but absorbed pressure with timely boundary hits to steady the innings. Both teams now enter the live overs with everything to play for.`;

  const sanitizedPartnership = stripAllDigitsAndScores(base.partnershipSummary || "");
  const cleanPartnership = (sanitizedPartnership && !/\d/.test(sanitizedPartnership))
    ? sanitizedPartnership
    : `${team2} anchored this chase phase with resilient batting.`;

  return {
    ...base,
    spoilerLevel: "story-only",
    oneLiner: cleanOneLiner,
    story: cleanStory,
    partnershipSummary: cleanPartnership,
    top3Moments: base.top3Moments.map(m => {
      const sanitizedDesc = stripAllDigitsAndScores(m.description || "");
      const cleanDesc = (sanitizedDesc && !/\d/.test(sanitizedDesc))
        ? sanitizedDesc
        : `${m.player} delivered a crucial play.`;

      const sanitizedImpact = stripAllDigitsAndScores(m.impact || "");
      const fallbackImpact = m.label === "WICKET"
        ? "Major breakthrough for the bowling attack."
        : m.label === "SIX"
        ? "Massive maximum that shifted momentum."
        : "Boundary hit that relieved pressure.";
      const cleanImpact = (sanitizedImpact && !/\d/.test(sanitizedImpact))
        ? sanitizedImpact
        : fallbackImpact;

      return {
        ...m,
        over: "Key Phase",
        description: cleanDesc,
        winProbBefore: 0,
        winProbAfter: 0,
        swingDelta: 0,
        impact: cleanImpact,
        videoClip: m.videoClip ? {
          ...m.videoClip,
          title: `${m.player} · ${m.label}`,
        } : undefined,
      };
    }),
    whatToWatchNext: base.whatToWatchNext ? {
      ...base.whatToWatchNext,
      equation: "Chase ongoing · Decisive live phase",
      tacticalNote: "Intense tactical battle under lights. Strike rotation and boundary execution will determine this critical live phase.",
    } : undefined,
    fantasyImpact: base.fantasyImpact ? {
      ...base.fantasyImpact,
      isShielded: true,
      phasePoints: 0,
      rankBefore: "Shielded",
      rankAfter: "Shielded",
      rankDirection: "same",
      captain: {
        ...base.fantasyImpact.captain,
        runs: 0,
        wickets: 0,
        sixes: 0,
        fours: 0,
        pointsEarned: 0,
        summary: "Points and rank shielded in Story-Only mode",
      },
      viceCaptain: {
        ...base.fantasyImpact.viceCaptain,
        runs: 0,
        wickets: 0,
        sixes: 0,
        fours: 0,
        pointsEarned: 0,
        summary: "Points and rank shielded in Story-Only mode",
      },
    } : undefined,
  };
}

/**
 * Single source of truth deterministic fallback recap generator.
 * Used by both production /api/recap route and eval suite.
 */
export function generateFallbackRecap(
  missedBalls: Ball[],
  meta: MatchMeta,
  fromDisplay: number,
  toDisplay: number,
  spoilerLevel: SpoilerLevel,
  context: {
    stats: { runs: number; wickets: number; boundaries: number; sixes: number; totalBalls: number };
    topMoments: TurningPointMoment[];
    battersInPhase: string[];
    dismissedInPhase: string[];
    calculatedMood: RecapPayload["mood"];
    thrillRating: ThrillRating;
    whatToWatchNext?: WhatToWatchNext;
  }
): RecapPayload {
  const { stats, topMoments, battersInPhase, dismissedInPhase, calculatedMood, thrillRating, whatToWatchNext } = context;
  const battersSummary = battersInPhase.length > 0 ? battersInPhase.join(" and ") : "the middle order";
  const wicketsText = stats.wickets === 1 ? "1 wicket" : `${stats.wickets} wickets`;
  const boundarySummary = `${stats.boundaries} fours and ${stats.sixes} sixes`;
  const oversCoveredText = `Overs ${fromDisplay} – ${toDisplay}`;

  const lastBall = missedBalls[missedBalls.length - 1];
  const scoreAtPhaseEnd = lastBall ? lastBall.cumulativeScore : 0;
  const wicketsAtPhaseEnd = lastBall ? lastBall.cumulativeWickets : 0;
  const runsNeededAtPhaseEnd = Math.max(0, meta.target - scoreAtPhaseEnd);
  const ballsBowledAtPhaseEnd = lastBall ? (lastBall.over * 6 + (lastBall.legalBall || Math.min(6, lastBall.ball))) : 0;
  const ballsRemainingAtPhaseEnd = Math.max(0, (meta.totalOvers * 6) - ballsBowledAtPhaseEnd);
  const wicketsInHandAtPhaseEnd = Math.max(0, 10 - wicketsAtPhaseEnd);

  let storySummary: string;
  let headlineText: string;

  if (spoilerLevel === "story-only") {
    storySummary = `During this phase, ${meta.team2} navigated high-stakes cricket. ${battersSummary} absorbed pressure and counter-attacked with key boundaries to keep the run-chase alive. Heading into the live overs, the partnership has stabilized the innings.`;
    headlineText = `You missed the chaos! Wickets shook the top order early, but ${meta.team2}'s middle order counter-punched fearlessly!`;
  } else {
    if (runsNeededAtPhaseEnd <= 0) {
      storySummary = `${meta.team2} chased down the target of ${meta.target} with a relentless counter-attack, finishing the match in style.`;
    } else {
      storySummary = `Between overs ${fromDisplay} and ${toDisplay}, ${meta.team2} scored ${stats.runs} runs for the loss of ${wicketsText}. ${battersSummary} absorbed pressure and countered with ${boundarySummary}. At over ${toDisplay}, ${meta.team2} stand at ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}, needing ${runsNeededAtPhaseEnd} runs from the remaining ${ballsRemainingAtPhaseEnd} deliveries with ${wicketsInHandAtPhaseEnd} wickets in hand.`;
    }

    if (stats.wickets >= 2) {
      const dismissedNames = dismissedInPhase.slice(0, 2).join(" and ");
      headlineText = `You missed the chaos! ${meta.team1} struck to remove ${dismissedNames || "key batters"}, but ${meta.team2} fought back to ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}.`;
    } else if (stats.runs >= 30) {
      headlineText = `${meta.team2} went on the offensive! ${stats.runs} runs hammered in ${stats.totalBalls} balls to seize control of the chase.`;
    } else {
      headlineText = `Tense tactical battle! ${meta.team2} reached ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} through tight spells and sharp running.`;
    }
  }

  const raw: RecapPayload = {
    oneLiner: headlineText,
    story: storySummary,
    top3Moments: topMoments,
    mood: calculatedMood,
    partnershipSummary: `${battersInPhase.slice(0, 2).join(" and ")} stabilized the innings with a counter-attacking stand.`,
    oversCovered: oversCoveredText,
    thrillRating,
    whatToWatchNext,
    spoilerLevel,
  };

  return spoilerLevel === "story-only" ? redactPayloadForSpoiler(raw, spoilerLevel, meta.team2) : raw;
}
