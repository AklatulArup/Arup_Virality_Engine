// ═══════════════════════════════════════════════════════════════════════════
// GATES — phase-gate verdicts under skill Implementation Rule 9
// ═══════════════════════════════════════════════════════════════════════════
//
// Verdict semantics (algorithm-math.md §1.2):
//   pass                   ⟺ Wilson LOWER bound ≥ threshold (proven at 95%)
//   fail                   ⟺ Wilson UPPER bound < threshold (proven below)
//   insufficient_evidence  ⟺ everything else — including ANY rate with
//                            n < 100 (hard rule: "no verdicts below n ≈ 100")
//                            and any metric the platform didn't expose (null).
// The worked example's C_comp p̂=0.705 / p_LB=0.659 vs 0.70 lands here as
// insufficient_evidence — "borderline-pass pending more n".

import type { CanonicalMetrics, GateResult, GateSpec, MaybeRate } from "./canon";
import { UNIVERSAL } from "./canon";
import { wilsonLbFromRate } from "./math";

export const MIN_GATE_N = 100;

/** Wilson UPPER bound (mirror of the lower bound). */
function wilsonUb(pHat: number, n: number, z: number = UNIVERSAL.wilsonZ): number {
  if (n === 0) return 1.0;
  const denom = 1 + (z * z) / n;
  const centre = pHat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((pHat * (1 - pHat)) / n + (z * z) / (4 * n * n));
  return Math.min(1.0, (centre + margin) / denom);
}

function metricFor(gate: GateSpec, m: CanonicalMetrics): MaybeRate {
  switch (gate.name) {
    case "C_comp": return m.C_comp;
    case "V_vs": return m.V_vs;
    case "H_3s": return m.H_3s;
    case "CTR": return m.CTR;
    case "R_30s": return m.R_30s;
    case "e_1hr": return m.v1;
    case "hook_2s": return null; // no 2s-retention source in any current feed
    default: return null;
  }
}

export function evaluateGates(specs: GateSpec[], m: CanonicalMetrics): GateResult[] {
  return specs.map((g) => {
    // Binary gate (IG originality): pass/fail on booleans, insufficient when unknown.
    if (g.kind === "binary") {
      const known = m.hasWatermark != null || m.isRepostHeavy != null;
      const dirty = (m.hasWatermark ?? false) || (m.isRepostHeavy ?? false);
      return {
        name: g.name,
        value: known ? (dirty ? 0 : 1) : null,
        n: null,
        wilson_lb: null,
        threshold: g.threshold,
        verdict: !known ? "insufficient_evidence" : dirty ? "fail" : "pass",
      };
    }

    // Score gate (X TweepCred): a 0–100 account score, not a sampled rate.
    if (g.kind === "score") {
      const v = m.xCounts?.tweepCred ?? null;
      return {
        name: g.name,
        value: v,
        n: null,
        wilson_lb: null,
        threshold: g.threshold,
        verdict: v == null ? "insufficient_evidence" : v >= g.threshold ? "pass" : "fail",
      };
    }

    // Rate gate with Wilson confidence.
    const r = metricFor(g, m);
    if (r == null) {
      return { name: g.name, value: null, n: null, wilson_lb: null, threshold: g.threshold, verdict: "insufficient_evidence" };
    }
    const lb = wilsonLbFromRate(r.value, r.n);
    if (r.n < MIN_GATE_N) {
      return { name: g.name, value: r.value, n: r.n, wilson_lb: lb, threshold: g.threshold, verdict: "insufficient_evidence" };
    }
    const ub = wilsonUb(r.value, r.n);
    const verdict = lb >= g.threshold ? "pass" : ub < g.threshold ? "fail" : "insufficient_evidence";
    return { name: g.name, value: r.value, n: r.n, wilson_lb: lb, threshold: g.threshold, verdict };
  });
}

/** Weakest measured gate = smallest (wilson_lb − threshold) margin; failures first. */
export function weakestGate(results: GateResult[]): string | null {
  const failed = results.find((r) => r.verdict === "fail");
  if (failed) return failed.name;
  const measured = results.filter((r) => r.wilson_lb != null);
  if (measured.length === 0) {
    const insufficient = results.find((r) => r.verdict === "insufficient_evidence");
    return insufficient?.name ?? null;
  }
  measured.sort((a, b) => (a.wilson_lb! - a.threshold) - (b.wilson_lb! - b.threshold));
  return measured[0].name;
}
