// YouTube analyze pipeline (video / short / channel) — transplanted
// branch-for-branch from legacy Dashboard.tsx analyze(). Behavior parity is
// the contract: same endpoints, same enrichment order, same pool writes
// (analysed video + channel summary + every sibling, siblings within the
// Shorts duration limit reclassified as Shorts so they never contaminate
// the long-form creator baseline).

import type {
  AnalysisResult,
  ChannelData,
  ChannelHealth,
  ReferenceEntry,
  VideoData,
  ParsedInput,
} from "@/lib/types";
import { calculateMedian, detectTrend, GLOBAL_BASELINE } from "@/lib/baseline";
import { computeDeepAnalysis } from "@/lib/deep-analysis";
import { isYouTubeShortDuration } from "@/lib/video-classifier";
import { findRelatedEntries, buildReferenceEntry, buildEntryFromVideo } from "@/lib/reference-store";
import { enrichVideo, buildChannelContext } from "./enrich";
import { expandBank, recordHistory, writePoolEntries, type PipelineCtx } from "./persist";

export async function analyzeYouTubeVideo(parsed: ParsedInput, rawUrl: string, ctx: PipelineCtx): Promise<AnalysisResult> {
  if (!parsed.id) throw new Error("Could not parse video ID from URL");

  ctx.setStatus("Fetching video data...");
  const vRes = await fetch(`/api/youtube/video?id=${encodeURIComponent(parsed.id)}`);
  if (!vRes.ok) throw new Error("Video not found");
  const videoData: VideoData = await vRes.json();

  ctx.setStatus(`Got "${videoData.title}" · Fetching channel...`);
  let channelData: ChannelData | null = null;
  try {
    const cRes = await fetch(`/api/youtube/channel?id=${encodeURIComponent(videoData.channelId)}`);
    if (cRes.ok) channelData = await cRes.json();
  } catch {
    // Channel fetch is non-critical
  }

  ctx.setStatus("Fetching channel baseline...");
  // One playlist page at max=50 costs the same 2 API units as max=12 (one
  // playlistItems page + one batched videos call). The full list feeds the
  // early-share estimator ONLY — it needs siblings aged 21d+, which a
  // 12-video window never reaches on daily-upload channels. Everything else
  // (baseline median, display, pool writes) stays on the first 12, so the
  // forecast baseline cannot move.
  let estimatorHistory: VideoData[] = [];
  let recentVideos: VideoData[] = [];
  if (channelData?.uploads) {
    try {
      const pRes = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(channelData.uploads)}&max=50`);
      if (pRes.ok) {
        estimatorHistory = await pRes.json();
        recentVideos = estimatorHistory.slice(0, 12);
      }
    } catch {
      // Playlist fetch is non-critical
    }
  }

  const channelMedian =
    recentVideos.length > 0
      ? calculateMedian(recentVideos.map((v) => v.views))
      : GLOBAL_BASELINE.medianViews;

  const channelCtx = channelData
    ? buildChannelContext(recentVideos, channelData)
    : undefined;

  // The analysed video's platform: trust the URL (/shorts/) first, then the
  // Shorts duration test — watch?v= links to Shorts are common. Without this
  // the main video silently defaulted to long-form: 365d evergreen curve
  // instead of the 14d Shorts curve, long-form score routing, and CTR logic
  // applied to a swipe feed.
  const mainPlatform =
    parsed.type === "youtube-short" || isYouTubeShortDuration(videoData.durationSeconds)
      ? ("youtube_short" as const)
      : ("youtube" as const);
  const videoWithCtx = { ...videoData, channelContext: channelCtx };
  const enrichedVideo = enrichVideo(videoWithCtx, channelMedian, mainPlatform);

  const enrichedRecent = recentVideos
    .map((v) => enrichVideo({ ...v, channelContext: channelCtx }, channelMedian))
    .sort((a, b) => b.views - a.views);

  ctx.setStatus("Computing deep analysis...");
  const relatedEntries = channelData ? findRelatedEntries({ version: 1, lastUpdated: "", entries: ctx.poolEntries }, channelData.id) : [];
  const deepAnalysis = enrichedRecent.length >= 3
    ? computeDeepAnalysis(enrichedRecent, channelData, relatedEntries)
    : null;

  const videoResult: AnalysisResult = {
    type: "video",
    video: enrichedVideo,
    channel: channelData,
    channelMedian,
    recentVideos: enrichedRecent,
    estimatorHistory,
    deepAnalysis,
    referenceContext: relatedEntries,
  };

  recordHistory(ctx, {
    url: parsed.url || rawUrl,
    platform: mainPlatform,
    video: enrichedVideo,
    channelName: channelData?.name || videoData.channel,
    subscribers: channelData?.subs || 0,
  });

  expandBank(ctx, videoData.title, videoData.description, videoData.tags);

  // Pool write: analysed video + channel summary + every sibling. Siblings
  // within the Shorts duration limit (180s since Oct 2024) are reclassified
  // as youtube_short; the analysed video itself keeps its URL-detected
  // platform via buildReferenceEntry.
  const vidEntryOrEntries = buildReferenceEntry(videoResult);
  const primaryEntries = Array.isArray(vidEntryOrEntries) ? vidEntryOrEntries : [vidEntryOrEntries];
  const siblingEntries = enrichedRecent
    .filter((v) => v.id !== enrichedVideo.id)
    .map((v) => {
      const plat = isYouTubeShortDuration(v.durationSeconds)
        ? ("youtube_short" as const)
        : ("youtube" as const);
      return buildEntryFromVideo(v, plat);
    });

  let channelSummaryEntry: ReferenceEntry | null = null;
  if (channelData) {
    channelSummaryEntry = {
      id: channelData.id,
      type: "channel",
      platform: "youtube",
      name: channelData.name,
      channelId: channelData.id,
      channelName: channelData.name,
      analyzedAt: new Date().toISOString(),
      metrics: {
        subs: channelData.subs,
        medianViews: channelMedian,
        videoCount: enrichedRecent.length,
      },
      archetypes: [],
    };
  }

  writePoolEntries(ctx, [
    ...primaryEntries,
    ...(channelSummaryEntry ? [channelSummaryEntry] : []),
    ...siblingEntries,
  ]);

  ctx.setStatus("");
  return videoResult;
}

export async function analyzeYouTubeChannel(parsed: ParsedInput, ctx: PipelineCtx): Promise<AnalysisResult> {
  let channelData: ChannelData;

  if (parsed.handle) {
    ctx.setStatus(`Fetching channel @${parsed.handle}...`);
    const res = await fetch(`/api/youtube/handle?handle=${encodeURIComponent(parsed.handle)}`);
    if (!res.ok) throw new Error("Channel not found");
    channelData = await res.json();
  } else {
    ctx.setStatus("Fetching channel...");
    const res = await fetch(`/api/youtube/channel?id=${encodeURIComponent(parsed.id!)}`);
    if (!res.ok) throw new Error("Channel not found");
    channelData = await res.json();
  }

  ctx.setStatus(`Found ${channelData.name} · Fetching recent videos...`);

  let videos: VideoData[] = [];
  if (channelData.uploads) {
    const res = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(channelData.uploads)}&max=20`);
    if (res.ok) videos = await res.json();
  }

  const medianViews = calculateMedian(videos.map((v) => v.views));
  const channelCtx = buildChannelContext(videos, channelData);
  const videosWithCtx = videos.map((v) => ({ ...v, channelContext: channelCtx }));

  const enriched = videosWithCtx
    .map((v) => enrichVideo(v, medianViews))
    .sort((a, b) => b.views - a.views);

  const medianVelocity = calculateMedian(enriched.map((v) => v.velocity));
  const medianEngagement = parseFloat(
    (calculateMedian(enriched.map((v) => Math.round(v.engagement * 100))) / 100).toFixed(2),
  );
  const outliers = enriched.filter((v) => v.isOutlier);

  const health: ChannelHealth = {
    channel: channelData,
    videos: enriched,
    medianViews,
    medianVelocity,
    medianEngagement,
    outliers,
    outlierRate: enriched.length > 0 ? (outliers.length / enriched.length) * 100 : 0,
    uploadFrequency: channelCtx.uploadFrequency,
    trend: detectTrend(enriched),
  };

  ctx.setStatus("Computing deep analysis...");
  const relatedEntries = findRelatedEntries({ version: 1, lastUpdated: "", entries: ctx.poolEntries }, channelData.id);
  const deepAnalysis = computeDeepAnalysis(enriched, channelData, relatedEntries);

  const channelResult: AnalysisResult = {
    type: "channel",
    health,
    deepAnalysis,
    referenceContext: relatedEntries,
  };

  for (const v of enriched.slice(0, 5)) {
    expandBank(ctx, v.title, v.description, v.tags);
  }

  const entryOrEntries = buildReferenceEntry(channelResult);
  writePoolEntries(ctx, Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries]);

  ctx.setStatus("");
  return channelResult;
}
