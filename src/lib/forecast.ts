// ═══════════════════════════════════════════════════════════════════════════
// FORECAST ENGINE — unified replacement for view-forecast + view-predictor
// ═══════════════════════════════════════════════════════════════════════════
//
// ONE forecaster. ONE score source. ONE decay model per platform.
// Handles pre-publish (no velocity data) and post-publish (velocity known)
// in the same code path — velocity is an input signal, not a separate mode.
//
// DESIGN PRINCIPLES
// -----------------
//  1. Creator baseline is the anchor. All platforms.
//     Score multiplier is applied relative to creator median.
//     This keeps the prediction honest: we predict relative to what this
//     creator actually does, not what some imaginary "typical" creator does.
//
//  2. Velocity, when available, is a BAYESIAN UPDATE on the prior.
//     Pre-publish: prior = creator_median × score_multiplier × platform_factor
//     Post-publish: updated_prior = blend(prior, observed_trajectory)
//     The blend weight depends on how much of the post's life has elapsed.
//     Day 1 of a TikTok = trajectory is noisy, trust the prior more.
//     Day 10 of a TikTok = trajectory dominates, prior becomes negligible.
//
//  3. No duplicate scoring. Always read video.vrs.estimatedFullScore.
//     The VRS/TRS/IRS/XRS/YRS router handles platform-specific scoring.
//
//  4. Confidence reflects DATA QUALITY, not output precision.
//     A forecast can have a wide range AND high confidence (volatile niche,
//     known well). Or tight range AND low confidence (thin data, overfit).
//     We don't conflate these.
//
//  5. Missing inputs are surfaced explicitly. We NEVER invent numbers
//     (like "completion rate" from engagement proxies). We list what's
//     missing and user can provide it manually via the UI.

import type { EnrichedVideo, VideoData, VRSResult } from "./types";

export type Platform = "youtube" | "youtube_short" | "tiktok" | "instagram" | "x";

// ═══════════════════════════════════════════════════════════════════════════
// INPUTS + OUTPUTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ForecastInput {
  // Required: the post being forecasted (may have 0 views if pre-publish)
  video: EnrichedVideo;
  // Required: same creator's historical posts, excluding `video`
  creatorHistory: VideoData[];
  // Required: platform — NOT inferred; caller knows context
  platform: Platform;
  // Optional: creator-supplied private analytics (Instagram saves, TikTok completion, etc.)
  manualInputs?: ManualInputs;
  // Optional: velocity time-series from the tracker cron — sharpens the trajectory blend
  velocitySamples?: VelocitySampleInput[];
}

export interface VelocitySampleInput {
  ageHours:     number;
  views:        number;
  velocity:     number;   // views/hour between this and previous sample
  acceleration: number;   // change in velocity (+ = speeding up)
}

export interface ManualInputs {
  // Instagram
  igSaves?:        number;
  igSends?:        number;
  igReach?:        number;
  igHold3s?:       number;  // % retained at 3 seconds
  // TikTok
  ttCompletionPct?: number;
  ttRewatchPct?:   number;
  ttFypViewPct?:   number;
  // YouTube
  ytAVDpct?:       number;
  ytCTRpct?:       number;
  ytImpressions?:  number;
  // X
  xTweepCred?:     number;
  xReplyByAuthor?: number;
  // Override
  baselineMedianOverride?: number;
}

export interface Forecast {
  // The final answer: expected lifetime views (usually 30d horizon, platform-dependent)
  lifetime: { low: number; median: number; high: number };

  // Short-horizon milestones — all derived from the same model
  d1:  { low: number; median: number; high: number };
  d7:  { low: number; median: number; high: number };
  d30: { low: number; median: number; high: number };

  // Platform lifetime horizon (YouTube LF = 365d, X = 3d)
  horizonDays: number;

  // The score-based multiplier applied to creator median (NOT duplicated across panels)
  scoreMultiplier: {
    score: number;           // 0-100, single canonical value from video.vrs.estimatedFullScore
    low:   number;           // e.g. 0.55
    median: number;          // e.g. 1.20
    high:  number;           // e.g. 2.40
    rationale: string;
  };

  // Creator baseline anchor
  baseline: CreatorBaseline | null;

  // Confidence, computed from DATA QUALITY (not output precision)
  confidence: {
    level: "high" | "medium" | "low" | "insufficient";
    score: number;           // 0-100
    reasons: string[];       // what's driving the level
  };

  // If post-publish: how observed trajectory compares to prior
  trajectory: TrajectoryAnalysis | null;

  // Transparency
  dataUsed:      DataSource[];   // actually used in the calculation
  dataEstimated: DataSource[];   // approximated from proxies
  dataMissing:   DataSource[];   // needed but not available, user-fillable

  // Human-readable interpretation
  interpretation: string;

  // Operational notes
  notes: string[];
}

export interface CreatorBaseline {
  postsUsed:    number;
  median:       number;
  p25:          number;
  p75:          number;
  max:          number;
  cv:           number;      // coefficient of variation
  source:       "computed" | "manual" | "insufficient";
}

export interface TrajectoryAnalysis {
  ageDays:          number;
  currentViews:     number;
  expectedByNow:    number;      // prior × platform cumulative fraction
  outperformance:   number;      // currentViews / expectedByNow
  verdict:          "major-outlier" | "above" | "on-track" | "below" | "significantly-below";
  blendWeight:      number;      // 0-1, how much the observed trajectory overrode the prior
}

export interface DataSource {
  field:           string;
  label:           string;
  value?:          number | string;
  source:          "api" | "manual" | "derived" | "missing";
  impact:          "high" | "medium" | "low";
  note?:           string;
  userCanProvide?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM CONSTANTS — tuned per platform, single source of truth
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_CONFIG: Record<Platform, {
  label:          string;
  horizonDays:    number;
  cumulativeShare: (day: number) => number;  // 0-1: fraction of lifetime views by day N
  minBaselinePosts: number;                  // minimum creator history to forecast
  upsideMultiplier: number;                   // at score=100, how far above median is the high-band ceiling
  downsideMultiplier: number;                // at score=0, how far below median is the low-band floor
  scoreExponent:    number;                   // how sharply score → multiplier (higher = more separation)
}> = {
  youtube: {
    label: "YouTube Long-Form",
    horizonDays: 365,
    // Evergreen: steady accumulation via search + suggested, tapers slowly
    cumulativeShare: (d) => {
      if (d <= 0)    return 0.001;
      if (d <= 2)    return 0.12;
      if (d <= 7)    return 0.28;
      if (d <= 30)   return 0.48;
      if (d <= 90)   return 0.65;
      if (d <= 180)  return 0.78;
      if (d <= 365)  return 1.00;
      return 1.0;
    },
    minBaselinePosts: 5,
    upsideMultiplier: 8,    // top video can reach 8× creator median
    downsideMultiplier: 0.15,
    scoreExponent: 2.0,
  },
  youtube_short: {
    label: "YouTube Shorts",
    horizonDays: 90,
    // No 48h cap; search extends, but main push is first 2 weeks
    cumulativeShare: (d) => {
      if (d <= 0)    return 0.001;
      if (d <= 1)    return 0.18;
      if (d <= 7)    return 0.48;
      if (d <= 30)   return 0.78;
      if (d <= 90)   return 1.00;
      return 1.0;
    },
    minBaselinePosts: 8,
    upsideMultiplier: 15,   // high variance on Shorts
    downsideMultiplier: 0.10,
    scoreExponent: 2.3,
  },
  tiktok: {
    label: "TikTok",
    horizonDays: 30,
    // Aggressive early decay, 70% completion gate now makes mid-tail steeper
    cumulativeShare: (d) => {
      if (d <= 0)    return 0.001;
      if (d <= 1)    return 0.35;
      if (d <= 3)    return 0.60;
      if (d <= 7)    return 0.82;
      if (d <= 14)   return 0.93;
      if (d <= 30)   return 1.00;
      return 1.0;
    },
    minBaselinePosts: 10,
    upsideMultiplier: 20,   // interest graph = highest variance
    downsideMultiplier: 0.08,
    scoreExponent: 2.5,
  },
  instagram: {
    label: "Instagram Reels",
    horizonDays: 35,
    // Audition phase then save-extended tail
    cumulativeShare: (d) => {
      if (d <= 0)    return 0.001;
      if (d <= 1)    return 0.33;
      if (d <= 3)    return 0.57;
      if (d <= 7)    return 0.77;
      if (d <= 14)   return 0.92;
      if (d <= 35)   return 1.00;
      return 1.0;
    },
    minBaselinePosts: 8,
    upsideMultiplier: 12,
    downsideMultiplier: 0.10,
    scoreExponent: 2.2,
  },
  x: {
    label: "X (Twitter)",
    horizonDays: 3,
    // 6-hour half-life; ~95% of reach in 24h
    cumulativeShare: (d) => {
      if (d <= 0)      return 0.001;
      if (d <= 0.25)   return 0.35;  // 6h
      if (d <= 0.5)    return 0.60;  // 12h
      if (d <= 1)      return 0.82;  // 24h
      if (d <= 2)      return 0.93;
      if (d <= 3)      return 1.00;
      return 1.0;
    },
    minBaselinePosts: 15,  // X needs more history due to per-post variance
    upsideMultiplier: 25,  // highest — single viral X post can be 50× median
    downsideMultiplier: 0.05,
    scoreExponent: 2.8,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT AT ARBITRARY DATE
// ═══════════════════════════════════════════════════════════════════════════
//
// Takes a forecast result + target date and returns the low/median/high
// projected views at that specific date, using the platform's decay curve
// to scale from the lifetime forecast.

export interface DateProjection {
  low:             number;
  median:          number;
  high:            number;
  daysFromPublish: number;
  shareAtDate:     number;    // 0-1, fraction of lifetime reached by target
  beyondHorizon:   boolean;   // true if target is past platform's horizon
  beforePublish:   boolean;   // true if target is before the publish date
}

export function projectAtDate(
  result:       Forecast,
  platform:     Platform,
  targetDate:   Date,
  publishedAt?: string,
  currentViews: number = 0,
): DateProjection {
  const cfg = PLATFORM_CONFIG[platform];

  // Anchor: publish date if known, otherwise now (pre-publish)
  const anchorMs = publishedAt ? new Date(publishedAt).getTime() : Date.now();
  const targetMs = targetDate.getTime();
  const daysFromPublish = (targetMs - anchorMs) / 86_400_000;

  // Edge case: target date before publish date
  if (daysFromPublish < 0) {
    return {
      low: 0, median: 0, high: 0,
      daysFromPublish, shareAtDate: 0,
      beyondHorizon: false, beforePublish: true,
    };
  }

  const beyondHorizon = daysFromPublish > cfg.horizonDays;
  const share = cfg.cumulativeShare(daysFromPublish);

  // Scale lifetime forecast by share at target date
  let low    = Math.round(result.lifetime.low    * share);
  let median = Math.round(result.lifetime.median * share);
  let high   = Math.round(result.lifetime.high   * share);

  // Floor: projections can never be below current views (views don't go backwards)
  low    = Math.max(low,    currentViews);
  median = Math.max(median, currentViews);
  high   = Math.max(high,   currentViews);

  return {
    low, median, high,
    daysFromPublish, shareAtDate: share,
    beyondHorizon, beforePublish: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.max(0, Math.min(s.length - 1, Math.floor((p / 100) * s.length)));
  return s[i];
}

function cv(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  if (mean === 0) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / mean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE → MULTIPLIER  (single canonical mapping, no duplication)
// ═══════════════════════════════════════════════════════════════════════════
//
// Input: VRS score 0-100.  Output: low/median/high multiplier vs creator median.
//
// Shape: power curve. Bad content (score 20) is capped low.
// Average content (score 50) returns ~creator median. Top content
// (score 80+) can reach the platform's upsideMultiplier ceiling.
//
// The curve is platform-tuned via scoreExponent: higher = sharper separation
// between good and mediocre content (matches reality — TikTok and X have
// sharper separation than YouTube LF where predictable subs drive most views).

function scoreToMultiplier(score: number, platform: Platform): {
  low: number; median: number; high: number; rationale: string;
} {
  const s = Math.max(0, Math.min(100, score)) / 100;  // normalize 0-1
  const cfg = PLATFORM_CONFIG[platform];
  const exp = cfg.scoreExponent;

  // Power curve: s^exp maps 0→0, 1→1, with sharper acceleration at higher scores
  const curved = Math.pow(s, exp);

  // Map curved value into [downsideMult, 1, upsideMult] range
  // Below score 50, interpolate from downsideMultiplier up to 1
  // Above score 50, interpolate from 1 up to upsideMultiplier (via curved)
  let medianMult: number;
  if (score < 50) {
    const t = score / 50;
    medianMult = cfg.downsideMultiplier + (1 - cfg.downsideMultiplier) * Math.pow(t, 1.5);
  } else {
    const t = (score - 50) / 50;
    medianMult = 1 + (cfg.upsideMultiplier - 1) * Math.pow(t, exp);
  }

  // Low/high bands widen at extremes (more uncertainty at edges)
  // Tight band at score 50 (most common), wider at score 0 and 100
  const edgeness = Math.abs(s - 0.5) * 2;  // 0 at middle, 1 at edges
  const bandWidth = 0.35 + edgeness * 0.35;  // ±35% to ±70% band

  const low  = Math.max(cfg.downsideMultiplier * 0.7, medianMult * (1 - bandWidth));
  const high = medianMult * (1 + bandWidth);

  let rationale: string;
  if (score >= 85)       rationale = `Score ${score.toFixed(0)} — top tier. Every major criterion met.`;
  else if (score >= 70)  rationale = `Score ${score.toFixed(0)} — strong performer. Expected to exceed creator median.`;
  else if (score >= 55)  rationale = `Score ${score.toFixed(0)} — above average. Directionally healthy.`;
  else if (score >= 40)  rationale = `Score ${score.toFixed(0)} — roughly average. Median-ish outcome expected.`;
  else if (score >= 25)  rationale = `Score ${score.toFixed(0)} — weak. Likely below creator median.`;
  else                   rationale = `Score ${score.toFixed(0)} — failing multiple criteria. Likely underperformer.`;

  return { low, median: medianMult, high, rationale };
}

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL INPUT ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════
//
// When user provides private analytics, they SHARPEN the multiplier.
// These aren't additional multipliers — they're refinements that reduce uncertainty.

function applyManualAdjustments(
  baseMultiplier: { low: number; median: number; high: number },
  platform: Platform,
  manual: ManualInputs,
): { low: number; median: number; high: number } {

  let adj = 1.0;
  let tightenFactor = 1.0;  // <1 = tighter range (more confidence)

  if (platform === "tiktok" && manual.ttCompletionPct != null) {
    const c = manual.ttCompletionPct;
    // 2026 threshold = 70%. Above = rewarded, below = penalised
    if (c >= 70) adj *= 1 + (c - 70) * 0.015;
    else         adj *= 0.5 + (c / 70) * 0.5;
    tightenFactor *= 0.85;
  }

  if (platform === "tiktok" && manual.ttRewatchPct != null) {
    const r = manual.ttRewatchPct;
    // Rewatch outranks follower count in 2026
    if (r >= 15) adj *= 1 + (r - 15) * 0.02;
    else         adj *= 0.7 + (r / 15) * 0.3;
    tightenFactor *= 0.9;
  }

  if (platform === "instagram" && manual.igSends != null && manual.igReach != null && manual.igReach > 0) {
    const sendsPerReach = manual.igSends / manual.igReach;
    // 1% sends/reach = strong, 3%+ = exceptional
    if (sendsPerReach >= 0.01) adj *= 1 + Math.min(1.5, sendsPerReach * 50);
    else                        adj *= 0.5 + sendsPerReach * 50;
    tightenFactor *= 0.8;  // DM sends are Mosseri's #1 signal — big confidence boost
  }

  if (platform === "instagram" && manual.igSaves != null && manual.igReach != null && manual.igReach > 0) {
    const savesPerReach = manual.igSaves / manual.igReach;
    if (savesPerReach >= 0.01) adj *= 1 + Math.min(0.8, savesPerReach * 30);
    tightenFactor *= 0.9;
  }

  if ((platform === "youtube" || platform === "youtube_short") && manual.ytAVDpct != null) {
    const a = manual.ytAVDpct;
    // AVD is ~50% of YT formula
    if (a >= 50) adj *= 1 + (a - 50) * 0.02;
    else         adj *= 0.5 + (a / 50) * 0.5;
    tightenFactor *= 0.75;
  }

  if ((platform === "youtube" || platform === "youtube_short") && manual.ytCTRpct != null) {
    const c = manual.ytCTRpct;
    if (c >= 4)      adj *= 1 + (c - 4) * 0.08;
    else if (c >= 2) adj *= 0.7 + (c - 2) * 0.15;
    else             adj *= 0.5 * (c / 2);
    tightenFactor *= 0.85;
  }

  if (platform === "x" && manual.xTweepCred != null) {
    const t = manual.xTweepCred;
    if (t >= 65) adj *= 1 + (t - 65) * 0.015;
    else         adj *= 0.3;  // hard throttle below 0.65
    tightenFactor *= 0.85;
  }

  // Clamp adjustment
  adj = Math.max(0.15, Math.min(3.5, adj));
  tightenFactor = Math.max(0.6, tightenFactor);

  const newMedian = baseMultiplier.median * adj;
  const halfRange = ((baseMultiplier.high - baseMultiplier.low) / 2) * tightenFactor;

  return {
    median: newMedian,
    low:    Math.max(newMedian * 0.1, newMedian - halfRange),
    high:   newMedian + halfRange,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BAYESIAN TRAJECTORY BLEND
// ═══════════════════════════════════════════════════════════════════════════
//
// The heart of the rebuild: combine prior (score × baseline) with observed
// velocity.  Early in a post's life, prior dominates. Late in life, observed
// dominates. The blend weight is a function of platform + age.

function blendWithTrajectory(
  prior: { low: number; median: number; high: number },
  video: EnrichedVideo,
  platform: Platform,
  velocitySamples?: VelocitySampleInput[],
): { blended: { low: number; median: number; high: number }; trajectory: TrajectoryAnalysis | null } {

  if (!video.publishedAt || video.views === 0) {
    return { blended: prior, trajectory: null };
  }

  const ageMs = Date.now() - new Date(video.publishedAt).getTime();
  const ageDays = Math.max(0.01, ageMs / 86_400_000);

  const cfg = PLATFORM_CONFIG[platform];
  const cumulativeSoFar = cfg.cumulativeShare(ageDays);

  // Baseline trajectory projection — current views / share-elapsed-so-far
  let trajectoryMedian = video.views / Math.max(0.01, cumulativeSoFar);

  // Velocity signal: if we have multiple samples, detect acceleration/deceleration.
  // Accelerating posts project higher; decelerating posts project lower.
  // This correction is strongest early in the post's life when simple trajectory
  // extrapolation is noisiest.
  let velocityAdjustment = 1.0;
  if (velocitySamples && velocitySamples.length >= 2) {
    const recent = velocitySamples.slice(-3);  // last 3 samples
    const avgAccel = recent.reduce((s, v) => s + v.acceleration, 0) / recent.length;
    const avgVelocity = recent.reduce((s, v) => s + v.velocity, 0) / recent.length;

    if (avgVelocity > 0) {
      // Normalise acceleration as % of current velocity per hour
      const accelRatio = avgAccel / avgVelocity;
      // Clamp: a +50% accel ratio means 1.3× upward correction
      // A -50% ratio (steep decay) means 0.7× downward correction
      velocityAdjustment = 1 + Math.max(-0.4, Math.min(0.4, accelRatio * 0.8));
    }
    trajectoryMedian *= velocityAdjustment;
  }

  // Expected-by-now assumes the prior was right
  const expectedByNow = prior.median * cumulativeSoFar;

  const outperformance = video.views / Math.max(1, expectedByNow);

  // Blend weight: how much to trust observed data.
  // Having velocity samples INCREASES trust in the observed trajectory even
  // early in the post's life — acceleration resolves the noise.
  const baseBlend = Math.pow(cumulativeSoFar, 0.7);
  const velocityBoost = velocitySamples && velocitySamples.length >= 3 ? 0.15 : 0;
  const blendWeight = Math.min(0.95, baseBlend + velocityBoost);

  const blendedMedian = prior.median * (1 - blendWeight) + trajectoryMedian * blendWeight;

  // Range widens if prior and trajectory disagree significantly (honest uncertainty).
  // Velocity samples tighten the range because we have more information.
  const disagreement = Math.abs(Math.log(trajectoryMedian / Math.max(1, prior.median)));
  const rangeInflate = 1 + Math.min(0.5, disagreement * 0.3);
  const velocityTighten = velocitySamples && velocitySamples.length >= 3 ? 0.8 : 1.0;

  const halfRange = ((prior.high - prior.low) / 2) * rangeInflate * velocityTighten;
  const blended = {
    median: blendedMedian,
    low:    Math.max(video.views, blendedMedian - halfRange),
    high:   blendedMedian + halfRange,
  };

  const verdict: TrajectoryAnalysis["verdict"] =
    outperformance >= 3.0 ? "major-outlier" :
    outperformance >= 1.5 ? "above" :
    outperformance >= 0.8 ? "on-track" :
    outperformance >= 0.5 ? "below" :
                            "significantly-below";

  return {
    blended,
    trajectory: {
      ageDays, currentViews: video.views, expectedByNow, outperformance, verdict, blendWeight,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════

function computeConfidence(
  baseline: CreatorBaseline | null,
  platform: Platform,
  manualInputs: ManualInputs,
  trajectory: TrajectoryAnalysis | null,
): Forecast["confidence"] {
  const reasons: string[] = [];
  let score = 0;

  if (!baseline || baseline.source === "insufficient") {
    return {
      level: "insufficient",
      score: 0,
      reasons: [`Fewer than ${PLATFORM_CONFIG[platform].minBaselinePosts} past ${platform === "x" ? "posts" : "videos"} available for this creator — cannot build a baseline.`],
    };
  }

  // Factor 1: History depth (0-30 points)
  const minPosts = PLATFORM_CONFIG[platform].minBaselinePosts;
  if (baseline.postsUsed >= minPosts * 3) {
    score += 30;
    reasons.push(`${baseline.postsUsed} past ${platform === "x" ? "posts" : "videos"} — deep history.`);
  } else if (baseline.postsUsed >= minPosts * 2) {
    score += 22;
    reasons.push(`${baseline.postsUsed} past posts — solid history.`);
  } else if (baseline.postsUsed >= minPosts) {
    score += 15;
    reasons.push(`${baseline.postsUsed} past posts — minimum sufficient.`);
  } else {
    score += 5;
    reasons.push(`Only ${baseline.postsUsed} past posts — thin history.`);
  }

  // Factor 2: Consistency (0-30 points)
  if (baseline.cv < 0.5) {
    score += 30;
    reasons.push(`Creator output is very consistent (CV ${baseline.cv.toFixed(2)}).`);
  } else if (baseline.cv < 1.0) {
    score += 22;
    reasons.push(`Creator output moderately consistent (CV ${baseline.cv.toFixed(2)}).`);
  } else if (baseline.cv < 1.5) {
    score += 12;
    reasons.push(`Creator output somewhat variable (CV ${baseline.cv.toFixed(2)}).`);
  } else {
    score += 5;
    reasons.push(`Creator output highly variable (CV ${baseline.cv.toFixed(2)}) — wide range expected.`);
  }

  // Factor 3: Private analytics provided (0-25 points)
  const manualKeys = Object.keys(manualInputs).filter(k => manualInputs[k as keyof ManualInputs] != null);
  if (manualKeys.length >= 3) {
    score += 25;
    reasons.push(`${manualKeys.length} private analytics inputs provided.`);
  } else if (manualKeys.length >= 1) {
    score += 12;
    reasons.push(`${manualKeys.length} private analytics input(s) provided.`);
  } else {
    score += 0;
    reasons.push(`No private analytics provided — forecast leans on public metrics only.`);
  }

  // Factor 4: Trajectory data (0-15 points)
  if (trajectory && trajectory.blendWeight > 0.7) {
    score += 15;
    reasons.push(`Post is mature (${trajectory.ageDays.toFixed(1)}d) — observed trajectory dominates forecast.`);
  } else if (trajectory && trajectory.blendWeight > 0.3) {
    score += 10;
    reasons.push(`Post is ${trajectory.ageDays.toFixed(1)}d old — observed data informing forecast.`);
  } else if (trajectory) {
    score += 5;
    reasons.push(`Post is very young — observed velocity is noisy.`);
  } else {
    reasons.push(`Pre-publish — no trajectory data yet.`);
  }

  const level: Forecast["confidence"]["level"] =
    score >= 80 ? "high" :
    score >= 55 ? "medium" :
    score >= 30 ? "low" :
                  "insufficient";

  return { level, score, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export function forecast(input: ForecastInput): Forecast {
  const { video, creatorHistory, platform, manualInputs = {}, velocitySamples } = input;
  const cfg = PLATFORM_CONFIG[platform];

  const dataUsed:      DataSource[] = [];
  const dataEstimated: DataSource[] = [];
  const dataMissing:   DataSource[] = [];
  const notes:         string[] = [];

  // ── Step 1: Build creator baseline ────────────────────────────────────
  const historyViews = creatorHistory
    .filter(v => typeof v.views === "number" && v.views > 0)
    .map(v => v.views);

  let baseline: CreatorBaseline | null = null;

  if (manualInputs.baselineMedianOverride && manualInputs.baselineMedianOverride > 0) {
    const m = manualInputs.baselineMedianOverride;
    baseline = {
      postsUsed: historyViews.length,
      median: m,
      p25: Math.round(m * 0.5),
      p75: Math.round(m * 1.8),
      max: Math.round(m * 3),
      cv: 0.7,
      source: "manual",
    };
    dataUsed.push({
      field: "baseline_median",
      label: "Creator baseline median (user override)",
      value: m,
      source: "manual",
      impact: "high",
    });
  } else if (historyViews.length >= cfg.minBaselinePosts) {
    baseline = {
      postsUsed: historyViews.length,
      median: Math.round(median(historyViews)),
      p25:    Math.round(percentile(historyViews, 25)),
      p75:    Math.round(percentile(historyViews, 75)),
      max:    Math.round(Math.max(...historyViews)),
      cv:     cv(historyViews),
      source: "computed",
    };
    dataUsed.push({
      field: "baseline_median",
      label: `Creator median from ${historyViews.length} past ${platform === "x" ? "posts" : "videos"}`,
      value: baseline.median,
      source: "api",
      impact: "high",
    });
  } else {
    baseline = {
      postsUsed: historyViews.length,
      median: 0, p25: 0, p75: 0, max: 0, cv: 0,
      source: "insufficient",
    };
    dataMissing.push({
      field: "baseline_median",
      label: "Creator historical baseline",
      source: "missing",
      impact: "high",
      note: `Need at least ${cfg.minBaselinePosts} past ${platform === "x" ? "posts" : "videos"} — have ${historyViews.length}.`,
      userCanProvide: true,
    });
  }

  // ── Step 2: Score multiplier ──────────────────────────────────────────
  // SINGLE canonical score source: video.vrs.estimatedFullScore
  const score = video.vrs?.estimatedFullScore ?? 50;
  dataUsed.push({
    field: "vrs_score",
    label: "Readiness score",
    value: score.toFixed(0),
    source: "derived",
    impact: "high",
  });

  const rawMult = scoreToMultiplier(score, platform);
  const adjMult = applyManualAdjustments(rawMult, platform, manualInputs);

  // ── Step 3: Record available vs missing inputs per platform ───────────
  recordDataSources(video, platform, manualInputs, dataUsed, dataEstimated, dataMissing);

  // ── Step 4: If no baseline, short-circuit ────────────────────────────
  if (!baseline || baseline.source === "insufficient") {
    return shortCircuit(video, platform, score, rawMult, dataUsed, dataEstimated, dataMissing, baseline, cfg);
  }

  // ── Step 5: Build prior (lifetime prediction) ─────────────────────────
  const prior = {
    low:    Math.round(baseline.median * adjMult.low),
    median: Math.round(baseline.median * adjMult.median),
    high:   Math.round(baseline.median * adjMult.high),
  };

  // ── Step 6: Blend with observed trajectory ───────────────────────────
  const { blended, trajectory } = blendWithTrajectory(prior, video, platform, velocitySamples);
  const lifetime = {
    low:    Math.round(blended.low),
    median: Math.round(blended.median),
    high:   Math.round(blended.high),
  };

  // ── Step 7: Project milestones from the lifetime number ──────────────
  const shareAt = (d: number) => cfg.cumulativeShare(d);
  const d1  = { low: Math.round(lifetime.low * shareAt(1)),  median: Math.round(lifetime.median * shareAt(1)),  high: Math.round(lifetime.high * shareAt(1))  };
  const d7  = { low: Math.round(lifetime.low * shareAt(7)),  median: Math.round(lifetime.median * shareAt(7)),  high: Math.round(lifetime.high * shareAt(7))  };
  const d30 = { low: Math.round(lifetime.low * shareAt(30)), median: Math.round(lifetime.median * shareAt(30)), high: Math.round(lifetime.high * shareAt(30)) };

  // Ensure milestones never predict less than current views
  if (trajectory && video.views > 0) {
    d1.low = Math.max(d1.low, video.views); d1.median = Math.max(d1.median, video.views); d1.high = Math.max(d1.high, video.views);
    d7.low = Math.max(d7.low, video.views); d7.median = Math.max(d7.median, video.views); d7.high = Math.max(d7.high, video.views);
    d30.low = Math.max(d30.low, video.views); d30.median = Math.max(d30.median, video.views); d30.high = Math.max(d30.high, video.views);
  }

  // ── Step 8: Confidence ────────────────────────────────────────────────
  const confidence = computeConfidence(baseline, platform, manualInputs, trajectory);

  // ── Step 9: Interpretation ────────────────────────────────────────────
  const interpretation = buildInterpretation(score, lifetime, baseline, trajectory, platform, confidence);

  // ── Step 10: Notes ────────────────────────────────────────────────────
  notes.push(`Baseline: ${baseline.postsUsed} past posts, median ${baseline.median.toLocaleString()}, CV ${baseline.cv.toFixed(2)}.`);
  notes.push(`Score multiplier: ${adjMult.median.toFixed(2)}× median (VRS ${score.toFixed(0)}, ${rawMult.rationale}).`);
  if (trajectory) {
    notes.push(`Trajectory blend weight: ${(trajectory.blendWeight * 100).toFixed(0)}% observed vs ${((1-trajectory.blendWeight) * 100).toFixed(0)}% prior.`);
    notes.push(`Outperformance: ${trajectory.outperformance.toFixed(2)}× vs what this creator typically does at this stage.`);
  }
  if (dataMissing.length > 0) {
    notes.push(`${dataMissing.length} high-impact input${dataMissing.length === 1 ? "" : "s"} not available — providing from creator analytics would tighten the forecast.`);
  }

  return {
    lifetime, d1, d7, d30,
    horizonDays: cfg.horizonDays,
    scoreMultiplier: { score, ...rawMult },
    baseline, confidence, trajectory,
    dataUsed, dataEstimated, dataMissing,
    interpretation, notes,
  };
}

// ── Short-circuit for insufficient history ─────────────────────────────────

function shortCircuit(
  _video: EnrichedVideo, platform: Platform, score: number,
  rawMult: { low: number; median: number; high: number; rationale: string },
  dataUsed: DataSource[], dataEstimated: DataSource[], dataMissing: DataSource[],
  baseline: CreatorBaseline | null,
  cfg: typeof PLATFORM_CONFIG[Platform],
): Forecast {
  const zero = { low: 0, median: 0, high: 0 };
  return {
    lifetime: zero, d1: zero, d7: zero, d30: zero,
    horizonDays: cfg.horizonDays,
    scoreMultiplier: { score, ...rawMult },
    baseline,
    confidence: {
      level: "insufficient",
      score: 0,
      reasons: [`Need at least ${cfg.minBaselinePosts} past posts — have ${baseline?.postsUsed ?? 0}.`],
    },
    trajectory: null,
    dataUsed, dataEstimated, dataMissing,
    interpretation: `Cannot forecast: insufficient creator history. Need at least ${cfg.minBaselinePosts} past ${platform === "x" ? "posts" : "videos"} from this creator to build a reliable baseline.`,
    notes: [
      "Upload more posts from this creator, or provide a manual baseline median.",
      "Without a baseline, even the best VRS score has nothing to anchor the prediction to.",
    ],
  };
}

// ── Data source recording ──────────────────────────────────────────────────

function recordDataSources(
  video: EnrichedVideo,
  platform: Platform,
  manual: ManualInputs,
  dataUsed:      DataSource[],
  _dataEstimated: DataSource[],
  dataMissing:   DataSource[],
): void {

  // Universal fields
  dataUsed.push({ field: "views",    label: "Current view count", value: video.views,    source: "api", impact: "high" });
  dataUsed.push({ field: "likes",    label: "Likes",              value: video.likes,    source: "api", impact: "medium" });
  dataUsed.push({ field: "comments", label: "Comments/replies",   value: video.comments, source: "api", impact: "medium" });
  if (video.durationSeconds) {
    dataUsed.push({ field: "duration", label: "Duration (seconds)", value: video.durationSeconds, source: "api", impact: "low" });
  }

  // Platform-specific missing/manual
  if (platform === "tiktok") {
    if (video.shares != null) dataUsed.push({ field: "shares", label: "Shares", value: video.shares, source: "api", impact: "high" });
    if (video.saves  != null) dataUsed.push({ field: "saves",  label: "Saves (collects)", value: video.saves, source: "api", impact: "high" });

    manualOrMissing(dataUsed, dataMissing, manual, "ttCompletionPct", "Completion %", "Completion rate %",
      "TikTok Creator Studio → Analytics. #1 2026 signal (70% threshold).", "high", "%");
    manualOrMissing(dataUsed, dataMissing, manual, "ttRewatchPct", "Rewatch %", "Rewatch rate %",
      "TikTok Creator Studio. Outranks follower count in 2026.", "high", "%");
    manualOrMissing(dataUsed, dataMissing, manual, "ttFypViewPct", "FYP share %", "FYP traffic share %",
      "TikTok Creator Studio → Traffic Source.", "medium", "%");
  }

  if (platform === "instagram") {
    manualOrMissing(dataUsed, dataMissing, manual, "igSaves", "Saves", "Saves count",
      "Instagram Insights (creator's own account only). Not exposed via public API.", "high");
    manualOrMissing(dataUsed, dataMissing, manual, "igSends", "DM sends", "DM sends",
      "Instagram Insights. Mosseri's #1 signal for non-follower reach (3-5× a like).", "high");
    manualOrMissing(dataUsed, dataMissing, manual, "igReach", "Reach", "Accounts reached",
      "Instagram Insights. Enables true sends-per-reach ratio.", "medium");
    manualOrMissing(dataUsed, dataMissing, manual, "igHold3s", "3-sec hold %", "3-second hold rate",
      "Instagram Insights. Audition phase gate.", "medium", "%");
  }

  if (platform === "youtube" || platform === "youtube_short") {
    manualOrMissing(dataUsed, dataMissing, manual, "ytAVDpct", "AVD %", "Average view duration %",
      "YouTube Studio → Analytics. ~50% of YouTube Long-Form ranking formula.", "high", "%");
    manualOrMissing(dataUsed, dataMissing, manual, "ytCTRpct", "CTR %", "Click-through rate %",
      "YouTube Studio. Below 2% = Browse/Suggested sunset.", "high", "%");
    manualOrMissing(dataUsed, dataMissing, manual, "ytImpressions", "Impressions", "Impressions",
      "YouTube Studio. Drives Suggested/Browse distribution.", "medium");
  }

  if (platform === "x") {
    if (video.shares != null) dataUsed.push({ field: "reposts", label: "Retweets", value: video.shares, source: "api", impact: "medium" });
    manualOrMissing(dataUsed, dataMissing, manual, "xTweepCred", "TweepCred", "TweepCred score",
      "Premium dashboard. Below 0.65 hard-throttles distribution.", "high");
    manualOrMissing(dataUsed, dataMissing, manual, "xReplyByAuthor", "Author replies", "Replies engaged by author",
      "Count of replies the author responded to. Unlocks +75 signal (150× a like).", "high");
  }
}

function manualOrMissing(
  dataUsed: DataSource[], dataMissing: DataSource[],
  manual: ManualInputs, key: keyof ManualInputs, shortLabel: string, longLabel: string,
  note: string, impact: "high" | "medium" | "low", suffix?: string,
): void {
  const v = manual[key];
  if (v != null) {
    dataUsed.push({
      field: key, label: `${shortLabel} (provided)`,
      value: suffix ? `${v}${suffix}` : v, source: "manual", impact,
    });
  } else {
    dataMissing.push({
      field: key, label: longLabel, source: "missing", impact, note, userCanProvide: true,
    });
  }
}

// ── Interpretation generator ───────────────────────────────────────────────

function buildInterpretation(
  score: number,
  lifetime: { low: number; median: number; high: number },
  baseline: CreatorBaseline,
  trajectory: TrajectoryAnalysis | null,
  platform: Platform,
  confidence: Forecast["confidence"],
): string {
  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : `${n}`;

  const horizonWord = PLATFORM_CONFIG[platform].horizonDays >= 180 ? "lifetime" : `${PLATFORM_CONFIG[platform].horizonDays}-day`;

  let primary: string;

  if (trajectory && trajectory.verdict === "major-outlier") {
    primary = `This post is a significant outlier — currently at ${fmt(trajectory.currentViews)} views, ${trajectory.outperformance.toFixed(1)}× what this creator typically produces at this stage. Lifetime projection: ${fmt(lifetime.median)} (${fmt(lifetime.low)}–${fmt(lifetime.high)}).`;
  } else if (trajectory && trajectory.verdict === "above") {
    primary = `Above baseline — ${fmt(trajectory.currentViews)} views is ${trajectory.outperformance.toFixed(1)}× expected for this stage. Projected to finish at ${fmt(lifetime.median)} (range ${fmt(lifetime.low)}–${fmt(lifetime.high)}).`;
  } else if (trajectory && trajectory.verdict === "on-track") {
    primary = `On baseline — ${fmt(trajectory.currentViews)} views is roughly in line with expectation. Projected ${horizonWord} total: ${fmt(lifetime.median)}.`;
  } else if (trajectory && trajectory.verdict === "below") {
    primary = `Below baseline — at ${fmt(trajectory.currentViews)} views, this is tracking ${(trajectory.outperformance * 100).toFixed(0)}% of what this creator typically produces. Final projection: ${fmt(lifetime.median)}.`;
  } else if (trajectory) {
    primary = `Significantly below baseline — at ${fmt(trajectory.currentViews)} views, this is only ${(trajectory.outperformance * 100).toFixed(0)}% of expectation. Final projection: ${fmt(lifetime.median)}.`;
  } else {
    primary = `Pre-publish prediction: ${fmt(lifetime.median)} views (range ${fmt(lifetime.low)}–${fmt(lifetime.high)}) over ${horizonWord}, based on score ${score.toFixed(0)} and creator median ${fmt(baseline.median)}.`;
  }

  return `${primary} Confidence: ${confidence.level}.`;
}
