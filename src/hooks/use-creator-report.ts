"use client";

// useCreatorReport — drives the Creator Report card. Reuses the same analyze
// pipeline as the Video Report (profile-shaped input), then derives
// creator-level stats: typical views, consistency, trend, breakout rate,
// engagement, cadence, reputation (home + cross-platform), niche, blocklist
// status, and any private analytics on file.

import { useEffect, useMemo, useState } from "react";
import type { ChannelData, EnrichedVideo, XPostData } from "@/lib/types";
import type { Platform, ManualInputs } from "@/lib/forecast";
import { useAnalyze } from "@/hooks/use-analyze";
import { usePool } from "@/hooks/use-pool";
import { xPostToEnrichedVideo } from "@/lib/x-adapter";
import { calculateMedian, detectTrend, calculateUploadFrequency, isOutlier } from "@/lib/baseline";
import { assessCreatorReputation } from "@/lib/reputation";
import { assessCrossPlatformReputation } from "@/lib/cross-platform-reputation";
import { classifyCreatorNiche } from "@/lib/niche-classifier";

export function profileInputFor(platform: Platform, handle: string): string {
  const h = handle.replace(/^@/, "");
  switch (platform) {
    case "youtube":
    case "youtube_short":
      return /^UC[\w-]{22}$/.test(h) ? `https://youtube.com/channel/${h}` : `@${h}`;
    case "tiktok":
      return `https://www.tiktok.com/@${h}`;
    case "instagram":
      return `https://www.instagram.com/${h}/`;
    case "x":
      return `https://x.com/${h}`;
  }
}

export function videoUrlFor(platform: Platform, v: EnrichedVideo): string {
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${v.id}`;
    case "youtube_short":
      return `https://www.youtube.com/shorts/${v.id}`;
    case "tiktok":
      return `https://www.tiktok.com/@${(v.channel || "").replace(/^@/, "")}/video/${v.id}`;
    case "instagram":
      return `https://www.instagram.com/reel/${v.id}/`;
    case "x":
      return `https://x.com/i/status/${v.id}`;
  }
}

function cvOf(views: number[]): number {
  if (views.length < 2) return 0;
  const mean = views.reduce((s, v) => s + v, 0) / views.length;
  if (mean === 0) return 0;
  const variance = views.reduce((s, v) => s + (v - mean) ** 2, 0) / views.length;
  return Math.sqrt(variance) / mean;
}

export function useCreatorReport(platform: Platform, handle: string) {
  const { result, loading, status, error, run } = useAnalyze();
  const { entries: poolEntries } = usePool();

  useEffect(() => {
    void run(profileInputFor(platform, handle));
  }, [run, platform, handle]);

  // Normalize whatever came back into (videos, channel meta).
  const videos = useMemo<EnrichedVideo[]>(() => {
    if (!result) return [];
    if (result.type === "channel") return result.health.videos;
    if (result.type === "tiktok-batch") return result.videos;
    if (result.type === "video") return result.recentVideos;
    const loose = result as unknown as { type: string; posts?: XPostData[] };
    if (loose.type === "x-batch" && loose.posts?.length) {
      const posts = loose.posts;
      return posts.map((p) => xPostToEnrichedVideo(p, posts));
    }
    return [];
  }, [result]);

  const channel = useMemo<ChannelData | null>(() => {
    if (!result) return null;
    if (result.type === "channel") return result.health.channel;
    if (result.type === "video") return result.channel;
    if (videos.length > 0) {
      const top = videos[0];
      return {
        id: top.channelId || top.channel,
        name: top.channel,
        subs: (top as unknown as { creatorFollowers?: number }).creatorFollowers || 0,
        totalViews: 0,
        videoCount: videos.length,
        uploads: null,
        avatar: "",
      };
    }
    return null;
  }, [result, videos]);

  const stats = useMemo(() => {
    if (videos.length === 0) return null;
    const views = videos.map((v) => v.views).filter((n) => n > 0);
    const median = calculateMedian(views);
    const cv = cvOf(views);
    const outliers = videos.filter((v) => isOutlier(v.views, median)).length;
    const engagements = videos.map((v) => v.engagement);
    const cadenceDays = videos.length >= 2 ? calculateUploadFrequency(videos) : 0;
    return {
      sample: videos.length,
      median,
      p25: views.length ? [...views].sort((a, b) => a - b)[Math.floor(views.length * 0.25)] : 0,
      p75: views.length ? [...views].sort((a, b) => a - b)[Math.floor(views.length * 0.75)] : 0,
      cv,
      consistencyWord: cv < 0.5 ? "Steady" : cv < 1.2 ? "Variable" : "Hit-or-miss",
      trend: detectTrend(videos),
      breakoutRate: videos.length > 0 ? (outliers / videos.length) * 100 : 0,
      medianEngagement: calculateMedian(engagements.map((e) => Math.round(e * 100))) / 100,
      cadenceDays,
      cadenceLabel:
        cadenceDays <= 0 ? "—"
        : cadenceDays <= 1.5 ? "Daily"
        : cadenceDays <= 4 ? "2–3× a week"
        : cadenceDays <= 9 ? "Weekly"
        : cadenceDays <= 20 ? "Every 2 weeks"
        : "Monthly or less",
    };
  }, [videos]);

  const reputation = useMemo(() => (videos.length > 0 ? assessCreatorReputation({ creatorHistory: videos }) : null), [videos]);
  const crossPlatform = useMemo(
    () =>
      channel
        ? assessCrossPlatformReputation({ platform, channelName: channel.name ?? handle, poolEntries })
        : null,
    [platform, channel, handle, poolEntries],
  );
  const niche = useMemo(() => (videos.length > 0 ? classifyCreatorNiche(videos) : null), [videos]);

  // Blocklist status
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    fetch("/api/blocklist")
      .then((r) => r.json())
      .then((d) => {
        const channels: string[] = Array.isArray(d?.channels) ? d.channels : [];
        const creators: string[] = Array.isArray(d?.creators) ? d.creators : [];
        const name = handle.replace(/^@/, "").toLowerCase();
        setBlocked(channels.includes(handle) || creators.includes(name));
      })
      .catch(() => {});
  }, [handle]);

  // Private analytics on file (creator memory)
  const [memory, setMemory] = useState<{ inputs: Partial<ManualInputs>; updatedAt?: string } | null>(null);
  useEffect(() => {
    const h = channel?.name ?? handle;
    if (!h) return;
    fetch(`/api/analytics/memory?platform=${platform}&handle=${encodeURIComponent(h)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && d.record?.inputs && Object.keys(d.record.inputs).length > 0) {
          setMemory({ inputs: d.record.inputs, updatedAt: d.record.updatedAt });
        }
      })
      .catch(() => {});
  }, [platform, channel?.name, handle]);

  return { result, loading, status, error, videos, channel, stats, reputation, crossPlatform, niche, blocked, memory };
}

export type CreatorReport = ReturnType<typeof useCreatorReport>;
