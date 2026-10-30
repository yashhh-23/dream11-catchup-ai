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
  isMatchFinished?: boolean;
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
  videoClip?: {
    title: string;
    duration: string;
    actionType: "wicket" | "boundary" | "six";
  };
}

export type SpoilerLevel = "story-only" | "story-and-score" | "full";
export type LanguageMode = "en" | "hinglish";

export interface FantasyPlayerImpact {
  name: string;
  role: "Captain" | "Vice Captain" | "Player";
  runs: number;
  wickets: number;
  sixes: number;
  fours: number;
  pointsEarned: number;
  summary: string;
}

export interface FantasyTeamPerformance {
  teamName: string;
  captain: FantasyPlayerImpact;
  viceCaptain: FantasyPlayerImpact;
  phasePoints: number;
  rankBefore: string;
  rankAfter: string;
  rankDirection: "up" | "down" | "same";
}

export interface ThrillRating {
  rating: number; // e.g. 9.4
  verdict: string; // e.g. "Thriller finish, went to the last over with 3 lead changes"
  worthReplay: boolean;
}

export interface WhatToWatchNext {
  onStrike: string;
  nonStriker: string;
  upcomingBowler: string;
  equation: string;
  tacticalNote: string;
}

export interface RecapPayload {
  oneLiner: string;
  story: string;
  top3Moments: TurningPointMoment[];
  mood: "Cruising" | "Knife's edge" | "Chasing hard" | "Game over" | "Comeback on";
  moodEmoji?: string;
  partnershipSummary?: string;
  oversCovered: string;   // e.g. "Overs 6 – 14.2"
  fantasyImpact?: FantasyTeamPerformance;
  thrillRating?: ThrillRating;
  whatToWatchNext?: WhatToWatchNext;
  hinglishOneLiner?: string;
  hinglishStory?: string;
  spoilerLevel?: SpoilerLevel;
}

export interface RecapRequest {
  fromOver: number;       // 0-indexed inclusive (e.g. 5 for over 6)
  toOver: number;         // number (e.g. 14.2)
  matchId?: string;
  spoilerLevel?: SpoilerLevel;
  language?: LanguageMode;
  isWholeMatch?: boolean;
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
