// ═══════════════════════════════════════════════════════════════════════════
// ADAPTERS — raw engine payloads → canonical skill variables (§1.1)
// ═══════════════════════════════════════════════════════════════════════════
//
// Hard rules (Phase 2 spec):
//   • every rate ships with its n (dashboard-sourced rates: n = views at
//     scoring time — the platform computed them over ~all views)
//   • missing data is null, NEVER 0
//   • reach snapshots are persisted time-stamped (velocity track) so wave
//     ratios m̂ = Δ_k / R_{k−1} are computable
//   • TikTok records carry the us/global fork tag when the source exposed it
//
// Where a composite REQUIRES a parameter the platform can't provide, the
// skill's own python default is used and the substitution is recorded as a
// note → contract caveat. Gate verdicts never use those defaults — gates read
// only real Rates (null ⇒ insufficient_evidence).

import type { ManualInputs, Platform } from "@/lib/forecast";
import type { CanonicalMetrics, ReachSnapshot } from "./canon";
import { rate } from "./canon";

export interface AdapterInput {
  platform: Platform;
  contentId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  saves: number | null;
  publishedAt: string | null;
  creatorFollowers: number | null;
  manualInputs: ManualInputs;
  aiEstimatedKeys: Array<keyof ManualInputs>;
  /** Velocity-track samples: cumulative views at sampled ages. */
  velocity: Array<{ ageHours: number; views: number }>;
  /** TikTok region from TikWM ("US" etc.); null for Apify-profile records. */
  region?: string | null;
  /** X-only raw counts when available. */
  xRaw?: { replies: number; quotes: number; bookmarks: number; reposts: number } | null;
}

function pct(v: number | undefined | null): number | null {
  return v == null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1, v / 100));
}

function buildCommon(input: AdapterInput, notes: string[]): Omit<CanonicalMetrics, "C_comp" | "V_vs" | "H_3s" | "R_loop" | "s" | "save_rate" | "SPR" | "CTR" | "AVD" | "R_30s" | "v1" | "likes_per_reach" | "hasWatermark" | "isRepostHeavy" | "region" | "xCounts"> {
  const ageHours = input.publishedAt ? Math.max(0, (Date.now() - new Date(input.publishedAt).getTime()) / 3_600_000) : null;
  const snapshots: ReachSnapshot[] = input.velocity
    .filter((v) => v.views > 0)
    .map((v) => ({ ageHours: v.ageHours, reach: v.views }));
  // Current state is always the latest snapshot.
  if (ageHours != null && input.views > 0) snapshots.push({ ageHours, reach: input.views });
  if (snapshots.length > 0) notes.push("Reach proxied by views — true reach only available from creator analytics.");
  return { platform: input.platform, contentId: input.contentId, views: input.views, ageHours, snapshots, notes };
}

function aiNote(input: AdapterInput, key: keyof ManualInputs, label: string, notes: string[]): void {
  if (input.manualInputs[key] != null && input.aiEstimatedKeys.includes(key)) {
    notes.push(`${label} is an AI estimate (thumbnail/hook model), not a measured value.`);
  }
}

/** First-hour velocity normalized by followers (e_1hr ∈ [0,1]); null without followers. */
function firstHourRate(input: AdapterInput): { value: number; n: number } | null {
  const early = [...input.velocity].sort((a, b) => a.ageHours - b.ageHours).find((s) => s.ageHours > 0 && s.ageHours <= 1.5);
  if (!early || !input.creatorFollowers || input.creatorFollowers <= 0) return null;
  const v = Math.min(1, early.views / input.creatorFollowers);
  return { value: v, n: Math.round(early.views) };
}

export function toCanonical(input: AdapterInput): CanonicalMetrics {
  const notes: string[] = [];
  const common = buildCommon(input, notes);
  const m = input.manualInputs;
  const views = Math.max(1, input.views);

  const base: CanonicalMetrics = {
    ...common,
    C_comp: null, V_vs: null, H_3s: null, R_loop: null, s: null, save_rate: null,
    SPR: null, CTR: null, AVD: null, R_30s: null, v1: null, likes_per_reach: null,
    hasWatermark: null, isRepostHeavy: null, region: null, xCounts: null,
  };

  switch (input.platform) {
    case "tiktok": {
      aiNote(input, "ttCompletionPct", "Completion rate", notes);
      base.C_comp = rate(pct(m.ttCompletionPct), views);
      base.R_loop = rate(pct(m.ttRewatchPct), views);
      base.s = input.shares != null ? rate(input.shares / views, views) : null;
      base.save_rate = input.saves != null ? rate(input.saves / views, views) : null;
      const fh = firstHourRate(input);
      base.v1 = fh ? rate(fh.value, fh.n) : null;
      if (!fh) notes.push("First-hour follower velocity unavailable (no ≤90min snapshot or follower count).");
      base.region = input.region ? (input.region.toUpperCase() === "US" ? "us" : "global") : null;
      if (base.region === null) notes.push("US/global fork tag unknown for this record — compare z-scores within the current quarter only.");
      else if (base.region === "us") notes.push("US-fork record (Oracle retraining): baselines re-estimated quarterly; never compare raw views to pre-fork values.");
      break;
    }
    case "instagram": {
      base.H_3s = rate(pct(m.igHold3s), views);
      const reach = m.igReach != null && m.igReach > 0 ? m.igReach : null;
      base.SPR = reach != null && m.igSends != null ? rate(m.igSends / reach, reach) : null;
      base.save_rate = reach != null && m.igSaves != null ? rate(m.igSaves / reach, reach) : null;
      base.likes_per_reach = reach != null ? rate(input.likes / reach, reach) : null;
      if (reach == null) notes.push("Accounts-reached not on file — sends/saves/likes-per-reach unavailable (add Insights via 'Your data').");
      base.s = input.shares != null && input.shares > 0 ? rate(input.shares / views, views) : null;
      // Composite requires w_time; IG watch-time isn't exposed anywhere public.
      notes.push("Watch-time (w_time) not measurable — composite uses the skill's neutral default; gate unaffected.");
      break;
    }
    case "youtube": {
      aiNote(input, "ytCTRpct", "CTR", notes);
      const impressions = m.ytImpressions != null && m.ytImpressions > 0 ? Math.round(m.ytImpressions) : null;
      base.CTR = rate(pct(m.ytCTRpct), impressions ?? views);
      if (m.ytCTRpct != null && impressions == null) notes.push("CTR n approximated by views (impressions not on file).");
      base.AVD = rate(pct(m.ytAVDpct), views);
      base.R_30s = null; // not exposed by any current source
      notes.push("30-second retention (R_30s) not measurable — gate reports insufficient evidence; composite uses AVD-implied neutral.");
      break;
    }
    case "youtube_short": {
      aiNote(input, "ytAVDpct", "Average % viewed", notes);
      base.V_vs = null; // viewed-vs-swiped is Studio-only and not in ManualInputs
      notes.push("Viewed-vs-swiped (V_vs) has no data source — gate reports insufficient evidence.");
      base.C_comp = rate(pct(m.ytAVDpct), views);
      if (m.ytAVDpct != null) notes.push("Shorts completion proxied by average-%-viewed.");
      base.s = input.shares != null && input.shares > 0 ? rate(input.shares / views, views) : null;
      break;
    }
    case "x": {
      base.xCounts = {
        impressions: views,
        likes: input.likes,
        reposts: input.xRaw?.reposts ?? input.shares ?? 0,
        replies: input.xRaw?.replies ?? input.comments,
        quotes: input.xRaw?.quotes ?? 0,
        bookmarks: input.xRaw?.bookmarks ?? 0,
        authorReplied: null,
        profileEng: null,
        dwells: null,
        video50: null,
        mutes: null,
        reports: null,
        tweepCred: m.xTweepCred ?? null,
      };
      notes.push("X score computed from public counts only — author-replied chains, profile clicks, dwells, mutes and reports are not public; omitted terms listed per §2.1.");
      if (!input.xRaw) notes.push("Quotes/bookmarks unavailable on this record — counted as 0 in Ŝ (public-data floor).");
      break;
    }
  }

  return { ...base, notes };
}
