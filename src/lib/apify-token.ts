// ═══════════════════════════════════════════════════════════════════════════
// APIFY TOKEN RESOLUTION — single source of truth
// ═══════════════════════════════════════════════════════════════════════════
//
// Apify is one account/token shared across the TikTok, Instagram and X
// scrapers. Historically each route resolved the token with its own ad-hoc
// `process.env.A || process.env.B || …` chain, and the env var names drifted
// into mixed casing (`TikTok_API_Key`, `Instagram_API_KEY_2`).
//
// That casing is a silent-misconfig trap: env var names are case-sensitive, so
// an operator who sets the "obvious" all-caps `TIKTOK_API_KEY` in Vercel would
// only hit a low-priority fallback (or none), and the scraper would 500 with
// "No API key found" despite a key "being set."
//
// This helper accepts BOTH the canonical all-caps names AND the legacy
// mixed-case ones (canonical first), then the shared `APIFY_TOKEN`. Any
// reasonable spelling works. The old `YOUTUBE_API_KEY_2` fallback was removed —
// a YouTube Data API key cannot authenticate Apify, so that rung only ever
// masked a real misconfiguration.

export type ApifyPlatform = "tiktok" | "instagram" | "x";

// Resolution order per platform. Canonical all-caps first, legacy mixed-case
// next, shared APIFY_TOKEN last.
const CHAINS: Record<ApifyPlatform, readonly string[]> = {
  tiktok:    ["TIKTOK_API_KEY", "TikTok_API_Key", "APIFY_TOKEN"],
  instagram: ["INSTAGRAM_API_KEY", "Instagram_API_KEY_2", "Instagram_API_Key", "APIFY_TOKEN"],
  x:         ["APIFY_TOKEN_TWITTER", "APIFY_TOKEN_TWITTER_2", "APIFY_TOKEN"],
};

/** First non-empty configured token for the platform, or undefined. */
export function getApifyToken(platform: ApifyPlatform): string | undefined {
  for (const name of CHAINS[platform]) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

/** Which env var name supplied the token — for the /api/health diagnostic. */
export function describeApifyTokenSource(platform: ApifyPlatform): string | null {
  for (const name of CHAINS[platform]) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim().length > 0) return name;
  }
  return null;
}

/** Canonical env var name to recommend setting for a platform (for errors/docs). */
export function canonicalApifyVar(platform: ApifyPlatform): string {
  return CHAINS[platform][0];
}
