// /api/admin/migrate-ig-tiktok
//
// One-shot migration for entries that landed in the reference pool with
// platform:"tiktok" when they were actually Instagram content. Caused by a
// bug in /api/csv-import that coerced both `tiktok` AND `instagram` into
// `storePlatform: "tiktok"` before writing (now fixed).
//
// Detection heuristic (2+ signals = confident):
//   - id matches IG shortcode shape (11 chars, alphanumeric + - / _)
//   - id is NOT a TikTok numeric ID (15-20 digits, all numeric)
//   - entry has no sound/music metadata (TT entries always do)
//   - tags lack TT-specific markers (#fyp, #foryou, #fypシ)
//
// USAGE:
//   GET                               → dry-run report, no writes
//   POST { action: "apply" }          → relabel confident candidates
//
// Auth: requires `x-cron-secret` header matching env CRON_SECRET. Refuses
// entirely if CRON_SECRET isn't set. Read-only dry-run AND write-apply
// both need auth because even dry-run could leak pool contents.

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { ReferenceStore, ReferenceEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORE_PATH = join(process.cwd(), "src/data/reference-store.json");

// IG shortcode shape: 11 chars, alphanumeric + `-` + `_`.
// TikTok IDs are 15-20 digits, all numeric.
const IG_SHORTCODE = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID    = /^\d{15,20}$/;

interface Candidate {
  id:          string;
  name:        string;
  channelName: string;
  signals:     string[];
}

interface MigrationReport {
  totalScanned:  number;
  tiktokEntries: number;
  flagged:       number;     // ≥ 1 signal
  confident:     number;     // ≥ 2 signals (will be applied)
  applied:       number;
  sample:        Candidate[];
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

function igSignals(e: ReferenceEntry): string[] {
  const signals: string[] = [];
  if (typeof e.id === "string" && IG_SHORTCODE.test(e.id)) signals.push("id_shortcode");
  if (typeof e.id === "string" && !TIKTOK_ID.test(e.id))   signals.push("id_not_numeric");
  const hasSoundName = typeof (e as unknown as { soundName?: string }).soundName === "string";
  if (!hasSoundName) signals.push("no_sound_meta");
  const tags = Array.isArray(e.tags) ? e.tags.map(t => String(t).toLowerCase()) : [];
  const hasTTMarker = tags.some(t => t === "fyp" || t === "foryou" || t === "fypシ");
  if (!hasTTMarker && tags.length > 0) signals.push("no_tt_hashtag");
  return signals;
}

function scan(store: ReferenceStore): { report: MigrationReport; confidentIds: Set<string> } {
  let tiktokEntries = 0;
  let flagged       = 0;
  let confident     = 0;
  const sample: Candidate[] = [];
  const confidentIds = new Set<string>();

  for (const e of store.entries) {
    if (e.platform !== "tiktok") continue;
    tiktokEntries++;
    const signals = igSignals(e);
    if (signals.length === 0) continue;
    flagged++;
    if (signals.length >= 2) {
      confident++;
      confidentIds.add(e.id);
    }
    if (sample.length < 50) {
      sample.push({
        id:          e.id,
        name:        (e.name ?? "").slice(0, 80),
        channelName: (e.channelName ?? "").slice(0, 40),
        signals,
      });
    }
  }

  return {
    report: {
      totalScanned: store.entries.length,
      tiktokEntries,
      flagged,
      confident,
      applied:      0,
      sample,
    },
    confidentIds,
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

  const { report, confidentIds } = scan(store);

  if (confidentIds.size === 0) {
    return NextResponse.json({ ok: true, applied: true, report, message: "No entries required relabeling." });
  }

  const updated: ReferenceEntry[] = store.entries.map(e =>
    confidentIds.has(e.id) && e.platform === "tiktok"
      ? { ...e, platform: "instagram" as const }
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

  report.applied = confidentIds.size;
  return NextResponse.json({ ok: true, applied: true, report });
}
