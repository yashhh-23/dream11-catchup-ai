"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { CRICKET_MINUTES_PER_OVER } from "@/lib/matchUtils";

interface AwayState {
  isAwayDetected: boolean;
  awaySeconds: number;
  simulatedMinutesAway: number;
  suggestedFromOver: number;
  dismiss: () => void;
}

export function useAwayDetector(
  currentLiveOver: number,
  enabled: boolean = true,
  userPositionOver?: number
): AwayState {
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [isAwayDetected, setIsAwayDetected] = useState(false);
  const hiddenTimestampRef = useRef<number | null>(null);

  // Check for demo timescale param (enabled in both dev and production for evaluation demos)
  const timescale = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Number(new URLSearchParams(window.location.search).get("timescale")) || 1;
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTimestampRef.current = Date.now();
      } else {
        if (hiddenTimestampRef.current !== null) {
          const elapsedMs = Date.now() - hiddenTimestampRef.current;
          const elapsedSec = Math.floor(elapsedMs / 1000);
          hiddenTimestampRef.current = null;

          // Threshold: 30s real time (or 5s in demo timescale mode >= 10)
          const thresholdSec = timescale >= 10 ? 5 : 30;

          if (elapsedSec >= thresholdSec) {
            setAwaySeconds(elapsedSec);
            setIsAwayDetected(true);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, timescale]);

  const dismiss = useCallback(() => {
    setIsAwayDetected(false);
    setAwaySeconds(0);
  }, []);

  // Convert away seconds into simulated cricket time away
  // In demo mode (?timescale=60), 10 seconds hidden = 10 minutes away
  const simulatedMinutesAway = Math.max(1, Math.round((awaySeconds * timescale) / 60));

  // T20 over is ~4.0 minutes (ICC standard over rate). Approximate overs missed:
  const baseOver = userPositionOver !== undefined ? userPositionOver : currentLiveOver;
  const oversMissed = Math.max(1, Math.min(10, Math.round(simulatedMinutesAway / CRICKET_MINUTES_PER_OVER)));
  const suggestedFromOver = Math.max(0, Math.floor(baseOver - oversMissed));

  return {
    isAwayDetected,
    awaySeconds,
    simulatedMinutesAway,
    suggestedFromOver,
    dismiss,
  };
}
