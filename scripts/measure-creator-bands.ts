// Measure the typical per-creator band width and write it into the accuracy
// report, so the Accuracy tab can show the tightening the per-creator band
// delivers (TikTok/Instagram) instead of only the wide platform-pooled width.
//
// Uses the SHIPPED computeCreatorBand() so the displayed numbers exactly match
// what the engine applies at forecast time. Typical = median across creators
// who currently qualify (8+ of their own videos).
//
// Usage:  npx tsx scripts/measure-creator-bands.ts          # print only
//         npx tsx scripts/measure-creator-bands.ts --apply  # + merge into report

import { readFileSync } from "node:fs";
import { computeCreatorBand } from "../src/lib/creator-band";
import { mergeAccuracyReport, type PlatformAccuracy } from "../src/lib/accuracy-report";
import type { Platform } from "../src/lib/forecast";
import type { VideoData, ReferenceEntry } from "../src/lib/types";

const PLATFORMS: Platform[] = ["tiktok", "instagram"]; // only where per-creator bands ship
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function main() {
  const apply = process.argv.includes("--apply");
  const store = JSON.parse(readFileSync("src/data/reference-store.json", "utf-8"));
  const entries: ReferenceEntry[] = store.entries;

  const slice: Partial<Record<Platform, PlatformAccuracy>> = {};
  for (const plat of PLATFORMS) {
    const byCh = new Map<string, VideoData[]>();
    for (const e of entries) {
      if (e.type === "video" && e.platform === plat && (e.metrics.views ?? 0) > 0) {
        const a = byCh.get(e.channelId) ?? [];
        a.push({ views: e.metrics.views } as VideoData);
        byCh.set(e.channelId, a);
      }
    }
    const lows: number[] = [], highs: number[] = [];
    for (const vids of byCh.values()) {
      const b = computeCreatorBand(vids, plat);
      if (b) { lows.push(b.lowMult); highs.push(b.highMult); }
    }
    if (lows.length === 0) { console.log(`${plat}: no creators qualify`); continue; }
    const lo = Math.round(median(lows) * 100) / 100;
    const hi = Math.round(median(highs) * 100) / 100;
    slice[plat] = { creatorBandLowMult: lo, creatorBandHighMult: hi, creatorBandCreators: lows.length };
    console.log(`${plat}: ${lows.length} creators qualify | typical per-creator band ×${lo}–×${hi}`);
  }

  if (apply && Object.keys(slice).length > 0) {
    await mergeAccuracyReport(slice, new Date().toISOString());
    console.log("merged into accuracy report");
  } else if (!apply) {
    console.log("print only — rerun with --apply to write");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
