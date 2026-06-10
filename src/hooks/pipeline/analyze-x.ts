// X (Twitter) analyze pipeline — transplanted from legacy Dashboard.tsx.
// Preserves: scrape envelope (limit 30), x-batch result shape (legacy casts —
// the union's x-batch member matches at runtime), pool write of every post
// through the x-adapter.

import type { AnalysisResult, ReferenceEntry, ParsedInput, XPostData } from "@/lib/types";
import { buildEntryFromVideo } from "@/lib/reference-store";
import { xPostToEnrichedVideo } from "@/lib/x-adapter";
import { recordHistory, writePoolEntries, type PipelineCtx } from "./persist";

export async function analyzeX(parsed: ParsedInput, rawUrl: string, ctx: PipelineCtx): Promise<AnalysisResult> {
  ctx.setStatus(`Scraping X${parsed.handle ? ` @${parsed.handle}` : ""}...`);
  const xRes = await fetch("/api/x/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: parsed.url,
      handle: parsed.handle,
      limit: 30,
    }),
  });
  if (!xRes.ok) {
    const err = await xRes.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "X scrape failed. Ensure APIFY_TOKEN_TWITTER is set in Vercel env vars.");
  }
  const xData = await xRes.json();
  const xPosts: XPostData[] = xData.posts;
  if (!xPosts || xPosts.length === 0) {
    throw new Error("No X posts returned. The account may be private or rate-limited.");
  }

  const result = { type: "x-batch", posts: xPosts } as unknown as AnalysisResult;

  const xEntries: ReferenceEntry[] = xPosts.map((p) => {
    const enriched = xPostToEnrichedVideo(p, xPosts);
    return buildEntryFromVideo(enriched, "x");
  });
  writePoolEntries(ctx, xEntries);

  // History for every platform (deliberate rebuild delta). Use the top post.
  const topEnriched = xPostToEnrichedVideo(xPosts[0], xPosts);
  recordHistory(ctx, {
    url: parsed.url || rawUrl,
    platform: "x",
    video: topEnriched,
    channelName: topEnriched.channel,
    subscribers: xPosts[0].authorFollowers ?? 0,
  });

  ctx.setStatus("");
  return result;
}
