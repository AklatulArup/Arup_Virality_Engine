/**
 * POST /api/x/scrape
 * Body: { url?: string, handle?: string, limit?: number }
 *
 * Scrapes X (Twitter) posts via Apify's twitter-scraper actor.
 * Returns normalised XPostData[] for the analysis pipeline.
 *
 * API KEY NEEDED: Set APIFY_TOKEN in Vercel env vars.
 * Same Apify account already used for TikTok/Instagram scraping.
 * Apify free tier: $5 credit/month (~1,000-2,000 post scrapes).
 * Actor: apidojo/tweet-scraper (most reliable X scraper on Apify)
 *
 * X signal weights from open-source algorithm (github.com/twitter/the-algorithm):
 *   Reply that gets author reply back: +75 (150× a like)
 *   Quote tweet:                       +25 (50× a like)
 *   Reply:                             +13.5 (27× a like)
 *   Profile click → follow:            +12
 *   Bookmark:                          +10 (20× a like)
 *   Retweet:                           +1 (2× a like)
 *   Like:                              +0.5 (baseline)
 *   External link click:               −75 (NEGATIVE — put links in replies)
 */

import { NextRequest } from "next/server";

import type { XPostData } from "@/lib/types";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID   = "apidojo~tweet-scraper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(item: any): XPostData {
  const views     = item.viewCount || item.views || 0;
  const likes     = item.likeCount || item.favorites || 0;
  const reposts   = item.retweetCount || item.retweets || 0;
  const replies   = item.replyCount || item.replies || 0;
  const quotes    = item.quoteCount || item.quotes || 0;
  const bookmarks = item.bookmarkCount || item.bookmarks || 0;

  const text: string = item.full_text || item.text || item.tweet || "";
  const hashtags: string[] = (item.entities?.hashtags || []).map(
    (h: { text?: string } | string) => typeof h === "string" ? h : (h.text || "")
  ).filter(Boolean);

  // X open-source algorithm weights (confirmed from github.com/twitter/the-algorithm)
  // Normalised per 1000 views for comparable scoring
  const v = Math.max(1, views);
  const engScore =
    (replies   / v * 1000 * 27) +  // replies: 27× a like
    (quotes    / v * 1000 * 50) +  // quote tweets: 50× a like
    (bookmarks / v * 1000 * 20) +  // bookmarks: 20× a like
    (reposts   / v * 1000 * 2)  +  // reposts: 2× a like
    (likes     / v * 1000 * 1);    // likes: baseline

  const publishedAt = item.createdAt || item.created_at || new Date().toISOString();

  return {
    id:              String(item.id || item.tweetId || `x-${Date.now()}`),
    text:            text.slice(0, 500),
    authorHandle:    item.author?.userName || item.user?.screen_name || item.username || "unknown",
    authorName:      item.author?.name || item.user?.name || "Unknown",
    authorFollowers: item.author?.followers || item.user?.followers_count || 0,
    authorVerified:  item.author?.isVerified || item.user?.verified || false,
    views,
    likes,
    reposts,
    replies,
    quotes,
    bookmarks,
    publishedAt,
    hasVideo:        !!(item.entities?.media?.some((m: {type:string}) => m.type === "video") || item.attachments?.media_keys?.length),
    hasImage:        !!(item.entities?.media?.some((m: {type:string}) => m.type === "photo")),
    hasLink:         !!(item.entities?.urls?.length > 0),
    hashtags,
    isThread:        item.inReplyToStatusId != null && item.author?.userName === item.inReplyToUser?.userName,
    threadPosition:  1,
    platform:        "x",
    url:             item.url || `https://x.com/${item.author?.userName || "i"}/status/${item.id}`,
    engagementScore: parseFloat(engScore.toFixed(2)),
    replyRate:       parseFloat((replies    / v * 100).toFixed(3)),
    bookmarkRate:    parseFloat((bookmarks  / v * 100).toFixed(3)),
    repostRate:      parseFloat((reposts    / v * 100).toFixed(3)),
    quoteRate:       parseFloat((quotes     / v * 100).toFixed(3)),
  };
}

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_TOKEN_TWITTER || process.env.APIFY_TOKEN_TWITTER_2 || process.env.APIFY_TOKEN || process.env.TikTok_API_Key;
  if (!token) {
    return Response.json({
      error: "No Apify token found. Set APIFY_TOKEN_TWITTER (or APIFY_TOKEN) in Vercel env vars.",
    }, { status: 500 });
  }

  const body = await request.json();
  const { url, handle, limit = 20 } = body as {
    url?: string;
    handle?: string;
    limit?: number;
  };

  // Build Apify actor input
  let actorInput: Record<string, unknown>;
  if (url && (url.includes("/status/") || url.includes("x.com") || url.includes("twitter.com"))) {
    actorInput = { startUrls: [{ url }], maxItems: 1 };
  } else if (handle) {
    const h = handle.replace(/^@/, "");
    actorInput = {
      startUrls: [{ url: `https://x.com/${h}` }],
      maxItems: limit,
      tweetsDesired: limit,
    };
  } else {
    return Response.json({ error: "Provide an X post URL or handle" }, { status: 400 });
  }

  // Run Apify actor synchronously (waits for result)
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=60&memory=256`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    }
  );

  if (!runRes.ok) {
    const err = await runRes.text();
    return Response.json({ error: `Apify error: ${err.slice(0, 200)}` }, { status: 502 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = await runRes.json();
  if (!Array.isArray(raw) || raw.length === 0) {
    return Response.json({ error: "No posts found. The account may be private or the URL is invalid." }, { status: 404 });
  }

  const posts = raw.map(mapPost).filter(p => p.views > 0 || p.likes > 0);
  posts.sort((a, b) => b.engagementScore - a.engagementScore);

  return Response.json({ posts });
}
