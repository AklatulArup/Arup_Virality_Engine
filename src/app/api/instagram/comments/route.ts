// /api/instagram/comments?url=<ig-url>[&max=20]
//
// Fetches public top comments on an Instagram Reel / post via Apify's
// apify/instagram-comment-scraper. Mirrors /api/youtube/comments output
// shape ({ ok, comments[] }) so the ForecastPanel sentiment fetch is
// platform-agnostic.
//
// Circumvents the "no Meta Graph API approval" caveat — we scrape only
// publicly-visible comments (the same set any logged-out visitor sees).

import { NextRequest, NextResponse } from "next/server";
import { getApifyToken } from "@/lib/apify-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID   = "apify~instagram-comment-scraper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const max = Math.min(100, Math.max(1, parseInt(searchParams.get("max") ?? "20", 10)));

    if (!url) {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }
    if (!/instagram\.com\/(p|reel|reels)\//.test(url)) {
      return NextResponse.json({ ok: false, error: "not an Instagram post URL" }, { status: 400 });
    }

    const token = getApifyToken("instagram");
    if (!token) {
      return NextResponse.json({ ok: false, reason: "no_api_key" });
    }

    const input = {
      directUrls:   [url],
      resultsLimit: max,
    };

    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=60&memory=512`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        // See tiktok/comments route — force-cache on non-deterministic
        // Apify actor runs returns stale comment sets.
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
    console.error("[api/instagram/comments]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
