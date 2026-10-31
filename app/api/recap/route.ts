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

// In-Memory cache for ultra-fast <5ms retrieval
const recapCache = new Map<string, RecapPayload>();

// In-flight request map for de-duplicating concurrent identical calls
const inFlightRequests = new Map<string, Promise<RecapPayload>>();

function errorResponse(code: string, message: string, status: number) {
  const errRes: ApiResponse<null> = {
    success: false,
    error: { code, message, retryable: status >= 500 },
  };
  return NextResponse.json(errRes, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      matchId, 
      fromOver, 
      toOver, 
      spoilerLevel = "story-and-score", 
      language = "en",
    } = body;

    // Use strictly public balls up to liveBallIndex to guarantee zero future ball leaks
    const { meta, balls } = getServerMatchById(matchId, true);

    // Validation: Type & bounds checks
    if (typeof fromOver !== "number" || typeof toOver !== "number") {
      return errorResponse("INVALID_INPUT", "fromOver and toOver must be valid numbers.", 400);
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

    if (fromOver < 0 || toOver > meta.totalOvers) {
      return errorResponse("OUT_OF_BOUNDS", `Overs must be within 0 to ${meta.totalOvers}.`, 400);
    }

    if (fromOver >= toOver) {
      return errorResponse("INVALID_RANGE", "Start over must be strictly less than end over.", 400);
    }

    // Cache key for prefetching and instant response
    const cacheKey = `${meta.matchId}:${fromOver}:${toOver}:${spoilerLevel}:${language}`;
    if (recapCache.has(cacheKey)) {
      const res: ApiResponse<RecapPayload> = {
        success: true,
        data: recapCache.get(cacheKey)!,
        meta: {
          matchId: meta.matchId,
          usedFallback: false,
          cached: true,
          oversCovered: `Overs ${fromOver + 1} – ${toOver}`,
        }
      };
      return NextResponse.json(res);
    }

    // Check if an identical request is already running (in-flight de-duplication)
    let executionPromise = inFlightRequests.get(cacheKey);

    if (!executionPromise) {
      executionPromise = (async (): Promise<RecapPayload> => {
        // Single-pass fused processing: O(k) slicing, stats, running top 3, and player extraction
        const {
          missedBalls,
          stats,
          topMoments: computedMoments,
          battersInPhase,
          dismissedInPhase,
        } = processWindowFused(balls, fromOver, toOver);

        if (missedBalls.length === 0) {
          throw new Error("NO_DATA");
        }

        const fromDisplay = fromOver + 1;
        const toDisplay = typeof toOver === "number" && toOver % 1 !== 0 
          ? Number(toOver.toFixed(1)) 
          : toOver;

        // Dynamic phase calculation at the exact end of missed window
        const lastBall = missedBalls[missedBalls.length - 1];
        const scoreAtPhaseEnd = lastBall.cumulativeScore;
        const wicketsAtPhaseEnd = lastBall.cumulativeWickets;
        const ballsBowledSoFar = (lastBall.over * 6) + lastBall.ball;
        const ballsRemainingAtPhaseEnd = Math.max(0, (meta.totalOvers * 6) - ballsBowledSoFar);
        const runsNeededAtPhaseEnd = Math.max(0, meta.target - scoreAtPhaseEnd);
        const wicketsInHandAtPhaseEnd = 10 - wicketsAtPhaseEnd;

        // Dream11 Fantasy Team Performance (Captain Hardik, VC Rohit)
        const fantasyImpact = calculateFantasyPerformance(missedBalls, "Hardik Pandya", "Rohit Sharma");

        // Thrill Rating
        const thrillRating = computeThrillRating(missedBalls);

        // Forward-Looking "What to watch next" card
        const whatToWatchNext = getWhatToWatchNext(lastBall, meta);

        // Determine mood
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
            spoilerLevel as SpoilerLevel
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

            const validation = validateRecapAgainstBallData(
              { oneLiner: parsed.oneLiner, story: parsed.story, top3Moments: finalMoments },
              missedBalls
            );

            if (validation.valid) {
              recapPayload = {
                oneLiner: parsed.oneLiner,
                story: parsed.story,
                top3Moments: finalMoments,
                mood: parsed.mood || calculatedMood,
                partnershipSummary: parsed.partnershipSummary || `${battersInPhase.slice(0, 2).join(" & ")} anchored this chase phase.`,
                oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
                fantasyImpact,
                thrillRating,
                whatToWatchNext,
                spoilerLevel: spoilerLevel as SpoilerLevel,
              };
            }
          }
        } catch (err: any) {
          console.warn("Groq inference skipped or failed, using local fallback engine:", err?.message || err);
        }

        // Batters involved in this phase
        const battersSummary = battersInPhase.length > 0 
          ? battersInPhase.join(" and ") 
          : "the middle order";

        // Offline deterministic fallback
        if (!recapPayload) {
          const wicketsText = stats.wickets === 1 
            ? "1 wicket" 
            : `${stats.wickets} wickets`;
          
          const boundarySummary = `${stats.boundaries} fours and ${stats.sixes} sixes`;

          let storySummary: string;
          let headlineText: string;

          if (spoilerLevel === "story-only") {
            // Level 1: Redact all numerical scores from story and headline
            storySummary = `Between overs ${fromDisplay} and ${toDisplay}, India navigated a high-stakes phase. ${battersSummary} absorbed intense pressure against the spinners and counter-attacked with key boundaries to relieve the required-rate climb. As the match reaches over ${toDisplay}, the middle order has stabilized the chase and set up a thrilling finish heading into live action.`;
            headlineText = `You missed the chaos! Crucial wickets shook India early, but the middle order counter-punched fearlessly!`;
          } else {
            // Level 2 & 3: Include score at the phase end
            if (runsNeededAtPhaseEnd <= 0) {
              storySummary = `India chased down the target with a relentless counter-attack, finishing the match in style.`;
            } else {
              storySummary = `Between overs ${fromDisplay} and ${toDisplay}, India scored ${stats.runs} runs for the loss of ${wicketsText}. ${battersSummary} absorbed pressure and countered with ${boundarySummary}. At over ${toDisplay}, India stand at ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}, needing ${runsNeededAtPhaseEnd} runs from the remaining ${ballsRemainingAtPhaseEnd} deliveries with ${wicketsInHandAtPhaseEnd} wickets in hand.`;
            }

            if (stats.wickets >= 2) {
              const dismissedNames = dismissedInPhase.slice(0, 2).join(" and ");
              headlineText = `You missed the chaos! NZ struck to remove ${dismissedNames || "key batters"}, but India fought back to ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}.`;
            } else if (stats.runs >= 30) {
              headlineText = `India went on the offensive! ${stats.runs} runs hammered in ${stats.totalBalls} balls to seize control of the chase.`;
            } else {
              headlineText = `Tense tactical battle! India reached ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} through tight spells and sharp running.`;
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
            spoilerLevel: spoilerLevel as SpoilerLevel,
          };
        }

        // Server-side Redaction for "story-only" spoiler level
        if (spoilerLevel === "story-only") {
          recapPayload.oneLiner = `You missed the chaos! Crucial wickets shook India early, but the middle order counter-punched fearlessly!`;
          recapPayload.story = `Between overs ${fromDisplay} and ${toDisplay}, India navigated a high-stakes phase. ${battersSummary} absorbed pressure against the spinners and counter-attacked with key boundaries to keep required-rate pressure in check. As the match reaches over ${toDisplay}, the partnership has stabilized the chase and set up a competitive finish heading into the live action.`;
          
          if (recapPayload.whatToWatchNext) {
            recapPayload.whatToWatchNext.equation = `Chasing in the death overs with established middle-order strikers at the crease.`;
          }
        }

        // Dynamic Hinglish commentary
        let hinglishHeadline: string;
        let hinglishNarrative: string;

        if (spoilerLevel === "story-only") {
          hinglishHeadline = `Bhai bawal match chal raha hai! NZ ne wickets gira ke pressure banaya, par Indian batters ne stadium hila ke momentum badal diya!`;
          hinglishNarrative = `Overs ${fromDisplay} se ${toDisplay} ke dauran NZ ke spinners ne bawal bowling ki, par ${battersSummary} ne counter-attack karke match ko barabari par laa khada kiya. Ab live phase mein sab kuch thrilling mod par hai!`;
        } else {
          if (stats.wickets >= 2) {
            hinglishHeadline = `Bhai bawal match miss kar diya! NZ ne jhatke diye par India ne ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} tak counter-punch kar diya!`;
          } else if (stats.runs >= 30) {
            hinglishHeadline = `Bhai kya dhulai chal rahi hai! India ne ${stats.totalBalls} balls mein ${stats.runs} runs thok ke match apne pakad mein kar liya!`;
          } else {
            hinglishHeadline = `Tense run-chase chal raha hai bhai! India ne boundary aur sharp running se score ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd} pahuncha diya.`;
          }

          if (runsNeededAtPhaseEnd <= 0) {
            hinglishNarrative = `India ne match ko zabardast andaaz mein finish kar diya!`;
          } else {
            hinglishNarrative = `Overs ${fromDisplay} se ${toDisplay} ke beech India ne ${stats.runs} runs banaye ${stats.wickets > 0 ? `${stats.wickets} wicket kho kar` : `bina wicket khoye`}. ${battersSummary} ne ${stats.boundaries} chauke aur ${stats.sixes} chakke jad kar pressure release kiya. Ab over ${toDisplay} par score hai ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}, aur jeet ke liye chahiye ${runsNeededAtPhaseEnd} runs ${ballsRemainingAtPhaseEnd} balls mein!`;
          }
        }

        recapPayload.hinglishOneLiner = hinglishHeadline;
        recapPayload.hinglishStory = hinglishNarrative;

        // Cache completed result
        recapCache.set(cacheKey, recapPayload);
        return recapPayload;
      })();

      inFlightRequests.set(cacheKey, executionPromise);
    }

    try {
      const payload = await executionPromise;
      const res: ApiResponse<RecapPayload> = {
        success: true,
        data: payload,
        meta: {
          matchId: meta.matchId,
          usedFallback: false,
          cached: false,
          oversCovered: `Overs ${fromOver + 1} – ${toOver}`,
        }
      };
      return NextResponse.json(res);
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
