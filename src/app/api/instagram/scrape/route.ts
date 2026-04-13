/**
 * POST /api/instagram/scrape
 * Body: { urls?: string[], handle?: string, limit?: number }
 * Calls Apify apify/instagram-scraper and returns normalised VideoData[]
 */
import type { VideoData } from "@/lib/types";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";

function buildInput(urls: string[], handle: string | null, limit: number) {
  if (urls.length > 0) {
    return {
      directUrls: urls,
      resultsType: "posts",
      resultsLimit: limit,
    };
  }
  if (handle) {
    return {
      usernames: [handle.replace(/^@/, "")],
      resultsType: "posts",
      resultsLimit: limit,
    };
  }
  throw new Error("Provide Instagram URLs or a handle");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(item: any): VideoData | null {
  const views = item.videoViewCount || item.videoPlayCount || item.playCount || 0;
  // Skip non-video posts if no views at all
  const likes = item.likesCount || item.likeCount || 0;
  const comments = item.commentsCount || item.commentCount || 0;

  if (!item.id && !item.shortCode) return null;

  const durationSec = item.videoDuration || item.duration || 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  const publishedAt = item.timestamp || item.takenAt || item.createdAt || new Date().toISOString();

  const hashtags: string[] = [];
  const captionText: string = item.caption || item.text || "";
  const tagMatches = captionText.match(/#[a-zA-Z0-9_]+/g) || [];
  tagMatches.forEach((t) => hashtags.push(t.slice(1)));

  return {
    id: item.shortCode || item.id || `ig-${Date.now()}`,
    title: captionText.slice(0, 200) || "Instagram Reel",
    channel: item.ownerUsername || item.username || "Unknown",
    channelId: item.ownerId || item.ownerUsername || "unknown",
    views: views || likes * 20, // fallback estimate if no view count
    likes,
    comments,
    publishedAt: typeof publishedAt === "number"
      ? new Date(publishedAt * 1000).toISOString()
      : new Date(publishedAt).toISOString(),
    duration: durationSec > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : "0:30",
    thumbnail: item.displayUrl || item.thumbnailUrl || "",
    tags: hashtags,
    description: captionText,
    platform: "instagram" as unknown as "youtube", // stored as custom platform
  } as VideoData & { platform: string };
}

export async function POST(request: Request) {
  const token = process.env.APIFY_TOKEN || process.env.Instagram_API_Key || process.env.INSTAGRAM_API_KEY;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { urls = [], handle, limit = 30 } = body as {
    urls?: string[];
    handle?: string;
    limit?: number;
  };

  let input: object;
  try {
    input = buildInput(urls, handle || null, Math.min(limit, 100));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=90&memory=512`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Apify error: ${res.status} — ${err}` }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await res.json();
    const videos = items.map(mapItem).filter(Boolean);

    return Response.json({ success: true, videos, count: videos.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
