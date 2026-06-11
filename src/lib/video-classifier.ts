/**
 * Video Format Classifier
 *
 * YouTube Shorts classification rules (official):
 * 1. Duration ≤ 3 minutes — YouTube raised the Shorts limit from 60s to
 *    180s in Oct 2024, and the bulk of 61-180s uploads on creator channels
 *    are vertical Shorts (the upload flow auto-classifies them)
 * 2. Vertical aspect ratio (9:16) — not exposed via Data API, so duration
 *    is the only reliable signal we have; 61-180s horizontal long-form is
 *    the accepted false-positive tradeoff
 * 3. #Shorts hashtag in title/description/tags is a strong signal
 *
 * TikTok: All content is "short" by nature (≤10 min), but we classify:
 * - ≤ 60s = "short"
 * - > 60s = "full" (TikTok long-form)
 *
 * Our heuristic (without aspect ratio data):
 * - YouTube: ≤ 180s = Short, > 180s = Full-length
 * - Other platforms: ≤ 60s = Short, ≤ 180s + #Shorts signal = Short
 * - No duration data → check tags/title for #Shorts signal
 */

import type { VideoFormat, VideoOrientation, SentimentLabel } from "./types";

// YouTube Shorts duration ceiling (seconds). 180s since Oct 2024 (was 60s).
// Single source of truth for every Shorts-vs-long-form duration split:
// sibling reclassification in the analyze pipeline, channel pool writes,
// and pool-stats bucketing all import this.
export const YT_SHORTS_MAX_SECONDS = 180;

// True when a duration is known (> 0) and within the YouTube Shorts limit.
// Unknown durations (0 / undefined) return false — they stay long-form.
export function isYouTubeShortDuration(durationSeconds?: number): boolean {
  const d = durationSeconds ?? 0;
  return d > 0 && d <= YT_SHORTS_MAX_SECONDS;
}

const SHORTS_PATTERNS = [
  /\b#?shorts?\b/i,
  /\byt\s?shorts?\b/i,
  /\byoutube\s?shorts?\b/i,
];

function hasShortsSignal(title: string, tags?: string[], description?: string): boolean {
  const text = [title, description || "", ...(tags || [])].join(" ");
  return SHORTS_PATTERNS.some((p) => p.test(text));
}

export function classifyVideoFormat(
  durationSeconds?: number,
  title?: string,
  tags?: string[],
  description?: string,
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram" | "x"
): VideoFormat {
  const shortsSignal = hasShortsSignal(title || "", tags, description);

  // If we have duration data
  if (durationSeconds !== undefined && durationSeconds > 0) {
    // YouTube (and unspecified platform, which defaults YouTube-like):
    // anything within the 3-minute Shorts limit is a Short
    const isYouTube = platform === undefined || platform === "youtube" || platform === "youtube_short";
    if (isYouTube && durationSeconds <= YT_SHORTS_MAX_SECONDS) return "short";

    // Other platforms (TikTok / IG / X): ≤ 60s is "short", longer is "full"
    if (durationSeconds <= 60) return "short";

    // Shorts-tagged crossposts on other platforms within the expanded limit
    if (durationSeconds <= YT_SHORTS_MAX_SECONDS && shortsSignal) return "short";

    return "full";
  }

  // No duration — fall back to signal detection
  if (shortsSignal) return "short";

  // Default to full for YouTube, short for TikTok
  return platform === "tiktok" ? "short" : "full";
}

export function classifyOrientation(
  durationSeconds?: number,
  title?: string,
  tags?: string[],
  description?: string,
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram" | "x"
): VideoOrientation {
  // TikTok is always vertical
  if (platform === "tiktok") return "vertical";

  // Shorts are vertical
  const format = classifyVideoFormat(durationSeconds, title, tags, description, platform);
  if (format === "short") return "vertical";

  // Full-length YouTube is typically horizontal, but we can't be 100% certain
  // without aspect ratio data, so we mark it as horizontal (the vast majority)
  if (format === "full") return "horizontal";

  return "unknown";
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Quick title/tag-based sentiment for reference pool entries.
 * Uses the same rule-based approach as the main sentiment lib.
 */
const POSITIVE_WORDS = [
  "profit", "funded", "passed", "success", "winning", "win", "payout",
  "amazing", "best", "incredible", "easy", "love", "great", "awesome",
  "legit", "real", "honest", "guaranteed", "millionaire", "rich",
  "changed my life", "life changing", "how i made", "secret",
];
const NEGATIVE_WORDS = [
  "scam", "fraud", "fake", "lost", "failed", "fail", "worst", "avoid",
  "warning", "beware", "exposed", "terrible", "horrible", "broke",
  "bankrupt", "rigged", "manipulation", "stolen", "never", "don't",
  "waste", "overrated", "disappointed", "refund",
];

export function quickSentiment(text: string): { label: SentimentLabel; score: number } {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) score += 1;
  }
  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) score -= 1;
  }

  // Normalize to -1..1 range
  const normalized = Math.max(-1, Math.min(1, score / 3));
  const label: SentimentLabel = normalized > 0.15 ? "positive" : normalized < -0.15 ? "negative" : "neutral";

  return { label, score: normalized };
}
