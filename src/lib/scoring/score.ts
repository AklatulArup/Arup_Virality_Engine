// ═══════════════════════════════════════════════════════════════════════════
// SCORE — the orchestrator: canonical metrics → gates → composite → waves →
// the Phase-4 prediction contract.
// ═══════════════════════════════════════════════════════════════════════════
//
// Probability basis: composite scores are PRIORS ("prior — uncalibrated")
// until the §4 calibration loop has fitted and adopted β on engine outcomes;
// then probability = σ(β₀ + Σ βᵢ·zᵢ) with (μ,σ) from the calibration record.

import type { AdapterInput } from "./adapters";
import { toCanonical } from "./adapters";
import type { CanonicalMetrics, PredictionContract, PlatformKnowledge } from "./canon";
import { knowledgeFor, knowledgeMeta, knowledgeAgeDays, knowledgeIsStale } from "./canon";
import { evaluateGates, weakestGate } from "./gates";
import { tiktokFyp, instagramReels, youtubeLongForm, youtubeShorts } from "./composites";
import { xScore, xTotalExposure, sigmoid } from "./math";
import { analyzeWaves, projectViews } from "./waves";

export interface CalibrationRecord {
  adoptedAt: string;
  beta: { intercept: number; components: Record<string, number> };
  baselines: Record<string, { mu: number; sigma: number }>;
  brier: number;
  sampleSize: number;
}

/** The component vector calibration regresses on (per-platform composite inputs). */
export function componentVector(m: CanonicalMetrics): Record<string, number> {
  const out: Record<string, number> = {};
  const put = (k: string, v: number | null | undefined) => {
    if (v != null && Number.isFinite(v)) out[k] = v;
  };
  put("C_comp", m.C_comp?.value);
  put("V_vs", m.V_vs?.value);
  put("H_3s", m.H_3s?.value);
  put("R_loop", m.R_loop?.value);
  put("share_rate", m.s?.value);
  put("save_rate", m.save_rate?.value);
  put("SPR", m.SPR?.value);
  put("CTR", m.CTR?.value);
  put("AVD", m.AVD?.value);
  put("v1", m.v1?.value);
  if (m.xCounts) {
    put("x_reply_rate", m.xCounts.replies / Math.max(1, m.xCounts.impressions));
    put("x_bookmark_rate", m.xCounts.bookmarks / Math.max(1, m.xCounts.impressions));
  }
  return out;
}

function compositeFor(m: CanonicalMetrics, k: PlatformKnowledge): number | null {
  switch (m.platform) {
    case "tiktok": {
      if (m.C_comp == null) return null; // completion is the spine; without it the composite is fiction
      return tiktokFyp({
        c_comp: m.C_comp.value,
        e_1hr: m.v1?.value ?? k.params.e1hr_floor, // neutral: exactly at floor when unknown
        r_loop: m.R_loop?.value ?? 0,
        share: m.s?.value ?? 0,
        save: m.save_rate?.value ?? 0,
      });
    }
    case "instagram": {
      if (m.H_3s == null) return null;
      return instagramReels({
        h_3s: m.H_3s.value,
        w_time: 0.5, // skill-neutral default; noted in caveats by the adapter
        has_watermark: m.hasWatermark ?? false,
        is_repost_heavy: m.isRepostHeavy ?? false,
        dm_share: m.SPR?.value ?? 0,
        save: m.save_rate?.value ?? 0,
        likes_per_reach: m.likes_per_reach?.value ?? 0,
      });
    }
    case "youtube": {
      if (m.CTR == null || m.AVD == null) return null;
      return youtubeLongForm({
        ctr: m.CTR.value,
        r_30s: m.R_30s?.value ?? Math.min(1, m.AVD.value * 1.4), // AVD-implied neutral (noted)
        avd: m.AVD.value,
        s_sat: 0.5,
        session: 0.5,
      });
    }
    case "youtube_short": {
      if (m.C_comp == null) return null;
      return youtubeShorts({
        v_vs: m.V_vs?.value ?? k.params.vvs_threshold, // neutral: exactly at threshold when unknown
        c_comp: m.C_comp.value,
        r_loop: m.R_loop?.value ?? 0,
        share_cross: m.s?.value ?? 0,
      });
    }
    case "x": {
      if (!m.xCounts) return null;
      const sHat = xScore(m.xCounts.impressions, {
        likes: m.xCounts.likes,
        reposts: m.xCounts.reposts,
        replies: m.xCounts.replies + m.xCounts.quotes, // quotes carry reply-class weight floor
        bookmarks: m.xCounts.bookmarks,
      }, k.weights as never);
      // Ŝ is per-impression score; squash around a modest midpoint so typical
      // posts land mid-range (Ŝ ~ 0.02–0.1 for healthy posts).
      return sigmoid(sHat, 0.05, 30);
    }
  }
}

function pickCoaching(k: PlatformKnowledge, ageHours: number | null, phaseVerdict: string | null): string | null {
  if (!k.coaching) return null;
  if (phaseVerdict?.startsWith("Phase 4") || phaseVerdict?.startsWith("Phase 3")) return k.coaching.phase34;
  if (ageHours == null) return k.coaching.phase1;
  const w = k.phaseWindows;
  const inPhase = w.find((p) => ageHours >= p.startH && (p.endH == null || ageHours < p.endH));
  const phase = inPhase?.phase ?? (w.length > 0 ? 4 : 1);
  return phase <= 1 ? k.coaching.phase1 : phase === 2 ? k.coaching.phase2 : k.coaching.phase34;
}

export function scoreContent(input: AdapterInput, calibration: CalibrationRecord | null, now: number): PredictionContract {
  const k = knowledgeFor(input.platform);
  const m = toCanonical(input);
  const gates = evaluateGates(k.gates, m);
  const composite = compositeFor(m, k);
  const wave = analyzeWaves(m.snapshots);
  const projections = projectViews({
    isDecayPlatform: input.platform === "x",
    halfLifeHours: k.params.halfLifeHours,
    currentViews: m.views,
    ageHours: m.ageHours,
    snapshots: m.snapshots,
    wave,
  });

  const caveats: string[] = [...m.notes];

  // Probability: calibrated when a record exists AND covers this platform's components.
  let probability: number | null = composite;
  let basis: PredictionContract["probability_basis"] = "prior — uncalibrated";
  if (calibration && composite != null) {
    const comps = componentVector(m);
    let lin = calibration.beta.intercept;
    let used = 0;
    for (const [key, b] of Object.entries(calibration.beta.components)) {
      const v = comps[key];
      const base = calibration.baselines[key];
      if (v != null && base && base.sigma > 0) {
        lin += b * ((v - base.mu) / base.sigma);
        used++;
      }
    }
    if (used > 0) {
      probability = 1 / (1 + Math.exp(-lin));
      basis = "calibrated";
    } else {
      caveats.push("Calibration record exists but covers none of this post's measured components — probability remains a prior.");
    }
  }

  // Wave caveats
  const lastM = wave.mHats[wave.mHats.length - 1];
  if (wave.mHats.length > 0 && lastM >= 1) {
    caveats.push("m̂ ≥ 1 — no ceiling while sharing sustains; far-horizon projections undefined (short horizons extended geometrically).");
  }
  if (wave.waves.length === 0) {
    caveats.push("No wave snapshots ≥12h apart yet — ceiling and projections need the hourly tracker to accumulate.");
  }

  // Small-n + insufficiency caveats
  for (const g of gates) {
    if (g.verdict === "insufficient_evidence" && g.n != null && g.n < 100) {
      caveats.push(`${g.name}: n=${g.n} is below the ~100-view verdict floor (±10pp noise band).`);
    }
  }

  // Knowledge staleness (acceptance #5)
  if (knowledgeIsStale(now)) {
    const meta = knowledgeMeta();
    caveats.push(
      `Stale knowledge: skill calibration stamp "${meta.calibrationStamp}" is ${Math.round(knowledgeAgeDays(now))} days old (> ${meta.domainAStaleDays}d Domain-A threshold) — run the skill's Mode 7 sweep, then re-sync.`,
    );
  }

  if (composite == null) {
    caveats.push("Composite unavailable: the platform's spine metric (completion/hold/CTR) is not on file — add creator analytics via 'Your data'.");
  }

  // X bonus context: total-exposure arithmetic when we have a first-hour read.
  if (input.platform === "x" && m.snapshots.length > 0) {
    const first = [...m.snapshots].sort((a, b) => a.ageHours - b.ageHours)[0];
    if (first.ageHours <= 3) {
      const v0 = first.reach / Math.max(first.ageHours, 1);
      caveats.push(`X decay math: first-hour rate ≈ ${Math.round(v0).toLocaleString()}/h ⇒ lifetime exposure ≈ ${Math.round(xTotalExposure(v0, k.params.halfLifeHours)).toLocaleString()} (1.443·v₀·h).`);
    }
  }

  return {
    platform: input.platform,
    content_id: input.contentId,
    scored_at: new Date(now).toISOString(),
    gates,
    composite_score: composite,
    virality_probability: probability,
    probability_basis: basis,
    wave: { m_hat_per_wave: wave.mHats.map((x) => Math.round(x * 1000) / 1000), ceiling: wave.ceiling },
    projected_views: projections,
    weakest_gate: weakestGate(gates),
    coaching: pickCoaching(k, m.ageHours, wave.phaseVerdict) ,
    caveats,
  };
}
