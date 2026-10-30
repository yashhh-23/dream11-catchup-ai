"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta, RecapPayload } from "@/types";
import { WinProbChart } from "@/components/charts/WinProbChart";
import {
  Volume2,
  VolumeX,
  Play,
  ArrowLeft,
  Flame,
  TrendingDown,
  TrendingUp,
  Award,
  Zap,
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

    const narrationText = `${recap.oneLiner}. Here is the story: ${recap.story}. Current match mood: ${recap.mood}.`;
    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.rate = 1.05; // natural energetic tempo
    utterance.pitch = 1.0;

    // Pick English (Indian) or standard English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.lang.includes("en-GB") || v.lang.includes("en-US")
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const getMoodBadgeClass = (mood: RecapPayload["mood"]) => {
    switch (mood) {
      case "Cruising":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400";
      case "Knife's edge":
        return "bg-rose-500/15 border-rose-500/40 text-rose-400";
      case "Chasing hard":
        return "bg-amber-500/15 border-amber-500/40 text-amber-400";
      case "Comeback on":
        return "bg-cyan-500/15 border-cyan-500/40 text-cyan-400";
      default:
        return "bg-slate-700/50 border-slate-600 text-slate-300";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-fadeIn pb-24">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => {
            if (isSpeechSupported) window.speechSynthesis.cancel();
            onBackToGate();
          }}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors px-2 py-1 rounded bg-slate-800/60 border border-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Adjust Window</span>
        </button>

        <div className="text-right">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            {recap.oversCovered}
          </span>
          <div className="text-xs font-semibold text-rose-400">Rhea AI Delta Recap</div>
        </div>
      </div>

      {/* Main Narrative Card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl mb-5">
        {/* Mood and Headline */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div
            className={`px-3 py-1 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 ${getMoodBadgeClass(
              recap.mood
            )}`}
          >
            <span>{recap.moodEmoji}</span>
            <span>Mood: {recap.mood}</span>
          </div>

          {/* Voice Narration Button */}
          {isSpeechSupported && (
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`text-xs px-3 py-1 rounded-full border font-semibold flex items-center gap-1.5 transition-all ${
                isPlayingAudio
                  ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-950 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Pause AI Voice</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Listen Recap (Audio)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Catch-up One Liner */}
        <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug mb-3">
          &ldquo;{recap.oneLiner}&rdquo;
        </h2>

        {/* Narrative Story */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans mb-3">
          {recap.story}
        </div>

        {/* Partnership / Phase Summary Bar */}
        {recap.partnershipSummary && (
          <div className="text-[11px] text-slate-400 font-mono bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{recap.partnershipSummary}</span>
          </div>
        )}
      </div>

      {/* Win Probability Curve Chart */}
      <div className="mb-6">
        <WinProbChart
          balls={balls}
          missedFromOver={missedFromOver}
          missedToOver={missedToOver}
          topMoments={recap.top3Moments}
        />
      </div>

      {/* Top 3 High-Leverage Turning Points */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Top 3 High-Leverage Turning Points</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Ranked by Win-Prob Swing</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {recap.top3Moments.map((moment, idx) => {
            const isWicket = moment.label === "WICKET";
            const isSix = moment.label === "SIX";
            const swingPercent = Math.round(moment.swingDelta * 100);

            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all hover:bg-slate-800/50"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      Over {moment.over}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        isWicket
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : isSix
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {moment.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {moment.player}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                    {moment.winProbAfter > moment.winProbBefore ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span
                      className={
                        moment.winProbAfter > moment.winProbBefore
                          ? "text-emerald-400 font-bold"
                          : "text-rose-400 font-bold"
                      }
                    >
                      {swingPercent}% swing
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 mb-1 leading-normal">
                  {moment.description}
                </div>
                <div className="text-[11px] text-slate-400 italic">
                  💡 {moment.impact}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Sticky Bottom CTA to Jump into Live */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent backdrop-blur-md z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden sm:block text-xs text-slate-400">
            <span>Ready for the live action?</span>
            <div className="font-semibold text-slate-200">Over {meta.currentLiveOver} in progress</div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isSpeechSupported) window.speechSynthesis.cancel();
              onJumpToLive();
            }}
            className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl shadow-rose-950/80 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-current text-white" />
            <span>JUMP TO LIVE MATCH (OVER {meta.currentLiveOver})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
