/**
 * Platform-Specific View Forecast Engine — 2026
 * 
 * Separate decay curves, scoring formulas, K coefficient, and replication signals per platform.
 * 
 * Sources:
 *  - TikTok: Leaked internal scoring (DM=25pts, Save=15pts, Finish=8pts, Like=3pts),
 *            platform research 2024-2026, completion threshold raised to 70% in 2024
 *  - Instagram: Mosseri-confirmed signal hierarchy (Jan/Feb 2025, Feb 2026),
 *               DM sends as #1 signal for non-follower reach, saves 3x weight of like
 *  - YouTube Shorts: No 48hr virality cap (announced 2024), V_vs as primary signal,
 *                    Creator Insider 2025 on loop rate and external shares
 *  - YouTube Long-Form: AVD/CTR/Satisfaction formula, Todd Beaupré Creator Insider,
 *                       Hype button (2025), evergreen search-driven model
 */

import type { EnrichedVideo } from "./types";

export type ForecastPlatform = "youtube" | "youtube_short" | "tiktok" | "instagram";

export interface PlatformScore {
  platform: ForecastPlatform;
  score: number;
  platformLabel: string;
  formula: string;
  signals: {
    label: string;
    value: number;
    weight: number;
    description: string;
  }[];
}

export interface ViralityCoefficient {
  K: number;
  shares: number;
  conversion: number;
  verdict: string;
  color: string;
}

export interface MonthlyProjection {
  month: number;
  low: number;
  mid: number;
  high: number;
}

export interface ConfidenceFactor {
  label: string;
  earned: number;
  max: number;
  tip: string;
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
  confidencePoints: number;
  confidenceFactors: ConfidenceFactor[];
  platformScore: PlatformScore;
  coefficient: ViralityCoefficient;
  monthlyProjections: MonthlyProjection[];
  replicationSignals: string[];
}

const PLATFORM_LABELS: Record<ForecastPlatform, string> = {
  youtube: "YouTube Long-Form",
  youtube_short: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram Reels",
};

// ─── DECAY CURVES — platform-specific cumulative fraction of lifetime views ─
//
// TikTok:       Fast decay. 38% in Day 1. Ceiling ~30 days.
//               Exception: TikTok SEO/search content extends shelf life.
//
// Instagram:    Medium decay. 33% Day 1. Save-extended ceiling ~35 days.
//               High-save Reels resurface via "Suggested for you" for 2-4 weeks extra.
//
// YT Shorts:    NO 48hr cap (2024 change). Slow initial, search extends indefinitely.
//               28% Day 1, but significant views still arrive at Day 90+.
//
// YT Long-Form: Evergreen. Search-driven views persist for years.
//               Initial push (CTR-gated) followed by search long-tail indefinitely.

function cumulativeShare(day: number, platform: ForecastPlatform): number {
  if (day <= 0) return 0.001;

  // TikTok: aggressive early decay, mostly done by day 30
  if (platform === "tiktok") {
    if (day >= 30) return 1.0;
    if (day <= 1)  return 0.38;
    if (day <= 3)  return 0.62;
    if (day <= 7)  return 0.82;
    if (day <= 14) return 0.93;
    return 0.93 + (day - 14) / 16 * 0.07;
  }

  // Instagram Reels: slightly slower than TikTok; save-extended to 35 days
  if (platform === "instagram") {
    if (day >= 35) return 1.0;
    if (day <= 1)  return 0.33;
    if (day <= 3)  return 0.57;
    if (day <= 7)  return 0.77;
    if (day <= 14) return 0.92;
    if (day <= 21) return 0.97;
    return 0.97 + (day - 21) / 14 * 0.03;
  }

  // YouTube Shorts: no time cap; search creates indefinite long tail
  // Modelled to 365 days but search continues beyond
  if (platform === "youtube_short") {
    if (day >= 365) return 1.0;
    if (day <= 1)   return 0.18;
    if (day <= 7)   return 0.38;
    if (day <= 30)  return 0.58;
    if (day <= 90)  return 0.72;
    if (day <= 180) return 0.82;
    if (day <= 365) return 0.90;
    return 0.90 + (day - 365) / 365 * 0.10;
  }

  // YouTube Long-Form: evergreen; search long-tail runs for years
  if (day >= 730) return 1.0;
  if (day <= 2)   return 0.12;
  if (day <= 7)   return 0.28;
  if (day <= 30)  return 0.48;
  if (day <= 90)  return 0.65;
  if (day <= 180) return 0.76;
  if (day <= 365) return 0.86;
  return 0.86 + (day - 365) / 365 * 0.14;
}

// ─── PLATFORM SCORING FORMULAS ────────────────────────────────────────────
//
// Each platform has a distinct primary formula derived from confirmed signal research.
// Proxy variables used where direct API data is unavailable.

function computePlatformScore(video: EnrichedVideo, platform: ForecastPlatform): PlatformScore {
  const eng        = video.engagement / 100;
  const likeRate   = video.likes   / Math.max(1, video.views);
  const commentRate= video.comments / Math.max(1, video.views);
  const shareRate  = (video.shares ?? 0) / Math.max(1, video.views);

  // ── YouTube Long-Form ──────────────────────────────────────────────────
  // Formula: (AVD×0.50) + (CTR×0.30) + (Satisfaction×0.20)
  // AVD = Average View Duration (target ≥50% of length)
  // CTR = Click-Through Rate (target ≥4% first 48hrs; thumbnail+title)
  // Satisfaction = Hype button + post-watch surveys + like ratio (≥4% like/view = excellent)
  if (platform === "youtube") {
    // AVD proxy: engagement rate relative to benchmark (high eng on long videos = strong retention)
    const avdProxy       = Math.min(1, (eng + likeRate * 0.5) / 0.10);
    // CTR proxy: daily velocity relative to view expectations
    const ctrProxy       = Math.min(1, video.velocity / 80000);
    // Satisfaction proxy: like/view ratio (4% = pass threshold)
    const satisfactionP  = Math.min(1, likeRate / 0.04);
    const score = avdProxy * 0.50 + ctrProxy * 0.30 + satisfactionP * 0.20;
    return {
      platform, score, platformLabel: PLATFORM_LABELS[platform],
      formula: "YT_LF = (AVD×0.50) + (CTR×0.30) + (Satisfaction×0.20)",
      signals: [
        { label: "Avg Watch Duration  [≥50% of length]",       value: avdProxy,      weight: 0.50, description: `${(eng*100).toFixed(2)}% eng+like proxy → ${(avdProxy*100).toFixed(0)}%` },
        { label: "CTR  [≥4% first 48hrs, thumbnail+title]",    value: ctrProxy,      weight: 0.30, description: `${video.velocity.toLocaleString()} views/day → ${(ctrProxy*100).toFixed(0)}%` },
        { label: "Satisfaction  [Hype + like ratio ≥4%]",      value: satisfactionP, weight: 0.20, description: `${(likeRate*100).toFixed(2)}% like rate → ${(satisfactionP*100).toFixed(0)}%` },
      ],
    };
  }

  // ── YouTube Shorts ─────────────────────────────────────────────────────
  // Formula: (V_vs×0.50) + (Loop_rate×0.30) + (External_shares×0.20)
  // V_vs = Viewed vs Swiped (>30% swipe-away = PERMANENT burial)
  // Loop = Rewatch/loop rate (natural loops identified by YT system)
  // External = WhatsApp/iMessage/Discord shares (highest external-share weight of 4 platforms)
  if (platform === "youtube_short") {
    const vVsS      = Math.min(1, eng / 0.05);
    const loopRate  = Math.min(1, video.velocity / 25000);
    const extShares = Math.min(1, shareRate / 0.004);
    const score = vVsS * 0.50 + loopRate * 0.30 + extShares * 0.20;
    return {
      platform, score, platformLabel: PLATFORM_LABELS[platform],
      formula: "YTS = (V_vs×0.50) + (Loop×0.30) + (ExtShares×0.20)",
      signals: [
        { label: "Viewed vs Swiped  [>30% swipe = permanent death]", value: vVsS,      weight: 0.50, description: `${video.engagement.toFixed(1)}% eng → ${(vVsS*100).toFixed(0)}%` },
        { label: "Loop/Rewatch rate  [natural loops >15%]",           value: loopRate,  weight: 0.30, description: `${video.velocity.toLocaleString()} views/day → ${(loopRate*100).toFixed(0)}%` },
        { label: "External shares  [WhatsApp/Discord; highest weight]",value: extShares, weight: 0.20, description: `${(shareRate*100).toFixed(4)}% share rate → ${(extShares*100).toFixed(0)}%` },
      ],
    };
  }

  // ── TikTok FYP ─────────────────────────────────────────────────────────
  // Formula: (Completion×0.45) + (Rewatch×0.35) + (DM_send×0.20)
  // Leaked internal points: DM=25, Save=15, Finish=8, Comment=8, Like=3
  // Completion threshold raised to 70% in 2024 (from 50%)
  if (platform === "tiktok") {
    const completion = Math.min(1, eng / 0.07);
    const rewatch    = Math.min(1, video.velocity / 50000);
    const dmSend     = Math.min(1, shareRate / 0.008);
    const score = completion * 0.45 + rewatch * 0.35 + dmSend * 0.20;
    return {
      platform, score, platformLabel: PLATFORM_LABELS[platform],
      formula: "TT = (Completion×0.45) + (Rewatch×0.35) + (DM_send×0.20)",
      signals: [
        { label: "Completion rate  [≥70% gate; <70% = 200-view jail]", value: completion, weight: 0.45, description: `${video.engagement.toFixed(1)}% eng → ${(completion*100).toFixed(0)}%` },
        { label: "Rewatch/Loop  [15pts internal; 1×3 beats 3×1]",       value: rewatch,    weight: 0.35, description: `${video.velocity.toLocaleString()} views/day → ${(rewatch*100).toFixed(0)}%` },
        { label: "DM send  [25pts internal — highest single action]",    value: dmSend,     weight: 0.20, description: `${(shareRate*100).toFixed(3)}% share rate → ${(dmSend*100).toFixed(0)}%` },
      ],
    };
  }

  // ── Instagram Reels ────────────────────────────────────────────────────
  // Formula: (DM_sends×0.40) + (Saves×0.30) + (3s_hold+Watch×0.30)
  // Mosseri confirmed DM sends = "#1 signal for non-follower reach" (Jan 2025, Feb 2026)
  // Saves = 3× weight of a like
  // 3-sec hold <40% = 5-10× less reach (immediate kill gate)
  const dmSends  = Math.min(1, shareRate / 0.005);
  const saves    = Math.min(1, commentRate / 0.004);
  const hookWt   = Math.min(1, eng / 0.05);
  const score = dmSends * 0.40 + saves * 0.30 + hookWt * 0.30;
  return {
    platform, score, platformLabel: PLATFORM_LABELS[platform],
    formula: "IG = (DM_sends×0.40) + (Saves×0.30) + (3s_hold+Watch×0.30)",
    signals: [
      { label: "DM sends/reach  [~40%; Mosseri #1 signal for non-follower reach]", value: dmSends, weight: 0.40, description: `${(shareRate*100).toFixed(3)}% share rate → ${(dmSends*100).toFixed(0)}%` },
      { label: "Saves  [~30%; 3× weight of like; extends shelf life 2-4 weeks]",   value: saves,   weight: 0.30, description: `${(commentRate*100).toFixed(2)}% comment proxy → ${(saves*100).toFixed(0)}%` },
      { label: "3-sec hold + watch  [~30%; <40% hold = 5-10× less reach]",         value: hookWt,  weight: 0.30, description: `${video.engagement.toFixed(1)}% eng → ${(hookWt*100).toFixed(0)}%` },
    ],
  };
}

// ─── VIRALITY COEFFICIENT K ────────────────────────────────────────────────
// K = i × c   (infection × conversion)
// K > 1.5 = exponential viral  |  K 1.0-1.5 = self-sustaining  |  K < 1.0 = declining

function computeK(
  video: EnrichedVideo,
  platform: ForecastPlatform,
  platformScore: number
): ViralityCoefficient {
  const likeRate  = video.likes / Math.max(1, video.views);
  const engRate   = video.engagement / 100;
  const shareRate = (video.shares ?? 0) / Math.max(1, video.views);

  let i: number;
  let c: number;

  if (platform === "tiktok") {
    // DM sends dominate TikTok spread (25pts vs 3pts for like)
    i = (likeRate * 0.15 + engRate * 0.05) * 1000;
    c = Math.min(1, platformScore * (video.vsBaseline / 3));
  } else if (platform === "instagram") {
    // DM sends + saves both drive new viewer acquisition
    i = Math.max(shareRate * 1000, likeRate * 0.08 * 1000);
    c = Math.min(1, platformScore * (video.vsBaseline / 3) * 1.2);
  } else if (platform === "youtube_short") {
    // External shares (WhatsApp/Discord) are the primary K driver
    i = Math.max(shareRate * 1000, likeRate * 0.10 * 1000);
    c = Math.min(1, platformScore * (video.vsBaseline / 3));
  } else {
    // YouTube LF: slower spread but search creates separate K-independent distribution
    i = (likeRate * 0.10 + engRate * 0.03) * 1000;
    c = Math.min(1, platformScore * (video.vsBaseline / 3) * 0.8);
  }

  const K = Math.min(3, (i / 1000) * c * 10 + platformScore * 0.5);

  const verdict =
    K >= 1.5 ? "Exponential — viral trajectory confirmed" :
    K >= 1.0 ? "Self-sustaining — algorithm amplifying"   :
    K >= 0.7 ? "Contained — algorithm-dependent growth"   :
               "Declining — limited organic spread";

  const color =
    K >= 1.5 ? "#30D158" :
    K >= 1.0 ? "#00D4AA" :
    K >= 0.7 ? "#FFD60A" :
               "#FF453A";

  return {
    K:          parseFloat(K.toFixed(2)),
    shares:     parseFloat(i.toFixed(1)),
    conversion: parseFloat((c * 100).toFixed(1)),
    verdict,
    color,
  };
}

// ─── MONTHLY PROJECTIONS ──────────────────────────────────────────────────

function computeMonthly(
  currentViews: number,
  daysSince: number,
  platform: ForecastPlatform,
  platformScore: number,
  K: number
): MonthlyProjection[] {
  const shareCurrent   = cumulativeShare(daysSince, platform);
  const estimatedTotal = currentViews / shareCurrent;
  const viralMult      = K > 1 ? Math.min(3, K * 1.2) : 1;

  return [1, 2, 3, 4, 5, 6].map((month) => {
    const day   = month * 30;
    const share = cumulativeShare(day, platform);
    const base  = estimatedTotal * share;
    const mid   = Math.round(base * (0.70 + platformScore * 0.60));
    const high  = Math.round(base * viralMult * (1 + platformScore * 0.60));
    const low   = Math.round(base * 0.35);
    return {
      month,
      low:  Math.max(low,  currentViews),
      mid:  Math.max(mid,  currentViews),
      high: Math.max(high, currentViews),
    };
  });
}

// ─── PLATFORM-SPECIFIC REPLICATION SIGNALS ────────────────────────────────

function buildReplicationSignals(
  video: EnrichedVideo,
  platform: ForecastPlatform,
  K: number,
  score: number
): string[] {
  const signals: string[] = [];
  const likeRate = (video.likes / Math.max(1, video.views)) * 100;

  if (video.isOutlier) {
    signals.push(`✦ Outlier — ${video.vsBaseline}× channel median. Replicate this format and topic across all active creators immediately.`);
  }
  if (K >= 1.5) {
    signals.push(`K=${K} — exponential. Publish follow-up same format within 48 hours to ride the distribution wave.`);
  } else if (K >= 1.0) {
    signals.push(`K=${K} — self-sustaining growth. Engage every comment in first hour to signal continued traction.`);
  }

  if (platform === "tiktok") {
    signals.push("TikTok: Completion is the gating signal (≥70% or 200-view jail). Keep 20–45s. Loop the ending back to the opening frame — one viewer watching 3× beats three watching once.");
    signals.push("CTA: 'Send this to your trading group' not 'share this'. Named recipient = 3× DM send rate. DM sends score 25pts internally vs 3pts for a like.");
    if (likeRate >= 4) signals.push(`Like rate ${likeRate.toFixed(1)}% — strong. Speak the primary keyword in the first 5s for TikTok audio NLP indexing (49% of US consumers use TikTok as a search engine).`);
    if (video.velocity > 10000) signals.push("High velocity — TikTok is in active distribution mode. Post next video during follower peak window (check Analytics → Followers tab).");
  }

  if (platform === "instagram") {
    signals.push("Instagram: DM sends (~40%) + saves (~30%) = 70% of non-follower distribution. Every Reel needs a 'send this to [named person]' moment AND a save-worthy reference element.");
    signals.push("3-sec hook must land before caption overlay (~1.5s). Use Trial Reels to test hold rate on non-followers before main-feed commit. Never post a watermarked file.");
    if ((video.saves ?? 0) > 0) {
      const saveRate = ((video.saves ?? 0) / video.views * 100).toFixed(2);
      signals.push(`Save rate ${saveRate}% — high-save Reels get 2–4 weeks extended shelf life via 'Suggested for you'. Build more rule/number/formula reference content.`);
    }
  }

  if (platform === "youtube_short") {
    signals.push("Shorts: Frame 1 IS the thumbnail. Open on most striking visual — payout, chart spike, funded cert. Zero intros/logos. >30% swipe-away = permanent burial.");
    signals.push("No 48hr cap in 2026 — this Short can keep growing for weeks. Share the link to WhatsApp/Discord immediately after posting to seed external shares in first 90 min.");
    signals.push("Design the loop: cut before any outro or fade. Last frame flows back to Frame 1. Loop rate is 30% of the Shorts formula.");
    if (video.durationSeconds > 60) signals.push(`Duration ${Math.round(video.durationSeconds)}s — trim to 30s. Every extra second costs completion rate. Shorter = mechanically higher completion.`);
  }

  if (platform === "youtube") {
    signals.push("YouTube LF: AVD is 50% of formula. If CTR is high but engagement drops — viewers clicked but didn't stay. 'Broken promise' — title/thumbnail over-promised.");
    signals.push("Evergreen: say the keyword in the first 30s for audio NLP indexing. A well-titled video on 'how to pass a FundedNext challenge' earns search views indefinitely.");
    signals.push("Hype button (2026, <500K subs): ask mid-video 'Hit Hype — it's different from a like and directly boosts how many traders YouTube shows this to.'");
    if (likeRate >= 4) signals.push(`Like rate ${likeRate.toFixed(1)}% — strong satisfaction (20% formula weight). Pin a comment with the FN link now while engagement is high.`);
  }

  if (score < 0.4) {
    signals.push("⚠ Low platform score. Before publishing follow-up: refresh hook structure, Frame 1 (Shorts) or thumbnail (YT LF), and the primary CTA.");
  }

  return signals;
}

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────

export function detectPlatform(
  video: { platform?: string; duration?: string; durationSeconds?: number }
): ForecastPlatform {
  if (video.platform === "tiktok")       return "tiktok";
  if (video.platform === "instagram")    return "instagram";
  if (video.platform === "youtube_short") return "youtube_short";

  const secs = video.durationSeconds ??
    (video.duration ? (() => {
      const p = video.duration!.split(":").map(Number);
      return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2]
           : p.length === 2 ? p[0]*60 + p[1] : p[0];
    })() : 0);

  if (secs > 0 && secs <= 180) return "youtube_short";
  return "youtube";
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────

export function forecastViews(video: EnrichedVideo, targetDate: Date): ViewForecast {
  const platform   = detectPlatform(video);
  const now        = new Date();
  const published  = new Date(video.publishedAt);
  const daysSince  = Math.max(1, Math.floor((now.getTime() - published.getTime()) / 86400000));
  const daysToTarget = Math.max(daysSince, Math.floor((targetDate.getTime() - published.getTime()) / 86400000));

  const platformScore = computePlatformScore(video, platform);
  const coefficient   = computeK(video, platform, platformScore.score);
  const monthlyProjections = computeMonthly(video.views, daysSince, platform, platformScore.score, coefficient.K);

  const shareCurrent   = cumulativeShare(daysSince, platform);
  const shareTarget    = cumulativeShare(daysToTarget, platform);
  const estimatedTotal = video.views / shareCurrent;

  // ── Trend multiplier (news/event recency bonus) ──────────────────────
  // Import lazily to avoid circular deps; use dynamic require pattern
  let trendMultiplier = 1.0;
  try {
    const { analyzeTrends } = require("./trend-intelligence");
    const trendData = analyzeTrends(
      video.title, video.tags ?? [], video.description ?? "",
      video.publishedAt, platform
    );
    trendMultiplier = Math.min(3.5, trendData.forecastMultiplier);
  } catch { /* trend module optional */ }

  // ── Psychology score adjustment ───────────────────────────────────────
  // Content with strong emotional architecture performs above baseline
  let psychBoost = 1.0;
  try {
    const { scorePsychology } = require("./psychology");
    const psychData = scorePsychology(video);
    // Psychology score 0-100 → 0.85-1.15 multiplier
    psychBoost = 0.85 + (psychData.score / 100) * 0.30;
  } catch { /* psychology module optional */ }

  const viralBoost  = coefficient.K > 1 ? Math.min(2.5, coefficient.K * 1.15) : 1;
  const scoreBoost  = 0.55 + platformScore.score * 0.90;

  const baseMid = estimatedTotal * shareTarget;
  const mid  = Math.round(baseMid * scoreBoost * psychBoost * trendMultiplier);
  const high = Math.round(baseMid * viralBoost * (1 + platformScore.score * 0.65) * Math.min(2, trendMultiplier * 1.2));

  // Spread factor: wider for evergreen YT LF (search unpredictability) vs fast-decay TikTok
  const spreadMap: Record<ForecastPlatform, number> = {
    tiktok: 0.18, instagram: 0.22, youtube_short: 0.25, youtube: 0.35,
  };
  const spreadFactor = Math.min(
    spreadMap[platform] * 2,
    spreadMap[platform] + (daysToTarget / daysSince) * 0.05
  );
  const low = Math.round(mid * (1 - spreadFactor));

  // ── Confidence scoring (0-100) ─────────────────────────────────────────
  let cp = 0;
  const factors: ConfidenceFactor[] = [];

  const daysPts = daysSince >= 14 ? 40 : daysSince >= 7 ? 28 : daysSince >= 3 ? 16 : 6;
  factors.push({ label: "Days of data", earned: daysPts, max: 40,
    tip: daysSince >= 14 ? `${daysSince}d — full decay curve` : daysSince >= 7 ? `${daysSince}d — 1 week` : daysSince >= 3 ? `${daysSince}d — early` : `${daysSince}d — too early` });
  cp += daysPts;

  const viewsPts = video.views >= 100000 ? 20 : video.views >= 10000 ? 14 : video.views >= 1000 ? 8 : 3;
  factors.push({ label: "View volume", earned: viewsPts, max: 20,
    tip: `${video.views.toLocaleString()} — ${video.views >= 100000 ? "stable" : video.views >= 10000 ? "moderate" : "small sample"}` });
  cp += viewsPts;

  const engPts = video.engagement >= 5 ? 20 : video.engagement >= 2 ? 12 : video.engagement >= 0.5 ? 6 : 2;
  factors.push({ label: "Engagement quality", earned: engPts, max: 20,
    tip: `${video.engagement.toFixed(2)}% — ${video.engagement >= 5 ? "high-intent" : video.engagement >= 2 ? "average" : "low signal"}` });
  cp += engPts;

  const scorePts = Math.round(platformScore.score * 20);
  factors.push({ label: `${PLATFORM_LABELS[platform]} formula fit`, earned: scorePts, max: 20,
    tip: `${(platformScore.score * 100).toFixed(0)}% readiness — ${platformScore.score >= 0.6 ? "good fit" : platformScore.score >= 0.3 ? "partial" : "low fit"}` });
  cp += scorePts;

  const confidence: "low" | "medium" | "high" = cp >= 70 ? "high" : cp >= 45 ? "medium" : "low";

  return {
    low:  Math.max(low,  video.views),
    mid:  Math.max(mid,  video.views),
    high: Math.max(high, video.views),
    daysToTarget,
    daysSincePublish: daysSince,
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    confidence,
    confidencePoints: cp,
    confidenceFactors: factors,
    platformScore,
    coefficient,
    monthlyProjections,
    replicationSignals: buildReplicationSignals(video, platform, coefficient.K, platformScore.score),
  };
}
