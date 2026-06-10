// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITES — the four phase-gated platform scores, ported VERBATIM from the
// skill's platform files. Weights/floors are injected from synced knowledge
// (scripts/sync-knowledge.ts) — nothing here is hardcoded, so a skill update
// + re-sync changes scoring with zero code changes (Implementation Rule 2).
// ═══════════════════════════════════════════════════════════════════════════
//
// Sources: tiktok-fyp.md, instagram-reels.md, youtube-longform.md,
// youtube-shorts.md (python blocks). Structure, branch order, and constants
// mirror the python exactly; only syntax is TS. Inputs use the skill's python
// parameter defaults when a metric is unavailable — the gate layer separately
// reports those absences as insufficient_evidence/caveats (the composite
// itself follows the skill's stated defaults).

import { knowledgeFor } from "./canon";
import { sigmoid } from "./math";

export function tiktokFyp(
  inputs: {
    c_comp: number;
    e_1hr: number;
    hook_2s?: number;
    r_loop?: number;
    share?: number;
    save?: number;
    comment_quality?: number;
    profile_clicks?: number;
    exit_rate?: number;
    neg?: number;
  },
  k = knowledgeFor("tiktok"),
): number {
  const { w_comp, w_share, w_loop: _w_loop, w_save, w_comment, w_profile, w_neg } = k.weights;
  void _w_loop; // loop mass is applied through the exponent multiplier, per the skill source
  const { comp_floor, loop_exponent, e1hr_floor, hook_floor } = k.params;
  const hook_2s = inputs.hook_2s ?? 0.7;
  const r_loop = inputs.r_loop ?? 0.0;
  const share = inputs.share ?? 0.0;
  const save = inputs.save ?? 0.0;
  const comment_quality = inputs.comment_quality ?? 0.0;
  const profile_clicks = inputs.profile_clicks ?? 0.0;
  const exit_rate = inputs.exit_rate ?? 0.0;
  const neg = inputs.neg ?? 0.0;

  // --- PRE-GATE: Hook (2-second survival) ---
  if (hook_2s < hook_floor) {
    return sigmoid(hook_2s * 0.1); // Near-zero: scrolled past
  }

  // --- PHASE 1 GATE: Completion + First-Hour Velocity ---
  const comp_score = inputs.c_comp >= comp_floor ? inputs.c_comp : inputs.c_comp * (inputs.c_comp / comp_floor); // quadratic penalty

  const velocity_gate = inputs.e_1hr < e1hr_floor ? (inputs.e_1hr / e1hr_floor) ** 2 : Math.min(1.0, inputs.e_1hr / 0.5);

  // --- PHASE 2: Loop compounding + shares + saves ---
  const loop_multiplier = (1.0 + r_loop) ** loop_exponent;

  // --- PHASE 3: Session Value ---
  const session_value = (1.0 + w_profile * profile_clicks) / (1.0 + exit_rate + neg);

  // --- COMPOSITE ---
  const retention_core = comp_score * loop_multiplier;
  const engagement = w_share * share + w_save * save + w_comment * comment_quality;
  const neg_penalty = Math.max(0.1, 1.0 - w_neg * neg);

  const raw = velocity_gate * (w_comp * retention_core + engagement) * session_value * neg_penalty;
  return sigmoid(raw);
}

export function instagramReels(
  inputs: {
    h_3s: number;
    w_time: number;
    has_watermark?: boolean;
    is_repost_heavy?: boolean;
    dm_share?: number;
    save?: number;
    likes_per_reach?: number;
    c_comp?: number;
    r_loop?: number;
    neg?: number;
  },
  k = knowledgeFor("instagram"),
): number {
  const { w_wt, w_dm, w_save, w_likes, w_loop, w_neg } = k.weights;
  const { h3s_weak, h3s_strong, comp_explore } = k.params;
  const has_watermark = inputs.has_watermark ?? false;
  const is_repost_heavy = inputs.is_repost_heavy ?? false;
  const dm_share = inputs.dm_share ?? 0.0;
  const save = inputs.save ?? 0.0;
  const likes_per_reach = inputs.likes_per_reach ?? 0.0;
  const c_comp = inputs.c_comp ?? 0.5;
  const r_loop = inputs.r_loop ?? 0.0;
  const neg = inputs.neg ?? 0.0;

  // --- ORIGINALITY GATE (pre-Phase 1) ---
  if (has_watermark || is_repost_heavy) {
    return sigmoid(0.02); // Effectively dead — excluded from recommendations
  }

  // --- PHASE 1 GATE: H_3s (hook strength) ---
  let gate: number;
  if (inputs.h_3s < h3s_weak) {
    gate = (inputs.h_3s / h3s_weak) ** 2;
  } else if (inputs.h_3s >= h3s_strong) {
    gate = 1.0 + 0.5 * ((inputs.h_3s - h3s_strong) / (1.0 - h3s_strong)); // 5-10x bonus
  } else {
    gate = 0.5 + 0.5 * ((inputs.h_3s - h3s_weak) / (h3s_strong - h3s_weak));
  }

  // --- PHASE 2 CORE: DM sends + watch time + saves ---
  const explore_bonus = c_comp >= comp_explore ? 1.2 : 0.8;

  const intent = w_wt * inputs.w_time + w_dm * dm_share + w_save * save + w_likes * likes_per_reach + w_loop * r_loop;

  const neg_penalty = 1.0 - w_neg * neg;

  const raw = gate * intent * explore_bonus * neg_penalty;
  return sigmoid(raw);
}

export function youtubeLongForm(
  inputs: {
    ctr: number;
    r_30s: number;
    avd: number;
    s_sat: number;
    session: number;
    search_match?: number;
    like_rate?: number;
    comment_rate?: number;
    neg_ni?: number;
  },
  k = knowledgeFor("youtube"),
): number {
  const { w_sat, w_avd, w_ctr, w_session } = k.weights;
  const { ctr_floor, r30s_floor, like_rate_bonus, comment_rate_bonus } = k.params;
  const search_match = inputs.search_match ?? 0.0;
  const like_rate = inputs.like_rate ?? 0.04;
  const comment_rate = inputs.comment_rate ?? 0.005;
  const neg_ni = inputs.neg_ni ?? 0.0;

  // --- PHASE 1 GATE: CTR + Quality CTR ---
  if (inputs.ctr < ctr_floor) {
    return sigmoid(inputs.ctr * 0.1); // Near-zero: packaging failed
  }

  const phase1_gate = inputs.r_30s < r30s_floor ? (inputs.r_30s / r30s_floor) ** 2 : 1.0;

  // Engagement bonus
  const eng_bonus = like_rate >= like_rate_bonus && comment_rate >= comment_rate_bonus ? 1.15 : 1.0;

  // --- PHASE 2 CORE: Satisfaction + Retention ---
  const phase2_core = w_sat * inputs.s_sat + w_avd * inputs.avd + w_ctr * inputs.ctr + w_session * inputs.session;

  // --- PHASE 3+: Search bonus (additive, not gating) ---
  const search_bonus = 0.05 * search_match;

  const neg_penalty = 1.0 - 0.5 * neg_ni;

  const raw = phase1_gate * phase2_core * eng_bonus * neg_penalty + search_bonus;
  return sigmoid(raw);
}

export function youtubeShorts(
  inputs: {
    v_vs: number;
    c_comp: number;
    r_loop: number;
    share_cross: number;
    neg?: number;
  },
  k = knowledgeFor("youtube_short"),
): number {
  const { w_comp, w_loop, w_share, w_neg } = k.weights;
  const { vvs_threshold, vvs_k, comp_floor, loop_strong } = k.params;
  const neg = inputs.neg ?? 0.0;

  // --- PHASE 1 GATE: V_vs binary gate ---
  const gate =
    inputs.v_vs < vvs_threshold
      ? (inputs.v_vs / vvs_threshold) ** vvs_k // sharp decay
      : 0.7 + 0.3 * ((inputs.v_vs - vvs_threshold) / (1.0 - vvs_threshold));

  // --- PHASE 1: Completion rate ---
  const c_effective = inputs.c_comp >= comp_floor ? inputs.c_comp : inputs.c_comp * (inputs.c_comp / comp_floor); // quadratic penalty

  // --- PHASE 2: Loop + shares ---
  const loop_bonus = inputs.r_loop > 0 ? 1.0 + (inputs.r_loop / loop_strong) * 0.3 : 1.0;

  // --- Composite ---
  const content = w_comp * c_effective + w_loop * inputs.r_loop * loop_bonus + w_share * inputs.share_cross;
  const neg_penalty = 1.0 - w_neg * neg;

  const raw = gate * content * neg_penalty;
  return sigmoid(raw);
}
