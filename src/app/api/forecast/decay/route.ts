// /api/forecast/decay
//
// GET  → current fitted decay-curve table (empirical cumulative-share per
//        platform), or { table: null } if never computed.
// POST { action: "recompute" } → rebuild from snapshots + velocity tracks.
// POST { action: "clear" }     → wipe; forecasts fall back to hand-tuned knots.
//
// The table is also recomputed automatically at the end of collect-outcomes
// whenever new outcomes land. Mirrors /api/forecast/conformal.

import { NextRequest, NextResponse } from "next/server";
import { loadDecayTable, recomputeDecayTable, clearDecayTable } from "@/lib/decay-fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const table = await loadDecayTable();
    return NextResponse.json({ ok: true, table });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "load failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let action = "";
  try {
    const body = await req.json();
    action = typeof body?.action === "string" ? body.action : "";
  } catch { /* no body → invalid action below */ }

  try {
    if (action === "recompute") {
      const table = await recomputeDecayTable(new Date().toISOString());
      const fittedPlatforms = Object.keys(table.byPlatform);
      return NextResponse.json({ ok: true, table, fittedPlatforms });
    }
    if (action === "clear") {
      await clearDecayTable();
      return NextResponse.json({ ok: true, cleared: true });
    }
    return NextResponse.json({ ok: false, error: "unknown action — use 'recompute' or 'clear'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "action failed" }, { status: 500 });
  }
}
