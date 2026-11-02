import crypto from "crypto";
import { SIMULATOR_SECONDS_PER_BALL } from "./matchUtils.ts";

let hasLoggedDevSecretWarning = false;

const INSECURE_DEFAULT_SECRETS = new Set([
  "your_secure_random_session_secret_min_32_chars_here",
  "dream11-zero-spoiler-secret-2026-key-dev-hmac-sha256",
  "default_secret",
  "secret",
]);

/**
 * In multi-instance serverless environments (e.g., Vercel Preview, AWS Lambda, Docker replicas),
 * ephemeral in-process random secrets (crypto.randomBytes) cause severe desynchronization:
 * a token minted by Lambda A fails signature verification on Lambda B with HTTP 403 INVALID_SIGNATURE.
 *
 * To ensure 100% multi-instance coherence without requiring manual environment variables in preview/dev,
 * we derive a deterministic deployment-stable HMAC secret from available deployment context:
 * - VERCEL_DEPLOYMENT_ID / VERCEL_GIT_COMMIT_SHA / COMMIT_REF / BUILD_ID / process.cwd()
 */
function getDeterministicDevSecret(): string {
  const deploymentContext =
    process.env.SESSION_SECRET_DEV?.trim() ||
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim() ||
    process.env.COMMIT_REF?.trim() ||
    process.env.BUILD_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    process.cwd();

  return crypto
    .createHmac("sha256", "dream11-catchup-ai-multi-instance-stable-seed-2026")
    .update(deploymentContext)
    .digest("hex");
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    if (INSECURE_DEFAULT_SECRETS.has(secret) || secret.length < 32) {
      throw new Error(
        "INSECURE_SESSION_SECRET: SESSION_SECRET must be a unique, unpredictable string of at least 32 characters. Do not use example placeholders."
      );
    }
    return secret;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("CRITICAL_SECURITY_CONFIG_MISSING: SESSION_SECRET must be set in production.");
  }
  
  if (!hasLoggedDevSecretWarning && process.env.NODE_ENV !== "test") {
    console.warn(
      "[SESSION_SECURITY] SESSION_SECRET not set. Using deployment-deterministic secret for development/preview. Multi-instance coherence active."
    );
    hasLoggedDevSecretWarning = true;
  }
  
  return getDeterministicDevSecret();
}

export interface SimulatorSession {
  matchId: string;
  baseIndex: number;
  createdAt: number;
}

/**
 * Creates a signed, tamper-proof session token for live ticker simulation.
 * Stamped with the exact timestamp live streaming started (streamStartedAt),
 * ensuring gate/recap dwell time cannot be exploited to fast-forward future balls.
 */
export function createSimulatorToken(matchId: string, baseIndex: number, streamStartedAt = Date.now()): string {
  const payload = `${matchId}:${baseIndex}:${streamStartedAt}`;
  const hmac = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Verifies the token signature using timing-safe comparison and returns the session parameters.
 */
export function verifySimulatorToken(token: string): { valid: boolean; session?: SimulatorSession; error?: string } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const lastColon = raw.lastIndexOf(":");
    if (lastColon === -1) {
      return { valid: false, error: "INVALID_TOKEN_FORMAT" };
    }
    const receivedHmac = raw.slice(lastColon + 1);
    const payload = raw.slice(0, lastColon);

    const payloadParts = payload.split(":");
    if (payloadParts.length < 3) {
      return { valid: false, error: "INVALID_TOKEN_FORMAT" };
    }
    const createdAtStr = payloadParts.pop()!;
    const baseIndexStr = payloadParts.pop()!;
    const matchId = payloadParts.join(":");

    const baseIndexNum = Number(baseIndexStr);
    const createdAtNum = Number(createdAtStr);
    if (!matchId || isNaN(baseIndexNum) || isNaN(createdAtNum)) {
      return { valid: false, error: "INVALID_TOKEN_FORMAT" };
    }

    const expectedHmac = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");

    const expectedBuffer = Buffer.from(expectedHmac, "hex");
    const receivedBuffer = Buffer.from(receivedHmac, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
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
 *
 * FanCode / Live Architecture Comparison:
 * In production FanCode / Dream11, live delivery streaming is synchronized to the real match feed
 * (Sportradar / Opta via WebSockets or Server-Sent Events), pushing balls as they occur in reality.
 * In this client catch-up simulation, the delivery ticker is anchored to the exact moment the fan
 * begins watching the live stream (session.createdAt = streamStartedAt), ensuring that dwelling on
 * the spoiler gate or recap screen does not allow the fan to skip ahead or leak future balls.
 */
export function calculateAllowedIndex(session: SimulatorSession, secondsPerBall = SIMULATOR_SECONDS_PER_BALL): number {
  const elapsedSeconds = Math.max(0, (Date.now() - session.createdAt) / 1000);
  const unlockedDeliveries = Math.floor(elapsedSeconds / secondsPerBall);
  return session.baseIndex + unlockedDeliveries;
}
