// ═══════════════════════════════════════════════════════════════════════════
// NICHE CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════
//
// Creators in the same broad "finance" umbrella behave very differently
// depending on their specific niche. A prop-trading creator's median view
// count distribution looks nothing like a crypto-trader or lifestyle-trader.
//
// This classifier tags each creator based on keyword patterns across their
// recent video titles, descriptions, and tags. It runs 100% locally, no API
// calls needed.
//
// The forecast engine uses the niche to:
//   1. Match against niche-appropriate reference baselines when available
//   2. Adjust expectations for niche-specific seasonality (e.g. crypto
//      creators spike during BTC rallies; prop-trading creators spike during
//      funded-account launch windows)
//   3. Surface the classification in the forecast panel so RM can confirm
//      or override

import type { VideoData } from "./types";

export type Niche =
  | "prop-trading"
  | "crypto-trader"
  | "general-finance"
  | "lifestyle-trader"
  | "forex-specialist"
  | "options-trader"
  | "non-finance"
  | "unknown";

export interface NicheProfile {
  niche:       Niche;
  confidence:  number;   // 0-100
  signals:     string[]; // keywords that matched
  secondary?:  Niche;    // second-most-likely niche (if close)
  rationale:   string;
}

// ─── KEYWORD PATTERNS ─────────────────────────────────────────────────────
// Each niche has:
//   strong:     terms that strongly indicate this niche (weight 3)
//   medium:     terms that moderately indicate (weight 2)
//   weak:       terms that mildly suggest (weight 1)
//
// Matching is case-insensitive, uses word boundaries where appropriate.

const NICHE_KEYWORDS: Record<Exclude<Niche, "unknown">, {
  strong: string[];
  medium: string[];
  weak:   string[];
}> = {
  "prop-trading": {
    strong: [
      "fundednext", "ftmo", "funded account", "prop firm", "prop trader",
      "funded trader", "challenge passed", "phase 1", "phase 2", "evaluation",
      "payout proof", "trading challenge", "my5ers", "topstep", "apex trader",
      "the5ers", "truetrader", "funded rules",
    ],
    medium: [
      "funded", "payout", "prop", "challenge", "evaluation phase",
      "challenge account", "profit split", "drawdown rule", "trading rules",
      "challenge fee",
    ],
    weak:   ["challenge", "payout", "rules", "target", "profit target"],
  },
  "crypto-trader": {
    strong: [
      "bitcoin", "btc", "ethereum", "eth", "crypto trader", "altcoin",
      "solana", "sol", "memecoin", "defi", "dex trading", "on-chain",
      "crypto portfolio", "crypto trade", "shitcoin", "pump fun", "gmx",
    ],
    medium: [
      "crypto", "blockchain", "web3", "pepe", "doge", "shiba",
      "stablecoin", "usdt", "usdc", "wallet", "mev", "arbitrum",
    ],
    weak:   ["coin", "token", "pump", "moon", "hodl"],
  },
  "forex-specialist": {
    strong: [
      "forex trader", "fx pair", "eurusd", "gbpusd", "usdjpy",
      "currency pair", "pip count", "xauusd", "gold trader", "dxy",
      "forex strategy", "currency trading", "forex analysis",
    ],
    medium: [
      "forex", "currency", "pip", "spread", "pair", "session",
      "london session", "new york session", "asian session",
    ],
    weak:   ["pip", "spread", "session"],
  },
  "options-trader": {
    strong: [
      "options trader", "options strategy", "put option", "call option",
      "iron condor", "credit spread", "debit spread", "options flow",
      "strike price", "theta decay", "gamma squeeze", "0dte", "leap",
      "options chain",
    ],
    medium: [
      "options", "iv", "implied volatility", "premium", "expiry",
      "gamma", "theta", "delta", "vega",
    ],
    weak:   ["premium", "strike", "expiry"],
  },
  "lifestyle-trader": {
    strong: [
      "day in the life", "trader lifestyle", "6-figure", "7-figure",
      "luxury lifestyle", "laptop lifestyle", "financial freedom",
      "quit my 9-5", "millionaire trader", "trading room tour",
      "my setup", "dubai trader", "flexing",
    ],
    medium: [
      "lifestyle", "luxury", "freedom", "passive income", "motivation",
      "dreams", "mindset", "grind", "hustle", "rich",
    ],
    weak:   ["rich", "luxury", "freedom"],
  },
  "general-finance": {
    strong: [
      "stock market", "investing 101", "personal finance", "s&p 500",
      "mutual fund", "etf investing", "dividend investing", "401k",
      "retirement planning", "tax strategy", "index fund",
    ],
    medium: [
      "stocks", "invest", "portfolio", "dividend", "savings",
      "budget", "debt", "interest rate", "federal reserve", "cpi",
    ],
    weak:   ["money", "invest", "stock"],
  },
  "non-finance": {
    strong: [
      "cooking", "recipe", "makeup", "skincare", "workout", "fitness",
      "gaming", "gameplay", "movie review", "unboxing", "travel vlog",
      "fashion", "tech review", "comedy sketch", "dance", "music cover",
    ],
    medium: [
      "food", "beauty", "fitness", "gaming", "movies", "tv show",
      "travel", "fashion", "tech", "comedy", "music", "sports",
    ],
    weak:   [],
  },
};

// ─── CLASSIFIER ───────────────────────────────────────────────────────────

export function classifyCreatorNiche(videos: VideoData[]): NicheProfile {
  if (videos.length === 0) {
    return { niche: "unknown", confidence: 0, signals: [], rationale: "No videos to analyse." };
  }

  // Build combined text from recent 30 videos (titles + descriptions + tags)
  const corpus = videos.slice(0, 30).map((v) => {
    const parts: string[] = [];
    if (v.title) parts.push(v.title);
    if (v.description) parts.push(v.description.slice(0, 500));
    if (v.tags && Array.isArray(v.tags)) parts.push(v.tags.join(" "));
    return parts.join(" ");
  }).join(" ").toLowerCase();

  if (corpus.trim().length < 30) {
    return { niche: "unknown", confidence: 0, signals: [], rationale: "Too little text content to classify." };
  }

  // Score each niche
  const scores: Record<Exclude<Niche, "unknown">, { score: number; hits: string[] }> = {
    "prop-trading":    { score: 0, hits: [] },
    "crypto-trader":   { score: 0, hits: [] },
    "forex-specialist":{ score: 0, hits: [] },
    "options-trader":  { score: 0, hits: [] },
    "lifestyle-trader":{ score: 0, hits: [] },
    "general-finance": { score: 0, hits: [] },
    "non-finance":     { score: 0, hits: [] },
  };

  for (const niche of Object.keys(scores) as Array<Exclude<Niche, "unknown">>) {
    const patterns = NICHE_KEYWORDS[niche];
    for (const kw of patterns.strong) {
      if (matchKeyword(corpus, kw)) {
        scores[niche].score += 3;
        if (scores[niche].hits.length < 5) scores[niche].hits.push(kw);
      }
    }
    for (const kw of patterns.medium) {
      if (matchKeyword(corpus, kw)) {
        scores[niche].score += 2;
        if (scores[niche].hits.length < 5) scores[niche].hits.push(kw);
      }
    }
    for (const kw of patterns.weak) {
      if (matchKeyword(corpus, kw)) scores[niche].score += 1;
    }
  }

  // Rank
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score) as Array<[Exclude<Niche, "unknown">, { score: number; hits: string[] }]>;

  const [topNiche, topData] = ranked[0];
  const [secondNiche, secondData] = ranked[1];

  if (topData.score < 3) {
    return {
      niche: "unknown", confidence: 0, signals: [],
      rationale: "No niche keywords matched strongly enough to classify.",
    };
  }

  // Confidence: based on (a) absolute top score and (b) margin over #2
  const margin = topData.score - secondData.score;
  const confidence = Math.min(100, Math.round(
    Math.min(topData.score / 20, 1) * 60 +   // score magnitude up to 60
    Math.min(margin / 10, 1) * 40            // margin over second up to 40
  ));

  const secondary = secondData.score >= 3 && margin <= 4 ? secondNiche : undefined;

  const rationale = secondary
    ? `Classified as ${topNiche} (score ${topData.score}). Also matches ${secondary} (score ${secondData.score}) — likely a hybrid creator.`
    : `Classified as ${topNiche} with confidence ${confidence}/100. Matched keywords: ${topData.hits.slice(0, 3).join(", ")}.`;

  return {
    niche:      topNiche,
    confidence,
    signals:    topData.hits,
    secondary,
    rationale,
  };
}

function matchKeyword(corpus: string, keyword: string): boolean {
  // Multi-word keywords: substring match (allows phrase variations)
  if (keyword.includes(" ")) return corpus.includes(keyword);
  // Single-word: word-boundary match to avoid partial matches
  const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
  return re.test(corpus);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── NICHE-SPECIFIC ADJUSTMENTS ───────────────────────────────────────────
//
// Different niches have different variance and distribution characteristics.
// Applied as a secondary multiplier on the forecast prior.

export function nicheAdjustment(niche: Niche): { multiplier: number; rationale: string } {
  switch (niche) {
    case "prop-trading":
      // Prop trading content is highly seasonal around challenge-launch windows
      // and payout reveals. Slightly higher variance than general finance.
      return { multiplier: 1.05, rationale: "Prop-trading creators see higher variance around payout and challenge-launch cycles." };
    case "crypto-trader":
      // Crypto content is extremely volatile — massive upside during rallies,
      // severe downside during bear markets. We hold multiplier neutral and let
      // the market-volatility seasonality signal do the heavy lifting.
      return { multiplier: 1.0, rationale: "Crypto creators are highly sensitive to market-wide volatility." };
    case "forex-specialist":
      // Forex is steadier than crypto but more niche than general finance.
      return { multiplier: 0.95, rationale: "Forex-specialist audience is smaller but more engaged." };
    case "options-trader":
      return { multiplier: 1.0, rationale: "Options-trader content follows general finance patterns." };
    case "lifestyle-trader":
      // Lifestyle content has massively wider variance — some goes viral, most flops
      return { multiplier: 1.1, rationale: "Lifestyle-trader content has wider variance — higher ceiling, higher floor risk." };
    case "general-finance":
      return { multiplier: 1.0, rationale: "General finance content — baseline expectations." };
    case "non-finance":
      return { multiplier: 1.0, rationale: "Non-finance niche — trading signals won't apply." };
    default:
      return { multiplier: 1.0, rationale: "Niche unknown — no adjustment applied." };
  }
}
