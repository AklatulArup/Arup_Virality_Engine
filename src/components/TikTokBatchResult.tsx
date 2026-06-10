"use client";

import type { TikTokBatchAnalysis, ModeId } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import TikTokVideoCard from "./TikTokVideoCard";
import DeepAnalysisPanel from "./DeepAnalysisPanel";
import CollapsibleSection from "./CollapsibleSection";
import VRSScoreCard from "./VRSScoreCard";

interface TikTokBatchResultProps {
  result: TikTokBatchAnalysis;
  activeModes: ModeId[];
}

export default function TikTokBatchResult({
  result,
  activeModes,
}: TikTokBatchResultProps) {
  const { videos, deepAnalysis, topPerformers, competitorBreakdown } = result;

  const avgViews = Math.round(
    videos.reduce((s, v) => s + v.views, 0) / videos.length
  );
  const avgTRS = Math.round(
    videos.reduce((s, v) => s + v.vrs.estimatedFullScore, 0) / videos.length
  );
  const avgShares = Math.round(
    videos.reduce((s, v) => s + (v.shares ?? 0), 0) / videos.length
  );
  const totalViews = videos.reduce((s, v) => s + v.views, 0);

  // TRS distribution bands
  const bands = [
    { label: "90-100", min: 90, max: 100, color: "var(--color-vrs-excellent)" },
    { label: "75-89", min: 75, max: 89, color: "var(--color-vrs-strong)" },
    { label: "60-74", min: 60, max: 74, color: "var(--color-vrs-competitive)" },
    { label: "40-59", min: 40, max: 59, color: "var(--color-vrs-needs-work)" },
    { label: "0-39", min: 0, max: 39, color: "var(--color-vrs-rework)" },
  ];

  const bandCounts = bands.map((b) => ({
    ...b,
    count: videos.filter(
      (v) =>
        v.vrs.estimatedFullScore >= b.min && v.vrs.estimatedFullScore <= b.max
    ).length,
  }));

  const maxBandCount = Math.max(...bandCounts.map((b) => b.count), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Summary header */}
      <div className="bg-surface border border-border rounded-[10px] p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[16px]">📊</span>
          <div>
            <div className="text-[13px] font-bold">
              TikTok Batch Analysis
            </div>
            <div className="text-[10px] text-[#9E9C97]">
              {videos.length} videos analyzed &middot; {competitorBreakdown.length} creators
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-[9px] text-[#9E9C97] font-mono">TOTAL VIEWS</div>
            <div className="text-[15px] font-bold font-mono mt-0.5">
              {formatNumber(totalViews)}
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-[9px] text-[#9E9C97] font-mono">AVG VIEWS</div>
            <div className="text-[15px] font-bold font-mono mt-0.5">
              {formatNumber(avgViews)}
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-[9px] text-[#9E9C97] font-mono">AVG TRS</div>
            <div
              className="text-[15px] font-bold font-mono mt-0.5"
              style={{ color: getVRSColor(avgTRS) }}
            >
              {avgTRS}%
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 text-center">
            <div className="text-[9px] text-[#9E9C97] font-mono">AVG SHARES</div>
            <div className="text-[15px] font-bold font-mono mt-0.5">
              {formatNumber(avgShares)}
            </div>
          </div>
        </div>
      </div>

      {/* TRS Distribution */}
      <CollapsibleSection
        title="TRS Score Distribution"
        subtitle={`Across ${videos.length} videos`}
        accentColor="#60A5FA"
      >
        <div className="space-y-1.5">
          {bandCounts.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <div className="w-12 text-[9px] font-mono text-[#9E9C97] text-right">
                {b.label}
              </div>
              <div className="flex-1 h-4 rounded-sm overflow-hidden bg-background">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${(b.count / maxBandCount) * 100}%`,
                    background: b.color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <div className="w-8 text-[10px] font-mono font-bold text-right">
                {b.count}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Competitor Breakdown */}
      {competitorBreakdown.length > 1 && (
        <CollapsibleSection
          title="Competitor Breakdown"
          subtitle={`${competitorBreakdown.length} creators compared`}
          accentColor="var(--color-mode-c)"
        >
          <div className="space-y-1">
            {competitorBreakdown.map((c) => (
              <div
                key={c.handle}
                className="flex items-center gap-2 py-1.5 border-b"
                style={{ borderColor: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex-1 text-[11px] font-mono">
                  @{c.handle}
                </div>
                <div className="text-[10px] font-mono text-[#9E9C97]">
                  {c.videoCount} videos
                </div>
                <div className="text-[10px] font-mono font-bold">
                  {formatNumber(c.avgViews)} avg
                </div>
                <div
                  className="text-[10px] font-mono font-bold w-10 text-right"
                  style={{ color: getVRSColor(c.avgScore) }}
                >
                  {c.avgScore}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Top Performers */}
      <CollapsibleSection
        title="Top Performers"
        subtitle={`${topPerformers.length} highest-performing videos`}
        accentColor="var(--color-vrs-excellent)"
        defaultOpen
      >
        <div className="space-y-2">
          {topPerformers.slice(0, 10).map((v, i) => (
            <TikTokVideoCard key={v.id} video={v} rank={i + 1} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Top performer TRS detail */}
      {topPerformers[0] && activeModes.includes("G") && (
        <VRSScoreCard vrs={topPerformers[0].vrs} label="TRS" />
      )}

      {/* Deep Analysis */}
      {deepAnalysis && (
        <DeepAnalysisPanel
          analysis={deepAnalysis}
          channelName="TikTok Batch"
        />
      )}
    </div>
  );
}
