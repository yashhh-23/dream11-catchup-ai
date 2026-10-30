import type { Ball, MatchMeta } from "../types/index.ts";

export const matchMeta: MatchMeta = {
  matchId: "ind-nz-2026-t20-04",
  title: "India vs New Zealand, 4th T20I",
  team1: "New Zealand",
  team2: "India",
  venue: "Eden Park, Auckland",
  matchDate: "October 30, 2026",
  format: "T20",
  totalOvers: 20,
  target: 178,
  currentLiveOver: 14.2, // Over 14, 2 balls into it
  innings: 2,
};

// 20 overs (120+ balls) of realistic ball-by-ball data
export const matchBalls: Ball[] = [
  // --- OVER 1 (Over index 0) - Boult to Rohit & Gill ---
  { over: 0, ball: 1, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Good length angling in, defended gently towards mid-on.", winProbability: 0.52, cumulativeScore: 0, cumulativeWickets: 0 },
  { over: 0, ball: 2, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Pitched up outside off, Rohit leans in and creams it through extra cover.", winProbability: 0.56, cumulativeScore: 4, cumulativeWickets: 0 },
  { over: 0, ball: 3, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Tucked away off the hips to deep square leg for a single.", winProbability: 0.56, cumulativeScore: 5, cumulativeWickets: 0 },
  { over: 0, ball: 4, batter: "Shubman Gill", bowler: "Trent Boult", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Beaten! Seams away past the outside edge as Gill pushes forward.", winProbability: 0.54, cumulativeScore: 5, cumulativeWickets: 0 },
  { over: 0, ball: 5, batter: "Shubman Gill", bowler: "Trent Boult", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Punched off the backfoot through backward point for a couple.", winProbability: 0.55, cumulativeScore: 7, cumulativeWickets: 0 },
  { over: 0, ball: 6, batter: "Shubman Gill", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Pushed to mid-off, quick single taken to retain strike.", winProbability: 0.55, cumulativeScore: 8, cumulativeWickets: 0 },

  // --- OVER 2 (Over index 1) - Henry to Gill & Rohit ---
  { over: 1, ball: 1, batter: "Shubman Gill", bowler: "Matt Henry", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Short and wide, Gill cuts hard over point. Crisp timing!", winProbability: 0.59, cumulativeScore: 12, cumulativeWickets: 0 },
  { over: 1, ball: 2, batter: "Shubman Gill", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Worked to mid-wicket for an easy single.", winProbability: 0.59, cumulativeScore: 13, cumulativeWickets: 0 },
  { over: 1, ball: 3, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! The trademark pull shot! Sits up nicely and Rohit deposits it into the stands.", winProbability: 0.65, cumulativeScore: 19, cumulativeWickets: 0 },
  { over: 1, ball: 4, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Good length on off, solidly defended back to the bowler.", winProbability: 0.64, cumulativeScore: 19, cumulativeWickets: 0 },
  { over: 1, ball: 5, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Steered past slip to third man for one.", winProbability: 0.64, cumulativeScore: 20, cumulativeWickets: 0 },
  { over: 1, ball: 6, batter: "Shubman Gill", bowler: "Matt Henry", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Dot ball to finish. India 20/0 after 2.", winProbability: 0.63, cumulativeScore: 20, cumulativeWickets: 0 },

  // --- OVER 3 (Over index 2) - Boult ---
  { over: 2, ball: 1, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single taken down to third man.", winProbability: 0.63, cumulativeScore: 21, cumulativeWickets: 0 },
  { over: 2, ball: 2, batter: "Shubman Gill", bowler: "Trent Boult", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Gorgeous on-drive straight down the ground, leaves mid-on with no chance.", winProbability: 0.67, cumulativeScore: 25, cumulativeWickets: 0 },
  { over: 2, ball: 3, batter: "Shubman Gill", bowler: "Trent Boult", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Left alone outside off stump.", winProbability: 0.66, cumulativeScore: 25, cumulativeWickets: 0 },
  { over: 2, ball: 4, batter: "Shubman Gill", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Tap and run towards short cover.", winProbability: 0.66, cumulativeScore: 26, cumulativeWickets: 0 },
  { over: 2, ball: 5, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Clears his front leg and lofts it over mid-off for another boundary.", winProbability: 0.70, cumulativeScore: 30, cumulativeWickets: 0 },
  { over: 2, ball: 6, batter: "Rohit Sharma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to keep strike. 31/0 after 3 overs.", winProbability: 0.70, cumulativeScore: 31, cumulativeWickets: 0 },

  // --- OVER 4 (Over index 3) - Ferguson ---
  { over: 3, ball: 1, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "148 kph thunderbolt! Rohit drops hands and works to third man.", winProbability: 0.69, cumulativeScore: 32, cumulativeWickets: 0 },
  { over: 3, ball: 2, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! Used the extreme pace! Ramp shot flies over third man boundary.", winProbability: 0.74, cumulativeScore: 38, cumulativeWickets: 0 },
  { over: 3, ball: 3, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Short ball at the helmet, Gill ducks cleanly.", winProbability: 0.73, cumulativeScore: 38, cumulativeWickets: 0 },
  { over: 3, ball: 4, batter: "Shubman Gill", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to deep point.", winProbability: 0.73, cumulativeScore: 39, cumulativeWickets: 0 },
  { over: 3, ball: 5, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Edged but flies safely between keeper and first slip!", winProbability: 0.76, cumulativeScore: 43, cumulativeWickets: 0 },
  { over: 3, ball: 6, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single taken. India cruising at 44/0.", winProbability: 0.76, cumulativeScore: 44, cumulativeWickets: 0 },

  // --- OVER 5 (Over index 4) - Henry strikes! ---
  { over: 4, ball: 1, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Worked away to mid-wicket.", winProbability: 0.75, cumulativeScore: 45, cumulativeWickets: 0 },
  { over: 4, ball: 2, batter: "Shubman Gill", bowler: "Matt Henry", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Reaches 50-partnership in style with a straight boundary.", winProbability: 0.78, cumulativeScore: 49, cumulativeWickets: 0 },
  { over: 4, ball: 3, batter: "Shubman Gill", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to cover.", winProbability: 0.78, cumulativeScore: 50, cumulativeWickets: 0 },
  { over: 4, ball: 4, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Solidly blocked.", winProbability: 0.77, cumulativeScore: 50, cumulativeWickets: 0 },
  { over: 4, ball: 5, batter: "Rohit Sharma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single down to long-on.", winProbability: 0.77, cumulativeScore: 51, cumulativeWickets: 0 },
  { over: 4, ball: 6, batter: "Shubman Gill", bowler: "Matt Henry", runs: 0, batterRuns: 0, extras: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Shubman Gill", commentary: "WICKET! Massive breakthrough! Gill tries to loft over mid-on, mistimes completely, Santner runs back and takes a stunner!", winProbability: 0.65, cumulativeScore: 51, cumulativeWickets: 1 },

  // --- OVER 6 (Over index 5) - Santner into the attack ---
  { over: 5, ball: 1, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Flighted on middle, defended cautiously.", winProbability: 0.64, cumulativeScore: 51, cumulativeWickets: 1 },
  { over: 5, ball: 2, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Tapped into the covers to get off the mark.", winProbability: 0.64, cumulativeScore: 52, cumulativeWickets: 1 },
  { over: 5, ball: 3, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Pushed to long-off for one.", winProbability: 0.64, cumulativeScore: 53, cumulativeWickets: 1 },
  { over: 5, ball: 4, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Typical Surya! Goes down on one knee and sweeps behind square with authority.", winProbability: 0.69, cumulativeScore: 57, cumulativeWickets: 1 },
  { over: 5, ball: 5, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Beaten on the outside edge as Santner gets it to grip and turn.", winProbability: 0.68, cumulativeScore: 57, cumulativeWickets: 1 },
  { over: 5, ball: 6, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "End of the Powerplay: India 58/1, needing 120 from 14 overs.", winProbability: 0.68, cumulativeScore: 58, cumulativeWickets: 1 },

  // --- OVER 7 (Over index 6) - Sodhi tightens screw ---
  { over: 6, ball: 1, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Googly read well, pushed to long-on.", winProbability: 0.67, cumulativeScore: 59, cumulativeWickets: 1 },
  { over: 6, ball: 2, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Worked to mid-wicket for one.", winProbability: 0.67, cumulativeScore: 60, cumulativeWickets: 1 },
  { over: 6, ball: 3, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Quicker ball flummoxes Surya, beaten on the inside edge.", winProbability: 0.65, cumulativeScore: 60, cumulativeWickets: 1 },
  { over: 6, ball: 4, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to sweeper cover.", winProbability: 0.65, cumulativeScore: 61, cumulativeWickets: 1 },
  { over: 6, ball: 5, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Driven wide of long-off, aggressive running yields two.", winProbability: 0.66, cumulativeScore: 63, cumulativeWickets: 1 },
  { over: 6, ball: 6, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single down the ground. 64/1 after 7.", winProbability: 0.66, cumulativeScore: 64, cumulativeWickets: 1 },

  // --- OVER 8 (Over index 7) - Santner ---
  { over: 7, ball: 1, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single down to long-on.", winProbability: 0.66, cumulativeScore: 65, cumulativeWickets: 1 },
  { over: 7, ball: 2, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Dabbed through backward point for a couple.", winProbability: 0.67, cumulativeScore: 67, cumulativeWickets: 1 },
  { over: 7, ball: 3, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Dot ball. Santner keeping a tight line on off stump.", winProbability: 0.65, cumulativeScore: 67, cumulativeWickets: 1 },
  { over: 7, ball: 4, batter: "Suryakumar Yadav", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Pushed to cover point.", winProbability: 0.65, cumulativeScore: 68, cumulativeWickets: 1 },
  { over: 7, ball: 5, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Rohit dances down the track and lofts it cleanly over Santner's head!", winProbability: 0.72, cumulativeScore: 72, cumulativeWickets: 1 },
  { over: 7, ball: 6, batter: "Rohit Sharma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to long-off. 73/1 after 8 overs.", winProbability: 0.72, cumulativeScore: 73, cumulativeWickets: 1 },

  // --- OVER 9 (Over index 8) - Ferguson returns ---
  { over: 8, ball: 1, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Speared in at the toes, clipped for a single.", winProbability: 0.71, cumulativeScore: 74, cumulativeWickets: 1 },
  { over: 8, ball: 2, batter: "Suryakumar Yadav", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Slower bouncer, pulled towards deep mid-wicket for one.", winProbability: 0.71, cumulativeScore: 75, cumulativeWickets: 1 },
  { over: 8, ball: 3, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Glanced fine of fine leg, well cut off by Boult on the rope.", winProbability: 0.72, cumulativeScore: 77, cumulativeWickets: 1 },
  { over: 8, ball: 4, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "150 kph yorker! Rohit does well to jam it out.", winProbability: 0.71, cumulativeScore: 77, cumulativeWickets: 1 },
  { over: 8, ball: 5, batter: "Rohit Sharma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to backward point.", winProbability: 0.71, cumulativeScore: 78, cumulativeWickets: 1 },
  { over: 8, ball: 6, batter: "Suryakumar Yadav", bowler: "Lockie Ferguson", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Dot ball. End of over 9: India 78/1.", winProbability: 0.70, cumulativeScore: 78, cumulativeWickets: 1 },

  // --- OVER 10 (Over index 9) - THE DISASTER OVER: SODHI STRIKES TWICE! ---
  { over: 9, ball: 1, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Beaten by the drift outside off.", winProbability: 0.69, cumulativeScore: 78, cumulativeWickets: 1 },
  { over: 9, ball: 2, batter: "Rohit Sharma", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: true, wicketType: "bowled", dismissedPlayer: "Rohit Sharma", commentary: "WICKET! CLEAN BOWLED! Rohit goes for an aggressive pull across the line, misses the wrong-un completely and middle stump is knocked back! Huge moment!", winProbability: 0.52, cumulativeScore: 78, cumulativeWickets: 2 },
  { over: 9, ball: 3, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Tilak Varma walks in and gets off the mark with a push to long-on.", winProbability: 0.52, cumulativeScore: 79, cumulativeWickets: 2 },
  { over: 9, ball: 4, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Surya pushes to cover for a single.", winProbability: 0.52, cumulativeScore: 80, cumulativeWickets: 2 },
  { over: 9, ball: 5, batter: "Suryakumar Yadav", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Suryakumar Yadav", commentary: "WICKET! UNBELIEVABLE! Surya mistimes an aerial loft, it slices straight up in the air and Glenn Phillips sprints in from deep mid-wicket to take a diving catch! Two wickets in four balls!", winProbability: 0.35, cumulativeScore: 80, cumulativeWickets: 3 },
  { over: 9, ball: 6, batter: "Hardik Pandya", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Dot to finish an incredible over. New Zealand roaring back into the contest! India 80/3 after 10.", winProbability: 0.35, cumulativeScore: 80, cumulativeWickets: 3 },

  // --- OVER 11 (Over index 10) - Santner turns the screws ---
  { over: 10, ball: 1, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Tilak works it to square leg, tension palpable in the dugout.", winProbability: 0.35, cumulativeScore: 81, cumulativeWickets: 3 },
  { over: 10, ball: 2, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Defended off the front foot.", winProbability: 0.33, cumulativeScore: 81, cumulativeWickets: 3 },
  { over: 10, ball: 3, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to long-off, rotates strike.", winProbability: 0.34, cumulativeScore: 82, cumulativeWickets: 3 },
  { over: 10, ball: 4, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Santner finds turn, beats the bat.", winProbability: 0.32, cumulativeScore: 82, cumulativeWickets: 3 },
  { over: 10, ball: 5, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Punched to deep point.", winProbability: 0.32, cumulativeScore: 83, cumulativeWickets: 3 },
  { over: 10, ball: 6, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "India 84/3. Required rate now creeping up to 10.4.", winProbability: 0.33, cumulativeScore: 84, cumulativeWickets: 3 },

  // --- OVER 12 (Over index 11) - TILAK COUNTER-ATTACK! ---
  { over: 11, ball: 1, batter: "Hardik Pandya", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Pushed to long-on to give Tilak the strike.", winProbability: 0.33, cumulativeScore: 85, cumulativeWickets: 3 },
  { over: 11, ball: 2, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! WHAT A SHOT! Tilak reads the googly, sits on one knee and launches it 88 meters over wide long-on!", winProbability: 0.44, cumulativeScore: 91, cumulativeWickets: 3 },
  { over: 11, ball: 3, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Back-to-back boundaries! Flatter and faster, Tilak punches it through extra cover. Pure class!", winProbability: 0.52, cumulativeScore: 95, cumulativeWickets: 3 },
  { over: 11, ball: 4, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Sodhi fires it outside off, dot ball.", winProbability: 0.50, cumulativeScore: 95, cumulativeWickets: 3 },
  { over: 11, ball: 5, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Driven wide of sweeper cover, scamper back for the second.", winProbability: 0.53, cumulativeScore: 97, cumulativeWickets: 3 },
  { over: 11, ball: 6, batter: "Tilak Varma", bowler: "Ish Sodhi", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "14 runs off the over! India 98/3. Momentum swings back!", winProbability: 0.54, cumulativeScore: 98, cumulativeWickets: 3 },

  // --- OVER 13 (Over index 12) - Boult comes back ---
  { over: 12, ball: 1, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Yorker on middle, dug out towards mid-wicket.", winProbability: 0.53, cumulativeScore: 99, cumulativeWickets: 3 },
  { over: 12, ball: 2, batter: "Hardik Pandya", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "India crosses the 100 mark! Needing 78 off 46.", winProbability: 0.54, cumulativeScore: 100, cumulativeWickets: 3 },
  { over: 12, ball: 3, batter: "Tilak Varma", bowler: "Trent Boult", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Superb wrist-work! Tilak glances a leg-stump ball past short fine leg for four.", winProbability: 0.60, cumulativeScore: 104, cumulativeWickets: 3 },
  { over: 12, ball: 4, batter: "Tilak Varma", bowler: "Trent Boult", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Pushed softly into the gap at deep mid-wicket for a couple.", winProbability: 0.62, cumulativeScore: 106, cumulativeWickets: 3 },
  { over: 12, ball: 5, batter: "Tilak Varma", bowler: "Trent Boult", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Slower bouncer, swing and a miss.", winProbability: 0.60, cumulativeScore: 106, cumulativeWickets: 3 },
  { over: 12, ball: 6, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to keep strike. 107/3 after 13 overs.", winProbability: 0.60, cumulativeScore: 107, cumulativeWickets: 3 },

  // --- OVER 14 (Over index 13) - Henry ---
  { over: 13, ball: 1, batter: "Tilak Varma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single down to third man.", winProbability: 0.59, cumulativeScore: 108, cumulativeWickets: 3 },
  { over: 13, ball: 2, batter: "Hardik Pandya", bowler: "Matt Henry", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Hardik clubs it down to long-on, two runs.", winProbability: 0.61, cumulativeScore: 110, cumulativeWickets: 3 },
  { over: 13, ball: 3, batter: "Hardik Pandya", bowler: "Matt Henry", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! HARDIK PANDYA DISPATCHES IT! Full on off stump and sent soaring into the tier at long-off!", winProbability: 0.73, cumulativeScore: 116, cumulativeWickets: 3 },
  { over: 13, ball: 4, batter: "Hardik Pandya", bowler: "Matt Henry", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "Henry bounces back with a sharp wide yorker.", winProbability: 0.71, cumulativeScore: 116, cumulativeWickets: 3 },
  { over: 13, ball: 5, batter: "Hardik Pandya", bowler: "Matt Henry", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Smacked through extra cover! The Indian dugout is on its feet!", winProbability: 0.78, cumulativeScore: 120, cumulativeWickets: 3 },
  { over: 13, ball: 6, batter: "Hardik Pandya", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to end a 14-run over! India 121/3 after 14 overs.", winProbability: 0.78, cumulativeScore: 121, cumulativeWickets: 3 },

  // --- OVER 15 (Over index 14) - CURRENT LIVE OVER (14.2) ---
  { over: 14, ball: 1, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Quick two taken between deep mid-wicket and long-on.", winProbability: 0.79, cumulativeScore: 123, cumulativeWickets: 3 },
  { over: 14, ball: 2, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Pushed to cover, single taken. (CURRENT LIVE BALL)", winProbability: 0.79, cumulativeScore: 124, cumulativeWickets: 3 },

  // --- SIMULATED UPCOMING BALLS (Overs 14.3 to 20 for Live Ticker) ---
  { over: 14, ball: 3, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Tilak moves across his stumps and scoops Ferguson over fine leg!", winProbability: 0.84, cumulativeScore: 128, cumulativeWickets: 3 },
  { over: 14, ball: 4, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Steered past gully for one.", winProbability: 0.84, cumulativeScore: 129, cumulativeWickets: 3 },
  { over: 14, ball: 5, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 0, batterRuns: 0, extras: 0, wicket: false, commentary: "151 kph rocket! Hardik defends off the backfoot.", winProbability: 0.82, cumulativeScore: 129, cumulativeWickets: 3 },
  { over: 14, ball: 6, batter: "Hardik Pandya", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to long-off. India 130/3 after 15 overs. Needing 48 off 30.", winProbability: 0.83, cumulativeScore: 130, cumulativeWickets: 3 },

  // Over 16
  { over: 15, ball: 1, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to long-on.", winProbability: 0.83, cumulativeScore: 131, cumulativeWickets: 3 },
  { over: 15, ball: 2, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Worked towards deep square leg.", winProbability: 0.83, cumulativeScore: 132, cumulativeWickets: 3 },
  { over: 15, ball: 3, batter: "Hardik Pandya", bowler: "Mitchell Santner", runs: 0, batterRuns: 0, extras: 0, wicket: true, wicketType: "caught", dismissedPlayer: "Hardik Pandya", commentary: "WICKET! Santner gets Hardik! Slices it straight into the hands of backward point! NZ alive!", winProbability: 0.70, cumulativeScore: 132, cumulativeWickets: 4 },
  { over: 15, ball: 4, batter: "Rinku Singh", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Rinku off the mark with a clip to deep mid-wicket.", winProbability: 0.71, cumulativeScore: 133, cumulativeWickets: 4 },
  { over: 15, ball: 5, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Tilak completes a courageous 50 with a fine-leg sweep!", winProbability: 0.74, cumulativeScore: 135, cumulativeWickets: 4 },
  { over: 15, ball: 6, batter: "Tilak Varma", bowler: "Mitchell Santner", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "136/4 after 16. Needing 42 from 24.", winProbability: 0.74, cumulativeScore: 136, cumulativeWickets: 4 },

  // Over 17
  { over: 16, ball: 1, batter: "Tilak Varma", bowler: "Trent Boult", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Tilak lofts Boult over extra cover with precision!", winProbability: 0.82, cumulativeScore: 140, cumulativeWickets: 4 },
  { over: 16, ball: 2, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to mid-on.", winProbability: 0.82, cumulativeScore: 141, cumulativeWickets: 4 },
  { over: 16, ball: 3, batter: "Rinku Singh", bowler: "Trent Boult", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! RINKU SPECIAL! Smacks a low full toss over deep square leg!", winProbability: 0.91, cumulativeScore: 147, cumulativeWickets: 4 },
  { over: 16, ball: 4, batter: "Rinku Singh", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to third man.", winProbability: 0.91, cumulativeScore: 148, cumulativeWickets: 4 },
  { over: 16, ball: 5, batter: "Tilak Varma", bowler: "Trent Boult", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "Two more added to the tally.", winProbability: 0.93, cumulativeScore: 150, cumulativeWickets: 4 },
  { over: 16, ball: 6, batter: "Tilak Varma", bowler: "Trent Boult", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "151/4 after 17 overs. Only 27 needed from 18 balls.", winProbability: 0.93, cumulativeScore: 151, cumulativeWickets: 4 },

  // Over 18
  { over: 17, ball: 1, batter: "Tilak Varma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to cover.", winProbability: 0.93, cumulativeScore: 152, cumulativeWickets: 4 },
  { over: 17, ball: 2, batter: "Rinku Singh", bowler: "Matt Henry", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Rinku carves it through point! The chase is well in control now.", winProbability: 0.96, cumulativeScore: 156, cumulativeWickets: 4 },
  { over: 17, ball: 3, batter: "Rinku Singh", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single taken.", winProbability: 0.96, cumulativeScore: 157, cumulativeWickets: 4 },
  { over: 17, ball: 4, batter: "Tilak Varma", bowler: "Matt Henry", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! Tilak moves into the 60s with a monster strike into the second tier!", winProbability: 0.99, cumulativeScore: 163, cumulativeWickets: 4 },
  { over: 17, ball: 5, batter: "Tilak Varma", bowler: "Matt Henry", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to long-off.", winProbability: 0.99, cumulativeScore: 164, cumulativeWickets: 4 },
  { over: 17, ball: 6, batter: "Rinku Singh", bowler: "Matt Henry", runs: 2, batterRuns: 2, extras: 0, wicket: false, commentary: "166/4 after 18. Only 12 runs needed from 12 balls.", winProbability: 0.99, cumulativeScore: 166, cumulativeWickets: 4 },

  // Over 19
  { over: 18, ball: 1, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 4, batterRuns: 4, extras: 0, wicket: false, commentary: "FOUR! Glanced past keeper down to fine leg boundary!", winProbability: 0.99, cumulativeScore: 170, cumulativeWickets: 4 },
  { over: 18, ball: 2, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to cover.", winProbability: 0.99, cumulativeScore: 171, cumulativeWickets: 4 },
  { over: 18, ball: 3, batter: "Tilak Varma", bowler: "Lockie Ferguson", runs: 1, batterRuns: 1, extras: 0, wicket: false, commentary: "Single to third man.", winProbability: 0.99, cumulativeScore: 172, cumulativeWickets: 4 },
  { over: 18, ball: 4, batter: "Rinku Singh", bowler: "Lockie Ferguson", runs: 6, batterRuns: 6, extras: 0, wicket: false, commentary: "SIX! RINKU FINISHES IT IN STYLE! A towering blow over long-on to seal the match for India!", winProbability: 1.0, cumulativeScore: 178, cumulativeWickets: 4 }
];
