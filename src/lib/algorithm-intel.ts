import type {
  PlatformId,
  PlatformInsight,
  PlatformSignal,
  ArchetypeId,
  Recommendation,
} from "./types";

export const PLATFORM_INTEL: Record<PlatformId, PlatformInsight> = {
  youtube: {
    id: "youtube",
    name: "YouTube Long-Form",
    icon: "YT",
    signals: [
      {
        name: "Viewer Satisfaction (AVD)",
        weight: "highest",
        description:
          "Average view duration and satisfaction surveys. Gemini-powered algorithm prioritizes content viewers genuinely enjoy over passive watch time.",
        confidence: "confirmed",
      },
      {
        name: "Click-Through Rate",
        weight: "highest",
        description:
          "Thumbnail + title packaging. High CTR in the first 24-48 hours signals strong interest to the recommendation engine.",
        confidence: "confirmed",
      },
      {
        name: "Retention Curve Shape",
        weight: "highest",
        description:
          "Flat or rising retention curves are rewarded. Steep early drop-off (first 30s) is the #1 killer. 70%+ retention is excellent.",
        confidence: "confirmed",
      },
      {
        name: "Session Contribution",
        weight: "strong",
        description:
          "Videos that lead to more YouTube watching (not just your content) get boosted in recommendations.",
        confidence: "strong",
      },
      {
        name: "Engagement Quality",
        weight: "strong",
        description:
          "Likes, comments, shares, and saves. Comment depth (long comments, replies) matters more than count alone.",
        confidence: "confirmed",
      },
      {
        name: "Non-Subscriber Reach",
        weight: "strong",
        description:
          "Algorithm tests content with non-subscribers. High satisfaction from non-subs triggers broader recommendation.",
        confidence: "strong",
      },
      {
        name: "Upload Consistency",
        weight: "moderate",
        description:
          "Regular upload schedule trains the notification algorithm. 1-2x/week is the sweet spot for most channels.",
        confidence: "likely",
      },
      {
        name: "Search & Topic Authority",
        weight: "moderate",
        description:
          "Channels with consistent topic focus build authority scores. Tags, descriptions, and title keywords feed topic classification.",
        confidence: "strong",
      },
      {
        name: "Freshness Boost",
        weight: "low",
        description:
          "New uploads get a 24-48 hour boost in subscriber feeds and recommendations. Performance in this window determines long-term reach.",
        confidence: "confirmed",
      },
    ],
    keyBehaviors: [
      "Hook viewers in first 7 seconds — show the value or create an open loop",
      "Optimal duration 8-25 minutes for most niches (long enough for mid-rolls, short enough for completion)",
      "Thumbnails: high contrast, readable at mobile size, emotion on face, max 3 words of text",
      "Titles: curiosity gap + clarity. Power words + numbers outperform generic titles",
      "Post within subscriber timezone peak hours (check YouTube Studio analytics)",
      "End screens and cards drive session contribution — link to relevant next video",
      "Chapters improve retention by letting viewers jump to relevant sections",
      "Community tab posts 1-2 days before upload prime the notification audience",
      "Run Test & Compare on titles + thumbnails (winner by watch time per impression, not CTR)",
      "Public views count from the first frame since Aug 24 2026 — judge videos on engaged views, watch time and AVD, not raw views",
    ],
    optimalFormats: [
      "8-25 minute focused videos",
      "Series/playlist format for binge-watching",
      "Tutorial with clear deliverable",
      "Story arc: setup → tension → resolution",
      "Milestone/achievement documentation",
    ],
    antiPatterns: [
      "Misleading thumbnails (high CTR but low satisfaction = algorithmic penalty)",
      "Bloated runtime with padding (hurts retention curve)",
      "No hook in first 7 seconds",
      "Inconsistent upload schedule (breaks notification habit)",
      "Generic titles without curiosity trigger",
      "Ignoring comment section (reduces engagement signals)",
    ],
    lastUpdated: "2026-Q4",
  },

  "youtube-shorts": {
    id: "youtube-shorts",
    name: "YouTube Shorts",
    icon: "YS",
    signals: [
      {
        name: "Completion Rate",
        weight: "highest",
        description:
          "Percentage of viewers who watch the entire Short. The single most important metric. Under 50% completion = limited distribution.",
        confidence: "confirmed",
      },
      {
        name: "Loop Rate",
        weight: "highest",
        description:
          "How many viewers re-watch. Shorts that auto-replay create a loop signal that massively boosts reach.",
        confidence: "strong",
      },
      {
        name: "Engagement Velocity",
        weight: "strong",
        description:
          "Likes, comments, and shares in the first 1-2 hours. Faster engagement = faster distribution.",
        confidence: "confirmed",
      },
      {
        name: "Swipe-Away Rate",
        weight: "strong",
        description:
          "If viewers swipe past quickly, the Short is penalized. First 1-2 seconds must stop the scroll.",
        confidence: "strong",
      },
      {
        name: "Subscribe Conversion",
        weight: "moderate",
        description:
          "Shorts that drive subscriptions signal high value content. YouTube tracks this per-Short.",
        confidence: "likely",
      },
    ],
    keyBehaviors: [
      "Hook in first 1 second — visual or audio pattern interrupt",
      "Optimal length 30-45 seconds (enough for value, short enough for completion)",
      "Text overlays for silent viewing (85% watch without sound initially)",
      "End with a reason to re-watch or loop (revelation, punchline, callback)",
      "Trending sounds boost initial distribution by 20-40%",
      "Post 1-3 Shorts daily during growth phase, then 3-5x/week to maintain",
      "Set a custom Shorts thumbnail (launched Jul 2026) — it shows on Search, Home and the channel page",
      "Group challenge-journey Shorts into a Shorts series (seasons/episodes, Sep 2026)",
      "No dislike button on Shorts since Jun 2026 — 'Not interested' / 'Don't recommend channel' are the negative signals, at channel level",
    ],
    optimalFormats: [
      "30-45 second focused clips",
      "Quick tip or one key insight",
      "Before/after transformation",
      "Reaction to trending topic",
      "Teaser for long-form content",
    ],
    antiPatterns: [
      "Over 60 seconds (viewer drop-off spikes)",
      "Slow start or long intro",
      "Horizontal video letterboxed to vertical",
      "No text overlays (loses silent viewers)",
      "Repurposed TikTok with watermark (deprioritized)",
      "Re-uploading other creators' clips — since Oct 1 2026 Shorts cuts reach for channels that mostly re-upload",
    ],
    lastUpdated: "2026-Q4",
  },

  tiktok: {
    id: "tiktok",
    name: "TikTok",
    icon: "TT",
    signals: [
      {
        name: "Watch Time Ratio",
        weight: "highest",
        description:
          "Total watch time / impressions. Videos watched to completion and re-watched get exponentially more distribution.",
        confidence: "confirmed",
      },
      {
        name: "Shares",
        weight: "highest",
        description:
          "TikTok weights shares more heavily than any other platform. Shared content gets 5-10x more distribution.",
        confidence: "confirmed",
      },
      {
        name: "Comments & Duets",
        weight: "strong",
        description:
          "Comment volume and duet/stitch engagement signal content worth reacting to. Controversial or debate-worthy content thrives.",
        confidence: "confirmed",
      },
      {
        name: "Profile Visits",
        weight: "strong",
        description:
          "If viewers visit your profile after watching, TikTok interprets this as high interest and boosts the video.",
        confidence: "strong",
      },
      {
        name: "Saves (Bookmarks)",
        weight: "moderate",
        description:
          "Saved content is treated as high-value reference material. Educational and utility content benefits most.",
        confidence: "strong",
      },
      {
        name: "Sound Usage",
        weight: "moderate",
        description:
          "Using trending sounds gets initial distribution boost. Original sounds that others reuse create a viral flywheel.",
        confidence: "confirmed",
      },
    ],
    keyBehaviors: [
      "First 1 second is everything — visual pattern interrupt or provocative text hook",
      "Optimal length: 15-60 seconds for reach, 1-3 minutes for depth (split test)",
      "Native vertical (9:16), shot on phone aesthetic performs better than polished production",
      "Post 1-3x daily during growth, minimum 4x/week to stay in algorithm favor",
      "Engage with comments in first 30 minutes — reply comments become mini-videos",
      "Use 3-5 relevant hashtags (not 30), including 1-2 niche-specific",
      "Stitch/duet trending content in your niche for discovery",
    ],
    optimalFormats: [
      "15-60 second quick value drops",
      "Storytime with text overlays",
      "Before/after transformations",
      "Controversial take or hot opinion",
      "Tutorial in under 60 seconds",
      "Day-in-the-life authentic content",
    ],
    antiPatterns: [
      "Overproduced cinematic content (breaks native feel)",
      "No hook in first second",
      "Watermarks from other platforms",
      "Posting less than 3x/week (algorithm forgets you)",
      "Ignoring comments in first hour",
      "Using banned or overused sounds",
    ],
    lastUpdated: "2026-Q1",
  },

  instagram: {
    id: "instagram",
    name: "Instagram Reels & Carousel",
    icon: "IG",
    signals: [
      {
        name: "Saves",
        weight: "highest",
        description:
          "Instagram's #1 ranking signal for Reels and carousels. Saveable content (tips, tutorials, reference material) dramatically outperforms.",
        confidence: "confirmed",
      },
      {
        name: "Shares to DM/Stories",
        weight: "highest",
        description:
          "Content shared privately (DMs) or reshared to Stories signals genuine recommendation. Weighted heavily in 2026.",
        confidence: "confirmed",
      },
      {
        name: "Dwell Time",
        weight: "strong",
        description:
          "Time spent viewing. Carousels get 55s+ avg dwell time vs 15s for single images. Multi-slide content is structurally advantaged.",
        confidence: "strong",
      },
      {
        name: "Completion Rate (Reels)",
        weight: "strong",
        description:
          "Percentage watching to end. Reels under 30 seconds have highest completion rates.",
        confidence: "confirmed",
      },
      {
        name: "Follows from Content",
        weight: "moderate",
        description:
          "If non-followers follow after seeing your content, it signals high value to the Explore algorithm.",
        confidence: "strong",
      },
      {
        name: "Comment Depth",
        weight: "moderate",
        description:
          "Multi-word comments and reply threads weighted more than emoji reactions. Ask questions to drive comment depth.",
        confidence: "likely",
      },
    ],
    keyBehaviors: [
      "Carousels for educational/reference content (highest save rate of any format)",
      "Reels for discovery and reach (algorithm pushes Reels to non-followers)",
      "Carousel structure: hook slide → value slides → CTA slide (8-10 slides optimal)",
      "Reels: 15-30 seconds for reach, 60-90 seconds for depth",
      "Post to Stories within 1 hour of feed post to boost initial engagement",
      "Use location tags and 5-10 relevant hashtags",
      "Collaborate feature with other creators for cross-audience exposure",
    ],
    optimalFormats: [
      "8-10 slide educational carousels",
      "15-30 second Reels with text overlays",
      "Before/after transformation Reels",
      "Quote graphics with brand styling",
      "Behind-the-scenes Stories → Highlights",
    ],
    antiPatterns: [
      "Posting Reels with TikTok watermark (shadowban risk)",
      "Single image posts (lowest reach in 2026)",
      "No CTA or engagement prompt",
      "Inconsistent visual brand (hurts profile visit conversion)",
      "Posting without Stories amplification",
    ],
    lastUpdated: "2026-Q1",
  },

  facebook: {
    id: "facebook",
    name: "Facebook (Reels & Feed)",
    icon: "FB",
    signals: [
      {
        name: "Private Shares",
        weight: "highest",
        description:
          "Sending a post to a friend via Messenger/WhatsApp is the highest-weighted interaction in 2026 — it outranks likes. Build content people send to one person.",
        confidence: "confirmed",
      },
      {
        name: "Watch Time / Completion",
        weight: "highest",
        description:
          "Strongest Reels signal. Videos watched start-to-finish get pushed far wider — ~90% completion can 10x initial distribution.",
        confidence: "confirmed",
      },
      {
        name: "UTIS Interest Score",
        weight: "strong",
        description:
          "The 1–5 'how well does this match your interests?' survey after Reels (Jan 2026). Declared interest corrects for passive scrolling and scales distribution.",
        confidence: "strong",
      },
      {
        name: "Saves",
        weight: "strong",
        description:
          "Lasting-value signal, weighted above likes. Rule breakdowns, checklists, and reference clips earn saves.",
        confidence: "strong",
      },
      {
        name: "Originality (fingerprint)",
        weight: "moderate",
        description:
          "Meta fingerprints video and favours the first uploader. Watermarked/reposted clips are suppressed from recommendations.",
        confidence: "confirmed",
      },
    ],
    keyBehaviors: [
      "Reels is the discovery engine — ~50% of feeds are now recommended non-followed content",
      "Post original uploads (no TikTok/CapCut watermark — it's fingerprinted and suppressed)",
      "Publish same-day and let it ride: same-day Reels get up to +50% surfacing",
      "Make the clip send-worthy in Messenger/WhatsApp — private shares outrank likes",
      "Reuse the same vertical clip across Facebook, Instagram Reels, and Messenger (cross-app graph)",
      "Keep Reels tight (15–90s) — completion is king",
    ],
    optimalFormats: [
      "15–90 second vertical Reels with text overlays",
      "Cliffhanger Reels funnelling to a longer Feed video",
      "Meet-the-trader / changing-lives story clips",
      "Educational challenge/rule breakdowns",
    ],
    antiPatterns: [
      "Reposting watermarked TikTok/IG clips (fingerprinted → excluded)",
      "Static image/link posts (lowest unconnected distribution)",
      "Ambiguous content that fails the UTIS 'is this for me?' test",
      "Withholding everything as bait — kills completion before it can funnel",
    ],
    lastUpdated: "2026-Q3",
  },

  x: {
    id: "x",
    name: "X (Twitter)",
    icon: "X",
    signals: [
      {
        name: "Copy-Link & DM Shares",
        weight: "highest",
        description:
          "In X's published weights (Aug 2026) a copy-link share is the top positive signal (+20, ~30x a like); DM shares and quotes score +5. Content people paste elsewhere — data, charts, payout proof — travels furthest.",
        confidence: "confirmed",
      },
      {
        name: "Reply Engagement",
        weight: "highest",
        description:
          "Replies score +5 (~7.6x a like), and replies from mutual follows get +15 more. Content that sparks real conversation still gets far more distribution than likes.",
        confidence: "confirmed",
      },
      {
        name: "Repost/Quote Velocity",
        weight: "highest",
        description:
          "Reposts in the first 30-60 minutes determine if content breaks out of follower graph into For You feed.",
        confidence: "strong",
      },
      {
        name: "Bookmark Rate",
        weight: "strong",
        description:
          "Bookmarks signal high-value content. Thread-style posts and data-rich content get bookmarked most.",
        confidence: "strong",
      },
      {
        name: "Dwell Time",
        weight: "strong",
        description:
          "Time spent reading. Long-form posts, threads, and image carousels that hold attention are boosted.",
        confidence: "likely",
      },
      {
        name: "Link Click-Through",
        weight: "moderate",
        description:
          "X dropped the link penalty (Jul 2026); link opens score +0.2. Links can go in the main post — lead with a native hook so the post earns replies and shares before the click.",
        confidence: "confirmed",
      },
      {
        name: "Profile Authority",
        weight: "moderate",
        description:
          "Account age, follower quality, verification status, and topic consistency affect baseline distribution.",
        confidence: "likely",
      },
    ],
    keyBehaviors: [
      "First line is the hook — make it a bold claim, question, or contrarian take",
      "Threads outperform single tweets for educational content (each reply gets its own impression)",
      "Links are fine in the main post now — but open with a native hook, chart or image",
      "Engage with replies in first 30 minutes to boost the conversation signal",
      "Quote-tweet with added insight > simple repost",
      "Optimal posting: 2-5x daily, with 1 high-effort thread per day",
      "Use polls for engagement — they get 2-3x more impressions than text posts",
    ],
    optimalFormats: [
      "Bold opening statement + thread",
      "Data visualization or chart with insight",
      "Hot take with evidence",
      "Before/after comparison",
      "Step-by-step breakdown thread",
      "Poll with controversial options",
    ],
    antiPatterns: [
      "Bare links with no hook (link opens score only +0.2)",
      "Posting without engaging with replies",
      "Thread with no hook in first tweet",
      "Overusing hashtags (more than 2 looks spammy on X)",
      "Auto-cross-posting from other platforms (no native optimization)",
    ],
    lastUpdated: "2026-Q4",
  },
};

export function getPlatformRecommendations(
  platforms: PlatformId[],
  archetypes: ArchetypeId[],
  engagement: number,
  vrsScore: number
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const pid of platforms) {
    const platform = PLATFORM_INTEL[pid];
    if (!platform) continue;

    // Cross-platform repurposing recommendations based on archetypes
    if (archetypes.includes("educational") || archetypes.includes("utility")) {
      if (pid === "instagram") {
        recs.push({
          priority: "high",
          category: "platform",
          text: `Repurpose as an 8-10 slide Instagram carousel. Educational carousels get the highest save rate on Instagram, and saves are the #1 ranking signal.`,
          platformContext: ["instagram"],
          evidence: `Educational archetypes align with Instagram's save-driven algorithm. Carousel dwell time (55s+) is 3.7x higher than single images.`,
        });
      }
    }

    if (
      archetypes.includes("controversy") ||
      archetypes.includes("myth-busting")
    ) {
      if (pid === "x") {
        recs.push({
          priority: "high",
          category: "platform",
          text: `Post the contrarian take as a bold opening tweet + thread. Replies are weighted 27x more than likes on X — controversial takes drive massive reply engagement.`,
          platformContext: ["x"],
          evidence: `X's algorithm heavily rewards reply engagement. Contrarian content archetypes naturally drive debate.`,
        });
      }
      if (pid === "tiktok") {
        recs.push({
          priority: "medium",
          category: "platform",
          text: `Create a 30-60s TikTok with the hot take as a text hook in the first second. Controversial content drives shares, TikTok's highest-weighted signal.`,
          platformContext: ["tiktok"],
          evidence: `TikTok weights shares more heavily than any platform. Debate-worthy content gets shared to group chats.`,
        });
      }
    }

    if (
      archetypes.includes("data-proof") ||
      archetypes.includes("challenge")
    ) {
      if (pid === "youtube-shorts") {
        recs.push({
          priority: "medium",
          category: "platform",
          text: `Extract the key result moment into a 30-45 second YouTube Short. Show the proof/result in the first 2 seconds, then explain how. Completion rate is king for Shorts.`,
          platformContext: ["youtube-shorts"],
          evidence: `Data-proof and challenge results create natural hooks. Shorts completion rate is the #1 ranking signal.`,
        });
      }
    }

    // (emotional/behind-scenes archetype routing intentionally empty here — no platform in the active set is specifically tuned for it.)

    // Low engagement warning
    if (engagement < 3 && pid === "youtube") {
      recs.push({
        priority: "high",
        category: "content",
        text: `Engagement is below 3% — add explicit CTAs asking viewers to comment. Pin a question as the first comment. Each creator reply generates a notification that brings viewers back.`,
        platformContext: ["youtube"],
        evidence: `Current engagement rate: ${engagement.toFixed(1)}%. YouTube's satisfaction algorithm factors comment depth and creator interaction.`,
      });
    }

    // VRS-based platform recommendations
    if (vrsScore >= 75 && pid === "youtube") {
      recs.push({
        priority: "medium",
        category: "content",
        text: `VRS is strong (${vrsScore}%). Focus on the hidden criteria gap — watch time, hook quality, and CTR are where the biggest improvements hide.`,
        platformContext: ["youtube"],
        evidence: `Auto-assessed VRS: ${vrsScore}%. Hidden criteria (requiring YouTube Studio) account for 69% of total weight.`,
      });
    }
  }

  // Sort by priority
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  return recs;
}

// ─── TikTok-Specific Recommendations ───

export interface TikTokVideoStats {
  shares: number;
  saves: number;
  views: number;
  likes: number;
  comments: number;
  durationSeconds: number;
  soundName?: string;
  hashtags?: string[];
}

export function getTikTokRecommendations(
  videos: TikTokVideoStats[],
  archetypes: ArchetypeId[],
  avgEngagement: number,
  avgTRS: number
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (videos.length === 0) return recs;

  // Share rate analysis
  const avgShareRate =
    videos.reduce(
      (s, v) => s + (v.views > 0 ? v.shares / v.views : 0),
      0
    ) / videos.length;

  if (avgShareRate < 0.003) {
    recs.push({
      priority: "high",
      category: "content",
      text: `Average share rate is ${(avgShareRate * 100).toFixed(2)}% — below the 0.3% threshold. Shares are TikTok's #1 signal (27x more powerful than likes). Add "send this to someone who..." CTAs, create relatable moments, or use controversial takes.`,
      platformContext: ["tiktok"],
      evidence: `Avg share rate across ${videos.length} videos: ${(avgShareRate * 100).toFixed(3)}%. Target: >=0.3% for partial, >=1% for viral-level.`,
    });
  }

  // Save rate analysis
  const avgSaveRate =
    videos.reduce(
      (s, v) => s + (v.views > 0 ? v.saves / v.views : 0),
      0
    ) / videos.length;

  if (avgSaveRate < 0.002) {
    recs.push({
      priority: "high",
      category: "content",
      text: `Save rate is ${(avgSaveRate * 100).toFixed(2)}%. Saves signal long-term value. Add actionable tips, step-by-step breakdowns, or "save for later" CTAs. Lists and tutorials drive the highest save rates.`,
      platformContext: ["tiktok"],
      evidence: `Avg save rate: ${(avgSaveRate * 100).toFixed(3)}%. Target: >=0.2% baseline, >=0.5% strong.`,
    });
  }

  // Duration analysis — compare short vs long performance
  const shortVideos = videos.filter((v) => v.durationSeconds <= 60);
  const longVideos = videos.filter((v) => v.durationSeconds > 60);
  if (shortVideos.length > 0 && longVideos.length > 0) {
    const shortAvgViews =
      shortVideos.reduce((s, v) => s + v.views, 0) / shortVideos.length;
    const longAvgViews =
      longVideos.reduce((s, v) => s + v.views, 0) / longVideos.length;

    if (shortAvgViews > longAvgViews * 1.5) {
      recs.push({
        priority: "medium",
        category: "format",
        text: `Short videos (≤60s) average ${Math.round(shortAvgViews).toLocaleString()} views vs ${Math.round(longAvgViews).toLocaleString()} for longer ones. TikTok's FYP favors content with high completion rates — keep videos under 60 seconds for maximum reach.`,
        platformContext: ["tiktok"],
        evidence: `${shortVideos.length} short videos vs ${longVideos.length} long. Short outperform by ${((shortAvgViews / longAvgViews - 1) * 100).toFixed(0)}%.`,
      });
    } else if (longAvgViews > shortAvgViews * 1.5) {
      recs.push({
        priority: "medium",
        category: "format",
        text: `Longer videos (>60s) are outperforming short ones here. The audience values depth — lean into 1-3 min educational or story content. Ensure strong hooks to maintain watch time.`,
        platformContext: ["tiktok"],
        evidence: `Long videos avg: ${Math.round(longAvgViews).toLocaleString()} views vs short: ${Math.round(shortAvgViews).toLocaleString()}.`,
      });
    }
  }

  // Sound analysis
  const withSound = videos.filter((v) => v.soundName);
  const withoutSound = videos.filter((v) => !v.soundName);
  if (withSound.length > 0 && withoutSound.length > 0) {
    const soundAvg =
      withSound.reduce((s, v) => s + v.views, 0) / withSound.length;
    const noSoundAvg =
      withoutSound.reduce((s, v) => s + v.views, 0) / withoutSound.length;
    if (soundAvg > noSoundAvg * 1.3) {
      recs.push({
        priority: "medium",
        category: "platform",
        text: `Videos with sounds average ${((soundAvg / noSoundAvg - 1) * 100).toFixed(0)}% more views. Use trending sounds to tap into TikTok's sound-based distribution — the algorithm groups content by audio.`,
        platformContext: ["tiktok"],
        evidence: `With sound: ${Math.round(soundAvg).toLocaleString()} avg views (${withSound.length} videos). Without: ${Math.round(noSoundAvg).toLocaleString()} (${withoutSound.length} videos).`,
      });
    }
  }

  // Hashtag analysis — find which hashtags correlate with highest views
  const hashtagPerformance: Record<string, { views: number; count: number }> =
    {};
  for (const v of videos) {
    if (!v.hashtags) continue;
    for (const h of v.hashtags) {
      const tag = h.toLowerCase();
      if (!hashtagPerformance[tag])
        hashtagPerformance[tag] = { views: 0, count: 0 };
      hashtagPerformance[tag].views += v.views;
      hashtagPerformance[tag].count++;
    }
  }

  const topHashtags = Object.entries(hashtagPerformance)
    .filter(([, d]) => d.count >= 2)
    .map(([tag, d]) => ({ tag, avgViews: d.views / d.count, count: d.count }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3);

  if (topHashtags.length > 0) {
    recs.push({
      priority: "medium",
      category: "platform",
      text: `Top-performing hashtags: ${topHashtags.map((h) => `#${h.tag} (${Math.round(h.avgViews).toLocaleString()} avg views, ${h.count} videos)`).join(", ")}. Use these in future content for better FYP targeting.`,
      platformContext: ["tiktok"],
      evidence: `Analysis of ${Object.keys(hashtagPerformance).length} unique hashtags across ${videos.length} videos.`,
    });
  }

  // FYP optimization based on TRS
  if (avgTRS >= 60) {
    recs.push({
      priority: "low",
      category: "platform",
      text: `Average TRS is ${avgTRS}% — solid foundation. Focus on the hidden criteria (hook quality, native feel, posting consistency) for the next jump in FYP distribution.`,
      platformContext: ["tiktok"],
      evidence: `TRS ${avgTRS}% from ${videos.length} videos. Hidden criteria account for significant weight.`,
    });
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  return recs;
}
