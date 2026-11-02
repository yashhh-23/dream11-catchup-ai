export type AnalyticsEvent = 
  | "gate_viewed"
  | "recap_started"
  | "recap_completed"
  | "jump_to_live"
  | "share_clicked"
  | "feedback_submitted";

export function track(event: AnalyticsEvent, properties?: Record<string, any>) {
  if (typeof window === "undefined") return;

  const payload = {
    event,
    properties: properties || {},
    timestamp: Date.now(),
  };

  // Fire-and-forget beacon or POST
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/events", blob);
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}
