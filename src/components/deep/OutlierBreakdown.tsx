"use client";

import Image from "next/image";
import type { OutlierInsight } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface OutlierBreakdownProps {
  insights: OutlierInsight[];
}

export default function OutlierBreakdown({ insights }: OutlierBreakdownProps) {
  if (insights.length === 0) {
    return (
      <div className="text-[11px] text-[#9E9C97] text-center py-4">
        No outliers detected (no video reached 3x the channel median).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((oi) => (
        <div
          key={oi.video.id}
          className="rounded-lg border border-border overflow-hidden"
        >
          {/* Video header */}
          <div className="flex gap-3 p-3 bg-surface">
            {oi.video.thumbnail && (
              <Image
                src={oi.video.thumbnail}
                alt={oi.video.title}
                width={120}
                height={68}
                className="rounded object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold leading-tight truncate">
                {oi.video.title}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-subtle">
                <span style={{ color: "var(--color-vrs-excellent)" }}>
                  {formatNumber(oi.video.views)} views
                </span>
                <span>&middot;</span>
                <span>{oi.video.engagement.toFixed(1)}% eng</span>
                <span>&middot;</span>
                <span>{oi.video.duration}</span>
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {oi.archetypes.map((a) => (
                  <span
                    key={a}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "color-mix(in srgb, var(--color-accent-blue) 15%, transparent)",
                      color: "var(--color-accent-blue)",
                    }}
                  >
                    {a}
                  </span>
                ))}
                {oi.titlePatterns.map((p) => (
                  <span
                    key={p}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "color-mix(in srgb, var(--color-mode-e) 15%, transparent)",
                      color: "var(--color-mode-e)",
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="text-[9px] text-[#9E9C97] mt-1">{oi.timingNote}</div>
            </div>
          </div>

          {/* Reasons */}
          <div className="px-3 py-2.5 space-y-2">
            {oi.reasons.map((reason, i) => (
              <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-[#60A5FA] shrink-0 mt-0.5">&#9656;</span>
                <span className="text-subtle">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
