/**
 * Trend Intelligence Engine — 2026
 * 
 * Trend detection, lifecycle scoring, niche-to-mainstream pathway mapping,
 * and news/event multiplier calculation for view forecast accuracy.
 * 
 * Source: Social-sentiment-intelligence.md (trend sociology section),
 *         content-tactics-trends.md (trend detection method),
 *         platform-specific distribution timing research.
 */

// ─── TREND TYPES ──────────────────────────────────────────────────────────

export type TrendPhase =
  | "niche_signal"     // <500 videos, small communities only. High opportunity, high uncertainty.
  | "early_adoption"   // 500-5K videos. Niche creators have validated it. Low competition window.
  | "mainstream"       // 5K-50K videos. Mass adoption. High competition but huge audience.
  | "peak"             // 50K+ videos, branded content arriving. About to decline.
  | "declining"        // Past peak. Saturation or successor trend is live.
  | "evergreen";       // Stable permanent interest. Not trend-driven.

export type TrendCategory =
  | "news_event"       // Breaking news, market events, regulatory changes
  | "market_event"     // Specific market moves: crash, pump, NFP, CPI, FOMC
  | "challenge_format" // New content format going viral (Day N, etc.)
  | "platform_feature" // New platform feature (TikTok shop, YT Hype, etc.)
  | "cultural_moment"  // Broader cultural event relevant to finance/trading
  | "product_launch"   // New prop firm product, competitor launch
  | "seasonal"         // Recurring seasonal patterns (new year, Q1, etc.)
  | "evergreen";

export interface TrendSignal {
  keyword: string;
  category: TrendCategory;
  phase: TrendPhase;
  // 0-1: probability this signal becomes mainstream within 30 days
  mainstreamprobability: number;
  // Multiplier on estimated views if content hits in this window
  windowMultiplier: number;
  // How many hours remain in the opportunity window
  windowHoursRemaining: number;
  // Evidence strength
  confidence: "confirmed" | "likely" | "speculative";
  rationale: string;
  // Platform-specific amplification
  platformAmplification: {
    tiktok: number;      // recency bonus weight on TikTok
    instagram: number;
    youtube_short: number;
    youtube: number;     // news events matter less on LF (SEO > recency)
  };
}

export interface TrendIntelligence {
  // Detected trends relevant to this content
  detectedTrends: TrendSignal[];
  // Strongest active trend (if any)
  primaryTrend: TrendSignal | null;
  // Overall trend multiplier to apply to base view forecast
  forecastMultiplier: number;
  // Recency score: how well-timed is this content? 0-100
  recencyScore: number;
  // Content timing verdict
  timingVerdict: "perfect" | "good" | "neutral" | "late" | "too_early";
  timingRationale: string;
  // Recommended action
  urgency: "post_now" | "post_within_24h" | "wait_for_event" | "evergreen_anytime";
  urgencyRationale: string;
}

// ─── NICHE PATHWAY MAP ────────────────────────────────────────────────────
// Maps prop trading sub-niches to mainstream bridge pathways
// Source: growth-engineering.md + social-sentiment-intelligence.md trend sociology

export interface NichePathway {
  startNiche: string;
  bridges: {
    niche: string;
    bridgeHook: string;
    adoptionLag: string; // how long before niche users adopt the adjacent content
    platform: string;
  }[];
  mainstreamSignal: string; // what indicates this niche has reached mainstream
}

export const PROP_TRADING_NICHE_PATHWAYS: NichePathway[] = [
  {
    startNiche: "Prop Trading / Funded Accounts",
    bridges: [
      { niche: "Forex Trading", bridgeHook: "How funded accounts changed my forex approach", adoptionLag: "immediate", platform: "TikTok + YouTube" },
      { niche: "Day Trading", bridgeHook: "The one rule that makes day trading a funded challenge", adoptionLag: "1-2 weeks", platform: "TikTok + YouTube Shorts" },
      { niche: "Futures / CME", bridgeHook: "Why I trade futures over forex for my challenge", adoptionLag: "1-2 weeks", platform: "YouTube LF" },
    ],
    mainstreamSignal: "Branded content from non-trading accounts referencing 'funded trader'",
  },
  {
    startNiche: "Prop Trading",
    bridges: [
      { niche: "Side Income / Remote Work", bridgeHook: "The fastest path to professional trading income without a bank loan", adoptionLag: "2-4 weeks", platform: "TikTok + Instagram" },
      { niche: "Financial Freedom", bridgeHook: "How I replaced my salary without risking my own money", adoptionLag: "1-3 weeks", platform: "Instagram + YouTube" },
      { niche: "Personal Finance", bridgeHook: "The prop firm model: risk $50, earn $1,000/month", adoptionLag: "2-4 weeks", platform: "YouTube LF + Instagram" },
    ],
    mainstreamSignal: "Personal finance influencers covering prop firms",
  },
  {
    startNiche: "Prop Trading",
    bridges: [
      { niche: "Entrepreneurship", bridgeHook: "I built a trading business with someone else's capital", adoptionLag: "3-6 weeks", platform: "YouTube LF + LinkedIn" },
      { niche: "Making Money Online", bridgeHook: "Prop trading is the most legitimate 'make money from your laptop' business", adoptionLag: "2-4 weeks", platform: "TikTok + YouTube Shorts" },
    ],
    mainstreamSignal: "MrBeast-adjacent creators referencing prop trading",
  },
];

// ─── KEYWORD-BASED TREND DETECTION ───────────────────────────────────────
// Detects active or emerging trends from video title, tags, description

function detectTrendKeywords(
  title: string,
  tags: string[],
  description: string
): TrendSignal[] {
  const text = `${title} ${tags.join(" ")} ${description}`.toLowerCase();
  const signals: TrendSignal[] = [];

  // ── Market Event Triggers ────────────────────────────────────────────
  const marketEvents = [
    { pattern: /nfp|non-farm|payroll/, keyword: "NFP Non-Farm Payroll", category: "market_event" as TrendCategory },
    { pattern: /cpi|inflation|consumer price/, keyword: "CPI Inflation Data", category: "market_event" as TrendCategory },
    { pattern: /fomc|federal reserve|fed rate|interest rate/, keyword: "FOMC Fed Decision", category: "market_event" as TrendCategory },
    { pattern: /crash|market crash|black swan/, keyword: "Market Crash Event", category: "market_event" as TrendCategory },
    { pattern: /earnings|quarterly|revenue/, keyword: "Earnings Season", category: "market_event" as TrendCategory },
    { pattern: /bitcoin|btc|crypto|ethereum/, keyword: "Crypto Market Move", category: "market_event" as TrendCategory },
  ];

  for (const ev of marketEvents) {
    if (ev.pattern.test(text)) {
      signals.push({
        keyword: ev.keyword,
        category: ev.category,
        phase: "early_adoption",
        mainstreamprobability: 0.70,
        windowMultiplier: 3.5, // market events 3.5x baseline views if timed right
        windowHoursRemaining: 48,
        confidence: "confirmed",
        rationale: `${ev.keyword} content has a 48-hour window where it receives 3-5x normal distribution. TikTok's recency bonus is highest in first 2 hours. Post immediately.`,
        platformAmplification: {
          tiktok: 2.5,       // recency is a major FYP boost
          instagram: 1.8,
          youtube_short: 1.5, // less recency-dependent
          youtube: 1.2,       // search picks up the long tail instead
        },
      });
    }
  }

  // ── Challenge Format Trend Detection ─────────────────────────────────
  if (/day \d+|week \d+|(challenge|funded) (day|week|update)/.test(text)) {
    signals.push({
      keyword: "Day N Challenge Documentation",
      category: "challenge_format",
      phase: "mainstream",
      mainstreamprobability: 0.95, // already mainstream on all platforms
      windowMultiplier: 1.3,
      windowHoursRemaining: 9999, // always relevant
      confidence: "confirmed",
      rationale: "Day N challenge format is a proven evergreen structure across TikTok, YouTube Shorts, and Instagram. High completion rate due to series investment. 'Follow to see if I pass' is the strongest follow CTA that exists.",
      platformAmplification: {
        tiktok: 1.5, instagram: 1.3, youtube_short: 1.4, youtube: 1.2,
      },
    });
  }

  // ── Trending Audio/Format Signals ────────────────────────────────────
  if (/trending|viral|everyone.s|blowing up/.test(text)) {
    signals.push({
      keyword: "Trending Format Reference",
      category: "cultural_moment",
      phase: "early_adoption",
      mainstreamprobability: 0.50,
      windowMultiplier: 1.8,
      windowHoursRemaining: 72,
      confidence: "likely",
      rationale: "Content referencing a trending format or audio inherits some of that format's distribution. TikTok groups content by sound — using a trending audio gets 15-20% distribution boost when the audio is in its early-adoption phase.",
      platformAmplification: {
        tiktok: 1.8, instagram: 1.4, youtube_short: 1.1, youtube: 1.0,
      },
    });
  }

  // ── Prop Firm Specific Triggers ──────────────────────────────────────
  if (/new rule|rule change|updated|changed|2025|2026/.test(text) && /prop|challenge|firm|funded/.test(text)) {
    signals.push({
      keyword: "Prop Firm Rule Change",
      category: "product_launch",
      phase: "niche_signal",
      mainstreamprobability: 0.80,
      windowMultiplier: 2.2,
      windowHoursRemaining: 72,
      confidence: "confirmed",
      rationale: "Prop firm rule changes create immediate demand for explanation content. Traders actively search for clarity. First-mover gets the search traffic permanently — be first, be specific, cite the exact rule.",
      platformAmplification: {
        tiktok: 1.6, instagram: 1.5, youtube_short: 1.4, youtube: 2.5, // YT benefits most from search
      },
    });
  }

  // ── Seasonal Patterns ────────────────────────────────────────────────
  const month = new Date().getMonth(); // 0-11
  if (month === 0 || month === 11) { // Jan or Dec
    signals.push({
      keyword: "New Year Trading Resolution",
      category: "seasonal",
      phase: "peak",
      mainstreamprobability: 0.90,
      windowMultiplier: 1.6,
      windowHoursRemaining: month === 0 ? 336 : 168, // 2 weeks in Jan, 1 week in Dec
      confidence: "confirmed",
      rationale: "New Year creates the largest seasonal spike in trading content consumption. 'Start trading in 2026' searches spike 400% in January. Frame content as 'new year, new trading account.'",
      platformAmplification: {
        tiktok: 1.5, instagram: 1.4, youtube_short: 1.3, youtube: 1.7,
      },
    });
  }

  return signals;
}

// ─── TREND LIFECYCLE SCORING ──────────────────────────────────────────────
// Source: Trend Sociology section from social-sentiment-intelligence.md

function scoreTrendPhase(phase: TrendPhase): { multiplier: number; timing: TrendIntelligence["timingVerdict"] } {
  const map: Record<TrendPhase, { multiplier: number; timing: TrendIntelligence["timingVerdict"] }> = {
    niche_signal:   { multiplier: 2.5,  timing: "too_early" }, // High potential but uncertain
    early_adoption: { multiplier: 3.0,  timing: "perfect"   }, // Maximum opportunity window
    mainstream:     { multiplier: 1.5,  timing: "good"       }, // Good but competitive
    peak:           { multiplier: 1.1,  timing: "neutral"    }, // Crowded, about to decline
    declining:      { multiplier: 0.7,  timing: "late"       }, // Past window
    evergreen:      { multiplier: 1.0,  timing: "neutral"    }, // Stable, no timing advantage
  };
  return map[phase];
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────

export function analyzeTrends(
  title: string,
  tags: string[],
  description: string,
  publishedAt: string,
  platform: string
): TrendIntelligence {
  const detected = detectTrendKeywords(title, tags, description);

  if (detected.length === 0) {
    return {
      detectedTrends: [],
      primaryTrend: null,
      forecastMultiplier: 1.0,
      recencyScore: 50, // neutral for evergreen content
      timingVerdict: "neutral",
      timingRationale: "No active trend signals detected. Content will rely on organic algorithmic distribution without a recency boost. Evergreen content performs consistently but without spike potential.",
      urgency: "evergreen_anytime",
      urgencyRationale: "No time-sensitive window detected. Publish when the hook and production quality are maximised — timing is not the constraint here.",
    };
  }

  // Sort by multiplier strength
  const sorted = [...detected].sort((a, b) => b.windowMultiplier - a.windowMultiplier);
  const primary = sorted[0];

  // Get platform-specific amplification
  const platformAmp: Record<string, number> = {
    tiktok: primary.platformAmplification.tiktok,
    instagram: primary.platformAmplification.instagram,
    youtube_short: primary.platformAmplification.youtube_short,
    youtube: primary.platformAmplification.youtube,
  };
  const platformMultiplier = platformAmp[platform] ?? 1.0;

  // Recency decay from publish date
  const daysSincePublish = Math.max(0,
    (Date.now() - new Date(publishedAt).getTime()) / 86400000
  );
  const recencyDecay = Math.max(0.3, 1 - (daysSincePublish / 7) * 0.4);
  const { multiplier: phaseMultiplier, timing } = scoreTrendPhase(primary.phase);

  const forecastMultiplier = Math.min(5, phaseMultiplier * platformMultiplier * recencyDecay);
  const recencyScore = Math.round(timing === "perfect" ? recencyDecay * 100 : recencyDecay * 70);

  // Timing rationale
  const timingRationales: Record<TrendIntelligence["timingVerdict"], string> = {
    perfect:    `Optimal window: ${primary.keyword} is in early-adoption phase. Maximum distribution advantage. Every hour of delay costs reach — post within 2 hours for maximum recency bonus.`,
    good:       `Good timing: ${primary.keyword} is mainstream but not yet saturated. High competition but large audience pool. Strong production quality is the differentiator now.`,
    neutral:    `Neutral timing: ${primary.keyword} is at peak/evergreen. No strong timing advantage or disadvantage. Quality and hook strength determine outcome.`,
    late:       `Late window: ${primary.keyword} is declining. The volume is still there but the growth curve has flattened. Consider a fresh angle or wait for the next event cycle.`,
    too_early:  `Early signal: ${primary.keyword} hasn't reached mass adoption. High upside if it does. Consider creating the content but holding for 24-48h to see if the signal strengthens.`,
  };

  // Urgency
  const urgency: TrendIntelligence["urgency"] =
    timing === "perfect" ? "post_now" :
    timing === "good"    ? "post_within_24h" :
    timing === "too_early" ? "wait_for_event" :
    "evergreen_anytime";

  const urgencyRationales: Record<TrendIntelligence["urgency"], string> = {
    post_now:         `${primary.keyword}: post immediately. The 2-hour recency window on TikTok provides 2-3× the baseline distribution boost. Every hour of delay reduces the multiplier by ~15%.`,
    post_within_24h:  `${primary.keyword}: post within 24 hours. The early-adoption window has a 48-72 hour peak. Quality check is worth the delay but don't wait longer than a day.`,
    wait_for_event:   `${primary.keyword}: niche signal detected. Wait 24-48h to confirm the signal strengthens. If it reaches early-adoption phase, post immediately.`,
    evergreen_anytime:`No time-sensitive window. Focus on maximising hook quality and platform-specific optimisation rather than timing.`,
  };

  return {
    detectedTrends: detected,
    primaryTrend: primary,
    forecastMultiplier: parseFloat(forecastMultiplier.toFixed(2)),
    recencyScore: Math.min(100, Math.max(0, recencyScore)),
    timingVerdict: timing,
    timingRationale: timingRationales[timing],
    urgency,
    urgencyRationale: urgencyRationales[urgency],
  };
}

// ─── NICHE EXPANSION ADVISER ─────────────────────────────────────────────

export interface NicheExpansionAdvice {
  primaryNiche: string;
  currentPhase: TrendPhase;
  immediateOpportunities: string[];
  bridgeNiches: { niche: string; hook: string; platform: string; lag: string }[];
  mainstreamSignal: string;
}

export function adviseNicheExpansion(
  title: string,
  tags: string[]
): NicheExpansionAdvice {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  
  // Detect current niche
  const isPropTrading = /prop|funded|challenge|drawdown|stelllar|fnxt|fundednext/.test(text);
  const isForex = /forex|fx|currency|gbp|eur|usd|pip/.test(text);
  const isFutures = /future|es|nq|contract|cmg|cme|nasdaq fut/.test(text);
  
  const primaryNiche = isPropTrading ? "Prop Trading / Funded Accounts" :
                       isForex ? "Forex Trading" :
                       isFutures ? "Futures Trading" : "Trading (General)";

  // Find matching pathway
  const pathway = PROP_TRADING_NICHE_PATHWAYS.find(p =>
    p.startNiche.toLowerCase().includes("prop")
  ) ?? PROP_TRADING_NICHE_PATHWAYS[0];

  return {
    primaryNiche,
    currentPhase: isPropTrading ? "mainstream" : "early_adoption",
    immediateOpportunities: [
      "Recency content: any market event → prop trading angle within 2 hours",
      "Pain content: 'why traders fail their challenge' — highest completion archetype",
      "Proof content: payout reveal → immediate CTA to FundedNext free trial",
    ],
    bridgeNiches: pathway.bridges.map(b => ({
      niche: b.niche,
      hook: b.bridgeHook,
      platform: b.platform,
      lag: b.adoptionLag,
    })),
    mainstreamSignal: pathway.mainstreamSignal,
  };
}
