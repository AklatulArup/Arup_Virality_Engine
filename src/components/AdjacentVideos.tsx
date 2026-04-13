"use client";

import type { AdjacentVideoContext } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";

interface AdjacentVideosProps {
  context: AdjacentVideoContext;
  currentTitle: string;
  currentViews: number;
  currentVRS: number;
}

export default function AdjacentVideos({
  context,
  currentTitle,
  currentViews,
  currentVRS,
}: AdjacentVideosProps) {
  const { before, after, lagBefore, lagAfter } = context;

  if (!before && !after) return null;

  return (
    <div className="bg-surface border border-border rounded-[10px] p-3.5">
      <div className="text-[9px] font-mono text-muted tracking-widest mb-3">
        UPLOAD TIMELINE CONTEXT
      </div>

      <div className="space-y-0">
        {/* Video Before */}
        {before ? (
          <div className="flex items-center gap-2.5 py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
            <div className="text-[9px] font-mono text-muted w-14 shrink-0 text-right">
              BEFORE
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-subtle truncate">{before.title}</div>
              <div className="text-[9px] text-muted">{formatDate(before.publishedAt)}</div>
            </div>
            <div className="text-[10px] font-mono shrink-0">{formatNumber(before.views)}</div>
            <div
              className="text-[10px] font-mono font-bold w-8 text-right shrink-0"
              style={{ color: getVRSColor(before.vrs.estimatedFullScore) }}
            >
              {before.vrs.estimatedFullScore}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
            <div className="text-[9px] font-mono text-muted w-14 shrink-0 text-right">BEFORE</div>
            <div className="text-[10px] text-border-light italic">No previous video on this channel</div>
          </div>
        )}

        {/* Lag indicator: before → current */}
        {lagBefore !== null && (
          <div className="flex items-center gap-2 pl-16 py-1">
            <div className="w-[1px] h-3 bg-border-light" />
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: lagBefore <= 7
                  ? "color-mix(in srgb, var(--color-vrs-excellent) 10%, transparent)"
                  : lagBefore <= 14
                    ? "color-mix(in srgb, var(--color-vrs-competitive) 10%, transparent)"
                    : "color-mix(in srgb, var(--color-vrs-rework) 10%, transparent)",
                color: lagBefore <= 7
                  ? "var(--color-vrs-excellent)"
                  : lagBefore <= 14
                    ? "var(--color-vrs-competitive)"
                    : "var(--color-vrs-rework)",
              }}
            >
              {lagBefore} day{lagBefore !== 1 ? "s" : ""} gap
            </span>
          </div>
        )}

        {/* Current Video (highlighted) */}
        <div
          className="flex items-center gap-2.5 py-2 border-b rounded"
          style={{
            borderColor: "rgba(139,92,246,0.08)",
            background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
          }}
        >
          <div className="text-[9px] font-mono w-14 shrink-0 text-right" style={{ color: "var(--color-accent)" }}>
            THIS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold truncate">{currentTitle}</div>
          </div>
          <div className="text-[10px] font-mono font-bold shrink-0">{formatNumber(currentViews)}</div>
          <div
            className="text-[10px] font-mono font-bold w-8 text-right shrink-0"
            style={{ color: getVRSColor(currentVRS) }}
          >
            {currentVRS}
          </div>
        </div>

        {/* Lag indicator: current → after */}
        {lagAfter !== null && (
          <div className="flex items-center gap-2 pl-16 py-1">
            <div className="w-[1px] h-3 bg-border-light" />
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: lagAfter <= 7
                  ? "color-mix(in srgb, var(--color-vrs-excellent) 10%, transparent)"
                  : lagAfter <= 14
                    ? "color-mix(in srgb, var(--color-vrs-competitive) 10%, transparent)"
                    : "color-mix(in srgb, var(--color-vrs-rework) 10%, transparent)",
                color: lagAfter <= 7
                  ? "var(--color-vrs-excellent)"
                  : lagAfter <= 14
                    ? "var(--color-vrs-competitive)"
                    : "var(--color-vrs-rework)",
              }}
            >
              {lagAfter} day{lagAfter !== 1 ? "s" : ""} gap
            </span>
          </div>
        )}

        {/* Video After */}
        {after ? (
          <div className="flex items-center gap-2.5 py-2">
            <div className="text-[9px] font-mono text-muted w-14 shrink-0 text-right">
              AFTER
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-subtle truncate">{after.title}</div>
              <div className="text-[9px] text-muted">{formatDate(after.publishedAt)}</div>
            </div>
            <div className="text-[10px] font-mono shrink-0">{formatNumber(after.views)}</div>
            <div
              className="text-[10px] font-mono font-bold w-8 text-right shrink-0"
              style={{ color: getVRSColor(after.vrs.estimatedFullScore) }}
            >
              {after.vrs.estimatedFullScore}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 py-2">
            <div className="text-[9px] font-mono text-muted w-14 shrink-0 text-right">AFTER</div>
            <div className="text-[10px] text-border-light italic">No video uploaded after this yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
