// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE DATA API KEY ROTATION + QUOTA FALLBACK
// ═══════════════════════════════════════════════════════════════════════════
//
// YouTube Data API free quota is 10,000 units/day PER GOOGLE CLOUD PROJECT.
// Stacking keys from multiple projects multiplies daily capacity. This helper
// collects every configured YOUTUBE_API_KEY* env var and, per request,
// transparently advances to the next key when one returns a quota or dead-key
// error. Mirrors src/lib/gemini-keys.ts.
//
// Rotated-past reasons: quotaExceeded / dailyLimitExceeded / rateLimitExceeded /
// userRateLimitExceeded (quota) and keyInvalid / keyExpired (dead key — so a
// revoked key like a stale YOUTUBE_API_KEY_2 is skipped automatically).
//
// IMPORTANT: keys must live in SEPARATE Google Cloud projects to actually stack
// quota — multiple keys in one project share that project's single 10k/day.

const KEY_ENV_VARS = [
  "YOUTUBE_API_KEY",
  "YOUTUBE_API_KEY_2", "YOUTUBE_API_KEY_3", "YOUTUBE_API_KEY_4", "YOUTUBE_API_KEY_5",
  "YOUTUBE_API_KEY_6", "YOUTUBE_API_KEY_7", "YOUTUBE_API_KEY_8", "YOUTUBE_API_KEY_9", "YOUTUBE_API_KEY_10",
] as const;

const ROTATE_REASONS = new Set([
  "quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded",
  "keyInvalid", "keyExpired",
]);

let cursor = 0;

export function getYouTubeKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const name of KEY_ENV_VARS) {
    const v = process.env[name];
    if (typeof v === "string" && v.length > 0 && !seen.has(v)) { keys.push(v); seen.add(v); }
  }
  return keys;
}

export function isYouTubeConfigured(): boolean {
  return getYouTubeKeys().length > 0;
}

// Returns a rotate-worthy reason when the response says the KEY (not the
// request) is the problem — quota or dead key — else null. Google reports a
// dead key inconsistently: sometimes errors[0].reason="keyInvalid", but the
// YouTube Data API commonly returns reason="badRequest" with message "API key
// not valid…" and details[].reason="API_KEY_INVALID", so all three forms are
// checked (the badRequest form previously slipped through and made every
// request that round-robined onto a dead key fail instead of rotating).
function rotateReason(data: unknown): string | null {
  const err = (data as {
    error?: {
      message?: string;
      errors?: Array<{ reason?: string }>;
      details?: Array<{ reason?: string }>;
    };
  })?.error;
  if (!err) return null;
  const reason = err.errors?.[0]?.reason;
  if (reason && ROTATE_REASONS.has(reason)) return reason;
  const detailReason = err.details?.find((d) => typeof d?.reason === "string")?.reason;
  if (detailReason === "API_KEY_INVALID") return "keyInvalid";
  if (typeof err.message === "string" && /api key (not valid|expired)/i.test(err.message)) return "keyInvalid";
  return null;
}

/**
 * Fetch a YouTube Data API URL, rotating across all configured keys when one is
 * quota-exhausted or dead. `makeUrl(key)` must embed the key (e.g.
 * `...&key=${key}`). Returns the parsed JSON of the first key that doesn't hit
 * a rotate-worthy error; if every key is exhausted, returns the last quota
 * response so the caller's existing error handling surfaces the quota message.
 * Returns `any` to match the previous `await res.json()` call sites verbatim.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function youtubeFetchJson(makeUrl: (key: string) => string): Promise<any> {
  const keys = getYouTubeKeys();
  if (keys.length === 0) {
    return { error: { message: "YOUTUBE_API_KEY not set", errors: [{ reason: "keyInvalid" }] } };
  }
  const ordered = [...keys.slice(cursor % keys.length), ...keys.slice(0, cursor % keys.length)];
  cursor = (cursor + 1) % keys.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let last: any = null;
  for (const key of ordered) {
    try {
      const res = await fetch(makeUrl(key), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (rotateReason(data)) { last = data; continue; }
      return data;   // success, or a non-key error the caller should surface
    } catch (e) {
      last = { error: { message: e instanceof Error ? e.message : String(e) } };
      continue;
    }
  }
  return last ?? { error: { message: "All YouTube keys exhausted" } };
}
