// Canonical public URL for a video, rebuilt from its platform + id (+ handle).
//
// Forecast snapshots are judged later by re-scraping the video, which needs a
// URL. VideoData carries no url field, so snapshots were saved without one and
// the outcome / velocity crons skipped every video. This rebuilds the URL the
// scrapers accept. Returns null when the id is synthetic (e.g. "tt-<ts>",
// "tiktok-12" from CSV import) or the platform has no scraper (Facebook).

import type { Platform } from "./forecast";

const YT_ID = /^[\w-]{11}$/;
const NUMERIC = /^\d{5,}$/;
const IG_SHORTCODE = /^[\w-]{5,}$/;

export function canonicalVideoUrl(platform: Platform, videoId: string, handle?: string | null): string | null {
  const id = videoId?.trim();
  if (!id) return null;
  const h = handle?.trim().replace(/^@/, "");
  switch (platform) {
    case "youtube":
      return YT_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
    case "youtube_short":
      return YT_ID.test(id) ? `https://www.youtube.com/shorts/${id}` : null;
    case "tiktok":
      return NUMERIC.test(id) && h && h !== "Unknown" ? `https://www.tiktok.com/@${h}/video/${id}` : null;
    case "instagram":
      return IG_SHORTCODE.test(id) && !NUMERIC.test(id) && !id.startsWith("ig-") ? `https://www.instagram.com/reel/${id}/` : null;
    case "x":
      return NUMERIC.test(id) ? `https://x.com/i/status/${id}` : null;
    default:
      return null;
  }
}
