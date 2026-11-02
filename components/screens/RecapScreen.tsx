"use client";

import React, { useState, useEffect, useRef } from "react";
import { Ball, MatchMeta, RecapPayload } from "@/types";
import { WinProbChart } from "@/components/charts/WinProbChart";
import { EVENT_STYLE } from "@/lib/matchUtils";
import { track } from "@/lib/analytics";
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  Film,
  X,
  ThumbsUp,
  ThumbsDown,
  Compass,
  Trophy,
  ShieldCheck,
  Share2,
} from "lucide-react";

interface RecapScreenProps {
  meta: MatchMeta;
  recap: RecapPayload;
  missedFromOver: number;
  missedToOver: number;
  balls: Ball[];
  holdBackAlerts?: boolean;
  onBackToGate: () => void;
  onJumpToLive: () => void;
}

export const RecapScreen: React.FC<RecapScreenProps> = ({
  meta,
  recap,
  missedFromOver,
  missedToOver,
  balls,
  holdBackAlerts,
  onBackToGate,
  onJumpToLive,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showRank, setShowRank] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState<{
    title: string;
    over: string;
    duration?: string;
    player?: string;
    label?: string;
    description?: string;
    swingDelta?: number;
  } | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    if (!activeVideoModal || !videoPlaying) return;
    const interval = setInterval(() => {
      setVideoProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [activeVideoModal, videoPlaying, replayKey]);

  const feedbackStorageKey = `dream11_fb:${meta.matchId}:${missedFromOver}:${missedToOver}`;
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(feedbackStorageKey);
        if (saved === "up" || saved === "down") return saved;
      } catch {}
    }
    return null;
  });

  const [shareCopied, setShareCopied] = useState(false);
  const shareTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleShare = async () => {
    track("share_clicked", { matchId: meta.matchId, oversCovered: recap.oversCovered });
    const shareText = `Caught up on ${recap.oversCovered} on Dream11 CatchUp AI! Zero spoilers: don't tell me the score, I'm watching live!`;
    const baseUrl =
      (typeof window !== "undefined" && window.location?.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://dream11.com";
    const shareUrl = `${baseUrl}/?matchId=${encodeURIComponent(meta.matchId)}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `CatchUp AI - ${meta.title}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setShareCopied(false), 2500);
      }
    } catch {}
  };

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  // Helper to safely resolve speech synthesis voices asynchronously without Chromium/Safari race conditions
  const resolveVoicesAsync = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve([]);
        return;
      }
      const immediate = window.speechSynthesis.getVoices();
      if (immediate && immediate.length > 0) {
        resolve(immediate);
        return;
      }
      const onVoices = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve(window.speechSynthesis.getVoices() || []);
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve(window.speechSynthesis.getVoices() || []);
      }, 400);
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSpeechSupported(true);

      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          setVoices(available);
        }
      };

      updateVoices();
      window.speechSynthesis.addEventListener("voiceschanged", updateVoices);

      // Chromium and Mobile Safari asynchronous IPC poll
      const t1 = setTimeout(updateVoices, 100);
      const t2 = setTimeout(updateVoices, 300);

      return () => {
        stopSpeech();
        clearTimeout(t1);
        clearTimeout(t2);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
        }
      };
    }

    return () => {
      stopSpeech();
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeVideoModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveVideoModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeVideoModal]);

  const handleFeedback = (type: "up" | "down") => {
    setFeedbackGiven(type);
    track("feedback_submitted", { matchId: meta.matchId, type, oversCovered: recap.oversCovered });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(feedbackStorageKey, type);
      } catch {}
    }
  };

  const cleanHeadline = recap.oneLiner
    .replace(/^["'“‘]+/, "")
    .replace(/["'”’]+$/, "")
    .trim();

  const handleToggleVoice = async () => {
    if (!isSpeechSupported || typeof window === "undefined") return;

    if (isPlayingAudio) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Resolve voices asynchronously to prevent empty array race condition on immediate click in Chromium & Safari
    const voiceList = voices.length > 0 ? voices : await resolveVoicesAsync();
    if (voiceList.length > 0 && voices.length === 0) {
      setVoices(voiceList);
    }

    const narrationText = `${cleanHeadline}. ${recap.story}`;
    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.pitch = 1.0;

    utterance.rate = 1.02;
    const engVoice =
      voiceList.find((v) => {
        const l = v.lang.toLowerCase();
        const n = v.name.toLowerCase();
        return (
          l.includes("en-in") ||
          l.includes("en_in") ||
          n.includes("india") ||
          n.includes("neerja") ||
          n.includes("ravi") ||
          n.includes("heera")
        );
      }) ||
      voiceList.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      voiceList[0];

    if (engVoice) {
      utterance.voice = engVoice;
      utterance.lang = engVoice.lang;
    } else {
      utterance.lang = "en-IN";
    }

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      setIsPlayingAudio(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const fantasy = recap.fantasyImpact;
  const nextWatch = recap.whatToWatchNext;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-brand-border">
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onBackToGate();
          }}
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Adjust window</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="text-xs px-2.5 py-1 rounded-chip bg-brand-bg border border-brand-border text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
            title="Share spoiler-safe recap"
          >
            <Share2 className="w-3.5 h-3.5 text-brand-red" />
            <span>{shareCopied ? "Copied!" : "Share"}</span>
          </button>
          <div className="text-xs text-slate-400">
            {recap.oversCovered}
          </div>
        </div>
      </div>

      {/* In-App Alert Shield Indicator */}
      {holdBackAlerts && (
        <div className="mb-4 px-3.5 py-2 rounded-chip bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>In-app spoiler guard active: Match alerts & score banners paused until you jump to live</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-brand-surface border border-brand-border rounded-container p-5 sm:p-6 space-y-6">
        
        {/* Fantasy Personalization */}
        {fantasy && (() => {
          const isFantasyShielded = recap.spoilerLevel === "story-only" || Boolean(fantasy.isShielded);
          return (
            <div className="p-4 rounded-container bg-gradient-to-br from-[#1c1826] to-[#121620] border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    YOUR FANTASY TEAM IMPACT
                  </span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-semibold border border-rose-500/30">
                    {fantasy.teamName}
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-400 tabular-nums">
                  {isFantasyShielded ? "Points Shielded 🔒" : `+${fantasy.phasePoints} pts in this phase`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span className="font-semibold text-amber-300">Captain (2x)</span>
                    <span className="font-bold text-emerald-400">
                      {isFantasyShielded ? "Points Shielded 🔒" : `+${fantasy.captain.pointsEarned} pts`}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200">{fantasy.captain.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isFantasyShielded ? "Multiplier locked · Unlocks when you join live" : fantasy.captain.summary}
                  </div>
                </div>

                <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">Vice-Captain (1.5x)</span>
                    <span className={`font-bold ${isFantasyShielded || fantasy.viceCaptain.pointsEarned >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {isFantasyShielded 
                        ? "Points Shielded 🔒" 
                        : (fantasy.viceCaptain.pointsEarned >= 0 ? `+${fantasy.viceCaptain.pointsEarned}` : `${fantasy.viceCaptain.pointsEarned}`) + " pts"}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200">{fantasy.viceCaptain.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isFantasyShielded ? "Multiplier locked · Unlocks when you join live" : fantasy.viceCaptain.summary}
                  </div>
                </div>
              </div>

              {/* Rank Reveal */}
              <div className="pt-2 border-t border-brand-border/80 flex items-center justify-between text-xs">
                {isFantasyShielded ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Leaderboard Rank:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <span>Shielded in Story-Only mode 🔒</span>
                    </span>
                    <span className="text-[10px] text-slate-500">(prevents match score spoilers)</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Leaderboard Rank <span className="text-[10px] text-slate-500">(Simulated Contest Estimate)</span>:</span>
                      {showRank && fantasy.rankBefore !== "Shielded" ? (
                        <span className="font-bold text-emerald-400 tabular-nums flex items-center gap-1">
                          <span>{fantasy.rankBefore}</span>
                          <span>→</span>
                          <span>{fantasy.rankAfter}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ml-1 ${
                            fantasy.rankDirection === "down"
                              ? "bg-rose-500/20 text-rose-300"
                              : fantasy.rankDirection === "same"
                              ? "bg-slate-700/40 text-slate-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {fantasy.rankDirection === "down" ? "▼ Rank dropped" : fantasy.rankDirection === "same" ? "● Rank steady" : "▲ Rank jump"}
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-500 tracking-wider">••••••</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRank(!showRank)}
                      className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded bg-brand-bg border border-brand-border"
                    >
                      {showRank ? (
                        <>
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          <span>Hide rank</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-amber-400" />
                          <span>Reveal rank</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
              {!isFantasyShielded && showRank && (
                <div className="text-[10px] text-slate-500 pt-1">
                  Estimated rank movement based on Dream11 point distribution model. Real contest leaderboards sync via Dream11 Live Contest API during live broadcast.
                </div>
              )}
            </div>
          );
        })()}

        {/* Story Section */}
        <div className="space-y-3">
          {/* Phase Badge & Audio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-slate-300">
                Mood · {recap.mood}
              </span>
              {recap.thrillRating && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Thrill · {recap.thrillRating.verdict}
                </span>
              )}
            </div>

            {isSpeechSupported && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`text-xs px-2.5 py-1 rounded-chip border font-medium flex items-center gap-1.5 transition-colors ${
                  isPlayingAudio
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-brand-bg text-slate-300 border-brand-border hover:bg-brand-surfaceHover"
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Pause audio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen (AI commentary)</span>
                  </>
                )}
              </button>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-[#F0F6FC] leading-snug">
            {cleanHeadline}
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            {recap.story}
          </p>

          {recap.partnershipSummary && (
            <div className="text-xs text-slate-400 pt-1">
              {recap.partnershipSummary}
            </div>
          )}
        </div>

        <div className="border-t border-brand-border" />

        {/* Win Probability Chart */}
        <div>
          <WinProbChart
            balls={balls}
            missedFromOver={missedFromOver}
            missedToOver={missedToOver}
            spoilerLevel={recap.spoilerLevel}
            teamName={meta.team2}
          />
        </div>

        <div className="border-t border-brand-border" />

        {/* Key Moments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300">
              {recap.spoilerLevel === "story-only" ? "Key Turning Points by Match Impact" : "Key moments in chronological order"} ({recap.top3Moments.length} turning points)
            </h3>
          </div>

          <div className="space-y-2.5">
            {[...recap.top3Moments]
              .sort((a, b) => {
                if (a.ballIndex !== undefined && b.ballIndex !== undefined) {
                  return a.ballIndex - b.ballIndex;
                }
                const aOver = parseFloat(a.over);
                const bOver = parseFloat(b.over);
                if (!isNaN(aOver) && !isNaN(bOver)) {
                  return aOver - bOver;
                }
                return 0;
              })
              .map((moment, idx) => {
                const isWicket = moment.label === "WICKET";
                const isSix = moment.label === "SIX";
                const isFour = moment.label === "BOUNDARY";
                const isCritical = moment.label === "CRITICAL MOMENT";

                const kind = isWicket ? "wicket" : isSix ? "six" : isFour ? "four" : "run";
                const swingVal = Math.round(moment.swingDelta * 100);
                const isPositive = moment.winProbAfter > moment.winProbBefore;

                return (
                  <div
                    key={moment.ballIndex !== undefined ? `m-ball-${moment.ballIndex}` : `m-${moment.over}-${moment.label}-${moment.player}`}
                    className="p-3.5 rounded-chip bg-brand-bg border border-brand-border space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            Over {moment.over}
                          </span>
                          {isCritical ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              MOMENTUM SHIFT
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${EVENT_STYLE[kind].badge}`}>
                              {EVENT_STYLE[kind].label}
                            </span>
                          )}
                          <span className="text-slate-200 font-medium">
                            {moment.player}
                          </span>
                        </div>

                        <div className="text-slate-300 leading-normal">
                          {moment.description}
                        </div>

                        <div className="text-slate-400 text-[11px]">
                          {moment.impact}
                        </div>
                      </div>

                      <div className="text-right shrink-0 pt-0.5">
                        <div
                          className={`tabular-nums font-bold text-sm flex items-center justify-end gap-1 ${
                            swingVal === 0
                              ? "text-slate-400"
                              : isPositive
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {swingVal === 0 ? (
                            <span>0%</span>
                          ) : (
                            <>
                              {isPositive ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isPositive ? `+${swingVal}%` : `-${swingVal}%`}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          win swing
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoProgress(0);
                          setVideoPlaying(true);
                          setActiveVideoModal({
                            title: `${moment.player} · ${moment.label}`,
                            over: moment.over,
                            duration: moment.videoClip?.duration || "0:14",
                            player: moment.player,
                            label: moment.label,
                            description: moment.description,
                            swingDelta: moment.swingDelta,
                          });
                        }}
                        className="text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1 rounded bg-brand-surface border border-brand-border"
                      >
                        <Play className="w-3 h-3 text-brand-red fill-brand-red" />
                        <span>Interactive 2D Hawkeye Replay</span>
                      </button>
                      <span className="text-[10px] text-slate-500">2D Ball Trajectory · Broadcast sync</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* What to Watch Next */}
        {nextWatch && (
          <div className="p-3.5 rounded-container bg-brand-bg border border-brand-border space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>WHAT TO WATCH NEXT IN THE LIVE OVER</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>
                <span className="text-slate-500">On Strike: </span>
                <span className="font-semibold text-white">{nextWatch.onStrike}*</span>
              </div>
              <div>
                <span className="text-slate-500">Bowling now: </span>
                <span className="font-semibold text-white">{nextWatch.upcomingBowler}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-emerald-400 font-medium">{nextWatch.equation}</span> — {nextWatch.tacticalNote}
            </div>
          </div>
        )}

        {/* Feedback Widget */}
        <div className="pt-2 border-t border-brand-border flex items-center justify-between text-xs text-slate-400">
          <span>Did this catch you up smoothly?</span>
          <div className="flex items-center gap-2">
            {feedbackGiven ? (
              <span className="text-emerald-400 text-[11px] font-medium">Thanks for your feedback!</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleFeedback("up")}
                  className="p-1.5 rounded-md hover:bg-brand-border text-slate-300 hover:text-white transition-colors"
                  title="Yes, caught up"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback("down")}
                  className="p-1.5 rounded-md hover:bg-brand-border text-slate-300 hover:text-white transition-colors"
                  title="No, missed details"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal (Concept Preview) */}
      {activeVideoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
          onClick={() => setActiveVideoModal(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-brand-surface border border-brand-border rounded-container max-w-sm w-full p-4 space-y-3 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <span id="video-modal-title" className="text-xs font-semibold text-white">{activeVideoModal.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">Concept preview</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                aria-label="Close replay modal"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Interactive 2D Pitch Delivery Replay Visualizer */}
            <div className="aspect-video bg-[#080d14] rounded-chip border border-brand-border relative overflow-hidden flex flex-col justify-between p-3 select-none">
              {/* Pitch Field SVG */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 180" preserveAspectRatio="none">
                <rect width="320" height="180" fill="#0d1b16" />
                <ellipse cx="160" cy="100" rx="145" ry="68" fill="none" stroke="#1f3b2e" strokeWidth="1" strokeDasharray="3 3" />
                <polygon points="120,35 200,35 225,148 95,148" fill="#1b2e23" stroke="#2a4736" strokeWidth="1" />
                <line x1="125" y1="48" x2="195" y2="48" stroke="#4e735e" strokeWidth="1" />
                <line x1="102" y1="135" x2="218" y2="135" stroke="#4e735e" strokeWidth="1.5" />
                <rect x="157" y="33" width="6" height="4" fill="#d97706" rx="1" />
                <rect x="156" y="143" width="8" height="5" fill="#f59e0b" rx="1" />

                {/* Bowler trajectory arc */}
                <path
                  d="M 160,38 Q 154,88 158,138"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  className="opacity-70"
                />

                {/* Outcome Trajectory */}
                {activeVideoModal.label === "SIX" ? (
                  <path d="M 158,138 Q 75,30 18,18" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                ) : activeVideoModal.label === "FOUR" ? (
                  <path d="M 158,138 L 295,115" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                ) : (
                  <path d="M 158,138 L 158,145" fill="none" stroke="#ef4444" strokeWidth="4" />
                )}

                {/* Animated Ball */}
                <circle
                  cx={
                    videoProgress < 50
                      ? 160 + (videoProgress / 50) * -2
                      : activeVideoModal.label === "SIX"
                      ? 158 - ((videoProgress - 50) / 50) * 140
                      : activeVideoModal.label === "FOUR"
                      ? 158 + ((videoProgress - 50) / 50) * 137
                      : 158
                  }
                  cy={
                    videoProgress < 50
                      ? 38 + (videoProgress / 50) * 100
                      : activeVideoModal.label === "SIX"
                      ? 138 - ((videoProgress - 50) / 50) * 120
                      : activeVideoModal.label === "FOUR"
                      ? 138 - ((videoProgress - 50) / 50) * 23
                      : 144
                  }
                  r="4.5"
                  fill={activeVideoModal.label === "WICKET" ? "#ef4444" : "#ffffff"}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                />
              </svg>

              {/* HUD Header */}
              <div className="relative z-10 flex items-center justify-between text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-black/70 text-emerald-400 font-mono border border-emerald-500/30">
                  142.4 km/h · Good Length
                </span>
                <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] ${
                  activeVideoModal.label === "WICKET"
                    ? "bg-rose-500/90 text-white"
                    : activeVideoModal.label === "SIX"
                    ? "bg-emerald-500/90 text-white"
                    : "bg-blue-500/90 text-white"
                }`}>
                  {activeVideoModal.label || "KEY EVENT"}
                </span>
              </div>

              {/* Center description */}
              <div className="relative z-10 text-center py-1">
                <span className="text-xs font-bold text-white drop-shadow-md">
                  {activeVideoModal.description || `${activeVideoModal.player} in over ${activeVideoModal.over}`}
                </span>
              </div>

              {/* Replay Controls & Timeline Bar */}
              <div className="relative z-10 flex items-center justify-between gap-2 bg-black/70 backdrop-blur-xs p-1.5 rounded border border-white/10">
                <button
                  type="button"
                  onClick={() => setVideoPlaying(!videoPlaying)}
                  className="text-white hover:text-brand-red transition-colors"
                  aria-label={videoPlaying ? "Pause replay" : "Play replay"}
                >
                  {videoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>

                <div className="flex-1 bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-red h-full transition-all duration-150"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVideoProgress(0);
                    setReplayKey((k) => k + 1);
                    setVideoPlaying(true);
                  }}
                  className="text-slate-400 hover:text-white transition-colors p-0.5"
                  aria-label="Restart replay"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Interactive 2D Hawkeye pitch map & ball trajectory simulation.</span>
              <span className="text-emerald-400 font-medium">Broadcast HLS Synced</span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-bg/95 border-t border-brand-border backdrop-blur-sm z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-300">
            <span>Live over {meta.currentLiveOver}</span>
            <div className="text-[10px] text-emerald-400">Zero spoilers ahead</div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onJumpToLive();
            }}
            className="flex-1 sm:flex-initial py-2.5 px-6 rounded-container font-semibold text-sm bg-brand-red hover:bg-brand-redHover text-white transition-colors flex items-center justify-center gap-2"
          >
            <span>Jump to live match</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
