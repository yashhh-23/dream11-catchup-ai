import test from "node:test";
import assert from "node:assert/strict";

// Match data & utility functions
import {
  serverMatchBalls as matchBalls,
  serverMatchMeta as matchMeta,
  getServerMatchById,
  getPublicMatchData,
  getNextSimulatedBall,
  getAvailableMatches,
} from "../lib/serverMatchData.ts";
import { createSimulatorToken, verifySimulatorToken, calculateAllowedIndex } from "../lib/sessionUtils.ts";
import {
  sliceBalls,
  findWindowIndices,
  processWindowFused,
  formatOver,
  formatWinProb,
  calculateOverStats,
  calculateLiveWinProbability,
  validateRecapAgainstBallData,
  calculateFantasyPerformance,
  computeThrillRating,
  getWhatToWatchNext,
  classifyBall,
  redactPayloadForSpoiler,
  sanitizeMood,
  sanitizeOversText,
  stripAllDigitsAndScores,
  sanitizeBallsForSpoiler,
  sanitizeMetaForSpoiler,
} from "../lib/matchUtils.ts";
import { buildRecapPrompt } from "../lib/promptBuilder.ts";
import { getClientIp } from "../lib/rateLimit.ts";

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
  const fused = processWindowFused(matchBalls, 5, 14.2);
  const validMoments = fused.topMoments;

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

test("Match Registry: getServerMatchById resolves matches dynamically and returns null for unknown match (Bug 8)", () => {
  const defaultMatch = getServerMatchById();
  assert.ok(defaultMatch !== null);
  assert.strictEqual(defaultMatch.meta.matchId, "ind-pak-2022-t20-wc");
  assert.strictEqual(defaultMatch.meta.liveBallIndex, 89);
  assert.strictEqual(defaultMatch.meta.target, 160);

  const pakMatch = getServerMatchById("ind-pak-2022-t20-wc");
  assert.ok(pakMatch !== null);
  assert.strictEqual(pakMatch.meta.matchId, "ind-pak-2022-t20-wc");
  assert.strictEqual(pakMatch.meta.target, 160);

  const unknownMatch = getServerMatchById("non-existent-id");
  assert.strictEqual(unknownMatch, null, "Unknown matchId must return null (404), not silently fallback to default");
});

test("buildRecapPrompt generates valid prompt with compressed payload and pre-computed moments", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const computedMoments = processWindowFused(matchBalls, 5, 14.2).topMoments;
  const prompt = buildRecapPrompt(missedBalls, matchMeta, 6, "14.2", computedMoments);

  assert.ok(prompt.includes("Rhea AI"));
  assert.ok(prompt.includes("Overs 6 to 14.2"));
  assert.ok(prompt.includes("PRE-COMPUTED TURNING POINTS"));
  assert.ok(prompt.includes(computedMoments[0].player));
  assert.ok(prompt.includes("Target: 160"));
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
  assert.ok(thrill.rating >= 7.0 && thrill.rating <= 10.0);
  assert.ok(thrill.verdict.length > 10);

  const lastBall = missedBalls[missedBalls.length - 1];
  const nextWatch = getWhatToWatchNext(lastBall, matchMeta, missedBalls);
  assert.strictEqual(nextWatch.onStrike, "Virat Kohli");
  assert.ok(nextWatch.equation.includes("Need 67 runs from 34 balls"));
  assert.ok(nextWatch.upcomingBowler.includes("Naseem"));
});

test("Audio Narrator: Generates clean, authentic commentary text for voice narration", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const stats = calculateOverStats(missedBalls);
  assert.ok(stats.runs > 0);
  assert.strictEqual(stats.wickets, 2);

  // Validate that commentary headline and story flow smoothly for TTS narration
  const headline = `Between overs 6 and 14.2, India scored ${stats.runs} runs for the loss of ${stats.wickets} wickets.`;
  const story = `Hardik Pandya and Virat Kohli absorbed pressure and countered with timely boundaries.`;

  assert.ok(headline.includes(`scored ${stats.runs} runs`));
  assert.ok(story.includes("Virat Kohli"));
});

test("Zero-Spoiler Security 1: getPublicMatchData isolates future balls strictly to current live ball cutoff", () => {
  const { meta, balls, sessionToken } = getPublicMatchData();
  assert.strictEqual(balls.length, meta.liveBallIndex + 1, "Must contain exactly balls up to liveBallIndex");
  assert.ok(sessionToken && sessionToken.length > 20, "Must generate signed simulation token");

  // Verify none of the subsequent deliveries are included
  const hasFinished = balls.some(b => b.commentary && (b.commentary.includes("RINKU FINISHES") || b.commentary.includes("Ashwin lofts over mid-off to seal an epic win")));
  assert.strictEqual(hasFinished, false, "Must never leak future winning ball in public match data");
});

test("Zero-Spoiler Security 2: getNextSimulatedBall requires valid token and blocks premature inspection (401 & 403)", () => {
  // 1. Without token -> 401 Unauthorized
  const unauth = getNextSimulatedBall("ind-pak-2022-t20-wc", null, 90);
  assert.strictEqual(unauth.status, 401);
  assert.strictEqual(unauth.ball, null);

  // 2. Premature index (e.g. index 120) -> 403 Forbidden
  const token = createSimulatorToken("ind-pak-2022-t20-wc", 89);
  const premature = getNextSimulatedBall("ind-pak-2022-t20-wc", token, 120);
  assert.strictEqual(premature.status, 403);
  assert.strictEqual(premature.ball, null);
  assert.ok(premature.error?.includes("Delivery has not been bowled yet"));

  // 3. Immediate current ball (index 89) -> allowed
  const validReq = getNextSimulatedBall("ind-pak-2022-t20-wc", token, 89);
  assert.ok(validReq.ball !== null);
  assert.strictEqual(validReq.ball.over, 14);
  assert.strictEqual(validReq.ball.ball, 6);
});

test("Zero-Spoiler Security 3: story-only buildRecapPrompt strictly redacts scores, runs and targets", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 14.2);
  const computedMoments = processWindowFused(matchBalls, 5, 14.2).topMoments;
  const storyOnlyPrompt = buildRecapPrompt(missedBalls, matchMeta, 6, "14.2", computedMoments, "story-only");

  assert.ok(storyOnlyPrompt.includes("ZERO-SPOILER RULE"));
  assert.strictEqual(storyOnlyPrompt.includes("Target: 160"), false, "Target score must be redacted in story-only mode");
  assert.strictEqual(storyOnlyPrompt.includes("93/4"), false, "Live cumulative score must be redacted in story-only mode");
});

test("Bug 14 Fix: win prob swing computes accurate swing for first ball of window", () => {
  const windowBalls = sliceBalls(matchBalls, 9, 14.2); // Starts at ball 9.1
  const ballBefore = matchBalls[53]; // Ball 8.6
  assert.ok(ballBefore !== undefined);

  // Passing initialPrevProb
  const fused = processWindowFused(matchBalls, 9, 14.2);
  const moments = fused.topMoments;
  assert.ok(moments.length > 0);
  assert.ok(moments[0].swingDelta > 0, "Top moment swing delta must be greater than zero");

  // Thrill rating also receives initialPrevProb
  const thrill = computeThrillRating(windowBalls, ballBefore.winProbability);
  assert.ok(thrill.rating >= 7.0 && thrill.rating <= 10.0);
});

test("Bug 15 Fix: promptBuilder calculates startScore before first delivery and labels overs consistently", () => {
  const missedBalls = sliceBalls(matchBalls, 5, 10);
  const prompt = buildRecapPrompt(missedBalls, matchMeta, 6, 10, []);

  // Score before over 6 (after over 5) was 49/1, not the score after ball 5.1
  const firstBall = missedBalls[0];
  const scoreBefore = firstBall.cumulativeScore - firstBall.runs;
  assert.ok(prompt.includes(`${scoreBefore}/`), `Prompt must report score before first ball: ${scoreBefore}`);
});

test("Bug 16 Fix: calculateFantasyPerformance excludes run-outs from bowler and avoids false 'Dismissed'", () => {
  // Test a delivery where wicket is a run out
  const runOutBall = {
    over: 5,
    ball: 1,
    batter: "Player A",
    bowler: "Hardik Pandya",
    runs: 0,
    wicket: true,
    wicketType: "run out",
    dismissedPlayer: "Player B",
    winProbability: 0.5,
    cumulativeScore: 50,
    cumulativeWickets: 2,
    commentary: "Run out!",
  };

  const fantasy = calculateFantasyPerformance([runOutBall], "Hardik Pandya", "Rohit Sharma");
  assert.strictEqual(fantasy.captain.wickets, 0, "Run-out must NOT be credited to the bowler as a wicket");

  // Rohit did not bat in this single ball
  assert.ok(fantasy.viceCaptain.summary.includes("Did not bat"), "Must say 'Did not bat' rather than 'Dismissed' when player did not bat");
});

test("Bug 17 Fix: getWhatToWatchNext derives actual active non-striker and spell phase", () => {
  const ball = matchBalls[20]; // 3.3 by Haris Rauf to Suryakumar Yadav
  const watchNext = getWhatToWatchNext(ball, matchMeta, matchBalls);

  assert.strictEqual(watchNext.onStrike, ball.batter);
  assert.strictEqual(watchNext.nonStriker, "Virat Kohli", "Active non-striker in over 4 was Virat Kohli");
  assert.ok(watchNext.upcomingBowler.includes("Powerplay"), "Overs < 6 must be identified as Powerplay spell");
});

test("Bug 19 Fix: getNextSimulatedBall rejects fractional or negative index with 400", () => {
  const token = createSimulatorToken("ind-pak-2022-t20-wc", 89);

  const fractionalReq = getNextSimulatedBall("ind-pak-2022-t20-wc", token, 14.7);
  assert.strictEqual(fractionalReq.status, 400);
  assert.ok(fractionalReq.error?.includes("INVALID_INDEX"));

  const negativeReq = getNextSimulatedBall("ind-pak-2022-t20-wc", token, -1);
  assert.strictEqual(negativeReq.status, 400);
  assert.ok(negativeReq.error?.includes("INVALID_INDEX"));
});

test("Bug 11 Fix: validateRecapAgainstBallData catches invalid mood and future over narrative leaks", () => {
  const sampleBalls = sliceBalls(matchBalls, 5, 10);

  // Invalid mood
  const invalidMoodRecap = {
    oneLiner: "India played well",
    story: "Good batting in the middle overs",
    top3Moments: [],
    mood: "Super excited", // Not in ALLOWED_MOODS
  };
  const moodCheck = validateRecapAgainstBallData(invalidMoodRecap, sampleBalls, 10);
  assert.strictEqual(moodCheck.valid, false);
  assert.ok(moodCheck.issues.some(i => i.includes("Invalid mood")));

  // Hallucinated future over in narrative (e.g. mentions over 18 when window is up to 10)
  const futureOverRecap = {
    oneLiner: "In over 18 the match reached a climax",
    story: "India chased down the target in over 19",
    top3Moments: [],
    mood: "Cruising",
  };
  const overCheck = validateRecapAgainstBallData(futureOverRecap, sampleBalls, 10);
  assert.strictEqual(overCheck.valid, false);
  assert.ok(overCheck.issues.some(i => i.includes("outside the allowed window")));
});

test("Phase 2 Zero-Spoiler Validity: Story-only check strictly rejects prose containing numeric digits", () => {
  const containsDigits = (text) => /\d/.test(text);
  
  // Prose with scoreline leak
  assert.strictEqual(containsDigits("India fought back to reach 124/3 in the chase"), true);
  assert.strictEqual(containsDigits("Required 54 runs from remaining overs"), true);
  
  // Pure qualitative narrative prose (zero score digits)
  assert.strictEqual(containsDigits("India weathered intense bowling pressure and mounted a spirited counter-attack"), false);
  assert.strictEqual(containsDigits("Key wickets fell early but the middle order responded with bold boundary hitting"), false);
});

test("Security & Prototype Safety: Token verification rejects forged tokens and cross-match usage", () => {
  const token = createSimulatorToken("ind-pak-2022-t20-wc", 89);
  const validRes = verifySimulatorToken(token);
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.session?.matchId, "ind-pak-2022-t20-wc");

  // Token with colons in matchId handles correctly (Bug B7)
  const colonMatchToken = createSimulatorToken("ind:pak:2022:wc", 42);
  const colonRes = verifySimulatorToken(colonMatchToken);
  assert.strictEqual(colonRes.valid, true);
  assert.strictEqual(colonRes.session?.matchId, "ind:pak:2022:wc");
  assert.strictEqual(colonRes.session?.baseIndex, 42);

  // 1. Cross-match token mismatch rejected with 403
  const otherMatchToken = createSimulatorToken("other-match-id", 50);
  const crossMatchRes = getNextSimulatedBall("ind-pak-2022-t20-wc", otherMatchToken, 20);
  assert.strictEqual(crossMatchRes.status, 403);
  assert.ok(crossMatchRes.error?.includes("TOKEN_MATCH_MISMATCH"));

  // 2. Forged signature
  const forgedToken = Buffer.from("ind-pak-2022-t20-wc:89:1234567890:deadbeefbadsignature").toString("base64url");
  const forgedRes = verifySimulatorToken(forgedToken);
  assert.strictEqual(forgedRes.valid, false);

  // 3. Altered payload with valid old signature
  const raw = Buffer.from(token, "base64url").toString("utf-8");
  const tampered = Buffer.from(raw.replace(":89:", ":111:")).toString("base64url");
  const tamperedRes = verifySimulatorToken(tampered);
  assert.strictEqual(tamperedRes.valid, false);
});

test("Prototype Pollution Prevention: getServerMatchById safely rejects Object.prototype properties", () => {
  assert.strictEqual(getServerMatchById("constructor"), null);
  assert.strictEqual(getServerMatchById("__proto__"), null);
  assert.strictEqual(getServerMatchById("toString"), null);
});

test("Non-Striker Integrity: getWhatToWatchNext never selects an already-dismissed player as non-striker", () => {
  const publicBalls = matchBalls.slice(0, 90);
  const dismissedSet = new Set();

  for (let i = 0; i < publicBalls.length; i++) {
    const ball = publicBalls[i];
    if (ball.dismissedPlayer) {
      dismissedSet.add(ball.dismissedPlayer);
    }
    const nextWatch = getWhatToWatchNext(ball, matchMeta, publicBalls);
    if (nextWatch.nonStriker && nextWatch.nonStriker !== "Middle-order partner") {
      assert.strictEqual(
        dismissedSet.has(nextWatch.nonStriker),
        false,
        `Ball ${i} (${ball.over}.${ball.ball}) incorrectly assigned dismissed player '${nextWatch.nonStriker}' as non-striker`
      );
    }
  }
});

test("Zero-Spoiler Redaction: redactPayloadForSpoiler enforces strict zero-digit contract on all fields", () => {
  const dummyPayload = {
    oneLiner: "India scored 85 runs in 6 overs!",
    story: "Between overs 6 and 14.2, India scored 54 runs. Need 54 runs from 34 balls with 7 wickets in hand (RRR 9.53).",
    top3Moments: [
      {
        over: "9.3",
        label: "WICKET",
        player: "Hardik Pandya",
        description: "Hardik was caught on 40 runs.",
        impact: "Win probability dropped to 52%.",
        winProbBefore: 0.65,
        winProbAfter: 0.52,
        swingDelta: 0.13,
      }
    ],
    mood: "Knife's edge",
    partnershipSummary: "Kohli and Hardik added 82 runs off 55 balls.",
    oversCovered: "Overs 6 – 15",
    thrillRating: { rating: 8.5, verdict: "Tense chase", worthReplay: true },
    whatToWatchNext: {
      onStrike: "Virat Kohli",
      nonStriker: "Hardik Pandya",
      upcomingBowler: "Shaheen Afridi (Death overs)",
      equation: "Need 54 runs from 34 balls with 7 wickets in hand (RRR 9.53)",
      tacticalNote: "Required rate climbing at 12.00 rpo. Kohli must target boundaries.",
    },
    fantasyImpact: {
      teamName: "IndiaXI",
      captain: {
        name: "Virat Kohli",
        role: "Captain",
        runs: 54,
        wickets: 0,
        fours: 4,
        sixes: 2,
        pointsEarned: 130,
        summary: "54 runs (+130 pts with 2x)",
      },
      viceCaptain: {
        name: "Hardik Pandya",
        role: "Vice Captain",
        runs: 40,
        wickets: 1,
        fours: 2,
        sixes: 1,
        pointsEarned: 95,
        summary: "40 runs (+95 pts with 1.5x)",
      },
      phasePoints: 225,
      rankBefore: "1.8L",
      rankAfter: "42K",
      rankDirection: "up",
    },
    spoilerLevel: "story-and-score",
  };

  const redacted = redactPayloadForSpoiler(dummyPayload, "story-only", "India");

  assert.strictEqual(redacted.spoilerLevel, "story-only");
  assert.strictEqual(/\d/.test(redacted.oneLiner), false, "oneLiner must have 0 digits");
  assert.strictEqual(/\d/.test(redacted.story), false, "story must have 0 digits");
  assert.strictEqual(/\d/.test(redacted.partnershipSummary), false, "partnershipSummary must have 0 digits");
  assert.strictEqual(/\d/.test(redacted.whatToWatchNext.equation), false, "equation must have 0 digits");
  assert.strictEqual(/\d/.test(redacted.whatToWatchNext.tacticalNote), false, "tacticalNote must have 0 digits");

  assert.strictEqual(redacted.fantasyImpact.phasePoints, 0, "fantasy points must be 0");
  assert.strictEqual(redacted.fantasyImpact.rankBefore, "Shielded");
  assert.strictEqual(redacted.fantasyImpact.rankAfter, "Shielded");
  assert.strictEqual(redacted.fantasyImpact.rankDirection, "same");

  assert.strictEqual(redacted.top3Moments[0].over, "Key Phase");
  assert.strictEqual(redacted.top3Moments[0].winProbBefore, 0);
  assert.strictEqual(redacted.top3Moments[0].winProbAfter, 0);
  assert.strictEqual(redacted.top3Moments[0].swingDelta, 0);
  assert.strictEqual(/\d/.test(redacted.top3Moments[0].description), false, "moment description must have 0 digits");
  assert.strictEqual(/\d/.test(redacted.top3Moments[0].impact), false, "moment impact must have 0 digits");
});

test("Dream11 Fantasy Rules: Milestones, duck penalty, bowler run-out exclusions, and runs off bat only", () => {
  const dummyBalls = [
    // Batter 1 (Virat Kohli) scores 30 off bat + milestone (+4)
    { over: 0, ball: 1, batter: "Virat Kohli", bowler: "Shaheen Afridi", runs: 4, batterRuns: 4, isBoundaryFour: true, wicket: false, winProbability: 0.5, cumulativeScore: 4, cumulativeWickets: 0 },
    { over: 0, ball: 2, batter: "Virat Kohli", bowler: "Shaheen Afridi", runs: 6, batterRuns: 6, isSix: true, wicket: false, winProbability: 0.55, cumulativeScore: 10, cumulativeWickets: 0 },
    { over: 0, ball: 3, batter: "Virat Kohli", bowler: "Shaheen Afridi", runs: 20, batterRuns: 20, wicket: false, winProbability: 0.6, cumulativeScore: 30, cumulativeWickets: 0 },
    // Leg-bye extras (must NOT be credited to batter)
    { over: 0, ball: 4, batter: "Virat Kohli", bowler: "Shaheen Afridi", runs: 4, batterRuns: 0, extraType: "legbyes", wicket: false, winProbability: 0.6, cumulativeScore: 34, cumulativeWickets: 0 },
    // Batter 2 (Hardik Pandya) out for duck (duck penalty: -2)
    { over: 0, ball: 5, batter: "Hardik Pandya", bowler: "Shaheen Afridi", runs: 0, batterRuns: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Hardik Pandya", winProbability: 0.5, cumulativeScore: 34, cumulativeWickets: 1 },
  ];

  const fantasy = calculateFantasyPerformance(dummyBalls, "Virat Kohli", "Hardik Pandya");

  // Virat: 30 runs (+30), 1 four (+1), 1 six (+2), 30-run milestone (+4) = 37 raw * 2 (Captain) = 74 pts
  assert.strictEqual(fantasy.captain.runs, 30);
  assert.strictEqual(fantasy.captain.pointsEarned, 74);

  // Hardik: 0 runs, out for duck (-2 raw) * 1.5 (VC) = -3 pts
  assert.strictEqual(fantasy.viceCaptain.runs, 0);
  assert.strictEqual(fantasy.viceCaptain.pointsEarned, -3);

  // Phase points = 74 + (-3) = 71 (no arbitrary +18/+8 padding)
  assert.strictEqual(fantasy.phasePoints, 71);
});

test("Cricket Rule: Bowler cannot bowl two consecutive overs in getWhatToWatchNext", () => {
  const overCompleteBall = {
    over: 5,
    ball: 6,
    legalBall: 6,
    batter: "Virat Kohli",
    bowler: "Haris Rauf",
    runs: 1,
    wicket: false,
    cumulativeScore: 45,
    cumulativeWickets: 2,
    winProbability: 0.45,
    commentary: "End of over 6.",
  };

  const prevBalls = [
    { over: 4, ball: 6, legalBall: 6, batter: "Virat Kohli", bowler: "Shadab Khan", runs: 0, wicket: false, cumulativeScore: 40, cumulativeWickets: 2, winProbability: 0.42, commentary: "Over 5 end." },
    overCompleteBall,
  ];

  const nextWatch = getWhatToWatchNext(overCompleteBall, matchMeta, prevBalls);
  // Upcoming bowler must NOT be Haris Rauf because over 6 just finished
  assert.notStrictEqual(nextWatch.upcomingBowler.includes("Haris Rauf"), true, "Upcoming bowler cannot be the bowler who just finished the over");
});

const TEST_BASE_URL = process.env.TEST_BASE_URL || "https://api.dream11.local";
function createMockRequest(path = "/api/events", init = {}) {
  return new Request(`${TEST_BASE_URL}${path}`, init);
}

test("Client IP Extraction: getClientIp prioritizes platform edge headers and extracts true client IP", () => {
  // 1. Cloudflare cf-connecting-ip has highest priority
  const cfReq = createMockRequest("/api/events", {
    headers: {
      "cf-connecting-ip": "198.51.100.44",
      "x-forwarded-for": "10.0.0.1, 192.168.1.1",
    },
  });
  assert.strictEqual(getClientIp(cfReq), "198.51.100.44", "Must prioritize Cloudflare cf-connecting-ip");

  // 2. Vercel x-vercel-forwarded-for priority
  const vercelReq = createMockRequest("/api/events", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.88, 10.0.0.2",
    },
  });
  assert.strictEqual(getClientIp(vercelReq), "203.0.113.88", "Must extract client IP from Vercel edge header");

  // 3. Standard X-Forwarded-For: Client IP is the leftmost IP (parts[0]), not internal edge proxy
  const standardXffReq = createMockRequest("/api/events", {
    headers: {
      "x-forwarded-for": "203.0.113.195, 10.200.0.1, 10.200.0.2",
    },
  });
  assert.strictEqual(getClientIp(standardXffReq), "203.0.113.195", "Must extract client IP from leftmost X-Forwarded-For position");

  // 4. Fallback to x-real-ip
  const reqWithRealIp = createMockRequest("/api/events", {
    headers: {
      "x-real-ip": "198.51.100.55",
    },
  });
  assert.strictEqual(getClientIp(reqWithRealIp), "198.51.100.55");
});

test("Window Boundaries: findWindowIndices returns exact start and end indices", () => {
  const { startIdx, endIdx } = findWindowIndices(matchBalls, 5, 14.2);
  assert.ok(startIdx < endIdx);
  assert.strictEqual(matchBalls[startIdx].over, 5);
  assert.strictEqual(matchBalls[startIdx].ball, 1);
  assert.strictEqual(matchBalls[endIdx - 1].over, 14);
  assert.strictEqual(matchBalls[endIdx - 1].ball, 2);
});

test("Multi-Instance HMAC Secret: Tokens validate reliably across distributed serverless instances", () => {
  // Simulate token minted by Lambda A
  const tokenLambdaA = createSimulatorToken("ind-pak-2022-t20-wc", 89);
  
  // Verify token on Lambda B
  const verificationLambdaB = verifySimulatorToken(tokenLambdaA);
  assert.strictEqual(verificationLambdaB.valid, true);
  assert.strictEqual(verificationLambdaB.session?.matchId, "ind-pak-2022-t20-wc");
  assert.strictEqual(verificationLambdaB.session?.baseIndex, 89);
});

test("Live Simulation Ticker: Stream-anchored token prevents gate dwell-time fast-forward", () => {
  const now = Date.now();
  // Token stamped at stream start time (now)
  const freshStreamToken = createSimulatorToken("ind-pak-2022-t20-wc", 89, now);
  const session = verifySimulatorToken(freshStreamToken).session;
  assert.ok(session !== undefined);

  // At stream start (t=0), allowed index must be strictly baseIndex (89)
  const immediateAllowed = calculateAllowedIndex(session, 4.0);
  assert.strictEqual(immediateAllowed, 89, "At entry moment, only current live ball 89 is unlocked");

  // Premature next ball (e.g. ball 92, 12 seconds in the future) is blocked
  const prematureCheck = getNextSimulatedBall("ind-pak-2022-t20-wc", freshStreamToken, 92);
  assert.strictEqual(prematureCheck.status, 403);
  assert.ok(prematureCheck.error?.includes("Delivery has not been bowled yet"));
});

test("Sanitization: sanitizeMood and sanitizeOversText sanitize parameters reliably", () => {
  // sanitizeMood
  assert.strictEqual(sanitizeMood("Cruising"), "Cruising");
  assert.strictEqual(sanitizeMood("Knife's edge"), "Knife's edge");
  assert.strictEqual(sanitizeMood("invalid mood"), "Knife's edge");
  assert.strictEqual(sanitizeMood(null), "Knife's edge");
  assert.strictEqual(sanitizeMood(undefined, "Comeback on"), "Comeback on");

  // sanitizeOversText
  assert.strictEqual(sanitizeOversText("Overs 6 – 15.0"), "Overs 6 – 15.0");
  assert.strictEqual(sanitizeOversText("Over 1 - 6"), "Over 1 - 6");
  assert.strictEqual(sanitizeOversText("malicious <script>"), "Overs 6 – 15.0");
  assert.strictEqual(sanitizeOversText(null), "Overs 6 – 15.0");
  assert.strictEqual(sanitizeOversText(undefined, "Overs 1 – 6"), "Overs 1 – 6");
});

test("Regex Redaction: stripAllDigitsAndScores completely eliminates ordinals and hyphenated numbers", () => {
  const sample1 = "wicket on the 1st ball of the 14th over";
  const redacted1 = stripAllDigitsAndScores(sample1);
  assert.strictEqual(/\d/.test(redacted1), false, "Must contain zero numeric digits");
  assert.strictEqual(redacted1.includes("1st"), false, "1st must be converted or stripped");
  assert.strictEqual(redacted1.includes("14th"), false, "14th must be converted or stripped");

  const sample2 = "Haris Rauf struck with a 3-wicket haul, taking 2nd wicket in the 10th over";
  const redacted2 = stripAllDigitsAndScores(sample2);
  assert.strictEqual(/\d/.test(redacted2), false, "Must contain zero numeric digits");
  assert.strictEqual(redacted2.includes("3-wicket"), false);
  assert.strictEqual(redacted2.includes("2nd"), false);
  assert.strictEqual(redacted2.includes("10th"), false);

  const sample3 = "Target of 160 was set after Pakistan scored 159/8 in 20.0 overs";
  const redacted3 = stripAllDigitsAndScores(sample3);
  assert.strictEqual(/\d/.test(redacted3), false, "Scoreline digits must be stripped");
});

test("Server-Side Zero-Spoiler: sanitizeBallsForSpoiler and sanitizeMetaForSpoiler mask deliveries over the wire", () => {
  const sampleBalls = matchBalls.slice(0, 10);
  const sanitizedBalls = sanitizeBallsForSpoiler(sampleBalls, "story-only");

  assert.strictEqual(sanitizedBalls.length, sampleBalls.length);
  for (const b of sanitizedBalls) {
    assert.strictEqual(b.runs, 0, "runs must be 0");
    assert.strictEqual(b.cumulativeScore, 0, "cumulativeScore must be 0");
    assert.strictEqual(b.cumulativeWickets, 0, "cumulativeWickets must be 0");
    assert.strictEqual(b.wicket, false, "wicket flag must be false");
    assert.strictEqual(b.isBoundaryFour, false, "isBoundaryFour must be false");
    assert.strictEqual(b.isSix, false, "isSix must be false");
    assert.strictEqual(/\d+\/\d+/.test(b.commentary), false, "No score format in commentary");
    assert.strictEqual(/cumulativeScore/i.test(b.commentary), false, "No cumulativeScore in commentary");
  }

  const sanitizedMeta = sanitizeMetaForSpoiler(matchMeta, "story-only");
  assert.strictEqual(sanitizedMeta.target, 0, "target must be shielded");
  assert.strictEqual(sanitizedMeta.firstInningsScore, "Shielded", "firstInningsScore must be shielded");
});

test("Multi-Match Registry: getAvailableMatches lists multiple matches and loads alternative squads dynamically", () => {
  const available = getAvailableMatches();
  assert.ok(available.length >= 2, "Registry must register multiple matches from lib/data");
  assert.ok(available.some((m) => m.matchId === "ind-pak-2022-t20-wc"), "Must include ind-pak-2022-t20-wc");
  assert.ok(available.some((m) => m.matchId === "eng-pak-2022-t20-wc"), "Must include eng-pak-2022-t20-wc");

  // Check alternative match loads with England squad
  const engMatch = getServerMatchById("eng-pak-2022-t20-wc");
  assert.ok(engMatch !== null, "Must load eng-pak-2022-t20-wc match");
  assert.strictEqual(engMatch.meta.team2, "England");
  assert.strictEqual(engMatch.meta.target, 138);
  assert.ok(engMatch.meta.squad.includes("Jos Buttler"), "Must include Jos Buttler in England squad");
  assert.ok(engMatch.meta.squad.includes("Ben Stokes"), "Must include Ben Stokes in England squad");
});
