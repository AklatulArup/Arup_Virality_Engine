// ═══════════════════════════════════════════════════════════════════════════
// CREATOR REPUTATION MULTIPLIER
// ═══════════════════════════════════════════════════════════════════════════
//
// From `analytics-sentiment-growth.md`: "Content sentiment and creator
// sentiment are different. A video might have great engagement while the
// creator's reputation is declining elsewhere." The forecast engine
// previously treated every creator as ageless — their baseline median was
// applied to every new post regardless of whether their audience trust was
// rising, flat, or eroding.
//
// This module scores a creator's trajectory from signals already in
// `creatorHistory` (no new API calls, no scraping) and returns a multiplier
// applied to baseline.median alongside seasonality and niche multipliers.
//
// SIGNALS
// -------
// 1. Engagement-rate trend — compare (likes+comments+shares)/views on the
//    newest 5 vs the oldest 5 videos we have. Rising engagement = audience
//    trust growing even as channel scales. Declining = "losing algorithmic
//    favor" (per the doc's Growth Curve Decline pattern).
// 2. Recency of last post — long gaps (>60d) erode subscriber-list quality
//    because YouTube/IG quietly stop sending notifications to inactive viewers.
// 3. Consistency (baseline CV) — creators who deliver predictably are
//    algorithmically rewarded (channel authority); erratic output spreads
//    subscriber attention thin.
//
// Multiplier is CLAMPED to [0.7, 1.25]. This is NOT a big swing — baseline
// already captures the creator's median performance; reputation is a second-
// order adjustment. Even a "declining" creator can still post a hit.

import type { VideoData } from "./types";

export interface ReputationAssessment {
  multiplier:   number;           // 0.70 – 1.25
  confidence:   "high" | "medium" | "low";
  signals: {
    engagementTrend:    { earlyAvg: number; recentAvg: number; deltaPct: number; verdict: "rising" | "flat" | "declining" };
    recencyDays:        number | null;  // null if no timestamps
    consistencyCV:      number | null;
    sampleSize:         number;
  };
  rationale:    string;
}

const MIN_POSTS_FOR_CONFIDENCE = 10;

export function assessCreatorReputation(params: {
  creatorHistory: VideoData[];
  baselineCV?:    number;
}): ReputationAssessment {
  const history = params.creatorHistory
    .filter(v => typeof v.views === "number" && v.views > 0)
    .slice();

  // Newest → oldest ordering (in case caller didn't sort)
  history.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  const n = history.length;

  // ── Signal 1: engagement-rate trend ────────────────────────────────────
  const recent = history.slice(0, 5);
  const early  = history.slice(Math.max(0, n - 5));
  const recentAvg = avgEngagement(recent);
  const earlyAvg  = avgEngagement(early);
  const deltaPct  = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : 0;
  const verdict: "rising" | "flat" | "declining" =
    deltaPct > 10  ? "rising" :
    deltaPct < -10 ? "declining" :
                     "flat";

  // ── Signal 2: recency of last post ─────────────────────────────────────
  const newest = history[0];
  const newestMs = newest?.publishedAt ? new Date(newest.publishedAt).getTime() : null;
  const recencyDays = newestMs ? Math.floor((Date.now() - newestMs) / 86_400_000) : null;

  // ── Signal 3: consistency (from baseline.cv passed in) ────────────────
  const cv = params.baselineCV ?? null;

  // ── Multiplier composition ─────────────────────────────────────────────
  let multiplier = 1.0;
  const reasons: string[] = [];

  if (verdict === "rising") {
    // +5% at 15% engagement lift, +15% at 50%+
    const bump = Math.min(0.15, Math.max(0.05, deltaPct / 333));
    multiplier *= 1 + bump;
    reasons.push(`Engagement rising ${deltaPct.toFixed(0)}% recent-vs-early (+${(bump * 100).toFixed(0)}%)`);
  } else if (verdict === "declining") {
    const hit = Math.min(0.18, Math.max(0.06, Math.abs(deltaPct) / 300));
    multiplier *= 1 - hit;
    reasons.push(`Engagement declining ${deltaPct.toFixed(0)}% recent-vs-early (-${(hit * 100).toFixed(0)}%)`);
  }

  if (recencyDays != null) {
    if (recencyDays > 90) {
      multiplier *= 0.85;
      reasons.push(`${recencyDays}d since last post — cold audience (-15%)`);
    } else if (recencyDays > 45) {
      multiplier *= 0.92;
      reasons.push(`${recencyDays}d since last post — subscribers cooling (-8%)`);
    } else if (recencyDays <= 7) {
      multiplier *= 1.04;
      reasons.push(`Recent cadence (${recencyDays}d since last) — warm audience (+4%)`);
    }
  }

  if (cv != null) {
    if (cv < 0.5) {
      multiplier *= 1.05;
      reasons.push(`Consistent output (CV ${cv.toFixed(2)}) — algorithmic authority (+5%)`);
    } else if (cv > 1.5) {
      multiplier *= 0.95;
      reasons.push(`Erratic output (CV ${cv.toFixed(2)}) — thinner subscriber engagement (-5%)`);
    }
  }

  // Clamp
  multiplier = Math.max(0.70, Math.min(1.25, multiplier));

  const confidence: ReputationAssessment["confidence"] =
    n >= MIN_POSTS_FOR_CONFIDENCE * 2 ? "high" :
    n >= MIN_POSTS_FOR_CONFIDENCE     ? "medium" :
                                        "low";

  // If multiplier still 1.0 after all checks → reputation is neutral
  const rationale = reasons.length > 0
    ? `${(multiplier * 100 - 100).toFixed(0)}% reputation adjustment. ${reasons.join("; ")}.`
    : `Reputation neutral — no strong directional signals across ${n} past posts.`;

  return {
    multiplier,
    confidence,
    signals: {
      engagementTrend: { earlyAvg, recentAvg, deltaPct, verdict },
      recencyDays,
      consistencyCV: cv,
      sampleSize:    n,
    },
    rationale,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

function avgEngagement(videos: VideoData[]): number {
  if (videos.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const v of videos) {
    if (v.views > 0) {
      const interactions = (v.likes || 0) + (v.comments || 0) + (v.shares || 0);
      sum += interactions / v.views;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}
