"use client";

import type { TitlePattern } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface TitlePatternsProps {
  patterns: TitlePattern[];
}

export default function TitlePatterns({ patterns }: TitlePatternsProps) {
  if (patterns.length === 0) return null;

  const maxAvg = Math.max(...patterns.map((p) => p.avgViews));

  return (
    <div className="space-y-2.5">
      {patterns.map((p, i) => {
        const pct = maxAvg > 0 ? (p.avgViews / maxAvg) * 100 : 0;
        const isTop = i === 0;
        return (
          <div key={p.pattern} className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] font-semibold"
                style={{ color: isTop ? "#60A5FA" : "var(--color-foreground)" }}
              >
                {p.pattern}
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono text-subtle">
                <span>{p.matchCount} videos</span>
                <span>{formatNumber(p.avgViews)} avg</span>
                <span>{p.avgEngagement.toFixed(1)}% eng</span>
              </div>
            </div>
            <div className="h-[8px] bg-surface rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max(pct, 3)}%`,
                  background: isTop
                    ? "#60A5FA"
                    : "var(--color-accent-blue)",
                  opacity: 0.6 + (pct / 100) * 0.4,
                }}
              />
            </div>
            <div className="text-[10px] text-[#9E9C97] leading-relaxed">
              {p.examples.slice(0, 2).map((ex, j) => (
                <div key={j} className="truncate">
                  &ldquo;{ex}&rdquo;
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
