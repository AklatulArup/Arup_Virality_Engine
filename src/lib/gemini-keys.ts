// ═══════════════════════════════════════════════════════════════════════════
// GEMINI KEY ROTATION + FALLBACK
// ═══════════════════════════════════════════════════════════════════════════
//
// The free tier of every Gemini API key is 1,500 requests/day. Stacking
// multiple Google-account keys multiplies effective capacity linearly without
// paying a cent: N keys = N × 1,500/day.
//
// This module collects every configured GEMINI_API_KEY* env var (primary
// through _5 by default, easy to extend), rotates through them per request,
// and transparently falls through to the next key on 429 (quota exhausted)
// or 403 (key revoked). A single Gemini request tries each remaining key in
// turn before giving up.
//
// Usage:
//   import { fetchGemini } from "./gemini-keys";
//   const res = await fetchGemini({ model: GEMINI_MODEL, bodyJson });
//
// The caller never sees which key was used. The helper returns the raw
// Response object so the caller can stream / json-parse / inspect as usual.
//
// Environment variables consulted: ANY env var whose name is a Gemini API key,
// regardless of casing or separators — GEMINI_API_KEY, GEMINI_API_KEY_2,
// GeminiAPIKey3, geminiApiKey10, etc. The free quota is per-key, so every key
// the user configured is collected and rotated. No fixed list to maintain, and
// no number ceiling — add 5 or 50, they're all picked up at call time.

// Round-robin pointer across keys within a single process. Each key fetched
// via getGeminiKeys() is tried in order starting from `cursor`, so the load
// spreads roughly evenly across available keys — minimising the chance that
// one key exhausts its 15 RPM while others sit idle.
let cursor = 0;

// Matches gemini-api-key style names with optional separators and an optional
// trailing index: gemini[_-]?api[_-]?key (_?N)?
const GEMINI_KEY_NAME = /^gemini[_-]?api[_-]?key(?:[_-]?\d+)?$/i;

/** Trailing number in a key name (GEMINI_API_KEY → 1, GeminiAPIKey3 → 3). */
function keyIndex(name: string): number {
  const m = name.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Env var NAMES that hold a Gemini key, sorted by index. (Values via getGeminiKeys.) */
export function getGeminiKeyVars(): string[] {
  return Object.keys(process.env)
    .filter((n) => GEMINI_KEY_NAME.test(n) && (process.env[n]?.trim().length ?? 0) > 0)
    .sort((a, b) => keyIndex(a) - keyIndex(b));
}

export function getGeminiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const name of getGeminiKeyVars()) {
    const v = process.env[name]?.trim();
    if (v && v.length > 0 && !seen.has(v)) {
      keys.push(v);
      seen.add(v);
    }
  }
  return keys;
}

// ── Model names ─────────────────────────────────────────────────────────────
// Google retires Gemini models on its own schedule (gemini-2.0-flash went away
// in 2026 and every AI feature silently 404'd). Every caller reads these two
// constants, so the next retirement is a Vercel env change — GEMINI_MODEL /
// GEMINI_MODEL_LITE — not a code change. Defaults verified on a free-tier key
// 2026-10-30 (2.5-flash is closed to new users).
export const GEMINI_MODEL      = process.env.GEMINI_MODEL?.trim()      || "gemini-3.5-flash";
export const GEMINI_MODEL_LITE = process.env.GEMINI_MODEL_LITE?.trim() || "gemini-3.5-flash-lite";

/**
 * Gemini 3.x full Flash "thinks" before answering and those thought tokens
 * count against maxOutputTokens — with this codebase's small budgets (≤512)
 * the visible answer gets truncated (finishReason MAX_TOKENS). Turn thinking
 * off for the full model unless the caller set its own thinkingConfig. The
 * Lite model doesn't think and rejects thinkingBudget, so it is left alone.
 */
function withThinkingOff(model: string, body: unknown): unknown {
  if (/lite/i.test(model) || typeof body !== "object" || body === null) return body;
  const b = body as { generationConfig?: Record<string, unknown> };
  if (b.generationConfig?.thinkingConfig) return body;
  return { ...b, generationConfig: { ...(b.generationConfig ?? {}), thinkingConfig: { thinkingBudget: 0 } } };
}

export interface FetchGeminiOptions {
  model?:       string;                  // default: GEMINI_MODEL
  bodyJson:     unknown;                 // POST body — will be JSON-stringified
  signal?:      AbortSignal;
}

export interface FetchGeminiResult {
  ok:           boolean;
  response?:    Response;
  status?:      number;
  reason?:      "no_keys" | "all_keys_exhausted" | "network_error";
  attempts?:    number;
  lastError?:   string;
}

/**
 * Call Gemini's generateContent endpoint, transparently rotating through
 * all configured API keys on quota / auth errors. Returns the first 2xx
 * response. If every key fails the final error is surfaced to the caller.
 */
export async function fetchGemini(opts: FetchGeminiOptions): Promise<FetchGeminiResult> {
  const model = opts.model ?? GEMINI_MODEL;
  const body = JSON.stringify(withThinkingOff(model, opts.bodyJson));
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return { ok: false, reason: "no_keys", attempts: 0 };
  }

  // Round-robin: start at `cursor`, wrap around so every key gets a chance.
  const ordered = [
    ...keys.slice(cursor % keys.length),
    ...keys.slice(0, cursor % keys.length),
  ];
  cursor = (cursor + 1) % keys.length;

  let attempts = 0;
  let lastError = "";

  for (const key of ordered) {
    attempts++;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: opts.signal,
        },
      );

      if (res.ok) {
        return { ok: true, response: res, status: res.status, attempts };
      }

      // Quota / auth errors → try the next key.
      if (res.status === 429 || res.status === 403) {
        lastError = `${res.status} on key #${attempts}`;
        continue;
      }

      // Other errors (5xx, malformed request) — don't retry, surface the
      // response so the caller can inspect.
      return { ok: false, response: res, status: res.status, attempts, lastError: `HTTP ${res.status}` };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // Network error — try the next key if available.
      continue;
    }
  }

  return {
    ok:       false,
    reason:   "all_keys_exhausted",
    attempts,
    lastError,
  };
}

/**
 * Convenience: try Gemini first. If it returns no_keys / all_keys_exhausted,
 * the caller can fall back to an alternate provider (see groqFallback in
 * /api/forecast/sentiment). Returns `null` if Gemini is completely
 * unavailable so the caller can decide how to handle that.
 */
export function isGeminiConfigured(): boolean {
  return getGeminiKeys().length > 0;
}
