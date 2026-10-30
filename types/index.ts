export type WicketType = 
  | "caught" 
  | "bowled" 
  | "lbw" 
  | "run out" 
  | "stumped" 
  | "hit wicket";

export interface Ball {
  over: number;           // 0-indexed (0 = over 1, 19 = over 20)
  ball: number;           // 1-6 (or extras)
  batter: string;
  bowler: string;
  runs: number;           // total runs scored on this delivery (including extras)
  batterRuns: number;     // runs credited to batter
  extras: number;
  wicket: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  commentary: string;     // ball-by-ball commentary
  winProbability: number; // 0.0 – 1.0 (batting team win chance)
  cumulativeScore: number;
  cumulativeWickets: number;
}

export interface MatchMeta {
  matchId: string;
  title: string;
  team1: string;          // Batting first (set target)
  team2: string;          // Batting second (chasing)
  venue: string;
  matchDate: string;
  format: "T20" | "ODI";
  totalOvers: number;
  target: number;         // Chasing target
  currentLiveOver: number;// e.g. 14.2 (Over 14, 2 balls done)
  innings: 1 | 2;
}

export interface TurningPointMoment {
  over: string;           // e.g. "9.3" or "14.2"
  label: "WICKET" | "SIX" | "CRITICAL MOMENT" | "MAIDEN" | "BOUNDARY";
  player: string;
  description: string;
  impact: string;
  winProbBefore: number;
  winProbAfter: number;
  swingDelta: number;     // abs(winProbAfter - winProbBefore)
}

export interface RecapPayload {
  oneLiner: string;
  story: string;
  top3Moments: TurningPointMoment[];
  mood: "Cruising" | "Knife's edge" | "Chasing hard" | "Game over" | "Comeback on";
  moodEmoji: string;
  partnershipSummary?: string;
  oversCovered: string;   // e.g. "Overs 5 – 14"
}

export interface RecapRequest {
  fromOver: number;       // 0-indexed inclusive (e.g. 4 for over 5)
  toOver: number;         // 0-indexed exclusive (e.g. 14 for up to over 14)
  matchId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
