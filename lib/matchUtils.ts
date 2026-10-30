import type { 
  Ball, 
  TurningPointMoment, 
  FantasyTeamPerformance, 
  ThrillRating, 
  WhatToWatchNext, 
  MatchMeta 
} from "../types/index.ts";

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

/**
 * Calculates Dream11 fantasy team impact for the fan's captain & vice-captain during the missed phase.
 */
export function calculateFantasyPerformance(
  balls: Ball[],
  captainName = "Hardik Pandya",
  vcName = "Rohit Sharma"
): FantasyTeamPerformance {
  let capRuns = 0, capFours = 0, capSixes = 0, capWickets = 0, capOut = false;
  let vcRuns = 0, vcFours = 0, vcSixes = 0, vcWickets = 0, vcOut = false;

  balls.forEach(b => {
    // Captain
    if (b.batter === captainName) {
      capRuns += b.batterRuns;
      if (b.batterRuns === 4) capFours++;
      if (b.batterRuns === 6) capSixes++;
    }
    if (b.dismissedPlayer === captainName) capOut = true;

    // VC
    if (b.batter === vcName) {
      vcRuns += b.batterRuns;
      if (b.batterRuns === 4) vcFours++;
      if (b.batterRuns === 6) vcSixes++;
    }
    if (b.dismissedPlayer === vcName) vcOut = true;
  });

  // Dream11 scoring rules: Runs (+1), Fours (+1 bonus), Sixes (+2 bonus), Duck (-2)
  const capRaw = capRuns + (capFours * 1) + (capSixes * 2) + (capOut && capRuns === 0 ? -2 : 0);
  const vcRaw = vcRuns + (vcFours * 1) + (vcSixes * 2) + (vcOut && vcRuns === 0 ? -2 : 0);

  const capPts = Math.round(capRaw * 2); // 2x multiplier for captain
  const vcPts = Math.round(vcRaw * 1.5); // 1.5x multiplier for vice-captain
  const totalPhase = capPts + vcPts;

  let capSummary = `${captainName}: ${capRuns} runs (${capSixes} sixes, ${capFours} fours)`;
  if (capSixes >= 2) capSummary = `Captain smashed ${capSixes} sixes to ignite your fantasy score! (+${capPts} pts)`;
  else if (capRuns > 0) capSummary = `Captain contributed ${capRuns} crucial runs (+${capPts} pts)`;

  let vcSummary = `${vcName}: ${vcRuns} runs (+${vcPts} pts)`;
  if (vcOut && vcRuns === 0) vcSummary = `Vice-Captain dismissed for a duck (-2 pts)`;
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

/**
 * Computes a spoiler-free thrill rating for fans who missed the whole match or phase.
 */
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

/**
 * Forward-looking "What to watch next" card: matchup, equation, upcoming bowler.
 */
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
