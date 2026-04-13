/**
 * 2026 View Forecast Engine
 * Incorporates platform-specific virality formulas, K coefficient, and decay curves.
 * Sources: 2026 Master Algorithmic Intelligence & Virality Briefing + empirical data.
 */

import type { EnrichedVideo } from "./types";

export type ForecastPlatform = "youtube" | "youtube_short" | "tiktok" | "instagram";

export interface PlatformScore {
  platform: ForecastPlatform;
  score: number;          // 0–1 composite virality readiness
  signals: {
    label: string;
    value: number;        // 0–1
    weight: number;
    description: string;
  }[];
  formula: string;
}

export interface ViralityCoefficient {
  K: number;             // K > 1 = exponential growth
  shares: number;        // estimated shares per 1000 views
  conversion: number;    // estimated % of shares → new views
  verdict: string;
  color: string;
}

export interface MonthlyProjection {
  month: number;
  low: number;
  mid: number;
  high: number;
}

export interface ViewForecast {
  low: number;
  mid: number;
  high: number;
  daysToTarget: number;
  daysSincePublish: number;
  platform: ForecastPlatform;
  platformLabel: string;
  confidence: "low" | "medium" | "high";
  platformScore: PlatformScore;
  coefficient: ViralityCoefficient;
  monthlyProjections: MonthlyProjection[];
  replicationSignals: string[];
}

// ─── Platform label map ───
const PLATFORM_LABELS: Record<ForecastPlatform, string> = {
  youtube: "YouTube Long-form",
  youtube_short: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram Reels",
};

// ─── Cumulative decay curves (fraction of lifetime views at day N) ───
function cumulativeShare(day: number, platform: ForecastPlatform): number {
  if (day <= 0) return 0.001;
  if (platform === "tiktok") {
    if (day >= 30) return 1.0;
    if (day <= 1) return 0.38;
    if (day <= 3) return 0.62;
    if (day <= 7) return 0.82;
    if (day <= 14) return 0.93;
    return 0.93 + (day - 14) / 16 * 0.07;
  }
  if (platform === "instagram") {
    if (day >= 21) return 1.0;
    if (day <= 1) return 0.33;
    if (day <= 3) return 0.57;
    if (day <= 7) return 0.77;
    if (day <= 14) return 0.92;
    return 0.92 + (day - 14) / 7 * 0.08;
  }
  if (platform === "youtube_short") {
    if (day >= 180) return 1.0;
    if (day <= 1) return 0.28;
    if (day <= 3) return 0.48;
    if (day <= 7) return 0.64;
    if (day <= 14) return 0.74;
    if (day <= 30) return 0.83;
    if (day <= 60) return 0.91;
    if (day <= 90) return 0.96;
    return 0.96 + (day - 90) / 90 * 0.04;
  }
  // YouTube long-form (evergreen)
  if (day >= 365) return 1.0;
  if (day <= 1) return 0.08;
  if (day <= 3) return 0.16;
  if (day <= 7) return 0.28;
  if (day <= 14) return 0.40;
  if (day <= 30) return 0.55;
  if (day <= 60) return 0.68;
  if (day <= 90) return 0.78;
  if (day <= 180) return 0.90;
  return 0.90 + (day - 180) / 185 * 0.10;
}

// ─── Platform virality score ───
function computePlatformScore(video: EnrichedVideo, platform: ForecastPlatform): PlatformScore {
  const eng = video.engagement / 100;          // 0–1
  const likeRate = video.likes / Math.max(1, video.views);
  const commentRate = video.comments / Math.max(1, video.views);
  const vsBase = Math.min(video.vsBaseline, 10) / 10; // normalise 0–1

  if (platform === "youtube") {
    // L_auth = (CTR × 0.3) + (AVD × 0.5) + (Satisfaction × 0.2)
    const ctr = Math.min(1, vsBase * 1.2);           // above-baseline = high CTR proxy
    const avd = Math.min(1, eng / 0.06);             // 6% eng ≈ strong watch time
    const sat = Math.min(1, likeRate / 0.04);        // 4% like rate = high satisfaction
    const score = ctr * 0.3 + avd * 0.5 + sat * 0.2;
    return {
      platform, score,
      formula: "L_auth = (CTR×0.3) + (AVD×0.5) + (Satisfaction×0.2)",
      signals: [
        { label: "CTR / Thumbnail resonance", value: ctr, weight: 0.30, description: `${(video.vsBaseline).toFixed(1)}x channel baseline → ${(ctr * 100).toFixed(0)}%` },
        { label: "Watch time / AVD proxy", value: avd, weight: 0.50, description: `${video.engagement.toFixed(1)}% engagement → ${(avd * 100).toFixed(0)}%` },
        { label: "Viewer satisfaction", value: sat, weight: 0.20, description: `${(likeRate * 100).toFixed(2)}% like rate → ${(sat * 100).toFixed(0)}%` },
      ],
    };
  }

  if (platform === "youtube_short") {
    // S_vir = (Viewed vs Swiped×0.5) + (Loop rate×0.3) + (DM share×0.2)
    const viewed = Math.min(1, eng / 0.08);
    const loop = Math.min(1, video.velocity / 20000);
    const dm = Math.min(1, commentRate / 0.015);
    const score = viewed * 0.5 + loop * 0.3 + dm * 0.2;
    return {
      platform, score,
      formula: "S_vir = (Viewed/Swiped×0.5) + (Loop rate×0.3) + (DM share×0.2)",
      signals: [
        { label: "Viewed vs Swiped (>70% threshold)", value: viewed, weight: 0.50, description: `${video.engagement.toFixed(1)}% eng → ${(viewed * 100).toFixed(0)}%` },
        { label: "Replay / Loop rate", value: loop, weight: 0.30, description: `${video.velocity.toLocaleString()} views/day → ${(loop * 100).toFixed(0)}%` },
        { label: "Shares to DM", value: dm, weight: 0.20, description: `${(commentRate * 100).toFixed(2)}% comment rate → ${(dm * 100).toFixed(0)}%` },
      ],
    };
  }

  if (platform === "tiktok") {
    // T_vir = (Completion×0.45) + (Rewatch/Loop×0.35) + (DM share×0.2)
    const completion = Math.min(1, eng / 0.07);
    const rewatch = Math.min(1, video.velocity / 50000);
    const dmShare = Math.min(1, likeRate / 0.07);
    const score = completion * 0.45 + rewatch * 0.35 + dmShare * 0.2;
    return {
      platform, score,
      formula: "T_vir = (Completion×0.45) + (Rewatch×0.35) + (DM share×0.2)",
      signals: [
        { label: "Completion rate (>42% for <20s)", value: completion, weight: 0.45, description: `${video.engagement.toFixed(1)}% eng → ${(completion * 100).toFixed(0)}%` },
        { label: "Rewatch / Loop (5x a Like)", value: rewatch, weight: 0.35, description: `${video.velocity.toLocaleString()} views/day → ${(rewatch * 100).toFixed(0)}%` },
        { label: "DM shares (+25 pts each)", value: dmShare, weight: 0.20, description: `${(likeRate * 100).toFixed(2)}% like rate → ${(dmShare * 100).toFixed(0)}%` },
      ],
    };
  }

  // Instagram Reels
  // I_vir = (Sends/Reach×0.4) + (Saves×0.3) + (3s Hook×0.3)
  const sends = Math.min(1, eng / 0.05);
  const saves = Math.min(1, commentRate / 0.01);
  const hook = Math.min(1, video.velocity / 10000);
  const score = sends * 0.4 + saves * 0.3 + hook * 0.3;
  return {
    platform, score,
    formula: "I_vir = (Sends/Reach×0.4) + (Saves×0.3) + (3s Hook×0.3)",
    signals: [
      { label: "Sends per reach (3–5x weight)", value: sends, weight: 0.40, description: `${video.engagement.toFixed(1)}% eng → ${(sends * 100).toFixed(0)}%` },
      { label: "Saves (3x vs Likes)", value: saves, weight: 0.30, description: `${(commentRate * 100).toFixed(2)}% comment proxy → ${(saves * 100).toFixed(0)}%` },
      { label: "3-second hook (>60% threshold)", value: hook, weight: 0.30, description: `${video.velocity.toLocaleString()} views/day → ${(hook * 100).toFixed(0)}%` },
    ],
  };
}

// ─── Virality Coefficient K = i × c ───
function computeK(video: EnrichedVideo, platformScore: number): ViralityCoefficient {
  const likeRate = video.likes / Math.max(1, video.views);
  const engRate = video.engagement / 100;

  // i: estimated shares per view (proxy: like rate × 0.15 generous share rate)
  const sharesPerView = likeRate * 0.15 + engRate * 0.05;
  const i = sharesPerView * 1000; // per 1000 views

  // c: conversion of shares → new views (proxy: platformScore × baseline performance)
  const c = Math.min(1, platformScore * (video.vsBaseline / 3));

  const K = Math.min(3, sharesPerView * c * 10 + platformScore * 0.5);

  let verdict: string;
  let color: string;
  if (K >= 1.5) { verdict = "Exponential — viral trajectory confirmed"; color = "#30D158"; }
  else if (K >= 1.0) { verdict = "Growing — algorithm is amplifying"; color = "#00D4AA"; }
  else if (K >= 0.7) { verdict = "Contained — steady but not viral"; color = "#FFD60A"; }
  else { verdict = "Declining — limited organic spread"; color = "#FF453A"; }

  return { K: parseFloat(K.toFixed(2)), shares: parseFloat((i).toFixed(1)), conversion: parseFloat((c * 100).toFixed(1)), verdict, color };
}

// ─── Monthly projections (6 months) ───
function computeMonthly(
  currentViews: number,
  daysSince: number,
  platform: ForecastPlatform,
  platformScore: number,
  K: number
): MonthlyProjection[] {
  const shareCurrent = cumulativeShare(daysSince, platform);
  const estimatedTotal = currentViews / shareCurrent;
  const viralMultiplier = K > 1 ? Math.min(3, K * 1.2) : 1;

  return [1, 2, 3, 4, 5, 6].map((month) => {
    const day = month * 30;
    const share = cumulativeShare(day, platform);
    const base = estimatedTotal * share;
    const mid = Math.round(base * (0.8 + platformScore * 0.4));
    const high = Math.round(base * viralMultiplier * (1 + platformScore * 0.5));
    const low = Math.round(base * 0.4);
    return { month, low: Math.max(low, currentViews), mid: Math.max(mid, currentViews), high: Math.max(high, currentViews) };
  });
}

// ─── Replication signals ───
function buildReplicationSignals(video: EnrichedVideo, platform: ForecastPlatform, K: number, score: number): string[] {
  const signals: string[] = [];
  const likeRate = (video.likes / Math.max(1, video.views)) * 100;

  if (video.isOutlier) signals.push(`✦ Outlier content — ${video.vsBaseline}x channel median. Replicate the format and topic immediately.`);
  if (likeRate >= 4) signals.push(`Strong like-to-view ratio (${likeRate.toFixed(1)}%) — viewers are satisfied. Use the same hook structure.`);
  if (video.engagement >= 5) signals.push(`High engagement (${video.engagement.toFixed(1)}%) — strong watch-time signal. Keep the same video length.`);
  if (K >= 1.0) signals.push(`Virality Coefficient K=${K} ≥ 1 — content is self-spreading. Publish follow-up within 48h to ride the wave.`);

  if (platform === "tiktok") {
    signals.push("TikTok: Prioritise completion — keep videos under 20s for >42% completion. Rewatch loops matter 5x more than a Like.");
    if (video.velocity > 10000) signals.push("High daily velocity — algorithm is in loop-distribution mode. Pin the best comment to boost DMs.");
  }
  if (platform === "youtube") {
    signals.push("YouTube: AVD is the anchor metric (50% weight). Build your next video around the same topic — search SEO extends the long tail.");
  }
  if (platform === "youtube_short") {
    signals.push("Shorts: Viewed-vs-Swiped is the kill switch. If >30% swipe, distribution halts. Test 3 hooks in the first frame.");
  }
  if (platform === "instagram") {
    signals.push("Instagram: DM Sends are weighted 3–5x more than Likes. Create utility/reference content that people save and send.");
    signals.push("3-second hold is the gate — if they don't stay, the Reel is dead. Lead with the payoff frame first.");
  }

  if (score < 0.4) signals.push("⚠ Low platform score — consider refreshing the hook, thumbnail, and title before publishing a follow-up.");

  return signals;
}

// ─── Main export ───
export function detectPlatform(video: { platform?: string; duration?: string }): ForecastPlatform {
  if (video.platform === "tiktok") return "tiktok";
  if (video.duration) {
    const parts = video.duration.split(":").map(Number);
    const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
    if (secs <= 60) return "youtube_short";
  }
  return "youtube";
}

export function forecastViews(
  video: EnrichedVideo,
  targetDate: Date
): ViewForecast {
  const platform = detectPlatform(video);
  const now = new Date();
  const published = new Date(video.publishedAt);
  const daysSince = Math.max(1, Math.floor((now.getTime() - published.getTime()) / 86400000));
  const daysToTarget = Math.max(daysSince, Math.floor((targetDate.getTime() - published.getTime()) / 86400000));

  const platformScore = computePlatformScore(video, platform);
  const coefficient = computeK(video, platformScore.score);
  const monthlyProjections = computeMonthly(video.views, daysSince, platform, platformScore.score, coefficient.K);

  const shareCurrent = cumulativeShare(daysSince, platform);
  const shareTarget = cumulativeShare(daysToTarget, platform);
  const estimatedTotal = video.views / shareCurrent;

  // Virality-adjusted base
  const viralBoost = coefficient.K > 1 ? Math.min(2, coefficient.K * 1.1) : 1;
  const scoreBoost = 0.6 + platformScore.score * 0.8;

  const baseMid = estimatedTotal * shareTarget;
  const mid = Math.round(baseMid * scoreBoost);
  const high = Math.round(baseMid * viralBoost * (1 + platformScore.score * 0.6));
  const spreadFactor = Math.min(0.6, 0.15 + (daysToTarget / daysSince) * 0.06);
  const low = Math.round(mid * (1 - spreadFactor));

  const confidence: "low" | "medium" | "high" = daysSince < 3 ? "low" : daysSince < 10 ? "medium" : "high";

  return {
    low: Math.max(low, video.views),
    mid: Math.max(mid, video.views),
    high: Math.max(high, video.views),
    daysToTarget,
    daysSincePublish: daysSince,
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    confidence,
    platformScore,
    coefficient,
    monthlyProjections,
    replicationSignals: buildReplicationSignals(video, platform, coefficient.K, platformScore.score),
  };
}
