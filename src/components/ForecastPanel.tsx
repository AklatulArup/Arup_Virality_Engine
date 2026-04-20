"use client";

import React, { useEffect, useMemo, useState } from "react";
import { forecast, projectAtDate, type ManualInputs, type Platform, type DataSource, type DateProjection } from "@/lib/forecast";
import { INPUT_TOOLTIPS, type InputTooltip } from "@/lib/input-tooltips";
import { recordForecast } from "@/lib/forecast-learning";
import { computeDayOfWeekProfile, fetchMarketVolatility, combineSeasonality, type DayOfWeekProfile, type MarketVolatilityProfile } from "@/lib/seasonality";
import { classifyCreatorNiche, nicheAdjustment } from "@/lib/niche-classifier";
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

  const result = useMemo(
    () => forecast({
      video, creatorHistory, platform, manualInputs, velocitySamples,
      seasonalityMultiplier: seasonality.multiplier,
      seasonalityRationales: seasonality.rationales,
      sentimentScore, sentimentRationale,
      nicheMultiplier: nicheAdj.multiplier,
      nicheLabel: niche.niche,
      nicheRationale: niche.rationale,
      configOverrides,
    }),
    [video, creatorHistory, platform, manualInputs, velocitySamples, seasonality, sentimentScore, sentimentRationale, niche, nicheAdj, configOverrides],
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
              <ManualInputsForm platform={platform} update={update} />
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

function ManualInputsForm({ platform, update }: { platform: Platform; update: (key: keyof ManualInputs, v: string) => void }) {
  return (
    <>
      {platform === "tiktok" && (
        <>
          <InputRow fieldKey="ttCompletionPct" label="Completion %"  onChange={(v) => update("ttCompletionPct", v)} suffix="%" />
          <InputRow fieldKey="ttRewatchPct"    label="Rewatch %"     onChange={(v) => update("ttRewatchPct", v)}    suffix="%" />
          <InputRow fieldKey="ttFypViewPct"    label="FYP traffic %" onChange={(v) => update("ttFypViewPct", v)}    suffix="%" />
        </>
      )}
      {platform === "instagram" && (
        <>
          <InputRow fieldKey="igSaves"    label="Saves"         onChange={(v) => update("igSaves", v)} />
          <InputRow fieldKey="igSends"    label="DM sends"      onChange={(v) => update("igSends", v)} />
          <InputRow fieldKey="igReach"    label="Reach"         onChange={(v) => update("igReach", v)} />
          <InputRow fieldKey="igHold3s"   label="3-sec hold %"  onChange={(v) => update("igHold3s", v)} suffix="%" />
        </>
      )}
      {(platform === "youtube" || platform === "youtube_short") && (
        <>
          <InputRow fieldKey="ytAVDpct"       label="AVD %"        onChange={(v) => update("ytAVDpct", v)}       suffix="%" />
          <InputRow fieldKey="ytCTRpct"       label="CTR %"        onChange={(v) => update("ytCTRpct", v)}       suffix="%" />
          <InputRow fieldKey="ytImpressions"  label="Impressions"  onChange={(v) => update("ytImpressions", v)} />
        </>
      )}
      {platform === "x" && (
        <>
          <InputRow fieldKey="xTweepCred"     label="TweepCred"            onChange={(v) => update("xTweepCred", v)} />
          <InputRow fieldKey="xReplyByAuthor" label="Replies engaged back" onChange={(v) => update("xReplyByAuthor", v)} />
        </>
      )}
      <InputRow fieldKey="baselineMedianOverride" label="Override baseline" onChange={(v) => update("baselineMedianOverride", v)} />
    </>
  );
}

function InputRow({ fieldKey, label, onChange, suffix }: { fieldKey: string; label: string; onChange: (v: string) => void; suffix?: string }) {
  const tooltip = INPUT_TOOLTIPS[fieldKey];
  return (
    <div style={{ padding: "5px 0" }}>
      <div className="flex items-center gap-3">
        <div style={{ minWidth: 180, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#E8E6E1" }}>{label}</label>
          {tooltip && <TooltipIcon tooltip={tooltip} />}
        </div>
        <div className="flex items-center gap-1 flex-1">
          <input type="number" step="any" placeholder="—" onChange={(e) => onChange(e.target.value)} style={inputStyle} />
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
