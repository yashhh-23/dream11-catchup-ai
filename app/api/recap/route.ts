import { NextRequest, NextResponse } from "next/server";
import { getServerMatchById } from "@/lib/serverMatchData";
import { 
  processWindowFused,
  validateRecapAgainstBallData,
  calculateFantasyPerformance,
  computeThrillRating,
  getWhatToWatchNext,
} from "@/lib/matchUtils";
import { buildRecapPrompt } from "@/lib/promptBuilder";
import { callGroqRecap } from "@/lib/groqClient";
import { ApiResponse, RecapPayload, SpoilerLevel } from "@/types";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

// Bounded in-memory LRU cache with TTL to prevent unbounded memory growth (Optimization B)
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

interface CacheEntry {
  payload: RecapPayload;
  usedFallback: boolean;
  timestamp: number;
}

const recapCache = new Map<string, CacheEntry>();

// In-flight request map for de-duplicating concurrent identical calls
const inFlightRequests = new Map<string, Promise<{ payload: RecapPayload; usedFallback: boolean }>>();

// Sliding-window rate limiter (Bug 7): Max 40 requests per minute per IP / token
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientKey);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientKey, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (record.count >= 40) {
    return false;
  }
  record.count++;
  return true;
}

function getFromCache(key: string): CacheEntry | null {
  const entry = recapCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    recapCache.delete(key);
    return null;
  }
  // LRU touch: re-insert at end
  recapCache.delete(key);
  recapCache.set(key, entry);
  return entry;
}

function setBoundedCache(key: string, value: { payload: RecapPayload; usedFallback: boolean }) {
  if (recapCache.size >= MAX_CACHE_SIZE) {
    const firstKey = recapCache.keys().next().value;
    if (firstKey) recapCache.delete(firstKey);
  }
  recapCache.set(key, { ...value, timestamp: Date.now() });
}

function redactPayloadForSpoiler(payload: RecapPayload, level: SpoilerLevel): RecapPayload {
  if (level !== "story-only") {
    return { ...payload, spoilerLevel: level };
  }

  // Pure story only: zero scores, targets, and numeric run counts
  return {
    ...payload,
    spoilerLevel: "story-only",
    oneLiner: payload.oneLiner.replace(/\b\d+\/\d+\b/g, "").replace(/\b\d+\s+runs\b/gi, "crucial runs"),
    story: payload.story.replace(/\b\d+\/\d+\b/g, "").replace(/\bneeding\s+\d+\s+runs\s+from\s+\d+\s+deliveries\b/gi, "chasing the target"),
    hinglishOneLiner: payload.hinglishOneLiner?.replace(/\b\d+\/\d+\b/g, ""),
    hinglishStory: payload.hinglishStory?.replace(/\b\d+\/\d+\b/g, ""),
    whatToWatchNext: payload.whatToWatchNext ? {
      ...payload.whatToWatchNext,
      equation: "Chase ongoing",
    } : undefined,
  };
}

function errorResponse(code: string, message: string, status: number) {
  const errRes: ApiResponse<null> = {
    success: false,
    error: { code, message, retryable: status >= 500 },
  };
  return NextResponse.json(errRes, { status });
}

export async function POST(req: NextRequest) {
  // 1. Safe JSON parsing with 400 response on invalid JSON (Bug 8)
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  try {
    const { 
      matchId, 
      fromOver, 
      toOver, 
      spoilerLevel = "story-and-score", 
      language = "en",
      isWholeMatch = false,
      fantasySelection,
    } = body;

    // 2. Validate client rate limit (Bug 7)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "global-client";
    if (!checkRateLimit(clientIp)) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "Too many requests. Please slow down.", 429);
    }

    // 3. Validate match exists with 404 on unknown matchId (Bug 8)
    const match = getServerMatchById(matchId, true);
    if (!match) {
      return errorResponse("MATCH_NOT_FOUND", `Match "${matchId}" not found.`, 404);
    }
    const { meta, balls } = match;

    // 4. Validate spoilerLevel and language (Bug 7)
    const VALID_SPOILER_LEVELS = new Set(["story-only", "story-and-score", "full"]);
    if (spoilerLevel && !VALID_SPOILER_LEVELS.has(spoilerLevel)) {
      return errorResponse("INVALID_INPUT", "spoilerLevel must be 'story-only', 'story-and-score', or 'full'.", 400);
    }

    const VALID_LANGUAGES = new Set(["en", "hinglish"]);
    if (language && !VALID_LANGUAGES.has(language)) {
      return errorResponse("INVALID_INPUT", "language must be 'en' or 'hinglish'.", 400);
    }

    // 5. Over bounds & cricket format checks (Bug 9)
    if (typeof fromOver !== "number" || typeof toOver !== "number" || isNaN(fromOver) || isNaN(toOver)) {
      return errorResponse("INVALID_INPUT", "fromOver and toOver must be valid numbers.", 400);
    }

    // fromOver must be an integer completed over (e.g. 0 to 19)
    if (!Number.isInteger(fromOver) || fromOver < 0 || fromOver >= meta.totalOvers) {
      return errorResponse("INVALID_OVER", `fromOver must be an integer between 0 and ${meta.totalOvers - 1}.`, 400);
    }

    // toOver must be a valid cricket delivery: integer or decimal with fraction between .1 and .6
    const toCompleted = Math.floor(toOver);
    const toFraction = Math.round((toOver - toCompleted) * 10);
    if (toOver <= 0 || toCompleted > meta.totalOvers || toFraction > 6 || (toCompleted === meta.totalOvers && toFraction > 0)) {
      return errorResponse(
        "INVALID_OVER", 
        `toOver (${toOver}) is not a valid cricket over. Deliveries must be between .1 and .6 (e.g. 14.2).`, 
        400
      );
    }

    // Zero-Spoiler enforcement: Do not allow asking for overs past the live match cutoff
    const maxAllowedOver = meta.isMatchFinished ? meta.totalOvers : meta.currentLiveOver;
    if (toOver > maxAllowedOver) {
      return errorResponse(
        "OUT_OF_BOUNDS", 
        `Cannot request recap beyond current live over (${maxAllowedOver}). Zero-spoiler protection active.`, 
        400
      );
    }

    if (fromOver >= toOver) {
      return errorResponse("INVALID_RANGE", "Start over must be strictly less than end over.", 400);
    }

    const toDisplay = toFraction > 0 ? Number(toOver.toFixed(1)) : toCompleted;
    const normalizedSpoilerLevel = spoilerLevel as SpoilerLevel;

    // 6. Cache key: Normalized per match & window, omitting spoilerLevel/language (Optimization B)
    const cacheKey = `${meta.matchId}:${fromOver}:${toDisplay}`;
    const cachedEntry = getFromCache(cacheKey);
    if (cachedEntry) {
      const redacted = redactPayloadForSpoiler(cachedEntry.payload, normalizedSpoilerLevel);
      const res: ApiResponse<RecapPayload> = {
        success: true,
        data: redacted,
        meta: {
          matchId: meta.matchId,
          usedFallback: cachedEntry.usedFallback,
          cached: true,
          oversCovered: `Overs ${fromOver + 1} – ${toDisplay}`,
        }
      };
      return NextResponse.json(res, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // In-flight de-duplication
    let executionPromise = inFlightRequests.get(cacheKey);

    if (!executionPromise) {
      executionPromise = (async (): Promise<{ payload: RecapPayload; usedFallback: boolean }> => {
        let isFallbackUsed = false;

        // Fused processing: O(k) slicing with preceding-ball probability (Bug 14)
        const {
          missedBalls,
          stats,
          topMoments: computedMoments,
          battersInPhase,
          dismissedInPhase,
          initialPrevProb,
        } = processWindowFused(balls, fromOver, toOver);

        if (missedBalls.length === 0) {
          throw new Error("NO_DATA");
        }

        const fromDisplay = fromOver + 1;

        // Phase end stats
        const lastBall = missedBalls[missedBalls.length - 1];
        const scoreAtPhaseEnd = lastBall.cumulativeScore;
        const wicketsAtPhaseEnd = lastBall.cumulativeWickets;
        const ballsBowledSoFar = (lastBall.over * 6) + lastBall.ball;
        const ballsRemainingAtPhaseEnd = Math.max(0, (meta.totalOvers * 6) - ballsBowledSoFar);
        const runsNeededAtPhaseEnd = Math.max(0, meta.target - scoreAtPhaseEnd);
        const wicketsInHandAtPhaseEnd = 10 - wicketsAtPhaseEnd;

        // Fantasy team performance (Bug 16: supports dynamic captain/VC selection, excludes run-outs from bowler)
        const capName = fantasySelection?.captain || "Hardik Pandya";
        const vcName = fantasySelection?.viceCaptain || "Rohit Sharma";
        const fantasyImpact = calculateFantasyPerformance(missedBalls, capName, vcName);

        // Thrill Rating (Bug 14: uses initialPrevProb for first-ball swing)
        const thrillRating = computeThrillRating(missedBalls, initialPrevProb);

        // Forward-looking "What to watch next" card (Bug 17: dynamic non-striker & spell phase)
        const whatToWatchNext = getWhatToWatchNext(lastBall, meta, balls);

        // Calculate default mood
        let calculatedMood: RecapPayload["mood"] = "Knife's edge";
        if (stats.runs >= 35 && stats.wickets <= 1) {
          calculatedMood = "Cruising";
        } else if (stats.runRate < 7.0) {
          calculatedMood = "Chasing hard";
        } else if (runsNeededAtPhaseEnd <= 0) {
          calculatedMood = "Cruising";
        }

        let recapPayload: RecapPayload | null = null;

        try {
          const prompt = buildRecapPrompt(
            missedBalls, 
            meta, 
            fromDisplay, 
            toDisplay, 
            computedMoments,
            normalizedSpoilerLevel,
            Boolean(isWholeMatch)
          );
          const rawResponse = await callGroqRecap(prompt);
          const parsed = JSON.parse(rawResponse);

          if (parsed.oneLiner && parsed.story) {
            const finalMoments = computedMoments.map((codeMom, idx) => {
              const llmMom = parsed.top3Moments?.[idx] || parsed.top3Moments?.find((m: any) => m.over === codeMom.over);
              return {
                ...codeMom,
                description: llmMom?.description || codeMom.description,
                impact: llmMom?.impact || codeMom.impact,
              };
            });

            // Comprehensive validation guardrail covering moments, narrative & mood (Bug 11)
            const validation = validateRecapAgainstBallData(
              { oneLiner: parsed.oneLiner, story: parsed.story, top3Moments: finalMoments, mood: parsed.mood },
              missedBalls,
              toDisplay
            );

            const ALLOWED_MOODS = new Set(["Cruising", "Knife's edge", "Chasing hard", "Game over", "Comeback on"]);
            const validatedMood = (parsed.mood && ALLOWED_MOODS.has(parsed.mood)) ? parsed.mood : calculatedMood;

            if (validation.valid) {
              recapPayload = {
                oneLiner: parsed.oneLiner,
                story: parsed.story,
                top3Moments: finalMoments,
                mood: validatedMood,
                partnershipSummary: parsed.partnershipSummary || `${battersInPhase.slice(0, 2).join(" & ")} anchored this chase phase.`,
                oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
                fantasyImpact,
                thrillRating,
                whatToWatchNext,
                spoilerLevel: normalizedSpoilerLevel,
              };
            }
          }
        } catch (err: any) {
          console.warn("Groq inference skipped or failed, using local fallback engine:", err?.message || err);
        }

        const battersSummary = battersInPhase.length > 0 
          ? battersInPhase.join(" and ") 
          : "the middle order";

        // Offline deterministic fallback (Bug 10: correctly sets isFallbackUsed = true)
        if (!recapPayload) {
          isFallbackUsed = true;
          const wicketsText = stats.wickets === 1 
            ? "1 wicket" 
            : `${stats.wickets} wickets`;
          
          const boundarySummary = `${stats.boundaries} fours and ${stats.sixes} sixes`;

          let storySummary: string;
          let headlineText: string;

          if (normalizedSpoilerLevel === "story-only") {
            storySummary = `Between overs ${fromDisplay} and ${toDisplay}, ${meta.team2} navigated a high-stakes phase. ${battersSummary} absorbed pressure and counter-attacked with key boundaries to keep the run-chase alive. As the match reaches over ${toDisplay}, the partnership has stabilized the innings heading into live action.`;
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

          recapPayload = {
            oneLiner: headlineText,
            story: storySummary,
            top3Moments: computedMoments,
            mood: calculatedMood,
            partnershipSummary: `${battersInPhase.slice(0, 2).join(" and ")} stabilized the innings with a counter-attacking stand.`,
            oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
            fantasyImpact,
            thrillRating,
            whatToWatchNext,
            spoilerLevel: normalizedSpoilerLevel,
          };
        }

        // Server-side Redaction for "story-only" spoiler level
        if (normalizedSpoilerLevel === "story-only") {
          recapPayload.oneLiner = `You missed the chaos! Crucial wickets shook the top order early, but the middle order counter-punched fearlessly!`;
          recapPayload.story = `Between overs ${fromDisplay} and ${toDisplay}, ${meta.team2} navigated a high-stakes phase. ${battersSummary} absorbed pressure against the bowling attack and counter-attacked with key boundaries to keep required-rate pressure in check. As the match reaches over ${toDisplay}, the partnership has stabilized the chase heading into live action.`;
          
          if (recapPayload.whatToWatchNext) {
            recapPayload.whatToWatchNext.equation = `Chasing in the active phase with middle-order strikers at the crease.`;
          }
        }

        // Dynamic Hinglish commentary (Bug 18: dynamic team names, no hardcoded NZ/India)
        let hinglishHeadline: string;
        let hinglishNarrative: string;

        if (normalizedSpoilerLevel === "story-only") {
          hinglishHeadline = `Bhai bawal match chal raha hai! ${meta.team1} ne wickets gira ke pressure banaya, par ${meta.team2} ne counter-attack karke momentum badal diya!`;
          hinglishNarrative = `Overs ${fromDisplay} se ${toDisplay} ke dauran ${meta.team1} ke bowling attack ne bawal bowling ki, par ${battersSummary} ne counter-attack karke match ko barabari par laa khada kiya. Ab live phase mein sab kuch thrilling mod par hai!`;
        } else {
          if (stats.wickets >= 2) {
            hinglishHeadline = `Bhai bawal match miss kar diya! ${meta.team1} ne jhatke diye par ${meta.team2} ne ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} tak counter-punch kar diya!`;
          } else if (stats.runs >= 30) {
            hinglishHeadline = `Bhai kya dhulai chal rahi hai! ${meta.team2} ne ${stats.totalBalls} balls mein ${stats.runs} runs thok ke match apne pakad mein kar liya!`;
          } else {
            hinglishHeadline = `Tense run-chase chal raha hai bhai! ${meta.team2} ne boundary aur sharp running se score ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} pahuncha diya.`;
          }

          if (runsNeededAtPhaseEnd <= 0) {
            hinglishNarrative = `${meta.team2} ne match ko zabardast andaaz mein finish kar diya!`;
          } else {
            hinglishNarrative = `Overs ${fromDisplay} se ${toDisplay} ke beech ${meta.team2} ne ${stats.runs} runs banaye ${stats.wickets > 0 ? `${stats.wickets} wicket kho kar` : `bina wicket khoye`}. ${battersSummary} ne ${stats.boundaries} chauke aur ${stats.sixes} chakke jad kar pressure release kiya. Ab over ${toDisplay} par score hai ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}, aur jeet ke liye chahiye ${runsNeededAtPhaseEnd} runs ${ballsRemainingAtPhaseEnd} balls mein!`;
          }
        }

        recapPayload.hinglishOneLiner = hinglishHeadline;
        recapPayload.hinglishStory = hinglishNarrative;

        const result = { payload: recapPayload, usedFallback: isFallbackUsed };
        setBoundedCache(cacheKey, result);
        return result;
      })();

      inFlightRequests.set(cacheKey, executionPromise);
    }

    try {
      const { payload, usedFallback } = await executionPromise;
      const deliveredPayload = redactPayloadForSpoiler(payload, normalizedSpoilerLevel);
      const res: ApiResponse<RecapPayload> = {
        success: true,
        data: deliveredPayload,
        meta: {
          matchId: meta.matchId,
          usedFallback, // Correct boolean status (Bug 10)
          cached: false,
          oversCovered: `Overs ${fromOver + 1} – ${toDisplay}`,
        }
      };
      return NextResponse.json(res, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Edge cache optimization (Bug 13)
        },
      });
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  } catch (error: any) {
    console.error("Error in /api/recap:", error);
    if (error?.message === "NO_DATA") {
      return errorResponse("NO_DATA", "No ball data found for the selected over range.", 404);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", "Failed to generate recap. Please try again.", 500);
  }
}
