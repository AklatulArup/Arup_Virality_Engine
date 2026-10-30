// Base URL for server-to-server calls back into this app (the crons call
// the TikTok / Instagram / X scrapers over HTTP).
//
// VERCEL_URL is the per-deployment host (virality-engin-<hash>-….vercel.app),
// which sits behind Vercel Deployment Protection: every internal call got a
// 302 to the SSO login page, so the outcome and velocity crons recorded
// nothing. VERCEL_PROJECT_PRODUCTION_URL is the public production domain.

export function internalBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}
