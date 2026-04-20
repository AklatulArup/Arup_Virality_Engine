// ═══════════════════════════════════════════════════════════════════════════
// HOOK-STRENGTH PREDICTOR  (short-form first-frame + caption scorer)
// ═══════════════════════════════════════════════════════════════════════════
//
// For TikTok and Instagram Reels, the first-frame + caption combination is
// what determines whether a scrolling viewer stops or swipes. Unlike YouTube
// (where a click happens and CTR matters), short-form has no click — only
// the decision to keep watching past 3 seconds.
//
// This predictor scores that decision using Gemini Vision on the cover image
// + the caption text, against the five hook formulas from
// `content-production-trends.md`:
//   • Contradiction Hook
//   • Delayed Reveal
//   • Question Hook
//   • Data Hook
//   • Pattern Interrupt
// plus two craft dimensions (visual stop-power, text-overlay clarity).
//
// Output is a hook score 0-100 plus a per-platform target metric:
//   • TikTok    → estimated ttCompletionPct (70% is the 2026 viral gate)
//   • Instagram → estimated igHold3s (3-sec retention)
//
// The ForecastPanel auto-fills those ManualInputs fields when the RM hasn't
// provided Creator Studio numbers, and flags the key in `aiEstimatedKeys` so
// confidence scoring treats it as a signal not a measurement — same pattern
// as the thumbnail-CTR predictor for YT.

export interface HookFormulaMatch {
  name:  "contradiction" | "delayed-reveal" | "question" | "data" | "pattern-interrupt" | "none";
  strength: 0 | 1 | 2;    // 0 = absent, 1 = weak, 2 = strong
  note?: string;
}

export interface HookScore {
  totalPoints:   number;                      // 0 – 20
  maxPoints:     number;                      // = 20
  percent:       number;                      // totalPoints / maxPoints × 100
  dominantFormula: HookFormulaMatch["name"];  // best-matching formula among the five
  matches:       HookFormulaMatch[];          // all five evaluated
  visualStopPower: 0 | 1 | 2;                 // does first frame arrest the scroll
  textOverlayClarity: 0 | 1 | 2;              // on-screen text hook quality
  confidence:    "high" | "medium" | "low";
  rationale:     string;

  // Platform-specific estimated retention metrics (the point of this module)
  estimatedCompletionPct: number;             // TikTok ttCompletionPct (0-100)
  estimatedHold3sPct:     number;             // Instagram igHold3s    (0-100)
}

// ─── GEMINI VISION CALL ──────────────────────────────────────────────────

export async function scoreHookStrength(params: {
  imageBase64: string;
  mimeType:    string;
  caption:     string;
  platform:    "tiktok" | "instagram";
}): Promise<{ ok: true; score: HookScore } | { ok: false; reason: string; detail?: string }> {
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_2;
  if (!geminiKey) return { ok: false, reason: "gemini_not_configured" };

  let gemRes: Response;
  try {
    gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: buildPrompt(params.caption, params.platform) },
              { inlineData: { mimeType: params.mimeType, data: params.imageBase64 } },
            ],
          }],
          generationConfig: {
            temperature:      0.0,
            maxOutputTokens:  1024,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (e) {
    return { ok: false, reason: "network_error", detail: e instanceof Error ? e.message : String(e) };
  }

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

// ─── PROMPT ───────────────────────────────────────────────────────────────

function buildPrompt(caption: string, platform: "tiktok" | "instagram"): string {
  const captionBlock = caption.length > 0
    ? `Caption text:\n"""\n${caption.slice(0, 500).replace(/\n/g, " ")}\n"""`
    : `Caption: (empty)`;

  return `You are scoring a ${platform} video's stop-scroll potential — the probability a viewer continues past 3 seconds rather than swiping.

The image is the video's cover / first frame. Below is the caption.

${captionBlock}

Score the five hook formulas (each 0-2: absent/weak/strong):
• contradiction       — challenges a belief the audience holds ("stop using trending sounds — here's why")
• delayed-reveal      — shows an outcome first, explanation later ("this trade made me $4,200 in 3 minutes")
• question            — poses an unignorable question ("want to know why funded accounts keep blowing?")
• data                — leads with a surprising number ("97% of prop traders fail in month 1")
• pattern-interrupt   — visually/auditorily unexpected first moment (sudden cut, mismatched visual)

Then score two craft dimensions (each 0-2):
• visualStopPower     — does the first frame immediately arrest the scroll (strong focal point, motion, emotion, text hook)?
• textOverlayClarity  — if on-screen text is present, is it bold, readable, and information-bearing?

Finally, state the strongest hook formula as "dominantFormula" — one of the five names, or "none" if no formula applies.

Return ONLY valid JSON in this exact shape:
{
  "matches": [
    { "name": "contradiction",      "strength": <0|1|2>, "note": "<optional>" },
    { "name": "delayed-reveal",     "strength": <0|1|2>, "note": "<optional>" },
    { "name": "question",           "strength": <0|1|2>, "note": "<optional>" },
    { "name": "data",               "strength": <0|1|2>, "note": "<optional>" },
    { "name": "pattern-interrupt",  "strength": <0|1|2>, "note": "<optional>" }
  ],
  "visualStopPower":    <0|1|2>,
  "textOverlayClarity": <0|1|2>,
  "dominantFormula":    "contradiction" | "delayed-reveal" | "question" | "data" | "pattern-interrupt" | "none",
  "rationale":          "<one sentence — what's strong and what's weak>"
}`;
}

// ─── NORMALISE ────────────────────────────────────────────────────────────

const FORMULA_NAMES = ["contradiction", "delayed-reveal", "question", "data", "pattern-interrupt"] as const;
type FormulaName = typeof FORMULA_NAMES[number];
// Max points:
//   5 formulas × 2 points each = 10
//   visualStopPower 0-2 (weight 3) = 6
//   textOverlayClarity 0-2 (weight 2) = 4
// Total possible = 20.
const FORMULA_WEIGHT       = 1;   // each formula contributes up to 2 × 1 = 2 pts
const VISUAL_STOP_WEIGHT   = 3;   // up to 2 × 3 = 6 pts
const TEXT_OVERLAY_WEIGHT  = 2;   // up to 2 × 2 = 4 pts
const MAX_POINTS           = FORMULA_NAMES.length * 2 * FORMULA_WEIGHT
                           + 2 * VISUAL_STOP_WEIGHT
                           + 2 * TEXT_OVERLAY_WEIGHT;   // 10 + 6 + 4 = 20

function normalise(parsed: Record<string, unknown>): HookScore {
  const rawArr = Array.isArray(parsed.matches) ? parsed.matches : [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const entry of rawArr) {
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).name === "string") {
      const rec = entry as Record<string, unknown>;
      byName.set(rec.name as string, rec);
    }
  }

  const matches: HookFormulaMatch[] = FORMULA_NAMES.map(name => {
    const rec = byName.get(name);
    const strength = rec ? clamp02(numFrom(rec.strength)) : 0;
    const note = rec && typeof rec.note === "string" ? rec.note : undefined;
    return { name, strength: strength as 0 | 1 | 2, note };
  });

  const visualStopPower    = clamp02(numFrom(parsed.visualStopPower))    as 0 | 1 | 2;
  const textOverlayClarity = clamp02(numFrom(parsed.textOverlayClarity)) as 0 | 1 | 2;

  const totalPoints =
    matches.reduce((s, m) => s + m.strength, 0) * FORMULA_WEIGHT
    + visualStopPower    * VISUAL_STOP_WEIGHT
    + textOverlayClarity * TEXT_OVERLAY_WEIGHT;
  const percent = (totalPoints / MAX_POINTS) * 100;

  const dominantFormula = (typeof parsed.dominantFormula === "string"
    && (FORMULA_NAMES as readonly string[]).includes(parsed.dominantFormula))
    ? parsed.dominantFormula as FormulaName
    : (matches.reduce(
        (best, m) => m.strength > best.strength ? m : best,
        { name: "none" as HookFormulaMatch["name"], strength: 0 as 0 | 1 | 2 },
      ).name);

  const rationale = typeof parsed.rationale === "string"
    ? parsed.rationale
    : defaultRationale(totalPoints, percent, dominantFormula);

  const confidence: HookScore["confidence"] =
    (visualStopPower === 0 && textOverlayClarity === 0) ? "low"
    : totalPoints >= 14 ? "high"
    : totalPoints >= 8  ? "medium"
    :                     "low";

  return {
    totalPoints,
    maxPoints: MAX_POINTS,
    percent,
    dominantFormula,
    matches,
    visualStopPower,
    textOverlayClarity,
    confidence,
    rationale,
    estimatedCompletionPct: scoreToTikTokCompletion(totalPoints),
    estimatedHold3sPct:     scoreToIgHold3s(totalPoints),
  };
}

// ─── SCORE → RETENTION MAPPINGS ───────────────────────────────────────────
//
// Bands derived from:
//   TikTok:    70% = 2026 viral gate (platform-algorithms-2026.md). Strong
//              hook → above gate. Weak hook → far below.
//   Instagram: 3-sec hold < 60% suppresses distribution. Strong hook keeps
//              80%+.  Mapping uses the same score bands as TikTok but shifted
//              (IG's 3-sec window is less punishing than TikTok completion).

export function scoreToTikTokCompletion(totalPoints: number): number {
  if (totalPoints >= 17) return 75;   // strong hook → above viral gate
  if (totalPoints >= 13) return 62;
  if (totalPoints >= 9)  return 48;
  if (totalPoints >= 5)  return 35;
  return 22;
}

export function scoreToIgHold3s(totalPoints: number): number {
  if (totalPoints >= 17) return 82;
  if (totalPoints >= 13) return 70;
  if (totalPoints >= 9)  return 55;
  if (totalPoints >= 5)  return 40;
  return 28;
}

function defaultRationale(total: number, percent: number, dominant: HookFormulaMatch["name"]): string {
  if (total >= 17) return `Exceptional hook (${percent.toFixed(0)}%, ${dominant}). First frame + caption should clear the 3-sec retention gate on both TikTok and IG.`;
  if (total >= 13) return `Strong hook (${percent.toFixed(0)}%, ${dominant}). Above average stop-scroll probability.`;
  if (total >= 9)  return `Average hook (${percent.toFixed(0)}%). A sharper first frame or more specific caption would materially lift early retention.`;
  return `Weak hook (${percent.toFixed(0)}%). First-frame stop-power and/or caption fail the 3-second gate — high risk of TikTok's 200-view jail or IG Explore exclusion.`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

function clamp02(v: number | null): 0 | 1 | 2 {
  if (v == null) return 0;
  if (v >= 1.5)  return 2;
  if (v >= 0.5)  return 1;
  return 0;
}

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
