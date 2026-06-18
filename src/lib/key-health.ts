// ═══════════════════════════════════════════════════════════════════════════
// LIVE API-KEY HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════
//
// "Set in Vercel" only means a key EXISTS — not that it's valid, funded, or
// under quota. This module makes one tiny real call per configured key and
// classifies the result: working / quota-capped / invalid-or-expired /
// needs-funding. Powers the admin /api/admin/key-health endpoint + panel.
//
// NEVER returns key values — only the env-var NAME, the HTTP status, and a
// plain-English verdict. Each tester has its own short timeout and runs in
// parallel, so one slow provider can't hang the whole check.

import { getApifyToken, describeApifyTokenSource, type ApifyPlatform } from "./apify-token";
import { probeTikwm } from "./tikwm";
import { getGeminiKeyVars } from "./gemini-keys";

const TIMEOUT_MS = 8000;

export type KeySeverity = "ok" | "warn" | "error" | "missing";

export interface KeyHealthResult {
  service:    string;          // "Gemini", "YouTube", …
  keyVar:     string;          // env var name (or "TikTok via TikTok_API_Key")
  present:    boolean;
  httpStatus: number | null;
  severity:   KeySeverity;
  verdict:    string;          // plain-English
  detail?:    string;          // e.g. "plan: FREE"
}

export interface KeyHealthReport {
  checkedAt: string;
  results:   KeyHealthResult[];
  apifyCredit?: string;        // e.g. "$0 / $5 used this cycle"
  summary:   { ok: number; warn: number; error: number; missing: number };
}

// ─── low-level fetch with timeout ───────────────────────────────────────────

async function timed(url: string, init?: RequestInit): Promise<{ status: number; text: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    return { status: r.status, text: await r.text().catch(() => "") };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const ok      = (service: string, keyVar: string, verdict: string, detail?: string): KeyHealthResult => ({ service, keyVar, present: true, httpStatus: 200, severity: "ok", verdict, detail });
const warn    = (service: string, keyVar: string, s: number | null, verdict: string): KeyHealthResult => ({ service, keyVar, present: true, httpStatus: s, severity: "warn", verdict });
const err     = (service: string, keyVar: string, s: number | null, verdict: string): KeyHealthResult => ({ service, keyVar, present: true, httpStatus: s, severity: "error", verdict });
const missing = (service: string, keyVar: string): KeyHealthResult => ({ service, keyVar, present: false, httpStatus: null, severity: "missing", verdict: "not set" });

// ─── per-service testers ────────────────────────────────────────────────────

async function checkYouTube(keyVar: string): Promise<KeyHealthResult | null> {
  const k = process.env[keyVar];
  if (!k) return keyVar === "YOUTUBE_API_KEY" ? missing("YouTube", keyVar) : null;
  const r = await timed(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${k}`);
  if (!r) return err("YouTube", keyVar, null, "no response (timeout/network)");
  const lc = r.text.toLowerCase();
  if (r.status === 200) return ok("YouTube", keyVar, "working");
  if (lc.includes("quota")) return warn("YouTube", keyVar, r.status, "quota exceeded (resets ~midnight PT)");
  if (/not valid|keyinvalid|expired|api_key_invalid|disabled|blocked/.test(lc)) return err("YouTube", keyVar, r.status, "invalid / expired / disabled");
  return warn("YouTube", keyVar, r.status, `HTTP ${r.status}`);
}

async function checkGemini(keyVar: string): Promise<KeyHealthResult | null> {
  const k = process.env[keyVar];
  if (!k) return keyVar === "GEMINI_API_KEY" ? missing("Gemini", keyVar) : null;
  const r = await timed(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }) },
  );
  if (!r) return err("Gemini", keyVar, null, "no response");
  const lc = r.text.toLowerCase();
  if (r.status === 200) return ok("Gemini", keyVar, "working");
  if (r.status === 429 || lc.includes("resource_exhausted") || lc.includes("quota")) return warn("Gemini", keyVar, r.status, "daily quota / rate cap (resets daily)");
  if (/api_key_invalid|not valid|expired|permission_denied|service_disabled/.test(lc)) return err("Gemini", keyVar, r.status, "invalid / expired / API disabled");
  return warn("Gemini", keyVar, r.status, `HTTP ${r.status}`);
}

async function checkApifyPlatform(platform: ApifyPlatform): Promise<KeyHealthResult> {
  const k = getApifyToken(platform);
  const label = platform === "x" ? "X/Twitter" : platform.charAt(0).toUpperCase() + platform.slice(1);
  const src = describeApifyTokenSource(platform);
  if (!k) return missing("Apify", `${label} (no token)`);
  const r = await timed(`https://api.apify.com/v2/users/me?token=${k}`);
  const keyVar = `${label} via ${src}`;
  if (!r) return err("Apify", keyVar, null, "no response");
  if (r.status === 200) {
    let plan = "?";
    try { const d = JSON.parse(r.text); plan = d?.data?.plan?.id || d?.data?.plan?.tier || "?"; } catch { /* keep ? */ }
    return ok("Apify", keyVar, "valid token", `plan: ${plan}`);
  }
  if (r.status === 401) return err("Apify", keyVar, 401, "invalid / expired token");
  return warn("Apify", keyVar, r.status, `HTTP ${r.status}`);
}

async function apifyCredit(): Promise<string | undefined> {
  const k = getApifyToken("tiktok") ?? getApifyToken("x") ?? getApifyToken("instagram");
  if (!k) return undefined;
  const r = await timed(`https://api.apify.com/v2/users/me/limits?token=${k}`);
  if (!r || r.status !== 200) return undefined;
  try {
    const d = JSON.parse(r.text)?.data ?? {};
    const used = d?.current?.monthlyUsageUsd ?? d?.current?.monthlyUsageCycleUsd;
    const max  = d?.limits?.maxMonthlyUsageUsd;
    if (used != null) return `$${Math.round(used * 100) / 100}${max != null ? ` / $${max}` : ""} used this cycle`;
  } catch { /* ignore */ }
  return undefined;
}

async function checkAnthropic(keyVar: string): Promise<KeyHealthResult | null> {
  const k = process.env[keyVar];
  if (!k) return keyVar === "Claude_AI_Summary_API_KEY" ? missing("Anthropic", keyVar) : null;
  const r = await timed("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
  });
  if (!r) return err("Anthropic", keyVar, null, "no response");
  const lc = r.text.toLowerCase();
  if (r.status === 200) return ok("Anthropic", keyVar, "working (has credit)");
  if (lc.includes("credit balance is too low") || lc.includes("insufficient") || lc.includes("billing")) return err("Anthropic", keyVar, r.status, "needs funding (credit too low)");
  if (r.status === 401 || lc.includes("authentication_error") || lc.includes("invalid x-api-key")) return err("Anthropic", keyVar, 401, "invalid / expired");
  if (r.status === 429) return warn("Anthropic", keyVar, 429, "rate limited");
  return warn("Anthropic", keyVar, r.status, `HTTP ${r.status}`);
}

async function checkGNews(keyVar: string): Promise<KeyHealthResult | null> {
  const k = process.env[keyVar];
  if (!k) return null; // GNews is optional (degrades to free RSS) — only show if set
  const r = await timed(`https://gnews.io/api/v4/search?q=markets&max=1&lang=en&apikey=${k}`);
  if (!r) return err("GNews", keyVar, null, "no response");
  const lc = r.text.toLowerCase();
  if (r.status === 200) return ok("GNews", keyVar, "working");
  if (r.status === 429 || lc.includes("limit") || lc.includes("quota")) return warn("GNews", keyVar, r.status, "daily quota hit (free = 100/day)");
  if (r.status === 401 || r.status === 403) return err("GNews", keyVar, r.status, "invalid / expired");
  return warn("GNews", keyVar, r.status, `HTTP ${r.status}`);
}

async function checkGroq(): Promise<KeyHealthResult> {
  const k = process.env.GROQ_API_KEY;
  if (!k) return missing("Groq", "GROQ_API_KEY (optional fallback)");
  const r = await timed("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
  });
  if (!r) return err("Groq", "GROQ_API_KEY", null, "no response");
  if (r.status === 200) return ok("Groq", "GROQ_API_KEY", "working");
  if (r.status === 401) return err("Groq", "GROQ_API_KEY", 401, "invalid / expired");
  if (r.status === 429) return warn("Groq", "GROQ_API_KEY", 429, "rate limited");
  return warn("Groq", "GROQ_API_KEY", r.status, `HTTP ${r.status}`);
}

// TikWM is keyless — the check is service reachability from THIS server (a
// Cloudflare challenge of the egress IP silently degrades TikTok single-video
// scrapes back to Apify, which is worth surfacing).
async function checkTikwm(): Promise<KeyHealthResult> {
  const p = await probeTikwm();
  if (p.reachable) return ok("TikWM", "tikwm.com (keyless)", "working", "exact TikTok counters");
  if (p.blocked) return warn("TikWM", "tikwm.com (keyless)", null, "blocked from this server — TikTok falls back to Apify");
  return warn("TikWM", "tikwm.com (keyless)", null, p.detail);
}

async function checkKV(): Promise<KeyHealthResult> {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return missing("Upstash KV", "KV_REST_API_*");
  const r = await timed(`${url}/ping`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r) return err("Upstash KV", "KV_REST_API_*", null, "no response");
  if (r.status === 200) return ok("Upstash KV", "KV_REST_API_*", "working");
  if (r.status === 401) return err("Upstash KV", "KV_REST_API_*", 401, "bad token");
  return warn("Upstash KV", "KV_REST_API_*", r.status, `HTTP ${r.status}`);
}

// ─── orchestrator ───────────────────────────────────────────────────────────

export async function checkAllKeys(): Promise<KeyHealthReport> {
  const settled = await Promise.all([
    checkYouTube("YOUTUBE_API_KEY"), checkYouTube("YOUTUBE_API_KEY_2"), checkYouTube("YOUTUBE_API_KEY_3"), checkYouTube("YOUTUBE_API_KEY_4"), checkYouTube("YOUTUBE_API_KEY_5"),
    checkYouTube("YOUTUBE_API_KEY_6"), checkYouTube("YOUTUBE_API_KEY_7"), checkYouTube("YOUTUBE_API_KEY_8"), checkYouTube("YOUTUBE_API_KEY_9"), checkYouTube("YOUTUBE_API_KEY_10"),
    // Enumerate the ACTUAL Gemini key var names present in env (any naming:
    // GEMINI_API_KEY_N, GeminiAPIKeyN, …) so every configured key is pinged,
    // not a stale hardcoded list. Falls back to the canonical name for a
    // "missing" row when none are set.
    ...(getGeminiKeyVars().length > 0 ? getGeminiKeyVars() : ["GEMINI_API_KEY"]).map(checkGemini),
    checkApifyPlatform("tiktok"), checkApifyPlatform("instagram"), checkApifyPlatform("x"),
    checkTikwm(),
    checkAnthropic("Claude_AI_Summary_API_KEY"), checkAnthropic("ANTHROPIC_API_KEY"),
    checkGNews("GNEWS_API_KEY"), checkGNews("GNEWS_API"),
    checkGroq(),
    checkKV(),
  ]);
  const results = settled.filter((r): r is KeyHealthResult => r !== null);
  const credit = await apifyCredit();

  const summary = { ok: 0, warn: 0, error: 0, missing: 0 };
  for (const r of results) summary[r.severity]++;

  return {
    checkedAt: new Date().toISOString(),
    results,
    apifyCredit: credit,
    summary,
  };
}
