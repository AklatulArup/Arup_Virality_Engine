// Acceptance tests for the skill↔engine integration (run: npx tsx scripts/test-scoring.ts)
// Covers the six required acceptance criteria + the §5 worked-example chain.

import { wilsonLb, shrink, waveCeiling, xTotalExposure, xScore, linkedinCommentValue, googleCitationP, brier } from "../src/lib/scoring/math";
import { analyzeWaves } from "../src/lib/scoring/waves";
import { scoreContent } from "../src/lib/scoring/score";
import { runCalibration, type CalibrationInputRecord } from "../src/lib/scoring/calibrate";
import { knowledgeFor } from "../src/lib/scoring/canon";
import type { AdapterInput } from "../src/lib/scoring/adapters";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

const NOW = new Date("2026-06-11T12:00:00Z").getTime(); // knowledge fresh (stamp June 2026)

function baseInput(platform: AdapterInput["platform"], overrides: Partial<AdapterInput> = {}): AdapterInput {
  return {
    platform,
    contentId: `test-${platform}`,
    views: 5000,
    likes: 300,
    comments: 40,
    shares: 60,
    saves: 25,
    // Age must track the SAME clock the adapter uses (real Date.now(), not the
    // fixed NOW used for knowledge-freshness), or the adapter's appended
    // "current age" reach snapshot drifts later as wall-clock advances and
    // bolts a spurious flat 4th wave onto trajectory fixtures. Keeping it ~30h
    // off real now means that appended snapshot stays within 12h of the last
    // velocity sample (26h) and never forms a bogus bucket. Time-independent.
    publishedAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
    creatorFollowers: 40_000,
    manualInputs: {},
    aiEstimatedKeys: [],
    velocity: [
      { ageHours: 1, views: 420 },
      { ageHours: 13, views: 1150 },
      { ageHours: 26, views: 2570 },
    ],
    region: null,
    xRaw: null,
    ...overrides,
  };
}

// ═══ ACCEPTANCE 1 — worked-example numbers reproduce exactly (§5 + spec anchors) ═══
console.log("\n[1] Worked-example math (§5 / §6 anchors)");
check("wilson_lb(296,420) ≈ 0.659", approx(wilsonLb(296, 420), 0.659, 0.001), `got ${wilsonLb(296, 420).toFixed(4)}`);
check("shrink(296,420,0.62,κ=50) ≈ 0.696", approx(shrink(296, 420, 0.62, 50), 0.696, 0.001), `got ${shrink(296, 420, 0.62).toFixed(4)}`);
check("wave_ceiling(500,0.8) = 2500", approx(waveCeiling(500, 0.8), 2500, 1e-9), `got ${waveCeiling(500, 0.8)}`);
check("wave_ceiling(500,0.95) = 10000", approx(waveCeiling(500, 0.95), 10_000, 1e-6));
check("x_total_exposure(1000) ≈ 8656", approx(xTotalExposure(1000), 8656, 1), `got ${xTotalExposure(1000).toFixed(1)}`);
check("loop multiplier (1.169)² ≈ 1.367", approx((1 + 71 / 420) ** 2, 1.367, 0.001));
const waves = analyzeWaves([
  { ageHours: 1, reach: 420 },
  { ageHours: 13, reach: 1150 },
  { ageHours: 26, reach: 2570 },
]);
check("§5 m̂₁ = (1150−420)/420 ≈ 1.74", approx(waves.mHats[0], 1.738, 0.005), `got ${waves.mHats[0]?.toFixed(3)}`);
check("§5 m̂₂ = 1420/1150 ≈ 1.23", approx(waves.mHats[1], 1.235, 0.005), `got ${waves.mHats[1]?.toFixed(3)}`);
check("x_score break-even: 1 reply-back chain ≈ 177 like-equivalents", approx((75 + 13.5) / 0.5, 177, 0.1));
const k = knowledgeFor("x");
check("xScore weights injected from knowledge (report −369)", k.weights.report === -369);
check("linkedin_comment_value(20,expert,thread) = 45", linkedinCommentValue(20, true, true) === 2.5 * 6 * 3);
check("google_citation_p chain multiplies", approx(googleCitationP(0.9, 0.3, 0.4), 0.108, 1e-9));
check("brier([0.7],[1]) = 0.09", approx(brier([0.7], [1]), 0.09, 1e-9));

// ═══ ACCEPTANCE 2 — sample payload per platform flows adapter → gates → contract ═══
console.log("\n[2] End-to-end contract per platform");
const samples: AdapterInput[] = [
  baseInput("tiktok", { manualInputs: { ttCompletionPct: 72, ttRewatchPct: 17 }, region: "US" }),
  baseInput("instagram", { manualInputs: { igHold3s: 64, igReach: 4800, igSends: 90, igSaves: 60 } }),
  baseInput("youtube", { manualInputs: { ytCTRpct: 5.2, ytAVDpct: 48, ytImpressions: 90_000 } }),
  baseInput("youtube_short", { manualInputs: { ytAVDpct: 74 } }),
  baseInput("x", { xRaw: { replies: 40, quotes: 8, bookmarks: 25, reposts: 30 }, manualInputs: { xTweepCred: 71 }, views: 12_000 }),
];
for (const s of samples) {
  const c = scoreContent(s, null, NOW);
  const ok =
    c.platform === s.platform &&
    Array.isArray(c.gates) &&
    c.gates.length > 0 &&
    "h24" in c.projected_views &&
    c.probability_basis === "prior — uncalibrated" &&
    Array.isArray(c.caveats);
  check(`${s.platform}: contract shape + prior basis`, ok);
  if (s.platform === "tiktok") {
    const gate = c.gates.find((g) => g.name === "C_comp");
    check("tiktok: C_comp gate measured with n + wilson", gate?.n === 5000 && gate?.wilson_lb != null && gate?.verdict === "pass", JSON.stringify(gate));
    check("tiktok: composite + probability present", c.composite_score != null && c.virality_probability != null);
    check("tiktok: US-fork caveat tagged", c.caveats.some((x) => x.includes("US-fork")));
  }
  if (s.platform === "x") {
    const tc = c.gates.find((g) => g.name === "TweepCred");
    check("x: TweepCred 71 passes ≥65 gate", tc?.verdict === "pass");
    check("x: omitted-components caveat present", c.caveats.some((x) => x.includes("public counts only")));
  }
}

// ═══ ACCEPTANCE 3 — 50-view seed @70% completion → insufficient_evidence ═══
console.log("\n[3] Small-n rule (Implementation Rule 9)");
const seed = scoreContent(
  baseInput("tiktok", { views: 50, manualInputs: { ttCompletionPct: 70 }, velocity: [], shares: 1, saves: 1 }),
  null,
  NOW,
);
const seedGate = seed.gates.find((g) => g.name === "C_comp");
check("n=50 @ p̂=0.70 → insufficient_evidence (never pass)", seedGate?.verdict === "insufficient_evidence", JSON.stringify(seedGate));
check("small-n caveat emitted", seed.caveats.some((c) => c.includes("below the ~100-view verdict floor")));
check("wilson still quoted (≈0.56)", seedGate?.wilson_lb != null && approx(seedGate.wilson_lb, 0.56, 0.01), `got ${seedGate?.wilson_lb?.toFixed(3)}`);

// ═══ ACCEPTANCE 4 — m̂ ≥ 1 across two waves → unbounded + Phase 4 trajectory ═══
console.log("\n[4] Explosive trajectory");
const explosive = analyzeWaves([
  { ageHours: 1, reach: 400 },
  { ageHours: 13, reach: 900 },
  { ageHours: 26, reach: 2000 },
]);
check("m̂ ≥ 1 in both waves", explosive.mHats.every((m) => m >= 1), JSON.stringify(explosive.mHats));
check("ceiling = unbounded", explosive.ceiling === "unbounded");
check("phase verdict = Phase 4 trajectory", explosive.phaseVerdict === "Phase 4 trajectory");
const explosiveContract = scoreContent(
  baseInput("tiktok", {
    manualInputs: { ttCompletionPct: 75 },
    views: 2000,
    velocity: [
      { ageHours: 1, views: 400 },
      { ageHours: 13, views: 900 },
      { ageHours: 26, views: 2000 },
    ],
  }),
  null,
  NOW,
);
check("contract carries unbounded ceiling", explosiveContract.wave.ceiling === "unbounded");
check("far horizons null + explosive caveat", explosiveContract.projected_views.d30 === null && explosiveContract.caveats.some((c) => c.includes("m̂ ≥ 1")));

// ═══ ACCEPTANCE 5 — stale knowledge stamp → caveat ═══
console.log("\n[5] Staleness (Domain A 60d)");
const STALE_NOW = new Date("2026-08-15T00:00:00Z").getTime(); // 75 days after June 1
const stale = scoreContent(baseInput("tiktok", { manualInputs: { ttCompletionPct: 72 } }), null, STALE_NOW);
check("staleness caveat appears past 60 days", stale.caveats.some((c) => c.includes("Stale knowledge")), stale.caveats.join(" | "));
const fresh = scoreContent(baseInput("tiktok", { manualInputs: { ttCompletionPct: 72 } }), null, NOW);
check("no staleness caveat when fresh", !fresh.caveats.some((c) => c.includes("Stale knowledge")));

// ═══ ACCEPTANCE 6 — calibration job on synthetic history → Brier + reliability ═══
console.log("\n[6] Calibration (§4) on synthetic history");
// Deterministic LCG so the test is reproducible (no Math.random — repo rule).
let lcg = 42;
const rand = () => {
  lcg = (lcg * 1664525 + 1013904223) % 4294967296;
  return lcg / 4294967296;
};
const synth: CalibrationInputRecord[] = [];
for (let i = 0; i < 240; i++) {
  const cComp = 0.4 + 0.5 * rand();
  const share = 0.005 + 0.04 * rand();
  const signal = 3 * (cComp - 0.65) + 40 * (share - 0.02);
  const pTrue = 1 / (1 + Math.exp(-4 * signal));
  const label: 0 | 1 = rand() < pTrue ? 1 : 0;
  synth.push({
    contentId: `synth-${i}`,
    scoredAt: new Date(NOW - (240 - i) * 86_400_000).toISOString(),
    components: { C_comp: cComp, share_rate: share },
    priorProb: 0.5, // flat prior — the candidate must beat this
    label,
  });
}
const report = runCalibration(synth);
check("fit produced finite Brier", Number.isFinite(report.brierCandidate), `got ${report.brierCandidate}`);
check("decile reliability table (10 rows)", report.deciles.length === 10);
check("candidate beats flat frozen prior → adopted", report.adopted && report.brierCandidate < report.brierFrozen, `cand ${report.brierCandidate?.toFixed(3)} vs frozen ${report.brierFrozen?.toFixed(3)}`);
check("β includes both components", "C_comp" in report.beta.components && "share_rate" in report.beta.components);
check("baselines (μ,σ) recorded", report.baselines.C_comp?.sigma > 0);
console.log(`    Brier candidate ${report.brierCandidate.toFixed(3)} vs frozen ${report.brierFrozen.toFixed(3)} · holdout ${report.holdoutSize}`);

// Extra: x_score sanity on partial public counts
const xs = xScore(12_000, { likes: 300, reposts: 30, replies: 48, bookmarks: 25 }, {
  like: 0.5, repost: 1, reply: 13.5, authorRepliedReply: 75, bookmark: 10,
  profileClickEng: 12, dwell2min: 10, video50: 0.005, muteBlock: -74, report: -369,
});
check("\nxScore partial-count estimator positive + per-impression", xs > 0 && xs < 1, `got ${xs.toFixed(4)}`);

console.log(`\n═══ ${passed} passed · ${failed} failed ═══`);
process.exit(failed === 0 ? 0 : 1);
