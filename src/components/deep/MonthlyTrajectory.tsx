"use client";

import type { MonthlyBucket } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface MonthlyTrajectoryProps {
  buckets: MonthlyBucket[];
}

export default function MonthlyTrajectory({ buckets }: MonthlyTrajectoryProps) {
  if (buckets.length === 0) return null;

  const maxAvg = Math.max(...buckets.map((b) => b.avgViews));

  return (
    <div className="space-y-2">
      {buckets.map((b) => {
        const pct = maxAvg > 0 ? (b.avgViews / maxAvg) * 100 : 0;
        return (
          <div key={b.month} className="flex items-center gap-3">
            <div className="w-[72px] text-[11px] text-subtle font-mono shrink-0">
              {b.label}
            </div>
            <div className="flex-1 h-[22px] bg-surface rounded overflow-hidden relative">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: `linear-gradient(90deg, #60A5FA, var(--color-accent-blue))`,
                  opacity: 0.7 + (pct / 100) * 0.3,
                }}
              />
              <div className="absolute inset-0 flex items-center px-2 justify-between">
                <span className="text-[10px] font-mono font-bold text-white/90">
                  {formatNumber(b.avgViews)}/vid
                </span>
                <span className="text-[9px] font-mono text-white/50">
                  {b.videoCount}v &middot; {formatNumber(b.totalViews)} total
                </span>
              </div>
            </div>
            <div className="w-[50px] text-[10px] text-[#9E9C97] font-mono text-right shrink-0">
              {b.avgEngagement.toFixed(1)}%
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[9px] text-border-light mt-1 px-[72px]">
        <span>Avg views/video</span>
        <span>Engagement</span>
      </div>
    </div>
  );
}
