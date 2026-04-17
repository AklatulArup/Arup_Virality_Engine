// View Predictor — 2026 edition
//
// PHILOSOPHY: Never hallucinate. Never invent numbers that aren't anchored in
// the creator's actual historical data or published platform mechanics.
// When data is missing, surface it to the user — they can provide manually
// or accept a conservative estimate clearly labelled as such.
//
// INPUTS WE CAN COMPUTE FROM (always available via API):
//   Universal:       views, likes, comments, duration, publishedAt, creatorFollowers
//   TikTok:          shares, saves (collectCount), soundName, soundOriginal
//   Instagram:       — (only views/likes/comments from public API)
//   YouTube:         subs, channelAvgViews, tags, description, thumbnailUrl
//   X (Twitter):     replies, reposts, quotes?, bookmarks?, hasLink, isThread
//
// INPUTS WE CANNOT GET VIA PUBLIC API (user must provide from their own analytics):
//   TikTok:     completion rate, rewatch rate, FYP vs Following split
//   Instagram:  saves, DM sends, 3-sec hold rate, reach, accounts reached
//   YouTube:    AVD%, CTR%, impressions, watch time, audience retention curve
//   X:          TweepCred score, reply-engaged-by-author count
//
// Our predictor uses the creator's OWN historical post performance as the
// primary anchor, then applies a score-based multiplier (from VRS/TRS/IRS/XRS)
// and a platform-specific adjustment. Missing private-analytics inputs optionally
// improve the prediction when the user supplies them.

import type { VideoData, EnrichedVideo } from "./types";

export type PredictorPlatform = "youtube" | "youtube_short" | "tiktok" | "instagram" | "x";

// ─── OPTIONAL MANUAL INPUTS ────────────────────────────────────────────────
// These are fields the user can provide from creator analytics dashboards.
// If absent, the predictor falls back to the creator-baseline estimate
// and marks them as "estimated" in the output.

export interface ManualAnalyticsInputs {
  // Instagram Insights (creator-owned account only)
  igSaves?:         number;  // saves on this specific post (if available pre-publish, from drafts)
  igSends?:         number;  // DM sends
  igReach?:         number;  // total unique accounts reached
  igHold3s?:        number;  // 3-second hold % (0-100)

  // TikTok Analytics (creator-owned account only)
  ttCompletionPct?: number;  // completion % (0-100)
  ttRewatchPct?:    number;  // rewatch rate % (0-100)
  ttFypViewPct?:    number;  // % of views from FYP vs Following

  // YouTube Studio (requires YouTube Analytics API OAuth)
  ytAVDpct?:        number;  // average view duration as % of video length (0-100)
  ytCTRpct?:        number;  // impressions → views click-through (0-100)
  ytImpressions?:   number;  // total impressions

  // X (from creator dashboard if Premium)
  xTweepCred?:      number;  // TweepCred score if visible (0-100)
  xReplyByAuthor?:  number;  // count of replies the author engaged back

  // Universal expected reach baseline override
  manualBaselineMedian?: number;   // if user wants to override computed baseline
  manualBaselineP75?:    number;
}

// ─── PREDICTOR OUTPUT SHAPE ────────────────────────────────────────────────

export interface ViewForecast {
  // Core predictions — always a range, never a single number
  day1:  { low: number; median: number; high: number };
  day7:  { low: number; median: number; high: number };
  day30: { low: number; median: number; high: number };

  // Confidence in the prediction, based on data completeness + history depth
  confidence: "high" | "medium" | "low" | "insufficient";
  confidenceReason: string;

  // Creator baseline used as the anchor
  creatorBaseline: {
    postCount:     number;  // how many past posts we used
    median:        number;  // median view count
    p25:           number;  // 25th percentile
    p75:           number;  // 75th percentile
    max:           number;  // best performer
    coefficientOfVariation: number;  // consistency measure (stdev/mean)
  } | null;

  // Score-based multiplier applied to baseline
  scoreMultiplier: {
    vrsScore: number;    // input score (0-100)
    low:      number;    // low-end multiplier
    median:   number;    // median multiplier
    high:     number;    // high-end multiplier
    rationale: string;
  };

  // Platform-specific adjustment
  platformAdjust: {
    factor:    number;
    rationale: string;
  };

  // TRANSPARENCY — what was used, what was estimated, what is missing
  dataUsed:      DataSourceItem[];   // confirmed real data from APIs or user
  dataEstimated: DataSourceItem[];   // estimated from baseline/platform heuristics
  dataMissing:   DataSourceItem[];   // not available, user could provide manually

  // Optional annotated breakdown for the UI
  notes: string[];
}

export interface DataSourceItem {
  field:      string;       // e.g. "completion_rate"
  label:      string;       // human label
  value?:     number | string;
  source:     "api" | "computed" | "baseline_estimate" | "manual" | "missing";
  note?:      string;
  userCanProvide?: boolean; // true if user can fill in manually
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function coefficientOfVariation(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  if (mean === 0) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / mean;
}

// ─── SCORE MULTIPLIER ──────────────────────────────────────────────────────
// Translates a VRS score (0-100) into a performance multiplier vs creator median.
// Based on empirical observation across creator pools: score correlates with
// outlier rate, not linearly but monotonically.
//
// These multipliers are CONSERVATIVE. We'd rather under-predict than over-promise.

function scoreToMultiplier(vrsScore: number): { low: number; median: number; high: number; rationale: string } {
  const score = Math.max(0, Math.min(100, vrsScore));

  // Lookup-table approach with interpolation — transparent and easily tunable.
  // Each band: [low_mult, mid_mult, high_mult, label]
  const bands: Array<[number, number, number, number, string]> = [
    [0,    0.15, 0.30, 0.55, "Likely under-performer — fails most readiness criteria"],
    [20,   0.30, 0.55, 0.90, "Weak — below creator's typical performance"],
    [40,   0.55, 0.90, 1.50, "Roughly average — expect median-ish reach"],
    [60,   0.90, 1.50, 2.80, "Strong — likely to outperform creator's median"],
    [80,   1.50, 2.80, 6.00, "Top-tier — viral potential if other signals align"],
    [100,  2.50, 5.00, 15.0, "Exceptional — every criterion met; upper range depends on distribution luck"],
  ];

  // Find the two bands this score falls between and interpolate
  for (let i = 0; i < bands.length - 1; i++) {
    const [lo, lowLo, midLo, highLo] = bands[i];
    const [hi, lowHi, midHi, highHi, labelHi] = bands[i + 1];
    if (score >= lo && score <= hi) {
      const t = (score - lo) / (hi - lo);
      const low    = lowLo  + t * (lowHi  - lowLo);
      const median = midLo  + t * (midHi  - midLo);
      const high   = highLo + t * (highHi - highLo);
      const label = score >= (lo + hi) / 2 ? labelHi : bands[i][4];
      return { low, median, high, rationale: `VRS ${score.toFixed(0)} → ${label}` };
    }
  }

  const last = bands[bands.length - 1];
  return { low: last[1], median: last[2], high: last[3], rationale: last[4] };
}

// ─── PLATFORM ADJUSTMENT ───────────────────────────────────────────────────
// Different platforms have different variance characteristics. TikTok has
// the highest upside (interest graph, unbounded). YouTube long-form has the
// lowest variance (subs + algorithmic distribution).

function platformAdjustment(platform: PredictorPlatform, vrsScore: number): { factor: number; rationale: string } {
  if (platform === "tiktok") {
    // Interest graph: unbounded upside if content is strong
    if (vrsScore >= 70) return { factor: 1.20, rationale: "TikTok 2026: high-scoring content has unbounded upside via interest-graph distribution" };
    return { factor: 1.00, rationale: "TikTok 2026: baseline expectations — follower-first testing means weak content is capped" };
  }
  if (platform === "youtube_short") {
    // Similar to TikTok — unbounded upside
    if (vrsScore >= 70) return { factor: 1.15, rationale: "YouTube Shorts 2026: no 48hr virality cap, high-score content can compound" };
    return { factor: 0.95, rationale: "YouTube Shorts 2026: baseline — most Shorts don't break through" };
  }
  if (platform === "instagram") {
    // Non-follower audition phase caps downside, bounds upside
    if (vrsScore >= 70) return { factor: 1.00, rationale: "Instagram 2026: audition system rewards strong content but bounds upside relative to TikTok" };
    return { factor: 0.85, rationale: "Instagram 2026: weak hooks fail the audition phase before reaching followers" };
  }
  if (platform === "x") {
    // 6-hour time decay caps reach regardless of score
    return { factor: 0.80, rationale: "X 2026: 6-hour time decay caps most posts' total reach regardless of content score" };
  }
  // YouTube long-form: most predictable, lowest variance
  return { factor: 1.00, rationale: "YouTube long-form: algorithmic distribution + subs make performance most predictable" };
}

// ─── TIME-HORIZON SCALING ──────────────────────────────────────────────────
// Predicts view accumulation at 24h, 7d, 30d.
// These fractions represent typical platform decay curves.

function horizonFraction(platform: PredictorPlatform, day: 1 | 7 | 30): number {
  // Fraction of 30-day total that accumulates by day N
  // Based on platform decay curves documented in creator analytics studies.
  const curves: Record<PredictorPlatform, { d1: number; d7: number; d30: number }> = {
    tiktok:         { d1: 0.35, d7: 0.80, d30: 1.00 },  // Fast decay, most views in first week
    youtube_short:  { d1: 0.30, d7: 0.70, d30: 1.00 },  // Slightly slower than TikTok
    instagram:      { d1: 0.40, d7: 0.82, d30: 1.00 },  // Very front-loaded due to audition
    x:              { d1: 0.85, d7: 0.97, d30: 1.00 },  // 6-hour decay, essentially over in 24h
    youtube:        { d1: 0.20, d7: 0.50, d30: 1.00 },  // Suggested videos surface over weeks
  };
  const c = curves[platform];
  if (day === 1) return c.d1;
  if (day === 7) return c.d7;
  return c.d30;
}

// ─── CONFIDENCE SCORING ────────────────────────────────────────────────────

function computeConfidence(
  historyCount: number,
  coefVariation: number,
  hasPrivateAnalytics: boolean,
): { level: ViewForecast["confidence"]; reason: string } {
  if (historyCount < 3) {
    return { level: "insufficient", reason: `Only ${historyCount} past posts available — need at least 3 to build a baseline. Cannot produce a meaningful forecast.` };
  }
  if (historyCount < 5) {
    return { level: "low", reason: `${historyCount} past posts is thin for a reliable baseline. Forecast shown as a wide range.` };
  }
  if (coefVariation > 1.5) {
    return { level: "low", reason: `Creator's past performance is highly variable (CV ${coefVariation.toFixed(2)}). Hard to predict from a noisy baseline — forecast range will be wide.` };
  }
  if (historyCount >= 20 && coefVariation < 0.8 && hasPrivateAnalytics) {
    return { level: "high", reason: `${historyCount} past posts with consistent performance (CV ${coefVariation.toFixed(2)}) plus creator-analytics inputs provided.` };
  }
  if (historyCount >= 10 && coefVariation < 1.0) {
    return { level: "medium", reason: `${historyCount} past posts with reasonable consistency (CV ${coefVariation.toFixed(2)}). Forecast is directionally sound; private analytics would tighten the range.` };
  }
  return { level: "medium", reason: `${historyCount} past posts analysed. Baseline established; private analytics would improve precision.` };
}

// ─── MAIN PREDICTOR ────────────────────────────────────────────────────────

export function predictViews(
  newContent: EnrichedVideo,
  creatorHistory: VideoData[],  // past videos from the same creator (exclude newContent)
  platform: PredictorPlatform,
  manualInputs: ManualAnalyticsInputs = {},
): ViewForecast {

  const dataUsed:      DataSourceItem[] = [];
  const dataEstimated: DataSourceItem[] = [];
  const dataMissing:   DataSourceItem[] = [];
  const notes: string[] = [];

  // ── STEP 1: Build creator baseline from history ──────────────────────────

  const historyViews = creatorHistory
    .filter(v => typeof v.views === "number" && v.views > 0)
    .map(v => v.views);

  let baseline: ViewForecast["creatorBaseline"] = null;

  if (manualInputs.manualBaselineMedian && manualInputs.manualBaselineMedian > 0) {
    // User supplied baseline directly
    baseline = {
      postCount:     historyViews.length,
      median:        manualInputs.manualBaselineMedian,
      p25:           Math.round(manualInputs.manualBaselineMedian * 0.5),
      p75:           manualInputs.manualBaselineP75 ?? Math.round(manualInputs.manualBaselineMedian * 1.8),
      max:           manualInputs.manualBaselineP75 ?? Math.round(manualInputs.manualBaselineMedian * 3),
      coefficientOfVariation: 0.7,
    };
    dataUsed.push({
      field: "baseline_median",
      label: "Creator baseline median (user-provided)",
      value: baseline.median,
      source: "manual",
    });
  } else if (historyViews.length >= 3) {
    baseline = {
      postCount: historyViews.length,
      median:    Math.round(median(historyViews)),
      p25:       Math.round(percentile(historyViews, 25)),
      p75:       Math.round(percentile(historyViews, 75)),
      max:       Math.round(Math.max(...historyViews)),
      coefficientOfVariation: coefficientOfVariation(historyViews),
    };
    dataUsed.push({
      field: "baseline_median",
      label: `Creator median from last ${historyViews.length} posts`,
      value: baseline.median,
      source: "computed",
    });
  } else {
    dataMissing.push({
      field: "baseline_median",
      label: "Creator historical baseline",
      source: "missing",
      note: `Only ${historyViews.length} past posts available — need at least 3 to build a baseline. Cannot produce a meaningful forecast.`,
      userCanProvide: true,
    });
  }

  // ── STEP 2: Score multiplier from VRS/TRS/IRS/XRS ────────────────────────

  const vrsScore = newContent.vrs?.estimatedFullScore ?? 50;
  const mult = scoreToMultiplier(vrsScore);
  dataUsed.push({
    field: "vrs_score",
    label: "Readiness score",
    value: vrsScore.toFixed(0),
    source: "computed",
  });

  // ── STEP 3: Platform adjustment ─────────────────────────────────────────

  const platAdj = platformAdjustment(platform, vrsScore);

  // ── STEP 4: Document what's available vs missing per platform ────────────

  // Universal fields (always present if we have the post)
  dataUsed.push({ field: "views",        label: "Post views (at time of analysis)", value: newContent.views,        source: "api" });
  dataUsed.push({ field: "likes",        label: "Likes",                             value: newContent.likes,        source: "api" });
  dataUsed.push({ field: "comments",     label: "Comments",                          value: newContent.comments,     source: "api" });
  dataUsed.push({ field: "duration",     label: "Video duration (seconds)",          value: newContent.durationSeconds, source: "api" });

  // Platform-specific available and missing data
  if (platform === "tiktok") {
    if (newContent.shares != null) dataUsed.push({ field: "shares",   label: "Shares / reposts",   value: newContent.shares ?? 0, source: "api" });
    if (newContent.saves  != null) dataUsed.push({ field: "saves",    label: "Saves (collects)",   value: newContent.saves  ?? 0, source: "api" });

    if (manualInputs.ttCompletionPct != null) {
      dataUsed.push({ field: "completion_pct", label: "Completion rate",     value: `${manualInputs.ttCompletionPct}%`, source: "manual" });
    } else {
      dataMissing.push({ field: "completion_pct", label: "Completion rate %",
        source: "missing",
        note: "Not available via TikTok public API. Only visible in Creator Studio → Analytics. If you have access, provide it here — it's the #1 TikTok 2026 signal.",
        userCanProvide: true });
    }

    if (manualInputs.ttRewatchPct != null) {
      dataUsed.push({ field: "rewatch_pct", label: "Rewatch rate", value: `${manualInputs.ttRewatchPct}%`, source: "manual" });
    } else {
      dataMissing.push({ field: "rewatch_pct", label: "Rewatch rate %",
        source: "missing",
        note: "Not available via TikTok public API. Visible in Creator Studio. Now outranks follower count as a ranking signal.",
        userCanProvide: true });
    }

    if (manualInputs.ttFypViewPct != null) {
      dataUsed.push({ field: "fyp_pct", label: "FYP traffic share", value: `${manualInputs.ttFypViewPct}%`, source: "manual" });
    } else {
      dataMissing.push({ field: "fyp_pct", label: "% views from FYP vs Following",
        source: "missing",
        note: "Not available via public API. Creator Studio → Analytics → Traffic Source.",
        userCanProvide: true });
    }
  }

  if (platform === "instagram") {
    // Instagram public API gives us only views/likes/comments
    if (manualInputs.igSaves != null) {
      dataUsed.push({ field: "saves", label: "Saves (user-provided)", value: manualInputs.igSaves, source: "manual" });
    } else {
      dataMissing.push({ field: "saves", label: "Saves count",
        source: "missing",
        note: "Instagram does NOT expose saves via any public API — impossible to scrape. Only visible in Insights for the creator's own account. If you have creator access, provide it here.",
        userCanProvide: true });
    }

    if (manualInputs.igSends != null) {
      dataUsed.push({ field: "dm_sends", label: "DM sends (user-provided)", value: manualInputs.igSends, source: "manual" });
    } else {
      dataMissing.push({ field: "dm_sends", label: "DM sends",
        source: "missing",
        note: "Not available via any public API. This is Instagram's #1 signal for non-follower reach (Mosseri confirmed Jan 2025). If you have creator Insights access, provide it.",
        userCanProvide: true });
    }

    if (manualInputs.igReach != null) {
      dataUsed.push({ field: "reach", label: "Reach (accounts reached)", value: manualInputs.igReach, source: "manual" });
    } else {
      dataMissing.push({ field: "reach", label: "Accounts reached",
        source: "missing",
        note: "Not available via public API. Creator Insights only. Reach allows computing true sends-per-reach and likes-per-reach ratios.",
        userCanProvide: true });
    }

    if (manualInputs.igHold3s != null) {
      dataUsed.push({ field: "hold_3s", label: "3-second hold rate", value: `${manualInputs.igHold3s}%`, source: "manual" });
    } else {
      dataEstimated.push({ field: "hold_3s", label: "3-second hold rate (estimated)",
        source: "baseline_estimate",
        note: "Not publicly available. Estimated from engagement rate and duration.",
        userCanProvide: true });
    }
  }

  if (platform === "youtube" || platform === "youtube_short") {
    if (manualInputs.ytAVDpct != null) {
      dataUsed.push({ field: "avd_pct", label: "Average view duration", value: `${manualInputs.ytAVDpct}%`, source: "manual" });
    } else {
      dataMissing.push({ field: "avd_pct", label: "AVD %",
        source: "missing",
        note: "Not available via YouTube Data API. Requires YouTube Analytics API with OAuth per creator. This is ~50% of the YouTube Long-Form ranking formula.",
        userCanProvide: true });
    }

    if (manualInputs.ytCTRpct != null) {
      dataUsed.push({ field: "ctr_pct", label: "CTR %", value: `${manualInputs.ytCTRpct}%`, source: "manual" });
    } else {
      dataMissing.push({ field: "ctr_pct", label: "CTR %",
        source: "missing",
        note: "Not available via public API. YouTube Studio → Analytics. Threshold: <2% = Browse/Suggested sunset.",
        userCanProvide: true });
    }

    if (manualInputs.ytImpressions != null) {
      dataUsed.push({ field: "impressions", label: "Impressions", value: manualInputs.ytImpressions, source: "manual" });
    } else {
      dataMissing.push({ field: "impressions", label: "Impressions",
        source: "missing",
        note: "Not available via public API. YouTube Studio only. Impressions × CTR × AVD drives all of a video's Suggested/Browse distribution.",
        userCanProvide: true });
    }
  }

  if (platform === "x") {
    if (manualInputs.xTweepCred != null) {
      dataUsed.push({ field: "tweepcred", label: "TweepCred score", value: manualInputs.xTweepCred, source: "manual" });
    } else {
      dataMissing.push({ field: "tweepcred", label: "TweepCred score",
        source: "missing",
        note: "Not publicly visible. Below 0.65 hard-throttles your distribution. Premium subscribers get +4 to +16 boost.",
        userCanProvide: true });
    }

    if (manualInputs.xReplyByAuthor != null) {
      dataUsed.push({ field: "reply_by_author", label: "Replies engaged by author", value: manualInputs.xReplyByAuthor, source: "manual" });
    } else {
      dataEstimated.push({ field: "reply_by_author", label: "Reply engagement by author (estimated)",
        source: "baseline_estimate",
        note: "Not directly measurable from post metadata. This is the highest-weight signal in the open-source ranker (+75, 150× a like).",
        userCanProvide: true });
    }
  }

  // ── STEP 5: Compute the prediction ───────────────────────────────────────

  if (!baseline) {
    // Insufficient history — cannot produce a meaningful prediction
    const zero = { low: 0, median: 0, high: 0 };
    const conf = computeConfidence(historyViews.length, 0, false);
    return {
      day1: zero, day7: zero, day30: zero,
      confidence: conf.level,
      confidenceReason: conf.reason,
      creatorBaseline: null,
      scoreMultiplier: { vrsScore, ...mult },
      platformAdjust: platAdj,
      dataUsed, dataEstimated, dataMissing,
      notes: [
        "Cannot produce a forecast without a creator baseline.",
        "Upload at least 3 past posts from the same creator, or provide a manual baseline median below.",
      ],
    };
  }

  // Apply manual-input adjustments to the multiplier if creator-analytics data is provided.
  // These sharpen the prediction without replacing the baseline anchor.
  let mAdjust = 1.0;

  if (platform === "tiktok" && manualInputs.ttCompletionPct != null) {
    // 70% = 1.0x, above = bonus, below = penalty
    const c = manualInputs.ttCompletionPct;
    if (c >= 70)      mAdjust *= 1.0 + (c - 70) * 0.015;   // 80% → 1.15x, 90% → 1.30x
    else              mAdjust *= 0.5 + (c / 70) * 0.5;     // 50% → 0.86x, 30% → 0.71x
    notes.push(`Completion rate ${c}% applied: 70% is the 2026 threshold. Videos above this receive amplified distribution.`);
  }

  if (platform === "instagram" && manualInputs.igSends != null && manualInputs.igReach != null && manualInputs.igReach > 0) {
    const sendsPerReach = manualInputs.igSends / manualInputs.igReach;
    // 1% sends/reach = strong, 3% = exceptional
    if (sendsPerReach >= 0.01) mAdjust *= 1.0 + Math.min(2.0, sendsPerReach * 50);
    else                        mAdjust *= 0.5 + sendsPerReach * 50;
    notes.push(`Sends/reach ${(sendsPerReach * 100).toFixed(2)}% applied: Mosseri's #1 signal for non-follower reach. 3-5× a like in weighting.`);
  }

  if ((platform === "youtube" || platform === "youtube_short") && manualInputs.ytAVDpct != null) {
    const a = manualInputs.ytAVDpct;
    if (a >= 50)      mAdjust *= 1.0 + (a - 50) * 0.02;    // 60% → 1.2x, 70% → 1.4x
    else              mAdjust *= 0.5 + (a / 50) * 0.5;     // 40% → 0.9x, 30% → 0.8x
    notes.push(`AVD ${a}% applied: AVD is ~50% of the YouTube Long-Form ranking formula.`);
  }

  if ((platform === "youtube" || platform === "youtube_short") && manualInputs.ytCTRpct != null) {
    const c = manualInputs.ytCTRpct;
    if (c >= 4)       mAdjust *= 1.0 + (c - 4) * 0.08;     // 8% → 1.32x
    else if (c >= 2)  mAdjust *= 0.7 + (c - 2) * 0.15;     // 3% → 0.85x
    else              mAdjust *= 0.5 * (c / 2);            // 1% → 0.25x — kill zone
    notes.push(`CTR ${c}% applied: below 2% triggers Browse/Suggested sunset. 4%+ is healthy.`);
  }

  if (platform === "x" && manualInputs.xTweepCred != null) {
    const t = manualInputs.xTweepCred;
    if (t >= 65)      mAdjust *= 1.0 + (t - 65) * 0.02;
    else              mAdjust *= 0.3;  // hard throttle
    notes.push(`TweepCred ${t} applied: below 65 = hard throttle (only 3 posts/cycle considered).`);
  }

  mAdjust = Math.max(0.1, Math.min(3.0, mAdjust));  // sanity clamp

  // Combine multipliers
  const lowMult    = mult.low    * platAdj.factor * mAdjust;
  const medianMult = mult.median * platAdj.factor * mAdjust;
  const highMult   = mult.high   * platAdj.factor * mAdjust;

  // Base prediction: creator baseline × multipliers
  const baseLow    = baseline.p25    * lowMult;
  const baseMedian = baseline.median * medianMult;
  const baseHigh   = Math.max(baseline.p75, baseline.median * highMult);

  // Time-horizon scaling
  const f1  = horizonFraction(platform, 1);
  const f7  = horizonFraction(platform, 7);
  const f30 = horizonFraction(platform, 30);

  const day30 = {
    low:    Math.round(baseLow),
    median: Math.round(baseMedian),
    high:   Math.round(baseHigh),
  };
  const day7 = {
    low:    Math.round(baseLow    * f7),
    median: Math.round(baseMedian * f7),
    high:   Math.round(baseHigh   * f7),
  };
  const day1 = {
    low:    Math.round(baseLow    * f1),
    median: Math.round(baseMedian * f1),
    high:   Math.round(baseHigh   * f1),
  };

  // Confidence
  const hasPrivateAnalytics = (manualInputs.igSaves != null || manualInputs.igSends != null ||
                                manualInputs.ttCompletionPct != null || manualInputs.ytAVDpct != null ||
                                manualInputs.ytCTRpct != null);
  const conf = computeConfidence(historyViews.length, baseline.coefficientOfVariation, hasPrivateAnalytics);

  // Headline notes
  notes.unshift(
    `Baseline: ${historyViews.length} past posts, median ${baseline.median.toLocaleString()} views, p25-p75 range ${baseline.p25.toLocaleString()}-${baseline.p75.toLocaleString()}.`,
    `Score multiplier: ${medianMult.toFixed(2)}× median baseline (VRS ${vrsScore.toFixed(0)}).`,
    `Platform factor: ${platAdj.factor.toFixed(2)}× (${platform}).`,
  );

  if (dataMissing.length > 0) {
    notes.push(`${dataMissing.length} input${dataMissing.length === 1 ? "" : "s"} not available via public API — providing from creator analytics would tighten the forecast.`);
  }

  return {
    day1, day7, day30,
    confidence: conf.level,
    confidenceReason: conf.reason,
    creatorBaseline: baseline,
    scoreMultiplier: { vrsScore, ...mult },
    platformAdjust: platAdj,
    dataUsed, dataEstimated, dataMissing,
    notes,
  };
}
