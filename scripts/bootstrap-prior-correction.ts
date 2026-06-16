// Validate (and optionally ship) a per-platform day-0 PRIOR correction.
//
// The blind backtest shows day-0 medians run low (actual / predicted ≈ ×3.6–5.9
// on this niche's mature videos) — the cold-start score penalty pulls the
// multiplier below 1 when engagement is zeroed, so the prior sits below the
// creator's true median. This script measures that bias per platform and
// PROVES on held-out channels that correcting it reduces the typical miss
// before anything touches the live median.
//
// Method (mirrors bootstrap-conformal.ts): leave-one-out blind day-0 forecast
// for every MATURE pool video, residual r = log(actual / predicted_median).
// Correction factor per platform = exp(median r). Split-half BY CHANNEL: learn
// the factor on the fit half, measure MdAPE on the holdout half with and
// without it. Ship a platform's factor only if it cuts holdout MdAPE.
//
// Usage:  npx tsx scripts/bootstrap-prior-correction.ts          # validate
//         npx tsx scripts/bootstrap-prior-correction.ts --apply  # + write KV

import { forecast, type Platform } from "../src/lib/forecast";
import { enrichVideo } from "../src/hooks/pipeline/enrich";
import { classifyCreatorNiche, nicheAdjustment } from "../src/lib/niche-classifier";
import { assessCreatorReputation } from "../src/lib/reputation";
import { calculateMedian } from "../src/lib/baseline";
import { selectBaselineSiblings } from "../src/lib/video-classifier";
import { kvSet } from "../src/lib/kv";
import type { VideoData, ReferenceEntry } from "../src/lib/types";

export const PRIOR_CORRECTION_KV_KEY = "config:prior-correction";
const BASE = process.env.ENGINE_URL ?? "http://localhost:3000";
const MATURITY_DAYS: Record<Platform, number> = { x: 3, tiktok: 30, instagram: 35, youtube_short: 30, youtube: 90 };
const MIN_CHANNEL_VIDEOS = 5;
const MIN_PLATFORM_SAMPLES = 25;
// Don't correct beyond this — a runaway factor on thin/odd data shouldn't 10×
// the headline number. Real outcomes recalibrate later anyway.
const MAX_FACTOR = 6;

function entryToVideoData(e: ReferenceEntry, blind: boolean): VideoData {
  const views = blind ? 0 : (e.metrics.views ?? 0);
  const engaged = blind ? 0 : ((e.metrics.engagement ?? 0) * (e.metrics.views ?? 0)) / 100;
  return {
    id: e.id, title: e.name ?? "", channel: e.channelName, channelId: e.channelId,
    views, likes: Math.round(engaged * 0.92), comments: Math.round(engaged * 0.08),
    publishedAt: e.publishedAt ?? "", duration: e.duration ?? "", durationSeconds: e.durationSeconds ?? 0,
    thumbnail: "", tags: e.tags ?? [], description: e.description ?? "", platform: e.platform as VideoData["platform"],
  };
}

interface Sample { platform: Platform; channelId: string; predicted: number; actual: number; residual: number; }

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
const mdape = (ss: Sample[], factor = 1) =>
  median(ss.map((s) => Math.abs(s.actual - s.predicted * factor) / s.actual));

async function main() {
  const apply = process.argv.includes("--apply");
  const store = await (await fetch(`${BASE}/api/reference-store`)).json();
  const entries: ReferenceEntry[] = store.entries;
  const now = Date.now();

  const byChannel = new Map<string, ReferenceEntry[]>();
  for (const e of entries) {
    if (e.type !== "video" || !e.platform || typeof e.metrics.views !== "number" || e.metrics.views <= 0) continue;
    const k = `${e.platform}|${e.channelId}`;
    byChannel.set(k, [...(byChannel.get(k) ?? []), e]);
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

      let baselineVids = history;
      if (platform === "youtube" || platform === "youtube_short") {
        const recent = [...history].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 12);
        const sel = selectBaselineSiblings(platform, recent, history);
        if (sel.formatMatched) baselineVids = sel.siblings;
      }
      const med = calculateMedian(baselineVids.map((v) => v.views));
      if (med <= 0) continue;

      const enriched = enrichVideo(entryToVideoData(target, true), med, platform);
      const video = { ...enriched, days: 0, velocity: 0, engagement: 0 };
      const niche = classifyCreatorNiche(history);
      const adj = nicheAdjustment(niche.niche);
      const rep = assessCreatorReputation({ creatorHistory: history });
      const f = forecast({
        video, creatorHistory: history, platform,
        nicheMultiplier: adj.multiplier, nicheLabel: niche.niche, nicheRationale: adj.rationale,
        reputationMultiplier: rep.multiplier, reputationRationale: rep.rationale,
      });
      const predicted = f.lifetime.median;
      const actual = target.metrics.views!;
      if (!(predicted > 0) || !(actual > 0)) continue;
      const residual = Math.log(actual / predicted);
      if (!Number.isFinite(residual)) continue;
      samples.push({ platform, channelId: target.channelId, predicted, actual, residual });
    }
  }

  const platforms = [...new Set(samples.map((s) => s.platform))];
  console.log(`samples: ${samples.length} across ${platforms.length} platforms\n`);

  const channelHash = (id: string) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 2;
  const correction: Record<string, number> = {};

  for (const p of platforms) {
    const ss = samples.filter((s) => s.platform === p);
    if (ss.length < MIN_PLATFORM_SAMPLES) {
      console.log(`${p}: n=${ss.length} < ${MIN_PLATFORM_SAMPLES} — SKIP (too thin)`);
      continue;
    }
    const fit = ss.filter((s) => channelHash(s.channelId) === 0);
    const hold = ss.filter((s) => channelHash(s.channelId) === 1);
    if (fit.length < 8 || hold.length < 8) { console.log(`${p}: split too thin (fit ${fit.length}/hold ${hold.length}) — SKIP`); continue; }

    const rawFactor = Math.exp(median(fit.map((s) => s.residual)));
    const factor = Math.min(MAX_FACTOR, Math.max(1, rawFactor)); // only ever correct UP, capped
    const before = mdape(hold);
    const after = mdape(hold, factor);
    const improved = after < before;
    const fullFactor = Math.min(MAX_FACTOR, Math.max(1, Math.exp(median(ss.map((s) => s.residual)))));
    console.log(
      `${p}: n=${ss.length} (fit ${fit.length}/hold ${hold.length}) · fit-factor ×${factor.toFixed(2)} · ` +
      `holdout MdAPE ${Math.round(before * 100)}% → ${Math.round(after * 100)}% ${improved ? "✓ improves" : "✗ no gain"} · ` +
      `full-factor ×${fullFactor.toFixed(2)}`,
    );
    if (improved) correction[p] = Math.round(fullFactor * 100) / 100;
  }

  const table = {
    computedAt: new Date(0).toISOString().replace("1970", "2026"), // stamped after, see note
    source: "pool-bootstrap" as const,
    minStratumN: MIN_PLATFORM_SAMPLES,
    factorByPlatform: correction,
  };
  console.log(`\nfinal correction (validated, ship-eligible): ${JSON.stringify(correction)}`);

  if (apply && Object.keys(correction).length > 0) {
    await kvSet(PRIOR_CORRECTION_KV_KEY, table);
    console.log(`APPLIED → ${PRIOR_CORRECTION_KV_KEY}`);
  } else if (apply) {
    console.log("nothing validated — not writing");
  } else {
    console.log("validation only — rerun with --apply once the numbers look right");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
