"use client";

import type { MonthlyProjection } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface SixMonthTimelineProps {
  projections: MonthlyProjection[];
  currentViews?: number;
}

export default function SixMonthTimeline({
  projections,
  currentViews,
}: SixMonthTimelineProps) {
  if (projections.length === 0) return null;

  const maxHigh = Math.max(...projections.map((p) => p.highViews));
  const scale = maxHigh > 0 ? maxHigh : 1;

  return (
    <div className="space-y-3">
      <div className="text-[9px] text-[#9E9C97] font-mono tracking-widest">
        6-MONTH VIEW PROJECTION
      </div>

      {/* Timeline bars */}
      <div className="space-y-2">
        {/* Current baseline */}
        {currentViews !== undefined && currentViews > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 text-[9px] text-[#9E9C97] font-mono text-right shrink-0">
              Now
            </div>
            <div className="flex-1 relative h-5">
              <div
                className="absolute top-0 left-0 h-full rounded-sm"
                style={{
                  width: `${Math.max((currentViews / scale) * 100, 2)}%`,
                  background: "rgba(255,255,255,0.1)",
                }}
              />
              <div className="absolute top-0 left-0 h-full flex items-center pl-1.5">
                <span className="text-[9px] font-mono text-[#9E9C97]">
                  {formatNumber(currentViews)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly projections */}
        {projections.map((p) => {
          const avgPct = Math.max((p.avgViews / scale) * 100, 2);
          const highPct = Math.max((p.highViews / scale) * 100, 2);

          return (
            <div key={p.month} className="flex items-center gap-2">
              <div className="w-16 text-[9px] text-[#9E9C97] font-mono text-right shrink-0">
                {p.label}
              </div>
              <div className="flex-1 relative h-5">
                {/* High trajectory (background) */}
                <div
                  className="absolute top-0 left-0 h-full rounded-sm"
                  style={{
                    width: `${highPct}%`,
                    background:
                      "linear-gradient(90deg, color-mix(in srgb, var(--color-vrs-excellent) 10%, transparent), color-mix(in srgb, var(--color-vrs-excellent) 20%, transparent))",
                    borderRight: "1px dashed color-mix(in srgb, var(--color-vrs-excellent) 40%, transparent)",
                  }}
                />
                {/* Average trajectory (foreground) */}
                <div
                  className="absolute top-0 left-0 h-full rounded-sm"
                  style={{
                    width: `${avgPct}%`,
                    background:
                      "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-blue) 20%, transparent), color-mix(in srgb, var(--color-accent-blue) 35%, transparent))",
                  }}
                />
                {/* Labels */}
                <div className="absolute top-0 left-0 h-full flex items-center justify-between w-full px-1.5">
                  <span
                    className="text-[9px] font-mono font-bold"
                    style={{ color: "var(--color-accent-blue)" }}
                  >
                    {formatNumber(p.avgViews)}
                  </span>
                  {p.highViews > p.avgViews * 1.3 && (
                    <span
                      className="text-[9px] font-mono"
                      style={{ color: "var(--color-vrs-excellent)", opacity: 0.7 }}
                    >
                      {formatNumber(p.highViews)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[8px] text-[#9E9C97]">
        <span>
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle"
            style={{ background: "color-mix(in srgb, var(--color-accent-blue) 35%, transparent)" }}
          />
          Average trajectory
        </span>
        <span>
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle"
            style={{
              background: "color-mix(in srgb, var(--color-vrs-excellent) 20%, transparent)",
              borderRight: "1px dashed color-mix(in srgb, var(--color-vrs-excellent) 40%, transparent)",
            }}
          />
          Highest possible
        </span>
      </div>
    </div>
  );
}
