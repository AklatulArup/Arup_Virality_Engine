"use client";

import type { Recommendation } from "@/lib/types";

interface RecommendationsProps {
  recommendations: Recommendation[];
}

const PRIORITY_STYLES: Record<
  string,
  { border: string; bg: string; label: string; labelColor: string }
> = {
  high: {
    border: "var(--color-vrs-excellent)",
    bg: "color-mix(in srgb, var(--color-vrs-excellent) 5%, transparent)",
    label: "HIGH",
    labelColor: "var(--color-vrs-excellent)",
  },
  medium: {
    border: "var(--color-vrs-competitive)",
    bg: "color-mix(in srgb, var(--color-vrs-competitive) 5%, transparent)",
    label: "MED",
    labelColor: "var(--color-vrs-competitive)",
  },
  low: {
    border: "var(--color-text-[#9E9C97])",
    bg: "transparent",
    label: "LOW",
    labelColor: "var(--color-text-[#9E9C97])",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  content: "#60A5FA",
  title: "var(--color-accent-blue)",
  timing: "var(--color-mode-e)",
  format: "var(--color-mode-c)",
  platform: "var(--color-mode-d)",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  "youtube-shorts": "Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
};

export default function Recommendations({
  recommendations,
}: RecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-[11px] text-[#9E9C97] text-center py-4">
        Not enough data to generate recommendations. Analyze more videos.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {recommendations.map((rec, i) => {
        const style = PRIORITY_STYLES[rec.priority];
        return (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{
              borderLeft: `3px solid ${style.border}`,
              background: style.bg,
            }}
          >
            <div className="flex items-start gap-2">
              <div className="flex gap-1.5 shrink-0 mt-0.5">
                <span
                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: style.labelColor,
                    background: `color-mix(in srgb, ${style.labelColor} 15%, transparent)`,
                  }}
                >
                  {style.label}
                </span>
                <span
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: CATEGORY_COLORS[rec.category] || "var(--color-text-subtle)",
                    background: `color-mix(in srgb, ${CATEGORY_COLORS[rec.category] || "var(--color-text-subtle)"} 12%, transparent)`,
                  }}
                >
                  {rec.category.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-[12px] leading-relaxed">{rec.text}</div>
                <div className="text-[10px] text-[#9E9C97] mt-1.5 leading-relaxed">
                  {rec.evidence}
                </div>
                {rec.platformContext && rec.platformContext.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {rec.platformContext.map((p) => (
                      <span
                        key={p}
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "color-mix(in srgb, var(--color-mode-b) 12%, transparent)",
                          color: "var(--color-mode-b)",
                        }}
                      >
                        {PLATFORM_LABELS[p] || p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
