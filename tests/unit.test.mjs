import test from "node:test";
import assert from "node:assert/strict";

// Match data & utility functions
import { matchBalls, matchMeta } from "../lib/matchData.ts";
import {
  sliceBalls,
  formatOver,
  formatWinProb,
  calculateOverStats,
  getTopMomentsFallback,
} from "../lib/matchUtils.ts";
import { buildRecapPrompt } from "../lib/promptBuilder.ts";

test("Edge Case S1 & S4: sliceBalls correctly extracts overs in range [fromOver, toOver)", () => {
  // Extract overs 6 to 14 (indices 5 to 14)
  const sliced = sliceBalls(matchBalls, 5, 14);
  assert.ok(sliced.length > 0, "Sliced balls should not be empty");
  assert.ok(sliced.every(b => b.over >= 5 && b.over < 14), "Every ball must be within bounds");

  // First ball should be over 5 (displayed as over 6)
  assert.strictEqual(sliced[0].over, 5);
  // Last ball should be over 13 (displayed as over 14)
  assert.strictEqual(sliced[sliced.length - 1].over, 13);
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

test("formatOver correctly converts 0-indexed over and 1-based ball to cricket standard", () => {
  assert.strictEqual(formatOver(0, 1), "1.1");
  assert.strictEqual(formatOver(9, 2), "10.2");
  assert.strictEqual(formatOver(13, 6), "14.6");
});

test("formatWinProb converts decimal to percentage string", () => {
  assert.strictEqual(formatWinProb(0.72), "72%");
  assert.strictEqual(formatWinProb(0.354), "35%");
  assert.strictEqual(formatWinProb(1.0), "100%");
});

test("calculateOverStats computes correct aggregates and boundaries", () => {
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
  assert.strictEqual(stats.runRate, "14.00");
});

test("getTopMomentsFallback produces exactly up to 3 highest leverage turning points", () => {
  // Slicing middle overs 6 to 14 where Sodhi took 2 wickets in Over 10 and Tilak hit sixes in Over 12
  const missedBalls = sliceBalls(matchBalls, 5, 14);
  const moments = getTopMomentsFallback(missedBalls, 3);

  assert.strictEqual(moments.length, 3, "Must return exactly 3 top moments");

  // Wickets should be present and marked with WICKET
  const wicketMoments = moments.filter(m => m.label === "WICKET");
  assert.ok(wicketMoments.length >= 1, "Should identify high leverage wickets");

  // Sorted descending by swing impact
  assert.ok(moments[0].swingDelta >= moments[1].swingDelta || moments[0].label === "WICKET");
});

test("buildRecapPrompt generates valid prompt with compressed payload", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14);
  const prompt = buildRecapPrompt(missedBalls, matchMeta, 6, 14);

  assert.ok(prompt.includes("Rhea AI"), "Prompt must instruct AI persona");
  assert.ok(prompt.includes("Overs 6 to 14"), "Prompt must mention missed overs window");
  assert.ok(prompt.includes("India"), "Prompt must include chasing team");
  assert.ok(prompt.includes("New Zealand"), "Prompt must include opponent");
  assert.ok(prompt.includes("Target: 178"), "Prompt must provide match target");
  assert.ok(prompt.includes("top3Moments"), "Prompt must specify schema requirements");
});
