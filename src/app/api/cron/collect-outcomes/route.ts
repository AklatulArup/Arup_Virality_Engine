// /api/cron/collect-outcomes
//
// Nightly cron job that closes the learning loop:
//   1. Iterate all snapshots that don't yet have a "mature" outcome
//   2. For each, check if enough time has elapsed relative to the platform horizon
//   3. If mature and not yet checked in the last 12 hours, re-scrape the video
//   4. Record the actual view count against the original prediction
//
// Maturity thresholds per platform (roughly 1x horizon — when the forecast
// should be fully realised):
//   X            = 3 days
//   TikTok       = 30 days
//   Instagram    = 35 days
//   YT Shorts    = 90 days
//   YT Long-Form = 90 days (capture early — evergreen tail continues beyond)
//
// Rate-limited: max 20 re-scrapes per invocation to stay within API budgets.
// Triggered by Vercel Cron via vercel.json schedule "0 4 * * *" (4am UTC daily).

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvListRange, isKvAvailable } from "@/lib/kv";
import type { ForecastSnapshot } from "@/lib/forecast-learning";
import type { Platform } from "@/lib/forecast";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — rescrapes can be slow

const MATURITY_DAYS: Record<Platform, number> = {
  x:             3,
  tiktok:        30,
  instagram:     35,
  youtube_short: 90,
  youtube:       90,
};

const MAX_RESCRAPES_PER_RUN = 20;
const MIN_HOURS_BETWEEN_CHECKS = 12;

interface CollectorResult {
  ok:              boolean;
  snapshotsScanned:number;
  mature:          number;
  rescraped:       number;
  recordedOutcomes:number;
  skipped:         number;
  errors:          Array<{ snapshotId: string; error: string }>;
  durationMs:      number;
}

export async function GET(req: NextRequest) {
  const start = Date.now();

  // Security: protect against random hits — require either Vercel's cron secret
  // or a manual admin header. The CRON_SECRET is auto-injected by Vercel Cron.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, error: "KV not configured" }, { status: 500 });
  }

  const result: CollectorResult = {
    ok: true, snapshotsScanned: 0, mature: 0, rescraped: 0,
    recordedOutcomes: 0, skipped: 0, errors: [], durationMs: 0,
  };

  try {
    const ids = await kvListRange("snapshots:all", 0, -1);
    result.snapshotsScanned = ids.length;

    // Deduplicate by videoId — we only need to re-scrape each video once per run,
    // even if it has multiple snapshots (different forecast times, different inputs).
    const byVideo = new Map<string, ForecastSnapshot>();
    for (const id of ids) {
      const snap = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
      if (!snap) continue;
      const existing = byVideo.get(snap.videoId);
      // Keep the MOST RECENT snapshot per video — that's the one we judge against
      if (!existing || new Date(snap.forecastedAt) > new Date(existing.forecastedAt)) {
        byVideo.set(snap.videoId, snap);
      }
    }

    // Filter to mature videos
    const now = Date.now();
    const mature: ForecastSnapshot[] = [];
    for (const snap of byVideo.values()) {
      if (!snap.publishedAt) continue; // pre-publish snapshots can't be matured
      const ageDays = (now - new Date(snap.publishedAt).getTime()) / 86_400_000;
      if (ageDays < MATURITY_DAYS[snap.platform]) continue;

      // Skip if checked recently
      const lastCheck = snap.outcomes[snap.outcomes.length - 1];
      if (lastCheck) {
        const hoursSince = (now - new Date(lastCheck.checkedAt).getTime()) / 3_600_000;
        if (hoursSince < MIN_HOURS_BETWEEN_CHECKS) { result.skipped++; continue; }
      }

      mature.push(snap);
    }
    result.mature = mature.length;

    // Rate limit
    const toProcess = mature.slice(0, MAX_RESCRAPES_PER_RUN);

    for (const snap of toProcess) {
      try {
        const actualViews = await rescrapeViews(snap);
        if (actualViews === null) { result.skipped++; continue; }
        result.rescraped++;

        await recordOutcomeToKv(snap.videoId, actualViews, snap);
        result.recordedOutcomes++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ snapshotId: snap.id, error: msg });
      }
    }

    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/collect-outcomes] fatal:", e);
    result.ok = false;
    result.errors.push({ snapshotId: "none", error: e instanceof Error ? e.message : String(e) });
    result.durationMs = Date.now() - start;
    return NextResponse.json(result, { status: 500 });
  }
}

// ─── RE-SCRAPE BY PLATFORM ────────────────────────────────────────────────
//
// For each platform, we hit the existing scraping pipeline to pull current views.
// Returns null if the video is unavailable (deleted, private, or scraper down).

async function rescrapeViews(snap: ForecastSnapshot): Promise<number | null> {
  const url = snap.videoUrl;
  if (!url) return null;

  const base = process.env.NEXT_PUBLIC_BASE_URL ??
               (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!base) return null;

  switch (snap.platform) {
    case "youtube":
    case "youtube_short": {
      const r = await fetch(`${base}/api/analyze?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json();
      return typeof data?.video?.views === "number" ? data.video.views : null;
    }

    case "tiktok": {
      const handleOrUrl = url;
      const r = await fetch(`${base}/api/tiktok/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: handleOrUrl, limit: 30 }),
        cache: "no-store",
      });
      if (!r.ok) return null;
      const data = await r.json();
      const match = data?.videos?.find((v: { id?: string; url?: string }) =>
        v.id === snap.videoId || v.url === snap.videoUrl);
      return match?.views ?? null;
    }

    case "instagram": {
      const r = await fetch(`${base}/api/instagram/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: url, limit: 30 }),
        cache: "no-store",
      });
      if (!r.ok) return null;
      const data = await r.json();
      const match = data?.videos?.find((v: { id?: string; url?: string }) =>
        v.id === snap.videoId || v.url === snap.videoUrl);
      return match?.views ?? null;
    }

    case "x": {
      const r = await fetch(`${base}/api/x/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: url, limit: 20 }),
        cache: "no-store",
      });
      if (!r.ok) return null;
      const data = await r.json();
      const match = data?.posts?.find((p: { id?: string; url?: string }) =>
        p.id === snap.videoId || p.url === snap.videoUrl);
      return match?.views ?? null;
    }
  }

  return null;
}

// ─── WRITE OUTCOME TO KV ──────────────────────────────────────────────────

async function recordOutcomeToKv(videoId: string, actualViews: number, snap: ForecastSnapshot): Promise<void> {
  const ageDays = snap.publishedAt
    ? (Date.now() - new Date(snap.publishedAt).getTime()) / 86_400_000
    : 0;

  const updatedSnap: ForecastSnapshot = {
    ...snap,
    outcomes: [...snap.outcomes, {
      checkedAt: new Date().toISOString(),
      ageDaysAtCheck: ageDays,
      actualViews,
    }],
  };

  await kvSet(`snapshot:${snap.id}`, updatedSnap);
}

// POST for manual trigger from admin page (same handler)
export const POST = GET;
