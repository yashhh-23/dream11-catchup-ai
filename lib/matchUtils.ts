import type { Ball, TurningPointMoment } from "../types/index.ts";

/**
 * Slices balls for overs in [fromOver, toOver)
 * Note: over is 0-indexed (e.g., fromOver = 4 means from over 5, toOver = 14 means up to end of over 14)
 */
export function sliceBalls(balls: Ball[], fromOver: number, toOver: number): Ball[] {
  return balls.filter(b => b.over >= fromOver && b.over < toOver);
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
 * Computes deterministic fallback moments if the AI generation encounters an error or rate limit
 */
export function getTopMomentsFallback(balls: Ball[], maxMoments = 3): TurningPointMoment[] {
  if (!balls || balls.length === 0) return [];

  // Track swing deltas between consecutive balls or wickets/sixes
  const candidates: { ball: Ball; prevProb: number; delta: number }[] = [];

  for (let i = 0; i < balls.length; i++) {
    const cur = balls[i];
    const prevProb = i > 0 ? balls[i - 1].winProbability : cur.winProbability;
    const delta = Math.abs(cur.winProbability - prevProb);

    // Boost wickets and sixes priority
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
 * Calculates aggregate statistics for a slice of balls
 */
export function calculateOverStats(balls: Ball[]) {
  if (!balls || balls.length === 0) {
    return { runs: 0, wickets: 0, boundaries: 0, sixes: 0, runRate: "0.0" };
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
  const runRate = oversCount > 0 ? (runs / oversCount).toFixed(2) : "0.0";

  return {
    runs,
    wickets,
    boundaries: fours,
    sixes,
    totalBalls: balls.length,
    runRate,
  };
}
