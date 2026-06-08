// /api/x/comments?tweetId=<id>&authorHandle=<handle>[&max=20]
//
// Fetches public replies to an X (Twitter) post via Apify's
// apidojo/tweet-scraper actor, using Twitter's native `conversation_id:<id>`
// advanced-search filter to return the reply thread. We exclude replies
// from the original author so the sentiment sample reflects audience
// reaction, not the creator's self-replies in a thread.
//
// Output shape matches /api/youtube/comments: { ok, comments: string[] }.
//
// Circumvents the "no X API v2 access" caveat — these are public replies
// the same set any logged-out visitor would see on the post page.

import { NextRequest, NextResponse } from "next/server";
import { getApifyToken } from "@/lib/apify-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min cache — X moves faster than YT/TT/IG

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID   = "apidojo~tweet-scraper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tweetId     = searchParams.get("tweetId");
    const authorRaw   = searchParams.get("authorHandle") ?? "";
    const max         = Math.min(100, Math.max(1, parseInt(searchParams.get("max") ?? "20", 10)));

    if (!tweetId || !/^\d+$/.test(tweetId)) {
      return NextResponse.json({ ok: false, error: "valid numeric tweetId required" }, { status: 400 });
    }

    // Strip leading @ and any URL fragments, keep the raw screen_name.
    // Validate against Twitter's handle format (alphanumerics + underscore,
    // 1-15 chars) before interpolating into the Twitter advanced-search
    // query — prevents query injection via crafted URL params like
    // "from:someone_else" or quoted strings.
    const candidate = authorRaw.replace(/^@/, "").split(/[\/\s?]/)[0];
    const authorHandle = /^[A-Za-z0-9_]{1,15}$/.test(candidate) ? candidate : "";

    const token = getApifyToken("x");
    if (!token) {
      return NextResponse.json({ ok: false, reason: "no_api_key" });
    }

    // Twitter advanced-search syntax — conversation_id pins replies to this
    // tweet's thread; -from:<author> filters out the creator's own replies.
    const searchTerm = authorHandle
      ? `conversation_id:${tweetId} -from:${authorHandle}`
      : `conversation_id:${tweetId}`;

    const input = {
      searchTerms: [searchTerm],
      maxItems:    max,
      sort:        "Top",    // engagement-ranked reply surface
      tweetLanguage: "en",
    };

    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=60&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        // X moves faster than TT/IG so force-cache would be even staler.
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
    if (!Array.isArray(items)) {
      return NextResponse.json({ ok: true, comments: [] });
    }

    const comments: string[] = items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => {
        const t = it?.full_text ?? it?.text ?? it?.tweet ?? "";
        return typeof t === "string" ? t : "";
      })
      .filter((t: string) => t.length > 0 && t.length < 1000)  // drop novels
      .map((t: string) => t.replace(/https?:\/\/\S+/g, "").trim()) // strip URLs
      .filter((t: string) => t.length > 2)
      .slice(0, max);

    return NextResponse.json({ ok: true, comments });
  } catch (e) {
    console.error("[api/x/comments]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
