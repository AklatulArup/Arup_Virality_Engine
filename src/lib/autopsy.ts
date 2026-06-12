// Breakout autopsy — decomposes "this video did ×N vs the creator's normal"
// into the buckets an RM can act on:
//   internal — the video's own quality (the engine's score multiplier)
//   tide     — how the same-platform cohort posted the same week performed
//              vs THEIR normals (the platform was generous / stingy)
//   global   — market conditions that week (daily volatility log)
//   residual — luck + everything we haven't measured yet
//
// total = internal × tide × global × residual, so residual = total ÷ (live
// factors). Buckets without enough data return null with a "collecting" note
// instead of a made-up number — the residual is computed only from what's
// actually live, and shrinks as the pool and logs grow. Pure compute.

import type { Platform } from "./forecast";
import type { ReferenceEntry } from "./types";

export interface AutopsyFactor {
  key: "internal" | "tide" | "global";
  label: string;
  value: number | null; // multiplier; null = still collecting
  note: string;
  n?: number; // sample size behind the number, when applicable
}

export interface BreakoutAutopsy {
  total: number;            // ×N vs creator normal (vsBaseline)
  factors: AutopsyFactor[];
  residual: number | null;  // luck + unmeasured
  residualNote: string;
}

export interface VolDay {
  day: string;
  level?: string;
  multiplier?: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const TIDE_MIN_COHORT = 8;   // same-week videos needed before the tide counts
const TIDE_WINDOW_DAYS = 7;  // ± window around the publish date
const VOL_MIN_DAYS = 3;      // logged days needed before market week counts

/** Median same-week performance (vs each channel's own normal) of the
 *  same-platform cohort in the pool. The platform's generosity that week. */
export function cohortTide(
  entries: ReferenceEntry[],
  platform: Platform,
  publishedAt: string,
  excludeVideoId: string,
): { value: number; n: number } | null {
  const t0 = new Date(publishedAt).getTime();
  if (!Number.isFinite(t0)) return null;

  // Per-channel medians from ALL of that channel's pool videos (baseline).
  const vids = entries.filter(
    (e) => e.type === "video" && e.platform === platform && typeof e.metrics.views === "number" && e.metrics.views! > 0,
  );
  const byChannel = new Map<string, ReferenceEntry[]>();
  for (const e of vids) {
    const arr = byChannel.get(e.channelId) ?? [];
    arr.push(e);
    byChannel.set(e.channelId, arr);
  }

  const ratios: number[] = [];
  for (const channelVids of byChannel.values()) {
    if (channelVids.length < 5) continue;
    const med = median(channelVids.map((e) => e.metrics.views!));
    if (med <= 0) continue;
    for (const e of channelVids) {
      if (e.id === excludeVideoId || !e.publishedAt) continue;
      const dt = Math.abs(new Date(e.publishedAt).getTime() - t0) / 86_400_000;
      if (dt <= TIDE_WINDOW_DAYS) ratios.push(e.metrics.views! / med);
    }
  }

  if (ratios.length < TIDE_MIN_COHORT) return null;
  return { value: median(ratios), n: ratios.length };
}

export function computeAutopsy(params: {
  total: number;            // video.vsBaseline — ×N vs creator normal
  videoId: string;
  platform: Platform;
  publishedAt: string;
  scoreMultiplier: number;  // forecast.scoreMultiplier.median for this video
  score: number;            // 0-100 readiness score (for the note)
  poolEntries: ReferenceEntry[];
  volWeek: VolDay[] | null; // publish-week rows from /api/forecast/vol-history
}): BreakoutAutopsy {
  const { total, videoId, platform, publishedAt, scoreMultiplier, score, poolEntries, volWeek } = params;
  const factors: AutopsyFactor[] = [];

  // Internal — the engine's own read of the video's quality.
  const internal = Math.min(3, Math.max(0.3, scoreMultiplier));
  factors.push({
    key: "internal",
    label: "Video quality",
    value: Math.round(internal * 100) / 100,
    note: `Readiness score ${Math.round(score)} — the engine's quality multiplier for this video.`,
  });

  // Tide — same-week, same-platform cohort vs their own normals.
  const tide = cohortTide(poolEntries, platform, publishedAt, videoId);
  factors.push(
    tide
      ? {
          key: "tide",
          label: "Same-week tide",
          value: Math.round(Math.min(5, Math.max(0.2, tide.value)) * 100) / 100,
          n: tide.n,
          note: `${tide.n} same-week videos on this platform ran at ×${tide.value.toFixed(2)} of their normals.`,
        }
      : {
          key: "tide",
          label: "Same-week tide",
          value: null,
          note: "Collecting — needs more same-week videos in the pool. Importing creator handles regularly fills this.",
        },
  );

  // Global — market conditions during the publish week.
  const volDays = (volWeek ?? []).filter((d) => typeof d.multiplier === "number");
  if (volDays.length >= VOL_MIN_DAYS) {
    const avg = volDays.reduce((s, d) => s + (d.multiplier as number), 0) / volDays.length;
    const hot = volDays.filter((d) => d.level === "elevated" || d.level === "high").length;
    factors.push({
      key: "global",
      label: "Market week",
      value: Math.round(Math.min(2, Math.max(0.5, avg)) * 100) / 100,
      n: volDays.length,
      note: hot > 0
        ? `${hot} of ${volDays.length} logged days ran elevated/high market volatility.`
        : `Quiet market week across ${volDays.length} logged days.`,
    });
  } else {
    factors.push({
      key: "global",
      label: "Market week",
      value: null,
      note: "Collecting — the daily volatility log started 11 Jun 2026, so this fills in for videos published after that.",
    });
  }

  // Residual — what the live factors can't account for.
  const live = factors.filter((f) => f.value != null && f.value > 0);
  let residual: number | null = null;
  let residualNote: string;
  if (total > 0 && live.length > 0) {
    const explained = live.reduce((p, f) => p * (f.value as number), 1);
    residual = Math.round((total / explained) * 100) / 100;
    const missing = factors.filter((f) => f.value == null).length;
    residualNote = missing > 0
      ? `Luck plus the ${missing} bucket${missing > 1 ? "s" : ""} still collecting — this number shrinks as data lands.`
      : "Pure luck plus anything the engine doesn't measure yet.";
  } else {
    residualNote = "Nothing to decompose yet — all buckets are still collecting.";
  }

  return { total: Math.round(total * 10) / 10, factors, residual, residualNote };
}
