import { NextRequest, NextResponse } from "next/server";
import { getServerMatchById } from "@/lib/serverMatchData";
import { 
  sliceBalls,
  processWindowFused,
  validateRecapAgainstBallData,
  calculateFantasyPerformance,
  computeThrillRating,
  getWhatToWatchNext,
  ALLOWED_MOODS,
  redactPayloadForSpoiler,
  generateFallbackRecap,
} from "@/lib/matchUtils";
import { buildRecapPrompt } from "@/lib/promptBuilder";
import { callGroqRecap } from "@/lib/groqClient";
import { ApiResponse, RecapPayload, SpoilerLevel } from "@/types";
import { getClientIp, BoundedRateLimiter } from "@/lib/rateLimit";
import { 
  verifySimulatorToken,
  calculateAllowedIndex,
  createSimulatorToken,
  SimulatorSession,
} from "@/lib/sessionUtils";

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

// Centralized sliding-window rate limiter: Max 40 requests per minute per IP
const recapLimiter = new BoundedRateLimiter({ windowMs: 60_000, maxRequests: 40, maxEntries: 500 });

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
      isWholeMatch = false,
      fantasySelection,
    } = body;

    // 2. Validate client rate limit using RFC-compliant IP extraction
    const clientIp = getClientIp(req);
    if (!recapLimiter.check(clientIp)) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "Too many requests. Please slow down.", 429);
    }

    // 3. Validate match exists with 404 on unknown matchId
    const match = getServerMatchById(matchId, true);
    if (!match) {
      return errorResponse("MATCH_NOT_FOUND", `Match "${matchId}" not found.`, 404);
    }
    const { meta, balls } = match;

    // 4. Validate spoilerLevel
    const VALID_SPOILER_LEVELS = new Set<string>(["story-only", "story-and-score"]);
    if (spoilerLevel && !VALID_SPOILER_LEVELS.has(spoilerLevel)) {
      return errorResponse("INVALID_INPUT", "spoilerLevel must be 'story-only' or 'story-and-score'.", 400);
    }

    // 5. Over bounds & cricket format checks
    if (typeof fromOver !== "number" || typeof toOver !== "number" || isNaN(fromOver) || isNaN(toOver)) {
      return errorResponse("INVALID_INPUT", "fromOver and toOver must be valid numbers.", 400);
    }

    // Strict decimal validation: at most 1 decimal place (e.g. 14.2, not 14.25 or 14.02)
    const roundedToTenth = Math.round(toOver * 10) / 10;
    if (Math.abs(toOver - roundedToTenth) > 1e-6) {
      return errorResponse("INVALID_OVER", `toOver (${toOver}) must have at most 1 decimal place.`, 400);
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

    // Two Clocks Synchronization:
    // If client provides a valid simulator token, unlock deliveries according to the dynamic clock
    const sessionTokenHeader = req.headers.get("x-simulator-token") || (typeof body.sessionToken === "string" ? body.sessionToken : null);
    let dynamicMaxOver = meta.isMatchFinished ? meta.totalOvers : meta.currentLiveOver;
    let verifiedSession: SimulatorSession | null = null;

    if (sessionTokenHeader) {
      const verification = verifySimulatorToken(sessionTokenHeader);
      if (verification.valid && verification.session && verification.session.matchId === meta.matchId) {
        verifiedSession = verification.session;
        const allowedIndex = calculateAllowedIndex(verifiedSession);
        const clampedIndex = Math.min(balls.length - 1, Math.max(0, allowedIndex));
        if (balls[clampedIndex]) {
          const b = balls[clampedIndex];
          const ballOver = b.over + ((b.legalBall || b.ball) / 10);
          if (ballOver > dynamicMaxOver) {
            dynamicMaxOver = ballOver;
          }
        }
      }
    }

    // Zero-Spoiler enforcement: Do not allow asking for overs past the allowed live cutoff
    if (toOver > dynamicMaxOver + 0.05) {
      return errorResponse(
        "OUT_OF_BOUNDS", 
        `Cannot request recap beyond current live over (${dynamicMaxOver.toFixed(1)}). Zero-spoiler protection active.`, 
        400
      );
    }

    if (fromOver >= toOver) {
      return errorResponse("INVALID_RANGE", "Start over must be strictly less than end over.", 400);
    }

    // Fantasy selection validation (Finding 10)
    let capName = meta.squad?.[0] || "Virat Kohli";
    let vcName = meta.squad?.[1] || "Hardik Pandya";

    if (fantasySelection !== undefined) {
      if (typeof fantasySelection !== "object" || fantasySelection === null || Array.isArray(fantasySelection)) {
        return errorResponse("INVALID_INPUT", "fantasySelection must be a valid object.", 400);
      }
      if (fantasySelection.captain) {
        if (typeof fantasySelection.captain !== "string" || fantasySelection.captain.trim().length === 0 || fantasySelection.captain.trim().length > 40) {
          return errorResponse("INVALID_INPUT", "fantasySelection.captain must be a string up to 40 characters.", 400);
        }
        capName = fantasySelection.captain.trim();
      }
      if (fantasySelection.viceCaptain) {
        if (typeof fantasySelection.viceCaptain !== "string" || fantasySelection.viceCaptain.trim().length === 0 || fantasySelection.viceCaptain.trim().length > 40) {
          return errorResponse("INVALID_INPUT", "fantasySelection.viceCaptain must be a string up to 40 characters.", 400);
        }
        vcName = fantasySelection.viceCaptain.trim();
      }
    }

    // Strict rule: Captain and Vice-Captain cannot be the same player
    if (capName.toLowerCase() === vcName.toLowerCase()) {
      return errorResponse("INVALID_INPUT", "Captain and Vice-Captain must be different players.", 400);
    }

    // Strict rule: Players must belong to match squad if defined
    if (meta.squad && meta.squad.length > 0) {
      const squadLower = meta.squad.map(p => p.toLowerCase());
      if (!squadLower.includes(capName.toLowerCase())) {
        return errorResponse("INVALID_INPUT", `Selected captain "${capName}" is not in the squad.`, 400);
      }
      if (!squadLower.includes(vcName.toLowerCase())) {
        return errorResponse("INVALID_INPUT", `Selected vice-captain "${vcName}" is not in the squad.`, 400);
      }
    }

    const toDisplay = toFraction > 0 ? Number(toOver.toFixed(1)) : toCompleted;
    // fromDisplay: use "1" for over 0 so UI reads "Overs 1 – 14.2" not "Overs 0.1 – 14.2"
    const fromDisplay = fromOver === 0 ? 1 : fromOver + 1;
    const oversCoveredText = `Overs ${fromDisplay} – ${toDisplay}`;
    const normalizedSpoilerLevel = spoilerLevel as SpoilerLevel;

    // 6. Cache key: Partitioned per match, window, spoilerLevel & scope (Finding 16)
    const cacheKey = `${meta.matchId}:${fromOver}:${toDisplay}:${normalizedSpoilerLevel}:${isWholeMatch ? "whole" : "part"}`;
    const baseLiveIdx = meta.liveBallIndex !== undefined ? meta.liveBallIndex : balls.length - 1;
    const refreshedToken = verifiedSession 
      ? createSimulatorToken(meta.matchId, verifiedSession.baseIndex) 
      : createSimulatorToken(meta.matchId, baseLiveIdx);
    const cachedEntry = getFromCache(cacheKey);
    if (cachedEntry) {
      // Personalize fantasy performance dynamically per request outside the cache
      const windowBalls = sliceBalls(balls, fromOver, toOver);
      const rawDeliveredPayload: RecapPayload = {
        ...cachedEntry.payload,
        fantasyImpact: calculateFantasyPerformance(windowBalls, capName, vcName, {
          teamName: `${meta.team2 || "Dream"}XI`,
          squad: meta.squad,
        }),
      };
      const deliveredPayload = redactPayloadForSpoiler(rawDeliveredPayload, normalizedSpoilerLevel, meta.team2);

      const res: ApiResponse<RecapPayload> & { sessionToken?: string } = {
        success: true,
        data: deliveredPayload,
        meta: {
          matchId: meta.matchId,
          usedFallback: cachedEntry.usedFallback,
          cached: true,
          oversCovered: oversCoveredText,
        },
        sessionToken: refreshedToken,
      };
      return NextResponse.json(res, {
        headers: {
          "Cache-Control": "private, no-store",
        },
      });
    }

    // In-flight de-duplication
    let executionPromise = inFlightRequests.get(cacheKey);

    if (!executionPromise) {
      executionPromise = (async (): Promise<{ payload: RecapPayload; usedFallback: boolean }> => {
        let isFallbackUsed = false;

        // Fused processing: O(k) slicing with preceding-ball probability
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

        // Phase end stats
        const lastBall = missedBalls[missedBalls.length - 1];
        const scoreAtPhaseEnd = lastBall.cumulativeScore;
        const wicketsAtPhaseEnd = lastBall.cumulativeWickets;
        const ballsBowledSoFar = (lastBall.over * 6) + lastBall.ball;
        const ballsRemainingAtPhaseEnd = Math.max(0, (meta.totalOvers * 6) - ballsBowledSoFar);
        const runsNeededAtPhaseEnd = Math.max(0, meta.target - scoreAtPhaseEnd);
        const wicketsInHandAtPhaseEnd = 10 - wicketsAtPhaseEnd;

        // Thrill Rating
        const thrillRating = computeThrillRating(missedBalls, initialPrevProb);

        // Forward-looking "What to watch next" card
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

            // Comprehensive validation guardrail covering moments, narrative & mood
            const validation = validateRecapAgainstBallData(
              { oneLiner: parsed.oneLiner, story: parsed.story, top3Moments: finalMoments, mood: parsed.mood },
              missedBalls,
              toDisplay,
              meta.squad
            );

            // Story-only zero-digit check across ALL narrative fields (Finding 4)
            if (normalizedSpoilerLevel === "story-only") {
              const allNarrativeText = [
                parsed.oneLiner,
                parsed.story,
                parsed.partnershipSummary,
                ...(finalMoments || []).map((m: any) => `${m.description || ""} ${m.impact || ""}`),
              ].filter(Boolean).join(" ");

              if (/\d/.test(allNarrativeText)) {
                validation.valid = false;
                validation.issues.push("Story-only prose contains numeric digits in narrative fields");
              }
            }

            const validatedMood = (parsed.mood && ALLOWED_MOODS.has(parsed.mood)) ? parsed.mood : calculatedMood;

            if (validation.valid) {
              recapPayload = {
                oneLiner: parsed.oneLiner,
                story: parsed.story,
                top3Moments: finalMoments,
                mood: validatedMood,
                partnershipSummary: parsed.partnershipSummary || `${battersInPhase.slice(0, 2).join(" & ")} anchored this chase phase.`,
                oversCovered: oversCoveredText,
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

        // Offline deterministic fallback
        if (!recapPayload) {
          isFallbackUsed = true;
          recapPayload = generateFallbackRecap(
            missedBalls,
            meta,
            fromDisplay,
            toDisplay,
            normalizedSpoilerLevel,
            {
              stats,
              topMoments: computedMoments,
              battersInPhase,
              dismissedInPhase,
              calculatedMood,
              thrillRating,
              whatToWatchNext,
            }
          );
        }

        const result = { payload: recapPayload, usedFallback: isFallbackUsed };
        setBoundedCache(cacheKey, result);
        return result;
      })();

      inFlightRequests.set(cacheKey, executionPromise);
    }

    try {
      const { payload, usedFallback } = await executionPromise;
      const windowBalls = sliceBalls(balls, fromOver, toOver);
      const rawDeliveredPayload: RecapPayload = {
        ...payload,
        fantasyImpact: calculateFantasyPerformance(windowBalls, capName, vcName, {
          teamName: `${meta.team2 || "Dream"}XI`,
          squad: meta.squad,
        }),
      };
      const deliveredPayload = redactPayloadForSpoiler(rawDeliveredPayload, normalizedSpoilerLevel, meta.team2);

      const res: ApiResponse<RecapPayload> & { sessionToken?: string } = {
        success: true,
        data: deliveredPayload,
        meta: {
          matchId: meta.matchId,
          usedFallback,
          cached: false,
          oversCovered: oversCoveredText,
        },
        sessionToken: refreshedToken,
      };
      return NextResponse.json(res, {
        headers: {
          "Cache-Control": "private, no-store",
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
