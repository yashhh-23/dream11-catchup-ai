import { NextRequest, NextResponse } from "next/server";
import { getPublicMatchData } from "@/lib/serverMatchData";
import { ApiResponse, MatchMeta, Ball } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;

  // Serves strictly public balls (overs 0 to 14.2) and a signed simulation session token
  const matchData = getPublicMatchData(matchId);
  if (!matchData) {
    const errRes: ApiResponse<null> = {
      success: false,
      error: { code: "MATCH_NOT_FOUND", message: `Match "${matchId}" not found.`, retryable: false },
    };
    return NextResponse.json(errRes, { status: 404 });
  }

  const { meta, balls, sessionToken } = matchData;

  const response: ApiResponse<{ meta: MatchMeta; balls: Ball[]; sessionToken: string }> = {
    success: true,
    data: {
      meta,
      balls,
      sessionToken,
    },
  };

  return NextResponse.json(response);
}
