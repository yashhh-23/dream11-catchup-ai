import { NextRequest, NextResponse } from "next/server";
import { getPublicMatchData } from "@/lib/serverMatchData";
import { ApiResponse, MatchMeta, Ball } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;

  // Serves strictly public balls (overs 0 to 14.2) and a signed simulation session token
  const { meta, balls, sessionToken } = getPublicMatchData(matchId);

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
