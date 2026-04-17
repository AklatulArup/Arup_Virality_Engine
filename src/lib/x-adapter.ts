import type { XPostData, EnrichedVideo, VideoData } from "./types";
import { runPlatformVRS } from "./vrs";

// Adapter: XPostData → EnrichedVideo
// The forecast panel and predictor expect an EnrichedVideo shape.
// X posts have their own schema from the Apify scraper.
// This maps the X fields onto the equivalent video fields
// (replies → comments, reposts → shares, bookmarks → saves).

export function xPostToEnrichedVideo(p: XPostData, allPosts: XPostData[]): EnrichedVideo {
  const views = p.views || 0;
  const ageMs = p.publishedAt ? Date.now() - new Date(p.publishedAt).getTime() : 0;
  const days  = Math.max(1, Math.floor(ageMs / 86_400_000));
  const velocity = Math.round(views / days);
  const engagement = views > 0 ? ((p.likes + p.replies + p.reposts) / views) * 100 : 0;

  // Compute baseline from other posts for vsBaseline
  const otherViews = allPosts.filter(q => q.id !== p.id).map(q => q.views || 0).filter(v => v > 0);
  const median = otherViews.length > 0
    ? [...otherViews].sort((a, b) => a - b)[Math.floor(otherViews.length / 2)]
    : views;

  const asVideo: VideoData = {
    id:              p.id,
    title:           p.text.slice(0, 80),
    description:     p.text,
    channel:         p.authorName || p.authorHandle,
    channelId:       p.authorHandle,
    views,
    likes:           p.likes,
    comments:        p.replies,        // replies ARE comments on X
    shares:          p.reposts,        // reposts ARE shares on X
    saves:           p.bookmarks,      // bookmarks ARE saves on X
    publishedAt:     p.publishedAt,
    durationSeconds: 0,                // X posts aren't timed content
    duration:        "0:00",
    thumbnail:       "",
    tags:            p.hashtags || [],
    platform:        "x",
  };
  // Attach X-specific fields the predictor may read via type assertion
  (asVideo as unknown as { creatorFollowers?: number }).creatorFollowers = p.authorFollowers;
  (asVideo as unknown as { authorFollowers?: number }).authorFollowers   = p.authorFollowers;

  const vrs = runPlatformVRS(asVideo);  // routes to X_CRITERIA via platform: "x"

  return {
    ...asVideo,
    days,
    velocity,
    engagement,
    vrs,
    isOutlier:  views > median * 3,
    vsBaseline: median > 0 ? views / median : 1,
  } as EnrichedVideo;
}
