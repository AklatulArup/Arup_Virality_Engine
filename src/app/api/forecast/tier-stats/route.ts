// /api/forecast/tier-stats
//
// GET — observability on the lifecycle-tier classifier. Loads all snapshots,
// groups by persisted `lifecycleTier`, returns counts + per-tier sample
// baselines and mean predicted lifetimes. Only snapshots recorded after the
// tier field was added will appear; older ones land in `null`.

import { NextResponse } from "next/server";
import { kvGet, kvListRange, isKvAvailable } from "@/lib/kv";
import type { ForecastSnapshot } from "@/lib/forecast-learning";
import type { Platform } from "@/lib/forecast";

export const runtime = "nodejs";
export const revalidate = 60;

const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube_short"];   // tier-applicable only
const ALL_TIERS = [
  "tier-1-hook",
  "tier-1-stuck",
  "tier-2-rising",
  "tier-2-stuck",
  "tier-3-viral",
  "tier-4-plateau",
  "not-applicable",
  "null",           // snapshots recorded before the field existed
] as const;

type TierBucket = (typeof ALL_TIERS)[number];

interface TierStatsEntry {
  tier:                 TierBucket;
  n:                    number;
  avgPredictedLifetime: number;
  sampleMedianActual:   number | null;   // among snapshots with outcomes
  mdAPE:                number | null;   // median absolute % error when outcomes exist
}

export async function GET() {
  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured", byPlatform: [] });
  }

  const ids = await kvListRange("snapshots:all", 0, -1);
  const snaps: ForecastSnapshot[] = [];
  for (const id of ids) {
    const s = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
    if (s) snaps.push(s);
  }

  const byPlatform = PLATFORMS.map(platform => {
    const platformSnaps = snaps.filter(s => s.platform === platform);
    const buckets: TierStatsEntry[] = ALL_TIERS.map(tier => {
      const inTier = platformSnaps.filter(s => bucketOf(s) === tier);
      const withOutcomes = inTier.filter(s => s.outcomes.length > 0);
      const actuals = withOutcomes.map(s => s.outcomes[s.outcomes.length - 1].actualViews);
      const apes = withOutcomes.map(s => {
        const predicted = s.lifetime.median;
        const actual = s.outcomes[s.outcomes.length - 1].actualViews;
        return actual > 0 ? Math.abs(predicted - actual) / actual : 0;
      });
      return {
        tier,
        n: inTier.length,
        avgPredictedLifetime: inTier.length > 0
          ? Math.round(inTier.reduce((sum, s) => sum + s.lifetime.median, 0) / inTier.length)
          : 0,
        sampleMedianActual: actuals.length > 0 ? median(actuals) : null,
        mdAPE:              apes.length > 0 ? median(apes) : null,
      };
    }).filter(b => b.n > 0);

    return { platform, total: platformSnaps.length, buckets };
  }).filter(p => p.total > 0);

  return NextResponse.json({
    ok: true,
    byPlatform,
    totalAnalysed: snaps.length,
    note: "Snapshots recorded before lifecycle-tier persistence landed appear in the `null` bucket.",
  });
}

function bucketOf(s: ForecastSnapshot): TierBucket {
  const t = s.lifecycleTier;
  if (t == null) return "null";
  if ((ALL_TIERS as readonly string[]).includes(t)) return t as TierBucket;
  return "null";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
