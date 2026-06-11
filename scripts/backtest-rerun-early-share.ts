// Re-run of the 2026-06-10 blind day-0 backtest with the early-share signal.
// (run from repo root: npx tsx scripts/backtest-rerun-early-share.ts)
//
// Method mirrors the original: for each graded row, rebuild the analyze-flow
// inputs live from the YouTube API (video + channel + uploads playlist),
// keep only PRE-target siblings (12 most recent), zero the target's
// views/likes/comments, run forecast(), grade predicted views at the row's
// recorded age via cumulativeShare against the row's recorded actual.
//
// CONTROL  = engine with earlyShareSignal: null  (must reproduce the old
//            predictions — fidelity check + zero-regression proof)
// TREATMENT = engine with the sibling-estimated early-share signal
//
// Sibling ages for the estimator are anchored to the original backtest's
// createdAt so the age buckets match what the signal would have seen on
// 2026-06-10; sibling view counts are today's (≈1 day of drift — medians
// dampen it). Graded actual + age come frozen from the backtest JSON.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnvLocal(): void {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

type Platform = import("../src/lib/forecast").Platform;
type ForecastInput = import("../src/lib/forecast").ForecastInput;

interface BacktestRow {
  channel: string;
  id: string;
  title: string;
  platform: Platform;
  ageNow: number;
  baselineMedian: number;
  historyN: number;
  predLow: number;
  predMed: number;
  predHigh: number;
  actual: number;
  inside: boolean;
  missPct: number;
  confidence: string;
}

const BACKTEST_PATH = path.resolve(process.cwd(), "..", "backtest-retro-2026-06-10.json");
const OUT_PATH = path.resolve(process.cwd(), "..", "backtest-rerun-early-share-2026-06-11.json");

interface TuningState { overrides: Array<{ platform: string; parameter: string; newValue: number }> }

interface RerunRow {
  channel: string;
  id: string;
  platform: Platform;
  ageNow: number;
  historyN: number;
  signal: null | { ratio: number; frontLoadWeight: number; youngCount: number; oldCount: number };
  baselineMedianNow: number;
  lifetimePrior: number;
  predMedOld: number;       // from the original backtest JSON
  predMedControl: number;   // this harness, signal off — fidelity check
  predMedNew: number;       // this harness, signal on
  actual: number;
  missFactorOld: number;    // actual / predMedOld
  missFactorControl: number;
  missFactorNew: number;
  error?: string;
}

async function main(): Promise<void> {
// Env must be in place before the libs initialise their clients.
const { fetchVideo, fetchChannel, fetchPlaylistVideos } = await import("../src/lib/youtube");
const { forecast, composeShareAt, PLATFORM_CONFIG } = await import("../src/lib/forecast");
const { estimateEarlyShare } = await import("../src/lib/early-share");
const { enrichVideo, buildChannelContext } = await import("../src/hooks/pipeline/enrich");
const { calculateMedian } = await import("../src/lib/baseline");
const { classifyCreatorNiche, nicheAdjustment } = await import("../src/lib/niche-classifier");
const { assessCreatorReputation } = await import("../src/lib/reputation");
const { computeDayOfWeekProfile, combineSeasonality } = await import("../src/lib/seasonality");
const { kvGet } = await import("../src/lib/kv");

const backtest = JSON.parse(readFileSync(BACKTEST_PATH, "utf8")) as { createdAt: string; rows: BacktestRow[] };
const estimatorNowMs = Date.parse(backtest.createdAt);

// Tuning overrides exactly as the bundle threads them (may be empty).
const tuning = (await kvGet<TuningState>("config:tuning-overrides")) ?? { overrides: [] };
const configOverrides: Record<string, Record<string, number>> = {};
for (const o of tuning.overrides ?? []) {
  if (!configOverrides[o.platform]) configOverrides[o.platform] = {};
  configOverrides[o.platform][o.parameter] = o.newValue;
}
console.log(`Tuning overrides loaded: ${(tuning.overrides ?? []).length}`);
console.log(`Estimator age anchor: ${backtest.createdAt} (original backtest moment)\n`);

const out: RerunRow[] = [];

for (const row of backtest.rows) {
  try {
    const target = await fetchVideo(row.id);
    if (!target) throw new Error("video gone");
    const channelData = await fetchChannel(target.channelId);
    if (!channelData?.uploads) throw new Error("channel/uploads gone");
    const recent = await fetchPlaylistVideos(channelData.uploads, 50);

    const targetPubMs = new Date(target.publishedAt).getTime();
    const siblings = recent
      .filter(v => v.id !== target.id && new Date(v.publishedAt).getTime() < targetPubMs)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 12);

    const channelMedian = calculateMedian(siblings.map(v => v.views));
    const channelCtx = buildChannelContext(siblings, channelData);

    // Blind day-0: the target as the engine would have seen it before launch.
    const blind = { ...target, views: 0, likes: 0, comments: 0, channelContext: channelCtx };
    const enriched = enrichVideo(blind, channelMedian, row.platform);

    const niche = classifyCreatorNiche(siblings);
    const nicheAdj = nicheAdjustment(niche.niche);
    const reputation = assessCreatorReputation({ creatorHistory: siblings });
    const dow = computeDayOfWeekProfile(enriched, siblings);
    const seasonality = combineSeasonality({ dayOfWeek: dow, marketVolatility: null });

    const base: ForecastInput = {
      video: enriched,
      creatorHistory: siblings,
      platform: row.platform,
      manualInputs: {},
      velocitySamples: [],
      seasonalityMultiplier: seasonality.multiplier,
      seasonalityRationales: seasonality.rationales,
      nicheMultiplier: nicheAdj.multiplier,
      nicheLabel: niche.niche,
      nicheRationale: niche.rationale,
      reputationMultiplier: reputation.multiplier,
      reputationRationale: reputation.rationale,
      configOverrides,
      conformalTable: null,
      decayTable: null,
    };

    const signal = estimateEarlyShare(siblings, row.platform, estimatorNowMs, PLATFORM_CONFIG[row.platform].cumulativeShare);

    const fcControl = forecast({ ...base, earlyShareSignal: null });
    const fcNew = forecast({ ...base, earlyShareSignal: signal });

    // Day-0 prior must be curve-independent — the signal may only move the
    // share applied at grading time, never the lifetime anchor.
    if (fcControl.lifetime.median !== fcNew.lifetime.median) {
      throw new Error(`lifetime prior moved: ${fcControl.lifetime.median} → ${fcNew.lifetime.median}`);
    }

    const shareControl = composeShareAt(row.platform, null, null)(row.ageNow);
    const shareNew = composeShareAt(row.platform, null, signal)(row.ageNow);
    const predMedControl = Math.round(fcControl.lifetime.median * shareControl);
    const predMedNew = Math.round(fcNew.lifetime.median * shareNew);

    out.push({
      channel: row.channel,
      id: row.id,
      platform: row.platform,
      ageNow: row.ageNow,
      historyN: siblings.length,
      signal: signal
        ? { ratio: +signal.ratio.toFixed(2), frontLoadWeight: +signal.frontLoadWeight.toFixed(2), youngCount: signal.youngCount, oldCount: signal.oldCount }
        : null,
      baselineMedianNow: channelMedian,
      lifetimePrior: fcControl.lifetime.median,
      predMedOld: row.predMed,
      predMedControl,
      predMedNew,
      actual: row.actual,
      missFactorOld: +(row.actual / Math.max(1, row.predMed)).toFixed(2),
      missFactorControl: +(row.actual / Math.max(1, predMedControl)).toFixed(2),
      missFactorNew: +(row.actual / Math.max(1, predMedNew)).toFixed(2),
    });
  } catch (e) {
    out.push({
      channel: row.channel, id: row.id, platform: row.platform, ageNow: row.ageNow,
      historyN: 0, signal: null, baselineMedianNow: 0, lifetimePrior: 0,
      predMedOld: row.predMed, predMedControl: 0, predMedNew: 0, actual: row.actual,
      missFactorOld: +(row.actual / Math.max(1, row.predMed)).toFixed(2),
      missFactorControl: 0, missFactorNew: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

// ─── Report ────────────────────────────────────────────────────────────────

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(
  "channel".padEnd(26) + pad("plat", 5) + pad("age", 6) + pad("ratio", 7) + pad("w", 6) +
  pad("predOld", 9) + pad("predCtl", 9) + pad("predNew", 9) + pad("actual", 9) +
  pad("missOld", 9) + pad("missNew", 9),
);
for (const r of out) {
  if (r.error) {
    console.log(r.channel.padEnd(26) + `  ERROR: ${r.error}`);
    continue;
  }
  console.log(
    r.channel.slice(0, 25).padEnd(26) +
    pad(r.platform === "youtube_short" ? "YTS" : "YT", 5) +
    pad(r.ageNow.toFixed(1), 6) +
    pad(r.signal ? r.signal.ratio.toFixed(2) : "—", 7) +
    pad(r.signal ? r.signal.frontLoadWeight.toFixed(2) : "—", 6) +
    pad(r.predMedOld, 9) + pad(r.predMedControl, 9) + pad(r.predMedNew, 9) + pad(r.actual, 9) +
    pad(r.missFactorOld.toFixed(1) + "x", 9) + pad(r.missFactorNew.toFixed(1) + "x", 9),
  );
}

const ok = out.filter(r => !r.error);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};
const withSignal = ok.filter(r => r.signal && r.signal.frontLoadWeight > 0);
console.log(`\nrows: ${ok.length}/${out.length} graded · signal present+active on ${withSignal.length}`);
console.log(`median miss — original JSON: ${med(ok.map(r => r.missFactorOld)).toFixed(1)}x · control re-run: ${med(ok.map(r => r.missFactorControl)).toFixed(1)}x · with early-share: ${med(ok.map(r => r.missFactorNew)).toFixed(1)}x`);
const fidelity = ok.map(r => r.predMedControl / Math.max(1, r.predMedOld));
console.log(`control fidelity (predCtl/predOld): median ${med(fidelity).toFixed(2)} (1.00 = exact reproduction)`);

writeFileSync(OUT_PATH, JSON.stringify({ createdAt: new Date().toISOString(), method: "re-run of backtest-retro-2026-06-10 with sibling early-share signal; control = signal off", estimatorAgeAnchor: backtest.createdAt, rows: out }, null, 2));
console.log(`\nwrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
