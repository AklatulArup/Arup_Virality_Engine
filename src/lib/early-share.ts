// ═══════════════════════════════════════════════════════════════════════════
// EARLY-SHARE SIGNAL — per-creator build-up estimate from the sibling cross-section
// ═══════════════════════════════════════════════════════════════════════════
//
// Interim stand-in for the fitted decay curve (src/lib/decay-fit.ts) on
// YouTube / Shorts, usable from day one because it needs no matured velocity
// data — only the sibling videos the analyze flow already fetches (the
// estimator-only list of up to 50 uploads; the forecast baseline stays on
// the 12 most recent).
//
// WHY
// ---
// The hand-tuned YouTube Long-Form curve assumes evergreen accumulation
// (~28% of lifetime views by day 7). Small prop-firm / trading channels are
// the opposite: subscriber-burst distribution puts 80%+ of lifetime views in
// week one. Projecting "lifetime × 0.28" for those channels under-predicted
// day-7 actuals by 5–30× in the 2026-06-10 blind backtest.
//
// METHOD
// ------
// The sibling cross-section is a natural experiment on the channel's own
// curve: siblings aged 4–21 days are mid-build, siblings aged 21+ days are
// mostly done. Compute the observed ratio
//
//     medianViews(young bucket) / medianViews(old bucket)
//
// and compare it against what each hypothesis curve PREDICTS that ratio
// should be, given the actual sibling ages in each bucket (median curve
// share over the bucket). If the channel were evergreen, young sits well
// below old (ratio ≈ 0.5–0.7 depending on ages); if front-loaded, young has
// nearly caught old (ratio ≈ 0.9+). The observed ratio's position between
// those two self-calibrated anchors is the 0–1 weight that interpolates the
// platform-default curve toward the front-loaded one (~50% by d2, 80% by d7,
// 95% by d30). Computing the anchors from the real bucket ages — instead of
// fixed cutoffs — keeps the mapping honest for any upload cadence.
//
// FALLBACK
// --------
// Null (caller keeps the platform-default curve — zero regression, same
// discipline as decay-fit) when: the platform isn't YouTube/Shorts; either
// age bucket has < MIN_BUCKET_SAMPLES siblings of the analyzed video's
// format (only same-format siblings are counted — see the filter note in
// estimateEarlyShare); the old-bucket median is 0;
// or the two hypothesis curves predict nearly the same ratio for this
// sibling geometry (the data couldn't tell them apart). A fitted decay
// table, once it has matured videos, takes precedence over this heuristic
// in forecast.ts.

import type { Platform } from "./forecast";
import type { VideoData } from "./types";
import { isYouTubeShortDuration } from "./video-classifier";

// Sibling age buckets (days). Young = mid-build, old = mostly done. The old
// bucket starts at 21d (not later) so the signal stays readable on active
// channels — even with the estimator's 50-upload window, a daily uploader
// only reaches ~50 days back. At 21d the default YT curve sits at ~0.40 of
// lifetime vs ~0.92 for the front-loaded curve, so the separation survives.
export const YOUNG_BUCKET_MIN_DAYS = 4;
export const OLD_BUCKET_MIN_DAYS = 21;

// Minimum siblings in each bucket before the signal is trusted.
export const MIN_BUCKET_SAMPLES = 3;

// Minimum gap between the two hypothesis-predicted ratios. Below this, the
// bucket geometry can't distinguish evergreen from front-loaded — return null.
export const MIN_EXPECTED_SEPARATION = 0.10;

export interface EarlyShareSignal {
  platform: "youtube" | "youtube_short";
  frontLoadWeight: number;     // 0–1: how far to pull the default curve toward front-loaded
  ratio: number;               // observed medianViews(young) / medianViews(old)
  expectedEvergreenRatio: number;   // what the default curve predicts for these sibling ages
  expectedFrontLoadedRatio: number; // what the front-loaded curve predicts
  youngCount: number;
  oldCount: number;
  youngMedianViews: number;
  oldMedianViews: number;
  rationale: string;           // plain-English, RM-facing
}

// Front-loaded target curves — the shape the backtest's trading channels
// show (~80% of lifetime views in week one), knotted on each platform's
// horizon so the blend stays a drop-in for the defaults in forecast.ts.
const FRONT_LOADED_KNOTS: Record<"youtube" | "youtube_short", Array<readonly [number, number]>> = {
  youtube:       [[0, 0.001], [2, 0.50], [7, 0.80], [30, 0.95], [90, 0.98], [180, 0.99], [365, 1.0]],
  youtube_short: [[0, 0.001], [1, 0.32], [2, 0.50], [7, 0.80], [30, 0.95], [90, 1.0]],
};

/**
 * Cumulative share at `day` under the fully front-loaded curve, or null for
 * platforms this signal doesn't cover (caller keeps the default curve).
 */
export function frontLoadedCumulativeShare(platform: Platform, day: number): number | null {
  if (platform !== "youtube" && platform !== "youtube_short") return null;
  return lerpKnots(day, FRONT_LOADED_KNOTS[platform]);
}

/**
 * Estimate the channel's front-load weight from the sibling cross-section.
 * Pure — `nowMs` anchors sibling ages so callers control the clock (same
 * convention as decay-fit's `computedAt`), and `defaultShare` is the
 * platform's default cumulative-share curve (PLATFORM_CONFIG[platform]
 * .cumulativeShare — passed in rather than imported to keep this module
 * import-cycle-free with forecast.ts). Returns null whenever the signal
 * can't be read; the caller then keeps the default curve unchanged.
 */
export function estimateEarlyShare(
  creatorHistory: VideoData[],
  platform: Platform,
  nowMs: number,
  defaultShare: (day: number) => number,
): EarlyShareSignal | null {
  if (platform !== "youtube" && platform !== "youtube_short") return null;

  // Same-format siblings only. Shorts and long-form view counts live on
  // different scales on the same channel (routinely 5–20× apart), so a mixed
  // cross-section corrupts the young/old ratio with format mix instead of
  // curve shape — e.g. a channel ramping up Shorts puts Shorts-scale numbers
  // in the young bucket and long-form-scale numbers in the old one. No mixed
  // fallback on purpose: when the same-format buckets are thin, the
  // MIN_BUCKET_SAMPLES guard below returns null and the caller keeps the
  // default curve — a missing signal beats a corrupted one.
  const wantShort = platform === "youtube_short";
  const aged = creatorHistory
    .filter(v => isYouTubeShortDuration(v.durationSeconds) === wantShort)
    .filter(v => v.publishedAt && typeof v.views === "number" && v.views >= 0)
    .map(v => ({ ageDays: (nowMs - new Date(v.publishedAt).getTime()) / 86_400_000, views: v.views }))
    .filter(x => Number.isFinite(x.ageDays) && x.ageDays > 0);

  const young = aged.filter(x => x.ageDays >= YOUNG_BUCKET_MIN_DAYS && x.ageDays < OLD_BUCKET_MIN_DAYS);
  const old   = aged.filter(x => x.ageDays >= OLD_BUCKET_MIN_DAYS);

  if (young.length < MIN_BUCKET_SAMPLES || old.length < MIN_BUCKET_SAMPLES) return null;

  const youngMedianViews = median(young.map(x => x.views));
  const oldMedianViews = median(old.map(x => x.views));
  if (!(oldMedianViews > 0)) return null;
  const ratio = youngMedianViews / oldMedianViews;

  // Self-calibrated anchors: the ratio each hypothesis curve predicts for
  // the ACTUAL ages in the two buckets (median share over each bucket).
  const frontShare = (d: number) => frontLoadedCumulativeShare(platform, d) ?? defaultShare(d);
  const expectedEvergreenRatio =
    median(young.map(x => defaultShare(x.ageDays))) / Math.max(0.01, median(old.map(x => defaultShare(x.ageDays))));
  const expectedFrontLoadedRatio =
    median(young.map(x => frontShare(x.ageDays))) / Math.max(0.01, median(old.map(x => frontShare(x.ageDays))));

  const separation = expectedFrontLoadedRatio - expectedEvergreenRatio;
  if (separation < MIN_EXPECTED_SEPARATION) return null;   // geometry can't tell the curves apart

  const frontLoadWeight = clamp01((ratio - expectedEvergreenRatio) / separation);

  const pct = Math.round(Math.min(ratio, 1.5) * 100);
  const rationale =
    frontLoadWeight >= 0.99
      ? `This channel's recent uploads already sit at ~${pct}% of its older videos' views — videos here collect most of their lifetime views in the first weeks. Early-day projections lifted to match.`
      : frontLoadWeight > 0
        ? `Recent uploads sit at ~${pct}% of older videos' views — views arrive faster than the standard curve assumes. Early-day projections partially lifted.`
        : `Recent uploads sit at ~${pct}% of older videos' views — consistent with steady long-tail accumulation; the standard build-up curve fits this channel.`;

  return {
    platform,
    frontLoadWeight,
    ratio,
    expectedEvergreenRatio,
    expectedFrontLoadedRatio,
    youngCount: young.length,
    oldCount: old.length,
    youngMedianViews,
    oldMedianViews,
    rationale,
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// Linear interpolation between knot points (ascending by day), flat outside
// the range. Mirrors forecast.ts::lerpShare — same precedent as decay-fit's
// lerpKnots.
function lerpKnots(d: number, knots: Array<readonly [number, number]>): number {
  if (knots.length === 0) return 0;
  if (d <= knots[0][0])               return knots[0][1];
  if (d >= knots[knots.length - 1][0]) return knots[knots.length - 1][1];
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1];
    const [x1, y1] = knots[i];
    if (d <= x1) {
      const t = (d - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return knots[knots.length - 1][1];
}
