if (typeof window !== "undefined") {
  throw new Error("SECURITY VIOLATION: serverMatchData must only be imported on the server.");
}
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Ball, MatchMeta } from "../types/index.ts";
import { createSimulatorToken, verifySimulatorToken, calculateAllowedIndex } from "./sessionUtils.ts";

export interface LoadedMatch {
  meta: MatchMeta;
  balls: Ball[];
  squads?: { India: string[]; Pakistan: string[] };
}

export const DEFAULT_MATCH_ID = process.env.DEFAULT_MATCH_ID || "ind-pak-2022-t20-wc";

function getMatchDataDirectory(): string {
  if (process.env.MATCH_DATA_DIR && process.env.MATCH_DATA_DIR.trim().length > 0) {
    return path.resolve(process.env.MATCH_DATA_DIR.trim());
  }
  return path.join(process.cwd(), "lib", "data");
}

export function loadMatchRecord(raw: any): LoadedMatch {
  const squad = raw.squads
    ? (Object.values(raw.squads).flat() as string[])
    : (raw.meta.squad || []);
  return {
    meta: {
      ...raw.meta,
      firstInningsScore: raw.meta.firstInningsScore || "159/8",
      squad,
    },
    balls: raw.balls || [],
    squads: raw.squads,
  };
}

export function loadMatchById(matchId: string): LoadedMatch | null {
  // Prevent directory traversal attacks
  const sanitizedId = path.basename(matchId);
  const dataDir = getMatchDataDirectory();

  // 1. Try createRequire relative to this file (ensures Next.js NFT traces and bundles JSON)
  try {
    const req = createRequire(import.meta.url);
    const raw = req(`./data/${sanitizedId}.json`);
    if (raw) return loadMatchRecord(raw);
  } catch {}

  // 2. Try fileURLToPath relative resolution
  try {
    const filePath = fileURLToPath(new URL(`./data/${sanitizedId}.json`, import.meta.url));
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return loadMatchRecord(raw);
    }
  } catch {}

  // 3. Try configured match data directory / process.cwd()
  try {
    const directPath = path.join(dataDir, `${sanitizedId}.json`);
    if (fs.existsSync(directPath)) {
      const raw = JSON.parse(fs.readFileSync(directPath, "utf-8"));
      return loadMatchRecord(raw);
    }
  } catch {}

  return null;
}

export const serverMatchesRegistry: Record<string, LoadedMatch> = {};

// Dynamically discover all match datasets in the data directory
try {
  const dataDir = getMatchDataDirectory();
  if (fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir);
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dataDir, entry), "utf-8"));
          if (content?.meta?.matchId) {
            serverMatchesRegistry[content.meta.matchId] = loadMatchRecord(content);
          }
        } catch {}
      }
    }
  }
} catch (e) {
  console.warn("Could not scan match data directory:", e);
}

// Fallback to loading default match if directory scan was empty (e.g. bundled serverless lambda)
if (Object.keys(serverMatchesRegistry).length === 0) {
  const defaultMatch = loadMatchById(DEFAULT_MATCH_ID);
  if (defaultMatch) {
    serverMatchesRegistry[DEFAULT_MATCH_ID] = defaultMatch;
  }
}

const initialMatch = serverMatchesRegistry[DEFAULT_MATCH_ID] || Object.values(serverMatchesRegistry)[0];
if (!initialMatch) {
  throw new Error(`CRITICAL_ERROR: Failed to load match data for default match '${DEFAULT_MATCH_ID}'`);
}

export const serverMatchMeta: MatchMeta = initialMatch.meta;
export const serverMatchBalls: Ball[] = initialMatch.balls;

export function getAvailableMatches(): Array<{ matchId: string; title: string }> {
  return Object.values(serverMatchesRegistry).map((m) => ({
    matchId: m.meta.matchId,
    title: m.meta.title,
  }));
}

export function getServerMatchById(matchId?: string, publicOnly = false): LoadedMatch | null {
  const targetId = matchId?.trim();
  const availableMatches = getAvailableMatches();

  if (targetId) {
    // Prototype pollution & invalid property protection (Bug 7)
    if (targetId === "__proto__" || targetId === "constructor" || targetId === "toString") {
      return null;
    }

    let match = Object.prototype.hasOwnProperty.call(serverMatchesRegistry, targetId)
      ? serverMatchesRegistry[targetId]
      : null;

    // Dynamic resolution fallback for matches on filesystem not yet indexed
    if (!match) {
      const dynamicallyLoaded = loadMatchById(targetId);
      if (dynamicallyLoaded) {
        serverMatchesRegistry[dynamicallyLoaded.meta.matchId] = dynamicallyLoaded;
        match = dynamicallyLoaded;
      }
    }

    if (!match) {
      return null;
    }

    const metaWithMatches = {
      ...match.meta,
      availableMatches: getAvailableMatches(),
    };
    if (publicOnly) {
      const liveCutoff = match.meta.liveBallIndex !== undefined ? match.meta.liveBallIndex : match.balls.length - 1;
      return {
        meta: metaWithMatches,
        balls: match.balls.slice(0, liveCutoff + 1),
        squads: match.squads,
      };
    }
    return {
      ...match,
      meta: metaWithMatches,
    };
  }

  const defaultMatch = serverMatchesRegistry[DEFAULT_MATCH_ID] || Object.values(serverMatchesRegistry)[0];
  const metaWithMatches = {
    ...defaultMatch.meta,
    availableMatches,
  };
  if (publicOnly) {
    const liveCutoff = defaultMatch.meta.liveBallIndex !== undefined ? defaultMatch.meta.liveBallIndex : defaultMatch.balls.length - 1;
    return {
      meta: metaWithMatches,
      balls: defaultMatch.balls.slice(0, liveCutoff + 1),
      squads: defaultMatch.squads,
    };
  }
  return {
    ...defaultMatch,
    meta: metaWithMatches,
  };
}

/**
 * Returns safe public balls and creates a signed simulation token.
 * This is the ONLY data entry point for client consumers.
 */
export function getPublicMatchData(matchId?: string): {
  meta: MatchMeta;
  balls: Ball[];
  sessionToken: string;
  squad?: string[];
  availableMatches?: Array<{ matchId: string; title: string }>;
} | null {
  const match = getServerMatchById(matchId, true);
  if (!match) return null;
  const { meta, balls } = match;
  const sessionToken = createSimulatorToken(meta.matchId, meta.liveBallIndex ?? 89);

  return {
    meta,
    balls,
    sessionToken,
    squad: meta.squad,
    availableMatches: meta.availableMatches,
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
  // Validate that requestedIndex is a non-negative integer
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

  // Cross-match token forgery protection
  if (verification.session.matchId !== match.meta.matchId) {
    return {
      ball: null,
      isMatchFinished: false,
      error: `TOKEN_MATCH_MISMATCH: Session token was minted for match "${verification.session.matchId}", not "${match.meta.matchId}".`,
      status: 403,
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
