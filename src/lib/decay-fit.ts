// ═══════════════════════════════════════════════════════════════════════════
// LEARNED DECAY CURVES — empirical cumulative-share fitting
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the hand-tuned per-platform `cumulativeShare` knot points in
// forecast.ts with curves MEASURED from real videos, when enough have matured.
//
// WHY
// ---
// `forecast()` projects a lifetime total from current views by assuming a fixed
// fraction of lifetime views has landed by day N (the cumulative-share curve).
// Those knots were hand-tuned guesses. If a creator's real TikToks actually
// reach 75% of lifetime views by day 3 (not the assumed 60%), every early-life
// projection is biased. This module learns the real curve from the velocity
// tracker + matured outcomes.
//
// This is NOT a black-box model — it's an empirical measured curve, exactly
// like conformal intervals are empirical measured quantiles. We report the
// fitted share at each knot and how many videos it came from.
//
// METHOD
// ------
// For every video that has BOTH (a) a mature final view count (from the
// collect-outcomes cron) AND (b) intermediate velocity samples (from the
// hourly track-velocity cron):
//   observation = { ageDays, shareOfFinal = views_at_age / final_views }
// Then per platform, at each standard knot day, take the MEDIAN observed share
// across all videos in a tolerance window. Enforce monotonic non-decreasing
// knots (cumulative share can't fall) and pin the final knot to 1.0.
//
// FALLBACK
// --------
// A platform's fitted curve is only used when ≥ MIN_DECAY_VIDEOS distinct
// videos contributed. Otherwise forecast.ts keeps its hand-tuned lerpShare
// knots. Zero regression — same discipline as conformal.ts.
//
// WHEN WE RECOMPUTE
// -----------------
// At the end of /api/cron/collect-outcomes, right after the conformal recompute.

import type { Platform } from "./forecast";
import type { ForecastSnapshot } from "./forecast-learning";
import { kvGet, kvSet, kvListRange } from "./kv";

export const DECAY_KV_KEY = "config:decay-curves";

// Minimum distinct videos contributing before a platform's curve is trusted.
export const MIN_DECAY_VIDEOS = 15;

// Standard knot days per platform — mirror the hand-tuned lerpShare knots in
// forecast.ts so a fitted curve is a drop-in replacement. (Day 0 and the final
// horizon knot are pinned, so they're omitted here.)
const KNOT_DAYS: Record<Platform, number[]> = {
  youtube:       [2, 7, 30, 90, 180],
  youtube_short: [1, 7, 30],
  tiktok:        [1, 3, 7, 14],
  instagram:     [1, 3, 7, 14],
  x:             [0.25, 0.5, 1, 2],
};

// Horizon (final knot, share pinned to 1.0) per platform — matches forecast.ts.
const HORIZON_DAY: Record<Platform, number> = {
  youtube: 365, youtube_short: 90, tiktok: 30, instagram: 35, x: 3,
};

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface DecayObservation {
  platform:     Platform;
  videoId:      string;
  ageDays:      number;
  shareOfFinal: number;   // views_at_age / final_views, clamped (0, 1]
}

export interface DecayKnot {
  day:   number;
  share: number;   // 0-1
  n:     number;   // observations contributing to this knot
}

export interface DecayPlatformCurve {
  knots:      DecayKnot[];   // ascending by day; includes pinned [0,~0] and [horizon,1]
  videoCount: number;        // distinct videos contributing
}

export interface DecayTable {
  computedAt:  string;
  byPlatform:  Partial<Record<Platform, DecayPlatformCurve>>;
}

// ─── COMPUTE (pure) ─────────────────────────────────────────────────────────

/**
 * Aggregate per-video observations into a fitted cumulative-share table.
 * Pure — no IO, no Date.now (computedAt is supplied by the caller).
 */
export function computeDecayTable(
  observations: DecayObservation[],
  computedAt: string,
): DecayTable {
  const byPlatform: Partial<Record<Platform, DecayPlatformCurve>> = {};

  // Group observations by platform
  const groups = new Map<Platform, DecayObservation[]>();
  for (const o of observations) {
    if (!(o.shareOfFinal > 0) || !Number.isFinite(o.ageDays)) continue;
    const arr = groups.get(o.platform) ?? [];
    arr.push(o);
    groups.set(o.platform, arr);
  }

  for (const [platform, obs] of groups.entries()) {
    const distinctVideos = new Set(obs.map(o => o.videoId)).size;
    if (distinctVideos < MIN_DECAY_VIDEOS) continue;   // not enough data — skip, caller falls back

    const horizon = HORIZON_DAY[platform];
    const knotDays = KNOT_DAYS[platform];

    const knots: DecayKnot[] = [{ day: 0, share: 0, n: distinctVideos }];

    let prevShare = 0;
    for (const day of knotDays) {
      // tolerance window: ±25% of the knot day (min 0.1d) so nearby samples count
      const tol = Math.max(0.1, day * 0.25);
      const inWindow = obs.filter(o => Math.abs(o.ageDays - day) <= tol);
      if (inWindow.length === 0) continue;
      const shares = inWindow.map(o => Math.min(1, o.shareOfFinal));
      // Median share at this knot, kept monotonic non-decreasing.
      const med = Math.max(prevShare, median(shares));
      knots.push({ day, share: Math.min(0.999, med), n: inWindow.length });
      prevShare = med;
    }

    knots.push({ day: horizon, share: 1.0, n: distinctVideos });

    byPlatform[platform] = { knots, videoCount: distinctVideos };
  }

  return { computedAt, byPlatform };
}

// ─── APPLY (serve-time) ─────────────────────────────────────────────────────

/**
 * Fitted cumulative share at `day` for a platform, or null if no trusted curve
 * exists (caller falls back to the hand-tuned lerpShare knots in forecast.ts).
 */
export function fittedCumulativeShare(
  table:    DecayTable | null,
  platform: Platform,
  day:      number,
): number | null {
  if (!table) return null;
  const curve = table.byPlatform[platform];
  if (!curve || curve.knots.length < 3) return null;   // need more than the two pinned knots
  return lerpKnots(day, curve.knots);
}

// ─── LOAD / PERSIST ───────────────────────────────────────────────────────

export async function loadDecayTable(): Promise<DecayTable | null> {
  return kvGet<DecayTable>(DECAY_KV_KEY);
}

export async function clearDecayTable(): Promise<void> {
  await kvSet(DECAY_KV_KEY, null);
}

/**
 * Rebuild the table from every snapshot + its velocity track in KV and persist.
 * Called at the end of collect-outcomes after new outcomes land. `computedAt`
 * is passed in because Date is not available to pure callers/tests.
 */
export async function recomputeDecayTable(computedAt: string): Promise<DecayTable> {
  const ids = await kvListRange("snapshots:all", 0, -1);

  // Most-recent snapshot per video with a mature final view count.
  const finalByVideo = new Map<string, { platform: Platform; finalViews: number }>();
  for (const id of ids) {
    const snap = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
    if (!snap || !snap.publishedAt) continue;
    const latest = snap.outcomes[snap.outcomes.length - 1];
    if (!latest || !(latest.actualViews > 0)) continue;
    const existing = finalByVideo.get(snap.videoId);
    if (!existing || latest.actualViews > existing.finalViews) {
      finalByVideo.set(snap.videoId, { platform: snap.platform, finalViews: latest.actualViews });
    }
  }

  // Join each video's velocity samples against its final view count.
  const observations: DecayObservation[] = [];
  for (const [videoId, { platform, finalViews }] of finalByVideo.entries()) {
    const raw = await kvListRange(`velocity:${videoId}`, 0, -1);
    for (const s of raw) {
      try {
        const sample = JSON.parse(s) as { ageHours?: number; views?: number };
        if (typeof sample.ageHours !== "number" || typeof sample.views !== "number") continue;
        if (!(sample.views > 0)) continue;
        observations.push({
          platform,
          videoId,
          ageDays:      sample.ageHours / 24,
          shareOfFinal: Math.min(1, sample.views / finalViews),
        });
      } catch { /* skip malformed sample */ }
    }
  }

  const table = computeDecayTable(observations, computedAt);
  await kvSet(DECAY_KV_KEY, table);
  return table;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// Linear interpolation between fitted knots (ascending by day). Flat
// extrapolation outside the knot range. Mirrors forecast.ts::lerpShare.
function lerpKnots(d: number, knots: DecayKnot[]): number {
  if (knots.length === 0) return 0;
  if (d <= knots[0].day)                  return knots[0].share;
  if (d >= knots[knots.length - 1].day)   return knots[knots.length - 1].share;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1];
    const b = knots[i];
    if (d <= b.day) {
      const t = (d - a.day) / (b.day - a.day);
      return a.share + t * (b.share - a.share);
    }
  }
  return knots[knots.length - 1].share;
}
