// ═══════════════════════════════════════════════════════════════════════════
// ACCURACY REPORT
// ═══════════════════════════════════════════════════════════════════════════
//
// The plain-English, per-platform accuracy snapshot behind the /accuracy page.
// Distinct from the Trust Center (which grades our LIVE forecasts as they
// mature). This is the BACKTEST view: we take real videos from the evidence
// library, hide each one's result, predict it blind from day 0, then compare —
// so we can show how good the engine is, and how much the latest calibration
// helped, BEFORE live grades exist.
//
// Populated by the calibration scripts (bootstrap-prior-correction writes the
// typical-miss before/after; bootstrap-conformal writes the range hit rate),
// each merging its slice per platform. Read-only at serve time via
// /api/forecast/accuracy.

import type { Platform } from "./forecast";
import { kvGet, kvSet } from "./kv";

export const ACCURACY_REPORT_KV_KEY = "config:accuracy-report";

export interface PlatformAccuracy {
  sampleSize?:        number;   // backtested videos for this platform
  // "Typical miss" = median absolute % error of the middle guess (MdAPE),
  // measured on channels the calibration never saw (split-half holdout).
  typicalMissBefore?: number;   // 0-1, before the day-0 prior correction
  typicalMissAfter?:  number;   // 0-1, after
  correctionShipped?: boolean;  // did the day-0 correction ship for this platform
  // "Range hit rate" = how often the real number lands inside the low–high
  // bracket, again on held-out channels. Target 0.80.
  rangeHitRate?:      number;   // 0-1, null/absent when bands are hand-tuned
  rangeTarget?:       number;
  rangeShipped?:      boolean;  // empirical bands active (vs hand-tuned fallback)
}

export interface AccuracyReport {
  computedAt: string;
  source:     "backtest-pool";
  byPlatform: Partial<Record<Platform, PlatformAccuracy>>;
}

export async function loadAccuracyReport(): Promise<AccuracyReport | null> {
  return kvGet<AccuracyReport>(ACCURACY_REPORT_KV_KEY);
}

/**
 * Merge a partial per-platform slice into the stored report (each calibration
 * script owns different fields, so we deep-merge rather than overwrite) and
 * persist. Used by the bootstrap scripts under --apply.
 */
export async function mergeAccuracyReport(
  partial: Partial<Record<Platform, PlatformAccuracy>>,
  nowIso: string,
): Promise<AccuracyReport> {
  const existing = (await loadAccuracyReport()) ?? { computedAt: nowIso, source: "backtest-pool" as const, byPlatform: {} };
  const byPlatform = { ...existing.byPlatform };
  for (const [p, slice] of Object.entries(partial) as Array<[Platform, PlatformAccuracy]>) {
    byPlatform[p] = { ...(byPlatform[p] ?? {}), ...slice };
  }
  const report: AccuracyReport = { computedAt: nowIso, source: "backtest-pool", byPlatform };
  await kvSet(ACCURACY_REPORT_KV_KEY, report);
  return report;
}
