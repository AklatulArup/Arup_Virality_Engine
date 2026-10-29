import type {
  EnrichedVideo,
  ChannelData,
  ReferenceEntry,
  DeepAnalysis,
  MonthlyBucket,
  MonthlyProjection,
  ArchetypePerformance,
  TitlePattern,
  OutlierInsight,
  EngagementPattern,
  Recommendation,
  ArchetypeId,
  ViewPrediction,
  ConfidenceLevel,
} from "./types";
import { detectArchetypes, getArchetype } from "./archetypes";
import { getPlatformRecommendations, getTikTokRecommendations } from "./algorithm-intel";
import type { TikTokVideoStats } from "./algorithm-intel";
import { calculateMedian } from "./baseline";
import type { Platform } from "./forecast";

// ─── Platform helpers ────────────────────────────────────────────────────
//
// "Short-form" = algorithm-driven feed content where TikTok-style heuristics
// (TT_TITLE_PATTERNS, share/save rates, FYP-style insights) apply better than
// YouTube long-form logic. IG Reels and YT Shorts both qualify.
const SHORT_FORM_PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube_short"];
const isShortForm = (p: Platform): boolean => SHORT_FORM_PLATFORMS.includes(p);

// Platform-specific messaging for recommendation + insight strings. Replaces
// the old "TikTok's FYP algorithm" / "YouTube's algorithm" binary that left
// IG, YTS, and X sounding robotic.
function platformAlgorithmName(p: Platform): string {
  switch (p) {
    case "tiktok":        return "TikTok's FYP algorithm";
    case "instagram":     return "Instagram's feed algorithm";
    case "youtube_short": return "YouTube Shorts' algorithm";
    case "x":             return "X's For You algorithm";
    case "youtube":
    default:              return "YouTube's algorithm";
  }
}

function platformInitialPushLabel(p: Platform): string {
  switch (p) {
    case "tiktok":        return "FYP";
    case "instagram":     return "Reels feed";
    case "youtube_short": return "Shorts feed";
    case "x":             return "For You";
    case "youtube":
    default:              return "algorithmic";
  }
}

function platformMidPhaseTraffic(p: Platform): string {
  switch (p) {
    case "tiktok":        return "Residual FYP";
    case "instagram":     return "Residual Reels feed";
    case "youtube_short": return "Residual Shorts feed";
    case "x":             return "Residual For You";
    case "youtube":
    default:              return "Search & suggested";
  }
}

// ─── Monthly Trajectory ───

function computeMonthlyTrajectory(videos: EnrichedVideo[]): MonthlyBucket[] {
  const buckets: Record<string, EnrichedVideo[]> = {};

  for (const v of videos) {
    const month = v.publishedAt.slice(0, 7); // "YYYY-MM"
    if (!buckets[month]) buckets[month] = [];
    buckets[month].push(v);
  }

  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return Object.keys(buckets)
    .sort()
    .map((month) => {
      const vids = buckets[month];
      const totalViews = vids.reduce((s, v) => s + v.views, 0);
      const totalVelocity = vids.reduce((s, v) => s + v.velocity, 0);
      const totalEngagement = vids.reduce((s, v) => s + v.engagement, 0);
      const [y, m] = month.split("-");
      return {
        month,
        label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        videoCount: vids.length,
        totalViews,
        avgViews: Math.round(totalViews / vids.length),
        avgVelocity: Math.round(totalVelocity / vids.length),
        avgEngagement: parseFloat(
          (totalEngagement / vids.length).toFixed(2)
        ),
      };
    });
}

// ─── Archetype Performance ───

function computeArchetypePerformance(
  videos: EnrichedVideo[]
): ArchetypePerformance[] {
  const map: Record<string, EnrichedVideo[]> = {};

  for (const v of videos) {
    const archetypes = detectArchetypes(v.title, v.tags);
    for (const a of archetypes) {
      if (!map[a]) map[a] = [];
      map[a].push(v);
    }
  }

  return Object.entries(map)
    .map(([id, vids]) => {
      const archetype = getArchetype(id as ArchetypeId);
      const best = vids.reduce((a, b) => (a.views > b.views ? a : b));
      return {
        archetypeId: id as ArchetypeId,
        label: archetype?.label || id,
        videoCount: vids.length,
        avgViews: Math.round(
          vids.reduce((s, v) => s + v.views, 0) / vids.length
        ),
        avgEngagement: parseFloat(
          (
            vids.reduce((s, v) => s + v.engagement, 0) / vids.length
          ).toFixed(2)
        ),
        avgVRS: Math.round(
          vids.reduce((s, v) => s + v.vrs.estimatedFullScore, 0) / vids.length
        ),
        outlierCount: vids.filter((v) => v.isOutlier).length,
        bestVideo: { title: best.title, views: best.views },
      };
    })
    .sort((a, b) => b.avgViews - a.avgViews);
}

// ─── Title Pattern Analysis ───

const YT_TITLE_PATTERNS: { pattern: string; regex: RegExp }[] = [
  { pattern: "Number-led", regex: /^\d+|\btop \d+\b|\b\d+ (ways|tips|steps|lessons|mistakes)\b/i },
  { pattern: "Question format", regex: /^(how|why|what|when|where|can|is|do|does|should|will)\b/i },
  { pattern: "Challenge / Result", regex: /\b(challenge|passed|failed|result|attempt|approved|exam)\b/i },
  { pattern: "Money / Proof", regex: /\$[\d,]+|\b(profit|payout|withdrawal|retire|retir[oa]r|fondea)/i },
  { pattern: "Emotional hook", regex: /\b(blew|lost|struggle|changed|never|secret|truth|quit|give up|rendirte|rindes)\b/i },
  { pattern: "Comparison / Versus", regex: /\bvs\.?\b|\bversus\b|\bcompared\b|\bbetter\b|\bwhich\b|\bmejor(es)?\b/i },
  { pattern: "List / Ranking", regex: /\btop \d+\b|\b\d+ (best|worst|biggest|most|mejores)\b/i },
  { pattern: "Urgency / FOMO", regex: /\b(now|today|stop|must|immediately|antes de|ahora|2026|2025)\b/i },
  { pattern: "Personal milestone", regex: /\b(my first|por primera vez|mi primer[oa]?|primera vez|first time)\b/i },
  { pattern: "Direct address", regex: /\b(you need|you must|if you|si (tu|vas|quieres)|mira este)\b/i },
];

const TT_TITLE_PATTERNS: { pattern: string; regex: RegExp }[] = [
  { pattern: "POV hook", regex: /\bpov[:\s]/i },
  { pattern: "Wait for it", regex: /\bwait (for it|til|till|until)\b/i },
  { pattern: "This is why", regex: /\bthis is (why|how|what)\b/i },
  { pattern: "Watch till end", regex: /\bwatch (till|til|until|to) the end\b/i },
  { pattern: "Reply to @", regex: /^reply to @|replying to @/i },
  { pattern: "Storytime", regex: /\bstorytime\b/i },
  { pattern: "Part / Series", regex: /\bpart \d+\b|\bpt\.?\s*\d+\b/i },
  { pattern: "Challenge / Result", regex: /\b(challenge|passed|failed|result|attempt|approved|exam)\b/i },
  { pattern: "Money / Proof", regex: /\$[\d,]+|\b(profit|payout|withdrawal|funded|prop firm)\b/i },
  { pattern: "Emotional hook", regex: /\b(blew|lost|struggle|changed|never|secret|truth|quit|give up)\b/i },
  { pattern: "Number-led", regex: /^\d+|\btop \d+\b|\b\d+ (ways|tips|steps|lessons|mistakes)\b/i },
  { pattern: "Direct address / CTA", regex: /\b(you need|you must|if you|send this to|tag someone)\b/i },
  { pattern: "Urgency / FOMO", regex: /\b(now|today|stop|must|immediately|2026|2025|before it)\b/i },
  { pattern: "Relatable / Humor", regex: /\b(when you|me when|that moment when|nobody:|literally)\b/i },
];

function analyzeTitlePatterns(videos: EnrichedVideo[], platform: Platform = "youtube"): TitlePattern[] {
  // Short-form platforms (TT / IG / YTS) share viral title DNA — use TT patterns.
  const patterns = isShortForm(platform) ? TT_TITLE_PATTERNS : YT_TITLE_PATTERNS;
  const results: TitlePattern[] = [];

  for (const { pattern, regex } of patterns) {
    const matches = videos.filter((v) => regex.test(v.title));
    if (matches.length === 0) continue;

    results.push({
      pattern,
      matchCount: matches.length,
      avgViews: Math.round(
        matches.reduce((s, v) => s + v.views, 0) / matches.length
      ),
      avgEngagement: parseFloat(
        (
          matches.reduce((s, v) => s + v.engagement, 0) / matches.length
        ).toFixed(2)
      ),
      examples: matches
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((v) => v.title),
    });
  }

  return results.sort((a, b) => b.avgViews - a.avgViews);
}

// ─── Outlier Insights ───

function generateOutlierInsights(
  videos: EnrichedVideo[],
  medianViews: number,
  platform: Platform = "youtube"
): OutlierInsight[] {
  const outliers = videos.filter((v) => v.isOutlier);
  if (outliers.length === 0) return [];

  const avgDuration =
    videos.reduce((s, v) => s + v.durationSeconds, 0) / videos.length;
  const avgEngagement =
    videos.reduce((s, v) => s + v.engagement, 0) / videos.length;

  // Day-of-week analysis
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return outliers
    .sort((a, b) => b.views - a.views)
    .map((v) => {
      const reasons: string[] = [];
      const archetypes = detectArchetypes(v.title, v.tags);
      const titlePats: string[] = [];

      // View multiplier
      const multiplier = (v.views / medianViews).toFixed(1);
      reasons.push(
        `${multiplier}x the channel median (${medianViews.toLocaleString()} views). This is a statistical outlier.`
      );

      // Engagement comparison
      if (v.engagement > avgEngagement * 1.3) {
        reasons.push(
          `Engagement (${v.engagement.toFixed(1)}%) is ${((v.engagement / avgEngagement - 1) * 100).toFixed(0)}% above the channel average (${avgEngagement.toFixed(1)}%). High engagement suggests genuine audience resonance, not just algorithmic push.`
        );
      } else if (v.engagement < avgEngagement * 0.8) {
        reasons.push(
          `Engagement (${v.engagement.toFixed(1)}%) is below the channel average (${avgEngagement.toFixed(1)}%). Views were likely driven by algorithm recommendation to non-subscribers rather than core audience activation.`
        );
      } else {
        reasons.push(
          `Engagement (${v.engagement.toFixed(1)}%) is proportional to the channel average. Both core audience and algorithmic reach contributed.`
        );
      }

      // Duration comparison
      if (v.durationSeconds > avgDuration * 1.5) {
        reasons.push(
          `At ${v.duration}, this video is significantly longer than the channel average. Longer content that retains viewers signals high value to the algorithm.`
        );
      } else if (v.durationSeconds < avgDuration * 0.6) {
        reasons.push(
          `At ${v.duration}, this is shorter than typical. Shorter, focused content often has higher completion rates, boosting algorithmic distribution.`
        );
      }

      // Archetype reasoning
      const archetypeLabels = archetypes
        .map((a) => getArchetype(a)?.label)
        .filter(Boolean);
      if (archetypeLabels.length > 0) {
        reasons.push(
          `Content archetype: ${archetypeLabels.join(" + ")}. This combination is algorithmically strong because it provides clear value signaling for recommendation.`
        );
      }

      // Short-form share/save virality (applies to TT, IG, YTS — all use the
      // same intent-signal model: shares + saves outweigh likes as distribution
      // triggers). Messaging adapts per platform.
      if (isShortForm(platform)) {
        const shares = (v as unknown as { shares?: number }).shares ?? 0;
        const shareRate = v.views > 0 ? (shares / v.views) * 100 : 0;
        if (shareRate >= 1) {
          const weight =
            platform === "tiktok"        ? "27x" :
            platform === "instagram"     ? "strong"  :
            platform === "youtube_short" ? "strong"  : "strong";
          reasons.push(
            `Share rate is ${shareRate.toFixed(2)}% — well above 1% threshold. On ${platformAlgorithmName(platform).replace(/ algorithm.*$/, "")}, shares are a ${weight} signal for feed distribution. This video was actively shared.`
          );
        }
        const saves = (v as unknown as { saves?: number }).saves ?? 0;
        const saveRate = v.views > 0 ? (saves / v.views) * 100 : 0;
        if (saveRate >= 0.5) {
          reasons.push(
            `Save rate is ${saveRate.toFixed(2)}% — signals high rewatch / reference value. Saves boost distribution on ${platformAlgorithmName(platform).replace(/ algorithm.*$/, "")} as a strong intent signal.`
          );
        }
      }

      // Title pattern reasoning — short-form platforms share TT patterns.
      const titlePatternSet = isShortForm(platform) ? TT_TITLE_PATTERNS : YT_TITLE_PATTERNS;
      for (const { pattern, regex } of titlePatternSet) {
        if (regex.test(v.title)) titlePats.push(pattern);
      }
      if (titlePats.length > 0) {
        reasons.push(
          `Title uses ${titlePats.join(", ")} patterns — these create curiosity and specificity that drive higher CTR.`
        );
      }

      // Comment density
      const commentRate = (v.comments / (v.views || 1)) * 100;
      if (commentRate > 1) {
        reasons.push(
          `High comment density (${commentRate.toFixed(2)}% of viewers commented). Active comment sections signal satisfaction to ${platformAlgorithmName(platform)}.`
        );
      }

      // Timing
      const pubDate = new Date(v.publishedAt);
      const dayName = dayNames[pubDate.getDay()];
      const timingNote = `Published on ${dayName}, ${pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      return {
        video: v,
        reasons,
        archetypes,
        titlePatterns: titlePats,
        timingNote,
      };
    });
}

// ─── Engagement Pattern ───

function analyzeEngagementPatterns(
  videos: EnrichedVideo[]
): EngagementPattern {
  if (videos.length === 0) {
    return {
      likesPerView: 0,
      commentsPerView: 0,
      highEngagementThreshold: 0,
      lowEngagementThreshold: 0,
      trend: "stable",
    };
  }

  const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
  const totalComments = videos.reduce((s, v) => s + v.comments, 0);
  const totalViews = videos.reduce((s, v) => s + v.views, 0);

  const engagements = videos.map((v) => v.engagement).sort((a, b) => a - b);
  const p25 = engagements[Math.floor(engagements.length * 0.25)] || 0;
  const p75 = engagements[Math.floor(engagements.length * 0.75)] || 0;

  // Trend: compare older half vs newer half engagement
  const sorted = [...videos].sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );
  const mid = Math.floor(sorted.length / 2);
  if (mid === 0) {
    return {
      likesPerView: totalViews > 0 ? totalLikes / totalViews : 0,
      commentsPerView: totalViews > 0 ? totalComments / totalViews : 0,
      highEngagementThreshold: p75,
      lowEngagementThreshold: p25,
      trend: "stable",
    };
  }

  const olderEng =
    sorted.slice(0, mid).reduce((s, v) => s + v.engagement, 0) / mid;
  const newerEng =
    sorted.slice(mid).reduce((s, v) => s + v.engagement, 0) /
    (sorted.length - mid);

  const ratio = newerEng / (olderEng || 1);
  const trend: EngagementPattern["trend"] =
    ratio > 1.15 ? "improving" : ratio < 0.85 ? "declining" : "stable";

  return {
    likesPerView: totalViews > 0 ? totalLikes / totalViews : 0,
    commentsPerView: totalViews > 0 ? totalComments / totalViews : 0,
    highEngagementThreshold: p75,
    lowEngagementThreshold: p25,
    trend,
  };
}

// ─── Recommendation Engine ───

function generateRecommendations(
  videos: EnrichedVideo[],
  channel: ChannelData | null,
  archetypePerf: ArchetypePerformance[],
  titlePatterns: TitlePattern[],
  outlierInsights: OutlierInsight[],
  engagementPattern: EngagementPattern,
  monthlyTrajectory: MonthlyBucket[],
  _referenceEntries: ReferenceEntry[],
  platform: Platform = "youtube"
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (videos.length < 3) return recs;

  const medianViews = calculateMedian(videos.map((v) => v.views));
  const avgVRS = Math.round(
    videos.reduce((s, v) => s + v.vrs.estimatedFullScore, 0) / videos.length
  );

  // Top archetype recommendation
  if (archetypePerf.length >= 2) {
    const best = archetypePerf[0];
    const second = archetypePerf[1];
    if (best.avgViews > second.avgViews * 1.3) {
      recs.push({
        priority: "high",
        category: "content",
        text: `"${best.label}" content averages ${best.avgViews.toLocaleString()} views — ${Math.round((best.avgViews / second.avgViews - 1) * 100)}% more than the next best archetype ("${second.label}"). Produce more content in this format.`,
        evidence: `${best.videoCount} videos analyzed. ${best.outlierCount} outliers in this archetype.`,
      });
    }
  }

  // Best title pattern
  if (titlePatterns.length >= 2) {
    const best = titlePatterns[0];
    if (best.avgViews > medianViews * 1.5) {
      recs.push({
        priority: "high",
        category: "title",
        text: `"${best.pattern}" titles average ${best.avgViews.toLocaleString()} views (${((best.avgViews / medianViews - 1) * 100).toFixed(0)}% above median). Use this title structure more consistently.`,
        evidence: `${best.matchCount} videos matched this pattern. Top example: "${best.examples[0]}"`,
      });
    }
  }

  // Upload frequency
  if (videos.length >= 5) {
    const sorted = [...videos].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(sorted.length - 1, 10); i++) {
      const diff =
        new Date(sorted[i].publishedAt).getTime() -
        new Date(sorted[i + 1].publishedAt).getTime();
      gaps.push(diff / 86_400_000);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    if (avgGap > 10) {
      recs.push({
        priority: "medium",
        category: "timing",
        text: `Average upload gap is ${Math.round(avgGap)} days. Tightening to 7 days would improve notification algorithm training and subscriber retention.`,
        platformContext: ["youtube"],
        evidence: `Analyzed ${gaps.length} upload intervals. YouTube's algorithm rewards consistent weekly uploads.`,
      });
    } else if (avgGap < 3) {
      recs.push({
        priority: "medium",
        category: "timing",
        text: `Uploading every ${Math.round(avgGap)} days may be diluting per-video performance. Consider reducing to 1-2x/week with higher production value per video.`,
        platformContext: ["youtube"],
        evidence: `Average views per video: ${medianViews.toLocaleString()}. More frequent uploads can cannibalize each other's initial 48-hour window.`,
      });
    }
  }

  // Engagement trend
  if (engagementPattern.trend === "declining") {
    recs.push({
      priority: "high",
      category: "content",
      text: `Engagement is trending downward. Recent videos are generating less interaction per view. Consider adding stronger CTAs, asking questions, or shifting to more interactive content formats.`,
      evidence: `Engagement trend: declining. Newer half of videos has lower avg engagement than older half.`,
    });
  } else if (engagementPattern.trend === "improving") {
    recs.push({
      priority: "low",
      category: "content",
      text: `Engagement is trending upward — keep doing what you're doing. The audience is becoming more active.`,
      evidence: `Engagement trend: improving. Newer videos show higher interaction rates.`,
    });
  }

  // Monthly trajectory growth/decline
  if (monthlyTrajectory.length >= 3) {
    const recent = monthlyTrajectory.slice(-2);
    const older = monthlyTrajectory.slice(0, -2);
    const recentAvg =
      recent.reduce((s, b) => s + b.avgViews, 0) / recent.length;
    const olderAvg =
      older.reduce((s, b) => s + b.avgViews, 0) / older.length;

    if (recentAvg > olderAvg * 1.5) {
      recs.push({
        priority: "medium",
        category: "content",
        text: `Recent months show ${Math.round((recentAvg / olderAvg - 1) * 100)}% view growth over the earlier period. The channel is gaining momentum — capitalize with milestone content and cross-platform repurposing.`,
        evidence: `Recent avg: ${Math.round(recentAvg).toLocaleString()} views/video vs earlier avg: ${Math.round(olderAvg).toLocaleString()}.`,
      });
    }
  }

  // Outlier pattern
  if (outlierInsights.length > 0) {
    const outlierArchetypes: Record<string, number> = {};
    for (const oi of outlierInsights) {
      for (const a of oi.archetypes) {
        outlierArchetypes[a] = (outlierArchetypes[a] || 0) + 1;
      }
    }
    const topArchetype = Object.entries(outlierArchetypes).sort(
      (a, b) => b[1] - a[1]
    )[0];
    if (topArchetype) {
      const label =
        getArchetype(topArchetype[0] as ArchetypeId)?.label || topArchetype[0];
      recs.push({
        priority: "high",
        category: "content",
        text: `${outlierInsights.length} outlier(s) detected, and "${label}" is the dominant archetype among them. This is the channel's proven viral format — plan future content around this archetype.`,
        evidence: `${topArchetype[1]} of ${outlierInsights.length} outliers are "${label}" content.`,
      });
    }
  }

  // Platform-specific recommendations
  const topArchetypes: ArchetypeId[] = archetypePerf
    .slice(0, 3)
    .map((a) => a.archetypeId);
  const avgEng =
    videos.reduce((s, v) => s + v.engagement, 0) / videos.length;

  // Short-form platforms (TT / IG / YTS) all benefit from the TikTok-style
  // recommendation set — share/save-driven, hook-first, FYP-aware. IG + YTS
  // reuse the same engine because the growth levers are identical.
  if (isShortForm(platform)) {
    const ttStats: TikTokVideoStats[] = videos.map((v) => ({
      shares: (v as unknown as { shares?: number }).shares ?? 0,
      saves: (v as unknown as { saves?: number }).saves ?? 0,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      durationSeconds: v.durationSeconds,
      soundName: (v as unknown as { soundName?: string }).soundName,
      hashtags: v.tags,
    }));
    const tiktokRecs = getTikTokRecommendations(ttStats, topArchetypes, avgEng, avgVRS);
    recs.push(...tiktokRecs);
  } else {
    // Cross-platform recommendations for YouTube
    const platformRecs = getPlatformRecommendations(
      ["youtube", "youtube-shorts", "tiktok", "instagram", "x"],
      topArchetypes,
      avgEng,
      avgVRS
    );
    recs.push(...platformRecs);
  }

  // Sort by priority
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  return recs;
}

// ─── View Prediction ───

function predictViews(
  videos: EnrichedVideo[],
  monthlyTrajectory: MonthlyBucket[],
  archetypePerformance: ArchetypePerformance[]
): ViewPrediction | null {
  if (videos.length < 5) return null;

  const views = videos.map((v) => v.views).sort((a, b) => a - b);
  const medianViews = views[Math.floor(views.length / 2)];

  // Growth rate from monthly trajectory
  let growthRate = 1.0;
  if (monthlyTrajectory.length >= 3) {
    const recent = monthlyTrajectory.slice(-2);
    const older = monthlyTrajectory.slice(0, -2);
    const recentAvg =
      recent.reduce((s, b) => s + b.avgViews, 0) / recent.length;
    const olderAvg =
      older.reduce((s, b) => s + b.avgViews, 0) / older.length;
    if (olderAvg > 0) {
      growthRate = parseFloat((recentAvg / olderAvg).toFixed(3));
    }
  }

  // Find comparable videos by looking at the top archetype
  const topArchetype = archetypePerformance[0];
  const comparableVideos: { title: string; views: number }[] = [];
  if (topArchetype) {
    const matching = videos
      .filter((v) => {
        const archs = detectArchetypes(v.title, v.tags);
        return archs.includes(topArchetype.archetypeId);
      })
      .sort((a, b) => b.views - a.views);
    for (const v of matching.slice(0, 5)) {
      comparableVideos.push({ title: v.title, views: v.views });
    }
  }

  // Prediction range
  // Low = P25 of recent views, adjusted by growth
  // Expected = median of recent views, adjusted by growth
  // High = average of top 3 comparable videos, adjusted by growth
  const recentVideos = [...videos]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    )
    .slice(0, Math.min(8, videos.length));

  const recentViews = recentVideos.map((v) => v.views).sort((a, b) => a - b);
  const p25 = recentViews[Math.floor(recentViews.length * 0.25)] || views[0];
  const recentMedian =
    recentViews[Math.floor(recentViews.length / 2)] || medianViews;

  const top3Avg =
    comparableVideos.length > 0
      ? Math.round(
          comparableVideos.slice(0, 3).reduce((s, v) => s + v.views, 0) /
            Math.min(3, comparableVideos.length)
        )
      : recentViews[recentViews.length - 1] || medianViews;

  const low = Math.round(p25 * growthRate);
  const expected = Math.round(recentMedian * growthRate);
  const high = Math.round(top3Avg * growthRate);

  // Confidence based on data quality
  let confidence: ConfidenceLevel = "likely";
  if (videos.length >= 20 && monthlyTrajectory.length >= 4) {
    confidence = "strong";
  } else if (videos.length >= 10) {
    confidence = "likely";
  } else {
    confidence = "unconfirmed";
  }

  // Build explanation
  const basisParts: string[] = [];
  basisParts.push(
    `Based on ${recentVideos.length} recent videos (median: ${recentMedian.toLocaleString()} views)`
  );
  if (growthRate !== 1.0) {
    const pct = Math.round((growthRate - 1) * 100);
    basisParts.push(
      `${pct > 0 ? "+" : ""}${pct}% monthly growth trend applied`
    );
  }
  if (comparableVideos.length > 0) {
    basisParts.push(
      `High range from top ${Math.min(3, comparableVideos.length)} comparable "${topArchetype?.label}" videos`
    );
  }

  return {
    low,
    expected,
    high,
    growthRate,
    confidence,
    basis: basisParts.join(". ") + ".",
    comparableVideos: comparableVideos.slice(0, 5),
  };
}

// ─── 6-Month View Projection ───

// Platform-specific cumulative view distribution over 6 months.
// YouTube LF has the longest tail (search/suggested). Short-form platforms
// spike in the first month then decay. X is nearly all first-week traffic.
const VIEW_CURVES: Record<Platform, number[]> = {
  youtube:       [0.55, 0.18, 0.10, 0.07, 0.05, 0.05],   // long tail from search
  youtube_short: [0.70, 0.14, 0.08, 0.04, 0.02, 0.02],   // Shorts feed spike
  tiktok:        [0.75, 0.12, 0.06, 0.03, 0.02, 0.02],   // FYP spike then decay
  instagram:     [0.72, 0.13, 0.07, 0.04, 0.02, 0.02],   // Reels feed spike
  facebook:      [0.72, 0.13, 0.07, 0.04, 0.02, 0.02],   // Reels/Feed spike (IG-shaped prior)
  x:             [0.92, 0.05, 0.02, 0.01, 0.00, 0.00],   // viral-day then dead
};

function computeSixMonthProjection(
  viewPrediction: ViewPrediction,
  engagementPattern: EngagementPattern,
  referenceEntries: ReferenceEntry[],
  platform: Platform = "youtube"
): MonthlyProjection[] {
  const curve = VIEW_CURVES[platform] || VIEW_CURVES.youtube;

  // Comment engagement boosts algorithm distribution
  const commentMultiplier =
    engagementPattern.commentsPerView > 0.03
      ? 1.15
      : engagementPattern.commentsPerView > 0.01
        ? 1.05
        : 1.0;

  // Niche ceiling from reference store: max views among similar videos
  const refViews = referenceEntries
    .filter((e) => e.type === "video" && e.metrics.views)
    .map((e) => e.metrics.views!);
  const nicheCeiling = refViews.length > 0 ? Math.max(...refViews) : Infinity;

  // Growth rate compounds monthly for growing channels
  const monthlyGrowth = viewPrediction.growthRate > 1 ? viewPrediction.growthRate : 1;

  const projections: MonthlyProjection[] = [];
  let avgCumulative = 0;
  let highCumulative = 0;

  for (let m = 0; m < 6; m++) {
    const monthGrowthFactor = Math.pow(monthlyGrowth, m);

    // Average trajectory: expected views × curve distribution × engagement boost × growth
    const avgIncrement =
      viewPrediction.expected * curve[m] * commentMultiplier * monthGrowthFactor;
    avgCumulative += avgIncrement;

    // High trajectory: high prediction × curve × engagement × growth, capped at niche ceiling
    const highIncrement =
      viewPrediction.high * curve[m] * commentMultiplier * monthGrowthFactor;
    highCumulative = Math.min(highCumulative + highIncrement, nicheCeiling);

    projections.push({
      month: m + 1,
      label: `Month ${m + 1}`,
      avgViews: Math.round(avgCumulative),
      highViews: Math.round(highCumulative),
      basis:
        m === 0
          ? `Initial ${platformInitialPushLabel(platform)} push`
          : m < 3
            ? `${platformMidPhaseTraffic(platform)} traffic`
            : "Long-tail organic discovery",
    });
  }

  return projections;
}

// ─── Main Export ───

export function computeDeepAnalysis(
  videos: EnrichedVideo[],
  channel: ChannelData | null,
  referenceEntries: ReferenceEntry[],
  platform: Platform = "youtube"
): DeepAnalysis {
  const monthlyTrajectory = computeMonthlyTrajectory(videos);
  const archetypePerformance = computeArchetypePerformance(videos);
  const titlePatterns = analyzeTitlePatterns(videos, platform);
  const medianViews = calculateMedian(videos.map((v) => v.views));
  const outlierInsights = generateOutlierInsights(videos, medianViews, platform);
  const engagementPattern = analyzeEngagementPatterns(videos);
  const recommendations = generateRecommendations(
    videos,
    channel,
    archetypePerformance,
    titlePatterns,
    outlierInsights,
    engagementPattern,
    monthlyTrajectory,
    referenceEntries,
    platform
  );
  const viewPrediction = predictViews(
    videos,
    monthlyTrajectory,
    archetypePerformance
  );

  // Attach 6-month projection if we have a view prediction
  if (viewPrediction) {
    viewPrediction.sixMonthProjection = computeSixMonthProjection(
      viewPrediction,
      engagementPattern,
      referenceEntries,
      platform
    );
  }

  return {
    monthlyTrajectory,
    archetypePerformance,
    titlePatterns,
    outlierInsights,
    engagementPattern,
    recommendations,
    viewPrediction,
  };
}
