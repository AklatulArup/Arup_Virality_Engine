// ═══════════════════════════════════════════════════════════════════════════
// CONFORMAL PREDICTION INTERVALS
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the hand-tuned `upsideMultiplier` / `downsideMultiplier` bands with
// empirical quantiles learned from the residual distribution of past forecasts.
//
// WHY
// ---
// The hand-tuned bands produce predictable ranges but their *coverage* is
// untested. If our "80% interval" only catches 60% of outcomes, a trader
// reading the forecast as "there's an 80% chance the view count lands in this
// range" is being lied to. Conformal prediction fixes this: the 80% interval
// is computed directly from past errors, so 80% of future outcomes land in it
// (in expectation, under the exchangeability assumption — i.e. residuals are
// stable over time).
//
// METHOD
// ------
// Split conformal on log residuals:
//   For each past snapshot with a mature outcome:
//     r = log(actual_views / predicted_median)
//   Then per stratum (platform × score band), take empirical quantiles:
//     qLow80  = quantile(r, 0.10)
//     qHigh80 = quantile(r, 0.90)
//   At serve time, given a new median prediction:
//     low  = median × exp(qLow80)
//     high = median × exp(qHigh80)
//
// Log-space is important: view counts are right-skewed by many orders of
// magnitude, and multiplicative error (30% too high vs 30% too low) is more
// natural than additive. A symmetric quantile window in log space translates
// to an asymmetric one in view space, which is exactly what heavy-tailed
// virality looks like.
//
// STRATIFICATION & FALLBACKS
// --------------------------
// Primary stratum: platform × score band (0-40 / 40-60 / 60-80 / 80-100).
// Fallback 1:      platform (all score bands pooled).
// Fallback 2:      caller returns null — forecast.ts then keeps its
//                  existing hand-tuned bands. Zero regression.
//
// Minimum n per stratum = 20. Below that we're fitting noise.
//
// WHEN WE RECOMPUTE
// -----------------
// Nightly, at the end of /api/cron/collect-outcomes once new outcomes have
// landed. Also on-demand via POST /api/forecast/conformal { action: "recompute" }.

import type { Platform } from "./forecast";
import type { ForecastSnapshot } from "./forecast-learning";
import { kvGet, kvSet, kvListRange } from "./kv";

// Where the current table lives in KV. Exported so the admin page / any
// caller can use the same canonical key.
export const CONFORMAL_KV_KEY = "config:conformal-quantiles";

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface ConformalStratum {
  n:              number;
  qLow80:         number;   // 10th percentile of log-residuals
  qHigh80:        number;   // 90th percentile
  qLow90:         number;   // 5th
  qHigh90:        number;   // 95th
  medianResidual: number;   // 50th — drift sentinel; if far from 0 the median itself is biased
}

export interface ConformalPlatformTable {
  pooled:      ConformalStratum;                    // all scores pooled
  byScoreBand: Array<ConformalScoreStratum>;        // ordered: [0-40, 40-60, 60-80, 80-100]
}

export interface ConformalScoreStratum extends ConformalStratum {
  scoreMin: number;
  scoreMax: number;
}

export interface ConformalTable {
  computedAt:   string;                             // ISO
  sampleCount:  number;                             // total snapshots used
  minStratumN:  number;                             // threshold applied (= 20)
  // "outcomes" (default) = fit on real graded forecasts; applies everywhere.
  // "pool-bootstrap" = fit on blind day-0 leave-one-out forecasts over the
  // evidence pool (scripts/bootstrap-conformal.ts) — interim calibration
  // until outcomes mature. forecast.ts only applies a bootstrap table to
  // prior-dominated forecasts (observed views haven't taken over the blend),
  // because blind-residual quantiles overstate uncertainty once real
  // trajectory evidence exists. The nightly recompute overwrites this with
  // an "outcomes" table as soon as grades land — automatic retirement.
  source?:      "outcomes" | "pool-bootstrap";
  byPlatform:   Partial<Record<Platform, ConformalPlatformTable>>;
}

// Score bands — match the ones used in forecast-learning.ts::computeCalibrationFrom
// so dashboards line up. [min, max) intervals; top band is inclusive.
const SCORE_BANDS: Array<{ min: number; max: number }> = [
  { min: 0,  max: 40  },
  { min: 40, max: 60  },
  { min: 60, max: 80  },
  { min: 80, max: 101 },   // 101 to include score=100
];

// Below this, we don't trust the stratum — quantiles of a 5-sample array are
// just the samples themselves. 20 is the same floor used by suggestAdjustments.
export const MIN_STRATUM_N = 20;

// ─── COMPUTE ──────────────────────────────────────────────────────────────

/**
 * Pure function: given a pool of snapshots with outcomes, return the
 * conformal quantile table. Empty table if no snapshots have outcomes.
 */
export function computeConformalTable(snapshots: ForecastSnapshot[]): ConformalTable {
  const now = new Date().toISOString();

  // Only snapshots with at least one recorded outcome
  const withOutcomes = snapshots
    .map(snap => {
      const latest = snap.outcomes[snap.outcomes.length - 1];
      if (!latest || !(latest.actualViews > 0)) return null;
      if (!(snap.lifetime?.median > 0)) return null;
      const residual = Math.log(latest.actualViews / snap.lifetime.median);
      if (!Number.isFinite(residual)) return null;
      return { snap, residual };
    })
    .filter((x): x is { snap: ForecastSnapshot; residual: number } => x !== null);

  const byPlatform: Partial<Record<Platform, ConformalPlatformTable>> = {};

  // Group residuals by platform
  const groups = new Map<Platform, Array<{ snap: ForecastSnapshot; residual: number }>>();
  for (const item of withOutcomes) {
    const arr = groups.get(item.snap.platform) ?? [];
    arr.push(item);
    groups.set(item.snap.platform, arr);
  }

  for (const [platform, items] of groups.entries()) {
    const pooledResiduals = items.map(i => i.residual);
    const pooled = stratumFromResiduals(pooledResiduals);

    const byScoreBand: ConformalScoreStratum[] = SCORE_BANDS.map(band => {
      const inBand = items.filter(i =>
        i.snap.scoreAtForecast >= band.min && i.snap.scoreAtForecast < band.max
      );
      const s = stratumFromResiduals(inBand.map(i => i.residual));
      return { scoreMin: band.min, scoreMax: band.max, ...s };
    });

    byPlatform[platform] = { pooled, byScoreBand };
  }

  return {
    computedAt:  now,
    sampleCount: withOutcomes.length,
    minStratumN: MIN_STRATUM_N,
    source:      "outcomes",
    byPlatform,
  };
}

function stratumFromResiduals(residuals: number[]): ConformalStratum {
  return {
    n:              residuals.length,
    qLow80:         quantile(residuals, 0.10),
    qHigh80:        quantile(residuals, 0.90),
    qLow90:         quantile(residuals, 0.05),
    qHigh90:        quantile(residuals, 0.95),
    medianResidual: quantile(residuals, 0.50),
  };
}

// Linear-interpolation quantile. Returns 0 on empty input — callers should
// check `n >= MIN_STRATUM_N` before trusting the quantile, so the zero is
// never actually used at serve time; this just keeps the shape non-null.
function quantile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ─── APPLY ────────────────────────────────────────────────────────────────

export interface ConformalBounds {
  low:          number;
  high:         number;
  stratumUsed:  "score-band" | "platform-pooled";
  n:            number;
  coverage:     0.80 | 0.90;
  medianResidualLog: number;
}

/**
 * Apply the conformal table at serve time. Given the prediction context,
 * returns calibrated low/high bounds for the given `predictedMedian`, or
 * null if no stratum has enough samples. The caller (forecast.ts) falls back
 * to its hand-tuned bands when this returns null.
 *
 * Cascade:
 *   1. Try platform × score-band stratum with n >= MIN_STRATUM_N
 *   2. Try platform-pooled stratum with n >= MIN_STRATUM_N
 *   3. Return null
 */
export function applyConformalBounds(params: {
  table:           ConformalTable | null;
  platform:        Platform;
  score:           number;
  predictedMedian: number;
  coverage?:       0.80 | 0.90;
}): ConformalBounds | null {
  const { table, platform, score, predictedMedian } = params;
  const coverage = params.coverage ?? 0.80;
  if (!table) return null;
  const platformTable = table.byPlatform[platform];
  if (!platformTable) return null;
  if (!(predictedMedian > 0)) return null;

  // Pick quantile fields for the requested coverage level
  const qLoKey  = coverage === 0.80 ? "qLow80"  : "qLow90";
  const qHiKey  = coverage === 0.80 ? "qHigh80" : "qHigh90";

  // 1. Try score-band stratum
  const band = platformTable.byScoreBand.find(b =>
    score >= b.scoreMin && score < b.scoreMax
  );
  if (band && band.n >= MIN_STRATUM_N) {
    return {
      low:  Math.round(predictedMedian * Math.exp(band[qLoKey])),
      high: Math.round(predictedMedian * Math.exp(band[qHiKey])),
      stratumUsed: "score-band",
      n: band.n,
      coverage,
      medianResidualLog: band.medianResidual,
    };
  }

  // 2. Fall back to platform pooled
  const pooled = platformTable.pooled;
  if (pooled.n >= MIN_STRATUM_N) {
    return {
      low:  Math.round(predictedMedian * Math.exp(pooled[qLoKey])),
      high: Math.round(predictedMedian * Math.exp(pooled[qHiKey])),
      stratumUsed: "platform-pooled",
      n: pooled.n,
      coverage,
      medianResidualLog: pooled.medianResidual,
    };
  }

  return null;
}

// ─── LOAD / PERSIST ───────────────────────────────────────────────────────

/** Load the current table from KV, or null if never computed. */
export async function loadConformalTable(): Promise<ConformalTable | null> {
  return kvGet<ConformalTable>(CONFORMAL_KV_KEY);
}

/**
 * Rebuild the table from every snapshot currently in KV and persist it.
 * Called by /api/forecast/conformal and at the end of the collect-outcomes
 * cron after new outcomes land.
 */
export async function recomputeConformalTable(): Promise<ConformalTable> {
  const ids = await kvListRange("snapshots:all", 0, -1);
  const snapshots: ForecastSnapshot[] = [];
  for (const id of ids) {
    const snap = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
    if (snap) snapshots.push(snap);
  }
  const table = computeConformalTable(snapshots);
  await kvSet(CONFORMAL_KV_KEY, table);
  return table;
}

/** Wipe the persisted table — forecasts fall back to hand-tuned bands. */
export async function clearConformalTable(): Promise<void> {
  await kvSet(CONFORMAL_KV_KEY, null);
}

/**
 * Describe which stratum the serve-time applier would have used (for the UI
 * transparency note). Returns null if no stratum would trigger — same cascade
 * as applyConformalBounds but without needing a predictedMedian.
 */
export function describeConformalStratum(params: {
  table:    ConformalTable | null;
  platform: Platform;
  score:    number;
}): { stratumUsed: "score-band" | "platform-pooled"; n: number; medianResidualLog: number } | null {
  const { table, platform, score } = params;
  if (!table) return null;
  const pt = table.byPlatform[platform];
  if (!pt) return null;
  const band = pt.byScoreBand.find(b => score >= b.scoreMin && score < b.scoreMax);
  if (band && band.n >= MIN_STRATUM_N) {
    return { stratumUsed: "score-band", n: band.n, medianResidualLog: band.medianResidual };
  }
  if (pt.pooled.n >= MIN_STRATUM_N) {
    return { stratumUsed: "platform-pooled", n: pt.pooled.n, medianResidualLog: pt.pooled.medianResidual };
  }
  return null;
}
