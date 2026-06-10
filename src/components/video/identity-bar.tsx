"use client";

// Z0 — identity bar: thumbnail, title, creator link, platform, age, views.

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { EnrichedVideo } from "@/lib/types";
import type { Platform } from "@/lib/forecast";
import { PlatformBadge } from "@/components/layout/platform-meta";
import { formatNumber } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

export function IdentityBar({
  video,
  platform,
  sourceUrl,
  onReanalyze,
}: {
  video: EnrichedVideo;
  platform: Platform;
  sourceUrl: string;
  onReanalyze: () => void;
}) {
  const creatorHref = `/creators/${platform === "youtube_short" ? "youtube" : platform}/${encodeURIComponent(
    (video.channelId || video.channel || "").replace(/^@/, ""),
  )}`;

  return (
    <div className="flex items-center gap-4 border-b border-border pb-5">
      {video.thumbnail ? (
        <img
          src={video.thumbnail}
          alt=""
          className="h-16 w-28 shrink-0 rounded-[6px] border border-border object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={platform} />
          <span className="font-mono text-[11px] text-muted-foreground">
            {video.days === 0 ? "Posted today" : `Posted ${video.days}d ago`} · {formatNumber(video.views)} views now
          </span>
        </div>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-[16px] font-semibold text-foreground hover:text-primary"
        >
          {video.title}
        </a>
        <Link href={creatorHref} className="mt-0.5 inline-block text-[12.5px] text-muted-foreground hover:text-foreground">
          {video.channel} →
        </Link>
      </div>
      <Button variant="outline" size="sm" onClick={onReanalyze} className="shrink-0 gap-1.5">
        <RotateCw className="size-3.5" />
        Re-analyze
      </Button>
    </div>
  );
}
