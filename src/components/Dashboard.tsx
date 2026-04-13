"use client";

import { useState, useEffect } from "react";
import type {
  ModeId,
  VideoData,
  ChannelData,
  EnrichedVideo,
  ChannelHealth,
  AnalysisResult,
  ReferenceStore,
  TikTokBatchAnalysis,
  KeywordBank,
  AdjacentVideoContext,
  NicheRanking,
  LanguageCPA,
  DescriptionSEO,
  EngagementDecay,
  ThumbnailAnalysis,
  CrossPromotion,
  TitleVariant,
  PublishTimeHeatmap,
  CompetitorGapMatrix,
  TagCorrelationResult,
  UploadCadenceResult,
  HookPatternLibrary,
} from "@/lib/types";
import { MODES } from "@/lib/modes";
import { parseInput } from "@/lib/url-parser";
import { runVRS, runTRS } from "@/lib/vrs";
import {
  daysAgo,
  velocity,
  engagement,
  formatNumber,
} from "@/lib/formatters";
import {
  GLOBAL_BASELINE,
  calculateMedian,
  isOutlier,
  vsBaseline,
  detectTrend,
  calculateUploadFrequency,
} from "@/lib/baseline";
import { computeDeepAnalysis } from "@/lib/deep-analysis";
import {
  buildReferenceEntry,
  findRelatedEntries,
} from "@/lib/reference-store";
import { expandKeywordBank } from "@/lib/keyword-bank";
import { findAdjacentVideos } from "@/lib/adjacent-videos";
import { computeNicheRanking } from "@/lib/niche-ranking";
import { computeLanguageCPA } from "@/lib/language-detect";
import { analyzeDescriptionSEO } from "@/lib/description-seo";
import { computeEngagementDecay } from "@/lib/engagement-decay";
import { analyzeThumbnail } from "@/lib/thumbnail-check";
import { detectCrossPromotion } from "@/lib/cross-promotion";
import { computePublishTimeHeatmap } from "@/lib/publish-time";
import { computeCompetitorGapMatrix } from "@/lib/competitor-gap";
import { computeTagCorrelation } from "@/lib/tag-correlation";
import { computeUploadCadence } from "@/lib/upload-cadence";
import { analyzeHookPatterns } from "@/lib/hook-patterns";
import ModeSelector from "./ModeSelector";
import UrlInput from "./UrlInput";
import VideoResult from "./VideoResult";
import ChannelResult from "./ChannelResult";
import CsvUpload from "./CsvUpload";
import TikTokBatchResult from "./TikTokBatchResult";
import ReferenceSearch from "./ReferenceSearch";
import ReferenceUpload from "./ReferenceUpload";
import ReferencePoolBuilder from "./ReferencePoolBuilder";
import BulkImporter from "./BulkImporter";
import KeywordBankManager from "./KeywordBankManager";
import HashtagBankManager from "./HashtagBankManager";
import CompetitorBankManager from "./CompetitorBankManager";
import type { Competitor } from "./CompetitorBankManager";
import CreatorBlocklist from "./CreatorBlocklist";
import TrendsPanel from "./TrendsPanel";
import SentimentPanel from "./SentimentPanel";
import ViewForecastPanel from "./ViewForecastPanel";
import { analyzePoolSentiment, type TitleSentimentAnalysis } from "@/lib/sentiment";

type InputTab = "youtube" | "tiktok" | "instagram";

function enrichVideo(
  v: VideoData,
  median: number,
  platform: "youtube" | "tiktok" = "youtube"
): EnrichedVideo {
  const days = daysAgo(v.publishedAt);
  const vel = velocity(v.views, days);
  const eng = engagement(v.likes, v.comments, v.views);
  const vrs = platform === "tiktok" ? runTRS(v) : runVRS(v);
  return {
    ...v,
    days,
    velocity: vel,
    engagement: eng,
    vrs,
    isOutlier: isOutlier(v.views, median),
    vsBaseline: vsBaseline(v.views, median),
  };
}

export default function Dashboard() {
  const [activeModes, setActiveModes] = useState<ModeId[]>(["F", "G", "C"]);
  const [inputTab, setInputTab] = useState<InputTab>("youtube");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastUrl, setLastUrl] = useState("");
  const [referenceStore, setReferenceStore] = useState<ReferenceStore | null>(null);
  const [refStoreStatus, setRefStoreStatus] = useState<"idle" | "saved" | "updated">("idle");
  const [tiktokUploadInfo, setTiktokUploadInfo] = useState<{
    videoCount: number;
    uploadCount: number;
    time: string;
  } | null>(null);
  const [keywordBank, setKeywordBank] = useState<KeywordBank | null>(null);
  const [blocklistKey, setBlocklistKey] = useState(0);
  const [hashtagBank, setHashtagBank] = useState<{
    version: number;
    lastUpdated: string;
    categories: { viral: string[]; brand: string[]; niche: string[]; campaign: string[] };
  } | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [forecastDate, setForecastDate] = useState<string>("");
  const [instagramInput, setInstagramInput] = useState("");
  const [instagramStatus, setInstagramStatus] = useState("");

  // Extra analysis results for video mode
  const [adjacentCtx, setAdjacentCtx] = useState<AdjacentVideoContext | null>(null);
  const [nicheRanking, setNicheRanking] = useState<NicheRanking | null>(null);
  const [languageCPA, setLanguageCPA] = useState<LanguageCPA[] | null>(null);

  // New feature states
  const [descSEO, setDescSEO] = useState<DescriptionSEO | null>(null);
  const [engDecay, setEngDecay] = useState<EngagementDecay | null>(null);
  const [thumbAnalysis, setThumbAnalysis] = useState<ThumbnailAnalysis | null>(null);
  const [crossPromo, setCrossPromo] = useState<CrossPromotion | null>(null);
  const [publishTime, setPublishTime] = useState<PublishTimeHeatmap | null>(null);
  const [competitorGap, setCompetitorGap] = useState<CompetitorGapMatrix | null>(null);
  const [tagCorrelation, setTagCorrelation] = useState<TagCorrelationResult | null>(null);
  const [uploadCadence, setUploadCadence] = useState<UploadCadenceResult | null>(null);
  const [hookPatterns, setHookPatterns] = useState<HookPatternLibrary | null>(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<TitleSentimentAnalysis | null>(null);

  // Load reference store and keyword bank on mount
  useEffect(() => {
    fetch("/api/reference-store")
      .then((r) => r.json())
      .then((store: ReferenceStore) => setReferenceStore(store))
      .catch(() => {});
    fetch("/api/keyword-bank")
      .then((r) => r.json())
      .then((bank: KeywordBank) => setKeywordBank(bank))
      .catch(() => {});
    fetch("/api/hashtag-bank")
      .then((r) => r.json())
      .then(setHashtagBank)
      .catch(() => {});
    fetch("/api/competitor-bank")
      .then((r) => r.json())
      .then(setCompetitors)
      .catch(() => {});
  }, []);

  const refreshReferenceStore = () => {
    fetch("/api/reference-store")
      .then((r) => r.json())
      .then((store: ReferenceStore) => setReferenceStore(store))
      .catch(() => {});
  };

  const toggleMode = (id: ModeId) => {
    setActiveModes((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAll = () => setActiveModes(MODES.map((m) => m.id));
  const clearModes = () => setActiveModes([]);

  // Expand keyword bank with new video data
  const expandBank = (title: string, description: string, tags: string[]) => {
    if (!keywordBank) return;
    const { bank: updated, newKeywords } = expandKeywordBank(keywordBank, title, description, tags);
    if (newKeywords.length > 0) {
      setKeywordBank(updated);
      // Persist to server
      fetch("/api/keyword-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: newKeywords }),
      }).catch(() => {});
    }
  };

  // ─── TikTok CSV Upload Handler ───
  const analyzeTikTok = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAdjacentCtx(null);
    setNicheRanking(null);
    setLanguageCPA(null);
    setDescSEO(null);
    setEngDecay(null);
    setThumbAnalysis(null);
    setCrossPromo(null);
    setPublishTime(null);
    setCompetitorGap(null);
    setTagCorrelation(null);
    setUploadCadence(null);
    setHookPatterns(null);
    setStatus("Uploading CSV...");

    try {
      const formData = new FormData();
      formData.append("csv", file);

      const uploadRes = await fetch("/api/tiktok/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      setTiktokUploadInfo({
        videoCount: uploadData.videoCount,
        uploadCount: uploadData.uploadCount,
        time: new Date().toLocaleString(),
      });

      setStatus(`Parsed ${uploadData.videoCount} videos. Analyzing...`);

      const storeRes = await fetch("/api/tiktok/upload");
      const store = await storeRes.json();
      const videos: VideoData[] = store.videos;

      if (videos.length === 0) throw new Error("No videos in store");

      const medianViews = calculateMedian(videos.map((v) => v.views));

      setStatus("Computing TRS scores...");
      const enriched = videos
        .map((v) => enrichVideo(v, medianViews, "tiktok"))
        .sort((a, b) => b.views - a.views);

      const topPerformers = enriched.slice(0, 10);

      const creatorMap: Record<string, { views: number[]; scores: number[] }> = {};
      for (const v of enriched) {
        const handle = v.channel || "unknown";
        if (!creatorMap[handle]) creatorMap[handle] = { views: [], scores: [] };
        creatorMap[handle].views.push(v.views);
        creatorMap[handle].scores.push(v.vrs.estimatedFullScore);
      }

      const competitorBreakdown = Object.entries(creatorMap)
        .map(([handle, data]) => ({
          handle,
          videoCount: data.views.length,
          avgViews: Math.round(data.views.reduce((s, v) => s + v, 0) / data.views.length),
          avgScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
        }))
        .sort((a, b) => b.avgViews - a.avgViews);

      setStatus("Computing deep analysis...");
      const relatedEntries = referenceStore
        ? referenceStore.entries.filter((e) => e.platform === "tiktok")
        : [];

      const deepAnalysis = computeDeepAnalysis(enriched, null, relatedEntries, "tiktok");

      const batchResult: TikTokBatchAnalysis = {
        type: "tiktok-batch",
        videos: enriched,
        deepAnalysis,
        topPerformers,
        competitorBreakdown,
        referenceContext: relatedEntries,
      };

      setResult(batchResult);

      // Language CPA for TikTok batch
      setLanguageCPA(computeLanguageCPA(enriched));

      // Save to reference store
      const entries = buildReferenceEntry(batchResult);
      const entryArray = Array.isArray(entries) ? entries : [entries];
      if (entryArray.length > 0) {
        fetch("/api/reference-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entryArray),
        })
          .then((r) => r.json())
          .then(() => {
            setRefStoreStatus("saved");
            refreshReferenceStore();
          })
          .catch(() => {});
      }

      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("");
    }

    setLoading(false);
  };

  // ─── YouTube Analysis Handler ───
  const analyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAdjacentCtx(null);
    setNicheRanking(null);
    setLanguageCPA(null);
    setDescSEO(null);
    setEngDecay(null);
    setThumbAnalysis(null);
    setCrossPromo(null);
    setPublishTime(null);
    setCompetitorGap(null);
    setTagCorrelation(null);
    setUploadCadence(null);
    setHookPatterns(null);
    setLastUrl(url);

    try {
      const parsed = parseInput(url);

      if (
        parsed.type === "youtube-channel" &&
        (parsed.handle || parsed.id)
      ) {
        // ── Channel analysis ──
        let channelData: ChannelData;

        if (parsed.handle) {
          setStatus(`Fetching channel @${parsed.handle}...`);
          const res = await fetch(`/api/youtube/handle?handle=${encodeURIComponent(parsed.handle)}`);
          if (!res.ok) throw new Error("Channel not found");
          channelData = await res.json();
        } else {
          setStatus(`Fetching channel...`);
          const res = await fetch(`/api/youtube/channel?id=${encodeURIComponent(parsed.id!)}`);
          if (!res.ok) throw new Error("Channel not found");
          channelData = await res.json();
        }

        setStatus(`Found ${channelData.name} · Fetching recent videos...`);

        let videos: VideoData[] = [];
        if (channelData.uploads) {
          const res = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(channelData.uploads)}&max=20`);
          if (res.ok) videos = await res.json();
        }

        const viewCounts = videos.map((v) => v.views);
        const medianViews = calculateMedian(viewCounts);

        // Compute channel context for VRS criteria
        const uploadFreq = videos.length >= 2 ? calculateUploadFrequency(videos.map((v) => ({
          ...v, days: 0, velocity: 0, engagement: 0,
          vrs: { score: 0, estimatedFullScore: 0, earned: 0, possible: 0, totalWeight: 0, estimatedHiddenScore: 0, tierSummaries: [], criteria: [], gaps: [], topFixes: [], hiddenCount: 0 },
          isOutlier: false, vsBaseline: 0,
        }))) : 0;

        const channelAgeDays = videos.length > 0
          ? Math.max(1, (Date.now() - new Date(videos[videos.length - 1]?.publishedAt || Date.now()).getTime()) / 86_400_000)
          : 365;

        const channelCtx = {
          subs: channelData.subs,
          videoCount: channelData.videoCount,
          uploadFrequency: uploadFreq,
          recentVideoTitles: videos.slice(0, 10).map((v) => v.title),
          channelAgeDays: Math.round(channelAgeDays),
        };

        // Attach channel context to each video before enriching
        const videosWithCtx = videos.map((v) => ({ ...v, channelContext: channelCtx }));

        const enriched = videosWithCtx
          .map((v) => enrichVideo(v, medianViews))
          .sort((a, b) => b.views - a.views);

        const velocities = enriched.map((v) => v.velocity);
        const engagements = enriched.map((v) => v.engagement);
        const medianVelocity = calculateMedian(velocities);
        const medianEngagement = parseFloat(
          (calculateMedian(engagements.map((e) => Math.round(e * 100))) / 100).toFixed(2)
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
          uploadFrequency: uploadFreq,
          trend: detectTrend(enriched),
        };

        setStatus("Computing deep analysis...");
        const relatedEntries = referenceStore ? findRelatedEntries(referenceStore, channelData.id) : [];
        const deepAnalysis = computeDeepAnalysis(enriched, channelData, relatedEntries);

        // Language CPA
        setLanguageCPA(computeLanguageCPA(enriched));

        const channelResult: AnalysisResult = {
          type: "channel",
          health,
          deepAnalysis,
          referenceContext: relatedEntries,
        };
        setResult(channelResult);

        // Expand keyword bank
        for (const v of enriched.slice(0, 5)) {
          expandBank(v.title, v.description, v.tags);
        }

        // Save to reference store
        const entryOrEntries = buildReferenceEntry(channelResult);
        const entry = Array.isArray(entryOrEntries) ? entryOrEntries[0] : entryOrEntries;
        if (entry) {
          fetch("/api/reference-store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          })
            .then((r) => r.json())
            .then((res) => {
              setRefStoreStatus(res.action === "updated" ? "updated" : "saved");
              refreshReferenceStore();
            })
            .catch(() => {});
        }

        setStatus("");
      } else if (
        parsed.type === "youtube-video" ||
        parsed.type === "youtube-short"
      ) {
        // ── Video analysis ──
        if (!parsed.id) throw new Error("Could not parse video ID from URL");

        setStatus("Fetching video data...");
        const vRes = await fetch(`/api/youtube/video?id=${encodeURIComponent(parsed.id)}`);
        if (!vRes.ok) throw new Error("Video not found");
        const videoData: VideoData = await vRes.json();

        setStatus(`Got "${videoData.title}" · Fetching channel...`);
        let channelData: ChannelData | null = null;
        try {
          const cRes = await fetch(`/api/youtube/channel?id=${encodeURIComponent(videoData.channelId)}`);
          if (cRes.ok) channelData = await cRes.json();
        } catch {
          // Channel fetch is non-critical
        }

        setStatus("Fetching channel baseline...");
        let recentVideos: VideoData[] = [];
        if (channelData?.uploads) {
          try {
            const pRes = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(channelData.uploads)}&max=12`);
            if (pRes.ok) recentVideos = await pRes.json();
          } catch {
            // Playlist fetch is non-critical
          }
        }

        const channelMedian =
          recentVideos.length > 0
            ? calculateMedian(recentVideos.map((v) => v.views))
            : GLOBAL_BASELINE.medianViews;

        // Build channel context
        const uploadFreq = recentVideos.length >= 2 ? calculateUploadFrequency(recentVideos.map((v) => ({
          ...v, days: 0, velocity: 0, engagement: 0,
          vrs: { score: 0, estimatedFullScore: 0, earned: 0, possible: 0, totalWeight: 0, estimatedHiddenScore: 0, tierSummaries: [], criteria: [], gaps: [], topFixes: [], hiddenCount: 0 },
          isOutlier: false, vsBaseline: 0,
        }))) : 0;

        const channelAgeDays = recentVideos.length > 0
          ? Math.max(1, (Date.now() - new Date(recentVideos[recentVideos.length - 1]?.publishedAt || Date.now()).getTime()) / 86_400_000)
          : 365;

        const channelCtx = channelData ? {
          subs: channelData.subs,
          videoCount: channelData.videoCount,
          uploadFrequency: uploadFreq,
          recentVideoTitles: recentVideos.slice(0, 10).map((v) => v.title),
          channelAgeDays: Math.round(channelAgeDays),
        } : undefined;

        // Attach channel context
        const videoWithCtx = { ...videoData, channelContext: channelCtx };
        const enrichedVideo = enrichVideo(videoWithCtx, channelMedian);

        const enrichedRecent = recentVideos
          .map((v) => enrichVideo({ ...v, channelContext: channelCtx }, channelMedian))
          .sort((a, b) => b.views - a.views);

        // Adjacent videos
        setStatus("Finding adjacent videos...");
        const adjCtx = findAdjacentVideos(enrichedVideo, enrichedRecent);
        setAdjacentCtx(adjCtx);

        // Compute deep analysis
        setStatus("Computing deep analysis...");
        const relatedEntries = referenceStore && channelData
          ? findRelatedEntries(referenceStore, channelData.id)
          : [];
        const deepAnalysis = enrichedRecent.length >= 3
          ? computeDeepAnalysis(enrichedRecent, channelData, relatedEntries)
          : null;

        // Language CPA from recent videos
        if (enrichedRecent.length >= 3) {
          setLanguageCPA(computeLanguageCPA(enrichedRecent));
        }

        // Niche competitive ranking
        if (referenceStore && keywordBank) {
          setStatus("Computing niche ranking...");
          const ranking = computeNicheRanking(
            enrichedVideo.title,
            enrichedVideo.views,
            enrichedVideo.vrs.estimatedFullScore,
            enrichedVideo.engagement,
            enrichedVideo.channel,
            referenceStore.entries,
            keywordBank
          );
          setNicheRanking(ranking);
        }

        // ── New feature computations ──
        // Description SEO
        if (keywordBank) {
          setDescSEO(analyzeDescriptionSEO(videoData.description, videoData.title, keywordBank));
        }
        // Engagement Decay
        setEngDecay(computeEngagementDecay(enrichedVideo));
        // Thumbnail Analysis
        setThumbAnalysis(analyzeThumbnail(videoData.thumbnail, videoData.id));
        // Cross-Promotion
        setCrossPromo(detectCrossPromotion(videoData.description));

        // Reference pool aggregate features
        if (referenceStore && referenceStore.entries.length >= 3) {
          setPublishTime(computePublishTimeHeatmap(referenceStore.entries));
          setTagCorrelation(computeTagCorrelation(referenceStore.entries));
          setUploadCadence(computeUploadCadence(referenceStore.entries));
          setHookPatterns(analyzeHookPatterns(referenceStore.entries));
          setSentimentAnalysis(analyzePoolSentiment(
            referenceStore.entries,
            keywordBank?.categories.competitors || []
          ));
          if (keywordBank) {
            setCompetitorGap(computeCompetitorGapMatrix(
              "fundednext",
              referenceStore.entries,
              keywordBank
            ));
          }
        }

        const videoResult: AnalysisResult = {
          type: "video",
          video: enrichedVideo,
          channel: channelData,
          channelMedian,
          recentVideos: enrichedRecent,
          deepAnalysis,
          referenceContext: relatedEntries,
        };
        setResult(videoResult);

        // Expand keyword bank
        expandBank(videoData.title, videoData.description, videoData.tags);

        // Save to reference store
        const vidEntryOrEntries = buildReferenceEntry(videoResult);
        const vidEntry = Array.isArray(vidEntryOrEntries) ? vidEntryOrEntries[0] : vidEntryOrEntries;
        if (vidEntry) {
          fetch("/api/reference-store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vidEntry),
          })
            .then((r) => r.json())
            .then((res) => {
              setRefStoreStatus(res.action === "updated" ? "updated" : "saved");
              refreshReferenceStore();
            })
            .catch(() => {});
        }

        setStatus("");
      } else if (parsed.type === "tiktok") {
        // ── TikTok via Apify scraper ──
        setStatus(`Scraping TikTok${parsed.handle ? ` @${parsed.handle}` : ""}...`);
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

        // Store and run existing TikTok batch pipeline
        const store = await fetch("/api/tiktok/upload", {
          method: "POST",
          body: (() => { const fd = new FormData(); fd.append("json", JSON.stringify(ttVideos)); return fd; })(),
        }).catch(() => null);
        void store;

        const medianViews = calculateMedian(ttVideos.map((v) => v.views));
        setStatus("Computing scores...");
        const enriched = ttVideos.map((v) => enrichVideo(v, medianViews, "tiktok")).sort((a, b) => b.views - a.views);
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

        const relatedEntries = referenceStore ? referenceStore.entries.filter((e) => e.platform === "tiktok") : [];
        const deepAnalysis = computeDeepAnalysis(enriched, null, relatedEntries, "tiktok");
        const batchResult: TikTokBatchAnalysis = { type: "tiktok-batch", videos: enriched, deepAnalysis, topPerformers, competitorBreakdown, referenceContext: relatedEntries };
        setResult(batchResult);
        setLanguageCPA(computeLanguageCPA(enriched));
        setTiktokUploadInfo({ videoCount: ttVideos.length, uploadCount: 1, time: new Date().toLocaleString() });

        const entries = buildReferenceEntry(batchResult);
        const entryArray = Array.isArray(entries) ? entries : [entries];
        if (entryArray.length > 0) {
          fetch("/api/reference-store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryArray) })
            .then(() => { setRefStoreStatus("saved"); refreshReferenceStore(); }).catch(() => {});
        }
        setStatus("");

      } else if (parsed.type === "instagram") {
        // ── Instagram via Apify scraper ──
        setStatus(`Scraping Instagram${parsed.handle ? ` @${parsed.handle}` : ""}...`);
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
        setStatus("Computing scores...");
        const enrichedIG = igVideos.map((v) => enrichVideo(v, medianIG, "tiktok")).sort((a, b) => b.views - a.views);
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

        const igRelated = referenceStore ? referenceStore.entries.filter((e) => e.platform === "tiktok") : [];
        const igDeep = computeDeepAnalysis(enrichedIG, null, igRelated, "tiktok");
        const igBatch: TikTokBatchAnalysis = { type: "tiktok-batch", videos: enrichedIG, deepAnalysis: igDeep, topPerformers: igTopPerformers, competitorBreakdown: igBreakdown, referenceContext: igRelated };
        setResult(igBatch);
        setLanguageCPA(computeLanguageCPA(enrichedIG));
        setStatus("");

      } else if (parsed.type === "unknown") {
        throw new Error("Could not detect input type. Paste a YouTube, TikTok, or Instagram URL / @handle.");
      } else {
        throw new Error(`${parsed.label} — paste a YouTube, TikTok, or Instagram URL.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("");
    }

    setLoading(false);
  };

  // ─── Instagram Save Handler ───
  const saveInstagram = async (inputs: string[]) => {
    const filtered = inputs.map((s) => s.trim()).filter(Boolean);
    if (filtered.length === 0) return;
    setInstagramStatus("Saving...");
    try {
      const res = await fetch("/api/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: filtered }),
      });
      const data = await res.json();
      setInstagramStatus(`Saved ${data.added} new · ${data.total} total queued`);
      setInstagramInput("");
    } catch {
      setInstagramStatus("Failed to save");
    }
    setTimeout(() => setInstagramStatus(""), 3000);
  };

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      {/* ── Apple-style nav bar ── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="max-w-[1024px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-black shrink-0"
              style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-blue))" }}
            >
              FN
            </div>
            <span className="text-[14px] font-semibold tracking-tight" style={{ color: "#f5f5f7" }}>
              FundedNext Intelligence
            </span>
          </div>
          <div className="flex items-center gap-4">
            {keywordBank && (
              <span className="text-[11px] hidden sm:block" style={{ color: "#86868b" }}>
                {keywordBank.categories.niche.length} keywords
              </span>
            )}
            {referenceStore && (
              <span
                className="text-[11px] font-mono px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: refStoreStatus !== "idle" ? "var(--color-accent)" : "#86868b",
                }}
              >
                {referenceStore.entries.length} refs
                {refStoreStatus !== "idle" && " · saved"}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mode selector ── */}
      <div className="max-w-[1024px] mx-auto px-6 pt-4">
        <ModeSelector
          activeModes={activeModes}
          onToggle={toggleMode}
          onSelectAll={selectAll}
          onClear={clearModes}
        />
      </div>

      {/* ── Platform tab switcher + input ── */}
      <div className="max-w-[1024px] mx-auto px-6 pt-6 pb-2">
        {/* Apple segmented control */}
        <div className="flex justify-center mb-6">
          <div
            className="flex p-1 rounded-xl gap-0.5"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {(
              [
                { id: "youtube", label: "YouTube", icon: "▶" },
                { id: "tiktok", label: "TikTok", icon: "♪" },
                { id: "instagram", label: "Instagram", icon: "◎" },
              ] as { id: InputTab; label: string; icon: string }[]
            ).map(({ id, label, icon }) => {
              const active = inputTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setInputTab(id)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium transition-all"
                  style={{
                    background: active ? "rgba(255,255,255,0.12)" : "transparent",
                    color: active ? "#f5f5f7" : "#86868b",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  <span className="text-[10px]">{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* YouTube tab */}
        {inputTab === "youtube" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <UrlInput onAnalyze={analyze} loading={loading} status={status} error={error} />
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="text-[11px]" style={{ color: "#86868b" }}>or bulk import via CSV</span>
              <BulkImporter onComplete={(added) => { if (added > 0) { setRefStoreStatus("saved"); refreshReferenceStore(); } }} />
            </div>
          </div>
        )}

        {/* TikTok tab */}
        {inputTab === "tiktok" && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: "#86868b" }}>
                Paste TikTok URL or @handle
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://tiktok.com/@handle or @username"
                  className="flex-1 rounded-xl px-4 py-3 text-[13px] outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#f5f5f7",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) analyze(val);
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    if (input?.value.trim()) analyze(input.value.trim());
                  }}
                  disabled={loading}
                  className="rounded-xl px-5 py-3 text-[13px] font-semibold"
                  style={{ background: "var(--color-accent)", color: "#000", opacity: loading ? 0.5 : 1 }}
                >
                  {loading ? "..." : "Analyze"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-[11px]" style={{ color: "#86868b" }}>or upload CSV</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <CsvUpload onUpload={analyzeTikTok} loading={loading} lastUpload={tiktokUploadInfo} />
            {status && <div className="text-[11px]" style={{ color: "#86868b" }}>{status}</div>}
            {error && <div className="text-[11px]" style={{ color: "var(--color-vrs-rework)" }}>{error}</div>}
          </div>
        )}

        {/* Instagram tab */}
        {inputTab === "instagram" && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: "#86868b" }}>
                Paste Instagram URLs, handles, or content links (one per line)
              </div>
              <textarea
                value={instagramInput}
                onChange={(e) => setInstagramInput(e.target.value)}
                placeholder={"https://instagram.com/p/...\n@handle\nhttps://instagram.com/reel/..."}
                rows={4}
                className="w-full rounded-xl px-4 py-3 text-[13px] outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f5f5f7",
                }}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    const lines = instagramInput.split("\n").map(s => s.trim()).filter(Boolean);
                    if (lines.length === 1) {
                      const raw = lines[0];
                      // Normalize bare handles to instagram.com URLs so parseInput detects them correctly
                      const normalized = raw.includes("instagram.com")
                        ? raw
                        : `https://www.instagram.com/${raw.replace(/^@/, "")}/`;
                      analyze(normalized);
                    } else {
                      saveInstagram(lines);
                    }
                  }}
                  disabled={!instagramInput.trim()}
                  className="rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all"
                  style={{
                    background: instagramInput.trim() ? "linear-gradient(135deg, #E1306C, #833AB4)" : "rgba(255,255,255,0.05)",
                    color: instagramInput.trim() ? "#fff" : "#86868b",
                  }}
                >
                  Analyze
                </button>
                <button
                  onClick={() => saveInstagram(instagramInput.split("\n"))}
                  disabled={!instagramInput.trim()}
                  className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: instagramInput.trim() ? "#86868b" : "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Queue
                </button>
              </div>
              {instagramStatus && (
                <div className="mt-2 text-[11px]" style={{ color: "var(--color-accent)" }}>
                  {instagramStatus}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-[11px]" style={{ color: "#86868b" }}>or bulk import via CSV</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
              onClick={() => document.getElementById("ig-csv-input")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  saveInstagram(text.split(/\r?\n/).filter((l) => l.trim()));
                };
                reader.readAsText(file);
              }}
            >
              <input
                id="ig-csv-input"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    saveInstagram(text.split(/\r?\n/).filter((l) => l.trim()));
                  };
                  reader.readAsText(file);
                }}
              />
              <div className="text-[13px] font-medium mb-1" style={{ color: "#86868b" }}>
                Drop CSV or TXT file here
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                One URL or handle per line
              </div>
            </div>
            <div
              className="rounded-xl p-4 text-[12px]"
              style={{ background: "rgba(131,58,180,0.08)", border: "1px solid rgba(131,58,180,0.2)", color: "#86868b" }}
            >
              Instagram entries are queued for analysis. Live scraping coming soon.
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-6 pb-8 max-w-[1024px] mx-auto">
        {!result && !loading && (
          <div className="text-center py-16" style={{ color: "#86868b" }}>
            <div className="text-5xl mb-4" style={{ opacity: 0.4 }}>◈</div>
            <div className="text-[17px] font-semibold mb-2" style={{ color: "#f5f5f7" }}>
              {inputTab === "youtube" ? "Paste a YouTube URL to begin" : inputTab === "tiktok" ? "Enter a TikTok handle or upload CSV" : "Add Instagram accounts or content"}
            </div>
            <div className="text-[13px] max-w-[420px] mx-auto leading-relaxed">
              {inputTab === "youtube" ? (
                <>Video URL · Channel URL · @handle · View count forecast at any future date</>
              ) : inputTab === "tiktok" ? (
                <>URL or handle → creator analysis · CSV → batch scoring</>
              ) : (
                <>Queue Instagram accounts and content for analysis</>
              )}
            </div>
          </div>
        )}

        {result?.type === "video" && (
          <div className="mb-4">
            <ViewForecastPanel
              video={result.video}
              forecastDate={forecastDate}
              onDateChange={setForecastDate}
            />
          </div>
        )}

        {result?.type === "video" && (
          <VideoResult
            video={result.video}
            channel={result.channel}
            channelMedian={result.channelMedian}
            recentVideos={result.recentVideos}
            activeModes={activeModes}
            url={lastUrl}
            deepAnalysis={result.deepAnalysis}
            referenceContext={result.referenceContext}
            adjacentVideos={adjacentCtx}
            nicheRanking={nicheRanking}
            languageCPA={languageCPA}
            referenceCount={referenceStore?.entries.length || 0}
            descriptionSEO={descSEO}
            engagementDecay={engDecay}
            thumbnailAnalysis={thumbAnalysis}
            crossPromotion={crossPromo}
            keywordBank={keywordBank}
            publishTimeHeatmap={publishTime}
            competitorGap={competitorGap}
            tagCorrelation={tagCorrelation}
            uploadCadence={uploadCadence}
            hookPatterns={hookPatterns}
            sentimentAnalysis={sentimentAnalysis}
          />
        )}

        {result?.type === "channel" && (
          <ChannelResult
            health={result.health}
            activeModes={activeModes}
            deepAnalysis={result.deepAnalysis}
            referenceContext={result.referenceContext}
          />
        )}

        {result?.type === "tiktok-batch" && (
          <TikTokBatchResult result={result} activeModes={activeModes} />
        )}

        {/* ── Bulk Importer: CSV / URL dump + auto-discography ── */}
        <div className="mt-6">
          <BulkImporter
            onComplete={(added) => {
              if (added > 0) {
                setRefStoreStatus("saved");
                refreshReferenceStore();
              }
            }}
          />
        </div>

        {/* ── Intelligence Tools ── */}
        {keywordBank && (
          <div className="mt-3.5 space-y-3.5">
            <TrendsPanel bank={keywordBank} />
            <ReferencePoolBuilder
              bank={keywordBank}
              onComplete={(added) => {
                if (added > 0) {
                  setRefStoreStatus("saved");
                  refreshReferenceStore();
                }
              }}
            />
          </div>
        )}

        {/* ── Reference Pool Browser ── */}
        {referenceStore && referenceStore.entries.length > 0 && (
          <div className="mt-3.5 space-y-3.5">
            <ReferenceSearch
              entries={referenceStore.entries}
              onRemove={(ids) => {
                setReferenceStore((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    entries: prev.entries.filter((e) => !ids.includes(e.id)),
                  };
                });
              }}
              onBlockCreator={() => {
                setBlocklistKey((k) => k + 1);
                refreshReferenceStore();
              }}
            />
          </div>
        )}

        {/* ── Pool Management Tools ── */}
        <div className="mt-3.5 space-y-3.5">
          <ReferenceUpload
            onUploadComplete={() => {
              setRefStoreStatus("saved");
              refreshReferenceStore();
            }}
          />

          {/* Keyword Bank Manager */}
          {keywordBank && (
            <KeywordBankManager
              bank={keywordBank}
              onChange={(updated) => setKeywordBank(updated)}
            />
          )}

          {/* Hashtag Bank Manager */}
          {hashtagBank && (
            <HashtagBankManager
              bank={hashtagBank}
              onChange={setHashtagBank}
            />
          )}

          {/* Competitor Bank Manager */}
          <CompetitorBankManager
            competitors={competitors}
            onChange={setCompetitors}
          />

          {/* Creator Blocklist */}
          <CreatorBlocklist
            refreshKey={blocklistKey}
            onChange={() => refreshReferenceStore()}
          />
        </div>
      </div>
    </div>
  );
}
