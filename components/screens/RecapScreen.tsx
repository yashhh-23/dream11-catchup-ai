"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta, RecapPayload, LanguageMode } from "@/types";
import { WinProbChart } from "@/components/charts/WinProbChart";
import { EVENT_STYLE } from "@/lib/matchUtils";
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
  X,
  ThumbsUp,
  ThumbsDown,
  Compass,
  Trophy,
  ShieldCheck,
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
  const [language, setLanguage] = useState<LanguageMode>("en");
  const [showRank, setShowRank] = useState(false);
  const [revealedMomentsCount, setRevealedMomentsCount] = useState(1);
  const [activeVideoModal, setActiveVideoModal] = useState<{ title: string; over: string } | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
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
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      stopSpeech();
    };
  }, []);

  const handleLanguageChange = (newLang: LanguageMode) => {
    if (isPlayingAudio) {
      stopSpeech();
    }
    setLanguage(newLang);
  };

  const defaultHinglishHeadline = `Bhai kya bawal match chal raha hai! India ne bawal counter-attack karke score badha diya!`;
  const defaultHinglishStory = `Overs ${recap.oversCovered} ke dauran India ne zabardast batting karke New Zealand ke bowling attack par dabaav bana diya. Ab chase exciting mod par hai!`;

  const headlineSource = language === "hinglish" 
    ? (recap.hinglishOneLiner || defaultHinglishHeadline) 
    : recap.oneLiner;

  const cleanHeadline = headlineSource
    .replace(/^["'“‘]+/, "")
    .replace(/["'”’]+$/, "")
    .trim();

  const activeStory = language === "hinglish" 
    ? (recap.hinglishStory || defaultHinglishStory) 
    : recap.story;

  const handleToggleVoice = () => {
    if (!isSpeechSupported || typeof window === "undefined") return;

    if (isPlayingAudio) {
      stopSpeech();
      return;
    }

    const narrationText = `${cleanHeadline}. ${activeStory}`;

    const utterance = new SpeechSynthesisUtterance(narrationText);

    if (language === "hinglish") {
      utterance.lang = "hi-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.08;

      // Find an Indian English or Hindi voice
      const indianVoice = voices.find((v) => {
        const langLower = v.lang.toLowerCase();
        const nameLower = v.name.toLowerCase();
        return (
          langLower.includes("hi-in") ||
          langLower.includes("hi_in") ||
          langLower.includes("en-in") ||
          langLower.includes("en_in") ||
          nameLower.includes("india") ||
          nameLower.includes("hindi") ||
          nameLower.includes("ravi") ||
          nameLower.includes("neerja") ||
          nameLower.includes("heera") ||
          nameLower.includes("swara")
        );
      });

      if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang;
      }
    } else {
      utterance.lang = "en-IN";
      utterance.rate = 1.04;
      utterance.pitch = 1.0;

      const englishVoice = voices.find((v) => {
        const langLower = v.lang.toLowerCase();
        return langLower.includes("en-in") || langLower.includes("en-gb") || langLower.includes("en-us");
      });

      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      setIsPlayingAudio(false);
    };

    window.speechSynthesis.cancel();
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
          {holdBackAlerts && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-chip">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Lock-screen alerts muted</span>
            </div>
          )}

          {/* Language Switcher */}
          <div className="flex items-center bg-brand-surface p-0.5 rounded-chip border border-brand-border text-[11px]">
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                language === "en" ? "bg-brand-border text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("hinglish")}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                language === "hinglish" ? "bg-brand-border text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Hinglish
            </button>
          </div>

          <div className="text-xs text-slate-400">
            {recap.oversCovered}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-brand-surface border border-brand-border rounded-container p-5 sm:p-6 space-y-6">
        
        {/* Fantasy Personalization */}
        {fantasy && (
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
                +{fantasy.phasePoints} pts in this phase
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span className="font-semibold text-amber-300">Captain (2x)</span>
                  <span className="font-bold text-emerald-400">+{fantasy.captain.pointsEarned} pts</span>
                </div>
                <div className="font-medium text-slate-200">{fantasy.captain.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{fantasy.captain.summary}</div>
              </div>

              <div className="p-2.5 rounded-chip bg-brand-bg border border-brand-border">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span className="font-semibold text-slate-300">Vice-Captain (1.5x)</span>
                  <span className={`font-bold ${fantasy.viceCaptain.pointsEarned >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fantasy.viceCaptain.pointsEarned >= 0 ? `+${fantasy.viceCaptain.pointsEarned}` : fantasy.viceCaptain.pointsEarned} pts
                  </span>
                </div>
                <div className="font-medium text-slate-200">{fantasy.viceCaptain.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{fantasy.viceCaptain.summary}</div>
              </div>
            </div>

            {/* Rank Reveal */}
            <div className="pt-2 border-t border-brand-border/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Leaderboard Rank:</span>
                {showRank ? (
                  <span className="font-bold text-emerald-400 tabular-nums flex items-center gap-1">
                    <span>{fantasy.rankBefore}</span>
                    <span>→</span>
                    <span>{fantasy.rankAfter}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-semibold ml-1">
                      ▲ Huge jump
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
            </div>
          </div>
        )}

        {/* Story Section */}
        <div className="space-y-3">
          {/* Phase Badge & Audio */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-slate-300">
              Mood · {recap.mood}
            </span>

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
                    <span>Listen ({language === "hinglish" ? "Hinglish voice" : "English voice"})</span>
                  </>
                )}
              </button>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-[#F0F6FC] leading-snug">
            {cleanHeadline}
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            {activeStory}
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
          />
        </div>

        <div className="border-t border-brand-border" />

        {/* Key Moments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300">
              Key moments ({Math.min(revealedMomentsCount, recap.top3Moments.length)} of {recap.top3Moments.length} revealed)
            </h3>
            {revealedMomentsCount < recap.top3Moments.length && (
              <button
                type="button"
                onClick={() => setRevealedMomentsCount(recap.top3Moments.length)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Reveal all moments
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {recap.top3Moments.slice(0, revealedMomentsCount).map((moment, idx) => {
              const kind = moment.label === "WICKET" ? "wicket" : moment.label === "SIX" ? "six" : "four";
              const swingVal = Math.round(moment.swingDelta * 100);
              const isPositive = moment.winProbAfter > moment.winProbBefore;

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-chip bg-brand-bg border border-brand-border space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          Over {moment.over}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${EVENT_STYLE[kind].badge}`}>
                          {EVENT_STYLE[kind].label}
                        </span>
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
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isPositive ? `+${swingVal}%` : `-${swingVal}%`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        win swing
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveVideoModal({ title: `${moment.player} · ${moment.label}`, over: moment.over })}
                      className="text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1 rounded bg-brand-surface border border-brand-border"
                    >
                      <Play className="w-3 h-3 text-brand-red fill-brand-red" />
                      <span>Watch 10s replay clip</span>
                    </button>
                    <span className="text-[10px] text-slate-500">0:14 clip · FanCode stream</span>
                  </div>
                </div>
              );
            })}

            {revealedMomentsCount < recap.top3Moments.length && (
              <button
                type="button"
                onClick={() => setRevealedMomentsCount(prev => prev + 1)}
                className="w-full py-2.5 rounded-chip border border-brand-border bg-brand-bg hover:bg-brand-surface text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Reveal next turning point ({revealedMomentsCount + 1} of {recap.top3Moments.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
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
                <span className="text-slate-500">Bowler: </span>
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
                  onClick={() => setFeedbackGiven("up")}
                  className="p-1.5 rounded-md hover:bg-brand-border text-slate-300 hover:text-white transition-colors"
                  title="Yes, caught up"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackGiven("down")}
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

      {/* Video Modal */}
      {activeVideoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-surface border border-brand-border rounded-container max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <span className="text-xs font-semibold text-white">{activeVideoModal.title}</span>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-brand-bg rounded-chip border border-brand-border relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="w-12 h-12 rounded-full bg-brand-red flex items-center justify-center text-white cursor-pointer shadow-lg z-10 animate-pulse">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-white z-10">
                <span>Over {activeVideoModal.over} · Replay clip</span>
                <span>0:14 HD</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300">
              Synced directly with the FanCode broadcast stream rewind point.
            </p>
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
