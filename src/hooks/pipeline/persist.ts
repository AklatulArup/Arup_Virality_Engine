// Shared persistence side-effects for the analyze pipeline: analysis-history
// records and keyword-bank growth. Pool writes flow through the injected
// PipelineCtx.poolWrite (the PoolProvider's write(), which refreshes counts).

import type { EnrichedVideo, KeywordBank } from "@/lib/types";
import { expandKeywordBank } from "@/lib/keyword-bank";

export interface HistoryEntry {
  id: string;
  url: string;
  platform: string;
  title: string;
  channelName: string;
  checkedAt: string;
  metrics: Record<string, number | string>;
  previousSnapshot?: { checkedAt: string; metrics: Record<string, number | string> };
}

export interface PipelineCtx {
  /** PoolProvider.write — any POST that grows the pool or a bank goes through this so counts refresh. */
  poolWrite: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Current reference-pool entries snapshot (for related-entry lookups). */
  poolEntries: import("@/lib/types").ReferenceEntry[];
  /** Current keyword bank (null while loading / unavailable). */
  keywordBank: KeywordBank | null;
  /** Bank state updater so expansions are visible without a refetch. */
  setKeywordBank: (bank: KeywordBank) => void;
  /** Progress line for the UI ("Fetching channel…"). */
  setStatus: (s: string) => void;
}

// Build + fire-and-forget an analysis-history record. Legacy behavior posted
// history for YouTube only; the rebuild posts for every platform (flagged
// deliberate delta) so the Videos index lists TikTok/IG/X analyses too.
export function recordHistory(ctx: PipelineCtx, params: {
  url: string;
  platform: string;
  video: EnrichedVideo;
  channelName: string;
  subscribers?: number;
}): void {
  const { video } = params;
  const entry: HistoryEntry = {
    id: Date.now().toString(),
    url: params.url,
    platform: params.platform,
    title: video.title,
    channelName: params.channelName,
    checkedAt: new Date().toISOString(),
    metrics: {
      views: video.views,
      likes: video.likes,
      engagement: parseFloat(video.engagement.toFixed(2)),
      velocity: Math.round(video.velocity),
      vrsScore: video.vrs.estimatedFullScore,
      subscribers: params.subscribers ?? 0,
    },
  };
  fetch("/api/analysis-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

// Grow the keyword bank from a video's title/description/tags. Mirrors the
// legacy expandBank(): merge locally, persist new niche keywords, no-op when
// the bank hasn't loaded.
export function expandBank(ctx: PipelineCtx, title: string, description: string, tags: string[]): void {
  if (!ctx.keywordBank) return;
  const { bank: updated, newKeywords } = expandKeywordBank(ctx.keywordBank, title, description, tags);
  if (newKeywords.length > 0) {
    ctx.setKeywordBank(updated);
    ctx
      .poolWrite("/api/keyword-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: newKeywords }),
      })
      .catch(() => {});
  }
}

// Fire-and-forget pool write with the standard JSON envelope.
export function writePoolEntries(ctx: PipelineCtx, entries: unknown[]): void {
  if (entries.length === 0) return;
  ctx
    .poolWrite("/api/reference-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    })
    .catch(() => {});
}
