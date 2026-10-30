import { NextRequest, NextResponse } from "next/server";
import { matchBalls, matchMeta } from "@/lib/matchData";
import { sliceBalls, getTopMomentsFallback, calculateOverStats } from "@/lib/matchUtils";
import { buildRecapPrompt } from "@/lib/promptBuilder";
import { callGroqRecap } from "@/lib/groqClient";
import { ApiResponse, RecapPayload } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromOver, toOver } = body;

    // Validation S1, S6: Type & bounds checks
    if (typeof fromOver !== "number" || typeof toOver !== "number") {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "INVALID_INPUT", message: "fromOver and toOver must be valid numbers.", retryable: false },
      };
      return NextResponse.json(errRes, { status: 400 });
    }

    if (fromOver < 0 || toOver > matchMeta.totalOvers) {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "OUT_OF_BOUNDS", message: `Overs must be within 0 to ${matchMeta.totalOvers}.`, retryable: false },
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

    // Slice match data
    const missedBalls = sliceBalls(matchBalls, fromOver, toOver);
    if (missedBalls.length === 0) {
      const errRes: ApiResponse<null> = {
        success: false,
        error: { code: "NO_DATA", message: "No ball data found for the selected over range.", retryable: false },
      };
      return NextResponse.json(errRes, { status: 404 });
    }

    const fromDisplay = fromOver + 1;
    const toDisplay = toOver;
    const stats = calculateOverStats(missedBalls);

    // Try Groq AI generation first
    let recapPayload: RecapPayload | null = null;
    let usedFallback = false;

    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 5) {
      try {
        const prompt = buildRecapPrompt(missedBalls, matchMeta, fromDisplay, toDisplay);
        const rawResponse = await callGroqRecap(prompt);

        // Sanitize markdown fences if LLM accidentally enclosed in ```json
        const cleaned = rawResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const parsed = JSON.parse(cleaned);

        if (parsed.oneLiner && parsed.story && Array.isArray(parsed.top3Moments) && parsed.mood) {
          recapPayload = {
            oneLiner: parsed.oneLiner,
            story: parsed.story,
            top3Moments: parsed.top3Moments.map((m: any) => ({
              over: m.over || "–",
              label: m.label || "CRITICAL MOMENT",
              player: m.player || "Player",
              description: m.description || "",
              impact: m.impact || "",
              winProbBefore: m.winProbBefore ?? 0.5,
              winProbAfter: m.winProbAfter ?? 0.5,
              swingDelta: m.swingDelta ?? Math.abs((m.winProbAfter ?? 0.5) - (m.winProbBefore ?? 0.5)),
            })),
            mood: parsed.mood,
            partnershipSummary: parsed.partnershipSummary || `${stats.runs} runs scored for the loss of ${stats.wickets} wickets in this phase.`,
            oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
          };
        }
      } catch (aiErr: any) {
        console.warn("Groq inference error, falling back to deterministic engine:", aiErr?.message || aiErr);
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    // FDE Resilience Pattern: If Groq key not provided or API rate-limited,
    // seamlessly provide high-quality deterministic sports summary
    if (!recapPayload) {
      const topMoments = getTopMomentsFallback(missedBalls, 3);
      
      let mood: RecapPayload["mood"] = "Knife's edge";
      if (stats.wickets >= 3) {
        mood = "Knife's edge";
      } else if (stats.runs > 40 && stats.wickets <= 1) {
        mood = "Cruising";
      } else if (stats.runRate < "7.0") {
        mood = "Chasing hard";
      }

      recapPayload = {
        oneLiner: `India scored ${stats.runs} runs and lost ${stats.wickets} wickets in Overs ${fromDisplay}–${toDisplay}, keeping the chase on a knife's edge!`,
        story: `Across Overs ${fromDisplay} to ${toDisplay}, the game underwent rapid momentum shifts. ${
          stats.wickets > 0 
            ? `New Zealand struck key blows taking ${stats.wickets} wickets to throttle the run flow.` 
            : `India's batters controlled the tempo with steady boundary hitting.`
        } Tilak Varma and the middle order fought back with intent, keeping the required rate within reach. India now need 54 runs from the remaining 34 deliveries with 7 wickets in hand.`,
        top3Moments: topMoments,
        mood,
        partnershipSummary: `Phase Stats: ${stats.runs} runs off ${stats.totalBalls} balls (${stats.boundaries} fours, ${stats.sixes} sixes).`,
        oversCovered: `Overs ${fromDisplay} – ${toDisplay}`,
      };
    }

    return NextResponse.json({
      success: true,
      data: recapPayload,
      meta: {
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
