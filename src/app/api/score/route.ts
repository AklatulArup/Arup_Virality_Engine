// /api/score — the integrated brain: engine data in, skill contract out.
//
// POST: the Video Report sends the subject's raw fields + creator analytics;
// the server joins the KV velocity track (wave snapshots), applies the synced
// skill knowledge, and returns the Phase-4 prediction contract. Every scored
// contract is persisted with its component vector so the §4 calibration job
// can join it against matured outcomes later.

import { NextRequest, NextResponse } from "next/server";
import type { ManualInputs, Platform } from "@/lib/forecast";
import { kvGet, kvSet, kvSetAdd, kvListRange, isKvAvailable } from "@/lib/kv";
import { scoreContent, componentVector, type CalibrationRecord } from "@/lib/scoring/score";
import { toCanonical, type AdapterInput } from "@/lib/scoring/adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PLATFORMS = new Set(["tiktok", "instagram", "youtube", "youtube_short", "x"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const platform = String(body?.platform ?? "");
    const contentId = String(body?.contentId ?? "");
    if (!PLATFORMS.has(platform) || !contentId) {
      return NextResponse.json({ ok: false, error: "platform + contentId required" }, { status: 400 });
    }

    // Wave snapshots from the hourly tracker.
    let velocity: Array<{ ageHours: number; views: number }> = [];
    if (isKvAvailable()) {
      const raw = await kvListRange(`velocity:${contentId}`, 0, -1);
      velocity = raw
        .map((s) => {
          try {
            const v = JSON.parse(s) as { ageHours?: number; views?: number };
            return typeof v.ageHours === "number" && typeof v.views === "number" ? { ageHours: v.ageHours, views: v.views } : null;
          } catch {
            return null;
          }
        })
        .filter((v): v is { ageHours: number; views: number } => v !== null);
    }

    const input: AdapterInput = {
      platform: platform as Platform,
      contentId,
      views: Number(body.views) || 0,
      likes: Number(body.likes) || 0,
      comments: Number(body.comments) || 0,
      shares: body.shares != null ? Number(body.shares) : null,
      saves: body.saves != null ? Number(body.saves) : null,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : null,
      creatorFollowers: body.creatorFollowers != null ? Number(body.creatorFollowers) : null,
      manualInputs: (body.manualInputs ?? {}) as ManualInputs,
      aiEstimatedKeys: Array.isArray(body.aiEstimatedKeys) ? body.aiEstimatedKeys : [],
      velocity,
      region: typeof body.region === "string" ? body.region : null,
      xRaw: body.xRaw ?? null,
    };

    const calibration = isKvAvailable() ? await kvGet<CalibrationRecord>("skill-calibration:current") : null;
    const contract = scoreContent(input, calibration ?? null, Date.now());

    // Persist for the calibration dataset (contract + components + prior).
    if (isKvAvailable()) {
      const record = {
        contract,
        components: componentVector(toCanonical(input)),
        priorProb: contract.virality_probability,
        videoId: contentId,
        baselineMedian: body.baselineMedian != null ? Number(body.baselineMedian) : null,
        scoredAt: contract.scored_at,
      };
      await kvSet(`skill-score:${contentId}`, record);
      await kvSetAdd("skill-score:ids", contentId);
    }

    return NextResponse.json({ ok: true, contract });
  } catch (e) {
    console.error("[api/score]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
