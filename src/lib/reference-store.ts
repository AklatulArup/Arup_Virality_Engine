import type {
  AnalysisResult,
  ReferenceEntry,
  ReferenceStore,
  ArchetypeId,
  EnrichedVideo,
  VideoData,
} from "./types";
import { detectArchetypes } from "./archetypes";
import { classifyVideoFormat, classifyOrientation, formatDuration, quickSentiment, isYouTubeShortDuration } from "./video-classifier";

/**
 * Build a reference entry directly from a raw VideoData (used by bulk imports
 * and discography fetches that don't go through the full analysis pipeline).
 */
export function buildEntryFromVideo(
  v: VideoData,
  platform: "youtube" | "youtube_short" | "tiktok" | "instagram" | "x" = "youtube"
): ReferenceEntry {
  const now = new Date().toISOString();
  const archetypes = detectArchetypes(v.title, v.tags);
  const videoFormat = classifyVideoFormat(v.durationSeconds, v.title, v.tags, v.description, platform);
  const orientation = classifyOrientation(v.durationSeconds, v.title, v.tags, v.description, platform);
  const { label: sentiment, score: sentimentScore } = quickSentiment(
    [v.title, ...(v.tags || []).slice(0, 10)].join(" ")
  );
  // Engagement = (likes + comments) / views * 100
  const engagement = v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0;
  // TikTok scrapes carry sound info beyond the base VideoData shape.
  const snd = v as VideoData & { soundName?: string; soundOriginal?: boolean };
  return {
    id: v.id,
    type: "video",
    platform,
    name: v.title,
    channelId: v.channelId,
    channelName: v.channel,
    analyzedAt: now,
    publishedAt: v.publishedAt || undefined,
    metrics: {
      views: v.views,
      engagement: parseFloat(engagement.toFixed(2)),
      shares: typeof v.shares === "number" ? v.shares : undefined,
      saves: typeof v.saves === "number" ? v.saves : undefined,
    },
    archetypes,
    tags: (v.tags || []).slice(0, 10),
    soundName: snd.soundName,
    soundOriginal: snd.soundOriginal,
    durationSeconds: v.durationSeconds,
    duration: formatDuration(v.durationSeconds),
    videoFormat,
    orientation,
    sentiment,
    sentimentScore,
    description: v.description,
  };
}

export function buildReferenceEntry(
  result: AnalysisResult
): ReferenceEntry | ReferenceEntry[] {
  const now = new Date().toISOString();

  if (result.type === "video") {
    const v = result.video;
    const archetypes = detectArchetypes(v.title, v.tags);
    const plat = v.platform || "youtube";
    const videoFormat = classifyVideoFormat(v.durationSeconds, v.title, v.tags, v.description, plat);
    const orientation = classifyOrientation(v.durationSeconds, v.title, v.tags, v.description, plat);
    const { label: sentiment, score: sentimentScore } = quickSentiment(
      [v.title, ...(v.tags || []).slice(0, 10)].join(" ")
    );
    const snd = v as EnrichedVideo & { soundName?: string; soundOriginal?: boolean };
    return {
      id: v.id,
      type: "video",
      platform: plat,
      name: v.title,
      channelId: v.channelId,
      channelName: v.channel,
      analyzedAt: now,
      publishedAt: v.publishedAt || undefined,
      metrics: {
        views: v.views,
        velocity: v.velocity,
        engagement: v.engagement,
        vrsScore: v.vrs.estimatedFullScore,
        shares: typeof v.shares === "number" ? v.shares : undefined,
        saves: typeof v.saves === "number" ? v.saves : undefined,
      },
      archetypes,
      tags: v.tags.slice(0, 10),
      soundName: snd.soundName,
      soundOriginal: snd.soundOriginal,
      durationSeconds: v.durationSeconds,
      duration: formatDuration(v.durationSeconds),
      videoFormat,
      orientation,
      sentiment,
      sentimentScore,
      description: v.description,
    };
  }

  if (result.type === "channel") {
    const h = result.health;
    const allArchetypes: ArchetypeId[] = [];
    for (const v of h.videos.slice(0, 5)) {
      for (const a of detectArchetypes(v.title, v.tags)) {
        if (!allArchetypes.includes(a)) allArchetypes.push(a);
      }
    }

    // Channel-level summary entry (for creator tracking + niche lookups)
    const channelEntry: ReferenceEntry = {
      id: h.channel.id,
      type: "channel",
      platform: "youtube",
      name: h.channel.name,
      channelId: h.channel.id,
      channelName: h.channel.name,
      analyzedAt: now,
      metrics: {
        subs: h.channel.subs,
        medianViews: h.medianViews,
        velocity: h.medianVelocity,
        engagement: h.medianEngagement,
        outlierRate: h.outlierRate,
        trend: h.trend,
        uploadFrequency: h.uploadFrequency,
        videoCount: h.videos.length,
      },
      archetypes: allArchetypes,
    };

    // Per-video entries — every video on the channel becomes reference material
    // Classifies each as Long-form or Shorts based on duration (within the
    // 180s Shorts limit = Shorts)
    const videoEntries: ReferenceEntry[] = h.videos.map((v) => {
      const platform = isYouTubeShortDuration(v.durationSeconds)
        ? "youtube_short" as const
        : "youtube" as const;
      return buildEntryFromVideo(v, platform);
    });

    return [channelEntry, ...videoEntries];
  }

  // TikTok batch — save every fetched video, not just top performers.
  // This aggressively grows the pool every time you analyse a TikTok creator.
  const allVideos = result.videos ?? result.topPerformers ?? [];
  const entries: ReferenceEntry[] = allVideos.map((v: EnrichedVideo) => {
      const archetypes = detectArchetypes(v.title, v.tags);
      const videoFormat = classifyVideoFormat(v.durationSeconds, v.title, v.tags, v.description, "tiktok");
      const { label: sentiment, score: sentimentScore } = quickSentiment(
        [v.title, ...(v.tags || []).slice(0, 10)].join(" ")
      );
      const snd = v as EnrichedVideo & { soundName?: string; soundOriginal?: boolean };
      return {
        id: v.id,
        type: "video" as const,
        platform: "tiktok" as const,
        name: v.title,
        channelId: v.channelId,
        channelName: v.channel,
        analyzedAt: now,
        publishedAt: v.publishedAt || undefined,
        metrics: {
          views: v.views,
          velocity: v.velocity,
          engagement: v.engagement,
          vrsScore: v.vrs.estimatedFullScore,
          shares: v.shares,
          saves: v.saves,
        },
        archetypes,
        tags: v.tags.slice(0, 10),
        soundName: snd.soundName,
        soundOriginal: snd.soundOriginal,
        durationSeconds: v.durationSeconds,
        duration: formatDuration(v.durationSeconds),
        videoFormat,
        orientation: "vertical" as const,
        sentiment,
        sentimentScore,
        description: v.description,
      };
    });

  return entries;
}

export function findRelatedEntries(
  store: ReferenceStore,
  channelId: string,
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram" | "x"
): ReferenceEntry[] {
  return store.entries.filter(
    (e) =>
      e.channelId === channelId &&
      (!platform || !e.platform || e.platform === platform)
  );
}
