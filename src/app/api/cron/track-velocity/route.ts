// /api/cron/track-velocity
//
// The second cron job — fires every hour. Closes a short-horizon feedback loop
// that the 30-day outcome collector doesn't catch.
//
// For every tracked video, we want samples at:
//   t+1h, t+3h, t+6h, t+24h, t+72h (X only), t+7d
//
// This data powers:
//   1. The velocity signal in the forecast engine (acceleration detection)
//   2. Early abandonment detection — if a post is declining fast, RM can pivot
//   3. Additional calibration data points on the way to maturity
//
// Each snapshot gets a parallel "velocity track" keyed velocity:<videoId>
// that's a Redis list of samples: { t: ISO, ageHours, views, velocity }.

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvSetMembers, kvListPush, kvListRange, isKvAvailable } from "@/lib/kv";
import type { ForecastSnapshot } from "@/lib/forecast-learning";
import type { Platform } from "@/lib/forecast";

export const runtime = "nodejs";
export const maxDuration = 300;

export interface VelocitySample {
  t:            string;   // ISO timestamp of this check
  ageHours:     number;   // hours since video publish
  views:        number;   // total views at this check
  deltaViews:   number;   // change vs previous sample
  deltaHours:   number;   // hours since previous sample
  velocity:     number;   // views/hour between previous and this sample
  acceleration: number;   // change in velocity vs previous delta (+ = speeding up)
}

interface TrackerResult {
  ok:              boolean;
  videosScanned:   number;
  sampled:         number;
  skippedNotDue:   number;
  skippedTooOld:   number;
  errors:          Array<{ videoId: string; error: string }>;
  durationMs:      number;
}

// Target sample ages per platform (hours)
const SAMPLE_SCHEDULE: Record<Platform, number[]> = {
  x:             [1, 3, 6, 12, 24, 48, 72],           // X dies in 3 days
  tiktok:        [1, 3, 6, 12, 24, 48, 72, 168],      // 7d tail
  instagram:     [1, 3, 6, 12, 24, 48, 72, 168],
  youtube_short: [2, 6, 12, 24, 48, 168, 336],        // 14d — Shorts stay active longer
  youtube:       [6, 24, 72, 168, 336, 720],          // 30d — LF is evergreen
};

const SAMPLE_TOLERANCE_HOURS = 2; // allow ±2h when matching a cron tick to a target age
const MAX_VIDEOS_PER_RUN = 40;

export async function GET(req: NextRequest) {
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, error: "KV not configured" }, { status: 500 });
  }

  const result: TrackerResult = {
    ok: true, videosScanned: 0, sampled: 0,
    skippedNotDue: 0, skippedTooOld: 0, errors: [], durationMs: 0,
  };

  try {
    // All unique video IDs we're tracking (deduped set of forecast snapshots)
    const videoIds = await kvSetMembers("snapshots:video-ids");
    result.videosScanned = videoIds.length;

    const now = Date.now();
    const toProcess: Array<{ snap: ForecastSnapshot; targetAgeHours: number }> = [];

    for (const videoId of videoIds) {
      // Find most recent snapshot for this video (has the canonical publishedAt + platform)
      const snapIds = await kvListRange(`snapshots:by-video:${videoId}`, -1, -1);
      if (snapIds.length === 0) continue;
      const snap = await kvGet<ForecastSnapshot>(`snapshot:${snapIds[0]}`);
      if (!snap || !snap.publishedAt) continue;

      const ageHours = (now - new Date(snap.publishedAt).getTime()) / 3_600_000;

      // Skip ones already past the longest scheduled sample
      const schedule = SAMPLE_SCHEDULE[snap.platform];
      const maxAge = schedule[schedule.length - 1];
      if (ageHours > maxAge + SAMPLE_TOLERANCE_HOURS) { result.skippedTooOld++; continue; }

      // Find the nearest scheduled target age we haven't yet sampled
      const existingSamples = await kvListRange(`velocity:${videoId}`, 0, -1);
      const existingAges = existingSamples.map((s) => {
        try { return (JSON.parse(s) as VelocitySample).ageHours; } catch { return -1; }
      });

      const dueTarget = schedule.find((targetAge) =>
        ageHours >= targetAge - SAMPLE_TOLERANCE_HOURS &&
        ageHours <= targetAge + SAMPLE_TOLERANCE_HOURS &&
        !existingAges.some((a) => Math.abs(a - targetAge) < SAMPLE_TOLERANCE_HOURS)
      );

      if (!dueTarget) { result.skippedNotDue++; continue; }

      toProcess.push({ snap, targetAgeHours: dueTarget });
    }

    // Rate limit per run
    const batch = toProcess.slice(0, MAX_VIDEOS_PER_RUN);

    for (const { snap } of batch) {
      try {
        const sampled = await takeVelocitySample(snap);
        if (sampled) result.sampled++;
      } catch (e) {
        result.errors.push({ videoId: snap.videoId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  } catch (e) {
    result.ok = false;
    result.errors.push({ videoId: "none", error: e instanceof Error ? e.message : String(e) });
    result.durationMs = Date.now() - start;
    return NextResponse.json(result, { status: 500 });
  }
}

// ─── SAMPLER ──────────────────────────────────────────────────────────────

async function takeVelocitySample(snap: ForecastSnapshot): Promise<boolean> {
  if (!snap.publishedAt || !snap.videoUrl) return false;

  // Reuse the re-scrape logic from collect-outcomes by calling the respective scraper
  const base = process.env.NEXT_PUBLIC_BASE_URL ??
               (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!base) return false;

  const views = await rescrapeVideo(snap.videoUrl, snap.platform, snap.videoId, base);
  if (views === null) return false;

  const ageHours = (Date.now() - new Date(snap.publishedAt).getTime()) / 3_600_000;

  // Compute delta vs previous sample
  const existing = await kvListRange(`velocity:${snap.videoId}`, 0, -1);
  const previousRaw = existing[existing.length - 1];
  let deltaViews = views;
  let deltaHours = ageHours;
  let velocity = deltaHours > 0 ? deltaViews / deltaHours : 0;
  let acceleration = 0;

  if (previousRaw) {
    try {
      const prev = JSON.parse(previousRaw) as VelocitySample;
      deltaViews = views - prev.views;
      deltaHours = ageHours - prev.ageHours;
      velocity = deltaHours > 0 ? deltaViews / deltaHours : 0;
      acceleration = velocity - prev.velocity;
    } catch { /* malformed previous, keep initial */ }
  }

  const sample: VelocitySample = {
    t: new Date().toISOString(),
    ageHours,
    views,
    deltaViews,
    deltaHours,
    velocity,
    acceleration,
  };

  await kvListPush(`velocity:${snap.videoId}`, JSON.stringify(sample));
  return true;
}

async function rescrapeVideo(url: string, platform: Platform, videoId: string, base: string): Promise<number | null> {
  try {
    switch (platform) {
      case "youtube":
      case "youtube_short": {
        const r = await fetch(`${base}/api/analyze?url=${encodeURIComponent(url)}`, { cache: "no-store" });
        if (!r.ok) return null;
        const d = await r.json();
        return typeof d?.video?.views === "number" ? d.video.views : null;
      }
      case "tiktok":
      case "instagram": {
        const endpoint = platform === "tiktok" ? "/api/tiktok/scrape" : "/api/instagram/scrape";
        const r = await fetch(`${base}${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: url, limit: 30 }), cache: "no-store",
        });
        if (!r.ok) return null;
        const d = await r.json();
        const match = d?.videos?.find((v: { id?: string; url?: string }) =>
          v.id === videoId || v.url === url);
        return match?.views ?? null;
      }
      case "x": {
        const r = await fetch(`${base}/api/x/scrape`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: url, limit: 20 }), cache: "no-store",
        });
        if (!r.ok) return null;
        const d = await r.json();
        const match = d?.posts?.find((p: { id?: string; url?: string }) =>
          p.id === videoId || p.url === url);
        return match?.views ?? null;
      }
    }
  } catch { return null; }
  return null;
}

export const POST = GET;
