export type WicketType = 
  | "caught" 
  | "bowled" 
  | "lbw" 
  | "run out" 
  | "stumped" 
  | "hit wicket";

export interface Ball {
  over: number;           // 0-indexed completed overs (0 = over 1, 14 = over 15)
  ball: number;           // 1-6 (delivery in over)
  batter: string;
  bowler: string;
  runs: number;           // runs scored off the bat on this delivery
  isBoundaryFour?: boolean; // explicit boundary flag
  isSix?: boolean;          // explicit six flag
  wicket: boolean;
  wicketType?: WicketType;
  dismissedPlayer?: string;
  commentary: string;
  winProbability: number; // 0.0 to 1.0
  cumulativeScore: number;
  cumulativeWickets: number;
}

export interface MatchMeta {
  matchId: string;
  title: string;
  team1: string;          // Batting first (set target)
  team2: string;          // Batting second (chasing)
  venue: string;
  format: "T20" | "ODI";
  totalOvers: number;
  target: number;         // Chasing target
  liveBallIndex: number;  // Exact index of current live ball in matchBalls (e.g. 85 for 14.2)
  currentLiveOver: number;// Display helper (e.g. 14.2)
  innings: 1 | 2;
  isMatchFinished?: boolean;
}

export type BallEventKind = "wicket" | "six" | "four" | "dot" | "run";

export interface TurningPointMoment {
  over: string;           // e.g. "9.3" or "14.2"
  label: "WICKET" | "SIX" | "CRITICAL MOMENT" | "BOUNDARY";
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
  verdict: string;
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
  partnershipSummary: string;
  oversCovered: string;   // e.g. "Overs 6 – 14.2"
  fantasyImpact?: FantasyTeamPerformance;
  thrillRating?: ThrillRating;
  whatToWatchNext?: WhatToWatchNext;
  hinglishOneLiner?: string;
  hinglishStory?: string;
  spoilerLevel?: SpoilerLevel;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    matchId?: string;
    usedFallback?: boolean;
    cached?: boolean;
    oversCovered?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
