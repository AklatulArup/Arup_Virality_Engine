"use client";

import type { ArchetypePerformance } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface ArchetypeMatrixProps {
  performance: ArchetypePerformance[];
}

export default function ArchetypeMatrix({ performance }: ArchetypeMatrixProps) {
  if (performance.length === 0) return null;

  const maxAvg = Math.max(...performance.map((p) => p.avgViews));

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-[9px] text-border-light font-mono px-1 pb-1">
        <div className="w-[160px]">ARCHETYPE</div>
        <div className="flex-1">AVG VIEWS</div>
        <div className="w-[40px] text-center">VRS</div>
        <div className="w-[40px] text-center">ENG%</div>
        <div className="w-[24px] text-center">N</div>
        <div className="w-[24px] text-center">OUT</div>
      </div>

      {performance.map((p, i) => {
        const pct = maxAvg > 0 ? (p.avgViews / maxAvg) * 100 : 0;
        const isTop = i === 0;
        return (
          <div
            key={p.archetypeId}
            className="flex items-center gap-2 py-1.5 px-1 rounded"
            style={{
              background: isTop
                ? "color-mix(in srgb, #60A5FA 8%, transparent)"
                : undefined,
            }}
          >
            <div
              className="w-[160px] text-[11px] font-medium truncate"
              style={{ color: isTop ? "#60A5FA" : "var(--color-foreground)" }}
            >
              {p.label}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-[14px] bg-surface rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    background: isTop
                      ? "#60A5FA"
                      : "var(--color-accent-blue)",
                    opacity: 0.5 + (pct / 100) * 0.5,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono w-[48px] text-right">
                {formatNumber(p.avgViews)}
              </span>
            </div>
            <div className="w-[40px] text-[11px] font-mono text-center text-subtle">
              {p.avgVRS}
            </div>
            <div className="w-[40px] text-[11px] font-mono text-center text-subtle">
              {p.avgEngagement.toFixed(1)}
            </div>
            <div className="w-[24px] text-[11px] font-mono text-center text-[#9E9C97]">
              {p.videoCount}
            </div>
            <div
              className="w-[24px] text-[11px] font-mono text-center"
              style={{
                color:
                  p.outlierCount > 0
                    ? "var(--color-vrs-excellent)"
                    : "var(--color-text-[#9E9C97])",
              }}
            >
              {p.outlierCount}
            </div>
          </div>
        );
      })}

      {performance[0]?.bestVideo && (
        <div className="text-[10px] text-[#9E9C97] mt-2 px-1">
          Top performer: &ldquo;{performance[0].bestVideo.title}&rdquo; ({formatNumber(performance[0].bestVideo.views)} views)
        </div>
      )}
    </div>
  );
}
