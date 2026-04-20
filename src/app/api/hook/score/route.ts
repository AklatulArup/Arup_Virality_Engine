// /api/hook/score
//
// GET ?url=<cover-url>&caption=<caption>&platform=<tiktok|instagram>
//   → { ok, score, cached }
//
// Scores a short-form video's stop-scroll strength (first-frame + caption)
// against the 5 hook formulas + 2 craft dimensions. Returns a hook score
// plus per-platform estimated retention (TikTok completion %, IG 3-sec
// hold %). KV-cached by (url|captionHash|platform) so repeat forecasts of
// the same video don't pay for a new Gemini Vision call.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { kvGet, kvSet, isKvAvailable } from "@/lib/kv";
import { scoreHookStrength, type HookScore } from "@/lib/hook-strength-predictor";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES     = 6 * 1024 * 1024;
const CACHE_PREFIX  = "hook-strength:";
const MAX_CAPTION_LENGTH = 800;

interface CachedScore {
  computedAt: string;
  score:      HookScore;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get("url");
  const platform = searchParams.get("platform");
  const caption  = (searchParams.get("caption") ?? "").slice(0, MAX_CAPTION_LENGTH);

  if (!url) {
    return NextResponse.json({ ok: false, reason: "url_required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, reason: "url_must_be_http" }, { status: 400 });
  }
  if (platform !== "tiktok" && platform !== "instagram") {
    return NextResponse.json({ ok: false, reason: "platform_must_be_tiktok_or_instagram" }, { status: 400 });
  }

  // Cache key includes caption hash — same cover + different caption = different score.
  const keyMaterial = `${url}|${platform}|${createHash("sha1").update(caption).digest("hex")}`;
  const cacheKey = CACHE_PREFIX + createHash("sha1").update(keyMaterial).digest("hex");

  if (isKvAvailable()) {
    const cached = await kvGet<CachedScore>(cacheKey);
    if (cached?.score) {
      return NextResponse.json({ ok: true, score: cached.score, cached: true, computedAt: cached.computedAt });
    }
  }

  // Fetch cover image
  let imgRes: Response;
  try {
    imgRes = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: "image_fetch_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  if (!imgRes.ok) {
    return NextResponse.json({ ok: false, reason: "image_fetch_status", status: imgRes.status }, { status: 502 });
  }

  const mimeType = imgRes.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ ok: false, reason: "not_an_image", mimeType }, { status: 400 });
  }

  const buffer = await imgRes.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "image_too_large", bytes: buffer.byteLength }, { status: 413 });
  }
  const imageBase64 = Buffer.from(buffer).toString("base64");

  const result = await scoreHookStrength({ imageBase64, mimeType, caption, platform });
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  if (isKvAvailable()) {
    const toCache: CachedScore = { computedAt: new Date().toISOString(), score: result.score };
    await kvSet(cacheKey, toCache);
  }

  return NextResponse.json({ ok: true, score: result.score, cached: false });
}
