// ─── Mode Types ───

export type ModeId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export interface Mode {
  id: ModeId;
  label: string;
  icon: string;
  desc: string;
  color: string;
}

// ─── Video Data Types ───

export interface ChannelContext {
  subs: number;
  videoCount: number;
  uploadFrequency: number; // avg days between uploads
  recentVideoTitles: string[];
  channelAgeDays: number;
}

export interface VideoData {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  tags: string[];
  description: string;
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram";
  shares?: number;
  saves?: number;
  channelContext?: ChannelContext;
}

export interface TikTokVideoData extends VideoData {
  platform: "tiktok";
  shares: number;
  saves: number;
  hashtags: string[];
  soundName: string;
  soundOriginal: boolean;
  creatorHandle: string;
  creatorFollowers: number;
}

export interface ChannelData {
  id: string;
  name: string;
  subs: number;
  totalViews: number;
  videoCount: number;
  uploads: string | null;
  avatar: string;
}

// ─── Enriched Types (after processing) ───

export interface EnrichedVideo extends VideoData {
  days: number;
  velocity: number;
  engagement: number;
  vrs: VRSResult;
  isOutlier: boolean;
  vsBaseline: number;
}

export interface ChannelHealth {
  channel: ChannelData;
  videos: EnrichedVideo[];
  medianViews: number;
  medianVelocity: number;
  medianEngagement: number;
  outliers: EnrichedVideo[];
  outlierRate: number;
  uploadFrequency: number; // avg days between uploads
  trend: "growing" | "stable" | "declining";
}

// ─── VRS Types ───

export type VRSTier = 1 | 2 | 3 | 4;

export type CriterionStatus = "pass" | "partial" | "fail" | "hidden";

export interface VRSCriterion {
  id: string;
  label: string;
  weight: number;
  tier: VRSTier;
  autoAssessable: boolean;
  check: (data: VideoData) => number | null; // 1=pass, 0.5=partial, 0=fail, null=hidden
  rationale: (data: VideoData, score: number | null) => string;
}

export interface VRSCriterionResult {
  id: string;
  label: string;
  weight: number;
  tier: VRSTier;
  status: CriterionStatus;
  points: number;
  maxPoints: number;
  rationale: string;
}

export interface VRSTierSummary {
  tier: VRSTier;
  label: string;
  earned: number;
  possible: number;
  assessed: number;
  total: number;
}

export interface VRSResult {
  score: number; // 0-100 (assessed criteria only)
  estimatedFullScore: number; // projected score if all criteria were assessed
  earned: number;
  possible: number; // only assessed weight
  totalWeight: number; // all 100 points
  estimatedHiddenScore: number; // projected hidden criteria contribution
  tierSummaries: VRSTierSummary[];
  criteria: VRSCriterionResult[];
  gaps: VRSCriterionResult[]; // fail/partial sorted by weight desc
  topFixes: VRSCriterionResult[]; // top 3 gaps
  hiddenCount: number;
}

// ─── Viral Archetype Types ───

export type ArchetypeId =
  | "challenge"
  | "educational"
  | "controversy"
  | "data-proof"
  | "emotional"
  | "reaction"
  | "trend-riding"
  | "comparison"
  | "myth-busting"
  | "behind-scenes"
  | "list-ranking"
  | "utility";

export interface Archetype {
  id: ArchetypeId;
  label: string;
  description: string;
  example: string;
}

// ─── Confidence Types ───

export type ConfidenceLevel =
  | "confirmed"
  | "strong"
  | "likely"
  | "unconfirmed";

// ─── Baseline Types ───

export interface BaselineData {
  medianViews: number;
  meanViews: number;
  medianVelocity: number;
  outlierThreshold: number;
  avgEngagement: number;
  totalVideos: number;
  uniqueCreators: number;
  maxViews: number;
}

export interface CompetitorEntry {
  name: string;
  space: string;
  handles: {
    youtube?: string;
    tiktok?: string;
    instagram?: string;
    x?: string;
    linkedin?: string;
  };
}

// ─── Platform Algorithm Intelligence Types ───

export type PlatformId =
  | "youtube"
  | "youtube-shorts"
  | "tiktok"
  | "instagram"
  | "x"
  | "linkedin";

export interface PlatformSignal {
  name: string;
  weight: "highest" | "strong" | "moderate" | "low";
  description: string;
  confidence: ConfidenceLevel;
}

export interface PlatformInsight {
  id: PlatformId;
  name: string;
  icon: string;
  signals: PlatformSignal[];
  keyBehaviors: string[];
  optimalFormats: string[];
  antiPatterns: string[];
  lastUpdated: string;
}

// ─── Deep Analysis Types ───

export interface MonthlyBucket {
  month: string; // "2025-01"
  label: string; // "Jan 2025"
  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgVelocity: number;
  avgEngagement: number;
}

export interface ArchetypePerformance {
  archetypeId: ArchetypeId;
  label: string;
  videoCount: number;
  avgViews: number;
  avgEngagement: number;
  avgVRS: number;
  outlierCount: number;
  bestVideo: { title: string; views: number } | null;
}

export interface TitlePattern {
  pattern: string;
  matchCount: number;
  avgViews: number;
  avgEngagement: number;
  examples: string[];
}

export interface OutlierInsight {
  video: EnrichedVideo;
  reasons: string[];
  archetypes: ArchetypeId[];
  titlePatterns: string[];
  timingNote: string;
}

export interface EngagementPattern {
  likesPerView: number;
  commentsPerView: number;
  sharesPerView?: number;
  savesPerView?: number;
  highEngagementThreshold: number;
  lowEngagementThreshold: number;
  trend: "improving" | "stable" | "declining";
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: string;
  text: string;
  platformContext?: PlatformId[];
  evidence: string;
}

export interface MonthlyProjection {
  month: number; // 1-6
  label: string; // "Month 1", "Month 2"...
  avgViews: number; // average trajectory cumulative views
  highViews: number; // highest possible trajectory cumulative views
  basis: string;
}

export interface ViewPrediction {
  low: number;
  expected: number;
  high: number;
  growthRate: number; // monthly growth multiplier
  confidence: ConfidenceLevel;
  basis: string; // explanation of how prediction was calculated
  comparableVideos: { title: string; views: number }[];
  sixMonthProjection?: MonthlyProjection[];
}

export interface DeepAnalysis {
  monthlyTrajectory: MonthlyBucket[];
  archetypePerformance: ArchetypePerformance[];
  titlePatterns: TitlePattern[];
  outlierInsights: OutlierInsight[];
  engagementPattern: EngagementPattern;
  recommendations: Recommendation[];
  viewPrediction: ViewPrediction | null;
}

// ─── Reference Store Types ───

export type VideoFormat = "short" | "full";
export type VideoOrientation = "vertical" | "horizontal" | "unknown";
export type SentimentLabel = "positive" | "neutral" | "negative";

export interface ReferenceEntry {
  id: string;
  type: "channel" | "video";
  platform?: "youtube" | "youtube_short" | "tiktok" | "instagram";
  name: string;
  channelId: string;
  channelName: string;
  analyzedAt: string;
  metrics: {
    views?: number;
    subs?: number;
    medianViews?: number;
    velocity?: number;
    engagement?: number;
    vrsScore?: number;
    outlierRate?: number;
    trend?: "growing" | "stable" | "declining";
    uploadFrequency?: number;
    videoCount?: number;
    shares?: number;
    saves?: number;
  };
  archetypes?: ArchetypeId[];
  tags?: string[];
  // Video classification fields
  durationSeconds?: number;
  duration?: string; // formatted e.g. "1:23"
  videoFormat?: VideoFormat; // "short" or "full"
  orientation?: VideoOrientation; // "vertical", "horizontal", or "unknown"
  // Sentiment
  sentiment?: SentimentLabel;
  sentimentScore?: number; // -1 to 1
  description?: string; // stored for sentiment analysis
}

export interface ReferenceStore {
  version: 1;
  lastUpdated: string;
  entries: ReferenceEntry[];
}

// ─── Blocklist Types ───

export interface Blocklist {
  version: 1;
  lastUpdated: string;
  channels: string[]; // YouTube channelIds (or @handle for tiktok/instagram)
  creators: string[]; // lowercase creator/channel display names
}

// ─── Analysis Result Types ───

export type ResultType = "video" | "channel";

export interface VideoAnalysis {
  type: "video";
  video: EnrichedVideo;
  channel: ChannelData | null;
  channelMedian: number;
  recentVideos: EnrichedVideo[];
  deepAnalysis: DeepAnalysis | null;
  referenceContext: ReferenceEntry[];
}

export interface ChannelAnalysis {
  type: "channel";
  health: ChannelHealth;
  deepAnalysis: DeepAnalysis | null;
  referenceContext: ReferenceEntry[];
}

export interface TikTokBatchAnalysis {
  type: "tiktok-batch";
  videos: EnrichedVideo[];
  deepAnalysis: DeepAnalysis;
  topPerformers: EnrichedVideo[];
  competitorBreakdown: {
    handle: string;
    videoCount: number;
    avgViews: number;
    avgScore: number;
  }[];
  referenceContext: ReferenceEntry[];
}

export type AnalysisResult = VideoAnalysis | ChannelAnalysis | TikTokBatchAnalysis;

// ─── Input Detection ───

export type InputType =
  | "youtube-video"
  | "youtube-channel"
  | "youtube-short"
  | "tiktok"
  | "instagram"
  | "x"
  | "linkedin"
  | "unknown";

export interface ParsedInput {
  type: InputType;
  id: string | null;
  handle: string | null;
  url: string;
  label: string;
}

// ─── Keyword Bank Types ───

export interface KeywordBank {
  version: number;
  lastUpdated: string;
  categories: {
    niche: string[];
    competitors: string[];
    contentType: string[];
    language: string[];
  };
}

// ─── Language Detection ───

export type DetectedLanguage = "en" | "es" | "ar" | "pt" | "fr" | "de" | "hi" | "id" | "tr" | "other";

export interface LanguageCPA {
  language: DetectedLanguage;
  label: string;
  videoCount: number;
  avgViews: number;
  avgEngagement: number;
  avgVRS: number;
  topVideo: { title: string; views: number } | null;
}

// ─── Adjacent Video Context ───

export interface AdjacentVideoContext {
  before: EnrichedVideo | null;
  after: EnrichedVideo | null;
  lagBefore: number | null; // days between before video and target
  lagAfter: number | null; // days between target and after video
}

// ─── Niche Ranking ───

// ─── Publish Time Optimization ───

export interface PublishTimeHeatmap {
  dayHourGrid: number[][]; // 7 days × 24 hours, values = avg views
  bestSlots: { day: number; hour: number; avgViews: number; videoCount: number }[];
  worstSlots: { day: number; hour: number; avgViews: number; videoCount: number }[];
  totalVideosAnalyzed: number;
  dayLabels: string[];
}

// ─── Title A/B Scoring ───

export interface TitleVariant {
  title: string;
  score: number; // 0-100
  breakdown: {
    hookStrength: number;
    curiosityGap: number;
    numberPresence: number;
    lengthOptimal: number;
    keywordDensity: number;
    emotionalPull: number;
    clarityScore: number;
  };
  feedback: string[];
}

// ─── Description SEO Analysis ───

export interface DescriptionSEO {
  overallScore: number; // 0-100
  keywordDensity: { keyword: string; count: number; density: number }[];
  hasTimestamps: boolean;
  hasLinks: boolean;
  hasCTA: boolean;
  hasHashtags: boolean;
  aboveFoldHook: string; // first 2 lines
  aboveFoldScore: number;
  wordCount: number;
  issues: string[];
  suggestions: string[];
}

// ─── Engagement Decay Curve ───

export type ContentPhase = "growth" | "plateau" | "decay" | "evergreen";

export interface EngagementDecay {
  currentPhase: ContentPhase;
  dailyVelocity: number;
  weeklyVelocity: number;
  estimatedLifetimeViews: number;
  decayRate: number; // 0-1, higher = faster decay
  isEvergreen: boolean;
  phaseLabel: string;
  phaseBasis: string;
}

// ─── Competitor Gap Matrix ───

export interface CompetitorGap {
  competitorName: string;
  totalVideos: number;
  avgViews: number;
  avgVRS: number;
  contentTypes: { type: string; count: number; avgViews: number }[];
  uniqueFormats: string[]; // formats this competitor uses that target doesn't
  strengthAreas: string[];
  weaknessAreas: string[];
}

export interface CompetitorGapMatrix {
  targetChannel: string;
  competitors: CompetitorGap[];
  missingFormats: string[]; // formats competitors use that target never does
  targetStrengths: string[];
  opportunities: string[];
}

// ─── Tag Performance Correlation ───

export interface TagPerformance {
  tag: string;
  videoCount: number;
  avgViews: number;
  medianViews: number;
  outlierRate: number; // % of videos with this tag that are outliers
  avgVRS: number;
  correlation: number; // -1 to 1, correlation with high views
}

export interface TagCorrelationResult {
  topTags: TagPerformance[];
  bottomTags: TagPerformance[];
  outlierTags: TagPerformance[]; // tags that appear disproportionately in outliers
  totalTagsAnalyzed: number;
  totalVideosAnalyzed: number;
}

// ─── Thumbnail Metadata Analysis ───

export interface ThumbnailAnalysis {
  hasCustomThumbnail: boolean;
  resolutions: { label: string; width: number; height: number; url: string }[];
  aspectRatioCorrect: boolean;
  maxResolution: string;
  issues: string[];
  score: number; // 0-100
}

// ─── Cross-Promotion Detection ───

export interface CrossPromotion {
  videoLinks: number; // links to other videos
  playlistLinks: number;
  socialLinks: { platform: string; url: string }[];
  endScreenLikely: boolean; // description mentions "watch next" etc
  pinnedCommentCTA: boolean;
  cardLinks: number;
  ecosystemScore: number; // 0-100
  suggestions: string[];
}

// ─── Upload Cadence ───

export interface UploadCadenceEntry {
  channelName: string;
  avgDaysBetweenUploads: number;
  consistency: number; // 0-1, lower stddev = higher consistency
  totalUploads: number;
  avgViews: number;
  cadenceLabel: string; // "Daily", "2-3x/week", "Weekly", etc.
}

export interface UploadCadenceResult {
  entries: UploadCadenceEntry[];
  bestCadence: string;
  bestCadenceAvgViews: number;
  correlation: number; // correlation between consistency and views
}

// ─── Hook Pattern Library ───

export interface HookPattern {
  pattern: string; // e.g., "Number Hook", "Question Hook"
  examples: string[];
  videoCount: number;
  avgViews: number;
  avgEngagement: number;
  outlierRate: number;
  templates: string[]; // reusable templates derived from examples
}

export interface HookPatternLibrary {
  patterns: HookPattern[];
  totalVideosAnalyzed: number;
  bestPattern: string;
  worstPattern: string;
}

// ─── Niche Ranking ───

export interface NicheRanking {
  videoTitle: string;
  videoViews: number;
  videoVRS: number;
  totalNicheVideos: number;
  rankByViews: number;
  rankByVRS: number;
  rankByEngagement: number;
  percentileViews: number; // 0-100, higher = better
  percentileVRS: number;
  languageRankings: {
    language: DetectedLanguage;
    label: string;
    rank: number;
    total: number;
  }[];
  creatorRankings: {
    channelName: string;
    avgViews: number;
    avgVRS: number;
    videoCount: number;
    rank: number;
  }[];
}
