// ═══════════════════════════════════════════════════════════════════════════
// POOL STATS — single source of truth for the reference-pool breakdown
// ═══════════════════════════════════════════════════════════════════════════
//
// Both the Sidebar's "Reference Pool" tiles and the Landing page's "Pool
// Coverage" panel need the same numbers — previously each surface computed
// its own totals with slightly different rules, so Sidebar showed 713
// shorts while Pool Coverage showed 0. This module is the one place that
// knows how to bucket an entry into a platform, and the one place that
// defines what "short" means.
//
// Bucketing rules:
//   - TikTok / Instagram / X — use the platform field as-is.
//   - YouTube — split by `videoFormat` ("short" or "full") or `durationSeconds`
//     (within the 180s Shorts limit → short). The ingest pipeline stamps
//     platform="youtube" for both long-form and shorts; only
//     videoFormat/duration distinguishes.
//   - Entries without a platform field are skipped.

import type { Platform } from "./forecast";
import { YT_SHORTS_MAX_SECONDS } from "./video-classifier";

// Structural subset of the fields we actually read. Lets callers pass loose
// untyped API payloads without forcing a cast.
export interface MinimalEntry {
  platform?:         Platform | string | null;
  channelName?:      string;
  name?:             string;
  videoFormat?:      string;
  durationSeconds?:  number;
  analyzedAt?:       string;
  metrics?:          Record<string, number | string>;
  title?:            string;
  type?:             string;
}

export interface PlatformRow {
  id:       Platform;
  count:    number;
  creators: number;
  pct:      number;      // share of TOTAL bucketed count, 0-100
  status:   "mature" | "standard" | "functional" | "below-min" | "empty";
  min:      number;
  std:      number;
  mat:      number;
  nextTarget: number | null;   // count needed to hit the next milestone (null = mature)
  label:    "workable" | "standard" | "mature" | null;
}

export interface PoolStats {
  totalEntries:       number;   // total bucketed (skips entries with no platform)
  totalCreators:      number;
  totalShorts:        number;   // YouTube Shorts only — matches Pool Coverage YTS
  totalLong:          number;   // YouTube Long-form
  skipped:            number;   // entries without a platform field
  rows:               PlatformRow[];
  lastIngestedAt:     string | null;
  grand:              { current: number; min: number; std: number; mat: number };
}

// Per-platform milestone targets — mirror the values previously hard-coded
// inside LandingPage. Tuned for FundedNext's trading niche: YouTube LF needs
// a bigger sample to stabilise, short-form platforms mature faster.
const TARGETS: Record<Platform, { min: number; std: number; mat: number }> = {
  youtube:       { min: 500, std: 1950, mat: 3800 },
  youtube_short: { min: 150, std: 400,  mat: 800  },
  instagram:     { min: 150, std: 400,  mat: 800  },
  tiktok:        { min: 200, std: 400,  mat: 800  },
  x:             { min: 400, std: 800,  mat: 1600 },
};

const ORDER: Platform[] = ["youtube", "youtube_short", "tiktok", "instagram", "x"];

// Bucket one entry. Returns null for unclassifiable rows.
export function bucketOf(e: MinimalEntry): Platform | null {
  const p = typeof e?.platform === "string" ? e.platform : null;
  if (p === "tiktok" || p === "instagram" || p === "x" || p === "youtube_short") {
    return p;
  }
  if (p === "youtube") {
    const d = typeof e.durationSeconds === "number" ? e.durationSeconds : 0;
    const fmt = typeof e.videoFormat === "string" ? e.videoFormat : "";
    return (fmt === "short" || (d > 0 && d <= YT_SHORTS_MAX_SECONDS)) ? "youtube_short" : "youtube";
  }
  return null;
}

// Main entry point. Computes the full stats object for a list of entries.
export function computePoolStats(entries: MinimalEntry[]): PoolStats {
  const state: Record<Platform, { count: number; creators: Set<string> }> = {
    youtube:       { count: 0, creators: new Set() },
    youtube_short: { count: 0, creators: new Set() },
    instagram:     { count: 0, creators: new Set() },
    tiktok:        { count: 0, creators: new Set() },
    x:             { count: 0, creators: new Set() },
  };

  const allCreators = new Set<string>();
  let skipped = 0;
  let lastIngestedAt: string | null = null;

  for (const e of entries) {
    const bucket = bucketOf(e);
    if (!bucket) { skipped++; continue; }
    state[bucket].count += 1;
    const handle = (e.channelName ?? e.name ?? "").trim();
    if (handle) {
      state[bucket].creators.add(handle);
      allCreators.add(handle);
    }
    const t = typeof e.analyzedAt === "string" ? e.analyzedAt : "";
    if (t && (!lastIngestedAt || t > lastIngestedAt)) lastIngestedAt = t;
  }

  const total = Object.values(state).reduce((n, v) => n + v.count, 0);

  const rows: PlatformRow[] = ORDER.map(id => {
    const s = state[id];
    const t = TARGETS[id];
    const nextTarget =
      s.count >= t.mat ? null :
      s.count >= t.std ? t.mat :
      s.count >= t.min ? t.std :
                         t.min;
    const status: PlatformRow["status"] =
      s.count >= t.mat ? "mature" :
      s.count >= t.std ? "standard" :
      s.count >= t.min ? "functional" :
      s.count === 0    ? "empty" :
                         "below-min";
    const label: PlatformRow["label"] =
      nextTarget === t.min ? "workable" :
      nextTarget === t.std ? "standard" :
      nextTarget === t.mat ? "mature" :
                              null;
    return {
      id,
      count:    s.count,
      creators: s.creators.size,
      pct:      total > 0 ? (s.count / total) * 100 : 0,
      status,
      min: t.min, std: t.std, mat: t.mat,
      nextTarget,
      label,
    };
  });

  // Sort platforms by count descending so the biggest leads.
  rows.sort((a, b) => b.count - a.count);

  const grand = {
    current: total,
    min: Object.values(TARGETS).reduce((n, t) => n + t.min, 0),
    std: Object.values(TARGETS).reduce((n, t) => n + t.std, 0),
    mat: Object.values(TARGETS).reduce((n, t) => n + t.mat, 0),
  };

  return {
    totalEntries:   total,
    totalCreators:  allCreators.size,
    totalShorts:    state.youtube_short.count,
    totalLong:      state.youtube.count,
    skipped,
    rows,
    lastIngestedAt,
    grand,
  };
}

// Convenience for the sidebar tiles — videos/creators/shorts counts only.
export function sidebarCounts(entries: MinimalEntry[]): { videos: number; creators: number; shorts: number } {
  const s = computePoolStats(entries);
  return { videos: s.totalEntries, creators: s.totalCreators, shorts: s.totalShorts };
}
