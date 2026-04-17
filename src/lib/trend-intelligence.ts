/**
 * Trend Intelligence Engine
 * 
 * Detects trend signals from content patterns, niche behavior, and external data.
 * Grades trends on a 5-point likelihood scale from niche early signal to wide adoption.
 * 
 * Sources: Rogers Diffusion of Innovations (adapted for social content),
 *          social-sentiment-intelligence.md, platform research 2024-2026.
 * 
 * Key insight: Trends are predictable. They follow the Innovators (2%) →
 * Early Adopters (13%) → Early Majority (34%) adoption curve.
 * The best time to create trend content is at Early Adopter phase (2-13%),
 * not at peak (34%+ = too late for organic reach bonus).
 */

export type TrendPhase =
  | "niche_signal"      // <2% adoption — innovators only, high risk/reward
  | "early_signal"      // 2-13% adoption — early adopters, best entry point
  | "acceleration"      // 13-34% — algorithm amplifying, still worth entering
  | "peak"              // 34-50% — mass adoption, algorithm saturation
  | "declining"         // 50%+ — trend is dying, late content gets no boost
  | "evergreen";        // Not trend-dependent — works at any time

export type TrendLikelihood = 1 | 2 | 3 | 4 | 5;
// 1 = Niche signal only — monitor, don't act yet
// 2 = Early signal — create NOW for first-mover advantage
// 3 = Building — still time, but window is narrowing
// 4 = Peak — marginal benefit, algorithm is saturated
// 5 = Post-peak — trend content actively suppressed (oversupply)

export interface TrendSignal {
  topic: string;
  phase: TrendPhase;
  likelihood: TrendLikelihood;
  likelihoodLabel: string;
  platformRelevance: Record<string, number>;  // 0-1 per platform
  windowOpen: boolean;                         // true = create now
  urgency: "immediate" | "this_week" | "this_month" | "monitor" | "pass";
  evidence: string[];
  contentAngles: string[];                     // specific angles to take
  riskLevel: "low" | "medium" | "high";
  estimatedReachMultiplier: number;            // vs non-trend content
}

export interface TrendIntelligence {
  activeTrends: TrendSignal[];
  niche: string;
  platform: string;
  trendScore: number;                          // 0–100 overall trend alignment
  recommendation: string;
  newsIntegrationOpportunity: boolean;
  evergreenAlternative: string;                // fallback if no trend window open
}

// ─── Trading/prop firm trend pattern detection ─────────────────────────────

const TREND_PATTERNS: {
  pattern: RegExp;
  topic: string;
  basePhase: TrendPhase;
  platforms: string[];
  angles: string[];
}[] = [
  {
    pattern: /news|fed|fomc|rate (hike|cut)|inflation|jobs report|cpi|nfp|earnings/i,
    topic: "Market Event Reaction",
    basePhase: "early_signal",
    platforms: ["tiktok", "youtube", "youtube_short"],
    angles: [
      "How this market event affects your prop firm challenge",
      "Trading this news event with a funded account",
      "Should you trade FOMC on a challenge account?",
      "My funded account P&L during [event]",
    ],
  },
  {
    pattern: /prop firm|prop trading|funded (trader|account|capital)/i,
    topic: "Prop Firm Space",
    basePhase: "acceleration",
    platforms: ["tiktok", "instagram", "youtube_short"],
    angles: [
      "Prop firm comparison — which is actually worth it",
      "What they don't tell you about prop firm challenges",
      "My first payout from a prop firm",
      "Passed my first funded challenge — here's exactly how",
    ],
  },
  {
    pattern: /ai (trading|bot|algorithm)|automated|algorithm (trading|strategy)/i,
    topic: "AI Trading",
    basePhase: "early_signal",
    platforms: ["youtube", "tiktok", "youtube_short"],
    angles: [
      "I tested AI trading on a funded account — results",
      "Can AI pass a prop firm challenge?",
      "AI trading vs manual trading on FundedNext",
    ],
  },
  {
    pattern: /recession|crash|bear market|bubble|market collapse|correction/i,
    topic: "Market Fear / Macro Concern",
    basePhase: "acceleration",
    platforms: ["tiktok", "youtube", "instagram"],
    angles: [
      "How to trade a recession with a funded account",
      "My prop challenge during the market crash",
      "Why prop firm traders have an advantage in a bear market",
    ],
  },
  {
    pattern: /challenge (fail|failed|blew|pass|passed)|account (blown|breached|violated)/i,
    topic: "Challenge Journey",
    basePhase: "acceleration",
    platforms: ["tiktok", "instagram", "youtube_short"],
    angles: [
      "Day N of my FundedNext challenge",
      "I failed my challenge — here's the exact mistake",
      "Passed my funded challenge after 3 fails — what changed",
    ],
  },
  {
    pattern: /payout|withdrawal|funded|getting paid|proof of (payment|payout)/i,
    topic: "Payout Reveal",
    basePhase: "acceleration",
    platforms: ["tiktok", "instagram"],
    angles: [
      "My first $[X] payout from FundedNext",
      "What happens when you request a payout",
      "Payout proof — funded trading is real",
    ],
  },
  {
    pattern: /quit (my )?job|replace (my )?salary|full.?time trader|left (my )?job/i,
    topic: "Trading as Income Replacement",
    basePhase: "acceleration",
    platforms: ["tiktok", "instagram", "youtube"],
    angles: [
      "I quit my job to trade — month 3 update",
      "Replacing my salary with funded trading (reality check)",
      "What I wish I knew before quitting my job to trade",
    ],
  },
  {
    pattern: /risk management|daily loss|drawdown|position size|lot size|stop loss/i,
    topic: "Risk Management Education",
    basePhase: "evergreen",
    platforms: ["youtube", "youtube_short", "instagram"],
    angles: [
      "The exact risk management that passed my challenge",
      "Daily loss rule — the one thing that kills challenges",
      "Position sizing for prop firm challenges",
    ],
  },
];

// ─── Trend phase → likelihood mapping ────────────────────────────────────

const PHASE_LIKELIHOOD: Record<TrendPhase, TrendLikelihood> = {
  niche_signal: 1,
  early_signal: 2,
  acceleration: 3,
  peak:         4,
  declining:    5,
  evergreen:    3,   // evergreen = moderate score, always valid
};

const PHASE_LABELS: Record<TrendLikelihood, string> = {
  1: "Niche signal — monitor, first-mover window opening",
  2: "Early signal — CREATE NOW for maximum algorithmic boost",
  3: "Building — still time, window is narrowing",
  4: "Peak — marginal boost, consider differentiation angle",
  5: "Post-peak — skip trend, create evergreen instead",
};

const PHASE_URGENCY: Record<TrendLikelihood, "immediate" | "this_week" | "this_month" | "monitor" | "pass"> = {
  1: "monitor",
  2: "immediate",
  3: "this_week",
  4: "this_month",
  5: "pass",
};

const PHASE_REACH_MULTIPLIER: Record<TrendPhase, number> = {
  niche_signal: 1.3,   // small boost for first movers
  early_signal: 2.5,   // significant algorithmic bonus for early content
  acceleration: 1.8,   // still meaningful
  peak:         1.2,   // minimal — algorithm saturated
  declining:    0.8,   // slight penalty for oversupply
  evergreen:    1.4,   // consistent moderate boost
};

// ─── Platform relevance per trend topic ──────────────────────────────────

const PLATFORM_RELEVANCE: Record<string, Record<string, number>> = {
  "Market Event Reaction": { tiktok: 0.9, youtube: 0.85, youtube_short: 0.80, instagram: 0.6 },
  "Prop Firm Space":       { tiktok: 0.95, instagram: 0.90, youtube_short: 0.85, youtube: 0.75 },
  "AI Trading":            { youtube: 0.90, tiktok: 0.80, youtube_short: 0.75, instagram: 0.6 },
  "Challenge Journey":     { tiktok: 0.95, instagram: 0.90, youtube_short: 0.80, youtube: 0.65 },
  "Payout Reveal":         { tiktok: 0.95, instagram: 0.90, youtube_short: 0.75, youtube: 0.60 },
  "Trading as Income Replacement": { tiktok: 0.85, instagram: 0.80, youtube: 0.80, youtube_short: 0.70 },
  "Risk Management Education": { youtube: 0.90, instagram: 0.80, youtube_short: 0.75, tiktok: 0.65 },
  "Market Fear / Macro Concern": { tiktok: 0.85, youtube: 0.85, instagram: 0.70, youtube_short: 0.75 },
};

// ─── News signal detection ────────────────────────────────────────────────

const NEWS_TRIGGERS = [
  /fed|fomc|interest rate|rate (hike|cut|hold)/i,
  /inflation|cpi|pce|consumer price/i,
  /jobs report|nfp|non-farm|unemployment/i,
  /earnings report|earnings season/i,
  /bank (crisis|failure|collapse)|svb|credit suisse/i,
  /recession|gdp (contraction|decline)/i,
  /market crash|black (monday|tuesday|swan)/i,
  /crypto (crash|pump|regulation)/i,
  /regulation|ban|sec|cftc|ftc/i,
];

function detectNewsIntegration(title: string, tags: string[], description: string): boolean {
  const text = `${title} ${tags.join(" ")} ${description}`;
  return NEWS_TRIGGERS.some(p => p.test(text));
}

// ─── Main export ─────────────────────────────────────────────────────────

export function detectTrends(
  title: string,
  tags: string[],
  description: string,
  platform: string,
  publishedWithinDays?: number  // how recent is this content (affects phase inference)
): TrendIntelligence {
  const text = `${title} ${tags.join(" ")} ${description}`;
  const activeTrends: TrendSignal[] = [];
  let totalTrendScore = 0;

  for (const def of TREND_PATTERNS) {
    if (!def.pattern.test(text)) continue;

    // Adjust phase based on recency if available
    let phase = def.basePhase;
    if (publishedWithinDays !== undefined) {
      if (def.basePhase === "early_signal" && publishedWithinDays > 14) phase = "acceleration";
      if (def.basePhase === "acceleration" && publishedWithinDays > 30) phase = "peak";
    }

    const likelihood = PHASE_LIKELIHOOD[phase];
    const platformRel = PLATFORM_RELEVANCE[def.topic] ?? {};
    const relevance = platformRel[platform] ?? 0.5;

    activeTrends.push({
      topic: def.topic,
      phase,
      likelihood,
      likelihoodLabel: PHASE_LABELS[likelihood],
      platformRelevance: platformRel,
      windowOpen: likelihood <= 3,
      urgency: PHASE_URGENCY[likelihood],
      evidence: [
        `Pattern match: "${def.pattern.source.slice(0, 60)}"`,
        `Platform relevance: ${Math.round(relevance * 100)}% on ${platform}`,
        `Phase: ${phase} → reach multiplier ${PHASE_REACH_MULTIPLIER[phase]}×`,
      ],
      contentAngles: def.angles,
      riskLevel: likelihood === 1 ? "high" : likelihood <= 2 ? "medium" : "low",
      estimatedReachMultiplier: PHASE_REACH_MULTIPLIER[phase],
    });

    totalTrendScore += (6 - likelihood) * 20 * relevance;
  }

  const hasNews = detectNewsIntegration(title, tags, description);
  const trendScore = Math.min(100, Math.round(totalTrendScore / Math.max(1, activeTrends.length)));

  // Determine the best action recommendation
  const immediateOpps = activeTrends.filter(t => t.urgency === "immediate");
  const thisWeekOpps  = activeTrends.filter(t => t.urgency === "this_week");

  let recommendation: string;
  if (immediateOpps.length > 0) {
    recommendation = `CREATE NOW — "${immediateOpps[0].topic}" is at early-signal phase (${immediateOpps[0].estimatedReachMultiplier}× reach multiplier). Best angles: ${immediateOpps[0].contentAngles[0]}`;
  } else if (thisWeekOpps.length > 0) {
    recommendation = `Act this week — "${thisWeekOpps[0].topic}" window is open (${thisWeekOpps[0].estimatedReachMultiplier}× multiplier). Angle: ${thisWeekOpps[0].contentAngles[0]}`;
  } else if (activeTrends.length > 0) {
    recommendation = `Trend window is closing — consider the evergreen alternative below for more sustained reach.`;
  } else {
    recommendation = `No active trend signal detected. Evergreen content recommended — optimised for search and long-tail discovery.`;
  }

  const evergreenAlternatives: string[] = [
    "The exact rules I follow to pass every funded challenge (save-worthy reference)",
    "Risk management framework for prop firm traders (search-indexed, evergreen saves)",
    "Step-by-step guide to passing FundedNext Stellar 2-Step (search traffic)",
    "The one daily loss rule most traders misunderstand (curiosity + save)",
  ];

  return {
    activeTrends,
    niche: "prop-trading",
    platform,
    trendScore,
    recommendation,
    newsIntegrationOpportunity: hasNews,
    evergreenAlternative: evergreenAlternatives[Math.floor(Math.random() * evergreenAlternatives.length)],
  };
}

// Trend likelihood labels for UI display
export const TREND_LIKELIHOOD_COLORS: Record<TrendLikelihood, string> = {
  1: "#60A5FA",   // blue — monitor
  2: "#2ECC8A",   // green — create now
  3: "#F59E0B",   // amber — soon
  4: "#FF9A3C",   // orange — fading
  5: "#FF453A",   // red — pass
};

export const TREND_PHASE_DESCRIPTIONS: Record<TrendPhase, string> = {
  niche_signal:  "Innovators only (<2% adoption). First-mover window opening. High risk, high reward if it spreads.",
  early_signal:  "Early adopters phase (2-13%). Algorithm will actively amplify this content. Best entry point.",
  acceleration:  "Early majority joining (13-34%). Algorithm still boosting. Narrowing window.",
  peak:          "Mass adoption (34-50%). Algorithm saturated. Differentiation required to stand out.",
  declining:     "Post-peak (50%+). Trend exhausted. Evergreen alternative recommended.",
  evergreen:     "Not trend-dependent. Consistent reach regardless of timing. SEO and saves drive distribution.",
};
