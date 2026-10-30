import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/matchData";
import { ApiResponse, Ball } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;
  const indexStr = searchParams.get("index");

  if (!indexStr || isNaN(Number(indexStr))) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_INDEX", message: "index parameter is required." },
      },
      { status: 400 }
    );
  }

  const requestedIndex = Number(indexStr);
  const { balls } = getMatchById(matchId, false);

  if (requestedIndex < 0 || requestedIndex >= balls.length) {
    return NextResponse.json({
      success: true,
      data: {
        isMatchFinished: true,
        ball: null,
      },
    });
  }

  const nextBall = balls[requestedIndex];

  const response: ApiResponse<{ ball: Ball; isMatchFinished: boolean }> = {
    success: true,
    data: {
      ball: nextBall,
      isMatchFinished: requestedIndex >= balls.length - 1,
    },
  };

  return NextResponse.json(response);
}
