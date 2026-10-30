import type { Ball, MatchMeta, TurningPointMoment } from "../types/index.ts";

export function buildRecapPrompt(
  balls: Ball[],
  meta: MatchMeta,
  fromOverDisplay: number,
  toOverDisplay: number | string,
  computedMoments: TurningPointMoment[]
): string {
  // Compress ball data to save tokens and ensure fast <800ms inference
  const compressedBalls = balls.map(b => 
    `O${b.over}.${b.ball}|${b.batter} vs ${b.bowler}|${b.wicket ? `WICKET(${b.wicketType || 'out'}-${b.dismissedPlayer || b.batter})` : `${b.runs}r`}|Score:${b.cumulativeScore}/${b.cumulativeWickets}|WP:${Math.round(b.winProbability * 100)}%`
  ).join("\n");

  const startScore = balls[0].cumulativeScore;
  const startWickets = balls[0].cumulativeWickets;
  const endScore = balls[balls.length - 1].cumulativeScore;
  const endWickets = balls[balls.length - 1].cumulativeWickets;

  const momentsContext = computedMoments.map((m, idx) => 
    `Moment ${idx + 1}: Over ${m.over} | ${m.label} | ${m.player} | Win prob: ${Math.round(m.winProbBefore * 100)}% -> ${Math.round(m.winProbAfter * 100)}% (Swing: ${Math.round(m.swingDelta * 100)}%)`
  ).join("\n");

  return `You are Rhea AI, Dream11's cricket-obsessed companion texting a fan who just joined the match late.
The fan missed Overs ${fromOverDisplay} to ${toOverDisplay}.
Match: ${meta.team2} chasing (Target: ${meta.target}) against ${meta.team1} (${meta.format} at ${meta.venue}).
In this missed window, score went from ${startScore}/${startWickets} to ${endScore}/${endWickets}.

Ball-by-ball sequence in missed window (DO NOT describe or reveal any balls after over ${toOverDisplay}):
${compressedBalls}

PRE-COMPUTED TURNING POINTS (GROUND TRUTH):
${momentsContext}

Your task is to write ONLY the prose text for these pre-computed events. Do not invent other overs or players.
Return ONLY a valid JSON object in this exact schema (no markdown, no backticks, no preamble):
{
  "oneLiner": "One punchy, vivid sentence capturing the missed drama like an excited cricket buddy texting you.",
  "story": "3 to 4 sentences narrative. Describe how the phase started, the pivotal turning point, the counter-punch, and how things stand at the end of this phase (up to over ${toOverDisplay}). DO NOT reveal any events after over ${toOverDisplay}.",
  "top3Moments": [
    {
      "description": "Vivid commentary describing this exact delivery and shot.",
      "impact": "Tactical impact on the chase and required run rate."
    }
  ],
  "mood": "Knife's edge",
  "partnershipSummary": "One crisp sentence summarizing the key batting stand in this phase."
}

CRITICAL RULES:
1. "mood" must be exactly one of: "Cruising", "Knife's edge", "Chasing hard", "Game over", "Comeback on".
2. In "top3Moments", provide descriptions for exactly the 3 pre-computed moments in the same order.
3. Every player mentioned in the prose MUST be someone who batted or bowled in the ball-by-ball sequence above.
4. Total words across all fields must be under 200 words. Keep it punchy, conversational, and authentic!`;
}
