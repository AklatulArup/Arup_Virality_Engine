/**
 * POST /api/tiktok/scrape
 * Body: { url?: string, handle?: string, limit?: number }
 * Calls Apify clockworks/tiktok-scraper via REST API and returns
 * normalised TikTokVideoData[] for the existing analysis pipeline.
 */
import type { TikTokVideoData } from "@/lib/types";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "clockworks~tiktok-scraper";

function buildInput(url: string | null, handle: string | null, limit: number) {
  if (url && url.includes("/video/")) {
    return { postURLs: [url], resultsPerPage: limit };
  }
  const h = handle || (url ? url.replace(/^@/, "") : null);
  if (h) {
    return {
      profiles: [h.replace(/^@/, "")],
      resultsPerPage: limit,
    };
  }
  throw new Error("Provide a TikTok URL or handle");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(item: any): TikTokVideoData {
  const durationSec = item.videoMeta?.duration || item.duration || 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationStr = `${mins}:${String(secs).padStart(2, "0")}`;

  const hashtags: string[] = (item.hashtags || []).map(
    (h: { name?: string } | string) => (typeof h === "string" ? h : h.name || "")
  ).filter(Boolean);

  const createTime = item.createTime || item.createTimeISO;
  const publishedAt = createTime
    ? typeof createTime === "number"
      ? new Date(createTime * 1000).toISOString()
      : new Date(createTime).toISOString()
    : new Date().toISOString();

  return {
    id: String(item.id || item.videoId || `tt-${Date.now()}`),
    title: (item.text || item.desc || item.caption || "").slice(0, 200) || "TikTok video",
    channel: item.authorMeta?.name || item.author?.uniqueId || item.authorUniqueId || "Unknown",
    channelId: item.authorMeta?.id || item.authorMeta?.name || "unknown",
    views: item.playCount || item.statsV2?.playCount || item.stats?.playCount || 0,
    likes: item.diggCount || item.statsV2?.diggCount || item.stats?.diggCount || 0,
    comments: item.commentCount || item.statsV2?.commentCount || item.stats?.commentCount || 0,
    shares: item.shareCount || item.statsV2?.shareCount || item.stats?.shareCount || 0,
    saves: item.collectCount || item.statsV2?.collectCount || 0,
    publishedAt,
    duration: durationStr,
    durationSeconds: durationSec,
    thumbnail: item.videoMeta?.coverUrl || item.covers?.default || "",
    tags: hashtags,
    description: item.text || item.desc || "",
    platform: "tiktok",
    hashtags,
    soundName: item.musicMeta?.musicName || item.music?.title || "",
    soundOriginal: item.musicMeta?.musicOriginal ?? false,
    creatorHandle: item.authorMeta?.name || "",
    creatorFollowers: item.authorMeta?.fans || item.authorStats?.followerCount || 0,
  };
}

export async function POST(request: Request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { url, handle, limit = 30 } = body as {
    url?: string;
    handle?: string;
    limit?: number;
  };

  let input: object;
  try {
    input = buildInput(url || null, handle || null, Math.min(limit, 100));
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
    const videos: TikTokVideoData[] = items.map(mapItem).filter((v) => v.views > 0 || v.title);

    return Response.json({ success: true, videos, count: videos.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
