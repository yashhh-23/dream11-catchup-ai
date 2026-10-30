import { NextRequest, NextResponse } from "next/server";
import { getMatchById } from "@/lib/matchData";
import { ApiResponse, MatchMeta, Ball } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;

  // Serve strictly public balls (up to liveBallIndex) to ensure true zero spoilers
  const { meta, balls } = getMatchById(matchId, true);

  const response: ApiResponse<{ meta: MatchMeta; balls: Ball[] }> = {
    success: true,
    data: {
      meta,
      balls,
    },
  };

  return NextResponse.json(response);
}
