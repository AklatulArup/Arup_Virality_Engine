// ═══════════════════════════════════════════════════════════════════════════
// WAVES — §3 reach forecasting from the engine's velocity snapshots
// ═══════════════════════════════════════════════════════════════════════════
//
// Convention (locked in Phase 0, derived from the skill's worked example):
//   m̂_k = Δ_k / R_{k−1}   (new viewers this wave ÷ total reach before it)
//   — reproduces §5 exactly: (1150−420)/420 = 1.74, then 1420/1150 ≈ 1.23.
//
// Engine reality: velocity snapshots store cumulative VIEWS (reach proxy;
// true reach only exists when creator analytics provide it — caveated).
// Waves are snapshot buckets spaced ≥ WAVE_MIN_GAP_H (12h) apart per §3's
// "12–24h reach snapshots".

import type { ReachSnapshot } from "./canon";
import { waveCeiling, decayExposureByT } from "./math";

export const WAVE_MIN_GAP_H = 12;

export interface WaveAnalysis {
  seed: number | null;
  waves: Array<{ ageHours: number; reach: number; mHat: number }>;
  mHats: number[];
  ceiling: number | "unbounded" | null;
  /** "Phase 4 trajectory" when m̂ ≥ 1 across the last two waves (§3 / acceptance #4). */
  phaseVerdict: string | null;
}

export function analyzeWaves(snapshots: ReachSnapshot[]): WaveAnalysis {
  const sorted = [...snapshots]
    .filter((s) => Number.isFinite(s.reach) && s.reach > 0 && Number.isFinite(s.ageHours))
    .sort((a, b) => a.ageHours - b.ageHours);

  if (sorted.length === 0) return { seed: null, waves: [], mHats: [], ceiling: null, phaseVerdict: null };

  // Bucket: seed = first snapshot; subsequent buckets ≥12h after the previous.
  const buckets: ReachSnapshot[] = [sorted[0]];
  for (const s of sorted.slice(1)) {
    if (s.ageHours - buckets[buckets.length - 1].ageHours >= WAVE_MIN_GAP_H) buckets.push(s);
  }

  const seed = buckets[0].reach;
  const waves: WaveAnalysis["waves"] = [];
  for (let i = 1; i < buckets.length; i++) {
    const prev = buckets[i - 1].reach;
    const delta = buckets[i].reach - prev;
    if (prev <= 0) continue;
    waves.push({ ageHours: buckets[i].ageHours, reach: buckets[i].reach, mHat: Math.max(0, delta / prev) });
  }
  const mHats = waves.map((w) => w.mHat);

  let ceiling: WaveAnalysis["ceiling"] = null;
  let phaseVerdict: string | null = null;
  if (mHats.length > 0) {
    const latest = mHats[mHats.length - 1];
    const c = waveCeiling(seed, latest);
    ceiling = Number.isFinite(c) ? Math.round(c) : "unbounded";
    if (mHats.length >= 2 && mHats[mHats.length - 1] >= 1 && mHats[mHats.length - 2] >= 1) {
      phaseVerdict = "Phase 4 trajectory";
    } else if (latest >= 0.95) {
      phaseVerdict = "Phase 3 trajectory";
    } else if (latest >= 0.6) {
      phaseVerdict = "Phase 2";
    } else {
      phaseVerdict = "Phase 1–2 cap";
    }
  }

  return { seed, waves, mHats, ceiling, phaseVerdict };
}

export interface Projections {
  h24: number | null;
  h72: number | null;
  d7: number | null;
  d30: number | null;
}

/**
 * Projected cumulative views at the standard horizons.
 * - X: the §1.4 decay integral on the first-hour rate (h = halfLifeHours).
 * - Wave platforms: geometric extension of the latest wave (Δ·Σm̂^i, ~24h per
 *   wave), capped at the §3 ceiling when m̂ < 1. When m̂ ≥ 1 the far horizons
 *   are undefined (no ceiling) — short horizons extend geometrically, d7/d30
 *   return null with a caveat upstream.
 * - Horizons already in the past resolve to current views (realized).
 */
export function projectViews(params: {
  isDecayPlatform: boolean;
  halfLifeHours?: number;
  currentViews: number;
  ageHours: number | null;
  snapshots: ReachSnapshot[];
  wave: WaveAnalysis;
}): Projections {
  const { isDecayPlatform, halfLifeHours = 6, currentViews, ageHours, snapshots, wave } = params;
  const horizons: Array<[keyof Projections, number]> = [
    ["h24", 24],
    ["h72", 72],
    ["d7", 168],
    ["d30", 720],
  ];
  const out: Projections = { h24: null, h72: null, d7: null, d30: null };

  if (isDecayPlatform) {
    // v₀ = impressions in the first hour — earliest snapshot ≤ 3h, scaled to 1h.
    const first = [...snapshots].sort((a, b) => a.ageHours - b.ageHours).find((s) => s.ageHours > 0 && s.ageHours <= 3);
    const v0 = first ? first.reach / Math.max(first.ageHours, 1) : null;
    for (const [key, T] of horizons) {
      if (ageHours != null && ageHours >= T) out[key] = currentViews;
      else if (v0 != null) out[key] = Math.max(currentViews, Math.round(decayExposureByT(v0, T, halfLifeHours)));
    }
    return out;
  }

  if (wave.waves.length === 0) {
    // No wave data — only realized horizons are known.
    for (const [key, T] of horizons) {
      if (ageHours != null && ageHours >= T) out[key] = currentViews;
    }
    return out;
  }

  const last = wave.waves[wave.waves.length - 1];
  const prevReach = wave.waves.length >= 2 ? wave.waves[wave.waves.length - 2].reach : wave.seed ?? last.reach;
  const lastDelta = last.reach - prevReach;
  const m = last.mHat;
  const ceiling = typeof wave.ceiling === "number" ? wave.ceiling : null;

  for (const [key, T] of horizons) {
    if (ageHours != null && ageHours >= T) {
      out[key] = currentViews;
      continue;
    }
    const wavesRemaining = Math.max(0, Math.floor((T - (ageHours ?? last.ageHours)) / 24));
    if (wavesRemaining === 0) {
      out[key] = currentViews;
      continue;
    }
    if (m >= 1) {
      // Unbounded regime: extend at most 3 waves geometrically; beyond that → null.
      if (wavesRemaining > 3) continue;
      let add = 0;
      let d = lastDelta;
      for (let i = 0; i < wavesRemaining; i++) {
        d = d * m;
        add += d;
      }
      out[key] = Math.round(currentViews + add);
    } else {
      // Geometric tail Δ·(m + m² + …), capped by the phase ceiling.
      const tail = m > 0 ? lastDelta * ((m * (1 - Math.pow(m, wavesRemaining))) / (1 - m)) : 0;
      const projected = currentViews + tail;
      out[key] = Math.round(ceiling != null ? Math.min(ceiling, projected) : projected);
    }
  }
  return out;
}
