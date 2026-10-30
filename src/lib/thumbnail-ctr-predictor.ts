// ═══════════════════════════════════════════════════════════════════════════
// THUMBNAIL CTR PREDICTOR
// ═══════════════════════════════════════════════════════════════════════════
//
// Gemini Vision scores a YouTube / Shorts thumbnail against the 20-point
// weighted checklist from `thumbnail-deep-analysis.md`, then maps that score
// to an estimated click-through rate. The estimate auto-fills the
// `manualInputs.ytCTRpct` field in the forecast when the RM hasn't provided
// an actual YouTube Studio CTR number.
//
// WHY VIEW PREDICTION NEEDS THIS
// ------------------------------
// CTR is a Tier 1 ranking signal on YouTube (9-point weight in VRS). The
// forecast engine already consumes `ytCTRpct` as a strong upside multiplier
// via `applyManualAdjustments`. But in practice this field is almost always
// null — RMs rarely have a partner's Creator Studio CTR on hand. That means
// thumbnail quality, which materially changes views, is invisible to the
// forecast for long-form YouTube and partially invisible on Shorts.
//
// Scoring the thumbnail from the image itself closes that gap. It's an
// ESTIMATE, not a measurement, so the forecast tracks it separately via
// `aiEstimatedKeys` and excludes it from the "provided manual inputs"
// confidence bump. The VALUE still flows through so the forecast benefits.
//
// CHECKLIST
// ---------
// The 12-criterion / 20-point rubric comes verbatim from the reference doc:
// emotional face (2pt), face gaze (1pt), color contrast (2pt), color
// psychology (1pt), single focal point (2pt), text hook (2pt), mobile
// readability (2pt), visual-promise alignment (2pt), differentiation (1pt),
// brand consistency (1pt), curiosity trigger (2pt), clean composition (2pt).
// Total: 20 possible points.
//
// SCORE → CTR MAPPING
// -------------------
// Derived from the doc's interpretive bands:
//   18-20: exceptional packaging → 8-11% CTR (viral-ready)
//   14-17: strong                → 5-8%
//   10-13: average               → 3-5%
//    < 10: weak                  → 1-3%
// Midpoints used for the point estimate. Confidence is "high" when Gemini
// marks at least 10 criteria as clearly assessable, "medium" otherwise.

import { fetchGemini, GEMINI_MODEL } from "./gemini-keys";

export interface ThumbnailCriterionScore {
  name:   string;
  weight: number;       // max points for this criterion (1 or 2)
  points: number;       // Gemini's assessment, 0..weight
  note?:  string;
}

export interface ThumbnailScore {
  totalPoints:    number;                           // 0 – 20
  maxPoints:      number;                           // = 20 (future-safe)
  percent:        number;                           // totalPoints / maxPoints × 100
  estimatedCTR:   number;                           // 0 – 100, same unit as manual ytCTRpct
  ctrConfidence:  "high" | "medium" | "low";
  rationale:      string;                           // one sentence summary
  perCriterion:   ThumbnailCriterionScore[];
}

// ─── GEMINI VISION CALL ──────────────────────────────────────────────────

export async function scoreThumbnail(
  imageBase64: string,
  mimeType:    string,
): Promise<{ ok: true; score: ThumbnailScore } | { ok: false; reason: string; detail?: string }> {
  // Uses the shared fetchGemini helper so multi-key rotation kicks in
  // automatically — all configured GEMINI_API_KEY / _2 / _3 / ... are
  // tried in round-robin, with automatic fallthrough on 429/403.
  const gem = await fetchGemini({
    model: GEMINI_MODEL,   // Vision calls need full Flash, not Lite
    bodyJson: {
      contents: [{
        role:  "user",
        parts: [
          { text: buildPrompt() },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature:      0.0,
        maxOutputTokens:  1024,
        responseMimeType: "application/json",
      },
    },
  });
  if (!gem.ok || !gem.response) {
    return {
      ok: false,
      reason: gem.reason === "no_keys" ? "gemini_not_configured" : "gemini_error",
      detail: gem.lastError ?? `attempts: ${gem.attempts ?? 0}`,
    };
  }
  const gemRes = gem.response;

  if (!gemRes.ok) {
    const errText = await gemRes.text().catch(() => "unknown");
    return { ok: false, reason: "gemini_error", detail: errText.slice(0, 200) };
  }

  const gemData = await gemRes.json();
  const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = safeJsonParse(raw);
  if (!parsed) return { ok: false, reason: "gemini_parse_failed", detail: raw.slice(0, 200) };

  return { ok: true, score: normalise(parsed) };
}

// ─── PROMPT ──────────────────────────────────────────────────────────────

function buildPrompt(): string {
  return `You are scoring a YouTube thumbnail for click-through-rate prediction. Use the 20-point weighted checklist from creator-economy research:

CRITERIA (score each out of its max weight):
1. emotionalFace (max 2) — authentic emotional face. 2 = strong genuine expression matching content; 1 = present but weak/exaggerated; 0 = no face / fake-looking.
2. faceGaze (max 1) — face looking toward text or subject draws attention there. 1 = helpful gaze; 0 = no face, gaze away, or irrelevant.
3. colorContrast (max 2) — subject pops against background, passes grayscale test. 2 = clear; 1 = adequate; 0 = blends in.
4. colorPsychology (max 1) — color matches emotional tone (warm for excitement, cool for trust). 1 = matches; 0 = mismatch or no deliberate palette.
5. singleFocalPoint (max 2) — one dominant element commands attention. 2 = clear single focus; 1 = two competing; 0 = cluttered.
6. textHook (max 2) — 3-5 words max, adds NEW context (does NOT repeat title), readable at 150px. 2 = excellent; 1 = present but weak / too long; 0 = no text or title-repeat.
7. mobileReadability (max 2) — every element clear at 150px width. 2 = all clear; 1 = partial; 0 = unreadable.
8. visualPromiseAlignment (max 2) — energy matches the likely content payoff. 2 = aligned; 1 = slightly off; 0 = bait-and-switch feel.
9. differentiation (max 1) — stands out from likely competitor thumbnails in the niche. 1 = distinctive; 0 = generic.
10. brandConsistency (max 1) — recognisable style (font, colour, layout pattern). 1 = consistent; 0 = random.
11. curiosityTrigger (max 2) — visual creates an information gap (result without process, emotion without cause). 2 = strong; 1 = mild; 0 = no gap.
12. cleanComposition (max 2) — ≤2 key elements, clean negative space. 2 = clean; 1 = busy but ok; 0 = chaotic.

Return ONLY valid JSON in this shape (note keys use the names above):
{
  "perCriterion": [
    { "name": "emotionalFace", "points": <0..2>, "note": "<optional one-line reason>" },
    { "name": "faceGaze", "points": <0..1>, "note": "..." },
    ... (all 12 criteria in the same order) ...
  ],
  "rationale": "<one sentence summary of the thumbnail's strongest and weakest attributes>"
}

Do NOT include the \`weight\`, \`totalPoints\`, or \`estimatedCTR\` fields — those are computed downstream.`;
}

// ─── NORMALISE ───────────────────────────────────────────────────────────

const CRITERIA_DEFS: Array<{ name: string; weight: 1 | 2 }> = [
  { name: "emotionalFace",          weight: 2 },
  { name: "faceGaze",               weight: 1 },
  { name: "colorContrast",          weight: 2 },
  { name: "colorPsychology",        weight: 1 },
  { name: "singleFocalPoint",       weight: 2 },
  { name: "textHook",               weight: 2 },
  { name: "mobileReadability",      weight: 2 },
  { name: "visualPromiseAlignment", weight: 2 },
  { name: "differentiation",        weight: 1 },
  { name: "brandConsistency",       weight: 1 },
  { name: "curiosityTrigger",       weight: 2 },
  { name: "cleanComposition",       weight: 2 },
];
const MAX_POINTS = CRITERIA_DEFS.reduce((s, c) => s + c.weight, 0);   // 20

function normalise(parsed: Record<string, unknown>): ThumbnailScore {
  const rawArr = Array.isArray(parsed.perCriterion) ? parsed.perCriterion : [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const entry of rawArr) {
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).name === "string") {
      const rec = entry as Record<string, unknown>;
      byName.set(rec.name as string, rec);
    }
  }

  const perCriterion: ThumbnailCriterionScore[] = CRITERIA_DEFS.map(def => {
    const found = byName.get(def.name);
    const pointsRaw = found ? numFrom(found.points) : 0;
    // Clamp to the criterion's max weight. Never negative.
    const points = Math.max(0, Math.min(def.weight, pointsRaw ?? 0));
    const note = found && typeof found.note === "string" ? found.note : undefined;
    return { name: def.name, weight: def.weight, points, note };
  });

  const totalPoints = perCriterion.reduce((s, c) => s + c.points, 0);
  const percent     = (totalPoints / MAX_POINTS) * 100;
  const rationaleRaw = typeof parsed.rationale === "string" ? parsed.rationale : "";

  const estimatedCTR   = scoreToCTR(totalPoints);
  const ctrConfidence  = assessConfidence(perCriterion);

  return {
    totalPoints,
    maxPoints: MAX_POINTS,
    percent,
    estimatedCTR,
    ctrConfidence,
    rationale: rationaleRaw || defaultRationale(totalPoints, percent),
    perCriterion,
  };
}

// ─── SCORE → CTR ─────────────────────────────────────────────────────────
//
// Mapping bands from `thumbnail-deep-analysis.md` interpretive ranges, cross-
// referenced against VRS Tier 1 thresholds ("≥5% strong, ≥7% exceptional").
// Midpoints used as the point estimate; the forecast consumes this via the
// existing `applyManualAdjustments` CTR logic, which already handles
// uncertainty via the `tightenFactor` mechanism.

export function scoreToCTR(totalPoints: number): number {
  if (totalPoints >= 18) return 9.5;   // 18-20 → 8-11% band, midpoint
  if (totalPoints >= 14) return 6.5;   // 14-17 → 5-8%
  if (totalPoints >= 10) return 4.0;   // 10-13 → 3-5%
  if (totalPoints >= 6)  return 2.5;   // 6-9   → 1.5-3.5%
  return 1.2;                           // <6    → ~1-1.5%
}

function assessConfidence(per: ThumbnailCriterionScore[]): ThumbnailScore["ctrConfidence"] {
  // If more than 3 criteria scored 0, Gemini likely couldn't read the image
  // well. Lower the confidence so the downstream forecast is appropriately
  // less bold with the estimate.
  const zeros = per.filter(c => c.points === 0).length;
  if (zeros >= 6) return "low";
  if (zeros >= 3) return "medium";
  return "high";
}

function defaultRationale(total: number, percent: number): string {
  if (total >= 18) return `Exceptional thumbnail (${percent.toFixed(0)}%) — viral-ready packaging across every major criterion.`;
  if (total >= 14) return `Strong thumbnail (${percent.toFixed(0)}%). Minor refinements possible but fundamentals are in place.`;
  if (total >= 10) return `Average thumbnail (${percent.toFixed(0)}%). Specific improvements on the weaker criteria would lift CTR materially.`;
  return `Weak thumbnail (${percent.toFixed(0)}%). Significant redesign recommended — multiple critical criteria are not satisfied.`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function numFrom(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* retry stripped */ }
  const stripped = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(stripped); } catch { return null; }
}
