"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta, RecapPayload, LanguageMode } from "@/types";
import { WinProbChart } from "@/components/charts/WinProbChart";
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
  Sparkles,
  Compass,
  Trophy,
} from "lucide-react";

interface RecapScreenProps {
  meta: MatchMeta;
  recap: RecapPayload;
  missedFromOver: number;
  missedToOver: number;
  balls: Ball[];
  onBackToGate: () => void;
  onJumpToLive: () => void;
}

export const RecapScreen: React.FC<RecapScreenProps> = ({
  meta,
  recap,
  missedFromOver,
  missedToOver,
  balls,
  onBackToGate,
  onJumpToLive,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [language, setLanguage] = useState<LanguageMode>("en");
  const [showRank, setShowRank] = useState(false);
  const [revealedMomentsCount, setRevealedMomentsCount] = useState(1); // reveal 1 at a time
  const [activeVideoModal, setActiveVideoModal] = useState<{ title: string; over: string } | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSpeechSupported(true);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleVoice = () => {
    if (!isSpeechSupported) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const narrationText = language === "hinglish" && recap.hinglishStory
      ? `${recap.hinglishOneLiner}. ${recap.hinglishStory}`
      : `${cleanHeadline}. ${recap.story}`;

    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.lang.includes("hi-IN") || v.lang.includes("en-GB")
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  // Strip quotation marks from headline so it reads like a commentator headline
  const headlineSource = language === "hinglish" && recap.hinglishOneLiner 
    ? recap.hinglishOneLiner 
    : recap.oneLiner;

  const cleanHeadline = headlineSource
    .replace(/^["'“‘]+/, "")
    .replace(/["'”’]+$/, "")
    .trim();

  const activeStory = language === "hinglish" && recap.hinglishStory 
    ? recap.hinglishStory 
    : recap.story;

  const fantasy = recap.fantasyImpact;
  const thrill = recap.thrillRating;
  const nextWatch = recap.whatToWatchNext;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 pb-32">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#262C36]">
        <button
          type="button"
          onClick={() => {
            if (isSpeechSupported) window.speechSynthesis.cancel();
            onBackToGate();
          }}
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Adjust window</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center bg-[#161B22] p-0.5 rounded-lg border border-[#262C36] text-[11px]">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 rounded transition-colors ${
                language === "en" ? "bg-[#262C36] text-white font-medium" : "text-slate-400"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("hinglish")}
              className={`px-2 py-0.5 rounded transition-colors ${
                language === "hinglish" ? "bg-[#262C36] text-white font-medium" : "text-slate-400"
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

      {/* Main Single Flattened Container */}
      <div className="bg-[#161B22] border border-[#262C36] rounded-xl p-5 sm:p-6 space-y-6">
        
        {/* Dream11 Fantasy Team Personalization Card (Item 1) */}
        {fantasy && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#1c1826] to-[#121620] border border-rose-500/30 space-y-3">
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
              <div className="p-2.5 rounded-lg bg-[#0E1116] border border-[#262C36]">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span className="font-semibold text-amber-300">Captain (2x)</span>
                  <span className="font-bold text-emerald-400">+{fantasy.captain.pointsEarned} pts</span>
                </div>
                <div className="font-medium text-slate-200">{fantasy.captain.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{fantasy.captain.summary}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E1116] border border-[#262C36]">
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

            {/* Rank Reveal (Hidden by default as requested) */}
            <div className="pt-2 border-t border-[#262C36]/80 flex items-center justify-between text-xs">
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
                className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded bg-[#0E1116] border border-[#262C36]"
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

        {/* Narrative & Story Section */}
        <div className="space-y-3">
          {/* Phase Badge & Audio Trigger */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#0E1116] border border-[#262C36] text-slate-300">
              Mood · {recap.mood}
            </span>

            {isSpeechSupported && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                  isPlayingAudio
                    ? "bg-[#E11D48] text-white border-[#E11D48]"
                    : "bg-[#0E1116] text-slate-300 border-[#262C36] hover:bg-[#1C2128]"
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
                    <span>Listen ({language === "hinglish" ? "Hinglish" : "Audio"})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Commentator Headline */}
          <h2 className="text-base sm:text-lg font-semibold text-[#F0F6FC] leading-snug">
            {cleanHeadline}
          </h2>

          {/* Story Paragraph */}
          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            {activeStory}
          </p>

          {/* Partnership Summary */}
          {recap.partnershipSummary && (
            <div className="text-xs text-slate-400 pt-1">
              {recap.partnershipSummary}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[#262C36]" />

        {/* Win Probability Chart */}
        <div>
          <WinProbChart
            balls={balls}
            missedFromOver={missedFromOver}
            missedToOver={missedToOver}
            topMoments={recap.top3Moments}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-[#262C36]" />

        {/* Key Moments Section (Revealed one by one or all) */}
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
              const isWicket = moment.label === "WICKET";
              const isSix = moment.label === "SIX";
              const isFour = moment.label === "BOUNDARY";
              const swingVal = Math.round(moment.swingDelta * 100);
              const isPositive = moment.winProbAfter > moment.winProbBefore;

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-[#0E1116] border border-[#262C36] space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          Over {moment.over}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isWicket
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : isSix
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {isWicket ? "Wicket" : isSix ? "Six" : isFour ? "Four" : moment.label}
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

                    {/* Swing Indicator on Right */}
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

                  {/* Connect Moments to Video Replay Clip (Item 8) */}
                  <div className="pt-2 border-t border-[#262C36]/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveVideoModal({ title: `${moment.player} · ${moment.label}`, over: moment.over })}
                      className="text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1 rounded bg-[#161B22] border border-[#262C36]"
                    >
                      <Play className="w-3 h-3 text-[#E11D48] fill-[#E11D48]" />
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
                className="w-full py-2.5 rounded-lg border border-[#262C36] bg-[#0E1116] hover:bg-[#161B22] text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Reveal next turning point ({revealedMomentsCount + 1} of {recap.top3Moments.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* What to Watch Next Card (Item 4) */}
        {nextWatch && (
          <div className="p-3.5 rounded-xl bg-[#0E1116] border border-[#262C36] space-y-2 text-xs">
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

        {/* Feedback Telemetry Widget (Item 10) */}
        <div className="pt-2 border-t border-[#262C36] flex items-center justify-between text-xs text-slate-400">
          <span>Did this catch you up smoothly?</span>
          <div className="flex items-center gap-2">
            {feedbackGiven ? (
              <span className="text-emerald-400 text-[11px] font-medium">Thanks for your feedback!</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFeedbackGiven("up")}
                  className="p-1.5 rounded-md hover:bg-[#262C36] text-slate-300 hover:text-white transition-colors"
                  title="Yes, caught up"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackGiven("down")}
                  className="p-1.5 rounded-md hover:bg-[#262C36] text-slate-300 hover:text-white transition-colors"
                  title="No, missed details"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Video Clip Modal Mockup (Item 8) */}
      {activeVideoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#262C36] rounded-xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#262C36]">
              <span className="text-xs font-semibold text-white">{activeVideoModal.title}</span>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video bg-[#0E1116] rounded-lg border border-[#262C36] relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="w-12 h-12 rounded-full bg-[#E11D48] flex items-center justify-center text-white cursor-pointer shadow-lg z-10 animate-pulse">
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

      {/* Flat Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0E1116]/95 border-t border-[#262C36] backdrop-blur-sm z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-300">
            <span>Live over {meta.currentLiveOver}</span>
            <div className="text-[10px] text-emerald-400">Zero spoilers ahead</div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isSpeechSupported) window.speechSynthesis.cancel();
              onJumpToLive();
            }}
            className="flex-1 sm:flex-initial py-2.5 px-6 rounded-xl font-semibold text-sm bg-[#E11D48] hover:bg-[#BE123C] text-white transition-colors flex items-center justify-center gap-2"
          >
            <span>Jump to live match</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
