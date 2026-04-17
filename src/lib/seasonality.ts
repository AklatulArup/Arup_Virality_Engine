// ═══════════════════════════════════════════════════════════════════════════
// SEASONALITY ENGINE
// ═══════════════════════════════════════════════════════════════════════════
//
// Two forms of seasonality affect trading-content performance:
//
//   1. WEEKLY CYCLE — creator-specific patterns. Some creators peak on Sunday
//      evenings (weekend prep), others on Monday mornings (market open). The
//      same video can 2-3x itself depending on posting day.
//
//   2. MARKET VOLATILITY — when the market is moving, engagement on trading
//      content spikes. Fed decisions, CPI releases, Brexit-style shocks all
//      double or triple baseline reach for trading creators specifically.
//
// This module computes:
//   - dayOfWeekMultiplier(): the creator's historical performance on the day
//     the video was posted relative to their overall median
//   - marketVolatilityMultiplier(): a live signal based on recent finance news
//     volume and keyword intensity
//
// Both multipliers are clamped to the range [0.6, 1.8] to prevent a noisy
// sample from swinging the forecast wildly. The forecast engine applies these
// to the score multiplier as a single combined "seasonality" factor.

import type { VideoData } from "./types";

// ─── DAY OF WEEK ──────────────────────────────────────────────────────────

export interface DayOfWeekProfile {
  // One multiplier per day index (0 = Sunday, 6 = Saturday)
  multipliers: [number, number, number, number, number, number, number];
  sampleSizes: [number, number, number, number, number, number, number];
  postedDay:   number;        // day the forecast video was posted on
  multiplier:  number;        // multiplier for that specific day
  confidence:  "high" | "medium" | "low";
  rationale:   string;
}

export function computeDayOfWeekProfile(
  video: { publishedAt?: string },
  creatorHistory: VideoData[],
): DayOfWeekProfile | null {
  // Group history views by day-of-week
  const byDay: number[][] = [[], [], [], [], [], [], []];
  for (const v of creatorHistory) {
    if (!v.publishedAt || typeof v.views !== "number") continue;
    const d = new Date(v.publishedAt);
    if (isNaN(d.getTime())) continue;
    byDay[d.getDay()].push(v.views);
  }

  const totalCount = byDay.reduce((s, arr) => s + arr.length, 0);
  if (totalCount < 10) return null;   // need at least 10 posts for reliable DoW patterns

  const globalMedian = median(byDay.flat());
  if (globalMedian === 0) return null;

  const multipliers = byDay.map((dayViews) => {
    if (dayViews.length < 2) return 1.0;
    const m = median(dayViews) / globalMedian;
    return Math.max(0.6, Math.min(1.8, m));   // clamp
  }) as DayOfWeekProfile["multipliers"];

  const sampleSizes = byDay.map((d) => d.length) as DayOfWeekProfile["sampleSizes"];

  const videoDate = video.publishedAt ? new Date(video.publishedAt) : new Date();
  const postedDay = videoDate.getDay();
  const multiplier = multipliers[postedDay];
  const sampleSize = sampleSizes[postedDay];

  const confidence: DayOfWeekProfile["confidence"] =
    sampleSize >= 5 ? "high" :
    sampleSize >= 3 ? "medium" :
                      "low";

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const direction = multiplier > 1.15 ? "outperforms" : multiplier < 0.85 ? "underperforms" : "matches";
  const rationale = `On ${dayNames[postedDay]}, this creator ${direction} their overall median by ${((multiplier - 1) * 100).toFixed(0)}% (n=${sampleSize}).`;

  return { multipliers, sampleSizes, postedDay, multiplier, confidence, rationale };
}

// ─── MARKET VOLATILITY ────────────────────────────────────────────────────

export interface MarketVolatilityProfile {
  multiplier:    number;     // final seasonality multiplier from market conditions
  volatilityLevel: "low" | "normal" | "elevated" | "high";
  topKeywords:   string[];   // volatility-related keywords that triggered
  newsCount:     number;
  rationale:     string;
}

const VOLATILITY_KEYWORDS = [
  "fed", "rate cut", "rate hike", "inflation", "cpi", "jobs report", "nfp",
  "recession", "crash", "rally", "bear market", "bull market", "volatility",
  "vix spike", "earnings", "fomc", "powell", "ecb", "boe",
  "black swan", "liquidation", "selloff", "breakout", "all-time high",
  "crypto", "bitcoin", "btc", "eth", "forex", "dxy",
];

export async function fetchMarketVolatility(baseUrl?: string): Promise<MarketVolatilityProfile> {
  const base = baseUrl ?? (typeof window !== "undefined" ? "" : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""));
  const defaultProfile: MarketVolatilityProfile = {
    multiplier: 1.0,
    volatilityLevel: "normal",
    topKeywords: [],
    newsCount: 0,
    rationale: "No market volatility signal detected (default conditions).",
  };

  try {
    const r = await fetch(`${base}/api/news?category=business&max=20`, { cache: "no-store" });
    if (!r.ok) return defaultProfile;
    const data = await r.json();
    const articles: Array<{ title?: string; description?: string; publishedAt?: string }> =
      data.articles ?? [];

    if (articles.length === 0) return defaultProfile;

    // Count volatility keyword mentions in titles + descriptions (last 48h only)
    const cutoff = Date.now() - 48 * 3_600_000;
    let keywordHits = 0;
    const hitMap: Record<string, number> = {};

    for (const art of articles) {
      const age = art.publishedAt ? new Date(art.publishedAt).getTime() : Date.now();
      if (age < cutoff) continue;
      const text = `${art.title ?? ""} ${art.description ?? ""}`.toLowerCase();
      for (const kw of VOLATILITY_KEYWORDS) {
        if (text.includes(kw)) {
          keywordHits++;
          hitMap[kw] = (hitMap[kw] ?? 0) + 1;
        }
      }
    }

    const topKeywords = Object.entries(hitMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    // Keyword density → volatility level → multiplier
    const density = keywordHits / Math.max(1, articles.length);
    let level: MarketVolatilityProfile["volatilityLevel"];
    let multiplier: number;

    if (density >= 3.0)      { level = "high";     multiplier = 1.5; }
    else if (density >= 1.5) { level = "elevated"; multiplier = 1.25; }
    else if (density >= 0.5) { level = "normal";   multiplier = 1.0; }
    else                     { level = "low";      multiplier = 0.9; }

    const rationale = level === "high"     ? `High market volatility detected (${keywordHits} volatility keywords across ${articles.length} recent finance articles). Trading content tends to perform 30-60% above baseline in these windows.` :
                      level === "elevated" ? `Elevated market activity (${keywordHits} volatility keywords in recent news). Expect modest distribution boost.` :
                      level === "low"      ? "Quiet market — trading content baseline slightly suppressed." :
                                             "Normal market conditions.";

    return { multiplier, volatilityLevel: level, topKeywords, newsCount: articles.length, rationale };
  } catch (e) {
    console.warn("[seasonality] failed to fetch market volatility:", e);
    return defaultProfile;
  }
}

// ─── COMBINED ─────────────────────────────────────────────────────────────

export interface SeasonalityInput {
  dayOfWeek?:         DayOfWeekProfile | null;
  marketVolatility?:  MarketVolatilityProfile | null;
}

// Combine day-of-week and market into one multiplier.
// Both default to 1.0; when both present, they multiply.
export function combineSeasonality(seasonality: SeasonalityInput): {
  multiplier: number;
  rationales: string[];
} {
  const rationales: string[] = [];
  let mult = 1.0;

  if (seasonality.dayOfWeek && seasonality.dayOfWeek.confidence !== "low") {
    mult *= seasonality.dayOfWeek.multiplier;
    rationales.push(seasonality.dayOfWeek.rationale);
  }

  if (seasonality.marketVolatility && seasonality.marketVolatility.volatilityLevel !== "normal") {
    mult *= seasonality.marketVolatility.multiplier;
    rationales.push(seasonality.marketVolatility.rationale);
  }

  // Clamp combined
  mult = Math.max(0.5, Math.min(2.2, mult));

  return { multiplier: mult, rationales };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
