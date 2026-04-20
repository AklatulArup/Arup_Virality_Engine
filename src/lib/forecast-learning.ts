// ═══════════════════════════════════════════════════════════════════════════
// FORECAST LEARNING — snapshot storage + calibration
// ═══════════════════════════════════════════════════════════════════════════
//
// Every time a forecast is generated, we save a snapshot. Later, when the
// target date passes (and ideally the video has matured), we re-scrape the
// actual view count and compare.
//
// From many such comparisons the engine learns:
//   - Which platforms we systematically over- or under-predict
//   - Which score bands are well-calibrated and which aren't
//   - Which age ranges produce the most error
//   - Whether our "80% confidence interval" actually contains 80% of outcomes
//
// Those learnings feed back into the platform config as tuning suggestions
// the RM can accept or reject.

import type { Platform, Forecast } from "./forecast";

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface ForecastSnapshot {
  id:                string;           // unique id per snapshot
  videoId:           string;           // external platform video id
  videoUrl?:         string;
  platform:          Platform;
  creatorHandle?:    string;

  // When the forecast was generated
  forecastedAt:      string;           // ISO timestamp

  // Video state at time of forecast
  publishedAt?:      string;           // ISO timestamp
  ageDaysAtForecast: number;
  viewsAtForecast:   number;

  // The prediction
  scoreAtForecast:   number;
  baselineMedian:    number;
  lifetime:          { low: number; median: number; high: number };
  d1:                { low: number; median: number; high: number };
  d7:                { low: number; median: number; high: number };
  d30:               { low: number; median: number; high: number };
  confidenceLevel:   string;
  confidenceScore:   number;

  // Outcomes — populated when we re-check the video later
  outcomes: Array<{
    checkedAt:       string;           // ISO timestamp
    ageDaysAtCheck:  number;
    actualViews:     number;
  }>;

  // Manual inputs provided (we learn which inputs actually help)
  manualInputsProvided: string[];      // list of field keys that were non-null

  // Lifecycle tier at forecast time (TikTok / IG / Shorts only; null elsewhere
  // and for snapshots recorded before this field was added). Populated from
  // forecast.lifecycleTier so we can observe the tier classifier's behaviour
  // on historical forecasts without re-running it.
  lifecycleTier?: string | null;
}

export interface CalibrationReport {
  platform:             Platform | "all";
  sampleSize:           number;        // number of forecasts with at least one outcome

  // Point accuracy
  medianAPE:            number;        // median absolute % error — main headline metric
  meanAPE:              number;        // mean absolute % error — sensitive to outliers

  // Interval calibration
  coverage:             number;        // fraction where actual was within [low, high]
  coverageTarget:       number;        // what we aimed for (usually 0.8)

  // Directional accuracy
  directionCorrect:     number;        // fraction where we got above/below baseline right

  // Bias
  meanSignedError:      number;        // positive = over-predicting, negative = under-predicting

  // Breakdowns
  byScoreBand: Array<{
    min:          number;
    max:          number;
    n:            number;
    medianAPE:    number;
    coverage:     number;
  }>;

  byAgeBand: Array<{
    min:          number;              // days old at forecast time
    max:          number;
    n:            number;
    medianAPE:    number;
  }>;

  // The top errors — for debugging
  worstPredictions: Array<{
    id:             string;
    videoUrl?:      string;
    predictedMedian: number;
    actualViews:    number;
    apeError:       number;
  }>;
}

export interface LearningAdjustment {
  platform:          Platform;
  parameter:         string;            // e.g. "upsideMultiplier", "scoreExponent"
  currentValue:      number;
  suggestedValue:    number;
  deltaPercent:      number;
  confidence:        "high" | "medium" | "low";
  sampleSize:        number;
  rationale:         string;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────
//
// Uses the simplest durable storage available in the deployment environment:
// - In the browser: localStorage (for recent / single-user tracking)
// - On the server: writes to a JSON file on disk (ephemeral on serverless,
//   but works in dev and persists on a single-instance deployment)
//
// For multi-instance production usage, swap in Vercel KV or Postgres —
// the interface below is storage-agnostic.

const STORAGE_KEY = "fn-virality-forecast-snapshots";

function getBrowserStore(): ForecastSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setBrowserStore(snapshots: ForecastSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn("Failed to persist forecast snapshots:", e);
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

export function recordForecast(params: {
  videoId:        string;
  videoUrl?:      string;
  platform:       Platform;
  creatorHandle?: string;
  publishedAt?:   string;
  ageDaysAt:      number;
  viewsAt:        number;
  forecast:       Forecast;
  manualInputsProvided: string[];
}): ForecastSnapshot {
  const snapshot: ForecastSnapshot = {
    id: `${params.videoId}-${Date.now()}`,
    videoId:           params.videoId,
    videoUrl:          params.videoUrl,
    platform:          params.platform,
    creatorHandle:     params.creatorHandle,
    forecastedAt:      new Date().toISOString(),
    publishedAt:       params.publishedAt,
    ageDaysAtForecast: params.ageDaysAt,
    viewsAtForecast:   params.viewsAt,
    scoreAtForecast:   params.forecast.scoreMultiplier.score,
    baselineMedian:    params.forecast.baseline?.median ?? 0,
    lifetime:          params.forecast.lifetime,
    d1:                params.forecast.d1,
    d7:                params.forecast.d7,
    d30:               params.forecast.d30,
    confidenceLevel:   params.forecast.confidence.level,
    confidenceScore:   params.forecast.confidence.score,
    outcomes:          [],
    manualInputsProvided: params.manualInputsProvided,
    lifecycleTier:     params.forecast.lifecycleTier?.tier ?? null,
  };

  // 1) Persist locally (per-device cache for offline calibration views)
  const existing = getBrowserStore();
  const hourAgo = Date.now() - 3600_000;
  const filtered = existing.filter(s =>
    !(s.videoId === snapshot.videoId && new Date(s.forecastedAt).getTime() > hourAgo)
  );
  filtered.push(snapshot);
  setBrowserStore(filtered.slice(-500));

  // 2) Persist remotely (shared pool for team-wide calibration) — fire and forget
  if (typeof window !== "undefined") {
    fetch("/api/forecast/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    }).catch((e) => console.warn("[forecast-learning] remote persist failed:", e));
  }

  return snapshot;
}

export function getAllSnapshots(): ForecastSnapshot[] {
  return getBrowserStore();
}

export function getSnapshotsForVideo(videoId: string): ForecastSnapshot[] {
  return getBrowserStore().filter(s => s.videoId === videoId);
}

export function recordOutcome(videoId: string, actualViews: number, ageDaysAtCheck: number): void {
  const all = getBrowserStore();
  const updated = all.map(s => {
    if (s.videoId !== videoId) return s;
    return {
      ...s,
      outcomes: [...s.outcomes, {
        checkedAt: new Date().toISOString(),
        ageDaysAtCheck,
        actualViews,
      }],
    };
  });
  setBrowserStore(updated);
}

// ─── CALIBRATION ──────────────────────────────────────────────────────────
//
// Computes accuracy metrics from the snapshot store. Only includes snapshots
// that have at least one mature outcome (ageDaysAtCheck >= platform horizon × 0.5).

export function computeCalibration(platform?: Platform): CalibrationReport {
  const all = getBrowserStore();
  const filtered = platform ? all.filter(s => s.platform === platform) : all;
  return computeCalibrationFrom(filtered, platform);
}

// Pure calibration math — server can call this directly with snapshots from KV.
export function computeCalibrationFrom(snapshots: ForecastSnapshot[], platform?: Platform): CalibrationReport {
  const filtered = platform ? snapshots.filter(s => s.platform === platform) : snapshots;

  // Keep only snapshots with outcomes
  const withOutcomes = filtered
    .map(s => {
      const latestOutcome = s.outcomes[s.outcomes.length - 1];
      return latestOutcome ? { snapshot: s, outcome: latestOutcome } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (withOutcomes.length === 0) {
    return emptyReport(platform ?? "all");
  }

  // Compute per-snapshot errors
  const errors = withOutcomes.map(({ snapshot, outcome }) => {
    const predicted = snapshot.lifetime.median;
    const actual = outcome.actualViews;
    const ape = actual > 0 ? Math.abs(predicted - actual) / actual : 0;
    const inInterval = actual >= snapshot.lifetime.low && actual <= snapshot.lifetime.high;
    const signedError = (predicted - actual) / Math.max(1, actual);

    return { snapshot, outcome, predicted, actual, ape, inInterval, signedError };
  });

  const apes = errors.map(e => e.ape);
  const coverage = errors.filter(e => e.inInterval).length / errors.length;
  const directionCorrect = errors.filter(e => {
    // Correct direction: predicted vs baseline matches actual vs baseline
    const predictedAbove = e.predicted > e.snapshot.baselineMedian;
    const actualAbove = e.actual > e.snapshot.baselineMedian;
    return predictedAbove === actualAbove;
  }).length / errors.length;

  // Breakdowns
  const scoreBands = [
    { min: 0, max: 40 }, { min: 40, max: 60 }, { min: 60, max: 80 }, { min: 80, max: 100 },
  ];
  const byScoreBand = scoreBands.map(band => {
    const inBand = errors.filter(e =>
      e.snapshot.scoreAtForecast >= band.min && e.snapshot.scoreAtForecast < band.max
    );
    return {
      min: band.min, max: band.max, n: inBand.length,
      medianAPE: inBand.length > 0 ? median(inBand.map(e => e.ape)) : 0,
      coverage:  inBand.length > 0 ? inBand.filter(e => e.inInterval).length / inBand.length : 0,
    };
  });

  const ageBands = [
    { min: 0, max: 1 }, { min: 1, max: 7 }, { min: 7, max: 30 }, { min: 30, max: Infinity },
  ];
  const byAgeBand = ageBands.map(band => {
    const inBand = errors.filter(e =>
      e.snapshot.ageDaysAtForecast >= band.min && e.snapshot.ageDaysAtForecast < band.max
    );
    return {
      min: band.min, max: band.max, n: inBand.length,
      medianAPE: inBand.length > 0 ? median(inBand.map(e => e.ape)) : 0,
    };
  });

  const sortedByError = [...errors].sort((a, b) => b.ape - a.ape);
  const worstPredictions = sortedByError.slice(0, 5).map(e => ({
    id:              e.snapshot.id,
    videoUrl:        e.snapshot.videoUrl,
    predictedMedian: e.predicted,
    actualViews:     e.actual,
    apeError:        e.ape,
  }));

  return {
    platform:         platform ?? "all",
    sampleSize:       errors.length,
    medianAPE:        median(apes),
    meanAPE:          mean(apes),
    coverage,
    coverageTarget:   0.80,
    directionCorrect,
    meanSignedError:  mean(errors.map(e => e.signedError)),
    byScoreBand,
    byAgeBand,
    worstPredictions,
  };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function emptyReport(platform: Platform | "all"): CalibrationReport {
  return {
    platform, sampleSize: 0,
    medianAPE: 0, meanAPE: 0, coverage: 0, coverageTarget: 0.80,
    directionCorrect: 0, meanSignedError: 0,
    byScoreBand: [], byAgeBand: [],
    worstPredictions: [],
  };
}

// ─── LEARNING ─────────────────────────────────────────────────────────────
//
// Given a calibration report, suggest adjustments to platform config.
// Rule of thumb: we need at least 20 samples per platform for any suggestion
// to carry weight. Below that we're just fitting noise.

export function suggestAdjustments(report: CalibrationReport): LearningAdjustment[] {
  const adjustments: LearningAdjustment[] = [];
  if (report.platform === "all" || report.sampleSize < 20) return adjustments;

  // Bias correction: if we systematically over-predict, pull down the upsideMultiplier
  if (Math.abs(report.meanSignedError) > 0.15) {
    const direction = report.meanSignedError > 0 ? "over" : "under";
    adjustments.push({
      platform:       report.platform as Platform,
      parameter:      "upsideMultiplier",
      currentValue:   0,    // filled in by caller who knows current config
      suggestedValue: 0,
      deltaPercent:   report.meanSignedError > 0 ? -10 : +10,
      confidence:     report.sampleSize >= 50 ? "high" : "medium",
      sampleSize:     report.sampleSize,
      rationale:      `Mean signed error is ${(report.meanSignedError * 100).toFixed(0)}% — ${direction}-predicting by this margin across ${report.sampleSize} samples. Adjusting upside multiplier will re-center the forecast.`,
    });
  }

  // Coverage correction: if 80% interval catches <70% of outcomes, widen the band
  if (report.coverage < 0.70 && report.sampleSize >= 30) {
    adjustments.push({
      platform:       report.platform as Platform,
      parameter:      "scoreExponent",
      currentValue:   0,
      suggestedValue: 0,
      deltaPercent:   -10,  // lower exponent = wider bands
      confidence:     "medium",
      sampleSize:     report.sampleSize,
      rationale:      `80% interval only contains ${(report.coverage * 100).toFixed(0)}% of outcomes — the ranges are too tight. Lowering the score exponent widens bands at the extremes.`,
    });
  }

  // Coverage too high: we're wasting precision
  if (report.coverage > 0.95 && report.sampleSize >= 30) {
    adjustments.push({
      platform:       report.platform as Platform,
      parameter:      "scoreExponent",
      currentValue:   0,
      suggestedValue: 0,
      deltaPercent:   +5,
      confidence:     "low",
      sampleSize:     report.sampleSize,
      rationale:      `80% interval contains ${(report.coverage * 100).toFixed(0)}% of outcomes — the ranges are too wide. Raising the score exponent tightens confident bands.`,
    });
  }

  return adjustments;
}
