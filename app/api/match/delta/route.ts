import { NextRequest, NextResponse } from "next/server";
import { getNextSimulatedBall } from "@/lib/serverMatchData";
import { ApiResponse, Ball } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;
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
    const errRes: ApiResponse<null> = {
      success: false,
      error: { code: "SPOILER_PROTECTED", message: result.error, retryable: false },
    };
    return NextResponse.json(errRes, { status });
  }

  const response: ApiResponse<{ ball: Ball | null; isMatchFinished: boolean }> = {
    success: true,
    data: {
      ball: result.ball,
      isMatchFinished: result.isMatchFinished,
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
