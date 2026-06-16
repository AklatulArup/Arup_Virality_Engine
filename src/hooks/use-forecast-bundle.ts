"use client";

// ═══════════════════════════════════════════════════════════════════════════
// useForecastBundle — the data layer of the legacy ForecastPanel, extracted.
// ═══════════════════════════════════════════════════════════════════════════
//
// Owns every fetch + compute that feeds forecast():
//   velocity samples · thumbnail-CTR + hook-strength AI estimates (with the
//   aiEstimatedKeys discipline) · per-platform comments → sentiment · market
//   volatility · tuning overrides (+ failure flag) · conformal + decay tables ·
//   per-creator analytics memory (hydrate fill-empty-only, save debounced
//   excluding AI keys) · OCR + CSV ingestion · seasonality / niche /
//   reputation / cross-platform-reputation computes · the forecast() call
//   through ONE assembleForecastInput choke-point (all optional params made
//   mandatory keys so none can silently drop) · calibration snapshot ·
//   custom-date projection.
//
// Transplanted behavior-for-behavior from ForecastPanel.tsx; the eslint
// disables below follow the repo's documented React Compiler conventions.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forecast,
  projectAtDate,
  PLATFORM_CONFIG,
  type Forecast,
  type ForecastInput,
  type ManualInputs,
  type Platform,
  type DateProjection,
} from "@/lib/forecast";
import type { ConformalTable } from "@/lib/conformal";
import type { DecayTable } from "@/lib/decay-fit";
import type { PriorCorrectionTable } from "@/lib/prior-correction";
import { estimateEarlyShare, type EarlyShareSignal } from "@/lib/early-share";
import {
  computeDayOfWeekProfile,
  fetchMarketVolatility,
  combineSeasonality,
  type DayOfWeekProfile,
  type MarketVolatilityProfile,
} from "@/lib/seasonality";
import { classifyCreatorNiche, nicheAdjustment } from "@/lib/niche-classifier";
import { MIN_FORMAT_SIBLINGS, selectBaselineSiblings } from "@/lib/video-classifier";
import { assessCreatorReputation } from "@/lib/reputation";
import { assessCrossPlatformReputation } from "@/lib/cross-platform-reputation";
import { recordForecast } from "@/lib/forecast-learning";
import type { EnrichedVideo, VideoData } from "@/lib/types";
import { usePool } from "@/hooks/use-pool";
import { fetchOnce } from "@/hooks/fetch-once";

export interface VelocitySample {
  ageHours: number;
  views: number;
  velocity: number;
  acceleration: number;
}

export interface ThumbnailScore {
  estimatedCTR: number;
  totalPoints: number;
  maxPoints: number;
  rationale: string;
  ctrConfidence: string;
}

export interface HookScore {
  totalPoints: number;
  maxPoints: number;
  percent: number;
  dominantFormula: string;
  confidence: string;
  rationale: string;
  estimatedCompletionPct: number;
  estimatedHold3sPct: number;
}

export interface IngestStatus {
  kind: "working" | "done" | "error";
  message: string;
}

// Every optional ForecastInput field the bundle threads is a MANDATORY key
// here (values keep their original possibly-undefined types). Dropping one in
// a refactor becomes a compile error instead of a silently degraded forecast.
interface AssembledForecastInput {
  video: ForecastInput["video"];
  creatorHistory: ForecastInput["creatorHistory"];
  platform: ForecastInput["platform"];
  manualInputs: NonNullable<ForecastInput["manualInputs"]>;
  velocitySamples: NonNullable<ForecastInput["velocitySamples"]>;
  seasonalityMultiplier: NonNullable<ForecastInput["seasonalityMultiplier"]>;
  seasonalityRationales: NonNullable<ForecastInput["seasonalityRationales"]>;
  sentimentScore: ForecastInput["sentimentScore"];
  sentimentRationale: ForecastInput["sentimentRationale"];
  nicheMultiplier: NonNullable<ForecastInput["nicheMultiplier"]>;
  nicheLabel: NonNullable<ForecastInput["nicheLabel"]>;
  nicheRationale: NonNullable<ForecastInput["nicheRationale"]>;
  reputationMultiplier: NonNullable<ForecastInput["reputationMultiplier"]>;
  reputationRationale: NonNullable<ForecastInput["reputationRationale"]>;
  crossPlatformMultiplier: NonNullable<ForecastInput["crossPlatformMultiplier"]>;
  crossPlatformRationale: NonNullable<ForecastInput["crossPlatformRationale"]>;
  configOverrides: NonNullable<ForecastInput["configOverrides"]>;
  conformalTable: ForecastInput["conformalTable"];
  decayTable: ForecastInput["decayTable"];
  earlyShareSignal: ForecastInput["earlyShareSignal"];
  priorCorrection: ForecastInput["priorCorrection"];
  aiEstimatedKeys: NonNullable<ForecastInput["aiEstimatedKeys"]>;
}

function assembleForecastInput(input: AssembledForecastInput): ForecastInput {
  return input;
}

// `estimatorHistory` is the wider sibling list (up to 50 uploads on YouTube
// vs creatorHistory's 12) and feeds exactly two consumers: estimateEarlyShare
// (needs siblings aged 21d+, unreachable in a 12-video window on daily-upload
// channels) and the format-matched baseline widening (recovers same-format
// siblings when the recent 12 are dominated by the other format). Everything
// else stays on creatorHistory. Mandatory param so a call site can't silently
// drop it.
export function useForecastBundle(video: EnrichedVideo, creatorHistory: VideoData[], platform: Platform, estimatorHistory: VideoData[]) {
  const { entries: poolEntries } = usePool();

  const [manualInputs, setManualInputs] = useState<ManualInputs>({});
  const [aiEstimatedKeys, setAiEstimatedKeys] = useState<Set<keyof ManualInputs>>(new Set());
  const [thumbnailCTR, setThumbnailCTR] = useState<ThumbnailScore | null>(null);
  const [hookStrength, setHookStrength] = useState<HookScore | null>(null);

  // ── Velocity samples (abort-guarded against out-of-order resolution) ──
  const [velocitySamples, setVelocitySamples] = useState<VelocitySample[]>([]);
  useEffect(() => {
    if (!video.id || typeof window === "undefined") return;
    const ctrl = new AbortController();
    fetch(`/api/forecast/velocity?videoId=${encodeURIComponent(video.id)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.samples)) setVelocitySamples(d.samples);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [video.id]);

  // ── Thumbnail-CTR predictor (YouTube long-form only) ──
  // Shorts are excluded deliberately: the Shorts feed auto-plays, so a
  // thumbnail never gates distribution there — scoring it burned a Gemini
  // call per Shorts analysis to produce a noise signal.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (platform !== "youtube") return;
    if (!video.thumbnail) return;
    // Real CTR (typed or OCR'd) always beats an AI estimate — don't refetch.
    if (manualInputs.ytCTRpct != null && !aiEstimatedKeys.has("ytCTRpct")) return;
    fetch(`/api/thumbnail/score?url=${encodeURIComponent(video.thumbnail)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok || !d.score) return;
        const s = d.score as ThumbnailScore;
        setThumbnailCTR(s);
        setManualInputs((prev) =>
          prev.ytCTRpct != null && !aiEstimatedKeys.has("ytCTRpct") ? prev : { ...prev, ytCTRpct: s.estimatedCTR },
        );
        setAiEstimatedKeys((prev) => new Set(prev).add("ytCTRpct"));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.thumbnail, platform]);

  // ── Hook-strength predictor (TikTok / Instagram only) ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (platform !== "tiktok" && platform !== "instagram") return;
    if (!video.thumbnail) return;

    const targetKey: keyof ManualInputs = platform === "tiktok" ? "ttCompletionPct" : "igHold3s";
    if (manualInputs[targetKey] != null && !aiEstimatedKeys.has(targetKey)) return;

    const caption = typeof video.title === "string" ? video.title : "";
    const qs = new URLSearchParams({
      url: video.thumbnail,
      platform,
      caption: caption.slice(0, 500),
    });
    fetch(`/api/hook/score?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok || !d.score) return;
        const s = d.score as HookScore;
        setHookStrength(s);
        const autoValue = platform === "tiktok" ? s.estimatedCompletionPct : s.estimatedHold3sPct;
        setManualInputs((prev) =>
          prev[targetKey] != null && !aiEstimatedKeys.has(targetKey) ? prev : { ...prev, [targetKey]: autoValue },
        );
        setAiEstimatedKeys((prev) => new Set(prev).add(targetKey));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.thumbnail, video.title, platform]);

  // ── Seasonality: day-of-week (local) + market volatility (shared fetch) ──
  const dowProfile: DayOfWeekProfile | null = useMemo(
    () => computeDayOfWeekProfile(video, creatorHistory),
    [video, creatorHistory],
  );
  const [marketVol, setMarketVol] = useState<MarketVolatilityProfile | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchOnce("market-volatility", fetchMarketVolatility)
      .then(setMarketVol)
      .catch(() => {});
  }, []);
  const seasonality = useMemo(
    () => combineSeasonality({ dayOfWeek: dowProfile, marketVolatility: marketVol }),
    [dowProfile, marketVol],
  );

  // ── Comment sentiment (per-platform comments → shared classifier) ──
  const [sentimentScore, setSentimentScore] = useState<number | undefined>(undefined);
  const [sentimentRationale, setSentimentRationale] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!video.id) return;

    let commentsUrl: string | null = null;
    if (platform === "youtube" || platform === "youtube_short") {
      commentsUrl = `/api/youtube/comments?videoId=${encodeURIComponent(video.id)}&max=20`;
    } else if (platform === "tiktok") {
      const handle = (video.channel || "").replace(/^@/, "");
      if (handle && video.id) {
        const postUrl = `https://www.tiktok.com/@${handle}/video/${video.id}`;
        commentsUrl = `/api/tiktok/comments?url=${encodeURIComponent(postUrl)}&max=20`;
      }
    } else if (platform === "instagram") {
      if (video.id) {
        const postUrl = `https://www.instagram.com/reel/${video.id}/`;
        commentsUrl = `/api/instagram/comments?url=${encodeURIComponent(postUrl)}&max=20`;
      }
    } else if (platform === "x") {
      const authorHandle = (video.channelId || "").replace(/^@/, "");
      if (/^\d+$/.test(video.id)) {
        const qs = new URLSearchParams({ tweetId: video.id, authorHandle, max: "20" });
        commentsUrl = `/api/x/comments?${qs.toString()}`;
      }
    }
    if (!commentsUrl) return;

    (async () => {
      try {
        const cRes = await fetch(commentsUrl!);
        if (!cRes.ok) return;
        const cData = await cRes.json();
        if (!cData?.ok || !Array.isArray(cData.comments) || cData.comments.length === 0) return;

        const sRes = await fetch("/api/forecast/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: cData.comments, platform, postId: video.id }),
        });
        if (!sRes.ok) return;
        const sData = await sRes.json();
        if (sData?.ok && sData.result) {
          setSentimentScore(sData.result.score);
          setSentimentRationale(sData.result.rationale);
        }
      } catch {
        /* silent fail */
      }
    })();
  }, [video.id, video.channel, video.channelId, platform]);

  // ── Local multiplier computes ──
  // Niche and reputation deliberately stay on the FULL mixed-format history:
  // both read creator-level signals (title keywords; engagement trend +
  // posting recency = audience trust direction), not format performance, and
  // format-filtering would thin the sample below reputation's 10-post
  // confidence bar on most mixed channels. The baseline CV that feeds
  // forecast confidence DOES become format-matched via baselineHistory below
  // — a mixed Shorts/long-form list is bimodal and read as "highly variable
  // output" even when each format is individually consistent.
  const niche = useMemo(() => classifyCreatorNiche(creatorHistory), [creatorHistory]);
  const nicheAdj = useMemo(() => nicheAdjustment(niche.niche), [niche.niche]);
  const reputation = useMemo(() => assessCreatorReputation({ creatorHistory }), [creatorHistory]);
  const crossPlatformRep = useMemo(
    () => assessCrossPlatformReputation({ platform, channelName: video.channel ?? "", poolEntries }),
    [platform, video.channel, poolEntries],
  );
  // Sibling cross-section → per-creator build-up signal (YouTube/Shorts only;
  // null elsewhere or when either age bucket is thin, which keeps the default
  // curve untouched). Reads the wider estimatorHistory, not creatorHistory —
  // the 12-video baseline window never reaches the 21d+ bucket on
  // daily-upload channels. The lib filters to same-format siblings itself.
  // Date.now() anchors sibling ages to render time.
  const earlyShareSignal = useMemo<EarlyShareSignal | null>(
    () => estimateEarlyShare(estimatorHistory, platform, Date.now(), PLATFORM_CONFIG[platform].cumulativeShare),
    [estimatorHistory, platform],
  );

  // ── Tuning overrides (+ visible failure flag) ──
  const [configOverrides, setConfigOverrides] = useState<Record<string, Record<string, number>>>({});
  const [configOverridesFailed, setConfigOverridesFailed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchOnce("forecast-tuning", async () => {
      const r = await fetch("/api/forecast/tuning");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
      .then((d) => {
        if (!d?.ok || !Array.isArray(d.overrides)) {
          setConfigOverridesFailed(true);
          return;
        }
        const byPlatform: Record<string, Record<string, number>> = {};
        for (const o of d.overrides as Array<{ platform: string; parameter: string; newValue: number }>) {
          if (!byPlatform[o.platform]) byPlatform[o.platform] = {};
          byPlatform[o.platform][o.parameter] = o.newValue;
        }
        setConfigOverrides(byPlatform);
        setConfigOverridesFailed(false);
      })
      .catch(() => {
        setConfigOverridesFailed(true);
      });
  }, []);

  // ── Format-matched baseline history (YouTube / Shorts only) ──
  // The forecast's "creator normal" anchor compares a Short against Shorts
  // siblings and long-form against long-form — mixed-format medians average
  // two view-count scales that routinely sit 5–20× apart on one channel.
  // The bar is the platform's effective minBaselinePosts (override-aware),
  // never below MIN_FORMAT_SIBLINGS: swapping to a format bucket smaller than
  // minBaselinePosts would short-circuit forecast() into "insufficient" where
  // the mixed list previously produced a forecast. Below the bar this returns
  // creatorHistory untouched — zero regression.
  const baselineHistory = useMemo(() => {
    if (platform !== "youtube" && platform !== "youtube_short") return creatorHistory;
    const minPosts = configOverrides[platform]?.minBaselinePosts ?? PLATFORM_CONFIG[platform].minBaselinePosts;
    return selectBaselineSiblings(
      platform,
      creatorHistory,
      estimatorHistory,
      Math.max(MIN_FORMAT_SIBLINGS, minPosts),
    ).siblings;
  }, [platform, creatorHistory, estimatorHistory, configOverrides]);

  // ── Conformal + decay tables (learned ranges / build-up curves) ──
  const [conformalTable, setConformalTable] = useState<ConformalTable | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchOnce("forecast-conformal", async () => {
      const r = await fetch("/api/forecast/conformal");
      return r.ok ? r.json() : null;
    })
      .then((d) => {
        if (d?.ok && d.table) setConformalTable(d.table as ConformalTable);
      })
      .catch(() => {});
  }, []);

  const [decayTable, setDecayTable] = useState<DecayTable | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchOnce("forecast-decay", async () => {
      const r = await fetch("/api/forecast/decay");
      return r.ok ? r.json() : null;
    })
      .then((d) => {
        if (d?.ok && d.table) setDecayTable(d.table as DecayTable);
      })
      .catch(() => {});
  }, []);

  const [priorCorrection, setPriorCorrection] = useState<PriorCorrectionTable | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchOnce("forecast-prior-correction", async () => {
      const r = await fetch("/api/forecast/prior-correction");
      return r.ok ? r.json() : null;
    })
      .then((d) => {
        if (d?.ok && d.table) setPriorCorrection(d.table as PriorCorrectionTable);
      })
      .catch(() => {});
  }, []);

  // ── OCR + CSV ingestion ──
  const [ocrStatus, setOcrStatus] = useState<IngestStatus | null>(null);
  const [csvStatus, setCsvStatus] = useState<IngestStatus | null>(null);
  // Mirrors the legacy "inputs panel open" gate for the window paste handler:
  // the consuming surface flips this when its ingest UI is visible.
  const [pasteCaptureEnabled, setPasteCaptureEnabled] = useState(false);

  const ingestImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setOcrStatus({ kind: "error", message: "Not an image file." });
      return;
    }
    setOcrStatus({ kind: "working", message: "Reading screenshot…" });
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.onload = () => {
          const out = typeof reader.result === "string" ? reader.result : "";
          const b64 = out.includes(",") ? (out.split(",").pop() ?? "") : out;
          resolve(b64);
        };
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/analytics/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setOcrStatus({ kind: "error", message: data?.reason ?? "Extraction failed." });
        return;
      }
      const rawFields = (data.extraction?.fields ?? {}) as Record<string, { value?: unknown }>;
      const extracted: Partial<ManualInputs> = {};
      for (const [k, f] of Object.entries(rawFields)) {
        if (f && typeof f.value === "number" && Number.isFinite(f.value)) {
          (extracted as Record<string, number>)[k] = f.value;
        }
      }
      if (Object.keys(extracted).length === 0) {
        setOcrStatus({ kind: "error", message: "No recognisable analytics in this image." });
        return;
      }
      setManualInputs((prev) => ({ ...prev, ...extracted }));
      const summary: string = typeof data.extraction?.summary === "string" ? data.extraction.summary : "";
      setOcrStatus({
        kind: "done",
        message: `Filled ${Object.keys(extracted).length} field${Object.keys(extracted).length === 1 ? "" : "s"}${summary ? " · " + summary : ""}.`,
      });
    } catch (e) {
      setOcrStatus({ kind: "error", message: e instanceof Error ? e.message : "Network error." });
    }
  }, []);

  const ingestCsv = useCallback(
    async (file: File) => {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".csv") && !file.type.includes("csv") && !file.type.includes("text")) {
        setCsvStatus({ kind: "error", message: "Not a CSV file." });
        return;
      }
      if (platform !== "tiktok" && platform !== "instagram") {
        setCsvStatus({ kind: "error", message: "CSV import only available for TikTok and Instagram." });
        return;
      }
      const handle = (video.channel || "").trim();
      if (!handle) {
        setCsvStatus({ kind: "error", message: "Creator handle unknown — cannot save." });
        return;
      }
      setCsvStatus({ kind: "working", message: `Parsing ${file.name}…` });
      try {
        const fd = new FormData();
        fd.append("platform", platform);
        fd.append("handle", handle);
        fd.append("file", file);
        const res = await fetch("/api/analytics/csv-import", { method: "POST", body: fd });
        const data = await res.json().catch(() => null);
        if (!data?.ok) {
          const reason = data?.reason ?? "parse_failed";
          const hint = typeof data?.hint === "string" ? ` · ${data.hint}` : "";
          setCsvStatus({ kind: "error", message: `${reason}${hint}` });
          return;
        }
        const aggregated = (data.aggregated ?? {}) as Partial<ManualInputs>;
        const numericOnly: Partial<ManualInputs> = {};
        for (const [k, v] of Object.entries(aggregated)) {
          if (typeof v === "number" && Number.isFinite(v)) {
            (numericOnly as Record<string, number>)[k] = v;
          }
        }
        setManualInputs((prev) => ({ ...prev, ...numericOnly }));
        const fieldCount = Object.keys(numericOnly).length;
        const rows = typeof data.rowsParsed === "number" ? data.rowsParsed : 0;
        const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
        const warningTail = warnings.length > 0 ? ` ⚠ ${warnings[0]}` : "";
        setCsvStatus({
          kind: warnings.length > 0 ? "error" : "done",
          message: `Imported ${rows} rows · filled ${fieldCount} field${fieldCount === 1 ? "" : "s"} · saved to creator memory.${warningTail}`,
        });
      } catch (e) {
        setCsvStatus({ kind: "error", message: e instanceof Error ? e.message : "Network error." });
      }
    },
    [platform, video.channel],
  );

  // Window-level paste capture — active only while the ingest UI is open.
  useEffect(() => {
    if (typeof window === "undefined" || !pasteCaptureEnabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        ingestImage(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteCaptureEnabled, ingestImage]);

  // ── Creator memory: hydrate (fill empty fields only) + debounced save ──
  useEffect(() => {
    if (!video.channel || typeof window === "undefined") return;
    fetch(`/api/analytics/memory?platform=${platform}&handle=${encodeURIComponent(video.channel)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok || !d.record?.inputs) return;
        const remembered = d.record.inputs as Record<string, unknown>;
        setManualInputs((prev) => {
          const merged: ManualInputs = { ...prev };
          for (const [k, v] of Object.entries(remembered)) {
            if ((merged as Record<string, unknown>)[k] == null && typeof v === "number") {
              (merged as Record<string, number>)[k] = v;
            }
          }
          return merged;
        });
      })
      .catch(() => {});
  }, [video.channel, platform]);

  useEffect(() => {
    if (!video.channel || typeof window === "undefined") return;
    const nonNull: Record<string, number> = {};
    for (const [k, v] of Object.entries(manualInputs)) {
      if (typeof v === "number" && Number.isFinite(v) && !aiEstimatedKeys.has(k as keyof ManualInputs)) {
        nonNull[k] = v;
      }
    }
    if (Object.keys(nonNull).length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/analytics/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          handle: video.channel,
          inputs: nonNull,
          sourceVideoId: video.id,
          source: "merged",
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [manualInputs, video.channel, video.id, platform, aiEstimatedKeys]);

  // ── The forecast — single choke-point assembly ──
  const result: Forecast = useMemo(
    () =>
      forecast(
        assembleForecastInput({
          video,
          // Format-matched on YouTube/Shorts (falls back to the full mixed
          // list when the format bucket is thin) — inside forecast() this
          // feeds ONLY the baseline median/CV.
          creatorHistory: baselineHistory,
          platform,
          manualInputs,
          velocitySamples,
          seasonalityMultiplier: seasonality.multiplier,
          seasonalityRationales: seasonality.rationales,
          sentimentScore,
          sentimentRationale,
          nicheMultiplier: nicheAdj.multiplier,
          nicheLabel: niche.niche,
          nicheRationale: niche.rationale,
          reputationMultiplier: reputation.multiplier,
          reputationRationale: reputation.rationale,
          crossPlatformMultiplier: crossPlatformRep.multiplier,
          crossPlatformRationale: crossPlatformRep.rationale,
          configOverrides,
          conformalTable,
          decayTable,
          earlyShareSignal,
          priorCorrection,
          aiEstimatedKeys: Array.from(aiEstimatedKeys),
        }),
      ),
    [video, baselineHistory, platform, manualInputs, velocitySamples, seasonality, sentimentScore, sentimentRationale, niche, nicheAdj, reputation, crossPlatformRep, configOverrides, conformalTable, decayTable, earlyShareSignal, priorCorrection, aiEstimatedKeys],
  );

  // ── Calibration snapshot — once per video + inputs combo ──
  useEffect(() => {
    if (result.confidence.level === "insufficient") return;
    const manualKeys = Object.entries(manualInputs)
      .filter(([, v]) => v != null)
      .map(([k]) => k);
    recordForecast({
      videoId: video.id,
      videoUrl: (video as { url?: string }).url,
      platform,
      creatorHandle: video.channel,
      publishedAt: video.publishedAt,
      ageDaysAt: video.publishedAt ? (Date.now() - new Date(video.publishedAt).getTime()) / 86_400_000 : 0,
      viewsAt: video.views,
      forecast: result,
      manualInputsProvided: manualKeys,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, JSON.stringify(manualInputs)]);

  // ── Custom-date projection ──
  const defaultTargetDate = useMemo(() => {
    const now = new Date();
    const publishMs = video.publishedAt ? new Date(video.publishedAt).getTime() : now.getTime();
    const anchor = new Date(Math.max(now.getTime(), publishMs));
    return anchor.toISOString().split("T")[0];
  }, [video.publishedAt]);

  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate);
  const prevDefaultRef = useRef<string>(defaultTargetDate);

  // Re-sync only when the default changes AND the user hasn't customized.
  useEffect(() => {
    if (defaultTargetDate === prevDefaultRef.current) return;
    if (targetDate === prevDefaultRef.current) {
      setTargetDate(defaultTargetDate);
    }
    prevDefaultRef.current = defaultTargetDate;
  }, [defaultTargetDate, targetDate]);

  const dateProjection = useMemo<DateProjection | null>(() => {
    if (!targetDate) return null;
    const d = new Date(targetDate + "T12:00:00");
    if (isNaN(d.getTime())) return null;
    return projectAtDate(result, platform, d, video.publishedAt, video.views, decayTable, earlyShareSignal);
  }, [result, platform, targetDate, video.publishedAt, video.views, decayTable, earlyShareSignal]);

  // RM typed a field — it's real data now, not an AI estimate.
  const updateInput = useCallback(
    (key: keyof ManualInputs, raw: string) => {
      const n = raw === "" ? undefined : Number(raw);
      setManualInputs((prev) => ({ ...prev, [key]: Number.isFinite(n as number) ? n : undefined }));
      if (aiEstimatedKeys.has(key)) {
        setAiEstimatedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [aiEstimatedKeys],
  );

  return {
    result,
    manualInputs,
    updateInput,
    aiEstimatedKeys,
    thumbnailCTR,
    hookStrength,
    velocitySamples,
    seasonality,
    niche,
    nicheAdj,
    reputation,
    crossPlatformRep,
    sentimentScore,
    sentimentRationale,
    configOverrides,
    configOverridesFailed,
    conformalTable,
    decayTable,
    earlyShareSignal,
    priorCorrection,
    ocrStatus,
    csvStatus,
    ingestImage,
    ingestCsv,
    setPasteCaptureEnabled,
    targetDate,
    setTargetDate,
    dateProjection,
  };
}
