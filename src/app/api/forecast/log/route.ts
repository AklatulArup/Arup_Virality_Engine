// /api/forecast/log
//
// Manually-recorded predictions by the RM. Separate from the automatic
// snapshot system (which records every analysis) — this is curated, the RM
// is saying "I'm committing to this prediction for accountability."
//
// GET  — list all logged predictions (most recent first)
// POST — record a new prediction
// DELETE /api/forecast/log?id=<id> — remove a logged entry

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvListPush, kvListRange, isKvAvailable, kvDelete } from "@/lib/kv";

export const runtime = "nodejs";

export interface ForecastLogEntry {
  id:             string;   // unique — timestamp + random
  recordedAt:     string;   // ISO — when the RM logged this
  analyzedAt:     string;   // ISO — when the engine produced the forecast
  targetDate:     string;   // YYYY-MM-DD — date the prediction is for
  videoId?:       string;
  videoUrl?:      string;
  videoTitle?:    string;
  platform:       string;
  creatorHandle?: string;
  lowViews:       number;
  expectedViews:  number;
  highViews:      number;
  currentViewsAtAnalysis?: number;
  notes?:         string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isKvAvailable()) {
      return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
    }

    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: ForecastLogEntry = {
      id,
      recordedAt:     new Date().toISOString(),
      analyzedAt:     body.analyzedAt    ?? new Date().toISOString(),
      targetDate:     body.targetDate    ?? "",
      videoId:        body.videoId,
      videoUrl:       body.videoUrl,
      videoTitle:     body.videoTitle,
      platform:       body.platform      ?? "unknown",
      creatorHandle:  body.creatorHandle,
      lowViews:       Number(body.lowViews)      || 0,
      expectedViews:  Number(body.expectedViews) || 0,
      highViews:      Number(body.highViews)     || 0,
      currentViewsAtAnalysis: body.currentViewsAtAnalysis !== undefined ? Number(body.currentViewsAtAnalysis) : undefined,
      notes:          body.notes,
    };

    await kvSet(`forecast-log:${id}`, entry);
    await kvListPush("forecast-log:all", id);

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    console.error("[api/forecast/log] POST error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!isKvAvailable()) {
      return NextResponse.json({ ok: false, reason: "kv_not_configured", entries: [] });
    }

    const ids = await kvListRange("forecast-log:all", 0, -1);
    const entries = await Promise.all(ids.map((id) => kvGet<ForecastLogEntry>(`forecast-log:${id}`)));
    const valid = entries.filter((e): e is ForecastLogEntry => e !== null);

    // Most recent first
    valid.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    return NextResponse.json({ ok: true, entries: valid });
  } catch (e) {
    console.error("[api/forecast/log] GET error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    if (!isKvAvailable()) {
      return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
    }

    await kvDelete(`forecast-log:${id}`);
    // Note: we don't remove from the list index; kvGet will return null and
    // GET's filter drops it. Cleanup happens automatically on next list rebuild.

    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    console.error("[api/forecast/log] DELETE error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
