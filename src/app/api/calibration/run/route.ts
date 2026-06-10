// /api/calibration/run — algorithm-math.md §4 on the engine's own history.
//
// GET  → current adopted calibration record + the last run's report.
// POST → assemble the dataset (persisted skill-score contracts joined with
//        matured outcomes from the snapshot store), run the §4 protocol,
//        store the report; adopt new weights ONLY when the backtest beats the
//        frozen ones. Weight provenance appends to skill-calibration:history.

import { NextResponse } from "next/server";
import { kvGet, kvSet, kvSetMembers, kvListRange, kvListPush, isKvAvailable } from "@/lib/kv";
import type { ForecastSnapshot } from "@/lib/forecast-learning";
import { runCalibration, toCalibrationRecord, type CalibrationInputRecord } from "@/lib/scoring/calibrate";
import type { PredictionContract } from "@/lib/scoring/canon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIRAL_MULTIPLE_DEFAULT = 10;
const MIN_LIFE_DAYS = 30;

interface StoredScore {
  contract: PredictionContract;
  components: Record<string, number>;
  priorProb: number | null;
  videoId: string;
  baselineMedian: number | null;
  scoredAt: string;
}

export async function GET() {
  if (!isKvAvailable()) return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
  const current = await kvGet("skill-calibration:current");
  const lastReport = await kvGet("skill-calibration:last-report");
  return NextResponse.json({ ok: true, current: current ?? null, lastReport: lastReport ?? null });
}

export async function POST(req: Request) {
  try {
    if (!isKvAvailable()) return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const multiple = Number(body?.viralMultiple) > 0 ? Number(body.viralMultiple) : VIRAL_MULTIPLE_DEFAULT;

    // Snapshot outcomes by videoId (latest actual + baseline + publish date).
    const snapIds = await kvListRange("snapshots:all", 0, -1);
    const outcomes = new Map<string, { actual: number; baseline: number; publishedAt: string | null }>();
    for (const id of snapIds) {
      const snap = await kvGet<ForecastSnapshot>(`snapshot:${id}`);
      if (!snap) continue;
      const latest = snap.outcomes[snap.outcomes.length - 1];
      if (!latest || !(latest.actualViews > 0)) continue;
      const prev = outcomes.get(snap.videoId);
      if (!prev || latest.actualViews > prev.actual) {
        outcomes.set(snap.videoId, {
          actual: latest.actualViews,
          baseline: snap.baselineMedian,
          publishedAt: snap.publishedAt ?? null,
        });
      }
    }

    // Join with persisted skill scores; require ≥30 days of life.
    const scoreIds = await kvSetMembers("skill-score:ids");
    const records: CalibrationInputRecord[] = [];
    const now = Date.now();
    for (const id of scoreIds) {
      const s = await kvGet<StoredScore>(`skill-score:${id}`);
      if (!s || s.priorProb == null) continue;
      const o = outcomes.get(s.videoId);
      if (!o) continue;
      const lifeDays = o.publishedAt ? (now - new Date(o.publishedAt).getTime()) / 86_400_000 : 0;
      if (lifeDays < MIN_LIFE_DAYS) continue;
      const baseline = s.baselineMedian ?? o.baseline;
      if (!(baseline > 0)) continue;
      records.push({
        contentId: id,
        scoredAt: s.scoredAt,
        components: s.components,
        priorProb: s.priorProb,
        label: o.actual > multiple * baseline ? 1 : 0,
      });
    }

    const report = runCalibration(records);
    const ranAt = new Date().toISOString();
    await kvSet("skill-calibration:last-report", { ...report, ranAt, viralMultiple: multiple });

    if (report.adopted) {
      const record = toCalibrationRecord(report, ranAt);
      await kvSet("skill-calibration:current", record);
      await kvListPush(
        "skill-calibration:history",
        JSON.stringify({ event: "adopted", at: ranAt, brier: report.brierCandidate, beatFrozen: report.brierFrozen, sampleSize: report.sampleSize, beta: report.beta }),
      );
    } else {
      await kvListPush(
        "skill-calibration:history",
        JSON.stringify({ event: "rejected", at: ranAt, brier: report.brierCandidate, frozen: report.brierFrozen, sampleSize: report.sampleSize, notes: report.notes }),
      );
    }

    return NextResponse.json({ ok: true, report: { ...report, ranAt, viralMultiple: multiple } });
  } catch (e) {
    console.error("[api/calibration/run]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
