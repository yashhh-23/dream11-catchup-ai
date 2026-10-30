import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/matchData";
import { 
  sliceBalls, 
  getTopMomentsFallback, 
  calculateOverStats, 
  validateRecapAgainstBallData 
} from "@/lib/matchUtils";
import { buildRecapPrompt } from "@/lib/promptBuilder";
import { callGroqRecap } from "@/lib/groqClient";
import { ApiResponse, RecapPayload } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchId, fromOver, toOver } = body;

    // Load match from registry (accepts matchId, defaults gracefully)
    const { meta, balls } = getMatchById(matchId);

    // Validation S1, S6: Type & bounds checks
    if (typeof fromOver !== "number" || typeof toOver !== "number") {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "INVALID_INPUT", message: "fromOver and toOver must be valid numbers.", retryable: false },
      };
      return NextResponse.json(errRes, { status: 400 });
    }

    if (fromOver < 0 || toOver > meta.totalOvers + 1) {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "OUT_OF_BOUNDS", message: `Overs must be within 0 to ${meta.totalOvers}.`, retryable: false },
      };
      return NextResponse.json(errRes, { status: 400 });
    }

    if (fromOver >= toOver) {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "INVALID_RANGE", message: "Start over must be strictly less than end over.", retryable: false },
      };
      return NextResponse.json(errRes, { status: 400 });
    }

    // Slice match data without two-ball gap (supports fractional live overs like 14.2)
    const missedBalls = sliceBalls(balls, fromOver, toOver);
    if (missedBalls.length === 0) {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "NO_DATA", message: "No ball data found for the selected over range.", retryable: false },
      };
      return NextResponse.json(errRes, { status: 404 });
    }

    const fromDisplay = fromOver + 1;
    const toDisplay = typeof toOver === "number" && toOver % 1 !== 0 
      ? Number(toOver.toFixed(1)) 
      : toOver;

    const stats = calculateOverStats(missedBalls);

    // 1. Compute ground-truth turning points in code first (guarantees real overs, real players, real win-probs)
    const computedMoments = getTopMomentsFallback(missedBalls, 3);

    // Dynamic phase calculation at the exact end of missed window (prevents leaking future live state)
    const lastBall = missedBalls[missedBalls.length - 1];
    const scoreAtPhaseEnd = lastBall.cumulativeScore;
    const wicketsAtPhaseEnd = lastBall.cumulativeWickets;
    const ballsBowledSoFar = (lastBall.over * 6) + lastBall.ball;
    const ballsRemainingAtPhaseEnd = Math.max(0, (meta.totalOvers * 6) - ballsBowledSoFar);
    const runsNeededAtPhaseEnd = Math.max(0, meta.target - scoreAtPhaseEnd);
    const wicketsInHandAtPhaseEnd = 10 - wicketsAtPhaseEnd;

    // Batters and wickets involved in this exact phase
    const battersInPhase = Array.from(new Set(missedBalls.map(b => b.batter)));
    const dismissedInPhase = missedBalls
      .filter(b => b.wicket)
      .map(b => b.dismissedPlayer || b.batter);

    // Determine mood using numeric comparisons (fixes string comparison bug)
    let calculatedMood: RecapPayload["mood"] = "Knife's edge";
    if (stats.wickets >= 3) {
      calculatedMood = "Knife's edge";
    } else if (stats.runs >= 35 && stats.wickets <= 1) {
      calculatedMood = "Cruising";
    } else if (stats.runRate < 7.0) {
      calculatedMood = "Chasing hard";
    } else if (runsNeededAtPhaseEnd <= 0) {
      calculatedMood = "Cruising";
    }

    // Try Groq AI generation for prose only
    let recapPayload: RecapPayload | null = null;
    let usedFallback = false;

    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 5) {
      try {
        const prompt = buildRecapPrompt(missedBalls, meta, fromDisplay, toDisplay, computedMoments);
        const rawResponse = await callGroqRecap(prompt);

        // Sanitize markdown fences if LLM accidentally enclosed in ```json
        const cleaned = rawResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const parsed = JSON.parse(cleaned);

        if (parsed.oneLiner && parsed.story) {
          // Merge LLM descriptions into code-computed ground-truth moments
          const finalMoments = computedMoments.map((codeMom, idx) => {
            const llmMom = parsed.top3Moments?.[idx] || parsed.top3Moments?.find((m: any) => m.over === codeMom.over);
            return {
              ...codeMom, // code is ground truth for over, label, player, winProbBefore, winProbAfter, swingDelta
              description: (typeof llmMom?.description === "string" && llmMom.description.trim().length > 5)
                ? llmMom.description.trim()
                : codeMom.description,
              impact: (typeof llmMom?.impact === "string" && llmMom.impact.trim().length > 5)
                ? llmMom.impact.trim()
                : codeMom.impact,
            };
          });

          // Validate that all overs and players exist in the selected ball data
          const validation = validateRecapAgainstBallData(finalMoments, missedBalls);
          if (validation.isValid) {
            recapPayload = {
              oneLiner: parsed.oneLiner,
              story: parsed.story,
              top3Moments: finalMoments,
              mood: parsed.mood || calculatedMood,
              partnershipSummary: parsed.partnershipSummary || `${stats.runs} runs scored for the loss of ${stats.wickets} wickets in this phase.`,
              oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
            };
          } else {
            console.warn("LLM moments failed validation, using code moments:", validation.issues);
          }
        }
      } catch (aiErr: any) {
        console.warn("Groq inference error, falling back to deterministic engine:", aiErr?.message || aiErr);
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    // FDE Resilience Pattern: Deterministic Fallback without leaking future live state
    if (!recapPayload) {
      const endSituation = runsNeededAtPhaseEnd <= 0
        ? `${meta.team2} achieved the target.`
        : `${meta.team2} stood at ${scoreAtPhaseEnd}/${wicketsAtPhaseEnd}, needing ${runsNeededAtPhaseEnd} runs from ${ballsRemainingAtPhaseEnd} deliveries with ${wicketsInHandAtPhaseEnd} wickets in hand.`;

      const phaseStory = `Across Overs ${fromDisplay} to ${toDisplay}, ${meta.team2} scored ${stats.runs} runs for the loss of ${stats.wickets} wicket${stats.wickets === 1 ? "" : "s"}. ${
        stats.wickets > 0 
          ? `${meta.team1} applied pressure through the dismissals of ${dismissedInPhase.join(", ")}.` 
          : `${battersInPhase.slice(0, 2).join(" and ")} maintained tempo with disciplined boundary hitting.`
      } At the conclusion of this phase, ${endSituation}`;

      recapPayload = {
        oneLiner: `${meta.team2} added ${stats.runs} runs and lost ${stats.wickets} wickets in Overs ${fromDisplay}–${toDisplay}, keeping the contest alive!`,
        story: phaseStory,
        top3Moments: computedMoments,
        mood: calculatedMood,
        partnershipSummary: `Phase Stats: ${stats.runs} runs off ${stats.totalBalls} balls (${stats.boundaries} fours, ${stats.sixes} sixes).`,
        oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
      };
    }

    return NextResponse.json({
      success: true,
      data: recapPayload,
      meta: {
        matchId: meta.matchId,
        usedFallback,
        oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
      }
    });

  } catch (err: any) {
    console.error("Recap route critical error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: err?.message || "An unexpected error occurred while generating the match recap.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
