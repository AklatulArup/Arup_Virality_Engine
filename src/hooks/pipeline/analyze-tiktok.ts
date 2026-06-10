// TikTok analyze pipeline — transplanted from legacy Dashboard.tsx. Preserves:
// limit 50, fire-and-forget /api/tiktok/upload, single-video promotion when
// the URL targets /video/ and exactly one result returns (incl. the pool
// write that branch historically missed and was later fixed to include),
// batch competitor breakdown otherwise.

import type { AnalysisResult, ChannelData, ReferenceEntry, VideoData, ParsedInput, EnrichedVideo } from "@/lib/types";
import { calculateMedian } from "@/lib/baseline";
import { computeDeepAnalysis } from "@/lib/deep-analysis";
import { buildReferenceEntry, buildEntryFromVideo } from "@/lib/reference-store";
import { enrichVideo } from "./enrich";
import { recordHistory, writePoolEntries, type PipelineCtx } from "./persist";

export async function analyzeTikTok(parsed: ParsedInput, rawUrl: string, ctx: PipelineCtx): Promise<AnalysisResult> {
  ctx.setStatus(`Scraping TikTok${parsed.handle ? ` @${parsed.handle}` : ""}...`);
  const scrapeRes = await fetch("/api/tiktok/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: parsed.url, handle: parsed.handle, limit: 50 }),
  });
  if (!scrapeRes.ok) {
    const err = await scrapeRes.json();
    throw new Error(err.error || "TikTok scrape failed");
  }
  const scrapeData = await scrapeRes.json();
  const ttVideos: VideoData[] = scrapeData.videos;
  if (!ttVideos.length) throw new Error("No TikTok videos returned");

  // Fire-and-forget store into the legacy TikTok batch pipeline.
  fetch("/api/tiktok/upload", {
    method: "POST",
    body: (() => {
      const fd = new FormData();
      fd.append("json", JSON.stringify(ttVideos));
      return fd;
    })(),
  }).catch(() => null);

  const medianViews = calculateMedian(ttVideos.map((v) => v.views));
  ctx.setStatus("Computing scores...");
  const enriched = ttVideos.map((v) => enrichVideo(v, medianViews, "tiktok")).sort((a, b) => b.views - a.views);
  const relatedEntries = ctx.poolEntries.filter((e) => e.platform === "tiktok");

  const isSingleVideo = parsed.url?.includes("/video/") && enriched.length === 1;
  let result: AnalysisResult;

  if (isSingleVideo) {
    const v = enriched[0];
    const ttChannel: ChannelData = {
      id: v.channelId || v.channel,
      name: v.channel,
      subs: (v as unknown as { creatorFollowers?: number }).creatorFollowers || 0,
      totalViews: v.views,
      videoCount: 1,
      uploads: null,
      avatar: "",
    };
    const deepSingle = computeDeepAnalysis([v], null, relatedEntries, "tiktok");
    result = {
      type: "video",
      video: v,
      channel: ttChannel,
      channelMedian: v.views,
      recentVideos: [v],
      deepAnalysis: deepSingle,
      referenceContext: relatedEntries,
    };
    // Single-video analyze must still grow the pool.
    const ttSingleEntries: ReferenceEntry[] = enriched.map((x) => buildEntryFromVideo(x, "tiktok"));
    writePoolEntries(ctx, ttSingleEntries);
  } else {
    const topPerformers = enriched.slice(0, 10);
    const creatorMap: Record<string, { views: number[]; scores: number[] }> = {};
    for (const v of enriched) {
      const h = v.channel || "unknown";
      if (!creatorMap[h]) creatorMap[h] = { views: [], scores: [] };
      creatorMap[h].views.push(v.views);
      creatorMap[h].scores.push(v.vrs.estimatedFullScore);
    }
    const competitorBreakdown = Object.entries(creatorMap)
      .map(([handle, data]) => ({
        handle,
        videoCount: data.views.length,
        avgViews: Math.round(data.views.reduce((s, v) => s + v, 0) / data.views.length),
        avgScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
      }))
      .sort((a, b) => b.avgViews - a.avgViews);
    const deepAnalysis = computeDeepAnalysis(enriched, null, relatedEntries, "tiktok");
    result = {
      type: "tiktok-batch",
      videos: enriched,
      deepAnalysis,
      topPerformers,
      competitorBreakdown,
      referenceContext: relatedEntries,
    };
    const entries = buildReferenceEntry(result);
    writePoolEntries(ctx, Array.isArray(entries) ? entries : [entries]);
  }

  // History for every platform (deliberate rebuild delta — legacy was YT-only).
  const top: EnrichedVideo | undefined = enriched[0];
  if (top) {
    recordHistory(ctx, {
      url: parsed.url || rawUrl,
      platform: "tiktok",
      video: top,
      channelName: top.channel,
      subscribers: (top as unknown as { creatorFollowers?: number }).creatorFollowers || 0,
    });
  }

  ctx.setStatus("");
  return result;
}
