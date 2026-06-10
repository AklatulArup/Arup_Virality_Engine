// Instagram analyze pipeline — transplanted from legacy Dashboard.tsx.
// Preserves: urls/handle envelope (limit 30), single-reel promotion for
// /reel/ or /p/ URLs with exactly one result, batch shaped as the shared
// TikTokBatchAnalysis type, and the pool write of ALL posts in both branches.

import type { AnalysisResult, ChannelData, ReferenceEntry, VideoData, ParsedInput, EnrichedVideo } from "@/lib/types";
import { calculateMedian } from "@/lib/baseline";
import { computeDeepAnalysis } from "@/lib/deep-analysis";
import { buildEntryFromVideo } from "@/lib/reference-store";
import { enrichVideo } from "./enrich";
import { recordHistory, writePoolEntries, type PipelineCtx } from "./persist";

export async function analyzeInstagram(parsed: ParsedInput, rawUrl: string, ctx: PipelineCtx): Promise<AnalysisResult> {
  ctx.setStatus(`Scraping Instagram${parsed.handle ? ` @${parsed.handle}` : ""}...`);
  const igRes = await fetch("/api/instagram/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: parsed.url && parsed.url.includes("instagram.com/") ? [parsed.url] : [],
      handle: parsed.handle,
      limit: 30,
    }),
  });
  if (!igRes.ok) {
    const err = await igRes.json();
    throw new Error(err.error || "Instagram scrape failed");
  }
  const igData = await igRes.json();
  const igVideos: VideoData[] = igData.videos;
  if (!igVideos.length) throw new Error("No Instagram posts returned");

  const medianIG = calculateMedian(igVideos.map((v) => v.views));
  ctx.setStatus("Computing scores...");
  const enrichedIG = igVideos.map((v) => enrichVideo(v, medianIG, "instagram")).sort((a, b) => b.views - a.views);
  const igRelated = ctx.poolEntries.filter((e) => e.platform === "instagram");

  const isIgSingle = (parsed.url?.includes("/reel/") || parsed.url?.includes("/p/")) && enrichedIG.length === 1;
  let result: AnalysisResult;

  if (isIgSingle) {
    const v = enrichedIG[0];
    const igChannel: ChannelData = {
      id: v.channelId || v.channel,
      name: v.channel,
      subs: (v as unknown as { creatorFollowers?: number }).creatorFollowers || 0,
      totalViews: v.views,
      videoCount: 1,
      uploads: null,
      avatar: "",
    };
    const igDeepSingle = computeDeepAnalysis([v], null, igRelated, "instagram");
    result = {
      type: "video",
      video: v,
      channel: igChannel,
      channelMedian: v.views,
      recentVideos: [v],
      deepAnalysis: igDeepSingle,
      referenceContext: igRelated,
    };
  } else {
    const igTopPerformers = enrichedIG.slice(0, 10);
    const igCreatorMap: Record<string, { views: number[]; scores: number[] }> = {};
    for (const v of enrichedIG) {
      const h = v.channel || "unknown";
      if (!igCreatorMap[h]) igCreatorMap[h] = { views: [], scores: [] };
      igCreatorMap[h].views.push(v.views);
      igCreatorMap[h].scores.push(v.vrs.estimatedFullScore);
    }
    const igBreakdown = Object.entries(igCreatorMap)
      .map(([handle, data]) => ({
        handle,
        videoCount: data.views.length,
        avgViews: Math.round(data.views.reduce((s, v) => s + v, 0) / data.views.length),
        avgScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
      }))
      .sort((a, b) => b.avgViews - a.avgViews);
    const igDeep = computeDeepAnalysis(enrichedIG, null, igRelated, "instagram");
    result = {
      type: "tiktok-batch",
      videos: enrichedIG,
      deepAnalysis: igDeep,
      topPerformers: igTopPerformers,
      competitorBreakdown: igBreakdown,
      referenceContext: igRelated,
    };
  }

  // Pool write of ALL posts — both branches, exactly like legacy.
  const igEntries: ReferenceEntry[] = enrichedIG.map((v) => buildEntryFromVideo(v, "instagram"));
  writePoolEntries(ctx, igEntries);

  // History for every platform (deliberate rebuild delta).
  const top: EnrichedVideo | undefined = enrichedIG[0];
  if (top) {
    recordHistory(ctx, {
      url: parsed.url || rawUrl,
      platform: "instagram",
      video: top,
      channelName: top.channel,
      subscribers: (top as unknown as { creatorFollowers?: number }).creatorFollowers || 0,
    });
  }

  ctx.setStatus("");
  return result;
}
