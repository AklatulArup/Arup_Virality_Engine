// /api/forecast/prior-correction
//
// GET  — return the current day-0 prior-correction table (per-platform factors
//        that undo the cold-start under-prediction). null until bootstrapped.
// POST — { action: "recompute" }  refit from graded snapshots (kept only if it
//                                 produces factors — see recomputePriorCorrection).
//        { action: "clear"     }  wipe → forecasts use no correction.
//
// Table lives in KV at `config:prior-correction`. The bootstrap is seeded by
// scripts/bootstrap-prior-correction.ts; the nightly collect-outcomes cron
// refits from real grades and supersedes the bootstrap once enough land.

import { NextRequest, NextResponse } from "next/server";
import { kvSet, isKvAvailable } from "@/lib/kv";
import {
  loadPriorCorrection,
  recomputePriorCorrection,
  PRIOR_CORRECTION_KV_KEY,
} from "@/lib/prior-correction";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured", table: null });
  }
  const table = await loadPriorCorrection();
  return NextResponse.json({ ok: true, table });
}

export async function POST(req: NextRequest) {
  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" });
  }

  let body: { action?: "recompute" | "clear" } = {};
  try { body = await req.json(); } catch { /* empty body = recompute */ }
  const action = body.action ?? "recompute";

  try {
    if (action === "clear") {
      await kvSet(PRIOR_CORRECTION_KV_KEY, null);
      return NextResponse.json({ ok: true, cleared: true });
    }
    if (action === "recompute") {
      const table = await recomputePriorCorrection();
      return NextResponse.json({ ok: true, table });
    }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[api/forecast/prior-correction] POST error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
