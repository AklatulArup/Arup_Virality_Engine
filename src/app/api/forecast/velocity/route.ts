// /api/forecast/velocity?videoId=...
//
// Returns the velocity time series for a specific video from the tracker cron.
// Used by the forecast engine client-side to detect early acceleration/deceleration.

import { NextRequest, NextResponse } from "next/server";
import { kvListRange, isKvAvailable } from "@/lib/kv";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) return NextResponse.json({ ok: false, error: "videoId required" }, { status: 400 });
  if (!isKvAvailable()) return NextResponse.json({ ok: false, reason: "kv_not_configured", samples: [] });

  const raw = await kvListRange(`velocity:${videoId}`, 0, -1);
  const samples = raw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  return NextResponse.json({ ok: true, samples });
}
