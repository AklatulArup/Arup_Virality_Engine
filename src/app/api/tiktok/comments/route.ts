// /api/tiktok/comments?url=<tiktok-url>[&max=20]
//
// Fetches public top comments for a TikTok post via Apify's
// clockworks/tiktok-comments-scraper actor. Output matches the shape
// /api/youtube/comments returns so the ForecastPanel sentiment pipeline
// is platform-agnostic: { ok: true, comments: string[] }.
//
// Circumvents the "no TikTok Research API" caveat — we scrape only
// publicly-visible comments, which is the same surface area TikTok's own
// web UI shows to any logged-out visitor.

import { NextRequest, NextResponse } from "next/server";
import { getApifyToken } from "@/lib/apify-token";

export const runtime = "nodejs";
// Reads `url` from request.url — must be dynamic.
export const dynamic = "force-dynamic";
export const revalidate = 3600; // cache 1h in the data-cache layer

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID   = "clockworks~tiktok-comments-scraper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const max = Math.min(100, Math.max(1, parseInt(searchParams.get("max") ?? "20", 10)));

    if (!url) {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }
    if (!/tiktok\.com\/.+\/video\//.test(url)) {
      return NextResponse.json({ ok: false, error: "not a TikTok video URL" }, { status: 400 });
    }

    const token = getApifyToken("tiktok");
    if (!token) {
      return NextResponse.json({ ok: false, reason: "no_api_key" });
    }

    const input = {
      postURLs:            [url],
      commentsPerPost:     max,
      maxRepliesPerComment: 0,
    };

    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=60&memory=512`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        // No force-cache: Apify actor runs are non-deterministic (comment
        // order, actor load) and caching the response by body hash would
        // freeze stale top-comment batches for an hour. `revalidate = 3600`
        // at module scope governs the data-cache layer instead.
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        reason: "apify_error",
        status: res.status,
        detail: detail.slice(0, 200),
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await res.json();
    const comments: string[] = items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => typeof it?.text === "string" ? it.text : (typeof it?.comment === "string" ? it.comment : ""))
      .filter((t: string) => typeof t === "string" && t.length > 0)
      .slice(0, max);

    return NextResponse.json({ ok: true, comments });
  } catch (e) {
    console.error("[api/tiktok/comments]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
