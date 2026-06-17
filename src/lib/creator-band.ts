// ═══════════════════════════════════════════════════════════════════════════
// PER-CREATOR RANGE BAND
// ═══════════════════════════════════════════════════════════════════════════
//
// The platform-pooled conformal band is dragged wide by cross-creator variance
// (TikTok pooled spans ×41 low→high). A steady creator's OWN videos cluster far
// tighter, so a band built from this creator's own view distribution is both
// narrower AND honest — it's literally their observed spread.
//
// Scope (deliberate, validated by leave-one-out on the pool, holding ~80%
// holdout coverage):
//   • TikTok    — pooled ×41 → per-creator ~×10   (big win)
//   • Instagram — pooled ×10 → per-creator ~×5    (good win)
//   NOT YouTube long-form (only ×18→×12, and its day-0 band barely matters on a
//   90-day platform) and NOT Shorts (per-creator is WIDER there — Shorts
//   creators are individually too volatile, ×22→×36).
//
// Pure compute from creatorHistory — no storage, no staleness. The forecast
// applies it ONLY when it is tighter than the band already in hand, so it can
// never widen a range and never reduces coverage below the existing band's.

import type { Platform } from "./forecast";
import type { VideoData } from "./types";

// Creators need at least this many of their own videos for their personal
// distribution to mean anything. Matches the pool-analysis threshold.
export const MIN_CREATOR_BAND_VIDEOS = 8;

// Per-platform quantile pair that held ~80% leave-one-out coverage on the pool
// (TikTok ~0.075/0.925 ≈ 80%; Instagram 0.05/0.95 ≈ 79%). Platforms absent here
// do not get a per-creator band.
const PLATFORM_QUANTILES: Partial<Record<Platform, [number, number]>> = {
  tiktok:    [0.075, 0.925],
  instagram: [0.05, 0.95],
};

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const i = p * (sorted.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] * (1 - (i - lo)) + sorted[hi] * (i - lo);
}

export interface CreatorBand {
  lowMult:  number;   // low  = forecast median × lowMult
  highMult: number;   // high = forecast median × highMult
  n:        number;
}

/**
 * A band from the creator's own view distribution, as multiples of their
 * median (which the forecast median tracks). Null when the platform isn't in
 * scope or the creator has too few videos — caller then keeps its existing band.
 */
export function computeCreatorBand(creatorHistory: VideoData[], platform: Platform): CreatorBand | null {
  const pair = PLATFORM_QUANTILES[platform];
  if (!pair) return null;
  const views = creatorHistory.map((v) => v.views).filter((v) => v > 0);
  if (views.length < MIN_CREATOR_BAND_VIDEOS) return null;
  const sorted = [...views].sort((a, b) => a - b);
  const med = quantile(sorted, 0.5);
  if (med <= 0) return null;
  const ratios = sorted.map((v) => v / med).sort((a, b) => a - b);
  const lowMult = quantile(ratios, pair[0]);
  const highMult = quantile(ratios, pair[1]);
  if (!(lowMult > 0) || !(highMult > lowMult)) return null;
  return { lowMult, highMult, n: views.length };
}
