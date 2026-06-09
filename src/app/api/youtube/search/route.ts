import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { classifyVideoFormat, classifyOrientation, formatDuration, quickSentiment } from "@/lib/video-classifier";
import { youtubeFetchJson, isYouTubeConfigured } from "@/lib/youtube-keys";
import type { Blocklist } from "@/lib/types";

const BLOCKLIST_PATH = join(process.cwd(), "src/data/blocklist.json");

function readBlocklist(): Blocklist {
  try {
    return JSON.parse(readFileSync(BLOCKLIST_PATH, "utf-8"));
  } catch {
    return { version: 1, lastUpdated: "", channels: [], creators: [] };
  }
}

interface SearchResult {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
}

interface VideoDetail {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  tags: string[];
  description: string;
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
}

// Search YouTube for videos matching a query
async function searchVideos(
  query: string,
  maxResults: number = 50,
  language?: string,
  pageToken?: string
): Promise<{ results: SearchResult[]; nextPageToken?: string }> {
  const data = await youtubeFetchJson((key) => {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(maxResults, 50)),
      order: "relevance",
      key,
    });
    if (language) params.set("relevanceLanguage", language);
    if (pageToken) params.set("pageToken", pageToken);
    return `https://www.googleapis.com/youtube/v3/search?${params}`;
  });
  if (data.error) {
    throw new Error(data.error.message || "YouTube search failed");
  }

  const results: SearchResult[] = (data.items || []).map(
    (item: { id: { videoId: string }; snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; thumbnails: { high?: { url: string }; medium?: { url: string } } } }) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
    })
  );

  return { results, nextPageToken: data.nextPageToken };
}

// Fetch full details for a batch of video IDs
async function fetchVideoDetails(ids: string[]): Promise<VideoDetail[]> {
  if (ids.length === 0) return [];

  const data = await youtubeFetchJson((key) => {
    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: ids.join(","),
      key,
    });
    return `https://www.googleapis.com/youtube/v3/videos?${params}`;
  });
  if (data.error) return [];

  return (data.items || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => ({
      id: item.id,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      views: parseInt(item.statistics?.viewCount || "0"),
      likes: parseInt(item.statistics?.likeCount || "0"),
      comments: parseInt(item.statistics?.commentCount || "0"),
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails?.duration || "PT0S",
      durationSeconds: parseDuration(item.contentDetails?.duration || "PT0S"),
      thumbnail: item.snippet.thumbnails?.maxresdefault?.url ||
        item.snippet.thumbnails?.high?.url || "",
      tags: item.snippet.tags || [],
      description: (item.snippet.description || "").slice(0, 1000),
    })
  );
}

// POST: Search and fetch videos, return for reference pool addition
export async function POST(req: NextRequest) {
  if (!isYouTubeConfigured()) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  try {
    const { queries, languages, maxPerQuery } = await req.json();

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: "queries array required" }, { status: 400 });
    }

    const langs: string[] = languages || ["en"];
    const limit = Math.min(maxPerQuery || 50, 50);

    const allVideoIds = new Set<string>();
    const allSearchResults: SearchResult[] = [];
    let quotaExhausted = false;

    // Search each query in each language — process ALL queries (up to 100)
    for (const query of queries.slice(0, 100)) {
      if (quotaExhausted) break;
      for (const lang of langs.slice(0, 15)) {
        if (quotaExhausted) break;
        try {
          const { results } = await searchVideos(query, limit, lang);
          for (const r of results) {
            if (!allVideoIds.has(r.videoId)) {
              allVideoIds.add(r.videoId);
              allSearchResults.push(r);
            }
          }
        } catch (e) {
          // Stop on quota errors, continue on other failures
          if (e instanceof Error && e.message.toLowerCase().includes("quota")) {
            quotaExhausted = true;
          }
        }
      }
    }

    // Batch fetch video details (50 IDs per call)
    const allDetails: VideoDetail[] = [];
    const idArray = [...allVideoIds];
    for (let i = 0; i < idArray.length; i += 50) {
      const batch = idArray.slice(i, i + 50);
      const details = await fetchVideoDetails(batch);
      allDetails.push(...details);
    }

    // Filter out blocklisted channels/creators
    const blocklist = readBlocklist();
    const channelSet = new Set(blocklist.channels);
    const creatorSet = new Set(blocklist.creators);
    const filteredDetails = allDetails.filter((v) => {
      if (channelSet.has(v.channelId)) return false;
      if (creatorSet.has(v.channel.toLowerCase())) return false;
      return true;
    });
    const blockedCount = allDetails.length - filteredDetails.length;

    // Build reference entries with classification
    const entries = filteredDetails.map((v) => {
      const videoFormat = classifyVideoFormat(v.durationSeconds, v.title, v.tags, v.description, "youtube");
      const orientation = classifyOrientation(v.durationSeconds, v.title, v.tags, v.description, "youtube");
      const sentimentText = [v.title, ...(v.tags || []).slice(0, 10)].join(" ");
      const { label: sentiment, score: sentimentScore } = quickSentiment(sentimentText);
      return {
        id: v.id,
        type: "video" as const,
        platform: "youtube" as const,
        name: v.title,
        channelId: v.channelId,
        channelName: v.channel,
        analyzedAt: v.publishedAt,
        metrics: {
          views: v.views,
          engagement: v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0,
          vrsScore: undefined,
        },
        tags: v.tags.slice(0, 20),
        durationSeconds: v.durationSeconds,
        duration: formatDuration(v.durationSeconds),
        videoFormat,
        orientation,
        sentiment,
        sentimentScore,
        description: v.description,
      };
    });

    return NextResponse.json({
      searched: queries.length * langs.length,
      uniqueVideos: filteredDetails.length,
      blockedCount,
      entries,
      quotaExhausted,
      quotaCostEstimate: queries.length * langs.length * 100 + Math.ceil(allDetails.length / 50),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}

// GET: Quick search for a single keyword (for testing)
export async function GET(req: NextRequest) {
  if (!isYouTubeConfigured()) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") || "en";
  const max = parseInt(req.nextUrl.searchParams.get("max") || "10");

  try {
    const { results } = await searchVideos(q, max, lang);
    const details = await fetchVideoDetails(results.map((r) => r.videoId));
    return NextResponse.json({ videos: details, count: details.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}
