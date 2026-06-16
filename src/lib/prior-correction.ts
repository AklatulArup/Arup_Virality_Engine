// ═══════════════════════════════════════════════════════════════════════════
// DAY-0 PRIOR CORRECTION
// ═══════════════════════════════════════════════════════════════════════════
//
// The blind day-0 forecast systematically UNDER-predicts: zeroing engagement
// triggers the cold-start score penalty, the score multiplier drops below 1,
// and the prior lands well below the creator's true median. Measured on the
// pool's mature videos, actual / predicted ran ×3.5–5.4 by platform — i.e. the
// engine was telling RMs "this'll do a third of the creator's normal" at day 0,
// which is an artifact, not a forecast.
//
// This applies a per-platform multiplicative correction to the PRIOR (the
// pre-blend lifetime anchor). It is naturally self-gating: the trajectory blend
// weights the prior down as real views arrive, so the correction fully applies
// pre-publish / day-0 and washes out once observed data dominates. It also
// raises the evidence-override guard's threshold (prior.high), so that guard
// stops over-firing on ultra-early pace noise.
//
// source "pool-bootstrap" = fit on blind leave-one-out forecasts over the
// evidence pool (scripts/bootstrap-prior-correction.ts), split-half validated
// by channel before shipping. "outcomes" = refit from real graded forecasts by
// the nightly cron, which overwrites the bootstrap as grades mature.

import type { Platform } from "./forecast";
import type { ForecastSnapshot } from "./forecast-learning";
import { kvGet, kvSet, kvListRange } from "./kv";

export const PRIOR_CORRECTION_KV_KEY = "config:prior-correction";

// Only ever correct UP (cold-start can only under-predict here), and cap so a
// thin/odd stratum can't blow up the headline number. Real outcomes recalibrate.
export const MAX_PRIOR_FACTOR = 6;
export const MIN_PRIOR_CORRECTION_N = 25;

export interface PriorCorrectionTable {
  computedAt:        string;
  source:            "pool-bootstrap" | "outcomes";
  minStratumN:       number;
  factorByPlatform:  Partial<Record<Platform, number>>;
}

/** The multiplier to apply to the prior for this platform (1.0 = no change). */
export function priorFactorFor(table: PriorCorrectionTable | null | undefined, platform: Platform): number {
  const f = table?.factorByPlatform?.[platform];
  if (typeof f !== "number" || !Number.isFinite(f)) return 1;
  return Math.min(MAX_PRIOR_FACTOR, Math.max(1, f));
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Refit the correction from REAL graded snapshots (used by the nightly cron).
 * Per platform with >= MIN_PRIOR_CORRECTION_N graded outcomes:
 *   factor = clamp( exp(median log(actual / predicted_median)), 1, MAX )
 * Platforms below the floor are omitted (caller keeps whatever was there, or
 * no correction). Mirrors the bootstrap script's math so the two are
 * interchangeable — the cron's "outcomes" table simply supersedes the
 * bootstrap once enough real grades exist.
 */
export function computePriorCorrectionFromSnapshots(snapshots: ForecastSnapshot[]): PriorCorrectionTable {
  const byPlatform = new Map<Platform, number[]>();
  for (const snap of snapshots) {
    const latest = snap.outcomes?.[snap.outcomes.length - 1];
    if (!latest || !(latest.actualViews > 0) || !(snap.lifetime?.median > 0)) continue;
    const r = Math.log(latest.actualViews / snap.lifetime.median);
    if (!Number.isFinite(r)) continue;
    byPlatform.set(snap.platform, [...(byPlatform.get(snap.platform) ?? []), r]);
  }
  const factorByPlatform: Partial<Record<Platform, number>> = {};
  for (const [platform, residuals] of byPlatform.entries()) {
    if (residuals.length < MIN_PRIOR_CORRECTION_N) continue;
    const factor = Math.min(MAX_PRIOR_FACTOR, Math.max(1, Math.exp(median(residuals))));
    // Only record a meaningful correction — within 5% of 1.0 is noise.
    if (factor > 1.05) factorByPlatform[platform] = Math.round(factor * 100) / 100;
  }
  return {
    computedAt:       new Date().toISOString(),
    source:           "outcomes",
    minStratumN:      MIN_PRIOR_CORRECTION_N,
    factorByPlatform,
  };
}

export async function loadPriorCorrection(): Promise<PriorCorrectionTable | null> {
  return kvGet<PriorCorrectionTable>(PRIOR_CORRECTION_KV_KEY);
}

/**
 * Recompute from every snapshot in KV and persist — but only overwrite the
 * stored table when this refit actually produced platform factors (so a thin
 * early outcome set doesn't wipe a validated bootstrap). Returns the table that
 * is now authoritative.
 */
export async function recomputePriorCorrection(): Promise<PriorCorrectionTable | null> {
  const ids = await kvListRange("snapshots:all", 0, -1);
  const snapshots: ForecastSnapshot[] = [];
  for (const id of ids) {
    const snap = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
    if (snap) snapshots.push(snap);
  }
  const fresh = computePriorCorrectionFromSnapshots(snapshots);
  if (Object.keys(fresh.factorByPlatform).length === 0) {
    return loadPriorCorrection(); // keep the bootstrap until real grades arrive
  }
  await kvSet(PRIOR_CORRECTION_KV_KEY, fresh);
  return fresh;
}
