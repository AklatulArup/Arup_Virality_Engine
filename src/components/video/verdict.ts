// Plain-English verdict synthesis — the decision element at the top of every
// Video Report. Maps forecast score band × live trajectory into one of five
// tiers with a one-sentence summary an RM can repeat in a meeting.

import type { Forecast } from "@/lib/forecast";

export type VerdictTier = "strong" | "promising" | "average" | "below" | "early";

export interface Verdict {
  tier: VerdictTier;
  label: string;
  sentence: string;
  color: string;
}

const COLORS: Record<VerdictTier, string> = {
  strong: "#2ECC8A",
  promising: "#60A5FA",
  average: "#9E9C97",
  below: "#F0B35A",
  early: "#9E9C97",
};

export function verdictFor(f: Forecast): Verdict {
  if (f.confidence.level === "insufficient") {
    return {
      tier: "early",
      label: "Too early to call",
      sentence:
        "Not enough creator history to forecast views yet — the readiness score below still grades the content itself.",
      color: COLORS.early,
    };
  }

  const score = f.scoreMultiplier.score;
  const t = f.trajectory;

  if (t && (t.verdict === "major-outlier" || t.verdict === "above")) {
    const x = t.outperformance >= 100 ? Math.round(t.outperformance).toLocaleString() : t.outperformance.toFixed(1);
    return {
      tier: "strong",
      label: t.verdict === "major-outlier" ? "Breakout" : "Strong bet",
      sentence: `Likely a strong performer — pacing ${x}× ahead of this creator's normal at this age.`,
      color: COLORS.strong,
    };
  }

  if (t && t.verdict === "significantly-below") {
    return {
      tier: "below",
      label: "Below par",
      sentence: `Tracking well behind this creator's normal — at ${(t.outperformance * 100).toFixed(0)}% of the expected pace for its age.`,
      color: COLORS.below,
    };
  }

  if (t && t.verdict === "below") {
    return {
      tier: "below",
      label: "Underperforming",
      sentence: `Running behind this creator's usual pace (${(t.outperformance * 100).toFixed(0)}% of expected) — the range below reflects the slowdown.`,
      color: COLORS.below,
    };
  }

  // On-track or pre-publish: the readiness score carries the call.
  if (score >= 70) {
    return {
      tier: "promising",
      label: "Promising",
      sentence: t
        ? "On pace with this creator's normal, and the content setup is strong — upside if distribution kicks in."
        : "Strong content setup before the algorithm has weighed in — expected to beat this creator's normal.",
      color: COLORS.promising,
    };
  }
  if (score >= 40) {
    return {
      tier: "average",
      label: "Average",
      sentence: t
        ? "Tracking in line with this creator's normal — nothing in the setup suggests a breakout."
        : "A typical result is the most likely outcome — the setup neither helps nor hurts.",
      color: COLORS.average,
    };
  }
  return {
    tier: "below",
    label: "Below par",
    sentence: "Several content fundamentals are working against this one — expect below this creator's normal.",
    color: COLORS.below,
  };
}
