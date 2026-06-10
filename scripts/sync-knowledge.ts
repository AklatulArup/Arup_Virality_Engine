// ═══════════════════════════════════════════════════════════════════════════
// SYNC-KNOWLEDGE — the platform-content-virality skill is the single source
// of truth; this script makes the engine read FROM it.
// ═══════════════════════════════════════════════════════════════════════════
//
// Parses the skill's reference markdown into versioned JSON config under
// src/lib/scoring/knowledge/. Engine scoring logic NEVER hardcodes a
// threshold — when the skill updates (Mode 7 sweep edits a weight, a floor,
// the X table, the calibration stamp), re-running this script updates the
// engine with zero code changes.
//
//   npx tsx scripts/sync-knowledge.ts            (uses SKILL_DIR or default)
//   SKILL_DIR=/path/to/skill npx tsx scripts/sync-knowledge.ts
//
// Parsing is ANCHORED, not fuzzy: weights/floors come from the python
// composite defaults (`w_comp: float = 0.30`), X weights from the engagement
// table rows, constants from documented phrases. Any REQUIRED key that fails
// to parse aborts the sync loudly — never silently defaults.

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import os from "os";

const SKILL_DIR =
  process.env.SKILL_DIR ?? join(os.homedir(), ".claude", "skills", "platform-content-virality");
const OUT_DIR = join(process.cwd(), "src", "lib", "scoring", "knowledge");

// Domain A (platform algorithms) staleness threshold from the skill's
// intelligence-sweep protocol.
const DOMAIN_A_STALE_DAYS = 60;

function read(rel: string): string {
  const p = join(SKILL_DIR, rel);
  if (!existsSync(p)) {
    console.error(`✗ Skill file missing: ${p}\n  Set SKILL_DIR to the platform-content-virality install.`);
    process.exit(1);
  }
  return readFileSync(p, "utf-8");
}

function fail(msg: string): never {
  console.error(`✗ SYNC FAILED: ${msg}`);
  process.exit(1);
}

// ── generic extractors ─────────────────────────────────────────────────────

/** Numeric defaults out of a python composite signature: `name: float = 0.30`. */
function pythonDefaults(md: string): Record<string, number> {
  const block = md.match(/```python([\s\S]*?)```/)?.[1] ?? fail("no python block found");
  const out: Record<string, number> = {};
  // No line anchor — platform files declare multiple params per line
  // (`w_sat: float = 0.35, w_avd: float = 0.35,`).
  const re = /(\w+):\s*(?:float|int)\s*=\s*(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out[m[1]] = Number(m[2]);
  return out;
}

function require(obj: Record<string, number>, keys: string[], file: string): void {
  const missing = keys.filter((k) => !(k in obj) || !Number.isFinite(obj[k]));
  if (missing.length > 0) fail(`${file}: required keys not parsed: ${missing.join(", ")}`);
}

/** "0–48 hours" / "90min – 48hrs" / "1 week – 1 month" / "72hrs+" → [startH, endH|null] */
function windowToHours(raw: string): [number, number | null] {
  const txt = raw.toLowerCase().replace(/\s+/g, " ");
  const unit = (n: number, u: string) =>
    u.startsWith("min") ? n / 60 : u.startsWith("h") ? n : u.startsWith("d") ? n * 24 : u.startsWith("w") ? n * 168 : u.startsWith("month") || u === "m" ? n * 720 : NaN;
  // Open-ended phase-4 forms: "72hrs+", "1 week+ (extended…)", "1 month → years"
  const plus = txt.match(/^([\d.]+)\s*(minutes?|mins?|hours?|hrs?|hr|days?|weeks?|months?|m)\s*(?:\+|→|->)/);
  if (plus) return [unit(Number(plus[1]), plus[2]), null];
  const range = txt.match(/([\d.]+)\s*(minutes?|mins?|hours?|hrs?|hr|days?|weeks?|months?|m)?\s*[–-]\s*([\d.]+)\s*(minutes?|mins?|hours?|hrs?|hr|days?|weeks?|months?|m)/);
  if (range) {
    const endU = range[4];
    const startU = range[2] ?? endU;
    const s = unit(Number(range[1]), startU);
    const e = unit(Number(range[3]), endU);
    if (Number.isFinite(s) && Number.isFinite(e)) return [s, e];
  }
  return [NaN, null];
}

/** Phase time-windows per platform from the SKILL.md lifecycle tables. */
function parsePhaseWindows(skillMd: string): Record<string, Array<{ phase: number; startH: number; endH: number | null }>> {
  // Column order in the tables: YT Long-Form | YT Shorts | IG Reels | TikTok FYP
  const cols = ["youtube", "youtube_short", "instagram", "tiktok"] as const;
  const out: Record<string, Array<{ phase: number; startH: number; endH: number | null }>> = {
    youtube: [], youtube_short: [], instagram: [], tiktok: [],
  };
  const rows = skillMd.match(/^\|\s*Time window\s*\|.*$/gm) ?? [];
  if (rows.length < 3) fail(`SKILL.md: expected ≥3 'Time window' table rows, found ${rows.length}`);
  rows.slice(0, 4).forEach((row, idx) => {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean).slice(1); // drop label cell
    cells.forEach((cell, i) => {
      if (i >= cols.length) return;
      const [s, e] = windowToHours(cell);
      if (!Number.isFinite(s)) fail(`SKILL.md phase window unparseable: "${cell}"`);
      out[cols[i]].push({ phase: idx + 1, startH: s, endH: e });
    });
  });
  return out;
}

// ── per-source parsing ──────────────────────────────────────────────────────

const skillMd = read("SKILL.md");
const mathMd = read("references/algorithm-math.md");
const xMd = read("references/x-linkedin-algorithms.md");

const version = skillMd.match(/Virality Modeler v([\d.]+)/)?.[1] ?? fail("SKILL.md: version not found");
const stamp = skillMd.match(/Algorithm calibration:\s*([A-Za-z]+ \d{4})/)?.[1] ?? fail("SKILL.md: calibration stamp not found");

// Universal constants from algorithm-math.md
const kappa = Number(mathMd.match(/κ = pseudo-count, default (\d+)/)?.[1] ?? fail("algorithm-math: κ default"));
const sigDefaults = mathMd.match(/k=(\d+), m=([\d.]+) defaults/) ?? fail("algorithm-math: sigmoid defaults");
const premium = mathMd.match(/M_premium ≈ (\d+) \(in-network\) \/ (\d+) \(out-of-network\)/) ?? fail("algorithm-math: M_premium");

// X constants from x-linkedin-algorithms.md
const halfLife = Number(xMd.match(/half its visibility score every (\d+) hours/)?.[1] ?? fail("x file: half-life"));
const tweepFloor = Number(xMd.match(/Below (\d+) = only 3 of your posts/)?.[1] ?? fail("x file: TweepCred floor"));

// X engagement weight table (the 2023 legacy table, directionally valid for Phoenix)
function xWeight(label: RegExp, name: string): number {
  const row = xMd.split("\n").find((l) => label.test(l)) ?? fail(`x weight row not found: ${name}`);
  const m = row.match(/\|\s*[+−~]*\s*\+?(−?[\d.]+)/g);
  const num = row.match(/\|\s*(?:~)?\s*([+−])?([\d.]+)\s*(?:\(estimated\))?\s*\|/);
  if (!num) fail(`x weight value not parsed for ${name} in: ${row}`);
  const sign = num![1] === "−" ? -1 : 1;
  void m;
  return sign * Number(num![2]);
}
const xWeights = {
  authorRepliedReply: xWeight(/Reply that gets author reply back/, "authorRepliedReply"),
  quote: xWeight(/\*\*Quote tweet\*\*/, "quote"),
  reply: xWeight(/^\| \*\*Reply\*\* /, "reply"),
  profileClickEng: xWeight(/Profile click →/, "profileClickEng"),
  convoClickEng: xWeight(/Conversation click →/, "convoClickEng"),
  dwell2min: xWeight(/Dwell time \(2\+ min/, "dwell2min"),
  repost: xWeight(/\*\*Retweet\*\*/, "repost"),
  bookmark: xWeight(/\*\*Bookmark\*\*/, "bookmark"),
  like: xWeight(/\*\*Like \(favorite\)\*\*/, "like"),
  video50: xWeight(/Video watch \(50%\+\)/, "video50"),
  muteBlock: xWeight(/Mute \/ block/, "muteBlock"),
  report: xWeight(/^\| \*\*Report\*\* /, "report"),
};
// Sanity anchors from the table itself
if (xWeights.authorRepliedReply !== 75 || xWeights.report !== -369 || xWeights.like !== 0.5) {
  fail(`x weights failed sanity anchors: got ${JSON.stringify(xWeights)}`);
}

const phaseWindows = parsePhaseWindows(skillMd);

/** Phase-matched coaching lines from the SKILL.md cheat-sheet table. */
function parseCoaching(md: string): Record<string, { phase1: string; phase2: string; phase34: string }> {
  const rows: Record<string, RegExp> = {
    youtube: /^\|\s*YT Long-Form\s*\|/,
    youtube_short: /^\|\s*YT Shorts\s*\|/,
    instagram: /^\|\s*IG Reels\s*\|/,
    tiktok: /^\|\s*TikTok\s*\|/,
    x: /^\|\s*X\s*\|/,
  };
  const out: Record<string, { phase1: string; phase2: string; phase34: string }> = {};
  for (const [key, re] of Object.entries(rows)) {
    const line = md.split("\n").find((l) => re.test(l)) ?? fail(`SKILL.md cheat-sheet row missing: ${key}`);
    const cells = line.split("|").map((c) => c.trim().replace(/^"|"$/g, "")).filter(Boolean);
    if (cells.length < 4) fail(`SKILL.md cheat-sheet row malformed: ${key}`);
    out[key] = { phase1: cells[1], phase2: cells[2], phase34: cells[3] };
  }
  return out;
}
const coaching = parseCoaching(skillMd);

// Platform composite params from the four platform files
const tt = pythonDefaults(read("references/tiktok-fyp.md"));
require(tt, ["w_comp", "w_share", "w_loop", "w_save", "w_comment", "w_profile", "w_neg", "comp_floor", "loop_exponent", "e1hr_floor", "hook_floor"], "tiktok-fyp.md");

const ig = pythonDefaults(read("references/instagram-reels.md"));
require(ig, ["w_wt", "w_dm", "w_save", "w_likes", "w_loop", "w_neg", "h3s_weak", "h3s_strong", "comp_explore"], "instagram-reels.md");

const yt = pythonDefaults(read("references/youtube-longform.md"));
require(yt, ["w_sat", "w_avd", "w_ctr", "w_session", "ctr_floor", "r30s_floor"], "youtube-longform.md");

const yts = pythonDefaults(read("references/youtube-shorts.md"));
require(yts, ["w_comp", "w_loop", "w_share", "w_neg", "vvs_threshold", "vvs_k", "comp_floor", "loop_strong"], "youtube-shorts.md");

// ── emit ────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
const syncedAt = new Date().toISOString();
const universal = { kappa, wilsonZ: 1.96, sigmoidK: Number(sigDefaults[1]), sigmoidM: Number(sigDefaults[2]) };

function emit(name: string, body: unknown): void {
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
  console.log(`✓ knowledge/${name}.json`);
}

emit("_meta", {
  skillVersion: version,
  calibrationStamp: stamp,
  syncedAt,
  skillDir: SKILL_DIR,
  domainAStaleDays: DOMAIN_A_STALE_DAYS,
  universal,
});

emit("tiktok", {
  platform: "tiktok", calibrationStamp: stamp, syncedAt,
  weights: { w_comp: tt.w_comp, w_share: tt.w_share, w_loop: tt.w_loop, w_save: tt.w_save, w_comment: tt.w_comment, w_profile: tt.w_profile, w_neg: tt.w_neg },
  params: { comp_floor: tt.comp_floor, loop_exponent: tt.loop_exponent, e1hr_floor: tt.e1hr_floor, hook_floor: tt.hook_floor },
  gates: [
    { name: "C_comp", threshold: tt.comp_floor, phase: 1, kind: "rate" },
    { name: "hook_2s", threshold: tt.hook_floor, phase: 1, kind: "rate" },
    { name: "e_1hr", threshold: tt.e1hr_floor, phase: 1, kind: "rate" },
  ],
  phaseWindows: phaseWindows.tiktok,
  coaching: coaching.tiktok,
  usForkRebaselineQuarterly: true,
});

emit("instagram", {
  platform: "instagram", calibrationStamp: stamp, syncedAt,
  weights: { w_wt: ig.w_wt, w_dm: ig.w_dm, w_save: ig.w_save, w_likes: ig.w_likes, w_loop: ig.w_loop, w_neg: ig.w_neg },
  params: { h3s_weak: ig.h3s_weak, h3s_strong: ig.h3s_strong, comp_explore: ig.comp_explore },
  gates: [
    { name: "H_3s", threshold: ig.h3s_strong, weakFloor: ig.h3s_weak, phase: 1, kind: "rate" },
    { name: "originality", threshold: 1, phase: 0, kind: "binary" },
  ],
  phaseWindows: phaseWindows.instagram,
  coaching: coaching.instagram,
});

emit("youtube", {
  platform: "youtube", calibrationStamp: stamp, syncedAt,
  weights: { w_sat: yt.w_sat, w_avd: yt.w_avd, w_ctr: yt.w_ctr, w_session: yt.w_session },
  params: { ctr_floor: yt.ctr_floor, r30s_floor: yt.r30s_floor, like_rate_bonus: 0.04, comment_rate_bonus: 0.005 },
  gates: [
    { name: "CTR", threshold: 0.04, killFloor: yt.ctr_floor, phase: 1, kind: "rate" },
    { name: "R_30s", threshold: yt.r30s_floor, phase: 1, kind: "rate" },
  ],
  phaseWindows: phaseWindows.youtube,
  coaching: coaching.youtube,
  evergreen: true,
});

emit("youtube_short", {
  platform: "youtube_short", calibrationStamp: stamp, syncedAt,
  weights: { w_comp: yts.w_comp, w_loop: yts.w_loop, w_share: yts.w_share, w_neg: yts.w_neg },
  params: { vvs_threshold: yts.vvs_threshold, vvs_k: yts.vvs_k, comp_floor: yts.comp_floor, loop_strong: yts.loop_strong },
  gates: [
    { name: "V_vs", threshold: yts.vvs_threshold, phase: 1, kind: "rate" },
    { name: "C_comp", threshold: yts.comp_floor, phase: 1, kind: "rate" },
  ],
  phaseWindows: phaseWindows.youtube_short,
  coaching: coaching.youtube_short,
});

emit("x", {
  platform: "x", calibrationStamp: stamp, syncedAt,
  weights: xWeights,
  params: {
    halfLifeHours: halfLife,
    tweepCredFloor: tweepFloor,
    premiumInNetwork: Number(premium[1]),
    premiumOutOfNetwork: Number(premium[2]),
  },
  gates: [{ name: "TweepCred", threshold: tweepFloor, phase: 1, kind: "score" }],
  phaseWindows: [],
  coaching: coaching.x,
  decayModel: true,
});

// Weight provenance ledger (Phase 5 appends adopted recalibrations here).
const historyPath = join(OUT_DIR, "weights-history.jsonl");
if (!existsSync(historyPath)) {
  appendFileSync(
    historyPath,
    JSON.stringify({ event: "init", source: "skill-sync", skillVersion: version, calibrationStamp: stamp, syncedAt }) + "\n",
  );
  console.log("✓ knowledge/weights-history.jsonl (initialized)");
}

// Staleness check (Domain A = 60 days)
const stampDate = new Date(`${stamp} 1`);
const ageDays = (Date.now() - stampDate.getTime()) / 86_400_000;
if (Number.isFinite(ageDays) && ageDays > DOMAIN_A_STALE_DAYS) {
  console.warn(`⚠ STALE KNOWLEDGE: stamp "${stamp}" is ${Math.round(ageDays)} days old (Domain A threshold ${DOMAIN_A_STALE_DAYS}d). Run the skill's Mode 7 sweep, then re-sync.`);
} else {
  console.log(`✓ knowledge fresh: stamp "${stamp}" (${Math.round(ageDays)} days old)`);
}
console.log(`\nSync complete from ${SKILL_DIR}`);
