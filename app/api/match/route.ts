import { NextRequest, NextResponse } from "next/server";
import { getPublicMatchData } from "@/lib/serverMatchData";
import { sanitizeBallsForSpoiler, sanitizeMetaForSpoiler } from "@/lib/matchUtils";
import { ApiResponse, MatchMeta, Ball, SpoilerLevel } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("matchId") || undefined;
    const rawSpoilerLevel = searchParams.get("spoilerLevel") || req.headers.get("x-spoiler-level");
    const spoilerLevel: SpoilerLevel = rawSpoilerLevel === "story-only" ? "story-only" : "story-and-score";

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

    // Zero-Spoiler Security: If client requested story-only protection, sanitize balls & meta at server level
    // DevTools inspection / curl will never receive unredacted scores, wickets, or boundary markers
    const sanitizedBalls = sanitizeBallsForSpoiler(balls, spoilerLevel);
    const sanitizedMeta = sanitizeMetaForSpoiler(meta, spoilerLevel);

    const response: ApiResponse<{ meta: MatchMeta; balls: Ball[]; sessionToken: string }> = {
      success: true,
      data: {
        meta: sanitizedMeta,
        balls: sanitizedBalls,
        sessionToken,
      },
    };

    return NextResponse.json(response);
  } catch (err: any) {
    const errRes: ApiResponse<null> = {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load match data.", retryable: true },
    };
    return NextResponse.json(errRes, { status: 500 });
  }
}
