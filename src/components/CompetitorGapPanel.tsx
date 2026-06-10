"use client";

import type { CompetitorGapMatrix } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import CollapsibleSection from "./CollapsibleSection";

interface CompetitorGapPanelProps {
  matrix: CompetitorGapMatrix;
}

export default function CompetitorGapPanel({ matrix }: CompetitorGapPanelProps) {
  if (matrix.competitors.length === 0) return null;

  const maxViews = Math.max(...matrix.competitors.map((c) => c.avgViews), 1);

  return (
    <CollapsibleSection
      title="Competitor Influencer Content Gap"
      subtitle={`${matrix.competitors.length} rival prop firms \u00b7 ${matrix.missingFormats.length} content gaps \u00b7 Influencer performance comparison`}
      accentColor="var(--color-mode-e)"
    >
      {/* Competitor table */}
      <div className="space-y-2 mb-3">
        {matrix.competitors.slice(0, 8).map((comp) => (
          <div key={comp.competitorName} className="py-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold truncate mr-2">{comp.competitorName}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[9px] font-mono text-[#9E9C97]">{comp.totalVideos} videos</span>
                <span className="text-[9px] font-mono">{formatNumber(comp.avgViews)} avg</span>
                <span className="text-[9px] font-mono font-bold" style={{ color: getVRSColor(comp.avgVRS) }}>
                  {comp.avgVRS}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-sm overflow-hidden bg-background">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(comp.avgViews / maxViews) * 100}%`,
                  background: "var(--color-mode-e)",
                  opacity: 0.5,
                }}
              />
            </div>
            {comp.uniqueFormats.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {comp.uniqueFormats.map((f) => (
                  <span key={f} className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ background: "rgba(255,107,107,0.08)", color: "var(--color-vrs-rework)" }}>
                    gap: {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Missing formats */}
      {matrix.missingFormats.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">CONTENT GAPS</div>
          <div className="flex flex-wrap gap-1">
            {matrix.missingFormats.map((f) => (
              <span key={f} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-border text-subtle">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {matrix.opportunities.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">OPPORTUNITIES</div>
          {matrix.opportunities.map((o, i) => (
            <div key={i} className="text-[8px] text-subtle py-0.5">
              <span style={{ color: "var(--color-vrs-competitive)" }}>{"\u2192"}</span> {o}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
