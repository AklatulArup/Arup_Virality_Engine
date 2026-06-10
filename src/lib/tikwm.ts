// ═══════════════════════════════════════════════════════════════════════════
// TIKWM — exact TikTok single-video metrics (primary source for /video/ URLs)
// ═══════════════════════════════════════════════════════════════════════════
//
// tikwm.com is an unofficial TikTok web API. For a single video URL it returns
// EXACT counters where the Apify scraper returns UI-rounded ones (verified on
// the same video: TikWM play_count 11,558 vs Apify 11,600), plus saves
// (collect_count), exact create_time, duration, and sound info. It's free, no
// key, and responds in ~2s vs a 10–30s Apify actor run — which also makes the
// outcome-grading and velocity crons cheaper and more precise.
//
// Constraints discovered by probing (2026-06):
//   - Only the POST /api/ video-detail endpoint is reliably reachable; the
//     user/posts (profile feed) endpoint sits behind a Cloudflare JS challenge,
//     so PROFILE scrapes stay on Apify.
//   - Requests need a browser-ish User-Agent or Cloudflare challenges them.
//   - Counter fields are `*_count`; the bare `play` key is the video file URL.
//   - Author follower count is NOT in the detail response (callers fall back
//     to 0, same as the legacy single-video path when Apify omitted it).
//
// The TikTok scrape route tries this first for /video/ URLs and falls back to
// Apify on any failure — so a Cloudflare block of Vercel's egress IPs would
// degrade silently back to today's behavior, never break it.

import type { TikTokVideoData } from "./types";

const ENDPOINT = "https://tikwm.com/api/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 12_000;

interface TikwmEnvelope {
  code: number;
  msg?: string;
  data?: {
    id?: string;
    title?: string;
    cover?: string;
    origin_cover?: string;
    duration?: number;
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
    download_count?: number;
    collect_count?: number;
    create_time?: number; // unix seconds
    music_info?: { title?: string; original?: boolean };
    author?: { id?: string; unique_id?: string; nickname?: string };
  };
}

export interface TikwmResult {
  ok: boolean;
  video?: TikTokVideoData;
  reason?: "blocked" | "bad_url" | "http_error" | "timeout" | "malformed";
  detail?: string;
}

function absoluteCover(cover: string | undefined): string {
  if (!cover) return "";
  if (cover.startsWith("http")) return cover;
  return `https://www.tikwm.com${cover.startsWith("/") ? "" : "/"}${cover}`;
}

/** Fetch exact metrics for one TikTok video URL. Never throws. */
export async function fetchTikwmVideo(url: string): Promise<TikwmResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
        Accept: "application/json",
      },
      body: new URLSearchParams({ url }).toString(),
      signal: ctrl.signal,
      cache: "no-store",
    });

    const text = await res.text();
    // Cloudflare challenge pages are HTML — treat as a block, caller falls
    // back to Apify.
    if (text.trimStart().startsWith("<")) {
      return { ok: false, reason: "blocked", detail: "Cloudflare challenge" };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", detail: `HTTP ${res.status}` };
    }

    let parsed: TikwmEnvelope;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: "malformed", detail: text.slice(0, 120) };
    }
    if (parsed.code !== 0 || !parsed.data?.id) {
      return { ok: false, reason: "bad_url", detail: parsed.msg ?? `code ${parsed.code}` };
    }

    const d = parsed.data;
    const durationSec = d.duration ?? 0;
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const title = (d.title ?? "").slice(0, 200) || "TikTok video";
    const hashtags = ((d.title ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1));
    const handle = d.author?.unique_id ?? "Unknown";
    const musicTitle = d.music_info?.title ?? "";

    const video: TikTokVideoData = {
      id: String(d.id),
      title,
      channel: handle,
      channelId: d.author?.id || handle,
      views: d.play_count ?? 0,
      likes: d.digg_count ?? 0,
      comments: d.comment_count ?? 0,
      shares: d.share_count ?? 0,
      saves: d.collect_count ?? 0,
      publishedAt: d.create_time ? new Date(d.create_time * 1000).toISOString() : new Date().toISOString(),
      duration: `${mins}:${String(secs).padStart(2, "0")}`,
      durationSeconds: durationSec,
      thumbnail: absoluteCover(d.cover || d.origin_cover),
      tags: hashtags,
      description: d.title ?? "",
      platform: "tiktok",
      hashtags,
      soundName: musicTitle,
      soundOriginal: d.music_info?.original ?? musicTitle.toLowerCase().startsWith("original sound"),
      creatorHandle: handle,
      creatorFollowers: 0, // not exposed by the detail endpoint
    };

    return { ok: true, video };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "http_error", detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Liveness probe for the key-health panel. A deliberately-unparseable URL
 * still produces a JSON `code:-1` response when the API is reachable; HTML
 * means Cloudflare is challenging this server's IP.
 */
export async function probeTikwm(): Promise<{ reachable: boolean; blocked: boolean; detail: string }> {
  const r = await fetchTikwmVideo("https://www.tiktok.com/@probe/video/0");
  if (r.ok) return { reachable: true, blocked: false, detail: "ok" };
  if (r.reason === "bad_url") return { reachable: true, blocked: false, detail: "reachable (no key needed)" };
  if (r.reason === "blocked") return { reachable: false, blocked: true, detail: "Cloudflare challenge from this server" };
  return { reachable: false, blocked: false, detail: r.detail ?? r.reason ?? "unreachable" };
}
