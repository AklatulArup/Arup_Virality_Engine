"use client";

import type { NicheRanking } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import CollapsibleSection from "./CollapsibleSection";

interface NicheRankingPanelProps {
  ranking: NicheRanking;
}

export default function NicheRankingPanel({ ranking }: NicheRankingPanelProps) {
  return (
    <CollapsibleSection
      title="Niche Competitive Ranking"
      subtitle={`Ranked against ${ranking.totalNicheVideos} forex/trading videos in reference pool`}
      accentColor="var(--color-mode-c)"
      defaultOpen
    >
      <div className="space-y-3">
        {/* Rank cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-background rounded-lg p-2.5 text-center">
            <div className="text-[8px] text-[#9E9C97] font-mono">VIEWS RANK</div>
            <div className="text-[20px] font-extrabold font-mono" style={{ color: ranking.percentileViews >= 75 ? "var(--color-vrs-excellent)" : ranking.percentileViews >= 50 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)" }}>
              #{ranking.rankByViews}
            </div>
            <div className="text-[8px] text-[#9E9C97] font-mono">
              of {ranking.totalNicheVideos} &middot; Top {100 - ranking.percentileViews}%
            </div>
          </div>
          <div className="bg-background rounded-lg p-2.5 text-center">
            <div className="text-[8px] text-[#9E9C97] font-mono">VRS RANK</div>
            <div className="text-[20px] font-extrabold font-mono" style={{ color: ranking.percentileVRS >= 75 ? "var(--color-vrs-excellent)" : ranking.percentileVRS >= 50 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)" }}>
              #{ranking.rankByVRS}
            </div>
            <div className="text-[8px] text-[#9E9C97] font-mono">
              of {ranking.totalNicheVideos} &middot; Top {100 - ranking.percentileVRS}%
            </div>
          </div>
          <div className="bg-background rounded-lg p-2.5 text-center">
            <div className="text-[8px] text-[#9E9C97] font-mono">ENGAGEMENT</div>
            <div className="text-[20px] font-extrabold font-mono" style={{ color: "#60A5FA" }}>
              #{ranking.rankByEngagement}
            </div>
            <div className="text-[8px] text-[#9E9C97] font-mono">
              of {ranking.totalNicheVideos}
            </div>
          </div>
        </div>

        {/* Percentile bar */}
        <div className="bg-background rounded-lg p-2.5">
          <div className="text-[9px] text-[#9E9C97] font-mono mb-1.5">VIEWS PERCENTILE</div>
          <div className="h-3 rounded-full overflow-hidden bg-surface relative">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${ranking.percentileViews}%`,
                background: ranking.percentileViews >= 75
                  ? "var(--color-vrs-excellent)"
                  : ranking.percentileViews >= 50
                    ? "var(--color-vrs-competitive)"
                    : "var(--color-vrs-needs-work)",
              }}
            />
            <div
              className="absolute top-0 h-full w-[2px] bg-white opacity-50"
              style={{ left: `${ranking.percentileViews}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-[#9E9C97] font-mono">
            <span>Bottom</span>
            <span style={{ color: "#60A5FA" }}>
              You: Top {Math.max(1, 100 - ranking.percentileViews)}%
            </span>
            <span>Top</span>
          </div>
        </div>

        {/* Language breakdown */}
        {ranking.languageRankings.length > 1 && (
          <div>
            <div className="text-[9px] text-[#9E9C97] font-mono tracking-widest mb-1.5">
              RANK BY LANGUAGE
            </div>
            <div className="space-y-1">
              {ranking.languageRankings.map((lr) => (
                <div
                  key={lr.language}
                  className="flex items-center justify-between py-1 border-b"
                  style={{ borderColor: "rgba(255,255,255,0.03)" }}
                >
                  <span className="text-[10px] font-mono">{lr.label}</span>
                  <span className="text-[10px] text-[#9E9C97] font-mono">
                    {lr.total} videos
                  </span>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{
                      color: lr.rank <= 3
                        ? "var(--color-vrs-excellent)"
                        : lr.rank <= lr.total * 0.25
                          ? "var(--color-vrs-competitive)"
                          : "var(--color-text-[#9E9C97])",
                    }}
                  >
                    #{lr.rank}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creator leaderboard */}
        {ranking.creatorRankings.length > 1 && (
          <div>
            <div className="text-[9px] text-[#9E9C97] font-mono tracking-widest mb-1.5">
              CREATOR LEADERBOARD (by avg views)
            </div>
            <div className="space-y-0.5">
              {ranking.creatorRankings.slice(0, 15).map((cr) => {
                const barWidth = ranking.creatorRankings[0]
                  ? (cr.avgViews / ranking.creatorRankings[0].avgViews) * 100
                  : 0;
                return (
                  <div key={cr.channelName} className="flex items-center gap-2 py-1">
                    <span
                      className="text-[10px] font-extrabold font-mono w-6 text-center shrink-0"
                      style={{
                        color: cr.rank <= 3
                          ? "var(--color-vrs-excellent)"
                          : "var(--color-text-[#9E9C97])",
                      }}
                    >
                      #{cr.rank}
                    </span>
                    <span className="text-[10px] font-mono truncate flex-1 min-w-0">
                      {cr.channelName}
                    </span>
                    <div className="w-24 h-2.5 rounded-sm overflow-hidden bg-background shrink-0">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${barWidth}%`,
                          background: cr.rank <= 3
                            ? "var(--color-vrs-excellent)"
                            : "#60A5FA",
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#9E9C97] w-12 text-right shrink-0">
                      {formatNumber(cr.avgViews)}
                    </span>
                    {cr.avgVRS > 0 && (
                      <span
                        className="text-[9px] font-mono font-bold w-8 text-right shrink-0"
                        style={{ color: getVRSColor(cr.avgVRS) }}
                      >
                        {cr.avgVRS}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
