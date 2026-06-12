// GET /api/forecast/vol-history?from=YYYY-MM-DD&days=7
// Returns the daily market-volatility readings the collect-outcomes cron
// snapshots to KV (vol-history:YYYY-MM-DD). Powers the "Market week" bucket
// of the breakout autopsy. Days without a logged reading are simply absent —
// the log only exists from 2026-06-11 forward.

import { NextRequest } from "next/server";
import { kvGet, isKvAvailable } from "@/lib/kv";

export const runtime = "nodejs";

interface VolRecord {
  day: string;
  level?: string;
  multiplier?: number;
  newsCount?: number;
  topKeywords?: string[];
}

export async function GET(request: NextRequest) {
  if (!isKvAvailable()) {
    return Response.json({ ok: false, days: [], reason: "kv_not_configured" });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const count = Math.min(31, Math.max(1, Number(searchParams.get("days") ?? 7)));

  const start = from ? new Date(`${from}T00:00:00Z`) : null;
  if (!start || !Number.isFinite(start.getTime())) {
    return Response.json({ ok: false, days: [], reason: "bad_from" }, { status: 400 });
  }

  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  }

  const rows = await Promise.all(keys.map((day) => kvGet<VolRecord>(`vol-history:${day}`)));
  const days = rows.filter((r): r is VolRecord => !!r);

  return Response.json({ ok: true, days });
}
