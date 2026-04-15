"use client";

import { useState, useEffect } from "react";
import type {
  ModeId,
  VideoData,
  ChannelData,
  EnrichedVideo,
  ChannelHealth,
  AnalysisResult,
  VideoAnalysis,
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
import ModeSelector from "./ModeSelector";
import UrlInput from "./UrlInput";
import VideoResult from "./VideoResult";
import ChannelResult from "./ChannelResult";
import CsvUpload from "./CsvUpload";
import TikTokBatchResult from "./TikTokBatchResult";
import ReferenceSearch from "./ReferenceSearch";
import ReferenceUpload from "./ReferenceUpload";
import ReferencePoolBuilder from "./ReferencePoolBuilder";
import ReverseEngineerPanel from "./ReverseEngineerPanel";
import KeywordBankManager from "./KeywordBankManager";
import HashtagBankManager from "./HashtagBankManager";
import CompetitorBankManager from "./CompetitorBankManager";
import type { Competitor } from "./CompetitorBankManager";
import CreatorBlocklist from "./CreatorBlocklist";
import ViewForecastPanel from "./ViewForecastPanel";
import StarfieldCanvas from "./StarfieldCanvas";
import CursorGlow from "./CursorGlow";
import MetricCard from "./MetricCard";

type InputTab = "youtube" | "youtube_short" | "tiktok" | "instagram";

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
  const [tiktokInputVal, setTiktokInputVal] = useState("");
  const [youtubeShortInput, setYoutubeShortInput] = useState("");
  const [activePanel, setActivePanel] = useState<"libraries" | "ref-tools" | "reverse-engineer" | null>(null);

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
      .then((store: ReferenceStore) => {
        setReferenceStore(store);
      })
      .catch(() => {});
    // Also refresh keyword bank since pool expansions can add new keywords
    fetch("/api/keyword-bank")
      .then((r) => r.json())
      .then((bank: KeywordBank) => setKeywordBank(bank))
      .catch(() => {});
  };

  const toggleMode = (id: ModeId) => {
    setActiveModes((prev: ModeId[]) =>
      prev.includes(id) ? prev.filter((m: ModeId) => m !== id) : [...prev, id]
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
        const relatedEntries = referenceStore ? referenceStore.entries.filter((e) => e.platform === "tiktok") : [];

        // Single video URL → promote to VideoAnalysis (same rich display as YouTube)
        const isSingleVideo = parsed.url?.includes("/video/") && enriched.length === 1;
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
          const videoResult: VideoAnalysis = { type: "video", video: v, channel: ttChannel, channelMedian: v.views, recentVideos: [v], deepAnalysis: deepSingle, referenceContext: relatedEntries };
          setResult(videoResult);
          setLanguageCPA(computeLanguageCPA([v]));
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
        const igRelated = referenceStore ? referenceStore.entries.filter((e) => e.platform === "tiktok") : [];

        // Single post/reel URL → promote to VideoAnalysis (same rich display as YouTube)
        const isIgSingle = (parsed.url?.includes("/reel/") || parsed.url?.includes("/p/")) && enrichedIG.length === 1;
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
          const igDeepSingle = computeDeepAnalysis([v], null, igRelated, "tiktok");
          const igVideoResult: VideoAnalysis = { type: "video", video: v, channel: igChannel, channelMedian: v.views, recentVideos: [v], deepAnalysis: igDeepSingle, referenceContext: igRelated };
          setResult(igVideoResult);
          setLanguageCPA(computeLanguageCPA([v]));
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
          const igDeep = computeDeepAnalysis(enrichedIG, null, igRelated, "tiktok");
          const igBatch: TikTokBatchAnalysis = { type: "tiktok-batch", videos: enrichedIG, deepAnalysis: igDeep, topPerformers: igTopPerformers, competitorBreakdown: igBreakdown, referenceContext: igRelated };
          setResult(igBatch);
          setLanguageCPA(computeLanguageCPA(enrichedIG));
        }
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


  // ─── Platform config ───
  const PLATFORMS = [
    { id: "youtube"       as InputTab, label: "YT Long-form", short: "YTL", color: "#EF4444", icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.13C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.56A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.12C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.57a3.02 3.02 0 0 0 2.12-2.12C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.85 12l-6.1 3.52z"/></svg>
    ) },
    { id: "youtube_short" as InputTab, label: "YT Shorts",   short: "YTS", color: "#EC4899", icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.56 10.75l-3.88-2.24A2.47 2.47 0 0 0 10 10.63v2.74a2.47 2.47 0 0 0 3.68 2.12l3.88-2.24a2.47 2.47 0 0 0 0-4.5z"/><path d="M8.5 2a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z" fillOpacity=".35"/></svg>
    ) },
    { id: "tiktok"        as InputTab, label: "TikTok",      short: "TTK", color: "#06B6D4", icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.87a8.17 8.17 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1-.31z"/></svg>
    ) },
    { id: "instagram"     as InputTab, label: "Instagram",   short: "IGR", color: "#E1306C", icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="5.5" ry="5.5" fillOpacity=".2" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="18" cy="6" r="1.2"/></svg>
    ) },
  ] as const;

  const activePlatform = PLATFORMS.find(p => p.id === inputTab)!;

  return (
    <div className="flex min-h-screen" style={{ background: "#000000", color: "#E8E6E1", position: "relative" }}>

      {/* ── Background layers (z:0) ── */}
      <StarfieldCanvas opacity={0.55} />
      <CursorGlow />

      {/* Ambient nebula behind sidebar */}
      <div style={{
        position: "fixed", top: "-10%", left: -80, width: 480, height: 600,
        background: "radial-gradient(ellipse at 0% 40%, rgba(96,165,250,0.055) 0%, rgba(123,79,255,0.03) 50%, transparent 75%)",
        pointerEvents: "none", zIndex: 1,
        animation: "nebulaDrift 25s ease-in-out infinite alternate",
      }} />

      {/* ══════════════════════════════════════
          SIDEBAR — 240px fixed
      ══════════════════════════════════════ */}
      <aside
        className="glass-deep fixed left-0 top-0 bottom-0 flex flex-col z-40"
        style={{ width: 240, overflowY: "auto", overflowX: "hidden" }}
      >
        {/* ── Logo ── */}
        <div
          className="flex items-center gap-2.5 shrink-0 px-4"
          style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.055)" }}
        >
          <div
            className="flex items-center justify-center shrink-0 font-extrabold"
            style={{
              width: 28, height: 28, borderRadius: 7, fontSize: 10,
              background: "linear-gradient(135deg, #3B82F6 0%, #2ECC8A 100%)",
              color: "#000",
              boxShadow: "0 0 0 1px rgba(96,165,250,0.3), 0 0 16px rgba(96,165,250,0.2)",
            }}
          >
            FN
          </div>
          <div>
            <div className="gradient-text-brand font-semibold" style={{ fontSize: 13, letterSpacing: "-0.02em" }}>
              FundedNext Intel
            </div>
            <div className="font-mono" style={{ fontSize: 8, color: "#4A4845", letterSpacing: "0.1em" }}>
              PLATFORM INTELLIGENCE
            </div>
          </div>
        </div>

        {/* ── Platform ── */}
        <div className="px-2 pt-4 pb-2">
          <div className="font-mono px-2 mb-2" style={{ fontSize: 9, color: "#4A4845", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Platform
          </div>
          {PLATFORMS.map(({ id, label, color, icon }) => {
            const active = inputTab === id;
            return (
              <button
                key={id}
                onClick={() => setInputTab(id)}
                className="nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left mb-0.5 cursor-pointer"
                style={{
                  borderLeftColor: active ? color : "transparent",
                  color: active ? "#E8E6E1" : "#6B6860",
                  fontSize: 12.5, fontWeight: active ? 500 : 400,
                  boxShadow: active ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px ${color}08` : "none",
                }}
              >
                <span style={{ color: active ? color : "#3A3835", opacity: active ? 1 : 0.7 }}>{icon}</span>
                {label}
                {active && (
                  <span
                    className="ml-auto font-mono"
                    style={{ fontSize: 8, color, background: `${color}18`, border: `1px solid ${color}30`, padding: "1px 5px", borderRadius: 4 }}
                  >
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="glass-divider mx-3 my-1.5" />

        {/* ── Analysis Modes ── */}
        <div className="px-2 py-2">
          <div className="font-mono px-2 mb-2" style={{ fontSize: 9, color: "#4A4845", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Analysis Modes
          </div>
          <ModeSelector activeModes={activeModes} onToggle={toggleMode} onSelectAll={selectAll} onClear={clearModes} />
        </div>

        <div className="glass-divider mx-3 my-1.5" />

        {/* ── Reference Pool ── */}
        <div className="px-4 py-3">
          <div className="font-mono mb-2" style={{ fontSize: 9, color: "#4A4845", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Reference Pool
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { value: referenceStore?.entries.filter(e => e.type === "video").length ?? 0, label: "Videos",   color: "#2ECC8A" },
              { value: referenceStore ? new Set(referenceStore.entries.map(e => e.channelName)).size : 0, label: "Creators", color: "#60A5FA" },
              { value: referenceStore?.entries.filter(e => e.type === "video" && (e.durationSeconds ?? 999) <= 60).length ?? 0, label: "Shorts", color: "#EC4899" },
              { value: keywordBank?.categories.niche.length ?? 0, label: "Keywords", color: "#F59E0B" },
            ].map(({ value, label, color }) => (
              <div
                key={label}
                className="pool-stat cursor-default"
              >
                <div
                  className="font-mono font-bold leading-none"
                  style={{ fontSize: 17, color, textShadow: `0 0 8px ${color}44` }}
                >
                  {typeof value === "number" && value >= 1000 ? `${(value/1000).toFixed(1)}K` : value}
                </div>
                <div className="font-mono mt-0.5" style={{ fontSize: 9, color: "#6B6860", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
          {refStoreStatus !== "idle" && (
            <div className="flex items-center gap-1.5 mt-2 font-mono" style={{ fontSize: 10, color: "#2ECC8A" }}>
              <span>✦</span> Saved to pool
            </div>
          )}
        </div>

        <div className="glass-divider mx-3 my-1.5" />

        {/* ── Tools ── */}
        <div className="px-2 py-2">
          <div className="font-mono px-2 mb-2" style={{ fontSize: 9, color: "#4A4845", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Tools
          </div>

          {/* Reverse Engineer */}
          {(() => {
            const active = activePanel === "reverse-engineer";
            return (
              <button
                onClick={() => {
                  const next = active ? null : "reverse-engineer";
                  setActivePanel(next);
                  if (next === "reverse-engineer" && !activeModes.includes("D")) toggleMode("D");
                }}
                className="nav-item w-full text-left px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer"
                style={{
                  borderLeftColor: active ? "#F59E0B" : "transparent",
                  boxShadow: active ? "0 0 16px rgba(245,158,11,0.06)" : "none",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ color: active ? "#F59E0B" : "#3A3835", fontSize: 14 }}>⚙</span>
                  <div className="flex-1">
                    <div style={{ fontSize: 12, fontWeight: 500, color: active ? "#E8E6E1" : "#9E9C97" }}>Reverse Engineer</div>
                    <div style={{ fontSize: 10, color: "#4A4845", marginTop: 1 }}>Script · Hook · Title</div>
                  </div>
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                      background: active ? "rgba(245,158,11,0.15)" : "#111110",
                      color: active ? "#F59E0B" : "#6B6860",
                      border: active ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent" }}
                  >
                    D
                  </span>
                </div>
              </button>
            );
          })()}

          {/* Libraries / Reference Tools */}
          {([ 
            { id: "libraries" as const,  label: "Libraries",       icon: "◧", desc: "Keywords · Tags · Competitors" },
            { id: "ref-tools" as const, label: "Reference Tools",  icon: "⊞", desc: "Upload · Browse · Build pool"  },
          ] as const).map(({ id, label, icon, desc }) => {
            const active = activePanel === id;
            return (
              <button
                key={id}
                onClick={() => setActivePanel(active ? null : id)}
                className="nav-item w-full text-left px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer"
                style={{
                  borderLeftColor: active ? "#60A5FA" : "transparent",
                  boxShadow: active ? "0 0 16px rgba(96,165,250,0.05)" : "none",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ color: active ? "#60A5FA" : "#3A3835", fontSize: 14 }}>{icon}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: 12, fontWeight: 500, color: active ? "#E8E6E1" : "#9E9C97" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#4A4845", marginTop: 1 }}>{desc}</div>
                  </div>
                  <span style={{
                    fontSize: 12, color: active ? "#60A5FA" : "#3A3835",
                    transform: active ? "rotate(90deg)" : "none",
                    display: "inline-block", transition: "transform 0.2s",
                  }}>›</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* ── Footer ── */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="font-mono" style={{ fontSize: 9, color: "#4A4845", letterSpacing: "0.08em" }}>
            FUNDEDNEXT · INTERNAL
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN CONTENT — offset 240px
      ══════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: 240, position: "relative", zIndex: 2 }}>

        {/* ── Sticky topbar ── */}
        <div
          className="glass-nav sticky top-0 z-30 flex items-center gap-3 px-5"
          style={{ height: 56, minHeight: 56 }}
        >
          {/* Platform badge */}
          <div
            className="shrink-0 flex items-center gap-1.5 font-mono font-semibold rounded-lg px-2.5 py-1.5"
            style={{
              fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
              background: `${activePlatform.color}12`,
              border: `1px solid ${activePlatform.color}30`,
              color: activePlatform.color,
            }}
          >
            {activePlatform.icon}
            {activePlatform.short}
          </div>

          {/* ── Input — adapts per platform ── */}
          {inputTab === "youtube" && (
            <div className="flex-1">
              <UrlInput onAnalyze={analyze} loading={loading} status={status} error={error} />
            </div>
          )}

          {inputTab === "youtube_short" && (
            <div className="flex-1 flex gap-2 items-center">
              <div
                className="flex-1 flex items-center gap-2 rounded-[9px] px-3.5"
                style={{
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#EC4899" opacity={0.6}>
                  <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9.75 15.52V8.48L15.85 12l-6.1 3.52z" fill="#EC4899"/>
                </svg>
                <input
                  type="text" value={youtubeShortInput}
                  onChange={e => setYoutubeShortInput(e.target.value)}
                  placeholder="YouTube Shorts URL or @channel..."
                  className="flex-1 bg-transparent border-none outline-none text-[13px] py-2.5"
                  style={{ color: "#E8E6E1", caretColor: "#EC4899" }}
                  onKeyDown={e => { if (e.key === "Enter" && youtubeShortInput.trim()) analyze(youtubeShortInput.trim()); }}
                />
              </div>
              <button
                onClick={() => { if (youtubeShortInput.trim()) analyze(youtubeShortInput.trim()); }}
                disabled={loading || !youtubeShortInput.trim()}
                className="btn-cosmic shrink-0"
                style={{ background: "linear-gradient(135deg, #BE185D, #EC4899)", height: 40, padding: "0 20px" }}
              >
                {loading ? <span className="orbital-loader" style={{ borderTopColor: "#EC4899" }} /> : "Analyze"}
              </button>
            </div>
          )}

          {inputTab === "tiktok" && (
            <div className="flex-1 flex gap-2 items-center">
              <div
                className="flex-1 flex items-center gap-2 rounded-[9px] px-3.5"
                style={{
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#06B6D4" opacity={0.7}>
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.87a8.17 8.17 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1-.31z"/>
                </svg>
                <input
                  type="text" value={tiktokInputVal}
                  onChange={e => setTiktokInputVal(e.target.value)}
                  placeholder="@handle or tiktok.com/..."
                  className="flex-1 bg-transparent border-none outline-none text-[13px] py-2.5"
                  style={{ color: "#E8E6E1", caretColor: "#06B6D4" }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tiktokInputVal.trim()) {
                      const v = tiktokInputVal.trim();
                      analyze(v.includes("tiktok.com") ? v : `https://www.tiktok.com/@${v.replace(/^@/, "")}`);
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const v = tiktokInputVal.trim();
                  if (v) analyze(v.includes("tiktok.com") ? v : `https://www.tiktok.com/@${v.replace(/^@/, "")}`);
                }}
                disabled={loading || !tiktokInputVal.trim()}
                className="btn-cosmic shrink-0"
                style={{ background: "linear-gradient(135deg, #0E7490, #06B6D4)", color: "#000", height: 40, padding: "0 20px" }}
              >
                {loading ? <span className="orbital-loader" style={{ borderTopColor: "#06B6D4" }} /> : "Analyze"}
              </button>
              <div className="shrink-0">
                <CsvUpload onUpload={analyzeTikTok} loading={loading} lastUpload={tiktokUploadInfo} />
              </div>
            </div>
          )}

          {inputTab === "instagram" && (
            <div className="flex-1 flex gap-2 items-center">
              <div
                className="flex-1 flex items-center gap-2 rounded-[9px] px-3.5"
                style={{
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.8" opacity={0.7}>
                  <rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="18.5" cy="5.5" r="1.5" fill="#E1306C"/>
                </svg>
                <input
                  type="text" value={instagramInput}
                  onChange={e => setInstagramInput(e.target.value)}
                  placeholder="@handle or instagram.com/reel/..."
                  className="flex-1 bg-transparent border-none outline-none text-[13px] py-2.5"
                  style={{ color: "#E8E6E1", caretColor: "#E1306C" }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && instagramInput.trim()) {
                      const v = instagramInput.trim();
                      analyze(v.includes("instagram.com") ? v : `https://www.instagram.com/${v.replace(/^@/, "")}/`);
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const v = instagramInput.trim();
                  if (!v) return;
                  analyze(v.includes("instagram.com") ? v : `https://www.instagram.com/${v.replace(/^@/, "")}/`);
                }}
                disabled={loading || !instagramInput.trim()}
                className="btn-cosmic shrink-0"
                style={{ background: "linear-gradient(135deg, #9D174D, #E1306C)", height: 40, padding: "0 20px" }}
              >
                {loading ? <span className="orbital-loader" style={{ borderTopColor: "#E1306C" }} /> : "Analyze"}
              </button>
              <button
                onClick={() => saveInstagram(instagramInput.split("\n"))}
                disabled={!instagramInput.trim()}
                className="btn-ghost shrink-0"
                style={{ height: 40, padding: "0 14px" }}
              >
                Queue
              </button>
            </div>
          )}

          {/* Status + error chips */}
          {status && !loading && (
            <span className="status-chip status-success shrink-0">
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2ECC8A", display: "inline-block" }} />
              {status}
            </span>
          )}
          {error && (
            <span className="status-chip status-error shrink-0">
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF4D6A", display: "inline-block" }} />
              {error}
            </span>
          )}
          {instagramStatus && (
            <span className="status-chip status-success shrink-0">{instagramStatus}</span>
          )}
        </div>

        {/* ── Page body ── */}
        <div className="flex-1 p-5" style={{ position: "relative", zIndex: 2 }}>

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="space-y-4 fade-up">
              <div className="flex items-center gap-2 mb-5">
                <span className="orbital-loader" />
                <span className="font-mono text-[11px]" style={{ color: "#6B6860" }}>
                  {status || "Fetching data…"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 80, animationDelay: `${i*0.12}s` }} />
                ))}
              </div>
              <div className="skeleton" style={{ height: 200, animationDelay: "0.48s" }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="skeleton" style={{ height: 140, animationDelay: "0.6s" }} />
                <div className="skeleton" style={{ height: 140, animationDelay: "0.72s" }} />
              </div>
            </div>
          )}

          {/* ── Reverse Engineer panel ── */}
          {!loading && activePanel === "reverse-engineer" && (
            <div className="mb-5 fade-up">
              <ReverseEngineerPanel
                platform={inputTab === "youtube_short" ? "youtube_short" : inputTab}
                result={result}
                loading={loading}
                onAnalyze={(input) => {
                  const normalized =
                    inputTab === "tiktok" && !input.includes("tiktok.com")
                      ? `https://www.tiktok.com/@${input.replace(/^@/, "")}`
                      : inputTab === "instagram" && !input.includes("instagram.com")
                        ? `https://www.instagram.com/${input.replace(/^@/, "")}/`
                        : inputTab === "youtube_short" && !input.includes("youtube.com") && !input.includes("youtu.be")
                          ? input.startsWith("@") ? `https://www.youtube.com/${input}` : `https://www.youtube.com/shorts/${input}`
                          : input;
                  analyze(normalized);
                }}
                onRetry={() => { if (lastUrl) analyze(lastUrl); }}
              />
            </div>
          )}

          {/* ── Libraries panel ── */}
          {!loading && activePanel === "libraries" && (
            <div className="mb-5 space-y-4 fade-up">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="font-semibold" style={{ fontSize: 15, color: "#E8E6E1" }}>Libraries</h2>
                  <p className="font-mono" style={{ fontSize: 10, color: "#4A4845", marginTop: 2, letterSpacing: "0.06em" }}>
                    KEYWORDS · HASHTAGS · COMPETITORS · BLOCKLIST
                  </p>
                </div>
                <button onClick={() => setActivePanel(null)} className="btn-ghost">✕ Close</button>
              </div>
              {keywordBank && <KeywordBankManager bank={keywordBank} onChange={updated => setKeywordBank(updated)} />}
              {hashtagBank && <HashtagBankManager bank={hashtagBank} onChange={setHashtagBank} />}
              <CompetitorBankManager competitors={competitors} onChange={setCompetitors} />
              <CreatorBlocklist refreshKey={blocklistKey} onChange={() => refreshReferenceStore()} />
            </div>
          )}

          {/* ── Reference Tools panel ── */}
          {!loading && activePanel === "ref-tools" && (
            <div className="mb-5 space-y-4 fade-up">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="font-semibold" style={{ fontSize: 15, color: "#E8E6E1" }}>Reference Tools</h2>
                  <p className="font-mono" style={{ fontSize: 10, color: "#4A4845", marginTop: 2, letterSpacing: "0.06em" }}>
                    UPLOAD · BROWSE · BUILD POOL
                  </p>
                </div>
                <button onClick={() => setActivePanel(null)} className="btn-ghost">✕ Close</button>
              </div>
              <ReferenceUpload onUploadComplete={() => { setRefStoreStatus("saved"); refreshReferenceStore(); }} />
              {referenceStore && referenceStore.entries.length > 0 && (
                <ReferenceSearch
                  entries={referenceStore.entries}
                  onRemove={ids => {
                    setReferenceStore(prev => prev ? { ...prev, entries: prev.entries.filter(e => !ids.includes(e.id)) } : prev);
                  }}
                  onBlockCreator={() => { setBlocklistKey(k => k + 1); refreshReferenceStore(); }}
                />
              )}
              {keywordBank && (
                <ReferencePoolBuilder
                  bank={keywordBank}
                  onComplete={() => { setRefStoreStatus("saved"); refreshReferenceStore(); }}
                  onBatchSaved={() => refreshReferenceStore()}
                />
              )}
            </div>
          )}

          {/* ── Empty state ── */}
          {!result && !loading && activePanel === null && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
              {/* Nebula glow */}
              <div style={{
                position: "absolute", width: 500, height: 500, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, rgba(123,79,255,0.03) 40%, transparent 68%)",
                pointerEvents: "none", animation: "glowPulse 6s ease-in-out infinite",
              }} />

              {/* Platform mega-icon */}
              <div
                className="relative mb-6 flex items-center justify-center"
                style={{
                  width: 80, height: 80,
                  borderRadius: 20,
                  background: `${activePlatform.color}0E`,
                  border: `1px solid ${activePlatform.color}22`,
                  boxShadow: `0 0 40px ${activePlatform.color}18, 0 0 80px ${activePlatform.color}0A`,
                  animation: "glowPulse 4s ease-in-out infinite",
                }}
              >
                <span style={{ fontSize: 32, opacity: 0.6, color: activePlatform.color }}>{activePlatform.icon}</span>
              </div>

              <h2 className="font-semibold mb-2 fade-up-1" style={{ fontSize: 20, color: "#E8E6E1" }}>
                {inputTab === "youtube"       ? "Analyze any YouTube content"
                 : inputTab === "tiktok"      ? "Analyze TikTok creators"
                 : inputTab === "youtube_short"? "Analyze YouTube Shorts"
                 :                              "Analyze Instagram accounts"}
              </h2>
              <p className="text-center fade-up-2" style={{ fontSize: 13, color: "#6B6860", maxWidth: 380, lineHeight: 1.7 }}>
                {inputTab === "youtube"
                  ? "Paste a video URL, channel URL, or @handle above. Get view forecast, VRS score, and growth signals."
                  : inputTab === "tiktok"
                  ? "Enter a handle or profile URL to pull creator analytics and virality signals."
                  : inputTab === "youtube_short"
                  ? "Paste a Shorts URL or @channel to analyze short-form performance."
                  : "Enter a handle or reel URL to pull Instagram analytics."}
              </p>

              {/* Pool quick stats */}
              {referenceStore && referenceStore.entries.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-sm fade-up-3">
                  {[
                    { label: "Pool videos",  value: referenceStore.entries.length, color: "#2ECC8A" },
                    { label: "Avg views",    value: Math.round(referenceStore.entries.reduce((s, e) => s + (e.metrics?.views || 0), 0) / Math.max(referenceStore.entries.length, 1)).toLocaleString(), color: "#60A5FA" },
                    { label: "Creators",     value: new Set(referenceStore.entries.map(e => e.channelName)).size, color: "#F59E0B" },
                  ].map(({ label, value, color }, i) => (
                    <MetricCard key={label} label={label} value={String(value)} color={color} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Video result ── */}
          {!loading && result?.type === "video" && (() => {
            const v  = result.video;
            const ch = result.channel;
            const metrics = [
              { label: "Total Views",  value: v.views.toLocaleString(),         color: "#2ECC8A", tip: "Total lifetime views" },
              { label: "Likes",        value: v.likes.toLocaleString(),         color: "#60A5FA", tip: "Total likes" },
              { label: "Engagement",   value: `${v.engagement.toFixed(2)}%`,    color: "#F59E0B", tip: "Likes + comments / views" },
              { label: "Velocity",     value: `${v.velocity.toLocaleString()}/d`,color: "#A78BFA", tip: "Avg views/day since publish" },
              ...(ch ? [{ label: "Subscribers", value: `${(ch.subs/1000).toFixed(0)}K`, color: "#EF4444", tip: "Channel subs" }] : []),
              ...(ch ? [{ label: "Ch. Median",  value: result.channelMedian.toLocaleString(), color: "#06B6D4", tip: "Median views/video on channel" }] : []),
            ];
            return (
              <div className="space-y-5">
                <div className="grid gap-3 fade-up" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
                  {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} />)}
                </div>
                <div className="fade-up-1">
                  <ViewForecastPanel video={v} forecastDate={forecastDate} onDateChange={setForecastDate} />
                </div>
                <div className="fade-up-2">
                  <VideoResult
                    video={v} channel={ch}
                    channelMedian={result.channelMedian}
                    recentVideos={result.recentVideos}
                    activeModes={activeModes} url={lastUrl}
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
                  />
                </div>
              </div>
            );
          })()}

          {/* ── Channel result ── */}
          {!loading && result?.type === "channel" && (
            <div className="fade-up">
              <ChannelResult
                health={result.health}
                activeModes={activeModes}
                deepAnalysis={result.deepAnalysis}
                referenceContext={result.referenceContext}
              />
            </div>
          )}

          {/* ── TikTok / Instagram batch ── */}
          {!loading && result?.type === "tiktok-batch" && (() => {
            const videos   = result.videos;
            const total    = videos.reduce((s, v) => s + v.views, 0);
            const avgEng   = videos.reduce((s, v) => s + v.engagement, 0) / Math.max(videos.length, 1);
            const topVideo = videos[0];
            const metrics  = [
              { label: "Videos",       value: videos.length.toLocaleString(), color: "#2ECC8A", tip: "Posts scraped" },
              { label: "Total Views",  value: `${(total/1000).toFixed(0)}K`,  color: "#60A5FA", tip: "Combined views" },
              { label: "Avg Engage",   value: `${avgEng.toFixed(2)}%`,         color: "#F59E0B", tip: "Avg engagement rate" },
              { label: "Top Views",    value: topVideo ? `${(topVideo.views/1000).toFixed(0)}K` : "—", color: "#A78BFA", tip: "Highest view count" },
              { label: "Creators",     value: new Set(videos.map(v => v.channel)).size.toLocaleString(), color: "#EF4444", tip: "Unique creators" },
            ];
            return (
              <div className="space-y-5">
                <div className="grid gap-3 fade-up" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
                  {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} />)}
                </div>
                {topVideo && (
                  <div className="fade-up-1">
                    <ViewForecastPanel video={topVideo} forecastDate={forecastDate} onDateChange={setForecastDate} />
                  </div>
                )}
                <div className="fade-up-2">
                  <TikTokBatchResult result={result} activeModes={activeModes} />
                </div>
              </div>
            );
          })()}

        </div>
      </main>
    </div>
  );
}
