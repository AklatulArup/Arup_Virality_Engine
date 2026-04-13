"use client";

import type { EnrichedVideo } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import { detectArchetypes, getArchetype } from "@/lib/archetypes";

interface TikTokVideoCardProps {
  video: EnrichedVideo;
  rank?: number;
}

export default function TikTokVideoCard({ video, rank }: TikTokVideoCardProps) {
  const archetypes = detectArchetypes(video.title, video.tags);
  const trsColor = getVRSColor(video.vrs.estimatedFullScore);
  const shareRate = video.views > 0 ? ((video.shares ?? 0) / video.views) * 100 : 0;
  const saveRate = video.views > 0 ? ((video.saves ?? 0) / video.views) * 100 : 0;

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-start gap-2.5">
        {/* Rank */}
        {rank !== undefined && (
          <div
            className="text-[13px] font-extrabold font-mono w-6 text-center shrink-0"
            style={{ color: rank <= 3 ? "var(--color-vrs-excellent)" : "var(--color-text-muted)" }}
          >
            #{rank}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Caption */}
          <div className="text-[11px] text-subtle line-clamp-2 mb-1.5">
            {video.title}
          </div>

          {/* Creator + date */}
          <div className="text-[9px] text-muted mb-2">
            @{video.channel} &middot; {video.duration}
          </div>

          {/* Metrics row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono">
            <span>
              <span className="text-muted">Views </span>
              <span className="font-bold">{formatNumber(video.views)}</span>
            </span>
            <span>
              <span className="text-muted">Likes </span>
              <span className="font-bold">{formatNumber(video.likes)}</span>
            </span>
            <span>
              <span className="text-muted">Comments </span>
              <span className="font-bold">{formatNumber(video.comments)}</span>
            </span>
            <span>
              <span className="text-muted">Shares </span>
              <span className="font-bold" style={{ color: shareRate >= 1 ? "var(--color-vrs-excellent)" : shareRate >= 0.3 ? "var(--color-vrs-competitive)" : undefined }}>
                {formatNumber(video.shares ?? 0)}
              </span>
            </span>
            <span>
              <span className="text-muted">Saves </span>
              <span className="font-bold" style={{ color: saveRate >= 0.5 ? "var(--color-vrs-excellent)" : saveRate >= 0.2 ? "var(--color-vrs-competitive)" : undefined }}>
                {formatNumber(video.saves ?? 0)}
              </span>
            </span>
          </div>

          {/* Rate indicators */}
          <div className="flex gap-3 mt-1.5 text-[9px] font-mono text-muted">
            <span>
              Share rate:{" "}
              <span style={{ color: shareRate >= 1 ? "var(--color-vrs-excellent)" : shareRate >= 0.3 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)" }}>
                {shareRate.toFixed(2)}%
              </span>
            </span>
            <span>
              Save rate:{" "}
              <span style={{ color: saveRate >= 0.5 ? "var(--color-vrs-excellent)" : saveRate >= 0.2 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)" }}>
                {saveRate.toFixed(2)}%
              </span>
            </span>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {archetypes.map((a) => {
              const arch = getArchetype(a);
              return arch ? (
                <span
                  key={a}
                  className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(139,92,246,0.07)",
                    color: "var(--color-text-subtle)",
                  }}
                >
                  {arch.label}
                </span>
              ) : null;
            })}
            {video.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* TRS score */}
        <div className="text-center shrink-0">
          <div
            className="text-[18px] font-extrabold font-mono"
            style={{ color: trsColor }}
          >
            {video.vrs.estimatedFullScore}
          </div>
          <div className="text-[7px] text-muted font-mono">TRS</div>
        </div>
      </div>
    </div>
  );
}
