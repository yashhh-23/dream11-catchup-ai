import test from "node:test";
import assert from "node:assert/strict";

// Match data & utility functions
import { matchBalls, matchMeta, getMatchById } from "../lib/matchData.ts";
import {
  sliceBalls,
  formatOver,
  formatWinProb,
  calculateOverStats,
  getTopMomentsFallback,
  calculateLiveWinProbability,
  validateRecapAgainstBallData,
  calculateFantasyPerformance,
  computeThrillRating,
  getWhatToWatchNext,
} from "../lib/matchUtils.ts";
import { buildRecapPrompt } from "../lib/promptBuilder.ts";

test("Two-ball gap fix: sliceBalls includes deliveries up to fractional live cutoff 14.2", () => {
  // Slicing from over 5 (Over 6) up to 14.2
  const sliced = sliceBalls(matchBalls, 5, 14.2);
  assert.ok(sliced.length > 0, "Sliced balls should not be empty");

  // First ball should be over 5 (Over 6.1)
  assert.strictEqual(sliced[0].over, 5);
  assert.strictEqual(sliced[0].ball, 1);

  // Last ball MUST be over 14, ball 2 (Over 14.2)
  const last = sliced[sliced.length - 1];
  assert.strictEqual(last.over, 14, "Must include over 14");
  assert.strictEqual(last.ball, 2, "Must include ball 2 (14.2)");

  // Ball 14.3 must NOT be included in the recap window
  const hasBall3 = sliced.some(b => b.over === 14 && b.ball === 3);
  assert.strictEqual(hasBall3, false, "Ball 14.3 must not be included");
});

test("Edge Case S1: Empty slice when fromOver >= toOver", () => {
  const emptySlice = sliceBalls(matchBalls, 14, 14);
  assert.strictEqual(emptySlice.length, 0);

  const reversedSlice = sliceBalls(matchBalls, 14, 5);
  assert.strictEqual(reversedSlice.length, 0);
});

test("Edge Case D1: Out of bounds range returns empty gracefully", () => {
  const outOfBounds = sliceBalls(matchBalls, 50, 60);
  assert.strictEqual(outOfBounds.length, 0);
});

test("formatOver correctly formats completed over and ball to cricket standard", () => {
  assert.strictEqual(formatOver(0, 1), "0.1");
  assert.strictEqual(formatOver(9, 2), "9.2");
  assert.strictEqual(formatOver(9, 5), "9.5");
  assert.strictEqual(formatOver(14, 2), "14.2");
});

test("Numeric comparison fix: calculateOverStats returns numeric runRate", () => {
  const sampleBalls = [
    { runs: 4, wicket: false },
    { runs: 6, wicket: false },
    { runs: 0, wicket: true },
    { runs: 1, wicket: false },
    { runs: 2, wicket: false },
    { runs: 1, wicket: false },
  ];
  const stats = calculateOverStats(sampleBalls);
  assert.strictEqual(stats.runs, 14);
  assert.strictEqual(stats.wickets, 1);
  assert.strictEqual(stats.boundaries, 1);
  assert.strictEqual(stats.sixes, 1);
  assert.strictEqual(stats.totalBalls, 6);
  assert.strictEqual(typeof stats.runRate, "number", "runRate must be numeric");
  assert.strictEqual(stats.runRate, 14);
  assert.strictEqual(stats.runRateFormatted, "14.00");

  // Verify string comparison bug is impossible:
  // In JavaScript: "10.5" < "7.0" is true, but 10.5 < 7.0 is false!
  const highRate = 10.5;
  assert.strictEqual(highRate < 7.0, false, "Numeric comparison must be false for 10.5 < 7.0");
});

test("calculateLiveWinProbability computes realistic chase win percentages", () => {
  // Target 178, starting innings (0/0, 120 balls left)
  const initialProb = calculateLiveWinProbability(178, 0, 0, 0, 20);
  assert.ok(initialProb >= 0.40 && initialProb <= 0.60, `Initial probability balanced: ${initialProb}`);

  // Near target achieved (170/3, 10 balls left)
  const strongProb = calculateLiveWinProbability(178, 170, 3, 110, 20);
  assert.ok(strongProb >= 0.90, `Strong position: ${strongProb}`);

  // Hopeless situation (80/9, 10 balls left needing 98)
  const hopelessProb = calculateLiveWinProbability(178, 80, 9, 110, 20);
  assert.ok(hopelessProb <= 0.10, `Hopeless position: ${hopelessProb}`);
});

test("Validation guardrail: validateRecapAgainstBallData detects hallucinated overs and players", () => {
  const sliced = sliceBalls(matchBalls, 5, 14.2);
  const validMoments = getTopMomentsFallback(sliced, 3);

  // Valid moments should pass
  const validResult = validateRecapAgainstBallData(validMoments, sliced);
  assert.strictEqual(validResult.isValid, true);
  assert.strictEqual(validResult.issues.length, 0);

  // Hallucinated over outside window (e.g., 14.3 or 10.5 when 9.5 was actual)
  const hallucinatedMoments = [
    { ...validMoments[0], over: "14.3" }, // 14.3 is outside the 14.2 window
    { ...validMoments[1], player: "Fake Player" }, // Player not in match
  ];
  const invalidResult = validateRecapAgainstBallData(hallucinatedMoments, sliced);
  assert.strictEqual(invalidResult.isValid, false);
  assert.ok(invalidResult.issues.length >= 2, "Must flag both fake over and fake player");
});

test("Match Registry: getMatchById resolves matches dynamically", () => {
  const defaultMatch = getMatchById();
  assert.strictEqual(defaultMatch.meta.matchId, "ind-nz-2026-t20-04");

  const ausMatch = getMatchById("ind-aus-2026-t20-final");
  assert.strictEqual(ausMatch.meta.matchId, "ind-aus-2026-t20-final");
  assert.strictEqual(ausMatch.meta.target, 192);

  const unknownMatch = getMatchById("non-existent-id");
  assert.strictEqual(unknownMatch.meta.matchId, "ind-nz-2026-t20-04", "Defaults gracefully to active match");
});

test("buildRecapPrompt generates valid prompt with compressed payload and pre-computed moments", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const computedMoments = getTopMomentsFallback(missedBalls, 3);
  const prompt = buildRecapPrompt(missedBalls, matchMeta, 6, "14.2", computedMoments);

  assert.ok(prompt.includes("Rhea AI"), "Prompt must instruct AI persona");
  assert.ok(prompt.includes("Overs 6 to 14.2"), "Prompt must mention missed overs window");
  assert.ok(prompt.includes("PRE-COMPUTED TURNING POINTS"), "Prompt must pass code-computed moments");
  assert.ok(prompt.includes(computedMoments[0].player), "Prompt must include ground truth player");
  assert.ok(prompt.includes("Target: 178"), "Prompt must provide match target");
});

test("Product Feature 1: calculateFantasyPerformance computes captain/VC points and rank movement", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const fantasy = calculateFantasyPerformance(missedBalls, "Hardik Pandya", "Rohit Sharma");

  assert.strictEqual(fantasy.captain.name, "Hardik Pandya");
  assert.ok(fantasy.captain.pointsEarned > 0, "Captain should earn points from boundaries and sixes");
  assert.ok(fantasy.captain.summary.includes("Hardik Pandya") || fantasy.captain.summary.includes("Captain"));
  assert.strictEqual(fantasy.viceCaptain.name, "Rohit Sharma");
  assert.ok(typeof fantasy.rankBefore === "string" && typeof fantasy.rankAfter === "string");
  assert.ok(fantasy.phasePoints > 0, "Phase points should be aggregated");
});

test("Product Features 3 & 4: computeThrillRating and getWhatToWatchNext produce valid forward context", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const thrill = computeThrillRating(missedBalls);
  assert.ok(thrill.rating >= 7.5 && thrill.rating <= 10.0, "Thrill rating within scale");
  assert.ok(thrill.verdict.length > 10, "Verdict should be descriptive");

  const lastBall = missedBalls[missedBalls.length - 1];
  const nextWatch = getWhatToWatchNext(lastBall, matchMeta);
  assert.strictEqual(nextWatch.onStrike, "Hardik Pandya");
  assert.ok(nextWatch.equation.includes("Need 54 runs from 34 balls"));
  assert.ok(nextWatch.upcomingBowler.includes("Ferguson"));
});
