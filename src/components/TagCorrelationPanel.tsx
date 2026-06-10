"use client";

import type { TagCorrelationResult } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface TagCorrelationPanelProps {
  result: TagCorrelationResult;
}

export default function TagCorrelationPanel({ result }: TagCorrelationPanelProps) {
  if (result.topTags.length === 0) return null;

  const maxViews = Math.max(...result.topTags.map((t) => t.avgViews), 1);

  return (
    <CollapsibleSection
      title="Tag Performance Correlation"
      subtitle={`${result.totalTagsAnalyzed} tags across ${result.totalVideosAnalyzed} videos`}
      accentColor="#60A5FA"
    >
      {/* Top performing tags */}
      <div className="mb-3">
        <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">HIGH-PERFORMING TAGS</div>
        {result.topTags.slice(0, 10).map((tag) => (
          <div key={tag.tag} className="flex items-center gap-2 py-1">
            <span className="text-[9px] font-mono text-subtle w-28 truncate shrink-0">{tag.tag}</span>
            <div className="flex-1 h-1.5 rounded-sm overflow-hidden bg-background">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(tag.avgViews / maxViews) * 100}%`,
                  background: "var(--color-vrs-excellent)",
                  opacity: 0.5,
                }}
              />
            </div>
            <span className="text-[8px] font-mono w-14 text-right">{formatNumber(tag.avgViews)}</span>
            <span className="text-[8px] font-mono text-[#9E9C97] w-10 text-right">{tag.videoCount}x</span>
            {tag.outlierRate > 0 && (
              <span className="text-[7px] font-mono px-1 rounded" style={{ background: "rgba(0,229,160,0.08)", color: "var(--color-vrs-excellent)" }}>
                {tag.outlierRate}% outlier
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Outlier tags */}
      {result.outlierTags.length > 0 && (
        <div className="mb-3">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">OUTLIER-GENERATING TAGS</div>
          <div className="flex flex-wrap gap-1">
            {result.outlierTags.slice(0, 8).map((tag) => (
              <span key={tag.tag} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,229,160,0.06)", color: "var(--color-vrs-excellent)" }}>
                {tag.tag} ({tag.outlierRate}% outlier rate)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Underperforming tags */}
      {result.bottomTags.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">UNDERPERFORMING TAGS</div>
          <div className="flex flex-wrap gap-1">
            {result.bottomTags.slice(0, 6).map((tag) => (
              <span key={tag.tag} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,107,107,0.06)", color: "var(--color-vrs-rework)" }}>
                {tag.tag} ({formatNumber(tag.avgViews)} avg)
              </span>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
