// Bootstrap the conformal quantile table from the evidence pool.
//
// Real conformal calibration needs graded forecasts (predict → wait until the
// video matures → compare). The first grades land ~July 2026; until then the
// "8 of 10 land inside" band promise is hand-tuned and unverified. This script
// manufactures the same residual distribution today: for every MATURE pool
// video, run a BLIND leave-one-out day-0 forecast (history = the creator's
// other pool videos; the target's views/likes/comments zeroed) and measure
// r = log(actual / predicted_median). Quantiles of r per platform × score
// band — computed by the production computeConformalTable() itself — become
// the serve-time bands.
//
// Honesty rails:
//   • split-half validation by CHANNEL (fit half, measure coverage on the
//     other half) before anything is written
//   • the table is stamped source:"pool-bootstrap" — forecast.ts only applies
//     it to prior-dominated forecasts, and the nightly recompute overwrites
//     it with a real "outcomes" table as grades mature
//   • only videos past platform maturity count (views ≈ final): X 3d,
//     TikTok 30d, IG 35d, Shorts 30d, YouTube 90d
//
// Usage:  npx tsx scripts/bootstrap-conformal.ts            # validate only
//         npx tsx scripts/bootstrap-conformal.ts --apply    # validate + write KV
//         (apply needs KV_REST_API_URL / KV_REST_API_TOKEN in the env)

import { forecast, type Platform } from "../src/lib/forecast";
import { enrichVideo } from "../src/hooks/pipeline/enrich";
import { classifyCreatorNiche, nicheAdjustment } from "../src/lib/niche-classifier";
import { assessCreatorReputation } from "../src/lib/reputation";
import { calculateMedian } from "../src/lib/baseline";
import { selectBaselineSiblings } from "../src/lib/video-classifier";
import { computeConformalTable, applyConformalBounds, CONFORMAL_KV_KEY, type ConformalTable } from "../src/lib/conformal";
import { loadPriorCorrection } from "../src/lib/prior-correction";
import { kvSet } from "../src/lib/kv";
import type { VideoData, ReferenceEntry } from "../src/lib/types";
import type { ForecastSnapshot } from "../src/lib/forecast-learning";

const BASE = process.env.ENGINE_URL ?? "http://localhost:3000";
const MATURITY_DAYS: Record<Platform, number> = { x: 3, tiktok: 30, instagram: 35, youtube_short: 30, youtube: 90 };
const MIN_CHANNEL_VIDEOS = 5;
// Quantile pairs to trial, tightest first. Raw 10/90 under-covers on UNSEEN
// channels (creators aren't perfectly exchangeable — each has its own bias),
// so we widen until split-half holdout coverage reaches the 80% promise and
// store the winning pair in the table's 80%-coverage slots.
const QUANTILE_TRIALS: Array<[number, number]> = [
  [0.10, 0.90],
  [0.075, 0.925],
  [0.05, 0.95],
  [0.025, 0.975],
];
const TARGET_COVERAGE = 0.78; // accept ≥78% measured — quantizes around 80%

function entryToVideoData(e: ReferenceEntry, blind: boolean): VideoData {
  const views = blind ? 0 : (e.metrics.views ?? 0);
  const engaged = blind ? 0 : ((e.metrics.engagement ?? 0) * (e.metrics.views ?? 0)) / 100;
  return {
    id: e.id,
    title: e.name ?? "",
    channel: e.channelName,
    channelId: e.channelId,
    views,
    likes: Math.round(engaged * 0.92),
    comments: Math.round(engaged * 0.08),
    publishedAt: e.publishedAt ?? "",
    duration: e.duration ?? "",
    durationSeconds: e.durationSeconds ?? 0,
    thumbnail: "",
    tags: e.tags ?? [],
    description: e.description ?? "",
    platform: e.platform as VideoData["platform"],
  };
}

interface Sample {
  platform: Platform;
  channelId: string;
  score: number;
  predictedMedian: number;
  actual: number;
  residual: number;
}

function toSnapshot(s: Sample): ForecastSnapshot {
  return {
    platform: s.platform,
    scoreAtForecast: s.score,
    lifetime: { median: s.predictedMedian },
    outcomes: [{ actualViews: s.actual }],
  } as unknown as ForecastSnapshot;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const store = await (await fetch(`${BASE}/api/reference-store`)).json();
  const entries: ReferenceEntry[] = store.entries;
  const now = Date.now();
  // Measure residuals around the SAME prediction production serves — i.e. with
  // the day-0 prior correction applied. Otherwise the bands would be centered
  // on the uncorrected (lower) median and under-cover badly once the
  // correction shifts the median up.
  const priorCorrection = await loadPriorCorrection();
  if (priorCorrection) console.log(`prior-correction loaded: ${JSON.stringify(priorCorrection.factorByPlatform)} (${priorCorrection.source})`);

  const byChannel = new Map<string, ReferenceEntry[]>();
  for (const e of entries) {
    if (e.type !== "video" || !e.platform || typeof e.metrics.views !== "number" || e.metrics.views <= 0) continue;
    const k = `${e.platform}|${e.channelId}`;
    const arr = byChannel.get(k) ?? [];
    arr.push(e);
    byChannel.set(k, arr);
  }

  const samples: Sample[] = [];
  for (const [key, channelVids] of byChannel.entries()) {
    if (channelVids.length < MIN_CHANNEL_VIDEOS) continue;
    const platform = key.split("|")[0] as Platform;
    const maturityMs = MATURITY_DAYS[platform] * 86_400_000;

    for (const target of channelVids) {
      if (!target.publishedAt) continue;
      const age = now - new Date(target.publishedAt).getTime();
      if (!Number.isFinite(age) || age < maturityMs) continue;

      const siblings = channelVids.filter((e) => e.id !== target.id);
      if (siblings.length < MIN_CHANNEL_VIDEOS - 1) continue;
      const history = siblings.map((e) => entryToVideoData(e, false));

      // Baseline median mirrors production: format-matched for YouTube/Shorts
      // (selectBaselineSiblings), plain median elsewhere.
      let baselineVids = history;
      if (platform === "youtube" || platform === "youtube_short") {
        const recent = [...history].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        ).slice(0, 12);
        const sel = selectBaselineSiblings(platform, recent, history);
        if (sel.formatMatched) baselineVids = sel.siblings;
      }
      const median = calculateMedian(baselineVids.map((v) => v.views));
      if (median <= 0) continue;

      const blind = entryToVideoData(target, true);
      const enriched = enrichVideo(blind, median, platform);
      const video = { ...enriched, days: 0, velocity: 0, engagement: 0 };
      const niche = classifyCreatorNiche(history);
      const adj = nicheAdjustment(niche.niche);
      const rep = assessCreatorReputation({ creatorHistory: history });

      const f = forecast({
        video, creatorHistory: history, platform,
        nicheMultiplier: adj.multiplier, nicheLabel: niche.niche, nicheRationale: adj.rationale,
        reputationMultiplier: rep.multiplier, reputationRationale: rep.rationale,
        priorCorrection,
      });
      const predictedMedian = f.lifetime.median;
      const actual = target.metrics.views!;
      if (!(predictedMedian > 0) || !(actual > 0)) continue;
      const residual = Math.log(actual / predictedMedian);
      if (!Number.isFinite(residual)) continue;
      samples.push({ platform, channelId: target.channelId, score: f.scoreMultiplier.score, predictedMedian, actual, residual });
    }
  }

  console.log(`samples: ${samples.length} across ${new Set(samples.map((s) => s.platform)).size} platforms`);
  const perPlat = new Map<Platform, Sample[]>();
  for (const s of samples) perPlat.set(s.platform, [...(perPlat.get(s.platform) ?? []), s]);

  // ── Blind-median accuracy report (MdAPE + median ratio) ──
  for (const [p, ss] of perPlat.entries()) {
    const apes = ss.map((s) => Math.abs(s.actual - s.predictedMedian) / s.actual).sort((a, b) => a - b);
    const ratios = ss.map((s) => s.actual / s.predictedMedian).sort((a, b) => a - b);
    const mid = (xs: number[]) => xs[Math.floor(xs.length / 2)];
    console.log(`  ${p}: n=${ss.length} blind MdAPE=${Math.round(mid(apes) * 100)}% medianRatio=×${mid(ratios).toFixed(2)}`);
  }

  // ── Split-half validation by channel + quantile calibration ──
  // computeConformalTable hardwires 10/90 in the 80% slots; for wider trials
  // we recompute the table then overwrite the 80% slots with trial quantiles
  // over the same per-stratum residual sets.
  const quantile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
  };
  const retabulate = (base: ConformalTable, src: Sample[], pLow: number, pHigh: number): ConformalTable => {
    const t: ConformalTable = JSON.parse(JSON.stringify(base));
    for (const [plat, pt] of Object.entries(t.byPlatform)) {
      const rs = src.filter((s) => s.platform === plat);
      pt.pooled.qLow80 = quantile(rs.map((s) => s.residual), pLow);
      pt.pooled.qHigh80 = quantile(rs.map((s) => s.residual), pHigh);
      for (const band of pt.byScoreBand) {
        const inBand = rs.filter((s) => s.score >= band.scoreMin && s.score < band.scoreMax);
        band.qLow80 = quantile(inBand.map((s) => s.residual), pLow);
        band.qHigh80 = quantile(inBand.map((s) => s.residual), pHigh);
      }
    }
    return t;
  };
  const coverage = (t: ConformalTable, hold: Sample[]) => {
    const byPlat = new Map<Platform, { inside: number; total: number }>();
    for (const s of hold) {
      const b = applyConformalBounds({ table: t, platform: s.platform, score: s.score, predictedMedian: s.predictedMedian });
      if (!b) continue;
      const c = byPlat.get(s.platform) ?? { inside: 0, total: 0 };
      c.total++;
      if (s.actual >= b.low && s.actual <= b.high) c.inside++;
      byPlat.set(s.platform, c);
    }
    let inside = 0, total = 0;
    for (const c of byPlat.values()) { inside += c.inside; total += c.total; }
    return { byPlat, overall: total > 0 ? inside / total : 0, total };
  };

  const channelHash = (id: string) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 2;
  const fit = samples.filter((s) => channelHash(s.channelId) === 0);
  const hold = samples.filter((s) => channelHash(s.channelId) === 1);
  const fitBase = computeConformalTable(fit.map(toSnapshot));

  // Per-platform calibration: each platform picks the TIGHTEST quantile pair
  // whose own holdout coverage clears the target. A platform that never clears
  // (e.g. thin/heavy-tailed IG) is DROPPED — applyConformalBounds then falls
  // back to the hand-tuned bands for it (zero regression). One global pair
  // would let a weak platform under-cover or a strong one stay needlessly wide.
  console.log(`\nper-platform quantile calibration — fit n=${fit.length}, holdout n=${hold.length} (target ≥${TARGET_COVERAGE * 100}%):`);
  const chosenByPlat = new Map<Platform, [number, number]>();
  for (const p of [...new Set(samples.map((s) => s.platform))]) {
    const holdP = hold.filter((s) => s.platform === p);
    const trials = QUANTILE_TRIALS.map((pair) => {
      const cov = coverage(retabulate(fitBase, fit, pair[0], pair[1]), holdP);
      return { pair, pct: cov.overall, n: cov.total };
    });
    const win = trials.find((t) => t.pct >= TARGET_COVERAGE);
    const line = trials.map((t) => `q${t.pair[0]}/${t.pair[1]} ${Math.round(t.pct * 100)}%`).join(" · ");
    if (win) {
      chosenByPlat.set(p, win.pair);
      console.log(`  ${p} (holdout ${trials[0].n}): ${line} → chose q${win.pair[0]}/${win.pair[1]}`);
    } else {
      console.log(`  ${p} (holdout ${trials[0].n}): ${line} → DROP (no pair clears target → hand-tuned fallback)`);
    }
  }

  // ── Final table on ALL samples, each kept platform with its own pair ──
  const full = computeConformalTable(samples.map(toSnapshot));
  const table: ConformalTable = { ...JSON.parse(JSON.stringify(full)), source: "pool-bootstrap" as const };
  for (const p of Object.keys(table.byPlatform) as Platform[]) {
    const pair = chosenByPlat.get(p);
    if (!pair) { delete table.byPlatform[p]; continue; }
    const re = retabulate(full, samples, pair[0], pair[1]);
    table.byPlatform[p] = re.byPlatform[p];
  }
  console.log("\nfinal table strata (kept platforms, pooled):");
  for (const [p, t] of Object.entries(table.byPlatform)) {
    console.log(`  ${p}: n=${t.pooled.n} band ×${Math.exp(t.pooled.qLow80).toFixed(2)}–×${Math.exp(t.pooled.qHigh80).toFixed(2)} medianResidual=${t.pooled.medianResidual.toFixed(2)}`);
  }

  if (apply) {
    await kvSet(CONFORMAL_KV_KEY, table);
    console.log(`\nAPPLIED → ${CONFORMAL_KV_KEY} (source: pool-bootstrap, ${table.sampleCount} samples)`);
  } else {
    console.log("\nvalidation only — rerun with --apply to write the table to KV");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
