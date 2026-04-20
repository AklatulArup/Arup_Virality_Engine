"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { forecast, projectAtDate, type ManualInputs, type Platform, type DataSource, type DateProjection } from "@/lib/forecast";
import type { ConformalTable } from "@/lib/conformal";
import { INPUT_TOOLTIPS, type InputTooltip } from "@/lib/input-tooltips";
import { recordForecast } from "@/lib/forecast-learning";
import { computeDayOfWeekProfile, fetchMarketVolatility, combineSeasonality, type DayOfWeekProfile, type MarketVolatilityProfile } from "@/lib/seasonality";
import { classifyCreatorNiche, nicheAdjustment } from "@/lib/niche-classifier";
import { assessCreatorReputation } from "@/lib/reputation";
import type { EnrichedVideo, VideoData } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface ForecastPanelProps {
  video: EnrichedVideo;
  creatorHistory: VideoData[];
  platform: Platform;
}

export default function ForecastPanel({ video, creatorHistory, platform }: ForecastPanelProps) {
  const [manualInputs, setManualInputs] = useState<ManualInputs>({});
  const [inputsOpen, setInputsOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  // Keys within manualInputs whose values came from AI estimation (e.g.
  // thumbnail-based CTR prediction) rather than the RM or a Creator Studio
  // screenshot. These still inform the forecast but are excluded from the
  // "provided manual inputs" confidence bump.
  const [aiEstimatedKeys, setAiEstimatedKeys] = useState<Set<keyof ManualInputs>>(new Set());
  const [thumbnailCTR, setThumbnailCTR] = useState<{ estimatedCTR: number; totalPoints: number; maxPoints: number; rationale: string; ctrConfidence: string } | null>(null);
  const [hookStrength, setHookStrength] = useState<{ totalPoints: number; maxPoints: number; percent: number; dominantFormula: string; confidence: string; rationale: string; estimatedCompletionPct: number; estimatedHold3sPct: number } | null>(null);

  // Fetch velocity time series for this video from the tracker cron store
  const [velocitySamples, setVelocitySamples] = useState<Array<{ ageHours: number; views: number; velocity: number; acceleration: number }>>([]);
  useEffect(() => {
    if (!video.id || typeof window === "undefined") return;
    fetch(`/api/forecast/velocity?videoId=${encodeURIComponent(video.id)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.ok && Array.isArray(d.samples)) setVelocitySamples(d.samples);
      })
      .catch(() => {});
  }, [video.id]);

  // Thumbnail-CTR predictor (YouTube / Shorts only). Gemini Vision scores
  // the thumbnail against a 20-point packaging checklist and returns an
  // estimated CTR %. Auto-fills manualInputs.ytCTRpct when the RM hasn't
  // provided a real Creator Studio CTR — the forecast consumes it via the
  // existing AVD/CTR multiplier but flags it as an AI estimate for both
  // confidence scoring and UI transparency.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (platform !== "youtube" && platform !== "youtube_short") return;
    if (!video.thumbnail) return;
    // Don't refetch if the user (or Creator Studio OCR) already provided a
    // real CTR — real data always beats an AI estimate.
    if (manualInputs.ytCTRpct != null && !aiEstimatedKeys.has("ytCTRpct")) return;
    fetch(`/api/thumbnail/score?url=${encodeURIComponent(video.thumbnail)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.ok || !d.score) return;
        const s = d.score as { estimatedCTR: number; totalPoints: number; maxPoints: number; rationale: string; ctrConfidence: string };
        setThumbnailCTR(s);
        setManualInputs(prev => prev.ytCTRpct != null && !aiEstimatedKeys.has("ytCTRpct")
          ? prev
          : { ...prev, ytCTRpct: s.estimatedCTR });
        setAiEstimatedKeys(prev => new Set(prev).add("ytCTRpct"));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.thumbnail, platform]);

  // Hook-strength predictor (TikTok / Instagram only). Gemini Vision scores
  // the cover image + caption against the 5 hook formulas + visual/text craft
  // dimensions, then maps the score to a platform-specific retention
  // estimate: TikTok → ttCompletionPct (70% = viral gate), IG → igHold3s
  // (60% = audition-gate). Same AI-estimate discipline as thumbnail-CTR.
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
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.ok || !d.score) return;
        const s = d.score as { totalPoints: number; maxPoints: number; percent: number; dominantFormula: string; confidence: string; rationale: string; estimatedCompletionPct: number; estimatedHold3sPct: number };
        setHookStrength(s);
        const autoValue = platform === "tiktok" ? s.estimatedCompletionPct : s.estimatedHold3sPct;
        setManualInputs(prev => prev[targetKey] != null && !aiEstimatedKeys.has(targetKey)
          ? prev
          : { ...prev, [targetKey]: autoValue });
        setAiEstimatedKeys(prev => new Set(prev).add(targetKey));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.thumbnail, video.title, platform]);

  // Day-of-week profile — computed locally from creator history, no fetch
  const dowProfile: DayOfWeekProfile | null = useMemo(
    () => computeDayOfWeekProfile(video, creatorHistory),
    [video, creatorHistory],
  );

  // Market volatility — fetched once per video analysis, from GNews
  const [marketVol, setMarketVol] = useState<MarketVolatilityProfile | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchMarketVolatility().then(setMarketVol).catch(() => {});
  }, []);

  // Comment sentiment (YouTube only for now — other platforms lack public comment APIs)
  const [sentimentScore, setSentimentScore] = useState<number | undefined>(undefined);
  const [sentimentRationale, setSentimentRationale] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (platform !== "youtube" && platform !== "youtube_short") return;
    if (!video.id) return;

    // Fetch comments, then sentiment
    (async () => {
      try {
        const cRes = await fetch(`/api/youtube/comments?videoId=${encodeURIComponent(video.id)}&max=20`);
        if (!cRes.ok) return;
        const cData = await cRes.json();
        if (!cData?.ok || !Array.isArray(cData.comments) || cData.comments.length === 0) return;

        const sRes = await fetch("/api/forecast/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: cData.comments }),
        });
        if (!sRes.ok) return;
        const sData = await sRes.json();
        if (sData?.ok && sData.result) {
          setSentimentScore(sData.result.score);
          setSentimentRationale(sData.result.rationale);
        }
      } catch { /* silent fail */ }
    })();
  }, [video.id, platform]);

  // Combine into single multiplier
  const seasonality = useMemo(
    () => combineSeasonality({ dayOfWeek: dowProfile, marketVolatility: marketVol }),
    [dowProfile, marketVol],
  );

  // Niche classification from creator history (local, no API call)
  const niche = useMemo(() => classifyCreatorNiche(creatorHistory), [creatorHistory]);
  const nicheAdj = useMemo(() => nicheAdjustment(niche.niche), [niche.niche]);

  // Creator reputation — local compute from engagement trend, recency, consistency.
  // Baseline CV isn't available here (it's computed inside forecast()) so we pass
  // undefined and reputation.ts works with just the trend + recency signals.
  const reputation = useMemo(() => assessCreatorReputation({ creatorHistory }), [creatorHistory]);

  // Tuning overrides from admin page — applied on every forecast
  const [configOverrides, setConfigOverrides] = useState<Record<string, Record<string, number>>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/forecast/tuning")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.ok || !Array.isArray(d.overrides)) return;
        const byPlatform: Record<string, Record<string, number>> = {};
        for (const o of d.overrides as Array<{ platform: string; parameter: string; newValue: number }>) {
          if (!byPlatform[o.platform]) byPlatform[o.platform] = {};
          byPlatform[o.platform][o.parameter] = o.newValue;
        }
        setConfigOverrides(byPlatform);
      })
      .catch(() => {});
  }, []);

  // Conformal quantile table — replaces hand-tuned upside/downside bands with
  // empirical quantiles from the residual pool. Null until enough samples
  // mature (cron-maintained). forecast() falls back to hand-tuned bands when
  // no matching stratum is ready.
  const [conformalTable, setConformalTable] = useState<ConformalTable | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/forecast/conformal")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok && d.table) setConformalTable(d.table as ConformalTable); })
      .catch(() => {});
  }, []);

  // ── Private-analytics ingestion (screenshot OCR) + per-creator memory ──
  // The ManualInputs fields are high-signal but only available from the
  // creator's own studio dashboard. Typing them kills adoption. Two mechanisms
  // close the data gap:
  //   1. OCR: RM pastes or uploads a Creator Studio screenshot → Gemini Vision
  //      extracts the numeric fields into `manualInputs`.
  //   2. Memory: last-known values per (creator-handle, platform) are stored
  //      in KV and pre-fill on the next forecast for the same creator.
  const [ocrStatus, setOcrStatus] = useState<{ kind: "working" | "done" | "error"; message: string } | null>(null);

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
          const b64  = out.includes(",") ? out.split(",").pop() ?? "" : out;
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
      setManualInputs(prev => ({ ...prev, ...extracted }));
      setInputsOpen(true);
      const summary: string = typeof data.extraction?.summary === "string" ? data.extraction.summary : "";
      setOcrStatus({
        kind: "done",
        message: `Filled ${Object.keys(extracted).length} field${Object.keys(extracted).length === 1 ? "" : "s"}${summary ? " · " + summary : ""}.`,
      });
    } catch (e) {
      setOcrStatus({ kind: "error", message: e instanceof Error ? e.message : "Network error." });
    }
  }, []);

  // Window-level paste handler so RMs can Ctrl+V a screenshot straight from
  // their clipboard. Only active while the analytics form is expanded — off
  // otherwise so pastes inside other inputs aren't hijacked.
  useEffect(() => {
    if (typeof window === "undefined" || !inputsOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (file) { e.preventDefault(); ingestImage(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [inputsOpen, ingestImage]);

  // Creator memory: hydrate on channel change.
  useEffect(() => {
    if (!video.channel || typeof window === "undefined") return;
    fetch(`/api/analytics/memory?platform=${platform}&handle=${encodeURIComponent(video.channel)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.ok || !d.record?.inputs) return;
        const remembered = d.record.inputs as Record<string, unknown>;
        setManualInputs(prev => {
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

  // Creator memory: save on manualInputs change, debounced 1.5s. AI-estimated
  // keys are filtered out of the save payload — we don't want an AI-predicted
  // CTR to persist as if it were a real Creator Studio number, because the
  // next forecast would then refuse to refetch it.
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
          handle:        video.channel,
          inputs:        nonNull,
          sourceVideoId: video.id,
          source:        "merged",
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [manualInputs, video.channel, video.id, platform, aiEstimatedKeys]);

  const result = useMemo(
    () => forecast({
      video, creatorHistory, platform, manualInputs, velocitySamples,
      seasonalityMultiplier: seasonality.multiplier,
      seasonalityRationales: seasonality.rationales,
      sentimentScore, sentimentRationale,
      nicheMultiplier: nicheAdj.multiplier,
      nicheLabel: niche.niche,
      nicheRationale: niche.rationale,
      reputationMultiplier: reputation.multiplier,
      reputationRationale:  reputation.rationale,
      configOverrides,
      conformalTable,
      aiEstimatedKeys: Array.from(aiEstimatedKeys),
    }),
    [video, creatorHistory, platform, manualInputs, velocitySamples, seasonality, sentimentScore, sentimentRationale, niche, nicheAdj, reputation, configOverrides, conformalTable, aiEstimatedKeys],
  );

  // Persist snapshot for later calibration — debounced: only once per video + inputs combo
  useEffect(() => {
    if (result.confidence.level === "insufficient") return;
    const manualKeys = Object.entries(manualInputs)
      .filter(([, v]) => v != null)
      .map(([k]) => k);
    recordForecast({
      videoId:        video.id,
      videoUrl:       (video as { url?: string }).url,
      platform,
      creatorHandle:  video.channel,
      publishedAt:    video.publishedAt,
      ageDaysAt:      video.publishedAt ? (Date.now() - new Date(video.publishedAt).getTime()) / 86_400_000 : 0,
      viewsAt:        video.views,
      forecast:       result,
      manualInputsProvided: manualKeys,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, JSON.stringify(manualInputs)]);

  // Target date for custom projection — defaults to 30 days from publish (or from today if pre-publish)
  const defaultTargetDate = useMemo(() => {
    const anchor = video.publishedAt ? new Date(video.publishedAt) : new Date();
    const target = new Date(anchor.getTime() + 30 * 86_400_000);
    return target.toISOString().split("T")[0];  // YYYY-MM-DD
  }, [video.publishedAt]);

  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate);

  // Reset the target date whenever the analyzed video changes so the picker
  // doesn't stay stuck at the previous video's publish+30d default
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTargetDate(defaultTargetDate); }, [defaultTargetDate]);

  const dateProjection = useMemo<DateProjection | null>(() => {
    if (!targetDate) return null;
    const d = new Date(targetDate + "T12:00:00");
    if (isNaN(d.getTime())) return null;
    return projectAtDate(result, platform, d, video.publishedAt, video.views);
  }, [result, platform, targetDate, video.publishedAt, video.views]);

  const update = (key: keyof ManualInputs, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    setManualInputs(prev => ({ ...prev, [key]: Number.isFinite(n as number) ? n : undefined }));
    // RM just typed this field — it's no longer an AI estimate.
    if (aiEstimatedKeys.has(key)) {
      setAiEstimatedKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const conf = result.confidence.level;
  const confColor =
    conf === "high"         ? "#2ECC8A" :
    conf === "medium"       ? "#60A5FA" :
    conf === "low"          ? "#F59E0B" :
                              "#FF6B7A";

  // ─── Insufficient history ─────────────────────────────────────────────────
  if (conf === "insufficient") {
    return (
      <div style={panelStyle}>
        <Header result={result} confColor={confColor} conf={conf} />
        <div style={{ background: "rgba(255,107,122,0.08)", border: "1px solid rgba(255,107,122,0.3)", padding: 14, borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#FF6B7A", marginBottom: 6 }}>Insufficient creator history</div>
          <div style={{ fontSize: 12.5, color: "#A8A6A1", lineHeight: 1.55, marginBottom: 12 }}>
            {result.interpretation}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label style={{ fontSize: 12, color: "#9E9C97", minWidth: 180 }}>Manual baseline median:</label>
            <input
              type="number"
              placeholder="e.g. 12500"
              onChange={(e) => update("baselineMedianOverride", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    );
  }

  const d1 = result.d1, d7 = result.d7, d30 = result.d30;
  const lifetime = result.lifetime;
  const horizon = result.horizonDays;

  return (
    <div style={panelStyle}>

      <Header result={result} confColor={confColor} conf={conf} />

      {/* ── Headline interpretation ────────────────────────────────────── */}
      <div style={{ fontSize: 13, color: "#E8E6E1", lineHeight: 1.6, padding: "10px 0" }}>
        {result.interpretation}
      </div>

      {/* ── Trajectory outperformance strip (post-publish only) ──────── */}
      {result.trajectory && <OutperformanceStrip trajectory={result.trajectory} baseline={result.baseline!} />}

      {/* ── Milestone forecast grid ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3" style={{ margin: "8px 0 4px" }}>
        <MilestoneCard label="24 hours" data={d1} color="#60A5FA" />
        <MilestoneCard label="7 days"   data={d7} color="#A78BFA" />
        <MilestoneCard label="30 days"  data={d30} color="#2ECC8A" />
        <MilestoneCard label={`Lifetime (${horizon}d)`} data={lifetime} color="#FFD54F" emphasise />
      </div>

      {/* ── Custom date projection ─────────────────────────────────────── */}
      <DateProjectionCard
        targetDate={targetDate}
        onTargetDateChange={setTargetDate}
        projection={dateProjection}
        publishedAt={video.publishedAt}
        horizonDays={horizon}
        currentViews={video.views}
      />

      {/* ── Creator baseline ────────────────────────────────────────────── */}
      {result.baseline && (
        <div style={boxStyle}>
          <div style={eyebrowStyle}>Creator baseline anchor</div>
          <div className="grid grid-cols-5 gap-3" style={{ fontSize: 12 }}>
            <BaselineStat label="Posts used"     value={result.baseline.postsUsed.toString()} />
            <BaselineStat label="Median"         value={formatNumber(result.baseline.median)} />
            <BaselineStat label="p25 – p75"      value={`${formatNumber(result.baseline.p25)} – ${formatNumber(result.baseline.p75)}`} />
            <BaselineStat label="Best"           value={formatNumber(result.baseline.max)} />
            <BaselineStat label="Consistency CV" value={result.baseline.cv.toFixed(2)} />
          </div>
        </div>
      )}

      {/* ── Score multiplier breakdown ─────────────────────────────────── */}
      <div style={boxStyle}>
        <div style={eyebrowStyle}>Score multiplier (single source)</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto auto 1fr", gap: "12px 18px", alignItems: "baseline", fontSize: 12 }}>
          <div><span style={mutedStyle}>Score</span> <strong style={{ color: "#E8E6E1", fontFamily: "IBM Plex Mono, monospace" }}>{result.scoreMultiplier.score.toFixed(0)}</strong></div>
          <div><span style={mutedStyle}>× median</span> <strong style={{ color: "#E8E6E1", fontFamily: "IBM Plex Mono, monospace" }}>{result.scoreMultiplier.median.toFixed(2)}×</strong></div>
          <div><span style={mutedStyle}>range</span> <strong style={{ color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>{result.scoreMultiplier.low.toFixed(2)}–{result.scoreMultiplier.high.toFixed(2)}×</strong></div>
          <div style={{ color: "#A8A6A1", lineHeight: 1.55 }}>{result.scoreMultiplier.rationale}</div>
        </div>
      </div>

      {/* ── Confidence reasons ────────────────────────────────────────── */}
      <div style={{ ...boxStyle, borderLeft: `3px solid ${confColor}` }}>
        <div style={eyebrowStyle}>Confidence ({result.confidence.score}/100)</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {result.confidence.reasons.map((r, i) => (
            <li key={i} style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.6, paddingLeft: 14, position: "relative", marginBottom: 2 }}>
              <span style={{ position: "absolute", left: 0, color: confColor }}>·</span>{r}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Data transparency ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DataColumn title={`Used (${result.dataUsed.length})`}           items={result.dataUsed}      color="#2ECC8A" />
        <DataColumn title={`Estimated (${result.dataEstimated.length})`} items={result.dataEstimated} color="#F59E0B" />
        <DataColumn title={`Missing (${result.dataMissing.length})`}     items={result.dataMissing}   color="#FF6B7A" />
      </div>

      {/* ── Manual inputs ──────────────────────────────────────────────── */}
      {result.dataMissing.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <button
            onClick={() => setInputsOpen(v => !v)}
            style={{
              background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)",
              color: "#60A5FA", padding: "8px 14px", borderRadius: 6, fontSize: 12.5,
              fontWeight: 500, cursor: "pointer", width: "100%", textAlign: "left",
            }}
          >
            {inputsOpen ? "▾" : "▸"}  Provide creator analytics to tighten the forecast ({result.dataMissing.length} missing)
          </button>

          {inputsOpen && (
            <div style={{ marginTop: 12 }} className="space-y-3">
              <div style={noteStyle}>
                These fields are not available via any public API. Pull them from the creator&apos;s own analytics dashboard. Forecast recalculates as you type.
              </div>
              <ScreenshotIngest onFile={ingestImage} status={ocrStatus} />
              {thumbnailCTR && aiEstimatedKeys.has("ytCTRpct") && (
                <div style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.5, padding: "8px 10px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6 }}>
                  <span style={{ color: "#60A5FA" }}>AI thumbnail score:</span> <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{thumbnailCTR.totalPoints}/{thumbnailCTR.maxPoints}</span> → estimated CTR <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{thumbnailCTR.estimatedCTR.toFixed(1)}%</span> ({thumbnailCTR.ctrConfidence}). Provide the real Studio CTR to replace this estimate.
                  <div style={{ color: "#6B6964", marginTop: 4, fontSize: 11 }}>{thumbnailCTR.rationale}</div>
                </div>
              )}
              {hookStrength && (aiEstimatedKeys.has("ttCompletionPct") || aiEstimatedKeys.has("igHold3s")) && (
                <div style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.5, padding: "8px 10px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 6 }}>
                  <span style={{ color: "#06B6D4" }}>AI hook score:</span> <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{hookStrength.totalPoints}/{hookStrength.maxPoints}</span> · dominant: <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{hookStrength.dominantFormula}</span> → estimated {platform === "tiktok"
                    ? <>completion <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{hookStrength.estimatedCompletionPct}%</span></>
                    : <>3-sec hold <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1" }}>{hookStrength.estimatedHold3sPct}%</span></>} ({hookStrength.confidence}). Provide the real Creator Studio number to replace this estimate.
                  <div style={{ color: "#6B6964", marginTop: 4, fontSize: 11 }}>{hookStrength.rationale}</div>
                </div>
              )}
              <ManualInputsForm platform={platform} manualInputs={manualInputs} update={update} />
            </div>
          )}
        </div>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      {result.notes.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <button
            onClick={() => setShowNotes(v => !v)}
            style={{ background: "none", border: "none", color: "#6B6964", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          >
            {showNotes ? "▾" : "▸"}  Computation notes ({result.notes.length})
          </button>
          {showNotes && (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
              {result.notes.map((n, i) => (
                <li key={i} style={{ fontSize: 11, color: "#8A8883", lineHeight: 1.55, paddingLeft: 14, position: "relative", marginBottom: 3 }}>
                  <span style={{ position: "absolute", left: 0, color: "#6B6964" }}>·</span>{n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Forecast log — manual prediction records ─────────────────── */}
      <ForecastLogSection
        video={video}
        platform={platform}
        targetDate={targetDate}
        dateProjection={dateProjection}
        lifetimeForecast={result.lifetime}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Header({ result, confColor, conf }: { result: ReturnType<typeof forecast>; confColor: string; conf: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div style={{ fontSize: 11, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          View Forecast
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 500, color: "#E8E6E1" }}>
          {result.trajectory ? "Where this is heading" : "Expected performance"}
        </h3>
      </div>
      <div className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
        <span style={{ color: "#6B6964" }}>Confidence:</span>
        <span style={{ color: confColor, fontWeight: 600, textTransform: "uppercase" }}>{conf}</span>
      </div>
    </div>
  );
}

function MilestoneCard({ label, data, color, emphasise }: { label: string; data: { low: number; median: number; high: number }; color: string; emphasise?: boolean }) {
  return (
    <div
      style={{
        background: emphasise ? "rgba(255,213,79,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${emphasise ? "rgba(255,213,79,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10, padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: "#6B6964", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color, lineHeight: 1.1, marginBottom: 4 }}>
        {formatNumber(data.median)}
      </div>
      <div style={{ fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>
        {formatNumber(data.low)} – {formatNumber(data.high)}
      </div>
    </div>
  );
}

function DateProjectionCard({
  targetDate, onTargetDateChange, projection, publishedAt, horizonDays, currentViews,
}: {
  targetDate: string;
  onTargetDateChange: (d: string) => void;
  projection: DateProjection | null;
  publishedAt?: string;
  horizonDays: number;
  currentViews: number;
}) {
  const anchorLabel = publishedAt
    ? `published ${new Date(publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
    : "from today (pre-publish)";

  // Min date: publish date (can't project before publish)
  const minDate = publishedAt
    ? new Date(publishedAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // Max date: publish + 2× horizon, lets users pick well beyond the confident window.
  // Date.now() here is intentional — when no publish date exists we anchor to current time.
  // eslint-disable-next-line react-hooks/purity
  const anchorMs = publishedAt ? new Date(publishedAt).getTime() : Date.now();
  const maxDate = new Date(anchorMs + horizonDays * 2 * 86_400_000).toISOString().split("T")[0];

  return (
    <div
      style={{
        background: "rgba(167,139,250,0.04)",
        border: "1px solid rgba(167,139,250,0.18)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            Custom date projection
          </div>
          <div style={{ fontSize: 12, color: "#A8A6A1" }}>
            Views expected by a specific date — {anchorLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label style={{ fontSize: 11, color: "#6B6964", fontFamily: "IBM Plex Mono, monospace" }}>Target</label>
          <input
            type="date"
            value={targetDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => onTargetDateChange(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 4,
              padding: "6px 10px",
              fontSize: 12,
              color: "#E8E6E1",
              fontFamily: "IBM Plex Mono, monospace",
              outline: "none",
              colorScheme: "dark",
            }}
          />
        </div>
      </div>

      {projection === null ? (
        <div style={{ fontSize: 12, color: "#6B6964", fontStyle: "italic" }}>Pick a date to project views.</div>
      ) : projection.beforePublish ? (
        <div style={{ fontSize: 12, color: "#FF6B7A", padding: "10px 12px", background: "rgba(255,107,122,0.08)", borderRadius: 6, lineHeight: 1.5 }}>
          Target date is before the publish date. Pick a date after {new Date(publishedAt!).toLocaleDateString()}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 10 }}>
            <ProjectionCell label="Low end"  value={projection.low}    color="#F59E0B" />
            <ProjectionCell label="Expected" value={projection.median} color="#A78BFA" emphasise />
            <ProjectionCell label="High end" value={projection.high}   color="#2ECC8A" />
          </div>
          <div style={{ fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.55, display: "flex", flexWrap: "wrap", gap: 14 }}>
            <span>Day <span style={{ color: "#E8E6E1" }}>{projection.daysFromPublish.toFixed(1)}</span> from publish</span>
            <span>·</span>
            <span>Platform gives ~<span style={{ color: "#E8E6E1" }}>{(projection.shareAtDate * 100).toFixed(0)}%</span> of lifetime reached by this date</span>
            {currentViews > 0 && projection.median === currentViews && (
              <>
                <span>·</span>
                <span style={{ color: "#F59E0B" }}>Floored at current views ({formatNumber(currentViews)})</span>
              </>
            )}
            {projection.beyondHorizon && (
              <>
                <span>·</span>
                <span style={{ color: "#F59E0B" }}>Beyond platform horizon — capped at lifetime</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectionCell({ label, value, color, emphasise }: { label: string; value: number; color: string; emphasise?: boolean }) {
  return (
    <div
      style={{
        background: emphasise ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${emphasise ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color, lineHeight: 1.1, fontFamily: "IBM Plex Mono, monospace" }}>
        {formatNumber(value)}
      </div>
    </div>
  );
}

function OutperformanceStrip({ trajectory, baseline }: { trajectory: NonNullable<ReturnType<typeof forecast>["trajectory"]>; baseline: NonNullable<ReturnType<typeof forecast>["baseline"]> }) {
  const verdict = trajectory.verdict;
  const verdictInfo = {
    "major-outlier":         { label: "Major outlier",         color: "#2ECC8A", note: "Priority candidate for paid boost, repurposing, or replication." },
    "above":                 { label: "Above baseline",        color: "#60A5FA", note: "Worth studying — what made this one land harder?" },
    "on-track":              { label: "On baseline",           color: "#9CA3AF", note: "Tracking to the creator's median. No unusual signal." },
    "below":                 { label: "Below baseline",        color: "#F59E0B", note: "Check hook, duration, or audience drift." },
    "significantly-below":   { label: "Significantly below",   color: "#FF6B7A", note: "Format mismatch or algorithmic deprioritisation — treat as kill." },
  }[verdict];

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${verdictInfo.color}`, borderRadius: 10, padding: "12px 14px" }}>
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div style={eyebrowStyle}>Trajectory</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: verdictInfo.color }}>
            {trajectory.outperformance.toFixed(2)}×  <span style={{ fontSize: 12, color: "#A8A6A1", fontWeight: 400 }}>{verdictInfo.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#6B6964" }}>Current vs expected by day {trajectory.ageDays.toFixed(1)}</div>
          <div style={{ fontSize: 12.5, fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1", marginTop: 2 }}>
            {formatNumber(trajectory.currentViews)} <span style={{ color: "#6B6964" }}>vs</span> {formatNumber(Math.round(trajectory.expectedByNow))}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#A8A6A1", marginTop: 6, lineHeight: 1.5 }}>
        {verdictInfo.note} Creator median is <span style={{ color: "#E8E6E1", fontFamily: "IBM Plex Mono, monospace" }}>{formatNumber(baseline.median)}</span>. Forecast blends prior and observed data at {(trajectory.blendWeight * 100).toFixed(0)}% observed weight (post is {trajectory.ageDays.toFixed(1)} days old).
      </div>
    </div>
  );
}

function BaselineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#6B6964", marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#E8E6E1", fontWeight: 500, fontFamily: "IBM Plex Mono, monospace" }}>{value}</div>
    </div>
  );
}

function DataColumn({ title, items, color }: { title: string; items: DataSource[]; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, minHeight: 120 }}>
      <div style={{ fontSize: 10, color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "#5E5C58", fontStyle: "italic" }}>None</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>
                {item.label}
                {item.value !== undefined && (
                  <span style={{ color: "#8A8883", marginLeft: 6, fontFamily: "IBM Plex Mono, monospace" }}>
                    {typeof item.value === "number" ? formatNumber(item.value) : item.value}
                  </span>
                )}
              </div>
              {item.note && (
                <div style={{ color: "#6B6964", marginTop: 2, lineHeight: 1.5 }}>{item.note}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualInputsForm({ platform, manualInputs, update }: {
  platform: Platform;
  manualInputs: ManualInputs;
  update: (key: keyof ManualInputs, v: string) => void;
}) {
  // Controlled inputs: read current value from manualInputs state so OCR
  // ingestion and per-creator memory actually show up in the UI instead of
  // invisibly hydrating the state while the <input> elements stay blank.
  const valOf = (key: keyof ManualInputs): string => {
    const v = manualInputs[key];
    return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  };
  return (
    <>
      {platform === "tiktok" && (
        <>
          <InputRow fieldKey="ttCompletionPct" label="Completion %"  value={valOf("ttCompletionPct")} onChange={(v) => update("ttCompletionPct", v)} suffix="%" />
          <InputRow fieldKey="ttRewatchPct"    label="Rewatch %"     value={valOf("ttRewatchPct")}    onChange={(v) => update("ttRewatchPct", v)}    suffix="%" />
          <InputRow fieldKey="ttFypViewPct"    label="FYP traffic %" value={valOf("ttFypViewPct")}    onChange={(v) => update("ttFypViewPct", v)}    suffix="%" />
        </>
      )}
      {platform === "instagram" && (
        <>
          <InputRow fieldKey="igSaves"    label="Saves"         value={valOf("igSaves")}  onChange={(v) => update("igSaves", v)} />
          <InputRow fieldKey="igSends"    label="DM sends"      value={valOf("igSends")}  onChange={(v) => update("igSends", v)} />
          <InputRow fieldKey="igReach"    label="Reach"         value={valOf("igReach")}  onChange={(v) => update("igReach", v)} />
          <InputRow fieldKey="igHold3s"   label="3-sec hold %"  value={valOf("igHold3s")} onChange={(v) => update("igHold3s", v)} suffix="%" />
        </>
      )}
      {(platform === "youtube" || platform === "youtube_short") && (
        <>
          <InputRow fieldKey="ytAVDpct"       label="AVD %"        value={valOf("ytAVDpct")}      onChange={(v) => update("ytAVDpct", v)}       suffix="%" />
          <InputRow fieldKey="ytCTRpct"       label="CTR %"        value={valOf("ytCTRpct")}      onChange={(v) => update("ytCTRpct", v)}       suffix="%" />
          <InputRow fieldKey="ytImpressions"  label="Impressions"  value={valOf("ytImpressions")} onChange={(v) => update("ytImpressions", v)} />
        </>
      )}
      {platform === "x" && (
        <>
          <InputRow fieldKey="xTweepCred"     label="TweepCred"            value={valOf("xTweepCred")}     onChange={(v) => update("xTweepCred", v)} />
          <InputRow fieldKey="xReplyByAuthor" label="Replies engaged back" value={valOf("xReplyByAuthor")} onChange={(v) => update("xReplyByAuthor", v)} />
        </>
      )}
      <InputRow fieldKey="baselineMedianOverride" label="Override baseline" value={valOf("baselineMedianOverride")} onChange={(v) => update("baselineMedianOverride", v)} />
    </>
  );
}

// Screenshot dropzone / file picker — sits above the manual inputs form.
// Accepts click-to-upload or Ctrl+V paste (paste handler is scoped at the
// panel level via a window listener that only binds while inputsOpen = true).
function ScreenshotIngest({
  onFile,
  status,
}: {
  onFile: (file: File) => void;
  status: { kind: "working" | "done" | "error"; message: string } | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const statusColor =
    status?.kind === "done"    ? "#2ECC8A" :
    status?.kind === "error"   ? "#FF6B7A" :
    status?.kind === "working" ? "#60A5FA" :
                                 "#8A8883";
  return (
    <div style={{
      background: "rgba(167,139,250,0.06)", border: "1px dashed rgba(167,139,250,0.35)",
      borderRadius: 8, padding: 12,
    }}>
      <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            background: "rgba(167,139,250,0.14)", border: "1px solid rgba(167,139,250,0.4)",
            color: "#D6C8FF", padding: "6px 12px", borderRadius: 6, fontSize: 12,
            fontWeight: 500, cursor: "pointer",
          }}
        >
          Ingest screenshot
        </button>
        <div style={{ fontSize: 11.5, color: "#8A8883", lineHeight: 1.5, flex: 1, minWidth: 180 }}>
          Or press <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#B8B6B1" }}>Ctrl+V</span> (Cmd+V) with this form open to paste a Creator Studio screenshot.
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {status && (
        <div style={{ fontSize: 11.5, color: statusColor, marginTop: 8, lineHeight: 1.55 }}>
          {status.kind === "working" ? "⋯ " : status.kind === "done" ? "✓ " : "✕ "}
          {status.message}
        </div>
      )}
    </div>
  );
}

function InputRow({ fieldKey, label, value, onChange, suffix }: { fieldKey: string; label: string; value?: string; onChange: (v: string) => void; suffix?: string }) {
  const tooltip = INPUT_TOOLTIPS[fieldKey];
  return (
    <div style={{ padding: "5px 0" }}>
      <div className="flex items-center gap-3">
        <div style={{ minWidth: 180, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#E8E6E1" }}>{label}</label>
          {tooltip && <TooltipIcon tooltip={tooltip} />}
        </div>
        <div className="flex items-center gap-1 flex-1">
          <input type="number" step="any" placeholder="—" value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
          {suffix && <span style={{ fontSize: 11, color: "#6B6964" }}>{suffix}</span>}
        </div>
      </div>
      {tooltip && (
        <div style={{ fontSize: 10.5, color: "#6B6964", marginLeft: 192, marginTop: 2, lineHeight: 1.45 }}>
          {tooltip.where.split("→")[0].trim()}{tooltip.where.includes("→") ? ` → …` : ""}
        </div>
      )}
    </div>
  );
}

function TooltipIcon({ tooltip }: { tooltip: InputTooltip }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((s) => !s)}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 15, height: 15, borderRadius: "50%",
          border: "1px solid rgba(167,139,250,0.55)",
          color: show ? "#E8E6E1" : "rgba(167,139,250,0.95)",
          background: show ? "rgba(167,139,250,0.25)" : "transparent",
          fontSize: 10, fontWeight: 600, cursor: "help", flexShrink: 0,
          transition: "background 120ms, color 120ms",
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute", left: 22, top: -6, zIndex: 1000,
            width: 320, background: "rgba(16,15,13,0.98)",
            border: "1px solid rgba(167,139,250,0.4)",
            borderRadius: 8, padding: "12px 14px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
            fontSize: 11.5, color: "#E8E6E1", lineHeight: 1.55,
            pointerEvents: "none",
          }}
        >
          <TooltipRow label="What"  content={tooltip.what}  color="#E8E6E1" />
          <TooltipRow label="Where" content={tooltip.where} color="#A78BFA" mono />
          <TooltipRow label="Good"  content={tooltip.good}  color="#2ECC8A" />
          <TooltipRow label="Bad"   content={tooltip.bad}   color="#FF6B7A" />
          <TooltipRow label="Why"   content={tooltip.why}   color="#A8A6A1" last />
        </div>
      )}
    </span>
  );
}

function TooltipRow({ label, content, color, mono, last }: { label: string; content: string; color: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 8 }}>
      <div style={{ fontSize: 9.5, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color, lineHeight: 1.5, fontFamily: mono ? "IBM Plex Mono, monospace" : "inherit" }}>{content}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const panelStyle: React.CSSProperties = {
  background: "rgba(10,10,8,0.85)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 14, padding: 20,
  display: "flex", flexDirection: "column", gap: 16,
};

const boxStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8, padding: 12,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10, color: "#6B6964", letterSpacing: "0.12em",
  textTransform: "uppercase", marginBottom: 8,
};

const mutedStyle: React.CSSProperties = {
  fontSize: 11, color: "#6B6964", marginRight: 4,
};

const noteStyle: React.CSSProperties = {
  fontSize: 11.5, color: "#8A8883", fontStyle: "italic",
  padding: "7px 10px", background: "rgba(255,255,255,0.02)",
  borderRadius: 6, lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4, padding: "5px 9px",
  fontSize: 12, color: "#E8E6E1",
  fontFamily: "IBM Plex Mono, monospace",
  outline: "none", maxWidth: 140,
};

// ═══════════════════════════════════════════════════════════════════════════
// FORECAST LOG — manual prediction records
// ═══════════════════════════════════════════════════════════════════════════
//
// A tab where the RM can save a forecast snapshot for future accountability:
// "I predicted on 20 Apr that this video would hit 152K by 17 May."
// Saves to KV via /api/forecast/log. Survives across devices and sessions.

interface ForecastLogEntry {
  id:             string;
  recordedAt:     string;
  analyzedAt:     string;
  targetDate:     string;
  videoId?:       string;
  videoUrl?:      string;
  videoTitle?:    string;
  platform:       string;
  creatorHandle?: string;
  lowViews:       number;
  expectedViews:  number;
  highViews:      number;
  currentViewsAtAnalysis?: number;
  notes?:         string;
}

function ForecastLogSection({
  video, platform, targetDate, dateProjection, lifetimeForecast,
}: {
  video: { id?: string; url?: string; title?: string; views?: number; channel?: string };
  platform: Platform;
  targetDate: string;
  dateProjection: DateProjection | null;
  lifetimeForecast: { low: number; median: number; high: number };
}) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<ForecastLogEntry[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [justSaved, setJustSaved] = React.useState(false);

  // Load existing entries on mount / when opened
  React.useEffect(() => {
    if (!open) return;
    fetch("/api/forecast/log")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d?.ok && Array.isArray(d.entries)) setEntries(d.entries);
      })
      .catch(() => {});
  }, [open, justSaved]);

  // Default to the date projection if picked, otherwise lifetime
  const useDateProjection = dateProjection && !dateProjection.beforePublish;
  const low    = useDateProjection ? dateProjection.low    : lifetimeForecast.low;
  const exp    = useDateProjection ? dateProjection.median : lifetimeForecast.median;
  const high   = useDateProjection ? dateProjection.high   : lifetimeForecast.high;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/forecast/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyzedAt:     new Date().toISOString(),
          targetDate:     targetDate,
          videoId:        video.id,
          videoUrl:       video.url,
          videoTitle:     video.title,
          platform:       platform,
          creatorHandle:  video.channel,
          lowViews:       low,
          expectedViews:  exp,
          highViews:      high,
          currentViewsAtAnalysis: video.views,
          notes:          notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNotes("");
        setJustSaved((v) => !v);
      }
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/forecast/log?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setEntries((prev) => prev.filter(e => e.id !== id));
    } catch {
      /* silent */
    }
  };

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 500 }}
      >
        {open ? "▾" : "▸"}  Forecast log {entries.length > 0 && <span style={{ color: "#6B6964" }}>({entries.length})</span>}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {/* Record section */}
          <div style={{
            background: "rgba(167,139,250,0.04)",
            border: "1px solid rgba(167,139,250,0.18)",
            borderRadius: 8, padding: "12px 14px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#A78BFA", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Record this prediction
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
              <LogCell label="Low end"  value={formatNumber(low)}  color="#F59E0B" />
              <LogCell label="Expected" value={formatNumber(exp)}  color="#A78BFA" />
              <LogCell label="High end" value={formatNumber(high)} color="#2ECC8A" />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>
              <span>Target: <strong style={{ color: "#E8E6E1" }}>{targetDate || "—"}</strong></span>
              <span style={{ color: "#3A3835" }}>·</span>
              <span>Platform: <strong style={{ color: "#E8E6E1" }}>{platform}</strong></span>
              {video.title && <><span style={{ color: "#3A3835" }}>·</span><span>{video.title.slice(0, 50)}{video.title.length > 50 ? "…" : ""}</span></>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                type="text"
                placeholder="Optional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "7px 10px",
                  fontSize: 12, color: "#E8E6E1",
                  fontFamily: "IBM Plex Mono, monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.2)",
                  border: "1px solid rgba(167,139,250,0.5)",
                  color: "#C4B5FD",
                  padding: "6px 14px",
                  borderRadius: 6, fontSize: 11,
                  fontWeight: 500, cursor: saving ? "default" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >
                {saving ? "Saving…" : "Log prediction"}
              </button>
            </div>
          </div>

          {/* Entries table */}
          {entries.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Recorded", "Analyzed", "Target", "Video", "Platform", "Low", "Expected", "High", "Notes", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#6B6964", fontFamily: "IBM Plex Mono, monospace", fontWeight: 500, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={tdStyle}>{fmtDate(e.recordedAt)}</td>
                      <td style={tdStyle}>{fmtDate(e.analyzedAt)}</td>
                      <td style={tdStyle}>{e.targetDate}</td>
                      <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.videoUrl
                          ? <a href={e.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60A5FA" }}>{e.videoTitle || e.videoUrl}</a>
                          : <span style={{ color: "#8A8883" }}>{e.videoTitle || "—"}</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, color: "#8A8883" }}>{e.platform}</td>
                      <td style={{ ...tdStyle, color: "#F59E0B", fontFamily: "IBM Plex Mono, monospace" }}>{formatNumber(e.lowViews)}</td>
                      <td style={{ ...tdStyle, color: "#A78BFA", fontFamily: "IBM Plex Mono, monospace", fontWeight: 500 }}>{formatNumber(e.expectedViews)}</td>
                      <td style={{ ...tdStyle, color: "#2ECC8A", fontFamily: "IBM Plex Mono, monospace" }}>{formatNumber(e.highViews)}</td>
                      <td style={{ ...tdStyle, color: "#8A8883", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || ""}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          onClick={() => handleDelete(e.id)}
                          style={{ background: "none", border: "none", color: "#6B6964", fontSize: 11, cursor: "pointer", padding: "2px 6px" }}
                          title="Delete this entry"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#6B6964", fontStyle: "italic", padding: "8px 2px" }}>
              No predictions logged yet. Use the button above to record the current forecast.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: "#6B6964", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color, fontFamily: "IBM Plex Mono, monospace" }}>{value}</div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return iso;
  }
}

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  color: "#E8E6E1",
  fontSize: 11,
  verticalAlign: "top",
};
