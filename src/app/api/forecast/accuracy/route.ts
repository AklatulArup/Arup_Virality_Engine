// /api/forecast/accuracy
//
// GET — return the backtest accuracy report (per-platform typical-miss
//       before/after the day-0 correction + range hit rate), or null if the
//       calibration scripts haven't populated it yet. Read-only; written by
//       scripts/bootstrap-prior-correction.ts and scripts/bootstrap-conformal.ts.

import { NextResponse } from "next/server";
import { isKvAvailable } from "@/lib/kv";
import { loadAccuracyReport } from "@/lib/accuracy-report";

export const runtime = "nodejs";

export async function GET() {
  if (!isKvAvailable()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured", report: null });
  }
  const report = await loadAccuracyReport();
  return NextResponse.json({ ok: true, report });
}
