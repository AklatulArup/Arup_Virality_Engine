// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS SCREENSHOT OCR
// ═══════════════════════════════════════════════════════════════════════════
//
// Partners forward their creator-studio analytics as screenshots. Typing the
// numbers in by hand is the single biggest reason the high-signal ManualInputs
// (TikTok completion %, IG saves/sends/reach, YT AVD/CTR, …) stay null at
// forecast time. This module calls Gemini Vision on the image and extracts
// the relevant fields directly into `Partial<ManualInputs>`.
//
// Model choice: gemini-2.0-flash — same model used by the sentiment pipeline;
// it's multimodal, cheap, and low-latency. Temperature 0 because we want
// deterministic number extraction, not creative guessing.
//
// The prompt explicitly tells Gemini to return NULL when a field isn't
// visible, so we never fabricate numbers — this matches forecast.ts's
// non-negotiable rule: "We NEVER invent numbers".

import type { ManualInputs } from "./forecast";
import { fetchGemini } from "./gemini-keys";

export interface OcrField {
  value:      number;
  confidence: "high" | "medium" | "low";
  note?:      string;
}

export interface OcrExtraction {
  // Only fields Gemini found get a key — others are omitted entirely.
  fields:        Partial<Record<keyof ManualInputs, OcrField>>;
  // What platform Gemini thinks the screenshot is from — useful sanity check.
  detectedPlatform: "tiktok" | "instagram" | "youtube" | "x" | "unknown";
  // One-line human summary of what was extracted.
  summary:       string;
  // Any warnings (e.g. "image too small", "covered by overlay").
  warnings:      string[];
}

// ─── GEMINI CALL ──────────────────────────────────────────────────────────

export async function extractAnalyticsFromImage(
  imageBase64: string,
  mimeType:    string,
): Promise<{ ok: true; extraction: OcrExtraction } | { ok: false; reason: string; detail?: string }> {
  const prompt = buildOcrPrompt();

  // Multi-key rotation via fetchGemini — benefits from every configured
  // GEMINI_API_KEY* env var, with automatic fallthrough on 429/403.
  const gem = await fetchGemini({
    model: "gemini-2.0-flash",   // vision — full Flash
    bodyJson: {
      contents: [{
        role:  "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature:        0.0,
        maxOutputTokens:    1024,
        responseMimeType:   "application/json",
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

  const extraction = normalise(parsed);
  return { ok: true, extraction };
}

// ─── PROMPT ───────────────────────────────────────────────────────────────

function buildOcrPrompt(): string {
  return `You are extracting creator analytics values from a screenshot.
The image is from one of: TikTok Creator Studio, Instagram Insights, YouTube Studio, or X Premium dashboard.

Identify the platform, then extract any of these values if visible. Dashboards label the same metric many ways — match on MEANING, not exact wording (common labels listed):

TikTok fields:
- ttCompletionPct    — "completion rate" / "watched full video" / "average watch %". 0-100, no % sign. If only "average watch time" (e.g. 18s) and video length (e.g. 24s) are shown, COMPUTE 100×18/24.
- ttRewatchPct       — "rewatch rate" / "replays" / "watched again" (replays ÷ views). 0-100.
- ttFypViewPct       — "For You" share under "Traffic source" / "video views by section". 0-100.

Instagram fields (Insights / professional dashboard):
- igSaves            — "Saves" / "Saved". Integer count.
- igSends            — "Shares" / "Sends" / paper-plane forwards. Integer. NOTE: on Instagram "Shares" usually means sends — capture it as igSends.
- igReach            — "Accounts reached" / "Reach". Integer (NOT impressions or plays).
- igHold3s           — 3-second / initial retention. If a retention graph shows the % still watching at ~3s, read that point. 0-100.

YouTube fields (YouTube Studio):
- ytAVDpct           — "Average percentage viewed" directly, OR COMPUTE 100×(average view duration ÷ video length) when both the AVD clock (e.g. "2:34") and the length are shown. 0-100.
- ytCTRpct           — "Impressions click-through rate". 0-100.
- ytImpressions      — "Impressions". Integer (NOT views).

X fields:
- xTweepCred         — TweepCred / account-reputation score. 0-100.
- xReplyByAuthor     — replies the author replied back to. Integer.

Rules:
- ONLY extract a value you can clearly read, or directly COMPUTE from two visible numbers. Never guess from vibes.
- Convert units: "14.3K" → 14300; "2.1M" → 2100000; "72%" → 72 (strip the sign); "1,204" → 1204.
- When you COMPUTE a value (e.g. AVD% from clock ÷ length), set confidence "medium" and note the source numbers in "note".
- If a value is a range or partially covered, set confidence "low" and add a note.
- Prefer per-video values over account-level aggregates when both are visible; note if only account-level was available.
- If the screenshot isn't a creator-analytics dashboard at all, return an empty fields object and set detectedPlatform to "unknown".

Return ONLY valid JSON in this exact shape (omit any field not visible):
{
  "detectedPlatform": "tiktok" | "instagram" | "youtube" | "x" | "unknown",
  "fields": {
    "ttCompletionPct": { "value": <number>, "confidence": "high" | "medium" | "low", "note": "<optional>" },
    ...
  },
  "summary":  "<one sentence — e.g. 'TikTok Creator Studio: completion 72%, rewatch 18%'>",
  "warnings": [<zero or more short strings>]
}`;
}

// ─── NORMALISE GEMINI RESPONSE ────────────────────────────────────────────
//
// Defensive: Gemini occasionally returns field names in the wrong case,
// includes the % sign, or puts a bare number where we want an object. We
// clean all of that up here so the UI layer can trust the shape.

const KNOWN_KEYS: Array<keyof ManualInputs> = [
  "ttCompletionPct", "ttRewatchPct", "ttFypViewPct",
  "igSaves", "igSends", "igReach", "igHold3s",
  "ytAVDpct", "ytCTRpct", "ytImpressions",
  "xTweepCred", "xReplyByAuthor",
];

function normalise(parsed: Record<string, unknown>): OcrExtraction {
  const detectedPlatform = (() => {
    const p = typeof parsed.detectedPlatform === "string" ? parsed.detectedPlatform.toLowerCase() : "unknown";
    if (p === "tiktok" || p === "instagram" || p === "youtube" || p === "x") return p;
    return "unknown" as const;
  })();

  const rawFields = (parsed.fields && typeof parsed.fields === "object")
    ? parsed.fields as Record<string, unknown>
    : {};

  const fields: Partial<Record<keyof ManualInputs, OcrField>> = {};
  for (const key of KNOWN_KEYS) {
    const entry = rawFields[key];
    const field = coerceField(entry);
    if (field) fields[key] = field;
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const warnings: string[] = Array.isArray(parsed.warnings)
    ? (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 5)
    : [];

  return { fields, detectedPlatform, summary, warnings };
}

function coerceField(entry: unknown): OcrField | null {
  if (entry == null) return null;

  // Shape 1: { value, confidence, note? }
  if (typeof entry === "object") {
    const rec = entry as Record<string, unknown>;
    const val = numFrom(rec.value);
    if (val == null) return null;
    const conf = typeof rec.confidence === "string" ? rec.confidence.toLowerCase() : "medium";
    const confidence: OcrField["confidence"] =
      conf === "high" ? "high" : conf === "low" ? "low" : "medium";
    const note = typeof rec.note === "string" ? rec.note : undefined;
    return { value: val, confidence, note };
  }

  // Shape 2: bare number — treat as medium confidence
  const bare = numFrom(entry);
  if (bare != null) return { value: bare, confidence: "medium" };

  return null;
}

function numFrom(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[%,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* retry stripped */ }
  const stripped = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(stripped); } catch { return null; }
}
