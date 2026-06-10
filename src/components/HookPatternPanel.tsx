"use client";

import type { HookPatternLibrary } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface HookPatternPanelProps {
  library: HookPatternLibrary;
}

export default function HookPatternPanel({ library }: HookPatternPanelProps) {
  if (library.patterns.length === 0) return null;

  const maxViews = Math.max(...library.patterns.map((p) => p.avgViews), 1);

  return (
    <CollapsibleSection
      title="Hook Pattern Library"
      subtitle={`${library.patterns.length} patterns \u00b7 ${library.totalVideosAnalyzed} videos \u00b7 Best: ${library.bestPattern}`}
      accentColor="#60A5FA"
    >
      <div className="space-y-3">
        {library.patterns.map((pattern) => {
          const isBest = pattern.pattern === library.bestPattern;
          return (
            <div key={pattern.pattern} className="py-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold">{pattern.pattern}</span>
                  {isBest && (
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ background: "rgba(0,229,160,0.08)", color: "var(--color-vrs-excellent)" }}>
                      TOP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[8px] font-mono text-[#9E9C97]">{pattern.videoCount} videos</span>
                  <span className="text-[9px] font-mono font-bold">{formatNumber(pattern.avgViews)} avg</span>
                  {pattern.outlierRate > 0 && (
                    <span className="text-[8px] font-mono" style={{ color: "var(--color-vrs-excellent)" }}>
                      {pattern.outlierRate}% outlier
                    </span>
                  )}
                </div>
              </div>

              {/* View bar */}
              <div className="h-1.5 rounded-sm overflow-hidden bg-background mb-1.5">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(pattern.avgViews / maxViews) * 100}%`,
                    background: isBest ? "var(--color-vrs-excellent)" : "#60A5FA",
                    opacity: 0.5,
                  }}
                />
              </div>

              {/* Examples */}
              {pattern.examples.length > 0 && (
                <div className="mb-1">
                  {pattern.examples.slice(0, 2).map((ex, i) => (
                    <div key={i} className="text-[8px] text-[#9E9C97] truncate">&ldquo;{ex}&rdquo;</div>
                  ))}
                </div>
              )}

              {/* Templates */}
              <div className="flex flex-wrap gap-1">
                {pattern.templates.map((t, i) => (
                  <span key={i} className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-border text-subtle">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
