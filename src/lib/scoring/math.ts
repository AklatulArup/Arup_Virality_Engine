// ═══════════════════════════════════════════════════════════════════════════
// MATH — algorithm-math.md §6 drop-in helpers, ported verbatim to TypeScript
// ═══════════════════════════════════════════════════════════════════════════
//
// Source of truth: the skill's references/algorithm-math.md. Acceptance
// anchors (scripts/test-scoring.ts): wilsonLb(296,420) ≈ 0.659,
// waveCeiling(500,0.8) = 2500, xTotalExposure(1000) ≈ 8656, and the §5
// worked-example chain. Do not "improve" formulas here — change the skill,
// re-sync, re-port.

import { UNIVERSAL } from "./canon";

/** §1.2 Wilson lower bound (95% default): the small-sample discount. */
export function wilsonLb(x: number, n: number, z: number = UNIVERSAL.wilsonZ): number {
  if (n === 0) return 0.0;
  const p = x / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0.0, (centre - margin) / denom);
}

/** Wilson LB when you only have a rate + n (x = p̂·n). */
export function wilsonLbFromRate(pHat: number, n: number, z: number = UNIVERSAL.wilsonZ): number {
  return wilsonLb(pHat * n, n, z);
}

/** §1.3 Bayesian shrinkage toward the creator baseline (κ default 50). */
export function shrink(x: number, n: number, baseline: number, kappa: number = UNIVERSAL.kappa): number {
  return (x + kappa * baseline) / (n + kappa);
}

/** §3 phase ceiling R∞ = N₀/(1−m̂); unbounded when m̂ ≥ 1. */
export function waveCeiling(seed: number, mHat: number): number {
  return mHat >= 1.0 ? Number.POSITIVE_INFINITY : seed / (1.0 - mHat);
}

/** §3 reach after k waves: R_k = N₀·(1−m^(k+1))/(1−m). */
export function reachAfterWaves(seed: number, m: number, k: number): number {
  if (m === 1) return seed * (k + 1);
  return (seed * (1 - Math.pow(m, k + 1))) / (1 - m);
}

/** §2.1 X creator-side weighted-sum estimator Ŝ (per impression). */
export function xScore(
  impr: number,
  counts: {
    likes?: number;
    reposts?: number;
    replies?: number;
    authorReplied?: number;
    bookmarks?: number;
    profileEng?: number;
    dwells?: number;
    video50?: number;
    mutes?: number;
    reports?: number;
  },
  w: {
    like: number;
    repost: number;
    reply: number;
    authorRepliedReply: number;
    bookmark: number;
    profileClickEng: number;
    dwell2min: number;
    video50: number;
    muteBlock: number;
    report: number;
  },
): number {
  const s =
    w.like * (counts.likes ?? 0) +
    w.repost * (counts.reposts ?? 0) +
    w.reply * (counts.replies ?? 0) +
    w.authorRepliedReply * (counts.authorReplied ?? 0) +
    w.bookmark * (counts.bookmarks ?? 0) +
    w.profileClickEng * (counts.profileEng ?? 0) +
    w.dwell2min * (counts.dwells ?? 0) +
    w.video50 * (counts.video50 ?? 0) +
    w.muteBlock * (counts.mutes ?? 0) +
    w.report * (counts.reports ?? 0);
  return s / Math.max(impr, 1);
}

/** §2.6 LinkedIn comment value (ported for math parity; LinkedIn is not an engine platform). */
export function linkedinCommentValue(words = 10, expert = false, thread = false, base = 1.0): number {
  let v = base * (words >= 15 ? 2.5 : 1.0);
  v *= expert ? 6.0 : 1.0;
  v *= thread ? 3.0 : 1.0;
  return v;
}

/** §2.7 Google citation probability chain (math parity; no Google ingestion). */
export function googleCitationP(pIndexed: number, pTop10: number, pCiteTop10: number): number {
  return pIndexed * pTop10 * pCiteTop10; // P(cite | rank>10) ≈ 0
}

/** §1.4 total exposure from first-hour rate under half-life decay (X: h=6). */
export function xTotalExposure(firstHourRate: number, halfLifeH = 6.0): number {
  return (firstHourRate * halfLifeH) / Math.log(2);
}

/** §1.4 exposure accumulated by time T (hours): v₀·h/ln2 · (1 − 2^(−T/h)). */
export function decayExposureByT(firstHourRate: number, tHours: number, halfLifeH = 6.0): number {
  return ((firstHourRate * halfLifeH) / Math.log(2)) * (1 - Math.pow(2, -tHours / halfLifeH));
}

/** §4 Brier score = mean((p − outcome)²); target ≤ 0.18. */
export function brier(probs: number[], outcomes: number[]): number {
  if (probs.length === 0 || probs.length !== outcomes.length) return NaN;
  return probs.reduce((s, p, i) => s + (p - outcomes[i]) ** 2, 0) / probs.length;
}

/** §1.5 squash σ(x) = 1/(1+e^(−k(x−m))), defaults k=10 m=0.5 from the skill. */
export function sigmoid(x: number, midpoint: number = UNIVERSAL.sigmoidM, steepness: number = UNIVERSAL.sigmoidK): number {
  return 1.0 / (1.0 + Math.exp(-steepness * (x - midpoint)));
}

/** §1.6 niche z-score. Returns null when σ is degenerate. */
export function zScore(x: number, mu: number, sigma: number): number | null {
  if (!Number.isFinite(sigma) || sigma <= 0) return null;
  return (x - mu) / sigma;
}
