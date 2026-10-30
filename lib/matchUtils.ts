import type { Ball, TurningPointMoment } from "../types/index.ts";

/**
 * Checks whether a delivery falls within the [fromOver, toOver] window.
 * Supports fractional overs (e.g. 14.2 represents over index 14, ball 2).
 */
export function isBallInRange(ball: Ball, fromOver: number, toOver: number): boolean {
  // fromOver is 0-indexed completed overs (e.g., fromOver = 5 means starting from over 6.1)
  const isAfterStart = ball.over >= fromOver;

  const toCompleted = Math.floor(toOver);
  const toFraction = Math.round((toOver - toCompleted) * 10);

  let isBeforeEnd: boolean;
  if (toFraction > 0) {
    // Fractional over: e.g. 14.2 includes all overs < 14, plus over 14 balls 1..2
    isBeforeEnd = ball.over < toCompleted || (ball.over === toCompleted && ball.ball <= toFraction);
  } else {
    // Integer over: e.g. 14 means all deliveries before over index 14 (i.e. overs 0 to 13 completed)
    isBeforeEnd = ball.over < toCompleted;
  }

  return isAfterStart && isBeforeEnd;
}

/**
 * Slices balls for overs in [fromOver, toOver]
 * Supports both integer over thresholds and fractional ball-precise cutoffs (e.g. 14.2)
 */
export function sliceBalls(balls: Ball[], fromOver: number, toOver: number): Ball[] {
  return balls.filter(b => isBallInRange(b, fromOver, toOver));
}

/**
 * Format completed over and ball into standard cricket notation (e.g., over 9, ball 2 -> "9.2", over 14, ball 2 -> "14.2")
 */
export function formatOver(over: number, ball: number): string {
  return `${over}.${ball}`;
}

/**
 * Formats win probability percentage
 */
export function formatWinProb(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

/**
 * Real-time Mathematical Win-Probability Model for T20 Chases.
 * Evaluates log-odds based on remaining resources, required run rate, and wickets in hand.
 */
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
  const baseRRR = (target / totalBalls) * 6;

  // Match start (0 deliveries bowled) is balanced at 50%
  if (ballsBowled === 0) {
    return 0.50;
  }

  const crr = (currentRuns / ballsBowled) * 6;
  const expectedWickets = (ballsBowled / totalBalls) * 5.5;
  const wicketSurplus = expectedWickets - currentWickets; // positive is good for chasing team

  let z = 0.35 * (crr - rrr) + 0.45 * wicketSurplus;

  // High pressure death overs weighting
  if (ballsRemaining <= 30 && rrr > 10.0) {
    z -= (rrr - 10.0) * 0.35;
  }
  if (currentWickets >= 7) {
    z -= (currentWickets - 6) * 0.5;
  }

  const rawProb = 1 / (1 + Math.exp(-z));

  // Clamp within realistic live match limits (0.01 to 0.99)
  return Math.max(0.01, Math.min(0.99, Number(rawProb.toFixed(2))));
}

/**
 * Computes deterministic turning points from actual ball data
 */
export function getTopMomentsFallback(balls: Ball[], maxMoments = 3): TurningPointMoment[] {
  if (!balls || balls.length === 0) return [];

  // Track swing deltas between consecutive balls or wickets/sixes
  const candidates: { ball: Ball; prevProb: number; delta: number }[] = [];

  for (let i = 0; i < balls.length; i++) {
    const cur = balls[i];
    const prevProb = i > 0 ? balls[i - 1].winProbability : cur.winProbability;
    const delta = Math.abs(cur.winProbability - prevProb);

    // Boost wickets and boundaries priority
    const priorityBoost = cur.wicket ? 0.25 : (cur.runs >= 6 ? 0.15 : (cur.runs >= 4 ? 0.08 : 0));
    candidates.push({
      ball: cur,
      prevProb,
      delta: delta + priorityBoost,
    });
  }

  // Sort descending by swing impact
  candidates.sort((a, b) => b.delta - a.delta);

  const selected = candidates.slice(0, maxMoments);

  return selected.map(({ ball, prevProb }) => {
    let label: TurningPointMoment["label"] = "CRITICAL MOMENT";
    let desc = ball.commentary;
    let impact = "Shifted the match momentum significantly.";

    if (ball.wicket) {
      label = "WICKET";
      desc = `${ball.dismissedPlayer || ball.batter} dismissed (${ball.wicketType || "out"}).`;
      impact = `Major breakthrough for the bowling attack. Win probability dropped to ${formatWinProb(ball.winProbability)}.`;
    } else if (ball.runs >= 6) {
      label = "SIX";
      desc = `Massive SIX by ${ball.batter} off ${ball.bowler}.`;
      impact = `Counter-attacking blow that injected vital momentum into the chase.`;
    } else if (ball.runs >= 4) {
      label = "BOUNDARY";
      desc = `Boundary struck by ${ball.batter} off ${ball.bowler}.`;
      impact = `Relieved required-rate pressure.`;
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

/**
 * Calculates aggregate statistics for a slice of balls.
 * Note: runRate is returned as a number to eliminate string comparison bugs.
 */
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
    if (b.wicket) wickets++;
    if (b.runs >= 4 && b.runs < 6) fours++;
    if (b.runs >= 6) sixes++;
  });

  const oversCount = balls.length / 6;
  const runRate = oversCount > 0 ? Number((runs / oversCount).toFixed(2)) : 0;

  return {
    runs,
    wickets,
    boundaries: fours,
    sixes,
    totalBalls: balls.length,
    runRate, // number
    runRateFormatted: runRate.toFixed(2), // formatted string
  };
}

/**
 * Verifies that all players and over numbers in the moments exist in the actual ball data
 */
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
