import { NextRequest, NextResponse } from "next/server";
import { getNextSimulatedBall, getServerMatchById } from "@/lib/serverMatchData";
import { createSimulatorToken } from "@/lib/sessionUtils";
import { sanitizeBallsForSpoiler } from "@/lib/matchUtils";
import { ApiResponse, Ball, SpoilerLevel } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;
  const action = searchParams.get("action");

  // Handle explicit live stream session token initialization
  // Anchors delivery unlocking strictly to the moment live streaming starts
  if (action === "live_token" || action === "start_stream") {
    const match = getServerMatchById(matchId, true);
    if (!match) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MATCH_NOT_FOUND", message: "Match not found.", retryable: false },
        },
        { status: 404 }
      );
    }
    const baseIndex = match.meta.liveBallIndex !== undefined ? match.meta.liveBallIndex : match.balls.length - 1;
    const streamToken = createSimulatorToken(match.meta.matchId, baseIndex, Date.now());
    return NextResponse.json(
      {
        success: true,
        data: {
          token: streamToken,
          matchId: match.meta.matchId,
          baseIndex,
          streamStartedAt: Date.now(),
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  const indexStr = searchParams.get("index");
  const token = searchParams.get("token") || req.headers.get("x-simulator-token");

  const parsedNum = Number(indexStr);
  if (!indexStr || isNaN(parsedNum) || !Number.isInteger(parsedNum) || parsedNum < 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_INDEX", message: "index must be a valid non-negative integer.", retryable: false },
      },
      { status: 400 }
    );
  }

  const requestedIndex = parsedNum;

  // Authorize delivery against server live simulation clock
  const result = getNextSimulatedBall(matchId, token, requestedIndex);

  if (result.error) {
    const status = result.status || 403;
    let errorCode = "SPOILER_PROTECTED";
    if (status === 401) {
      errorCode = "UNAUTHORIZED";
    } else if (status === 404) {
      errorCode = "MATCH_NOT_FOUND";
    } else if (status === 400) {
      errorCode = "INVALID_INDEX";
    } else if (result.error.includes("INVALID_SIGNATURE")) {
      errorCode = "INVALID_SIGNATURE";
    } else if (result.error.includes("TOKEN_MATCH_MISMATCH")) {
      errorCode = "TOKEN_MATCH_MISMATCH";
    } else if (result.error.includes("MALFORMED_TOKEN") || result.error.includes("INVALID_TOKEN")) {
      errorCode = "INVALID_TOKEN";
    } else if (result.error.includes("INVALID_SESSION_TOKEN")) {
      errorCode = "INVALID_SESSION_TOKEN";
    } else {
      errorCode = "SPOILER_PROTECTED";
    }

    const errRes: ApiResponse<null> = {
      success: false,
      error: { code: errorCode, message: result.error, retryable: false },
    };
    return NextResponse.json(errRes, { status });
  }

  const rawSpoilerLevel = searchParams.get("spoilerLevel") || req.headers.get("x-spoiler-level");
  const spoilerLevel: SpoilerLevel = rawSpoilerLevel === "story-only" ? "story-only" : "story-and-score";
  const finalBall = result.ball && spoilerLevel === "story-only"
    ? sanitizeBallsForSpoiler([result.ball], "story-only")[0]
    : result.ball;

  const response: ApiResponse<{ ball: Ball | null; isMatchFinished: boolean }> = {
    success: true,
    data: {
      ball: finalBall,
      isMatchFinished: result.isMatchFinished,
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
