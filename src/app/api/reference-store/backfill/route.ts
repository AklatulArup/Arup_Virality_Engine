import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { ReferenceStore } from "@/lib/types";
import { classifyVideoFormat, classifyOrientation, formatDuration, quickSentiment } from "@/lib/video-classifier";
import { youtubeFetchJson, isYouTubeConfigured } from "@/lib/youtube-keys";

const STORE_PATH = join(process.cwd(), "src/data/reference-store.json");

function readStore(): ReferenceStore {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return { version: 1, lastUpdated: "", entries: [] };
  }
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
}

/**
 * POST /api/reference-store/backfill
 * Re-fetches video details from YouTube API for entries missing duration/format data,
 * then applies classification (format, orientation, sentiment).
 *
 * If no API key or quota is exhausted, falls back to heuristic-only classification
 * using title and tags.
 */
export async function POST() {
  const store = readStore();
  const videoEntries = store.entries.filter((e) => e.type === "video" && !e.durationSeconds);
  const alreadyClassified = store.entries.filter((e) => e.durationSeconds || e.type === "channel");

  let enrichedCount = 0;
  let heuristicCount = 0;

  // Try to fetch durations from YouTube API if key is available
  if (isYouTubeConfigured() && videoEntries.length > 0) {
    const ids = videoEntries.map((e) => e.id);
    const durationMap = new Map<string, { seconds: number; tags: string[]; description: string }>();

    // Batch fetch 50 at a time — rotates across all YOUTUBE_API_KEY* keys
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      try {
        const data = await youtubeFetchJson((key) => {
          const params = new URLSearchParams({
            part: "contentDetails,snippet",
            id: batch.join(","),
            key,
          });
          return `https://www.googleapis.com/youtube/v3/videos?${params}`;
        });
        // All keys exhausted / error — fall through to heuristic classification
        if (data.error) break;
        for (const item of (data.items || [])) {
          durationMap.set(item.id, {
            seconds: parseDuration(item.contentDetails?.duration || "PT0S"),
            tags: item.snippet?.tags || [],
            description: (item.snippet?.description || "").slice(0, 500),
          });
        }
      } catch {
        break;
      }
    }

    // Apply fetched data
    for (const entry of videoEntries) {
      const fetched = durationMap.get(entry.id);
      if (fetched) {
        entry.durationSeconds = fetched.seconds;
        entry.duration = formatDuration(fetched.seconds);
        entry.description = entry.description || fetched.description;
        if (!entry.tags || entry.tags.length === 0) {
          entry.tags = fetched.tags.slice(0, 20);
        }
        entry.videoFormat = classifyVideoFormat(fetched.seconds, entry.name, entry.tags, entry.description, entry.platform);
        entry.orientation = classifyOrientation(fetched.seconds, entry.name, entry.tags, entry.description, entry.platform);
        const { label, score } = quickSentiment([entry.name, ...(entry.tags || []).slice(0, 10)].join(" "));
        entry.sentiment = label;
        entry.sentimentScore = score;
        enrichedCount++;
      }
    }
  }

  // Heuristic-only classification for entries still missing format
  for (const entry of store.entries) {
    if (entry.type === "channel") continue;
    if (!entry.videoFormat) {
      entry.videoFormat = classifyVideoFormat(entry.durationSeconds, entry.name, entry.tags, entry.description, entry.platform);
      entry.orientation = classifyOrientation(entry.durationSeconds, entry.name, entry.tags, entry.description, entry.platform);
      heuristicCount++;
    }
    if (!entry.sentiment) {
      const { label, score } = quickSentiment([entry.name, ...(entry.tags || []).slice(0, 10)].join(" "));
      entry.sentiment = label;
      entry.sentimentScore = score;
    }
  }

  store.lastUpdated = new Date().toISOString();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");

  return NextResponse.json({
    success: true,
    total: store.entries.length,
    enrichedFromAPI: enrichedCount,
    heuristicOnly: heuristicCount,
    alreadyHadDuration: alreadyClassified.length,
  });
}
