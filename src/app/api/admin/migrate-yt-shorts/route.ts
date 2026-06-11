// /api/admin/migrate-yt-shorts
//
// One-shot migration for YouTube entries whose stored platform stamp predates
// the Shorts duration cutoff raise (YT_SHORTS_MAX_SECONDS, 60s → 180s).
// Two stale populations exist in the pool:
//
//   1. 61–180s videos ingested under the old 60s rule — stamped
//      platform:"youtube" + videoFormat:"full", but they are Shorts.
//   2. ≤60s Shorts from the oldest ingests, when the pipeline stamped
//      platform:"youtube" for everything and used videoFormat alone to
//      distinguish (pool-stats bucketing still documents that era).
//
// Read-time bucketing (bucketOf in src/lib/pool-stats.ts) self-heals both,
// but consumers that filter by e.platform === "youtube" directly — e.g.
// findRelatedEntries with a platform arg, cross-platform reputation, the
// creators index — see the stale stamps and fold Shorts into long-form
// creator baselines. /api/reference-store/backfill will not fix them: it
// only touches entries missing durationSeconds or videoFormat.
//
// The fix: any video entry stamped "youtube" that bucketOf classifies as
// "youtube_short" is rewritten to what the current ingest pipeline would
// stamp — platform "youtube_short", videoFormat "short", orientation
// "vertical". Aligning storage with bucketOf means pool stats are unchanged
// by design; only direct platform-filter consumers see corrected data.
// Re-running is a no-op once applied.
//
// USAGE:
//   GET                               → dry-run report, no writes
//   POST { action: "apply" }          → rewrite stale entries
//
// Auth: requires `x-cron-secret` header matching env CRON_SECRET. Refuses
// entirely if CRON_SECRET isn't set (fail-closed), same as migrate-ig-tiktok.

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { ReferenceStore, ReferenceEntry } from "@/lib/types";
import { bucketOf } from "@/lib/pool-stats";
import { YT_SHORTS_MAX_SECONDS } from "@/lib/video-classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORE_PATH = join(process.cwd(), "src/data/reference-store.json");

// The Shorts ceiling before the raise. Only used to split the report into
// "mislabeled by the cutoff change" vs "legacy platform stamp" — the actual
// migration predicate is bucketOf, which already imports YT_SHORTS_MAX_SECONDS.
const LEGACY_SHORTS_MAX_SECONDS = 60;

interface Candidate {
  id:              string;
  name:            string;
  channelName:     string;
  durationSeconds: number;
  videoFormat:     string;
}

interface MigrationReport {
  totalScanned:    number;
  youtubeStamped:  number;   // video entries with platform === "youtube"
  staleShorts:     number;   // bucketOf says youtube_short → will be rewritten
  band61to180:     number;   // victims of the 60s → 180s cutoff raise
  legacyUnder60:   number;   // ≤60s Shorts from the platform:"youtube" era
  formatShortOnly: number;   // no usable duration — videoFormat alone drove the bucket
  applied:         number;
  sample:          Candidate[];
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return header === secret;
}

function readStore(): ReferenceStore | null {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as ReferenceStore;
  } catch {
    return null;
  }
}

function writeStore(store: ReferenceStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function scan(store: ReferenceStore): { report: MigrationReport; staleIds: Set<string> } {
  let youtubeStamped  = 0;
  let band61to180     = 0;
  let legacyUnder60   = 0;
  let formatShortOnly = 0;
  const sample: Candidate[] = [];
  const staleIds = new Set<string>();

  for (const e of store.entries) {
    if (e.type === "channel" || e.platform !== "youtube") continue;
    youtubeStamped++;
    if (bucketOf(e) !== "youtube_short") continue;

    staleIds.add(e.id);
    const d = typeof e.durationSeconds === "number" ? e.durationSeconds : 0;
    if (d > LEGACY_SHORTS_MAX_SECONDS && d <= YT_SHORTS_MAX_SECONDS) band61to180++;
    else if (d > 0 && d <= LEGACY_SHORTS_MAX_SECONDS) legacyUnder60++;
    else formatShortOnly++;

    if (sample.length < 50) {
      sample.push({
        id:              e.id,
        name:            (e.name ?? "").slice(0, 80),
        channelName:     (e.channelName ?? "").slice(0, 40),
        durationSeconds: d,
        videoFormat:     e.videoFormat ?? "",
      });
    }
  }

  return {
    report: {
      totalScanned:   store.entries.length,
      youtubeStamped,
      staleShorts:    staleIds.size,
      band61to180,
      legacyUnder60,
      formatShortOnly,
      applied:        0,
      sample,
    },
    staleIds,
  };
}

// ─── GET — dry-run report ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const store = readStore();
  if (!store) {
    return NextResponse.json({ ok: false, reason: "store_not_readable" });
  }
  const { report } = scan(store);
  return NextResponse.json({ ok: true, applied: false, report });
}

// ─── POST — apply relabel ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: { action?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 }); }

  if (body.action !== "apply") {
    return NextResponse.json({
      ok: false, reason: "action_must_be_apply",
      hint: `POST body must be { "action": "apply" }. Use GET for a dry-run report.`,
    }, { status: 400 });
  }

  const store = readStore();
  if (!store) {
    return NextResponse.json({ ok: false, reason: "store_not_readable" });
  }

  const { report, staleIds } = scan(store);

  if (staleIds.size === 0) {
    return NextResponse.json({ ok: true, applied: true, report, message: "No entries required relabeling." });
  }

  const updated: ReferenceEntry[] = store.entries.map(e =>
    staleIds.has(e.id) && e.platform === "youtube" && e.type !== "channel"
      ? { ...e, platform: "youtube_short" as const, videoFormat: "short" as const, orientation: "vertical" as const }
      : e,
  );

  const newStore: ReferenceStore = {
    version:     store.version,
    lastUpdated: new Date().toISOString(),
    entries:     updated,
  };

  try {
    writeStore(newStore);
  } catch (e) {
    return NextResponse.json({
      ok: false, reason: "write_failed",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }

  report.applied = staleIds.size;
  return NextResponse.json({ ok: true, applied: true, report });
}
