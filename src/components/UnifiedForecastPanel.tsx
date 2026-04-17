"use client";

import React, { useMemo, useState } from "react";
import type { EnrichedVideo, VideoData } from "@/lib/types";
import type { PredictorPlatform } from "@/lib/view-predictor";
import { predictViews } from "@/lib/view-predictor";
import { formatNumber } from "@/lib/formatters";
import ViewForecastPanel from "./ViewForecastPanel";
import ViewPredictorPanel from "./ViewPredictorPanel";

// UnifiedForecastPanel
//
// Reconciles the two forecast tools into one coherent story:
//
//   ViewPredictor     (pre-publish baseline)  → "what SHOULD this post do?"
//   ViewForecastPanel (post-publish trajectory) → "where IS this post heading?"
//
// Mode logic based on time since publish + platform decay curve:
//   PLAN    — no published-at date yet (pre-publish content brief)
//   EARLY   — published within platform's "early" window
//   MATURE  — beyond the early window; both tools meaningful
//
// Platform-specific "early" window:
//   X              =  2 hours  (6-hour decay means posts die fast)
//   TikTok/IG/YTS  = 24 hours  (first-hour velocity determines expansion)
//   YouTube LF     =  7 days   (suggested/browse pickup extends early window)

interface UnifiedForecastPanelProps {
  video: EnrichedVideo;
  creatorHistory: VideoData[];
  platform: PredictorPlatform;
  forecastDate: string;
  onDateChange: (date: string) => void;
}

type Mode = "plan" | "early" | "mature";

function detectMode(video: EnrichedVideo, platform: PredictorPlatform): Mode {
  if (!video.publishedAt) return "plan";
  const ageMs = Date.now() - new Date(video.publishedAt).getTime();
  const ageHrs = ageMs / 3_600_000;
  const ageDays = ageMs / 86_400_000;

  if (platform === "x")              return ageHrs  < 2  ? "early" : "mature";
  if (platform === "youtube")        return ageDays < 7  ? "early" : "mature";
  return ageDays < 1 ? "early" : "mature";
}

export default function UnifiedForecastPanel({
  video, creatorHistory, platform, forecastDate, onDateChange,
}: UnifiedForecastPanelProps) {

  const mode = detectMode(video, platform);
  const [showBothEarly, setShowBothEarly] = useState(false);

  // Always compute baseline forecast — needed for comparison in all modes
  const baseline = useMemo(
    () => predictViews(video, creatorHistory, platform, {}),
    [video, creatorHistory, platform],
  );

  // Outperformance ratio: actual current views vs. baseline 30-day expectation
  // Only meaningful in mature mode
  const outperformance = useMemo(() => {
    if (mode !== "mature" || !baseline.creatorBaseline) return null;
    const actual = video.views;
    const expected = baseline.day30.median;
    if (expected === 0) return null;
    return actual / expected;
  }, [mode, baseline, video.views]);

  return (
    <div className="space-y-4">

      {/* Mode banner */}
      <ModeBanner mode={mode} platform={platform} />

      {/* Outperformance strip — only in mature mode */}
      {outperformance !== null && baseline.creatorBaseline !== null && (
        <OutperformanceStrip
          actualViews={video.views}
          expectedViews={baseline.day30.median}
          ratio={outperformance}
          baselineMedian={baseline.creatorBaseline.median}
        />
      )}

      {/* PLAN mode: only show predictor (no published post to forecast trajectory for) */}
      {mode === "plan" && (
        <ViewPredictorPanel
          video={video}
          creatorHistory={creatorHistory}
          platform={platform}
        />
      )}

      {/* EARLY mode: trajectory primary, baseline as collapsible */}
      {mode === "early" && (
        <>
          <ViewForecastPanel
            video={video}
            forecastDate={forecastDate}
            onDateChange={onDateChange}
          />
          <button
            onClick={() => setShowBothEarly(v => !v)}
            style={{
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.25)",
              color: "#60A5FA",
              padding: "8px 14px", borderRadius: 6,
              fontSize: 12.5, fontWeight: 500,
              cursor: "pointer", width: "100%", textAlign: "left",
            }}
          >
            {showBothEarly ? "▾" : "▸"}  Also show baseline expectation (what this post SHOULD have done by now)
          </button>
          {showBothEarly && (
            <ViewPredictorPanel
              video={video}
              creatorHistory={creatorHistory}
              platform={platform}
            />
          )}
        </>
      )}

      {/* MATURE mode: both panels shown with explicit labels */}
      {mode === "mature" && (
        <>
          <SectionLabel
            title="Trajectory projection"
            subtitle="Where this post is heading based on its observed velocity and current engagement pattern"
            color="#2ECC8A"
          />
          <ViewForecastPanel
            video={video}
            forecastDate={forecastDate}
            onDateChange={onDateChange}
          />

          <SectionLabel
            title="Baseline expectation"
            subtitle="What this creator's typical post of this readiness score would do — independent of how this specific post has performed"
            color="#A78BFA"
          />
          <ViewPredictorPanel
            video={video}
            creatorHistory={creatorHistory}
            platform={platform}
          />
        </>
      )}

    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function ModeBanner({ mode, platform }: { mode: Mode; platform: PredictorPlatform }) {
  const modeInfo: Record<Mode, { label: string; color: string; desc: string }> = {
    plan: {
      label: "Plan mode",
      color: "#A78BFA",
      desc: "Pre-publish — no trajectory data yet. Forecast shows baseline expectation for a typical post at this readiness score.",
    },
    early: {
      label: "Early mode",
      color: "#60A5FA",
      desc:
        platform === "x"          ? "First 2 hours since publish — X posts live or die in this window. Trajectory projection is the primary signal." :
        platform === "youtube"    ? "First 7 days since publish — YouTube's suggested/browse surface takes time to pick up. Trajectory is the primary signal." :
                                    "First 24 hours since publish — initial velocity determines expansion. Trajectory is the primary signal.",
    },
    mature: {
      label: "Mature mode",
      color: "#2ECC8A",
      desc: "Beyond the early window — both trajectory and baseline are meaningful. Outperformance ratio shows how this post compares to what the creator typically produces.",
    },
  };

  const info = modeInfo[mode];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${info.color}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: info.color, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {info.label}
      </div>
      <div style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.55 }}>
        {info.desc}
      </div>
    </div>
  );
}

function OutperformanceStrip({
  actualViews, expectedViews, ratio, baselineMedian,
}: {
  actualViews: number; expectedViews: number; ratio: number; baselineMedian: number;
}) {
  const verdict =
    ratio >= 3    ? { label: "Major outlier",       color: "#2ECC8A", detail: "This post is performing far above the creator's typical output. Priority candidate for paid boost, repurposing, or replication." } :
    ratio >= 1.5  ? { label: "Above baseline",      color: "#60A5FA", detail: "Performing better than typical. Worth studying — what made this one land harder?" } :
    ratio >= 0.8  ? { label: "On baseline",         color: "#9CA3AF", detail: "Tracking to the creator's median. No unusual signal." } :
    ratio >= 0.5  ? { label: "Below baseline",      color: "#F59E0B", detail: "Underperforming this creator's median. Check for hook failure, duration mismatch, or audience drift." } :
                    { label: "Significantly below", color: "#FF6B7A", detail: "Performance is well under typical. Likely a format mismatch or algorithm deprioritisation — treat as a kill." };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${verdict.color}`,
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-3">
        <div>
          <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>
            Outperformance ratio
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: verdict.color }}>
            {ratio.toFixed(2)}×  <span style={{ fontSize: 12, color: "#A8A6A1", fontWeight: 400, marginLeft: 4 }}>{verdict.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6B6964" }}>Actual vs Expected (30-day)</div>
          <div style={{ fontSize: 13, fontFamily: "IBM Plex Mono, monospace", color: "#E8E6E1", marginTop: 2 }}>
            {formatNumber(actualViews)} <span style={{ color: "#6B6964" }}>vs</span> {formatNumber(expectedViews)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.55 }}>
        {verdict.detail} Creator median is <span style={{ color: "#E8E6E1", fontFamily: "IBM Plex Mono, monospace" }}>{formatNumber(baselineMedian)}</span> — this post is at <span style={{ color: "#E8E6E1", fontFamily: "IBM Plex Mono, monospace" }}>{formatNumber(actualViews)}</span>.
      </div>
    </div>
  );
}

function SectionLabel({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div style={{ padding: "14px 4px 2px", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 4 }}>
      <div style={{ fontSize: 10, color, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11.5, color: "#8A8883", lineHeight: 1.5, maxWidth: 720 }}>
        {subtitle}
      </div>
    </div>
  );
}
