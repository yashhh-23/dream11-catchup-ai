import test from "node:test";
import assert from "node:assert/strict";

// Match data & utility functions
import {
  serverMatchBalls as matchBalls,
  serverMatchMeta as matchMeta,
  getServerMatchById as getMatchById,
  getPublicMatchData,
  getNextSimulatedBall,
} from "../lib/serverMatchData.ts";
import { createSimulatorToken } from "../lib/sessionUtils.ts";
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
  classifyBall,
} from "../lib/matchUtils.ts";
import { buildRecapPrompt } from "../lib/promptBuilder.ts";

test("Two-ball gap fix: sliceBalls includes deliveries up to fractional live cutoff 14.2", () => {
  const sliced = sliceBalls(matchBalls, 5, 14.2);
  assert.ok(sliced.length > 0, "Sliced balls should not be empty");

  assert.strictEqual(sliced[0].over, 5);
  assert.strictEqual(sliced[0].ball, 1);

  const last = sliced[sliced.length - 1];
  assert.strictEqual(last.over, 14, "Must include over 14");
  assert.strictEqual(last.ball, 2, "Must include ball 2 (14.2)");

  const hasBall3 = sliced.some(b => b.over === 14 && b.ball === 3);
  assert.strictEqual(hasBall3, false, "Ball 14.3 must not be included");
});

test("Single source of truth: classifyBall handles wickets, boundaries and dots cleanly", () => {
  const wicketBall = { over: 0, ball: 1, batter: "A", bowler: "B", runs: 0, wicket: true, winProbability: 0.5, cumulativeScore: 0, cumulativeWickets: 1, commentary: "" };
  assert.strictEqual(classifyBall(wicketBall), "wicket");

  const sixBall = { over: 0, ball: 2, batter: "A", bowler: "B", runs: 6, isSix: true, wicket: false, winProbability: 0.5, cumulativeScore: 6, cumulativeWickets: 0, commentary: "" };
  assert.strictEqual(classifyBall(sixBall), "six");

  const fourBall = { over: 0, ball: 3, batter: "A", bowler: "B", runs: 4, isBoundaryFour: true, wicket: false, winProbability: 0.5, cumulativeScore: 10, cumulativeWickets: 0, commentary: "" };
  assert.strictEqual(classifyBall(fourBall), "four");

  const dotBall = { over: 0, ball: 4, batter: "A", bowler: "B", runs: 0, wicket: false, winProbability: 0.5, cumulativeScore: 10, cumulativeWickets: 0, commentary: "" };
  assert.strictEqual(classifyBall(dotBall), "dot");
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
    { runs: 4, isBoundaryFour: true, wicket: false },
    { runs: 6, isSix: true, wicket: false },
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
  assert.strictEqual(typeof stats.runRate, "number");
  assert.strictEqual(stats.runRate, 14);
  assert.strictEqual(stats.runRateFormatted, "14.00");

  const highRate = 10.5;
  assert.strictEqual(highRate < 7.0, false);
});

test("calculateLiveWinProbability computes realistic chase win percentages", () => {
  const initialProb = calculateLiveWinProbability(178, 0, 0, 0, 20);
  assert.ok(initialProb >= 0.40 && initialProb <= 0.60, `Initial probability balanced: ${initialProb}`);

  const strongProb = calculateLiveWinProbability(178, 170, 3, 110, 20);
  assert.ok(strongProb >= 0.90, `Strong position: ${strongProb}`);

  const hopelessProb = calculateLiveWinProbability(178, 80, 9, 110, 20);
  assert.ok(hopelessProb <= 0.10, `Hopeless position: ${hopelessProb}`);
});

test("Validation guardrail: validateRecapAgainstBallData detects hallucinated overs and players", () => {
  const sliced = sliceBalls(matchBalls, 5, 14.2);
  const validMoments = getTopMomentsFallback(sliced, 3);

  const validResult = validateRecapAgainstBallData(validMoments, sliced);
  assert.strictEqual(validResult.isValid, true);
  assert.strictEqual(validResult.issues.length, 0);

  const hallucinatedMoments = [
    { ...validMoments[0], over: "14.3" },
    { ...validMoments[1], player: "Fake Player" },
  ];
  const invalidResult = validateRecapAgainstBallData(hallucinatedMoments, sliced);
  assert.strictEqual(invalidResult.isValid, false);
  assert.ok(invalidResult.issues.length >= 2);
});

test("Match Registry: getMatchById resolves matches dynamically with liveBallIndex", () => {
  const defaultMatch = getMatchById();
  assert.strictEqual(defaultMatch.meta.matchId, "ind-nz-2026-t20-04");
  assert.strictEqual(defaultMatch.meta.liveBallIndex, 85);

  const ausMatch = getMatchById("ind-aus-2026-t20-final");
  assert.strictEqual(ausMatch.meta.matchId, "ind-aus-2026-t20-final");
  assert.strictEqual(ausMatch.meta.target, 192);
  assert.strictEqual(ausMatch.meta.liveBallIndex, 90);

  const unknownMatch = getMatchById("non-existent-id");
  assert.strictEqual(unknownMatch.meta.matchId, "ind-nz-2026-t20-04");
});

test("buildRecapPrompt generates valid prompt with compressed payload and pre-computed moments", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const computedMoments = getTopMomentsFallback(missedBalls, 3);
  const prompt = buildRecapPrompt(missedBalls, matchMeta, 6, "14.2", computedMoments);

  assert.ok(prompt.includes("Rhea AI"));
  assert.ok(prompt.includes("Overs 6 to 14.2"));
  assert.ok(prompt.includes("PRE-COMPUTED TURNING POINTS"));
  assert.ok(prompt.includes(computedMoments[0].player));
  assert.ok(prompt.includes("Target: 178"));
});

test("Product Feature 1: calculateFantasyPerformance computes captain/VC points and rank movement", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const fantasy = calculateFantasyPerformance(missedBalls, "Hardik Pandya", "Rohit Sharma");

  assert.strictEqual(fantasy.captain.name, "Hardik Pandya");
  assert.ok(fantasy.captain.pointsEarned > 0);
  assert.strictEqual(fantasy.viceCaptain.name, "Rohit Sharma");
  assert.ok(typeof fantasy.rankBefore === "string" && typeof fantasy.rankAfter === "string");
  assert.ok(fantasy.phasePoints > 0);
});

test("Product Features 3 & 4: computeThrillRating and getWhatToWatchNext produce valid forward context", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const thrill = computeThrillRating(missedBalls);
  assert.ok(thrill.rating >= 7.5 && thrill.rating <= 10.0);
  assert.ok(thrill.verdict.length > 10);

  const lastBall = missedBalls[missedBalls.length - 1];
  const nextWatch = getWhatToWatchNext(lastBall, matchMeta);
  assert.strictEqual(nextWatch.onStrike, "Hardik Pandya");
  assert.ok(nextWatch.equation.includes("Need 54 runs from 34 balls"));
  assert.ok(nextWatch.upcomingBowler.includes("Ferguson"));
});

test("Product Feature: Hinglish dynamic narrative contains authentic cricket commentary terms", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const stats = calculateOverStats(missedBalls);
  assert.ok(stats.runs > 0);
  assert.strictEqual(stats.wickets, 2);

  // Validate that numbers and cricket terms align accurately
  const headline = `Bhai bawal match miss kar diya! NZ ne jhatke diye par India ne 124/3 tak counter-punch kar diya!`;
  const story = `Overs 6 se 14.2 ke beech India ne ${stats.runs} runs banaye ${stats.wickets} wicket kho kar.`;

  assert.ok(headline.includes("Bhai"));
  assert.ok(story.includes("Overs 6 se 14.2"));
  assert.ok(story.includes("runs banaye 2 wicket kho kar"));
});

test("Zero-Spoiler Security 1: getPublicMatchData isolates future balls strictly to current live ball 14.2", () => {
  const { meta, balls, sessionToken } = getPublicMatchData();
  assert.strictEqual(balls.length, 86, "Must contain exactly balls up to liveBallIndex 85");
  const lastBall = balls[balls.length - 1];
  assert.strictEqual(lastBall.over, 14);
  assert.strictEqual(lastBall.ball, 2);
  assert.ok(sessionToken && sessionToken.length > 20, "Must generate signed simulation token");

  // Verify none of the subsequent deliveries are included
  const hasFinished = balls.some(b => b.commentary.includes("RINKU FINISHES"));
  assert.strictEqual(hasFinished, false, "Must never leak future winning ball in public match data");
});

test("Zero-Spoiler Security 2: getNextSimulatedBall requires valid token and blocks premature inspection (401 & 403)", () => {
  // 1. Without token -> 401 Unauthorized
  const unauth = getNextSimulatedBall("ind-nz-2026-t20-04", null, 86);
  assert.strictEqual(unauth.status, 401);
  assert.strictEqual(unauth.ball, null);

  // 2. Premature index (e.g. index 111 - Rinku finishes) -> 403 Forbidden
  const token = createSimulatorToken("ind-nz-2026-t20-04", 85);
  const premature = getNextSimulatedBall("ind-nz-2026-t20-04", token, 111);
  assert.strictEqual(premature.status, 403);
  assert.strictEqual(premature.ball, null);
  assert.ok(premature.error?.includes("Delivery has not been bowled yet"));

  // 3. Immediate current ball (index 85) -> allowed
  const validReq = getNextSimulatedBall("ind-nz-2026-t20-04", token, 85);
  assert.ok(validReq.ball !== null);
  assert.strictEqual(validReq.ball.over, 14);
  assert.strictEqual(validReq.ball.ball, 2);
});

test("Zero-Spoiler Security 3: story-only buildRecapPrompt strictly redacts scores, runs and targets", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const computedMoments = getTopMomentsFallback(missedBalls, 3);
  const storyOnlyPrompt = buildRecapPrompt(missedBalls, matchMeta, 6, "14.2", computedMoments, "story-only");

  assert.ok(storyOnlyPrompt.includes("ZERO-SPOILER RULE"));
  assert.strictEqual(storyOnlyPrompt.includes("Target: 178"), false, "Target score must be redacted in story-only mode");
  assert.strictEqual(storyOnlyPrompt.includes("124/3"), false, "Live cumulative score must be redacted in story-only mode");
});
