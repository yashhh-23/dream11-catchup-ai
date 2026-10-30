"use client";

import React, { useState, useEffect } from "react";
import { Ball, MatchMeta, RecapPayload } from "@/types";
import { WinProbChart } from "@/components/charts/WinProbChart";
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  TrendingDown,
  TrendingUp,
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

    const narrationText = `${cleanHeadline}. ${recap.story}`;
    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.rate = 1.05;

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

  // Strip quotation marks from headline so it reads like a commentator headline
  const cleanHeadline = recap.oneLiner
    .replace(/^["'“‘]+/, "")
    .replace(/["'”’]+$/, "")
    .trim();

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 pb-28">
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

        <div className="text-xs text-slate-400">
          Recap · {recap.oversCovered}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#161B22] border border-[#262C36] rounded-xl p-5 sm:p-6 space-y-6">
        {/* Narrative Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Match state
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
                    <span>Listen (Audio)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Commentator Headline (No quotes) */}
          <h2 className="text-base sm:text-lg font-semibold text-[#F0F6FC] leading-snug">
            {cleanHeadline}
          </h2>

          {/* Story Paragraph */}
          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            {recap.story}
          </p>
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

        {/* Key Moments Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-300">
            Key moments
          </h3>

          <div className="space-y-2.5">
            {recap.top3Moments.map((moment, idx) => {
              const isWicket = moment.label === "WICKET";
              const isSix = moment.label === "SIX";
              const isFour = moment.label === "BOUNDARY";
              const swingVal = Math.round(moment.swingDelta * 100);
              const isPositive = moment.winProbAfter > moment.winProbBefore;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#0E1116] border border-[#262C36] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">
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

                  {/* Bold Swing Number on Right */}
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
              );
            })}
          </div>
        </div>
      </div>

      {/* Flat Sticky Bottom Bar (No glow) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0E1116]/95 border-t border-[#262C36] backdrop-blur-sm z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-slate-300">
            <span>Over {meta.currentLiveOver} in progress</span>
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
