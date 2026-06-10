// Pure enrichment helpers transplanted verbatim from the legacy Dashboard.tsx.
// No React, no fetch — every analyze branch shares these.

import type { VideoData, EnrichedVideo } from "@/lib/types";
import type { Platform } from "@/lib/forecast";
import { daysAgo, velocity, engagement } from "@/lib/formatters";
import { runPlatformVRS } from "@/lib/vrs";
import { isOutlier, vsBaseline } from "@/lib/baseline";
import { calculateUploadFrequency } from "@/lib/baseline";

export function enrichVideo(
  v: VideoData,
  median: number,
  platform: Platform = "youtube",
): EnrichedVideo {
  const days = daysAgo(v.publishedAt);
  const vel = velocity(v.views, days);
  const eng = engagement(v.likes, v.comments, v.views);
  // Stamp platform on the video if the scraper didn't already, then let
  // runPlatformVRS auto-route to the correct criteria set.
  const videoWithPlatform: VideoData = v.platform ? v : { ...v, platform };
  const vrs = runPlatformVRS(videoWithPlatform);
  return {
    ...videoWithPlatform,
    days,
    velocity: vel,
    engagement: eng,
    vrs,
    isOutlier: isOutlier(v.views, median),
    vsBaseline: vsBaseline(v.views, median),
  };
}

export interface ChannelContext {
  subs: number;
  videoCount: number;
  uploadFrequency: number;
  recentVideoTitles: string[];
  channelAgeDays: number;
}

// Upload frequency + channel age from a raw video list. The legacy code built
// throwaway EnrichedVideo-shaped stubs because calculateUploadFrequency takes
// EnrichedVideo[]; transplanted as-is for parity.
export function buildChannelContext(
  videos: VideoData[],
  channel: { subs: number; videoCount: number },
): ChannelContext {
  const uploadFrequency =
    videos.length >= 2
      ? calculateUploadFrequency(
          videos.map((v) => ({
            ...v,
            days: 0,
            velocity: 0,
            engagement: 0,
            vrs: {
              score: 0, estimatedFullScore: 0, earned: 0, possible: 0, totalWeight: 0,
              estimatedHiddenScore: 0, tierSummaries: [], criteria: [], gaps: [], topFixes: [], hiddenCount: 0,
            },
            isOutlier: false,
            vsBaseline: 0,
          })),
        )
      : 0;

  const channelAgeDays =
    videos.length > 0
      ? Math.max(
          1,
          (Date.now() - new Date(videos[videos.length - 1]?.publishedAt || Date.now()).getTime()) / 86_400_000,
        )
      : 365;

  return {
    subs: channel.subs,
    videoCount: channel.videoCount,
    uploadFrequency,
    recentVideoTitles: videos.slice(0, 10).map((v) => v.title),
    channelAgeDays: Math.round(channelAgeDays),
  };
}
