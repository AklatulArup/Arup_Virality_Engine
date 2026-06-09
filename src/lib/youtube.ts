import type { VideoData, ChannelData } from "./types";
import { youtubeFetchJson } from "./youtube-keys";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function parseDuration(iso: string): { formatted: string; seconds: number } {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return { formatted: "0:00", seconds: 0 };
  const h = parseInt(m[1] || "0");
  const mi = parseInt(m[2] || "0");
  const sc = parseInt(m[3] || "0");
  const seconds = h * 3600 + mi * 60 + sc;
  const formatted =
    h > 0
      ? `${h}:${String(mi).padStart(2, "0")}:${String(sc).padStart(2, "0")}`
      : `${mi}:${String(sc).padStart(2, "0")}`;
  return { formatted, seconds };
}

export async function fetchVideo(id: string): Promise<VideoData | null> {
  const data = await youtubeFetchJson(
    (key) => `${API_BASE}/videos?part=snippet,statistics,contentDetails&id=${id}&key=${key}`
  );
  checkApiError(data);
  if (!data.items?.length) return null;

  const item = data.items[0];
  const { formatted, seconds } = parseDuration(
    item.contentDetails.duration || ""
  );

  return {
    id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    views: parseInt(item.statistics.viewCount || "0"),
    likes: parseInt(item.statistics.likeCount || "0"),
    comments: parseInt(item.statistics.commentCount || "0"),
    publishedAt: item.snippet.publishedAt,
    duration: formatted,
    durationSeconds: seconds,
    thumbnail:
      item.snippet.thumbnails?.maxres?.url ||
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      "",
    tags: item.snippet.tags || [],
    description: item.snippet.description || "",
  };
}

function checkApiError(data: Record<string, unknown>): void {
  if (data.error) {
    const err = data.error as { message?: string; errors?: { reason?: string }[] };
    const msg = err.errors?.[0]?.reason === "quotaExceeded"
      ? "YouTube API quota exceeded — resets at midnight Pacific Time. Create a new API key in Google Cloud Console or wait for reset."
      : err.message || "YouTube API error";
    throw new Error(msg);
  }
}

export async function fetchChannel(id: string): Promise<ChannelData | null> {
  const data = await youtubeFetchJson(
    (key) => `${API_BASE}/channels?part=statistics,snippet,contentDetails&id=${id}&key=${key}`
  );
  checkApiError(data);
  if (!data.items?.length) return null;

  const item = data.items[0];
  return {
    id: item.id,
    name: item.snippet.title,
    subs: parseInt(item.statistics.subscriberCount || "0"),
    totalViews: parseInt(item.statistics.viewCount || "0"),
    videoCount: parseInt(item.statistics.videoCount || "0"),
    uploads: item.contentDetails?.relatedPlaylists?.uploads || null,
    avatar: item.snippet.thumbnails?.medium?.url || "",
  };
}

export async function fetchByHandle(
  handle: string
): Promise<ChannelData | null> {
  const data = await youtubeFetchJson(
    (key) => `${API_BASE}/channels?part=statistics,snippet,contentDetails&forHandle=${handle}&key=${key}`
  );
  checkApiError(data);
  if (!data.items?.length) return null;

  const item = data.items[0];
  return {
    id: item.id,
    name: item.snippet.title,
    subs: parseInt(item.statistics.subscriberCount || "0"),
    totalViews: parseInt(item.statistics.viewCount || "0"),
    videoCount: parseInt(item.statistics.videoCount || "0"),
    uploads: item.contentDetails?.relatedPlaylists?.uploads || null,
    avatar: item.snippet.thumbnails?.medium?.url || "",
  };
}

export async function fetchPlaylistVideos(
  playlistId: string,
  max: number = 20
): Promise<VideoData[]> {
  // Cap a single-page request at 50 (YouTube API limit)
  const pageSize = Math.min(max, 50);
  const data = await youtubeFetchJson(
    (key) => `${API_BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${pageSize}&key=${key}`
  );
  checkApiError(data);
  if (!data.items?.length) return [];

  const ids = data.items
    .map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId)
    .join(",");

  const vData = await youtubeFetchJson(
    (key) => `${API_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids}&key=${key}`
  );
  checkApiError(vData);

  return (vData.items || []).map(
    (item: {
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        channelId: string;
        publishedAt: string;
        thumbnails: Record<string, { url: string }>;
        tags?: string[];
        description?: string;
      };
      statistics: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails: { duration?: string };
    }) => {
      const { formatted, seconds } = parseDuration(
        item.contentDetails.duration || ""
      );
      return {
        id: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        views: parseInt(item.statistics.viewCount || "0"),
        likes: parseInt(item.statistics.likeCount || "0"),
        comments: parseInt(item.statistics.commentCount || "0"),
        publishedAt: item.snippet.publishedAt,
        duration: formatted,
        durationSeconds: seconds,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.high?.url ||
          "",
        tags: item.snippet.tags || [],
        description: item.snippet.description || "",
      };
    }
  );
}

/**
 * Fetch a creator's full (or partial) discography by paging through their uploads playlist.
 * Returns up to `max` videos. Uses one playlistItems request per 50 videos plus one
 * batched videos request per 50 IDs. Quota cost ~ 2 units per 50 videos.
 */
export async function fetchFullDiscography(
  uploadsPlaylistId: string,
  max: number = 200
): Promise<VideoData[]> {
  const collected: VideoData[] = [];
  let pageToken: string | undefined = undefined;

  while (collected.length < max) {
    const remaining = max - collected.length;
    const pageSize = Math.min(50, remaining);
    const pageData = await youtubeFetchJson((key) => {
      const url = new URL(`${API_BASE}/playlistItems`);
      url.searchParams.set("part", "contentDetails");
      url.searchParams.set("playlistId", uploadsPlaylistId);
      url.searchParams.set("maxResults", String(pageSize));
      url.searchParams.set("key", key);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      return url.toString();
    });
    checkApiError(pageData);
    if (!pageData.items?.length) break;

    const ids = pageData.items
      .map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId)
      .join(",");

    const vData = await youtubeFetchJson(
      (key) => `${API_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids}&key=${key}`
    );
    checkApiError(vData);

    for (const item of vData.items || []) {
      const { formatted, seconds } = parseDuration(item.contentDetails?.duration || "");
      collected.push({
        id: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        views: parseInt(item.statistics?.viewCount || "0"),
        likes: parseInt(item.statistics?.likeCount || "0"),
        comments: parseInt(item.statistics?.commentCount || "0"),
        publishedAt: item.snippet.publishedAt,
        duration: formatted,
        durationSeconds: seconds,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.high?.url ||
          "",
        tags: item.snippet.tags || [],
        description: item.snippet.description || "",
      });
    }

    pageToken = pageData.nextPageToken;
    if (!pageToken) break;
  }

  return collected;
}
