import type { Ball, MatchMeta, TurningPointMoment } from "../types/index.ts";
import { classifyBall } from "./matchUtils.ts";

/**
 * Compresses ball sequences:
 * - Summarizes quiet overs into single-line summaries
 * - Emits detailed bowler-to-batter commentary only for wickets and boundaries
 * Cuts token count by ~65% and reduces Groq TTFT.
 */
export function buildRecapPrompt(
  balls: Ball[],
  meta: MatchMeta,
  fromOverDisplay: number,
  toOverDisplay: number | string,
  computedMoments: TurningPointMoment[]
): string {
  // Group balls by over to compress quiet spells
  const overBuckets: Record<number, Ball[]> = {};
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!overBuckets[b.over]) overBuckets[b.over] = [];
    overBuckets[b.over].push(b);
  }

  const lines: string[] = [];

  for (const overNumStr of Object.keys(overBuckets)) {
    const overNum = Number(overNumStr);
    const overDeliveries = overBuckets[overNum];
    const hasExcitement = overDeliveries.some(b => b.wicket || b.runs >= 4);

    if (!hasExcitement) {
      // Quiet over: aggregate runs and dots
      const overRuns = overDeliveries.reduce((sum, b) => sum + b.runs, 0);
      const bowler = overDeliveries[0].bowler;
      const runsSequence = overDeliveries.map(b => b.runs).join(", ");
      const lastProb = Math.round(overDeliveries[overDeliveries.length - 1].winProbability * 100);
      lines.push(`Over ${overNum + 1} (${bowler}): ${overRuns} runs [${runsSequence}] | WinProb: ${lastProb}%`);
    } else {
      // Eventful over: emit each key ball and concise dots/singles
      for (let i = 0; i < overDeliveries.length; i++) {
        const b = overDeliveries[i];
        const kind = classifyBall(b);
        if (kind === "wicket") {
          lines.push(`O${b.over}.${b.ball}: ${b.bowler} to ${b.batter} | WICKET (${b.wicketType || 'out'} - ${b.dismissedPlayer || b.batter}) | WP: ${Math.round(b.winProbability * 100)}%`);
        } else if (kind === "six") {
          lines.push(`O${b.over}.${b.ball}: ${b.bowler} to ${b.batter} | SIX! | WP: ${Math.round(b.winProbability * 100)}%`);
        } else if (kind === "four") {
          lines.push(`O${b.over}.${b.ball}: ${b.bowler} to ${b.batter} | FOUR! | WP: ${Math.round(b.winProbability * 100)}%`);
        } else {
          lines.push(`O${b.over}.${b.ball}: ${b.runs}r`);
        }
      }
    }
  }

  const compressedBalls = lines.join("\n");

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
