/**
 * context-memory.ts
 * 
 * Builds dynamic, accumulating context for every AI prompt.
 * 
 * Three dimensions of context carried forward:
 *   1. CONTENT → CONTENT     — what we learned from previous videos analysed this session
 *   2. CREATOR → CREATOR     — patterns across creators in the same niche
 *   3. PLATFORM → PLATFORM   — algorithm behaviour, signals, and patterns per platform
 */

import type {
  EnrichedVideo,
  ChannelData,
  ReferenceStore,
  KeywordBank,
} from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { YT_SHORTS_MAX_SECONDS } from "@/lib/video-classifier";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoContext {
  title: string;
  channel: string;
  platform: string;
  views: number;
  velocity: number;
  engagement: number;
  vrsScore: number;
  vsBaseline: number;
  phase: string;
  analysedAt: string;
  keyLearnings: string[];   // AI-extracted insights from this video's analysis
}

export interface CreatorContext {
  channelName: string;
  platform: string;
  medianViews: number;
  avgVRS: number;
  avgEngagement: number;
  outlierCount: number;
  totalVideos: number;
  dominantArchetypes: string[];
  bestPerformingFormat: string;
  lastAnalysed: string;
}

export interface PlatformContext {
  platform: string;
  avgVRS: number;
  avgEngagement: number;
  avgVelocity: number;
  videoCount: number;
  topArchetypes: string[];
  outlierRate: number;
  trendDirection: "growing" | "stable" | "declining";
}

export interface SessionMemory {
  videos: VideoContext[];
  creators: Record<string, CreatorContext>;
  platforms: Record<string, PlatformContext>;
  lastUpdated: string;
  sessionId: string;
}

// ─── Platform algorithm knowledge ─────────────────────────────────────────────
// Distilled from algorithm-intel.ts for prompt injection

const PLATFORM_ALGORITHM_KNOWLEDGE: Record<string, string> = {
  youtube: `YouTube Algorithm (2025–2026):
- PRIMARY SIGNAL: Average View Duration (AVD) + Viewer Satisfaction surveys (Gemini-powered)
- CTR from impressions in first 24–48h determines initial distribution ceiling
- Retention curve shape: flat/rising = rewarded; steep early drop = penalised
- Non-subscriber satisfaction triggers recommendation broadening
- Comment depth (long comments, replies) > comment count
- Session contribution: videos leading to more YouTube watching get boosted
- Upload consistency matters but quality > frequency
- Shorts and long-form have separate recommendation tracks
- BEHAVIORAL PATTERN: 48h seed window → resonance test → expansion → viral ceiling`,

  youtube_short: `YouTube Shorts Algorithm (2025–2026):
- Completion rate is the #1 ranking signal (must be >70% to get pushed)
- First 1–2 seconds determine whether viewer swipes — hook is everything
- Likes/comments are weighted MORE than on long-form (harder to get on short content)
- Audio trends amplify reach significantly
- Cross-promotion to long-form channel increases overall channel health
- BEHAVIORAL PATTERN: Immediate loop potential → completion signal → viral stack`,

  tiktok: `TikTok FYP Algorithm (2025–2026):
- Completion rate + replay rate are the strongest signals
- Watch time relative to video length (not absolute seconds)
- Shares > likes > comments for distribution weight
- Early velocity (first 1h) determines whether content enters broader test pools
- Sound/audio original content gets additional distribution boost
- Hashtag relevance matters less than engagement quality
- Niche content often outperforms broad content due to higher completion rates
- BEHAVIORAL PATTERN: Small pool test → engagement filter → medium pool → FYP mass distribution`,

  instagram: `Instagram Reels Algorithm (2025–2026):
- Plays and Reach are primary distribution signals
- Saves are the highest-weight single engagement action (3x like)
- Comments signal active community — especially important for Reels
- Shares to Stories amplify reach significantly
- First 30 minutes of engagement determines Explore page eligibility
- Hashtag use has declining weight since 2024 — niche content > tags
- Profile visits after watching signal strong audience connection
- BEHAVIORAL PATTERN: Follower feed test → engagement rate filter → Explore/Reels tab push`,
};

// ─── Session memory store (in-memory, persisted to localStorage) ──────────────

const STORAGE_KEY = "fn_intel_session_memory";

function loadMemory(): SessionMemory {
  if (typeof window === "undefined") return createEmptyMemory();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return createEmptyMemory();
}

function saveMemory(memory: SessionMemory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {}
}

function createEmptyMemory(): SessionMemory {
  return {
    videos: [],
    creators: {},
    platforms: {},
    lastUpdated: new Date().toISOString(),
    sessionId: `session_${Date.now()}`,
  };
}

// ─── Update memory after an analysis ─────────────────────────────────────────

export function updateSessionMemory(
  video: EnrichedVideo,
  channel: ChannelData | null,
  platform: string,
  phase: string,
  aiInsights?: string   // optional text from previous AI analysis to extract learnings from
): void {
  const memory = loadMemory();
  const now = new Date().toISOString();

  // ── 1. Video context ──
  const videoCtx: VideoContext = {
    title:       video.title,
    channel:     video.channel,
    platform,
    views:       video.views,
    velocity:    video.velocity,
    engagement:  video.engagement,
    vrsScore:    video.vrs.estimatedFullScore,
    vsBaseline:  video.vsBaseline,
    phase,
    analysedAt:  now,
    keyLearnings: extractKeyLearnings(video, aiInsights),
  };

  // Keep last 10 videos analysed this session
  memory.videos = [videoCtx, ...memory.videos.filter(v => v.title !== video.title)].slice(0, 10);

  // ── 2. Creator context ──
  const existing = memory.creators[video.channel];
  const creatorCtx: CreatorContext = {
    channelName:          video.channel,
    platform,
    medianViews:          channel ? channel.subs : 0,
    avgVRS:               existing
      ? Math.round((existing.avgVRS + video.vrs.estimatedFullScore) / 2)
      : video.vrs.estimatedFullScore,
    avgEngagement:        existing
      ? parseFloat(((existing.avgEngagement + video.engagement) / 2).toFixed(2))
      : video.engagement,
    outlierCount:         (existing?.outlierCount ?? 0) + (video.isOutlier ? 1 : 0),
    totalVideos:          (existing?.totalVideos ?? 0) + 1,
    dominantArchetypes:   [], // populated from reference store
    bestPerformingFormat:
      video.durationSeconds <= (platform.startsWith("youtube") ? YT_SHORTS_MAX_SECONDS : 60)
        ? "Short-form"
        : "Long-form",
    lastAnalysed:         now,
  };
  memory.creators[video.channel] = creatorCtx;

  // ── 3. Platform context ──
  const existingPlatform = memory.platforms[platform];
  const platformCtx: PlatformContext = {
    platform,
    avgVRS: existingPlatform
      ? Math.round((existingPlatform.avgVRS * existingPlatform.videoCount + video.vrs.estimatedFullScore) / (existingPlatform.videoCount + 1))
      : video.vrs.estimatedFullScore,
    avgEngagement: existingPlatform
      ? parseFloat(((existingPlatform.avgEngagement * existingPlatform.videoCount + video.engagement) / (existingPlatform.videoCount + 1)).toFixed(2))
      : video.engagement,
    avgVelocity: existingPlatform
      ? Math.round((existingPlatform.avgVelocity * existingPlatform.videoCount + video.velocity) / (existingPlatform.videoCount + 1))
      : video.velocity,
    videoCount:   (existingPlatform?.videoCount ?? 0) + 1,
    topArchetypes: [],
    outlierRate: existingPlatform
      ? parseFloat(((existingPlatform.outlierRate * existingPlatform.videoCount + (video.isOutlier ? 100 : 0)) / (existingPlatform.videoCount + 1)).toFixed(1))
      : (video.isOutlier ? 100 : 0),
    trendDirection: "stable",
  };
  memory.platforms[platform] = platformCtx;

  memory.lastUpdated = now;
  saveMemory(memory);
}

// ─── Extract key learnings from a video ──────────────────────────────────────

function extractKeyLearnings(video: EnrichedVideo, aiInsights?: string): string[] {
  const learnings: string[] = [];

  if (video.isOutlier)
    learnings.push(`Outlier at ${video.vsBaseline}x channel median — ${video.vrs.estimatedFullScore} VRS`);

  if (video.engagement > 10)
    learnings.push(`Exceptional engagement ${video.engagement.toFixed(1)}% — strong comment signal`);
  else if (video.engagement > 5)
    learnings.push(`Above-average engagement ${video.engagement.toFixed(1)}%`);

  if (video.velocity > 10000)
    learnings.push(`High velocity at ${formatNumber(video.velocity)}/day — algorithmic push likely`);

  const titleLen = video.title.length;
  if (titleLen >= 40 && titleLen <= 70)
    learnings.push("Title length in optimal 40–70 char range");

  const commentRate = video.views > 0 ? (video.comments / video.views) * 1000 : 0;
  if (commentRate >= 2)
    learnings.push(`Strong comment density ${commentRate.toFixed(1)}/1K views`);

  // Extract first meaningful sentence from AI insights if provided
  if (aiInsights) {
    const firstSentence = aiInsights.split(".")[0]?.trim();
    if (firstSentence && firstSentence.length > 20 && firstSentence.length < 150)
      learnings.push(firstSentence);
  }

  return learnings.slice(0, 4);
}

// ─── Build the full dynamic context prompt ────────────────────────────────────

export interface ContextPromptInput {
  video: EnrichedVideo;
  channel: ChannelData | null;
  channelMedian: number;
  platform: string;
  phase: string;
  recentVideos: EnrichedVideo[];
  referenceStore?: ReferenceStore | null;
  keywordBank?: KeywordBank | null;
  persona?: string;
}

export function buildContextualPrompt(input: ContextPromptInput): string {
  const {
    video, channel, channelMedian, platform, phase,
    recentVideos, referenceStore, keywordBank, persona,
  } = input;

  const memory = loadMemory();
  const secs = video.durationSeconds ?? 0;
  const format = secs <= 60 ? "Short-form (≤60s)" : secs <= 600 ? "Mid-form (1–10 min)" : `Long-form (${Math.round(secs / 60)} min)`;
  const likeRate = video.views > 0 ? ((video.likes / video.views) * 100).toFixed(2) : "0";
  const commentRate = video.views > 0 ? ((video.comments / video.views) * 1000).toFixed(2) : "0";
  const eng = video.engagement.toFixed(2);

  // Pool stats
  const poolEntries = referenceStore?.entries ?? [];
  const poolPlatformEntries = poolEntries.filter(e =>
    platform === "youtube" || platform === "youtube_short"
      ? e.platform === "youtube"
      : e.platform === platform || e.platform === "tiktok"
  );
  const poolAvgVRS = poolPlatformEntries.length > 0
    ? Math.round(poolPlatformEntries.reduce((s, e) => s + (e.metrics?.vrsScore ?? 0), 0) / poolPlatformEntries.length)
    : 0;
  const poolMedianViews = poolEntries.length > 2
    ? [...poolEntries].sort((a, b) => (a.metrics?.views ?? 0) - (b.metrics?.views ?? 0))[Math.floor(poolEntries.length / 2)]?.metrics?.views ?? 0
    : 0;
  const poolComparison = poolMedianViews > 0
    ? `${Math.round(((video.views - poolMedianViews) / poolMedianViews) * 100)}% vs pool median of ${formatNumber(poolMedianViews)}`
    : null;

  const sections: string[] = [];

  // ── SECTION 1: Current video data ──
  sections.push(`═══ CURRENT VIDEO ═══
Title: "${video.title}"
Channel: ${video.channel}${channel ? ` | ${formatNumber(channel.subs)} subscribers` : ""}
Platform: ${platform.toUpperCase()} | Format: ${format}
Published: ${new Date(video.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} | Day ${video.days} since publish

PERFORMANCE:
  Views:       ${formatNumber(video.views)}
  Velocity:    ${formatNumber(video.velocity)} views/day
  Likes:       ${formatNumber(video.likes)} (${likeRate}% like rate)
  Comments:    ${formatNumber(video.comments)} (${commentRate}/1K views)
  Engagement:  ${eng}%
  vs Median:   ${video.vsBaseline}x (channel median: ${formatNumber(channelMedian)})
  VRS Score:   ${video.vrs.estimatedFullScore}/100
  Phase:       ${phase}
  Outlier:     ${video.isOutlier ? `YES — ${video.vsBaseline}x above channel median` : "No"}
${poolComparison ? `  vs Pool:     ${poolComparison} (${poolEntries.length} videos tracked)` : ""}`);

  // ── SECTION 2: Creator history from session memory ──
  const creatorHistory = memory.creators[video.channel];
  const sameCreatorVideos = memory.videos.filter(
    v => v.channel === video.channel && v.title !== video.title
  );

  if (sameCreatorVideos.length > 0 || creatorHistory) {
    let creatorSection = `\n═══ CREATOR CONTEXT — ${video.channel} ═══`;
    if (creatorHistory) {
      creatorSection += `\n  Analyses this session: ${creatorHistory.totalVideos}`;
      creatorSection += `\n  Avg VRS across their videos: ${creatorHistory.avgVRS}/100`;
      creatorSection += `\n  Avg engagement rate: ${creatorHistory.avgEngagement}%`;
      creatorSection += `\n  Outlier count this session: ${creatorHistory.outlierCount}`;
    }
    if (sameCreatorVideos.length > 0) {
      creatorSection += `\n\n  Previous videos from this creator analysed this session:`;
      sameCreatorVideos.slice(0, 3).forEach(v => {
        creatorSection += `\n  • "${v.title.slice(0, 55)}"`;
        creatorSection += `\n    Views: ${formatNumber(v.views)} | VRS: ${v.vrsScore}/100 | Phase: ${v.phase}`;
        if (v.keyLearnings.length > 0) {
          creatorSection += `\n    Key finding: ${v.keyLearnings[0]}`;
        }
      });
    }

    // Pool-based creator patterns
    const poolCreatorEntries = poolEntries.filter(e => e.channelName === video.channel);
    if (poolCreatorEntries.length > 0) {
      const poolCreatorViews = poolCreatorEntries.map(e => e.metrics?.views ?? 0);
      const poolCreatorMedian = poolCreatorViews.sort((a, b) => a - b)[Math.floor(poolCreatorViews.length / 2)];
      const poolCreatorAvgVRS = Math.round(poolCreatorEntries.reduce((s, e) => s + (e.metrics?.vrsScore ?? 0), 0) / poolCreatorEntries.length);
      creatorSection += `\n\n  From reference pool (${poolCreatorEntries.length} videos tracked):`;
      creatorSection += `\n    Pool median views: ${formatNumber(poolCreatorMedian)}`;
      creatorSection += `\n    Pool avg VRS: ${poolCreatorAvgVRS}/100`;
    }
    sections.push(creatorSection);
  }

  // ── SECTION 3: Cross-content learnings from other recent analyses ──
  const otherVideos = memory.videos.filter(
    v => v.channel !== video.channel && v.platform === platform
  );
  const crossPlatformVideos = memory.videos.filter(
    v => v.platform !== platform
  );

  if (otherVideos.length > 0) {
    let contentSection = `\n═══ CONTENT → CONTENT CONTEXT (Same Platform, Other Creators) ═══`;
    contentSection += `\n  Patterns observed from ${otherVideos.length} other ${platform.toUpperCase()} videos this session:\n`;
    otherVideos.slice(0, 4).forEach(v => {
      contentSection += `\n  • ${v.channel}: "${v.title.slice(0, 45)}"`;
      contentSection += `\n    VRS: ${v.vrsScore} | ${formatNumber(v.views)} views | ${v.phase}`;
      if (v.keyLearnings[0]) contentSection += ` | ${v.keyLearnings[0]}`;
    });

    // Cross-content patterns
    const avgSessionVRS = otherVideos.reduce((s, v) => s + v.vrsScore, 0) / otherVideos.length;
    const outlierVideos = otherVideos.filter(v => v.phase.includes("VIRAL") || v.phase.includes("EXPANSION"));
    if (outlierVideos.length > 0) {
      contentSection += `\n\n  ⚡ ${outlierVideos.length} high-performing content pieces analysed this session:`;
      outlierVideos.slice(0, 2).forEach(v => {
        contentSection += `\n    "${v.title.slice(0, 50)}" — ${v.phase}`;
      });
    }
    contentSection += `\n\n  Session avg VRS on ${platform}: ${avgSessionVRS.toFixed(0)}/100`;
    sections.push(contentSection);
  }

  if (crossPlatformVideos.length > 0) {
    let crossSection = `\n═══ CROSS-PLATFORM PATTERNS ═══`;
    const byPlatform: Record<string, typeof crossPlatformVideos> = {};
    crossPlatformVideos.forEach(v => {
      byPlatform[v.platform] = [...(byPlatform[v.platform] ?? []), v];
    });
    Object.entries(byPlatform).forEach(([plt, vids]) => {
      const avgVRS = Math.round(vids.reduce((s, v) => s + v.vrsScore, 0) / vids.length);
      const avgEng = (vids.reduce((s, v) => s + v.engagement, 0) / vids.length).toFixed(2);
      crossSection += `\n  ${plt.toUpperCase()}: ${vids.length} videos | Avg VRS: ${avgVRS} | Avg engagement: ${avgEng}%`;
    });
    sections.push(crossSection);
  }

  // ── SECTION 4: Platform algorithm intelligence ──
  const algoKnowledge = PLATFORM_ALGORITHM_KNOWLEDGE[platform] ?? PLATFORM_ALGORITHM_KNOWLEDGE["youtube"];
  const sessionPlatformCtx = memory.platforms[platform];

  let platformSection = `\n═══ PLATFORM ALGORITHM INTELLIGENCE — ${platform.toUpperCase()} ═══\n${algoKnowledge}`;

  if (sessionPlatformCtx && sessionPlatformCtx.videoCount > 1) {
    platformSection += `\n\nSESSION DATA FOR THIS PLATFORM (${sessionPlatformCtx.videoCount} videos analysed):`;
    platformSection += `\n  Session avg VRS: ${sessionPlatformCtx.avgVRS}/100`;
    platformSection += `\n  Session avg engagement: ${sessionPlatformCtx.avgEngagement}%`;
    platformSection += `\n  Session avg velocity: ${formatNumber(sessionPlatformCtx.avgVelocity)}/day`;
    platformSection += `\n  Outlier rate this session: ${sessionPlatformCtx.outlierRate.toFixed(0)}%`;
  }

  if (poolPlatformEntries.length >= 5) {
    platformSection += `\n\nREFERENCE POOL BENCHMARKS (${poolPlatformEntries.length} videos):`;
    platformSection += `\n  Pool avg VRS: ${poolAvgVRS}/100`;
    platformSection += `\n  Pool median views: ${formatNumber(poolMedianViews)}`;
    const outlierPoolCount = poolPlatformEntries.filter(e => (e.metrics?.vrsScore ?? 0) >= 75).length;
    platformSection += `\n  High-VRS content (≥75): ${outlierPoolCount} videos (${Math.round(outlierPoolCount / poolPlatformEntries.length * 100)}%)`;
  }

  sections.push(platformSection);

  // ── SECTION 5: Niche & keyword intelligence ──
  if (keywordBank) {
    const topNiche = keywordBank.categories.niche.slice(0, 15).join(", ");
    const topCompetitors = keywordBank.categories.competitors.slice(0, 8).join(", ");
    sections.push(`\n═══ NICHE INTELLIGENCE ═══
  Tracked keywords: ${keywordBank.categories.niche.length}
  Top niche terms: ${topNiche}
  Tracked competitors: ${topCompetitors}
  Content types: ${keywordBank.categories.contentType.slice(0, 8).join(", ")}`);
  }

  // ── SECTION 6: Recent channel context ──
  if (recentVideos.length > 0) {
    const recentSection = `\n═══ CHANNEL RECENT VIDEOS (${video.channel}) ═══
  ${recentVideos.slice(0, 5).map(v =>
    `• "${v.title.slice(0, 50)}" — ${formatNumber(v.views)} views | VRS: ${v.vrs.estimatedFullScore} | ${v.engagement.toFixed(1)}% eng`
  ).join("\n  ")}`;
    sections.push(recentSection);
  }

  // ── TASK ──
  const personaTasks: Record<string, string> = {
    algorithm:    "Analyse the DISTRIBUTION SIGNALS for this content. Use the platform algorithm knowledge above. Be specific about what signals are working or failing.",
    strategist:   "Analyse the CONTENT QUALITY SIGNALS — hook, title, format, structure. Compare against what's worked across the session. Contradict the algorithm view where warranted.",
    psychologist: "Analyse AUDIENCE BEHAVIOUR from comment rate, engagement pattern, and what the metrics reveal about emotional response. Use cross-content context to identify patterns.",
    competitor:   "Benchmark this content AGAINST CREATORS AND CONTENT in the reference pool and session history. Where is it winning and losing?",
    verdict:      "Synthesise all context above into a DECISIVE VERDICT. Name the key tension, resolve it, and give a specific directional recommendation.",
    default:      "Write a plain-English performance verdict in 3 paragraphs. Use ALL context above — creator history, platform patterns, cross-content learnings, and algorithm knowledge. Be specific.",
  };

  const task = personaTasks[persona ?? "default"] ?? personaTasks.default;
  sections.push(`\n═══ YOUR TASK ═══\n${task}`);

  return sections.join("\n");
}

/** Get current session memory summary for display */
export function getSessionSummary(): {
  videosAnalysed: number;
  creatorsTracked: number;
  platformsCovered: string[];
  sessionStart: string;
} {
  const memory = loadMemory();
  return {
    videosAnalysed:   memory.videos.length,
    creatorsTracked:  Object.keys(memory.creators).length,
    platformsCovered: Object.keys(memory.platforms),
    sessionStart:     memory.sessionId.replace("session_", ""),
  };
}

/** Clear session memory */
export function clearSessionMemory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
