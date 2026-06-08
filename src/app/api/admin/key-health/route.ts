// /api/admin/key-health
//
// Live API-key health for the admin calibration page.
//   GET  → last cached report (no live calls — cheap, safe to poll).
//   POST { action: "run" } → run the live tests, but THROTTLED: if a report
//          was computed in the last 30s it's returned as-is instead of
//          re-running, so the button can't be spammed to burn provider quota.
//
// Each live run makes ~16 tiny calls (one per configured key). Values are
// never returned — only var names, HTTP status, and a verdict.

import { NextRequest, NextResponse } from "next/server";
import { checkAllKeys, type KeyHealthReport } from "@/lib/key-health";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KV_KEY = "key-health:report";
const THROTTLE_MS = 30_000;

export async function GET() {
  const cached = await kvGet<KeyHealthReport>(KV_KEY).catch(() => null);
  return NextResponse.json({ ok: true, report: cached ?? null, cached: !!cached });
}

export async function POST(req: NextRequest) {
  let action = "";
  try {
    const body = await req.json();
    action = typeof body?.action === "string" ? body.action : "";
  } catch { /* default below */ }

  if (action !== "run") {
    return NextResponse.json({ ok: false, error: "unknown action — use 'run'" }, { status: 400 });
  }

  // Throttle: reuse a fresh cached report rather than re-running the live calls.
  const cached = await kvGet<KeyHealthReport>(KV_KEY).catch(() => null);
  if (cached?.checkedAt) {
    const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
    if (ageMs >= 0 && ageMs < THROTTLE_MS) {
      return NextResponse.json({ ok: true, report: cached, cached: true, throttled: true });
    }
  }

  const report = await checkAllKeys();
  await kvSet(KV_KEY, report, 3600).catch(() => {});   // 1h TTL
  return NextResponse.json({ ok: true, report, cached: false });
}
