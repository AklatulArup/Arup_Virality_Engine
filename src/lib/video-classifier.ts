/**
 * Video Format Classifier
 *
 * YouTube Shorts classification rules (official):
 * 1. Duration ≤ 60 seconds (primary rule)
 * 2. Vertical aspect ratio (9:16) — not exposed via Data API
 * 3. #Shorts hashtag in title/description/tags is a strong signal
 *
 * YouTube recently expanded Shorts to 3 minutes for some creators,
 * but the Data API still treats ≤60s + vertical as the core definition.
 *
 * TikTok: All content is "short" by nature (≤10 min), but we classify:
 * - ≤ 60s = "short"
 * - > 60s = "full" (TikTok long-form)
 *
 * Our heuristic (without aspect ratio data):
 * - ≤ 60s = Short
 * - ≤ 180s + has #Shorts signal = Short (expanded Shorts)
 * - > 60s without Shorts signal = Full-length
 * - No duration data → check tags/title for #Shorts signal
 */

import type { VideoFormat, VideoOrientation, SentimentLabel } from "./types";

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
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram"
): VideoFormat {
  const shortsSignal = hasShortsSignal(title || "", tags, description);

  // If we have duration data
  if (durationSeconds !== undefined && durationSeconds > 0) {
    // Classic Shorts: ≤ 60 seconds
    if (durationSeconds <= 60) return "short";

    // Expanded Shorts: ≤ 180 seconds with #Shorts signal
    if (durationSeconds <= 180 && shortsSignal) return "short";

    // TikTok: anything ≤ 60s is "short", longer is "full"
    if (platform === "tiktok" && durationSeconds <= 60) return "short";

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
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram"
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
