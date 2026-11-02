import { NextRequest, NextResponse } from "next/server";
import { getClientIp, BoundedRateLimiter } from "@/lib/rateLimit";

// Lightweight telemetry storage for demonstration & evaluation
interface TelemetryRecord {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
}

const eventCounts: Record<string, number> = {};
const recentEvents: TelemetryRecord[] = [];
const MAX_RECENT_EVENTS = 50;

const ALLOWED_EVENTS = new Set<string>([
  "gate_viewed",
  "recap_started",
  "recap_completed",
  "recap_success",
  "recap_fallback",
  "recap_error",
  "share_clicked",
  "feedback_submitted",
  "live_viewed",
  "jump_to_live",
  "jump_to_live_direct",
]);

// 60 events/minute rate limiter using first client IP
const eventsLimiter = new BoundedRateLimiter({
  maxRequests: 60,
  windowMs: 60000,
  maxEntries: 500,
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!eventsLimiter.check(ip)) {
      return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await req.json();
    const eventName = body.event;

    if (typeof eventName === "string" && ALLOWED_EVENTS.has(eventName)) {
      eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
      recentEvents.unshift({
        event: eventName,
        properties: body.properties || {},
        timestamp: Date.now(),
      });
      if (recentEvents.length > MAX_RECENT_EVENTS) {
        recentEvents.pop();
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!eventsLimiter.check(ip)) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  const authHeader = req.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  // Closed by default: requires ADMIN_SECRET to be configured and matched via Bearer token
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: ADMIN_SECRET authentication required" },
      { status: 401 }
    );
  }

  const gateViews = eventCounts["gate_viewed"] || 0;
  const recapCompletes = eventCounts["recap_completed"] || 0;
  const directJumps = eventCounts["jump_to_live_direct"] || 0;

  return NextResponse.json({
    success: true,
    data: {
      eventCounts,
      totalEvents: Object.values(eventCounts).reduce((a, b) => a + b, 0),
      metrics: {
        recapCompletionRate: gateViews > 0 ? Number((recapCompletes / gateViews).toFixed(3)) : 0,
        directJumpRate: gateViews > 0 ? Number((directJumps / gateViews).toFixed(3)) : 0,
      },
      recentEvents,
    },
  });
}
