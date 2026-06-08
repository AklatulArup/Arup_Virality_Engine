// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM CREATOR REPUTATION MULTIPLIER
// ═══════════════════════════════════════════════════════════════════════════
//
// From `analytics-sentiment-growth.md` §2 (Cross-Platform Creator Sentiment &
// Reputation Tracking): "Content sentiment and creator sentiment are different.
// A video might have great engagement while the creator's reputation is
// declining elsewhere. In the prop firm space, trust is the product." And:
// "A creator with great YouTube comments but toxic X mentions is a brand risk.
// Always check sentiment on at LEAST two platforms."
//
// The within-creator reputation multiplier (src/lib/reputation.ts) only sees
// ONE platform — the creator's history on the platform being forecast. It is
// blind to how the same creator is received on the OTHER platforms they post
// on. This module closes that gap using signal already in the reference pool:
// the same creator usually appears on TikTok / IG / X / YouTube, and every
// pool entry already carries a per-entry sentiment label. We aggregate that
// cross-platform footprint into a second-order multiplier on baseline.
//
// PURE COMPUTE — no network calls, no scraping. Reads only the reference pool
// the panel already loads for Pool Coverage. Same ethos as reputation.ts.
//
// SIGNALS
// -------
// 1. Breadth — how many OTHER platform families the creator appears on. A
//    durable multi-platform presence is portable, resilient reputation (the
//    doc: "Positive mentions multi-platform = strong cross-platform trust").
//    0 other platforms → not-applicable, multiplier stays 1.0.
// 2. Cross-platform sentiment — positive-vs-negative label ratio across the
//    creator's entries on those other platforms. RISK-ASYMMETRIC: toxicity is
//    penalised harder than positivity is rewarded, because "trust is the
//    product" — a brand-risk creator costs the firm more than a beloved one gains.
// 3. Polarisation (brand-risk flag) — the doc's headline scenario: positive on
//    one platform, negative on another. Split standing earns an extra haircut
//    even when the blended average looks fine.
//
// Multiplier CLAMPED to [0.85, 1.15] — deliberately tighter than the within-
// creator reputation multiplier [0.70, 1.25], because the pool's per-entry
// sentiment is a title/framing proxy (weaker than comment-level sentiment) and
// cross-platform identity matching is heuristic. This is a second-order
// adjustment on top of a second-order adjustment — it should nudge, not swing.

import type { ReferenceEntry } from "./types";
import type { Platform } from "./forecast";

export interface CrossPlatformReputation {
  multiplier:        number;                                   // 0.85 – 1.15
  confidence:        "high" | "medium" | "low" | "none";
  platformsPresent:  string[];                                 // other platform families found (e.g. ["tiktok","x"])
  signals: {
    crossPlatformEntries: number;
    positiveEntries:      number;
    negativeEntries:      number;
    neutralEntries:       number;
    positiveRatio:        number | null;                       // pos / (pos+neg); null if none classified
    polarized:            boolean;                             // leans positive on one platform, negative on another
  };
  rationale: string;
}

// Handles too short or too generic to match safely across platforms — matching
// "trading" or "forex" would attribute strangers' sentiment to this creator.
const GENERIC_HANDLES = new Set([
  "", "official", "trading", "trader", "traders", "forex", "fx", "crypto",
  "finance", "financial", "news", "markets", "market", "money", "invest",
  "investing", "investor", "stocks", "shorts", "clips", "video", "videos",
]);

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", x: "X",
};

const NEUTRAL: CrossPlatformReputation = {
  multiplier:       1.0,
  confidence:       "none",
  platformsPresent: [],
  signals: { crossPlatformEntries: 0, positiveEntries: 0, negativeEntries: 0, neutralEntries: 0, positiveRatio: null, polarized: false },
  rationale: "No cross-platform footprint found for this creator in the pool — reputation judged on the home platform only.",
};

// Lowercase, drop leading @, strip everything non-alphanumeric. "@Trader.Joe FX"
// and "traderjoefx" collapse to the same key so the same human matches across
// platforms despite cosmetic handle differences.
function normHandle(name: string | undefined | null): string {
  return (name ?? "").toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9]/g, "");
}

// YouTube long-form and Shorts share an audience/brand — treat them as one home
// base. Cross-platform means a genuinely different platform family.
function platformFamily(p: string | undefined): string {
  if (p === "youtube" || p === "youtube_short") return "youtube";
  return p ?? "unknown";
}

export function assessCrossPlatformReputation(params: {
  platform:    Platform;
  channelName: string;
  poolEntries: ReferenceEntry[];
}): CrossPlatformReputation {
  const targetKey = normHandle(params.channelName);

  // Guard: too short or too generic to match safely across platforms.
  if (targetKey.length < 5 || GENERIC_HANDLES.has(targetKey)) return NEUTRAL;

  const homeFamily = platformFamily(params.platform);

  // Cross-platform entries = same normalized handle, DIFFERENT platform family.
  const matches = params.poolEntries.filter((e) =>
    platformFamily(e.platform) !== homeFamily && normHandle(e.channelName) === targetKey
  );

  // One stray match could be coincidence — require at least two before acting.
  if (matches.length < 2) return NEUTRAL;

  // Tally sentiment labels overall and per platform family.
  const byFamily = new Map<string, { pos: number; neg: number; neu: number }>();
  let pos = 0, neg = 0, neu = 0;
  for (const e of matches) {
    const fam = platformFamily(e.platform);
    const slot = byFamily.get(fam) ?? { pos: 0, neg: 0, neu: 0 };
    if (e.sentiment === "positive")      { pos++; slot.pos++; }
    else if (e.sentiment === "negative") { neg++; slot.neg++; }
    else                                 { neu++; slot.neu++; }
    byFamily.set(fam, slot);
  }

  const platformsPresent = [...byFamily.keys()];
  const breadth          = platformsPresent.length;
  const classified       = pos + neg;
  const positiveRatio    = classified > 0 ? pos / classified : null;

  // Polarisation: at least one family leans positive AND another leans negative.
  let leansPos = 0, leansNeg = 0;
  for (const { pos: p, neg: n } of byFamily.values()) {
    if (p > n && p >= 2) leansPos++;
    if (n > p && n >= 2) leansNeg++;
  }
  const polarized = leansPos > 0 && leansNeg > 0;

  // ── Multiplier composition ──────────────────────────────────────────────
  let multiplier = 1.0;
  const reasons: string[] = [];
  const labelList = platformsPresent.map((f) => PLATFORM_LABEL[f] ?? f).join(", ");

  // 1. Breadth — small, capped bonus for durable multi-platform presence.
  const breadthBonus = breadth >= 3 ? 0.06 : breadth === 2 ? 0.04 : 0.02;
  multiplier *= 1 + breadthBonus;
  reasons.push(`active on ${labelList} (+${Math.round(breadthBonus * 100)}% multi-platform presence)`);

  // 2. Cross-platform sentiment — risk-asymmetric (penalise harder than reward).
  if (positiveRatio != null && classified >= 3) {
    if (positiveRatio >= 0.7) {
      const bump = Math.min(0.08, (positiveRatio - 0.5) * 0.16);
      multiplier *= 1 + bump;
      reasons.push(`consistently positive elsewhere (${pos}/${classified} posts, +${Math.round(bump * 100)}%)`);
    } else if (positiveRatio <= 0.4) {
      const hit = Math.min(0.12, (0.5 - positiveRatio) * 0.24);
      multiplier *= 1 - hit;
      reasons.push(`negative reception elsewhere (${neg}/${classified} posts, −${Math.round(hit * 100)}%)`);
    }
  }

  // 3. Polarisation brand-risk haircut.
  if (polarized) {
    multiplier *= 0.93;
    reasons.push("brand-risk: standing is split across platforms (−7%)");
  }

  multiplier = Math.max(0.85, Math.min(1.15, multiplier));

  const confidence: CrossPlatformReputation["confidence"] =
    matches.length >= 15 ? "high" :
    matches.length >= 5  ? "medium" :
                           "low";

  const pct = Math.round((multiplier - 1) * 100);
  const rationale =
    `${pct > 0 ? "+" : ""}${pct}% cross-platform reputation — ${reasons.join("; ")}. ` +
    `Based on ${matches.length} tracked posts across ${labelList}.`;

  return {
    multiplier,
    confidence,
    platformsPresent,
    signals: { crossPlatformEntries: matches.length, positiveEntries: pos, negativeEntries: neg, neutralEntries: neu, positiveRatio, polarized },
    rationale,
  };
}
