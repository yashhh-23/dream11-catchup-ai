import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "dream11-zero-spoiler-secret-key-2026";

export interface SimulatorSession {
  matchId: string;
  baseIndex: number;
  createdAt: number;
}

/**
 * Creates a signed, tamper-proof session token for live ticker simulation.
 */
export function createSimulatorToken(matchId: string, baseIndex: number): string {
  const payload = `${matchId}:${baseIndex}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Verifies the token signature and returns the session parameters.
 */
export function verifySimulatorToken(token: string): { valid: boolean; session?: SimulatorSession; error?: string } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split(":");
    if (parts.length !== 4) {
      return { valid: false, error: "INVALID_TOKEN_FORMAT" };
    }

    const [matchId, baseIndexStr, createdAtStr, receivedHmac] = parts;
    const payload = `${matchId}:${baseIndexStr}:${createdAtStr}`;
    const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

    if (receivedHmac !== expectedHmac) {
      return { valid: false, error: "INVALID_SIGNATURE" };
    }

    return {
      valid: true,
      session: {
        matchId,
        baseIndex: Number(baseIndexStr),
        createdAt: Number(createdAtStr),
      },
    };
  } catch (e: any) {
    return { valid: false, error: "MALFORMED_TOKEN" };
  }
}

/**
 * Calculates the maximum ball index that is legally unlocked based on elapsed simulation time.
 * Real deliveries take ~20-30s; our interactive demo clock advances at 4.0s per delivery.
 * Deliveries ahead of this clock are strictly blocked to preserve the zero-spoiler contract.
 */
export function calculateAllowedIndex(session: SimulatorSession, secondsPerBall = 4.0): number {
  const elapsedSeconds = Math.max(0, (Date.now() - session.createdAt) / 1000);
  const unlockedDeliveries = Math.floor(elapsedSeconds / secondsPerBall);
  return session.baseIndex + unlockedDeliveries;
}
