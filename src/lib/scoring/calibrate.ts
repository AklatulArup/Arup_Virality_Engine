// ═══════════════════════════════════════════════════════════════════════════
// CALIBRATE — algorithm-math.md §4: score → CALIBRATED probability
// ═══════════════════════════════════════════════════════════════════════════
//
// Protocol (verbatim from the skill):
//   1. Dataset: every scored post with ≥30 days of life.
//   2. Label: viral ⟺ views > 10× channel median (multiple configurable).
//   3. Fit logistic regression of label on component z-scores.
//   4. Brier = mean((p − outcome)²), target ≤ 0.18; decile reliability.
//   5. Backtest before adoption: candidate must beat the frozen weights on
//      the held-out next-50 posts, else the frozen weights stay.
// "Without steps 4–5, weights are opinions."
//
// Pure module — no IO. The /api/calibration/run route assembles records from
// persisted contracts × matured outcomes and stores adopted records + history
// in KV (weight provenance).

import { brier } from "./math";
import type { CalibrationRecord } from "./score";

export interface CalibrationInputRecord {
  contentId: string;
  scoredAt: string;
  components: Record<string, number>;
  /** Probability the system reported at scoring time (prior or previously calibrated). */
  priorProb: number;
  label: 0 | 1;
}

export interface DecileRow {
  decile: number; // 1..10
  n: number;
  meanPredicted: number;
  hitRate: number;
}

export interface CalibrationReportOut {
  sampleSize: number;
  positives: number;
  brierCandidate: number;
  brierFrozen: number;
  adopted: boolean;
  holdoutSize: number;
  deciles: DecileRow[];
  beta: { intercept: number; components: Record<string, number> };
  baselines: Record<string, { mu: number; sigma: number }>;
  notes: string[];
}

export const BRIER_TARGET = 0.18;
export const BACKTEST_HOLDOUT = 50;
export const MIN_CALIBRATION_N = 30;

// ── helpers ─────────────────────────────────────────────────────────────────

function componentKeys(records: CalibrationInputRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const r of records) for (const k of Object.keys(r.components)) counts.set(k, (counts.get(k) ?? 0) + 1);
  // Keep components present in ≥30% of records — sparse ones destabilize the fit.
  const floor = Math.max(5, Math.floor(records.length * 0.3));
  return [...counts.entries()].filter(([, c]) => c >= floor).map(([k]) => k).sort();
}

function baselinesOf(records: CalibrationInputRecord[], keys: string[]): Record<string, { mu: number; sigma: number }> {
  const out: Record<string, { mu: number; sigma: number }> = {};
  for (const k of keys) {
    const vals = records.map((r) => r.components[k]).filter((v): v is number => v != null && Number.isFinite(v));
    const mu = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    const sigma = Math.sqrt(vals.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, vals.length));
    out[k] = { mu, sigma };
  }
  return out;
}

function designRow(r: CalibrationInputRecord, keys: string[], base: Record<string, { mu: number; sigma: number }>): number[] {
  // [1, z₁, z₂, …] — missing component → z = 0 (neutral at the mean).
  return [1, ...keys.map((k) => {
    const v = r.components[k];
    const b = base[k];
    if (v == null || !b || b.sigma <= 0) return 0;
    return (v - b.mu) / b.sigma;
  })];
}

/** Logistic regression via IRLS with light ridge (λ) for stability. Exported for tests. */
export function fitLogistic(X: number[][], y: number[], lambda = 1e-3, maxIter = 50): number[] {
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // Gradient + Hessian
    const grad = new Array(p).fill(0);
    const H: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < X.length; i++) {
      const xi = X[i];
      const lin = xi.reduce((s, v, j) => s + v * beta[j], 0);
      const mu = 1 / (1 + Math.exp(-lin));
      const w = Math.max(1e-6, mu * (1 - mu));
      const resid = y[i] - mu;
      for (let j = 0; j < p; j++) {
        grad[j] += xi[j] * resid;
        for (let k2 = 0; k2 <= j; k2++) H[j][k2] += w * xi[j] * xi[k2];
      }
    }
    for (let j = 0; j < p; j++) {
      grad[j] -= lambda * beta[j];
      H[j][j] += lambda;
      for (let k2 = 0; k2 < j; k2++) H[k2][j] = H[j][k2];
    }
    const step = solve(H, grad);
    if (!step || step.some((s) => !Number.isFinite(s))) break;
    let maxDelta = 0;
    for (let j = 0; j < p; j++) {
      beta[j] += step[j];
      maxDelta = Math.max(maxDelta, Math.abs(step[j]));
    }
    if (maxDelta < 1e-8) break;
    // Divergence guard
    if (beta.some((b) => !Number.isFinite(b) || Math.abs(b) > 1e4)) {
      beta = beta.map((b) => Math.max(-50, Math.min(50, Number.isFinite(b) ? b : 0)));
      break;
    }
  }
  return beta;
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function predict(beta: number[], X: number[][]): number[] {
  return X.map((xi) => 1 / (1 + Math.exp(-xi.reduce((s, v, j) => s + v * beta[j], 0))));
}

function decileTable(probs: number[], labels: number[]): DecileRow[] {
  const rows: DecileRow[] = [];
  for (let d = 1; d <= 10; d++) {
    const lo = (d - 1) / 10;
    const hi = d / 10;
    const idx = probs.map((p, i) => i).filter((i) => probs[i] >= lo && (d === 10 ? probs[i] <= hi : probs[i] < hi));
    if (idx.length === 0) {
      rows.push({ decile: d, n: 0, meanPredicted: (lo + hi) / 2, hitRate: NaN });
      continue;
    }
    rows.push({
      decile: d,
      n: idx.length,
      meanPredicted: idx.reduce((s, i) => s + probs[i], 0) / idx.length,
      hitRate: idx.reduce((s, i) => s + labels[i], 0) / idx.length,
    });
  }
  return rows;
}

// ── main entry ──────────────────────────────────────────────────────────────

/**
 * Run the §4 protocol. Chronological backtest: train on everything except the
 * most recent `holdout` records; the candidate is adopted only when its Brier
 * on the holdout beats the frozen probabilities (the priors the system
 * actually reported at scoring time).
 */
export function runCalibration(records: CalibrationInputRecord[], holdout: number = BACKTEST_HOLDOUT): CalibrationReportOut {
  const notes: string[] = [];
  const sorted = [...records].sort((a, b) => (a.scoredAt < b.scoredAt ? -1 : 1));
  const keys = componentKeys(sorted);
  if (sorted.length < MIN_CALIBRATION_N || keys.length === 0) {
    return {
      sampleSize: sorted.length,
      positives: sorted.filter((r) => r.label === 1).length,
      brierCandidate: NaN,
      brierFrozen: NaN,
      adopted: false,
      holdoutSize: 0,
      deciles: [],
      beta: { intercept: 0, components: {} },
      baselines: {},
      notes: [`Need ≥${MIN_CALIBRATION_N} matured scored posts and ≥1 dense component; have n=${sorted.length}, components=${keys.length}.`],
    };
  }

  const h = Math.min(holdout, Math.floor(sorted.length / 3));
  const train = sorted.slice(0, sorted.length - h);
  const test = sorted.slice(sorted.length - h);
  if (h < holdout) notes.push(`Holdout reduced to ${h} (dataset too small for the full ${holdout}).`);

  const baselines = baselinesOf(train, keys);
  const Xtrain = train.map((r) => designRow(r, keys, baselines));
  const ytrain = train.map((r) => r.label as number);
  const betaVec = fitLogistic(Xtrain, ytrain);

  const Xtest = test.map((r) => designRow(r, keys, baselines));
  const ytest = test.map((r) => r.label as number);
  const candProbs = predict(betaVec, Xtest);
  const frozenProbs = test.map((r) => r.priorProb);

  const brierCandidate = brier(candProbs, ytest);
  const brierFrozen = brier(frozenProbs, ytest);
  const adopted = Number.isFinite(brierCandidate) && brierCandidate < brierFrozen;

  if (!adopted) notes.push("Candidate did NOT beat the frozen weights on the backtest — frozen weights retained (§4 step 5).");
  if (Number.isFinite(brierCandidate) && brierCandidate > BRIER_TARGET) {
    notes.push(`Candidate Brier ${brierCandidate.toFixed(3)} is above the ≤${BRIER_TARGET} target — usable but keep collecting outcomes.`);
  }

  // Reliability on the full set with the candidate (diagnostic view).
  const allProbs = predict(betaVec, sorted.map((r) => designRow(r, keys, baselines)));
  const deciles = decileTable(allProbs, sorted.map((r) => r.label as number));

  const components: Record<string, number> = {};
  keys.forEach((k, i) => {
    components[k] = betaVec[i + 1];
  });

  return {
    sampleSize: sorted.length,
    positives: sorted.filter((r) => r.label === 1).length,
    brierCandidate,
    brierFrozen,
    adopted,
    holdoutSize: h,
    deciles,
    beta: { intercept: betaVec[0], components },
    baselines,
    notes,
  };
}

export function toCalibrationRecord(report: CalibrationReportOut, adoptedAt: string): CalibrationRecord {
  return {
    adoptedAt,
    beta: report.beta,
    baselines: report.baselines,
    brier: report.brierCandidate,
    sampleSize: report.sampleSize,
  };
}
