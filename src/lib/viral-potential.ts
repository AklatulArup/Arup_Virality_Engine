// Virality potential — the plain-English "how viral can this go" composite
// for the video report. Pure compute, no network; pools evidence the engine
// already has:
//   • breakout odds — empirical base rate of ≥5× videos in the pool stratum
//     (same platform), blended with the creator's own history and nudged by
//     the live pace while the video is still inside its decision window
//   • ceiling — wave math (spread-per-wave from velocity samples) when the
//     video is tracked, else the lifecycle-tier clamp, else the forecast high
//   • conditions — what has to stay true for the upside case to materialise

import type { Forecast, Platform } from "./forecast";
import type { VideoData, ReferenceEntry } from "./types";
import { analyzeWaves } from "./scoring/waves";

export const BREAKOUT_X = 5; // "breakout" = ≥5× the creator's typical views

export interface ViralPotential {
  breakout: {
    pct: number;          // 0-100 probability estimate
    oneInN: number;       // rounded 1/p — the RM-facing framing
    basis: string;        // where the base rate came from, with sample sizes
    liveAdjusted: boolean; // true when current pace moved the number
  } | null;
  ceiling: {
    value: number;        // views — the working upper bound
    capped: boolean;      // true when evidence says distribution has capped
    reason: string;
  };
  conditions: string[];   // what must stay true, most important first
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Empirical breakout base rate from pool video entries of one platform. */
function poolBaseRate(entries: ReferenceEntry[], platform: Platform): { rate: number; n: number } | null {
  const vids = entries.filter(
    (e) => e.type === "video" && e.platform === platform && typeof e.metrics.views === "number" && e.metrics.views! > 0,
  );
  const byChannel = new Map<string, number[]>();
  for (const e of vids) {
    const arr = byChannel.get(e.channelId) ?? [];
    arr.push(e.metrics.views!);
    byChannel.set(e.channelId, arr);
  }
  let breakouts = 0;
  let total = 0;
  for (const views of byChannel.values()) {
    if (views.length < 5) continue; // need a real baseline per channel
    const med = median(views);
    if (med <= 0) continue;
    for (const v of views) {
      total++;
      if (v >= BREAKOUT_X * med) breakouts++;
    }
  }
  if (total < 30) return null;
  return { rate: breakouts / total, n: total };
}

/** Creator's own breakout rate from their fetched history. */
function creatorBaseRate(history: VideoData[]): { rate: number; n: number } | null {
  const views = history.map((v) => v.views).filter((v) => v > 0);
  if (views.length < 8) return null;
  const med = median(views);
  if (med <= 0) return null;
  const breakouts = views.filter((v) => v >= BREAKOUT_X * med).length;
  return { rate: breakouts / views.length, n: views.length };
}

/** Platform decision window in days — pace only updates odds while inside it. */
function decisionWindowDays(platform: Platform): number {
  switch (platform) {
    case "x":             return 1;
    case "tiktok":
    case "instagram":     return 3;
    case "youtube_short": return 7;
    case "youtube":       return 10;
  }
}

export function computeViralPotential(params: {
  forecast: Forecast;
  video: { views: number; days: number };
  creatorHistory: VideoData[];
  platform: Platform;
  velocitySamples: Array<{ ageHours: number; views: number }>;
  poolEntries: ReferenceEntry[];
}): ViralPotential {
  const { forecast: f, video, creatorHistory, platform, velocitySamples, poolEntries } = params;
  const conditions: string[] = [];

  // ── Breakout odds ────────────────────────────────────────────────────────
  const pool = poolBaseRate(poolEntries, platform);
  const own = creatorBaseRate(creatorHistory);
  let breakout: ViralPotential["breakout"] = null;
  if (pool || own) {
    // Shrink the creator rate toward the pool rate (κ=20) — thin creator
    // histories shouldn't swing the odds on their own.
    const KAPPA = 20;
    let rate: number;
    let basis: string;
    if (pool && own) {
      rate = (own.rate * own.n + pool.rate * KAPPA) / (own.n + KAPPA);
      basis = `${own.n} of their videos + ${pool.n} same-platform videos in the pool`;
    } else if (own) {
      rate = own.rate;
      basis = `${own.n} of their own videos — pool too thin on this platform`;
    } else {
      rate = pool!.rate;
      basis = `${pool!.n} same-platform videos in the pool — creator history thin`;
    }

    // Live-pace update: only while the algorithm is still deciding.
    let liveAdjusted = false;
    const pace = f.trajectory?.outperformance;
    if (pace != null && video.views > 0 && video.days <= decisionWindowDays(platform)) {
      if (pace >= 3)        { rate *= Math.min(pace / 2, 4); liveAdjusted = true; }
      else if (pace <= 0.7) { rate *= 0.4;                   liveAdjusted = true; }
    }

    const pct = Math.min(0.65, Math.max(0.005, rate)) * 100;
    breakout = { pct, oneInN: Math.max(2, Math.round(100 / pct)), basis, liveAdjusted };
  }

  // ── Ceiling ──────────────────────────────────────────────────────────────
  let ceiling: ViralPotential["ceiling"];
  const snapshots = velocitySamples
    .filter((s) => s.views > 0)
    .map((s) => ({ ageHours: s.ageHours, reach: s.views }));
  const waves = snapshots.length >= 2 ? analyzeWaves(snapshots) : null;

  if (waves && waves.mHats.length >= 1) {
    if (waves.ceiling === "unbounded") {
      ceiling = {
        value: f.lifetime.high,
        capped: false,
        reason: "Each wave is bigger than the last — no ceiling visible yet. Working upside = forecast high.",
      };
      conditions.push("The next wave (~12–24h) decides — two shrinking waves in a row means the ceiling appears.");
    } else if (typeof waves.ceiling === "number") {
      const value = Math.max(waves.ceiling, video.views);
      ceiling = {
        value,
        capped: value <= f.lifetime.high,
        reason: "Spread per wave is shrinking — current momentum caps it here unless something re-ignites it.",
      };
    } else {
      ceiling = { value: f.lifetime.high, capped: false, reason: "Early tracking present but too sparse to read waves yet." };
    }
  } else if (f.lifecycleTier && (f.lifecycleTier.tier.includes("stuck") || f.lifecycleTier.tier === "tier-4-plateau")) {
    ceiling = {
      value: f.lifetime.high,
      capped: true,
      reason: "Distribution looks capped — the platform's testing process stalled this one.",
    };
  } else {
    ceiling = {
      value: f.lifetime.high,
      capped: false,
      reason: video.views > 0
        ? "No early tracking on this video — upper bound comes from the forecast range."
        : "Pre-publish — upper bound comes from the forecast range.",
    };
    if (video.views > 0 && video.days <= decisionWindowDays(platform)) {
      conditions.push("Paste-day-0 tracking would sharpen this — wave data is what reveals the real ceiling.");
    }
  }

  // ── Conditions ───────────────────────────────────────────────────────────
  const pace = f.trajectory?.outperformance;
  if (pace != null && pace >= 1.15 && video.days <= decisionWindowDays(platform)) {
    conditions.unshift(`Current pace (×${pace >= 10 ? Math.round(pace) : pace.toFixed(1)} vs normal) has to hold through the decision window.`);
  }
  if (f.dataMissing.some((d) => d.impact === "high")) {
    conditions.push("Completion/retention unknown — one creator screenshot tightens both numbers.");
  }
  if (breakout && !own) {
    conditions.push("Odds lean on platform-wide history — they firm up as this creator's videos accumulate.");
  }

  return { breakout, ceiling, conditions: conditions.slice(0, 3) };
}
