"use client";

import { useState } from "react";
import type { ModeId } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface ClaudePromptProps {
  url: string;
  activeModes: ModeId[];
  channelName: string;
  channelSubs: number;
  channelMedian: number;
  videoViews: number;
  videoVelocity: number;
  videoEngagement: number;
  isOutlier: boolean;
  vrsScore: number;
}

export default function ClaudePrompt({
  url,
  activeModes,
  channelName,
  channelSubs,
  channelMedian,
  videoViews,
  videoVelocity,
  videoEngagement,
  isOutlier,
  vrsScore,
}: ClaudePromptProps) {
  const [copied, setCopied] = useState(false);

  const prompt = [
    `Analyze this video: ${url}`,
    `Run modes: ${activeModes.join(", ")}`,
    `Include full weighted VRS with tier breakdown, gap analysis, and viral archetype match.`,
    `Creator: ${channelName}, ${formatNumber(channelSubs)} subs, channel median ${formatNumber(channelMedian)} views.`,
    `This video: ${formatNumber(videoViews)} views, ${formatNumber(videoVelocity)}/day velocity, ${videoEngagement.toFixed(1)}% engagement. Auto-VRS: ${vrsScore}%.${isOutlier ? " OUTLIER." : ""}`,
    `Score ALL 20 VRS criteria including hidden ones (hook, retention, thumbnail, CTR, etc.) based on your qualitative review.`,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard?.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-[10px] p-3.5 border cursor-pointer transition-all"
      style={{
        background: "rgba(0,212,170,0.03)",
        borderColor: "rgba(0,212,170,0.12)",
      }}
      onClick={handleCopy}
    >
      <div className="text-[9px] font-mono tracking-widest mb-1.5" style={{ color: "#60A5FA" }}>
        &#x1F4CB; COPY TO CLAUDE FOR FULL ANALYSIS
      </div>
      <div
        className="text-[11px] text-subtle font-mono rounded-md p-2.5 leading-relaxed break-all"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        Analyze: {url}
        <br />
        Modes: {activeModes.join(", ")}
        <br />
        Creator: {channelName}, {formatNumber(channelSubs)} subs, median{" "}
        {formatNumber(channelMedian)}
        <br />
        Video: {formatNumber(videoViews)} views, {formatNumber(videoVelocity)}
        /d, {videoEngagement.toFixed(1)}% eng, VRS {vrsScore}%
        {isOutlier ? " · OUTLIER" : ""}
      </div>
      <div
        className="text-[8px] mt-1"
        style={{ color: copied ? "var(--color-vrs-excellent)" : "#60A5FA" }}
      >
        {copied ? "Copied!" : "Click to copy"}
      </div>
    </div>
  );
}
