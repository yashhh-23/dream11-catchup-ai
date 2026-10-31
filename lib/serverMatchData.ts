if (typeof window !== "undefined") {
  throw new Error("SECURITY VIOLATION: serverMatchData must only be imported on the server.");
}
import type { Ball, MatchMeta } from "../types/index.ts";
import { createSimulatorToken, verifySimulatorToken, calculateAllowedIndex } from "./sessionUtils.ts";

export const serverMatchMeta: MatchMeta = {
  matchId: "ind-nz-2026-t20-04",
  title: "India vs New Zealand, 4th T20I",
  team1: "New Zealand",
  team2: "India",
  venue: "Eden Park, Auckland",
  format: "T20",
  totalOvers: 20,
  target: 178,
  liveBallIndex: 85,
  currentLiveOver: 14.2,
  innings: 2,
};

type RawBall = Omit<Ball, "cumulativeScore" | "cumulativeWickets">;

// 112 realistic match balls kept strictly on the server:
// Client bundles NEVER import or bundle these deliveries.
const rawMatchBalls: RawBall[] = [
  // --- OVER 1 (Over index 0) - Boult to Rohit & Gill ---
  { over: 0, ball: 1, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 0, wicket: false, commentary: "Good length angling in, defended gently towards mid-on.", winProbability: 0.52 },
  { over: 0, ball: 2, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Pitched up outside off, Rohit leans in and creams it through extra cover.", winProbability: 0.56 },
  { over: 0, ball: 3, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Tucked away off the hips to deep square leg for a single.", winProbability: 0.56 },
  { over: 0, ball: 4, batter: "Shubman Gill", bowler: "Trent Boult", runs: 0, wicket: false, commentary: "Beaten! Seams away past the outside edge as Gill pushes forward.", winProbability: 0.54 },
  { over: 0, ball: 5, batter: "Shubman Gill", bowler: "Trent Boult", runs: 2, wicket: false, commentary: "Punched off the backfoot through backward point for a couple.", winProbability: 0.55 },
  { over: 0, ball: 6, batter: "Shubman Gill", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Pushed to mid-off, quick single taken to retain strike.", winProbability: 0.55 },

  // --- OVER 2 (Over index 1) - Henry to Gill & Rohit ---
  { over: 1, ball: 1, batter: "Shubman Gill", bowler: "Matt Henry", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Short and wide, Gill cuts hard over point. Crisp timing!", winProbability: 0.59 },
  { over: 1, ball: 2, batter: "Shubman Gill", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Worked to mid-wicket for an easy single.", winProbability: 0.59 },
  { over: 1, ball: 3, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 6, isSix: true, wicket: false, commentary: "SIX! The trademark pull shot! Sits up nicely and Rohit deposits it into the stands.", winProbability: 0.65 },
  { over: 1, ball: 4, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 0, wicket: false, commentary: "Good length on off, solidly defended back to the bowler.", winProbability: 0.64 },
  { over: 1, ball: 5, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Steered past slip to third man for one.", winProbability: 0.64 },
  { over: 1, ball: 6, batter: "Shubman Gill", bowler: "Matt Henry", runs: 0, wicket: false, commentary: "Dot ball to finish. India 20/0 after 2.", winProbability: 0.63 },

  // --- OVER 3 (Over index 2) - Boult ---
  { over: 2, ball: 1, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Single taken down to third man.", winProbability: 0.63 },
  { over: 2, ball: 2, batter: "Shubman Gill", bowler: "Trent Boult", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Gorgeous on-drive straight down the ground, leaves mid-on with no chance.", winProbability: 0.67 },
  { over: 2, ball: 3, batter: "Shubman Gill", bowler: "Trent Boult", runs: 0, wicket: false, commentary: "Left alone outside off stump.", winProbability: 0.66 },
  { over: 2, ball: 4, batter: "Shubman Gill", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Tap and run towards short cover.", winProbability: 0.66 },
  { over: 2, ball: 5, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Clears his front leg and lofts it over mid-off for another boundary.", winProbability: 0.70 },
  { over: 2, ball: 6, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Single to keep strike. 31/0 after 3 overs.", winProbability: 0.70 },

  // --- OVER 4 (Over index 3) - Ferguson ---
  { over: 3, ball: 1, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "148 kph thunderbolt! Rohit drops hands and works to third man.", winProbability: 0.69 },
  { over: 3, ball: 2, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 6, isSix: true, wicket: false, commentary: "SIX! Used the extreme pace! Ramp shot flies over third man boundary.", winProbability: 0.74 },
  { over: 3, ball: 3, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 0, wicket: false, commentary: "Short ball at the helmet, Gill ducks cleanly.", winProbability: 0.73 },
  { over: 3, ball: 4, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single to deep point.", winProbability: 0.73 },
  { over: 3, ball: 5, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Edged but flies safely between keeper and first slip!", winProbability: 0.76 },
  { over: 3, ball: 6, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single taken. India cruising at 44/0.", winProbability: 0.76 },

  // --- OVER 5 (Over index 4) - Henry strikes! ---
  { over: 4, ball: 1, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Worked away to mid-wicket.", winProbability: 0.75 },
  { over: 4, ball: 2, batter: "Shubman Gill", bowler: "Matt Henry", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Reaches 50-partnership in style with a straight boundary.", winProbability: 0.78 },
  { over: 4, ball: 3, batter: "Shubman Gill", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Single to cover.", winProbability: 0.78 },
  { over: 4, ball: 4, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 0, wicket: false, commentary: "Solidly blocked.", winProbability: 0.77 },
  { over: 4, ball: 5, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Single down to long-on.", winProbability: 0.77 },
  { over: 4, ball: 6, batter: "Shubman Gill", bowler: "Matt Henry", runs: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Shubman Gill", commentary: "WICKET! Massive breakthrough! Gill tries to loft over mid-on, mistimes completely, Santner runs back and takes a stunner!", winProbability: 0.65 },

  // --- OVER 6 (Over index 5) - Santner into the attack ---
  { over: 5, ball: 1, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Flighted on middle, defended cautiously.", winProbability: 0.64 },
  { over: 5, ball: 2, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Tapped towards backward point for a single, off the mark.", winProbability: 0.64 },
  { over: 5, ball: 3, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Tossed up wide, Rohit plays to extra cover.", winProbability: 0.63 },
  { over: 5, ball: 4, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Pushed down to long-off for one.", winProbability: 0.63 },
  { over: 5, ball: 5, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 2, wicket: false, commentary: "Sweep shot behind square, nicely fielded by deep fine leg.", winProbability: 0.65 },
  { over: 5, ball: 6, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Dot to end the over. End of Powerplay: India 55/1.", winProbability: 0.64 },

  // --- OVER 7 (Over index 6) - Sodhi spins ---
  { over: 6, ball: 1, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Leg break, nudged to mid-wicket.", winProbability: 0.64 },
  { over: 6, ball: 2, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Driven down to long-off.", winProbability: 0.64 },
  { over: 6, ball: 3, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 0, wicket: false, commentary: "Googly, defended back to Sodhi.", winProbability: 0.63 },
  { over: 6, ball: 4, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to deep cover.", winProbability: 0.63 },
  { over: 6, ball: 5, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Flatter delivery, punched to sweeper cover.", winProbability: 0.63 },
  { over: 6, ball: 6, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Retains strike with a tap towards mid-on. 60/1 after 7.", winProbability: 0.64 },

  // --- OVER 8 (Over index 7) - Santner tightens screws ---
  { over: 7, ball: 1, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Quick single to short extra cover.", winProbability: 0.64 },
  { over: 7, ball: 2, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Worked towards mid-wicket.", winProbability: 0.64 },
  { over: 7, ball: 3, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Dot ball, good length.", winProbability: 0.62 },
  { over: 7, ball: 4, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Pushed to long-on.", winProbability: 0.62 },
  { over: 7, ball: 5, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 2, wicket: false, commentary: "Cut away past point, sweeper cleans up.", winProbability: 0.64 },
  { over: 7, ball: 6, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Sharp turn! Beaten on the defense. 65/1 after 8.", winProbability: 0.63 },

  // --- OVER 9 (Over index 8) - Sodhi ---
  { over: 8, ball: 1, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to cover.", winProbability: 0.63 },
  { over: 8, ball: 2, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Inside-out loft over extra cover! Pure SKY magic!", winProbability: 0.69 },
  { over: 8, ball: 3, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single down to long-off.", winProbability: 0.69 },
  { over: 8, ball: 4, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 0, wicket: false, commentary: "Defended cautiously.", winProbability: 0.68 },
  { over: 8, ball: 5, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to backward point.", winProbability: 0.68 },
  { over: 8, ball: 6, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to mid-wicket. 73/1 after 9.", winProbability: 0.69 },

  // --- OVER 10 (Over index 9) - TURNING POINT OVER: Sodhi double strike ---
  { over: 9, ball: 1, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single taken to long-on.", winProbability: 0.69 },
  { over: 9, ball: 2, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 0, wicket: true, wicketType: "bowled", dismissedPlayer: "Rohit Sharma", commentary: "WICKET! BOWLED HIM! Sodhi bowls a peach of a leg-break that pitches on leg and clips top of off stump! Rohit departs for 41!", winProbability: 0.52 },
  { over: 9, ball: 3, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 0, wicket: false, commentary: "Tilak Varma survives a huge lbw shout first ball.", winProbability: 0.49 },
  { over: 9, ball: 4, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Off the mark with a clip to deep square leg.", winProbability: 0.50 },
  { over: 9, ball: 5, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Suryakumar Yadav", commentary: "WICKET! TWO IN THE OVER! SKY tries to sweep against the turn, top-edges it straight to backward square leg! Sodhi on fire!", winProbability: 0.35 },
  { over: 9, ball: 6, batter: "Hardik Pandya", bowler: "Ish Sodhi", runs: 0, wicket: false, commentary: "Hardik defends off the back foot. Double-wicket maiden-ish! 75/3 after 10.", winProbability: 0.34 },

  // --- OVER 11 (Over index 10) - Santner chokes ---
  { over: 10, ball: 1, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Single to long-off.", winProbability: 0.34 },
  { over: 10, ball: 2, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Dot ball, Hardik watchful.", winProbability: 0.32 },
  { over: 10, ball: 3, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Nudged to mid-wicket.", winProbability: 0.33 },
  { over: 10, ball: 4, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Pushed to cover.", winProbability: 0.33 },
  { over: 10, ball: 5, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 0, wicket: false, commentary: "Santner keeping it flat and fast.", winProbability: 0.31 },
  { over: 10, ball: 6, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Single to end a tight over. India 79/3 after 11. Pressure mounting.", winProbability: 0.32 },

  // --- OVER 12 (Over index 11) - Ferguson pace back ---
  { over: 11, ball: 1, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Ferguson back with 145 kph pace. Hardik steers to third man.", winProbability: 0.33 },
  { over: 11, ball: 2, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 0, wicket: false, commentary: "Beaten by sheer pace on the cut!", winProbability: 0.30 },
  { over: 11, ball: 3, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 2, wicket: false, commentary: "Upper cut over backward point, lands safe for two.", winProbability: 0.33 },
  { over: 11, ball: 4, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 3, wicket: false, commentary: "Superb running between the wickets, pushed into the gap for three.", winProbability: 0.32 },
  { over: 11, ball: 5, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single to cover point.", winProbability: 0.31 },
  { over: 11, ball: 6, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 2, wicket: false, commentary: "Hardik pulls through square leg for a couple. 85/3 after 12.", winProbability: 0.34 },

  // --- OVER 13 (Over index 12) - COUNTER-ATTACK: Sodhi taken down ---
  { over: 12, ball: 1, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 0, wicket: false, commentary: "Beaten by the slider.", winProbability: 0.33 },
  { over: 12, ball: 2, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 6, isSix: true, wicket: false, commentary: "SIX! WHAT A SHOT! Tilak reads the googly, sits on one knee and launches it 88 meters over wide long-on!", winProbability: 0.44 },
  { over: 12, ball: 3, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Slashed backward of point! Two balls, 10 runs! Momentum shifting!", winProbability: 0.53 },
  { over: 12, ball: 4, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to deep cover.", winProbability: 0.54 },
  { over: 12, ball: 5, batter: "Hardik Pandya", bowler: "Ish Sodhi", runs: 6, isSix: true, wicket: false, commentary: "SIX! HARDIK GETS IN ON THE ACT! Muscled straight over the sight screen! 17 runs off the over!", winProbability: 0.66 },
  { over: 12, ball: 6, batter: "Hardik Pandya", bowler: "Ish Sodhi", runs: 1, wicket: false, commentary: "Single to keep strike. 102/3 after 13 overs. Huge swing!", winProbability: 0.67 },

  // --- OVER 14 (Over index 13) - Boult returns ---
  { over: 13, ball: 1, batter: "Hardik Pandya", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Boult returns with a pinpoint yorker, dug out to cover.", winProbability: 0.66 },
  { over: 13, ball: 2, batter: "Tilak Varma", bowler: "Trent Boult", runs: 2, wicket: false, commentary: "Flicked into the vacant mid-wicket pocket, energetic running yields two.", winProbability: 0.68 },
  { over: 13, ball: 3, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Tapped down to third man for a single.", winProbability: 0.68 },
  { over: 13, ball: 4, batter: "Hardik Pandya", bowler: "Trent Boult", runs: 6, isSix: true, wicket: false, commentary: "SIX! PICKED UP OFF HIS PADS! Hardik whips it effortlessly into the deep square leg crowd!", winProbability: 0.77 },
  { over: 13, ball: 5, batter: "Hardik Pandya", bowler: "Trent Boult", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Follows the six with a blistering drive past mid-off! Boult under pressure!", winProbability: 0.81 },
  { over: 13, ball: 6, batter: "Hardik Pandya", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Single down to long-on. India 117/3 after 14 overs! 15 runs off Boult!", winProbability: 0.81 },

  // --- OVER 15 (Over index 14) - CURRENT LIVE OVER (14.2 is live cutoff) ---
  { over: 14, ball: 1, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 2, wicket: false, commentary: "Quick two taken between deep mid-wicket and long-on.", winProbability: 0.82 },
  { over: 14, ball: 2, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Pushed to cover, single taken.", winProbability: 0.82 },

  // --- SIMULATED UPCOMING BALLS (Overs 14.3 to 20 for Live Ticker) ---
  // Stored ONLY on server to guarantee true zero-spoiler protection for client bundles!
  { over: 14, ball: 3, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Tilak moves across his stumps and scoops Ferguson over fine leg!", winProbability: 0.86 },
  { over: 14, ball: 4, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Steered past gully for one.", winProbability: 0.86 },
  { over: 14, ball: 5, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 0, wicket: false, commentary: "151 kph rocket! Hardik defends off the backfoot.", winProbability: 0.84 },
  { over: 14, ball: 6, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single to long-off. India 125/3 after 15 overs. Needing 53 off 30.", winProbability: 0.85 },

  // Over 16
  { over: 15, ball: 1, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Single to long-on.", winProbability: 0.85 },
  { over: 15, ball: 2, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Worked towards deep square leg.", winProbability: 0.85 },
  { over: 15, ball: 3, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Hardik Pandya", commentary: "WICKET! Santner gets Hardik! Slices it straight into the hands of backward point! NZ alive!", winProbability: 0.72 },
  { over: 15, ball: 4, batter: "Rinku Singh", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "Rinku off the mark with a clip to deep mid-wicket.", winProbability: 0.73 },
  { over: 15, ball: 5, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 2, wicket: false, commentary: "Tilak completes a courageous 50 with a fine-leg sweep!", winProbability: 0.76 },
  { over: 15, ball: 6, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, wicket: false, commentary: "131/4 after 16. Needing 47 from 24.", winProbability: 0.76 },

  // Over 17
  { over: 16, ball: 1, batter: "Tilak Varma", bowler: "Trent Boult", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Tilak lofts Boult over extra cover with precision!", winProbability: 0.83 },
  { over: 16, ball: 2, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Single to mid-on.", winProbability: 0.83 },
  { over: 16, ball: 3, batter: "Rinku Singh", bowler: "Trent Boult", runs: 6, isSix: true, wicket: false, commentary: "SIX! RINKU SPECIAL! Smacks a low full toss over deep square leg!", winProbability: 0.92 },
  { over: 16, ball: 4, batter: "Rinku Singh", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "Single to third man.", winProbability: 0.92 },
  { over: 16, ball: 5, batter: "Tilak Varma", bowler: "Trent Boult", runs: 2, wicket: false, commentary: "Two more added to the tally.", winProbability: 0.94 },
  { over: 16, ball: 6, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, wicket: false, commentary: "146/4 after 17 overs. Only 32 needed from 18 balls.", winProbability: 0.94 },

  // Over 18
  { over: 17, ball: 1, batter: "Tilak Varma", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Single to cover.", winProbability: 0.94 },
  { over: 17, ball: 2, batter: "Rinku Singh", bowler: "Matt Henry", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Rinku carves it through point! The chase is well in control now.", winProbability: 0.97 },
  { over: 17, ball: 3, batter: "Rinku Singh", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Single taken.", winProbability: 0.97 },
  { over: 17, ball: 4, batter: "Tilak Varma", bowler: "Matt Henry", runs: 6, isSix: true, wicket: false, commentary: "SIX! Tilak moves into the 60s with a monster strike into the second tier!", winProbability: 0.99 },
  { over: 17, ball: 5, batter: "Tilak Varma", bowler: "Matt Henry", runs: 1, wicket: false, commentary: "Single to long-off.", winProbability: 0.99 },
  { over: 17, ball: 6, batter: "Rinku Singh", bowler: "Matt Henry", runs: 2, wicket: false, commentary: "160/4 after 18. Only 18 runs needed from 12 balls.", winProbability: 0.99 },

  // Over 19
  { over: 18, ball: 1, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Glanced past keeper down to fine leg boundary!", winProbability: 0.99 },
  { over: 18, ball: 2, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single to cover.", winProbability: 0.99 },
  { over: 18, ball: 3, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 1, wicket: false, commentary: "Single to third man.", winProbability: 0.99 },
  { over: 18, ball: 4, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 6, isSix: true, wicket: false, commentary: "SIX! RINKU FINISHES IT IN STYLE! A towering blow over long-on to seal the match for India!", winProbability: 1.0 },
];

function buildCumulativeBalls(raws: RawBall[]): Ball[] {
  let score = 0;
  let wickets = 0;
  return raws.map((raw) => {
    score += raw.runs;
    if (raw.wicket) wickets++;
    return {
      ...raw,
      cumulativeScore: score,
      cumulativeWickets: wickets,
    };
  });
}

export const serverOverStartIndex: number[] = [];
let runningScore = 0;
let runningWickets = 0;

export const serverMatchBalls: Ball[] = rawMatchBalls.map((raw, idx) => {
  runningScore += raw.runs;
  if (raw.wicket) runningWickets++;

  if (serverOverStartIndex[raw.over] === undefined) {
    serverOverStartIndex[raw.over] = idx;
  }

  return {
    ...raw,
    cumulativeScore: runningScore,
    cumulativeWickets: runningWickets,
  };
});

// Dedicated deliveries for IND vs AUS (Target: 192 at MCG) - fixes Bug 18
const rawIndAusBalls: RawBall[] = [
  { over: 0, ball: 1, batter: "Rohit Sharma", bowler: "Mitchell Starc", runs: 0, wicket: false, commentary: "Starc steams in from over the wicket, swinging away past Rohit's forward defense.", winProbability: 0.48 },
  { over: 0, ball: 2, batter: "Rohit Sharma", bowler: "Mitchell Starc", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Leans into a full delivery and punches it beautifully through cover point.", winProbability: 0.52 },
  { over: 0, ball: 3, batter: "Rohit Sharma", bowler: "Mitchell Starc", runs: 1, wicket: false, commentary: "Tucked behind square on the leg side for one.", winProbability: 0.52 },
  { over: 0, ball: 4, batter: "Shubman Gill", bowler: "Mitchell Starc", runs: 0, wicket: false, commentary: "Beaten by sheer pace! 146 kph zips past the outside edge.", winProbability: 0.50 },
  { over: 0, ball: 5, batter: "Shubman Gill", bowler: "Mitchell Starc", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Exquisite timing! Gill leans back and carves Starc over backward point.", winProbability: 0.55 },
  { over: 0, ball: 6, batter: "Shubman Gill", bowler: "Mitchell Starc", runs: 1, wicket: false, commentary: "Single to third man. India 10/0 after 1 over.", winProbability: 0.55 },

  { over: 1, ball: 1, batter: "Shubman Gill", bowler: "Pat Cummins", runs: 0, wicket: false, commentary: "Cummins hits the deck hard, defended cautiously towards mid-wicket.", winProbability: 0.54 },
  { over: 1, ball: 2, batter: "Shubman Gill", bowler: "Pat Cummins", runs: 6, isSix: true, wicket: false, commentary: "SIX! Picked up effortlessly! High over wide long-on into the MCG crowd.", winProbability: 0.61 },
  { over: 1, ball: 3, batter: "Shubman Gill", bowler: "Pat Cummins", runs: 1, wicket: false, commentary: "Pushed to cover for a rapid single.", winProbability: 0.61 },
  { over: 1, ball: 4, batter: "Rohit Sharma", bowler: "Pat Cummins", runs: 0, wicket: false, commentary: "Full and straight, dug out back to the bowler.", winProbability: 0.60 },
  { over: 1, ball: 5, batter: "Rohit Sharma", bowler: "Pat Cummins", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! The pull shot arrives! Sits up and Rohit hammers it behind square leg.", winProbability: 0.64 },
  { over: 1, ball: 6, batter: "Rohit Sharma", bowler: "Pat Cummins", runs: 1, wicket: false, commentary: "Single into the off side. 22/0 after 2 overs.", winProbability: 0.64 },

  { over: 2, ball: 1, batter: "Rohit Sharma", bowler: "Josh Hazlewood", runs: 1, wicket: false, commentary: "Hazlewood probing top of off, worked to mid-on.", winProbability: 0.64 },
  { over: 2, ball: 2, batter: "Shubman Gill", bowler: "Josh Hazlewood", runs: 0, wicket: false, commentary: "Defended off the back foot.", winProbability: 0.63 },
  { over: 2, ball: 3, batter: "Shubman Gill", bowler: "Josh Hazlewood", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Glorious straight drive past the bowler.", winProbability: 0.67 },
  { over: 2, ball: 4, batter: "Shubman Gill", bowler: "Josh Hazlewood", runs: 0, wicket: false, commentary: "Swinging in, strikes the pad outside off.", winProbability: 0.66 },
  { over: 2, ball: 5, batter: "Shubman Gill", bowler: "Josh Hazlewood", runs: 1, wicket: false, commentary: "Nudged to third man for one.", winProbability: 0.66 },
  { over: 2, ball: 6, batter: "Rohit Sharma", bowler: "Josh Hazlewood", runs: 6, isSix: true, wicket: false, commentary: "SIX! Stepped out and launched Hazlewood over long-off! Huge hit!", winProbability: 0.72 },

  // Middle Overs - Zampa strikes
  { over: 9, ball: 1, batter: "Rohit Sharma", bowler: "Adam Zampa", runs: 1, wicket: false, commentary: "Zampa tosses it up, pushed down to long-off for one.", winProbability: 0.68 },
  { over: 9, ball: 2, batter: "Suryakumar Yadav", bowler: "Adam Zampa", runs: 0, wicket: true, wicketType: "bowled", dismissedPlayer: "Suryakumar Yadav", commentary: "OUT! Bowled him! Zampa's slider skids under Surya's sweep! Massive blow for India!", winProbability: 0.54 },
  { over: 9, ball: 3, batter: "Tilak Varma", bowler: "Adam Zampa", runs: 0, wicket: false, commentary: "Tilak defends cautiously into the off side.", winProbability: 0.52 },
  { over: 9, ball: 4, batter: "Tilak Varma", bowler: "Adam Zampa", runs: 1, wicket: false, commentary: "Single to point to get off the mark.", winProbability: 0.52 },
  { over: 9, ball: 5, batter: "Rohit Sharma", bowler: "Adam Zampa", runs: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Rohit Sharma", commentary: "OUT! Caught at deep mid-wicket! Rohit goes for the slog sweep and holes out to Maxwell! Zampa gets 2 in 4 balls!", winProbability: 0.38 },
  { over: 9, ball: 6, batter: "Hardik Pandya", bowler: "Adam Zampa", runs: 1, wicket: false, commentary: "Pushed to cover. India 88/3 after 10 overs.", winProbability: 0.39 },

  // Counter punch overs 11-15 (Target 192)
  { over: 14, ball: 1, batter: "Hardik Pandya", bowler: "Mitchell Starc", runs: 6, isSix: true, wicket: false, commentary: "SIX! Hardik clears his front leg and sends Starc 94 meters over mid-wicket!", winProbability: 0.68 },
  { over: 14, ball: 2, batter: "Hardik Pandya", bowler: "Mitchell Starc", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Slashed through extra cover! India 144/3 chasing 192 (Need 48 off 28b).", winProbability: 0.74 },
  { over: 14, ball: 3, batter: "Hardik Pandya", bowler: "Mitchell Starc", runs: 1, wicket: false, commentary: "Single to deep point.", winProbability: 0.74 },
  { over: 14, ball: 4, batter: "Tilak Varma", bowler: "Mitchell Starc", runs: 2, wicket: false, commentary: "Punched into the deep for a brace.", winProbability: 0.75 },
  { over: 14, ball: 5, batter: "Tilak Varma", bowler: "Mitchell Starc", runs: 4, isBoundaryFour: true, wicket: false, commentary: "FOUR! Upper-cut over the keeper!", winProbability: 0.80 },
  { over: 14, ball: 6, batter: "Tilak Varma", bowler: "Mitchell Starc", runs: 1, wicket: false, commentary: "Single to retain strike.", winProbability: 0.80 },

  // Over 15 (Over 15.1 Live point)
  { over: 15, ball: 1, batter: "Tilak Varma", bowler: "Pat Cummins", runs: 1, wicket: false, commentary: "Guided down to third man for a quick single. (CURRENT LIVE BALL)", winProbability: 0.81 },
];

export const serverIndAusBalls: Ball[] = buildCumulativeBalls(rawIndAusBalls);

export const serverMatchesRegistry: Record<string, { meta: MatchMeta; balls: Ball[] }> = {
  [serverMatchMeta.matchId]: {
    meta: serverMatchMeta,
    balls: serverMatchBalls,
  },
  "ind-aus-2026-t20-final": {
    meta: {
      matchId: "ind-aus-2026-t20-final",
      title: "India vs Australia, T20 World Final",
      team1: "Australia",
      team2: "India",
      venue: "Melbourne Cricket Ground",
      format: "T20",
      totalOvers: 20,
      target: 192,
      liveBallIndex: 30,
      currentLiveOver: 15.1,
      innings: 2,
    },
    balls: serverIndAusBalls,
  },
};

export function getServerMatchById(matchId?: string, publicOnly = false): { meta: MatchMeta; balls: Ball[] } | null {
  // If specific matchId is passed and unknown, return null for 404 (fixes Bug 8)
  if (matchId && !serverMatchesRegistry[matchId]) {
    return null;
  }
  const match = (matchId && serverMatchesRegistry[matchId]) || serverMatchesRegistry[serverMatchMeta.matchId];
  if (publicOnly) {
    return {
      meta: match.meta,
      balls: match.balls.slice(0, (match.meta.liveBallIndex ?? 85) + 1),
    };
  }
  return match;
}

/**
 * Returns safe public balls and creates a signed simulation token.
 * This is the ONLY data entry point for client consumers.
 */
export function getPublicMatchData(matchId?: string): {
  meta: MatchMeta;
  balls: Ball[];
  sessionToken: string;
} | null {
  const match = getServerMatchById(matchId, true);
  if (!match) return null;
  const { meta, balls } = match;
  const sessionToken = createSimulatorToken(meta.matchId, meta.liveBallIndex ?? 85);

  return {
    meta,
    balls,
    sessionToken,
  };
}

/**
 * Server-controlled delta resolver:
 * Ensures deliveries are ONLY unlocked as the server's simulated live clock advances.
 * Directly blocks attempts to inspect future balls out of order.
 */
export function getNextSimulatedBall(
  matchId: string | undefined,
  token: string | null,
  requestedIndex: number
): { ball: Ball | null; isMatchFinished: boolean; error?: string; status?: number } {
  // Bug 19 fix: Validate that requestedIndex is a non-negative integer
  if (typeof requestedIndex !== "number" || isNaN(requestedIndex) || !Number.isInteger(requestedIndex) || requestedIndex < 0) {
    return {
      ball: null,
      isMatchFinished: false,
      error: "INVALID_INDEX: index must be a non-negative integer.",
      status: 400,
    };
  }

  if (!token) {
    return {
      ball: null,
      isMatchFinished: false,
      error: "Session token required to advance live feed. Zero-spoiler protection active.",
      status: 401,
    };
  }

  const verification = verifySimulatorToken(token);
  if (!verification.valid || !verification.session) {
    return {
      ball: null,
      isMatchFinished: false,
      error: verification.error || "INVALID_SESSION_TOKEN",
      status: 403,
    };
  }

  const allowedIndex = calculateAllowedIndex(verification.session);
  if (requestedIndex > allowedIndex) {
    return {
      ball: null,
      isMatchFinished: false,
      error: `Delivery has not been bowled yet (unlocked up to ball ${allowedIndex}, requested ${requestedIndex}). Zero-spoiler live protection active.`,
      status: 403,
    };
  }

  const match = getServerMatchById(matchId, false);
  if (!match) {
    return {
      ball: null,
      isMatchFinished: false,
      error: "MATCH_NOT_FOUND: Match does not exist.",
      status: 404,
    };
  }

  const { balls } = match;

  if (requestedIndex >= balls.length) {
    return {
      ball: null,
      isMatchFinished: true,
    };
  }

  const nextBall = balls[requestedIndex];

  return {
    ball: nextBall,
    isMatchFinished: requestedIndex >= balls.length - 1,
  };
}
