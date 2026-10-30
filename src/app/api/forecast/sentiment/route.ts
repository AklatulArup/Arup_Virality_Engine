// /api/forecast/sentiment
//
// Analyses the top comments on a video using an LLM to produce a sentiment
// score. Positive sentiment correlates with reach expansion on every platform —
// the algorithm promotes content that generates positive engagement.
//
// Input:  array of comment strings (typically 10-20) + optional { platform, postId }
//         for KV caching.
// Output: overall score 0-100, positive/neutral/negative counts, flags.
//
// Free-tier capacity stack (all zero-cost):
//   1. KV cache by (platform, postId) — repeat forecasts of the same post
//      skip the LLM call entirely. 6h TTL.
//   2. Gemini 2.0 Flash-Lite primary (2× RPM vs full Flash, same daily cap).
//   3. Multi-key rotation (fetchGemini helper) — all configured
//      GEMINI_API_KEY, _2, _3, _4, _5 env vars tried in round-robin, with
//      automatic fallthrough on 429/403.
//   4. Groq Llama 3.3 70B fallback if every Gemini key is exhausted or
//      unavailable. Groq free tier = 14,400 req/day so effectively
//      unlimited for RM daily volume. Requires GROQ_API_KEY env var.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { kvGet, kvSet, isKvAvailable } from "@/lib/kv";
import { fetchGemini, isGeminiConfigured, GEMINI_MODEL_LITE } from "@/lib/gemini-keys";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 6 * 60 * 60;   // 6 hours
const CACHE_PREFIX      = "sentiment:";

export interface SentimentResult {
  score:        number;    // 0-100 (100 = overwhelmingly positive)
  positive:     number;    // count classed positive
  neutral:      number;
  negative:     number;
  mixed:        number;
  flags:        string[];  // warning signals (e.g. "controversy", "off-topic")
  reachSignal:  "strong-positive" | "positive" | "neutral" | "mixed" | "negative";
  rationale:    string;
}

interface CachedSentiment {
  computedAt: string;
  result:     SentimentResult;
  source:     "gemini" | "groq";
}

function cacheKey(platform: string, postId: string): string {
  return `${CACHE_PREFIX}${platform}:${postId}`;
}

// Fallback cache key when caller omits (platform, postId): hash the first
// few comments so identical comment sets still dedupe within the TTL.
function fallbackCacheKey(comments: string[]): string {
  const body = comments.slice(0, 5).join("|").slice(0, 400);
  const hash = createHash("sha1").update(body).digest("hex").slice(0, 16);
  return `${CACHE_PREFIX}fallback:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const comments: string[] = Array.isArray(body?.comments)
      ? body.comments.filter((c: unknown) => typeof c === "string" && c.length > 0).slice(0, 30)
      : [];
    const platform = typeof body?.platform === "string" ? body.platform : "";
    const postId   = typeof body?.postId   === "string" ? body.postId   : "";

    if (comments.length === 0) {
      return NextResponse.json({ ok: false, reason: "no_comments" });
    }

    // ── Cache lookup ─────────────────────────────────────────────────
    const key = (platform && postId)
      ? cacheKey(platform, postId)
      : fallbackCacheKey(comments);
    if (isKvAvailable()) {
      const cached = await kvGet<CachedSentiment>(key);
      if (cached?.result) {
        return NextResponse.json({
          ok: true,
          result: cached.result,
          cached: true,
          source: cached.source,
          computedAt: cached.computedAt,
        });
      }
    }

    const prompt = buildSentimentPrompt(comments);

    // ── Primary: Gemini Flash-Lite with multi-key rotation ───────────
    let parsed: Record<string, unknown> | null = null;
    let source: "gemini" | "groq" | null = null;

    if (isGeminiConfigured()) {
      const gem = await fetchGemini({
        model: GEMINI_MODEL_LITE,
        bodyJson: {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
        },
      });
      if (gem.ok && gem.response) {
        const gemData = await gem.response.json().catch(() => null);
        const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        parsed = safeJsonParse(raw);
        if (parsed) source = "gemini";
      }
    }

    // ── Fallback: Groq Llama 3.3 70B ─────────────────────────────────
    if (!parsed) {
      const groqParsed = await tryGroqFallback(prompt);
      if (groqParsed) { parsed = groqParsed; source = "groq"; }
    }

    if (!parsed || !source) {
      return NextResponse.json({
        ok: false,
        reason: isGeminiConfigured() ? "all_providers_failed" : "no_llm_provider_configured",
      });
    }

    const result: SentimentResult = normaliseResult(parsed, comments.length);

    // ── Cache the result for future identical posts ──────────────────
    if (isKvAvailable()) {
      const record: CachedSentiment = {
        computedAt: new Date().toISOString(),
        result,
        source,
      };
      await kvSet(key, record, CACHE_TTL_SECONDS);
    }

    return NextResponse.json({ ok: true, result, cached: false, source });
  } catch (e) {
    console.error("[api/forecast/sentiment]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── GROQ FALLBACK ────────────────────────────────────────────────────────
//
// Groq free tier: 30 RPM, 14,400 RPD on Llama 3.3 70B. ~10× Gemini's daily
// cap. Used only when every Gemini key is quota-exhausted or unconfigured.
// Groq's OpenAI-compatible API accepts the same JSON-output convention.

async function tryGroqFallback(prompt: string): Promise<Record<string, unknown> | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You return only valid JSON matching the schema the user describes. No prose outside the JSON." },
          { role: "user",   content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return safeJsonParse(content);
  } catch {
    return null;
  }
}

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────

function buildSentimentPrompt(comments: string[]): string {
  const commentBlock = comments
    .map((c, i) => `${i + 1}. ${c.slice(0, 250).replace(/\n/g, " ")}`)
    .join("\n");

  return `You are analysing sentiment on social media comments for a content virality forecast.
Context: a creator posted a video. These are the top comments on it. Assess the sentiment.

Comments:
${commentBlock}

Classify each comment into one of: positive, neutral, negative, mixed.
Also flag any of these signals present across the comments: "controversy", "off-topic", "bot-activity", "hate-speech", "low-effort", "highly-engaged-debate".

Return ONLY valid JSON in this exact shape:
{
  "positive": <int>,
  "neutral": <int>,
  "negative": <int>,
  "mixed": <int>,
  "flags": [<0 or more flag strings from the list above>],
  "summary": "<one-sentence overall assessment>"
}`;
}

// ─── RESULT NORMALISATION ─────────────────────────────────────────────────

function normaliseResult(parsed: Record<string, unknown>, total: number): SentimentResult {
  const pos = intOrZero(parsed.positive);
  const neu = intOrZero(parsed.neutral);
  const neg = intOrZero(parsed.negative);
  const mix = intOrZero(parsed.mixed);
  const flags: string[] = Array.isArray(parsed.flags)
    ? (parsed.flags as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 5)
    : [];
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  const sumClassified = pos + neu + neg + mix;
  const denom = sumClassified > 0 ? sumClassified : total;

  // Score: positive = +100, mixed = +50, neutral = +50, negative = 0
  // Then scale to 0-100
  const rawScore = (pos * 100 + mix * 50 + neu * 50 + neg * 0) / Math.max(1, denom);

  // Penalty for hate-speech or bot-activity flags
  let adjScore = rawScore;
  if (flags.includes("hate-speech")) adjScore -= 30;
  if (flags.includes("bot-activity")) adjScore -= 15;
  adjScore = Math.max(0, Math.min(100, adjScore));

  const reachSignal: SentimentResult["reachSignal"] =
    adjScore >= 80 ? "strong-positive" :
    adjScore >= 60 ? "positive" :
    adjScore >= 40 ? "neutral" :
    adjScore >= 25 ? "mixed" :
                     "negative";

  return {
    score: Math.round(adjScore),
    positive: pos, neutral: neu, negative: neg, mixed: mix,
    flags, reachSignal,
    rationale: summary || defaultRationale(reachSignal, pos, neg, denom),
  };
}

function defaultRationale(signal: SentimentResult["reachSignal"], pos: number, neg: number, total: number): string {
  if (signal === "strong-positive") return `Overwhelmingly positive sentiment (${pos}/${total}). Algorithm likely to amplify distribution.`;
  if (signal === "positive")        return `Broadly positive sentiment (${pos}/${total} positive). Healthy distribution signal.`;
  if (signal === "mixed")            return `Mixed sentiment (${pos} positive, ${neg} negative). Distribution likely capped.`;
  if (signal === "negative")         return `Negative sentiment dominant (${neg}/${total}). Algorithm may slow distribution.`;
  return "Neutral — no strong sentiment signal.";
}

function intOrZero(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string") { const n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, n); }
  return 0;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* try stripped */ }
  // Gemini sometimes wraps in ```json...``` despite responseMimeType — strip
  const stripped = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(stripped); } catch { return null; }
}
