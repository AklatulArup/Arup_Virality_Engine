import type {
  VideoData,
  VRSResult,
  VRSCriterionResult,
  VRSTierSummary,
  VRSTier,
  CriterionStatus,
  VRSCriterion,
} from "./types";
import { YT_LONGFORM_CRITERIA } from "./vrs-criteria";
import { TT_CRITERIA }          from "./trs-criteria";
import { IG_CRITERIA }          from "./ig-criteria";
import { YT_SHORTS_CRITERIA }   from "./yts-criteria";
import { X_CRITERIA }           from "./x-criteria";

const TIER_LABELS: Record<VRSTier, string> = {
  1: "CRITICAL",
  2: "STRONG",
  3: "SUPPORT",
  4: "BASELINE",
};

// ─── Platform → Criteria Routing ─────────────────────────────────────────
// Each platform has distinct criteria with different weights and signals.
// Routing here ensures the correct formula is applied automatically.

export function getCriteriaForPlatform(platform?: string): VRSCriterion[] {
  switch (platform) {
    case "tiktok":       return TT_CRITERIA;
    case "instagram":    return IG_CRITERIA;
    case "facebook":     return IG_CRITERIA; // FB Reels shares IG's signal set (Meta discovery feed)
    case "youtube_short": return YT_SHORTS_CRITERIA;
    case "x":
    case "twitter":      return X_CRITERIA;
    case "youtube":
    default:             return YT_LONGFORM_CRITERIA;
  }
}

export function getPlatformLabel(platform?: string): string {
  switch (platform) {
    case "tiktok":        return "TikTok";
    case "instagram":     return "Instagram Reels";
    case "facebook":      return "Facebook";
    case "youtube_short": return "YouTube Shorts";
    case "x":
    case "twitter":       return "X (Twitter)";
    default:              return "YouTube Long-Form";
  }
}

// ─── New Channel Boost (YouTube-specific) ────────────────────────────────

function getNewChannelFactor(video: VideoData): number {
  const ctx = video.channelContext;
  if (!ctx) return 0;
  if (ctx.videoCount <= 5 && ctx.subs < 1000) {
    return ctx.channelAgeDays < 90 ? 0.08 : 0.04;
  }
  if (ctx.videoCount <= 20 && ctx.subs < 5000) return 0.02;
  return 0;
}

// ─── Hidden Score Estimation ─────────────────────────────────────────────
// Estimates unassessable criteria (visual, audio) using observable proxies.
// Platform-aware: different proxies matter on different platforms.

function estimateHiddenScore(
  video: VideoData,
  earned: number,
  possible: number,
  hiddenWeight: number,
  platform?: string
): number {
  if (hiddenWeight <= 0) return 0;

  const likeRatio    = video.views > 0 ? (video.likes / video.views) * 100 : 0;
  const commentRatio = video.views > 0 ? (video.comments / video.views) * 100 : 0;
  const shareRatio   = video.views > 0 ? ((video.shares ?? 0) / video.views) * 100 : 0;

  const likeFactor    = Math.min(likeRatio / 5, 1);
  const commentFactor = Math.min(commentRatio / 3, 1);
  const shareFactor   = Math.min(shareRatio / 1, 1);

  const title         = video.title.toLowerCase();
  const hasNumber     = /\d/.test(title);
  const hasPowerWord  = /secret|revealed|shocking|insane|truth|proven|ultimate|never|always|how to|why|pass|fail/i.test(title);
  const hasQuestion   = /\?/.test(title);
  const packagingFactor = (hasNumber ? 0.25 : 0) + (hasPowerWord ? 0.25 : 0) + (hasQuestion ? 0.2 : 0) + 0.15;

  const assessedRatio = possible > 0 ? earned / possible : 0;
  const newChannelBoost = getNewChannelFactor(video);

  let hiddenMultiplier: number;

  // Platform-specific proxy weighting for hidden criteria
  if (platform === "tiktok" || platform === "instagram") {
    // For short-form: shares and packaging quality are better proxies than duration
    hiddenMultiplier =
      shareFactor   * 0.35 +
      likeFactor    * 0.20 +
      commentFactor * 0.15 +
      packagingFactor * 0.15 +
      assessedRatio * 0.15;
  } else if (platform === "youtube_short") {
    // For Shorts: shares + packaging (Frame 1 quality) are primary
    hiddenMultiplier =
      shareFactor   * 0.30 +
      packagingFactor * 0.25 +
      likeFactor    * 0.20 +
      commentFactor * 0.10 +
      assessedRatio * 0.15;
  } else {
    // YouTube LF: duration optimisation + packaging quality
    const durMin = video.durationSeconds / 60;
    const durationFactor = durMin >= 8 && durMin <= 25 ? 0.7 : durMin >= 3 && durMin <= 45 ? 0.5 : 0.3;
    hiddenMultiplier =
      likeFactor    * 0.30 +
      commentFactor * 0.20 +
      durationFactor * 0.15 +
      packagingFactor * 0.15 +
      assessedRatio * 0.20 +
      newChannelBoost;
  }

  const clampedMultiplier = Math.max(0.15, Math.min(0.75, hiddenMultiplier));
  return hiddenWeight * clampedMultiplier;
}

// ─── Core VRS Runner ─────────────────────────────────────────────────────

export function runVRS(
  video: VideoData,
  criteria: VRSCriterion[] = YT_LONGFORM_CRITERIA
): VRSResult {
  const results: VRSCriterionResult[] = [];
  let earned = 0;
  let possible = 0;
  let hiddenCount = 0;
  let hiddenWeight = 0;

  for (const c of criteria) {
    const score        = c.check(video);
    const rationaleText = c.rationale(video, score);

    if (score === null) {
      hiddenCount++;
      hiddenWeight += c.weight;
      results.push({ id: c.id, label: c.label, weight: c.weight, tier: c.tier,
        status: "hidden", points: 0, maxPoints: c.weight, rationale: rationaleText });
    } else {
      const points = c.weight * score;
      earned  += points;
      possible += c.weight;

      let status: CriterionStatus;
      if (score >= 1) status = "pass";
      else if (score >= 0.5) status = "partial";
      else status = "fail";

      results.push({ id: c.id, label: c.label, weight: c.weight, tier: c.tier,
        status, points, maxPoints: c.weight, rationale: rationaleText });
    }
  }

  const tiers: VRSTier[] = [1, 2, 3, 4];
  const tierSummaries: VRSTierSummary[] = tiers.map((tier) => {
    const tierCriteria = results.filter((c) => c.tier === tier);
    const assessed     = tierCriteria.filter((c) => c.status !== "hidden");
    return {
      tier,
      label:    TIER_LABELS[tier],
      earned:   assessed.reduce((sum, c) => sum + c.points, 0),
      possible: assessed.reduce((sum, c) => sum + c.maxPoints, 0),
      assessed: assessed.length,
      total:    tierCriteria.length,
    };
  });

  const gaps     = results.filter((c) => c.status === "fail" || c.status === "partial").sort((a, b) => b.weight - a.weight);
  const topFixes = gaps.slice(0, 3);
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const score    = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const estimatedHidden = estimateHiddenScore(video, earned, possible, hiddenWeight, video.platform);
  const estimatedFullScore = totalWeight > 0
    ? Math.round(((earned + estimatedHidden) / totalWeight) * 100) : 0;

  return {
    score,
    estimatedFullScore,
    earned,
    possible,
    totalWeight,
    estimatedHiddenScore: Math.round(estimatedHidden * 10) / 10,
    tierSummaries,
    criteria: results,
    gaps,
    topFixes,
    hiddenCount,
  };
}

// ─── Platform-Specific Runners ────────────────────────────────────────────

/** Auto-routes to correct criteria based on video.platform field */
export function runPlatformVRS(video: VideoData): VRSResult {
  const criteria = getCriteriaForPlatform(video.platform);
  return runVRS(video, criteria);
}

export function runTRS(video: VideoData): VRSResult {
  return runVRS(video, TT_CRITERIA);
}

export function runIRS(video: VideoData): VRSResult {
  return runVRS(video, IG_CRITERIA);
}

export function runSRS(video: VideoData): VRSResult {
  return runVRS(video, YT_SHORTS_CRITERIA);
}

// ─── Score Display Helpers ────────────────────────────────────────────────

export function getVRSColor(score: number): string {
  if (score >= 90) return "var(--color-vrs-excellent)";
  if (score >= 75) return "var(--color-vrs-strong)";
  if (score >= 60) return "var(--color-vrs-competitive)";
  if (score >= 40) return "var(--color-vrs-needs-work)";
  return "var(--color-vrs-rework)";
}

export function getVRSLabel(score: number): string {
  if (score >= 90) return "Viral-ready";
  if (score >= 75) return "Strong performer";
  if (score >= 60) return "Competitive";
  if (score >= 40) return "Needs work";
  return "Fundamental rework";
}

export function getVRSExplanation(
  score: number,
  assessedCount: number,
  totalCriteria: number,
  referenceCount: number,
  platform?: string
): string {
  const label        = getVRSLabel(score);
  const platformLabel = getPlatformLabel(platform);

  const tierDesc = score >= 90
    ? `This content has strong signals across nearly all measurable ${platformLabel} criteria. It demonstrates the engagement patterns and structural qualities the algorithm actively promotes.`
    : score >= 75
      ? `This content shows strong viral signals for ${platformLabel} but has room to improve. Core metrics are solid — focus on the gap analysis below for highest-impact fixes.`
      : score >= 60
        ? `This content is competitive on ${platformLabel} but not yet optimised for maximum distribution. Several key signals are underperforming — the gap analysis shows exactly where.`
        : score >= 40
          ? `This content has significant gaps in ${platformLabel} viral readiness. Key signals need attention before the algorithm will actively distribute it.`
          : `This content needs fundamental improvements to compete for ${platformLabel} distribution. Focus on the top 3 fixes below — they carry the most algorithmic weight.`;

  return `VRS ${score}% — "${label}"\n\n${tierDesc}\n\nScored across ${assessedCount} of ${totalCriteria} ${platformLabel} criteria. ${referenceCount > 0 ? `Compared against ${referenceCount} videos in the reference pool.` : "Add more videos to the reference pool for comparative accuracy."}`;
}

export function getTierColor(tier: VRSTier): string {
  const colors: Record<VRSTier, string> = {
    1: "var(--color-tier-1)",
    2: "var(--color-tier-2)",
    3: "var(--color-tier-3)",
    4: "var(--color-tier-4)",
  };
  return colors[tier];
}

export function getStatusIcon(status: CriterionStatus): string {
  return { pass: "✅", partial: "⚠️", fail: "❌", hidden: "🔍" }[status];
}
