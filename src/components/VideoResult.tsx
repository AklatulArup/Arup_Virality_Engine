"use client";

import Image from "next/image";
import type {
  EnrichedVideo,
  ChannelData,
  ModeId,
  DeepAnalysis,
  ReferenceEntry,
  AdjacentVideoContext,
  NicheRanking,
  LanguageCPA,
  DescriptionSEO,
  EngagementDecay,
  ThumbnailAnalysis,
  CrossPromotion,
  KeywordBank,
  PublishTimeHeatmap,
  CompetitorGapMatrix,
  TagCorrelationResult,
  UploadCadenceResult,
  HookPatternLibrary,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatters";
import { detectArchetypes, getArchetype } from "@/lib/archetypes";
import MetricCard from "./MetricCard";
import ClaudePrompt from "./ClaudePrompt";
import DeepAnalysisPanel from "./DeepAnalysisPanel";
import CollapsibleSection from "./CollapsibleSection";
import AlgorithmIntelPanel from "./AlgorithmIntelPanel";
import AdjacentVideos from "./AdjacentVideos";
import NicheRankingPanel from "./NicheRankingPanel";
import LanguageCPAPanel from "./LanguageCPAPanel";
import TitleScoringPanel from "./TitleScoringPanel";
import DescriptionSEOPanel from "./DescriptionSEOPanel";
import EngagementDecayPanel from "./EngagementDecayPanel";
import ThumbnailPanel from "./ThumbnailPanel";
import CrossPromotionPanel from "./CrossPromotionPanel";
import PublishTimePanel from "./PublishTimePanel";
import CompetitorGapPanel from "./CompetitorGapPanel";
import TagCorrelationPanel from "./TagCorrelationPanel";
import UploadCadencePanel from "./UploadCadencePanel";
import HookPatternPanel from "./HookPatternPanel";
import SentimentPanel from "./SentimentPanel";
import type { TitleSentimentAnalysis } from "@/lib/sentiment";

interface VideoResultProps {
  video: EnrichedVideo;
  channel: ChannelData | null;
  channelMedian: number;
  recentVideos: EnrichedVideo[];
  activeModes: ModeId[];
  url: string;
  deepAnalysis?: DeepAnalysis | null;
  referenceContext?: ReferenceEntry[];
  adjacentVideos?: AdjacentVideoContext | null;
  nicheRanking?: NicheRanking | null;
  languageCPA?: LanguageCPA[] | null;
  referenceCount?: number;
  descriptionSEO?: DescriptionSEO | null;
  engagementDecay?: EngagementDecay | null;
  thumbnailAnalysis?: ThumbnailAnalysis | null;
  crossPromotion?: CrossPromotion | null;
  keywordBank?: KeywordBank | null;
  publishTimeHeatmap?: PublishTimeHeatmap | null;
  competitorGap?: CompetitorGapMatrix | null;
  tagCorrelation?: TagCorrelationResult | null;
  uploadCadence?: UploadCadenceResult | null;
  hookPatterns?: HookPatternLibrary | null;
  sentimentAnalysis?: TitleSentimentAnalysis | null;
}

export default function VideoResult({
  video,
  channel,
  channelMedian,
  recentVideos,
  activeModes,
  url,
  deepAnalysis,
  referenceContext,
  adjacentVideos,
  nicheRanking,
  languageCPA,
  referenceCount = 0,
  descriptionSEO,
  engagementDecay,
  thumbnailAnalysis,
  crossPromotion,
  keywordBank,
  publishTimeHeatmap,
  competitorGap,
  tagCorrelation,
  uploadCadence,
  hookPatterns,
  sentimentAnalysis,
}: VideoResultProps) {
  const archetypes = detectArchetypes(video.title, video.tags);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Video header card */}
      <div className="bg-surface border border-border rounded-[10px] p-3.5 flex gap-3.5">
        {video.thumbnail && (
          <Image
            src={video.thumbnail}
            alt={video.title}
            width={320}
            height={180}
            className="rounded-md object-cover shrink-0"
            style={{ width: 180, height: "auto" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold mb-1 leading-snug">
            {video.title}
          </h2>
          <div className="text-[11px] text-muted mb-2">
            {video.channel} &middot; {formatDate(video.publishedAt)} &middot;{" "}
            {video.duration}
          </div>

          <div className="flex gap-2 flex-wrap">
            <MetricCard label="Views" value={formatNumber(video.views)} />
            <MetricCard
              label="Likes"
              value={formatNumber(video.likes)}
              color="var(--color-accent)"
            />
            <MetricCard
              label="Comments"
              value={formatNumber(video.comments)}
              color="var(--color-accent-blue)"
            />
            <MetricCard
              label="Velocity"
              value={`${formatNumber(video.velocity)}/d`}
              color="var(--color-mode-c)"
            />
            <MetricCard
              label="Engage"
              value={`${video.engagement.toFixed(1)}%`}
              color="var(--color-mode-e)"
            />
            <MetricCard
              label="vs Base"
              value={`${video.vsBaseline}x`}
              color={
                video.vsBaseline >= 3
                  ? "var(--color-vrs-excellent)"
                  : video.vsBaseline >= 1
                    ? "var(--color-vrs-competitive)"
                    : "var(--color-vrs-rework)"
              }
            />
          </div>

          {video.isOutlier && (
            <div
              className="mt-2 text-[10px] font-mono inline-block px-2 py-0.5 rounded"
              style={{
                color: "var(--color-vrs-excellent)",
                background: "rgba(0,229,160,0.06)",
              }}
            >
              &#x1F525; OUTLIER &mdash; {video.vsBaseline}x channel median
            </div>
          )}

          {/* Archetype badges */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {archetypes.map((id) => {
              const arch = getArchetype(id);
              if (!arch) return null;
              return (
                <span
                  key={id}
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-border text-subtle"
                >
                  {arch.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Adjacent Videos (before + after with lag) */}
      {adjacentVideos && (adjacentVideos.before || adjacentVideos.after) && (
        <AdjacentVideos
          context={adjacentVideos}
          currentTitle={video.title}
          currentViews={video.views}
          currentVRS={video.vrs.estimatedFullScore}
        />
      )}

      {/* Niche Competitive Ranking */}
      {nicheRanking && <NicheRankingPanel ranking={nicheRanking} />}

      {/* Language CPA */}
      {languageCPA && languageCPA.length > 1 && (
        <LanguageCPAPanel
          data={languageCPA}
          totalVideos={recentVideos.length}
        />
      )}

      {/* Channel context */}
      {channel && (
        <div className="bg-surface border border-border rounded-[10px] p-3.5">
          <div className="flex items-center gap-2.5 mb-2.5">
            {channel.avatar && (
              <Image
                src={channel.avatar}
                alt={channel.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <div>
              <div className="text-[13px] font-semibold">{channel.name}</div>
              <div className="text-[10px] text-muted">
                {formatNumber(channel.subs)} subs &middot;{" "}
                {channel.videoCount} videos &middot; median{" "}
                {formatNumber(channelMedian)}
              </div>
            </div>
          </div>
          {recentVideos.length > 0 &&
            recentVideos.slice(0, 6).map((rv) => (
              <div
                key={rv.id}
                className="flex justify-between py-0.5 border-b"
                style={{ borderColor: "rgba(255,255,255,0.02)" }}
              >
                <span className="text-[10px] text-subtle flex-1 truncate mr-2">
                  {rv.title}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[10px] font-mono"
                    style={{
                      color:
                        rv.views >= channelMedian * 3
                          ? "var(--color-vrs-excellent)"
                          : "#fff",
                    }}
                  >
                    {formatNumber(rv.views)}
                  </span>
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Deep Analysis */}
      {deepAnalysis && (
        <DeepAnalysisPanel
          analysis={deepAnalysis}
          channelName={channel?.name || video.channel}
        />
      )}

      {/* Algorithm Intelligence */}
      <CollapsibleSection
        title="Platform Algorithm Intelligence"
        subtitle="Current algorithm signals across 6 platforms — what drives distribution"
        accentColor="var(--color-mode-a)"
      >
        <AlgorithmIntelPanel highlightPlatform="youtube" />
      </CollapsibleSection>

      {/* ── Video-Level Analysis Panels ── */}

      {/* Title A/B Scoring */}
      {keywordBank && (
        <TitleScoringPanel currentTitle={video.title} bank={keywordBank} />
      )}

      {/* Description SEO */}
      {descriptionSEO && <DescriptionSEOPanel seo={descriptionSEO} />}

      {/* Engagement Decay / Content Lifecycle */}
      {engagementDecay && (
        <EngagementDecayPanel decay={engagementDecay} currentViews={video.views} />
      )}

      {/* Thumbnail Metadata */}
      {thumbnailAnalysis && <ThumbnailPanel analysis={thumbnailAnalysis} />}

      {/* Cross-Promotion */}
      {crossPromotion && <CrossPromotionPanel promo={crossPromotion} />}

      {/* ── Reference Pool Aggregate Panels ── */}

      {/* Publish Time Heatmap */}
      {publishTimeHeatmap && publishTimeHeatmap.totalVideosAnalyzed >= 3 && (
        <PublishTimePanel heatmap={publishTimeHeatmap} />
      )}

      {/* Competitor Gap */}
      {competitorGap && competitorGap.competitors.length > 0 && (
        <CompetitorGapPanel matrix={competitorGap} />
      )}

      {/* Tag Correlation */}
      {tagCorrelation && tagCorrelation.topTags.length > 0 && (
        <TagCorrelationPanel result={tagCorrelation} />
      )}

      {/* Upload Cadence */}
      {uploadCadence && uploadCadence.entries.length > 0 && (
        <UploadCadencePanel cadence={uploadCadence} />
      )}

      {/* Hook Pattern Library */}
      {hookPatterns && hookPatterns.patterns.length > 0 && (
        <HookPatternPanel library={hookPatterns} />
      )}

      {/* Content Sentiment */}
      {sentimentAnalysis && sentimentAnalysis.firmSentiment.length > 0 && (
        <SentimentPanel analysis={sentimentAnalysis} />
      )}

      {/* Reference Context */}
      {referenceContext && referenceContext.length > 0 && (
        <div className="bg-surface border border-border rounded-[10px] p-3.5">
          <div className="text-[9px] font-mono text-muted tracking-widest mb-2">
            REFERENCE LIBRARY &middot; {referenceContext.length} RELATED ENTRIES
          </div>
          {referenceContext.map((ref) => (
            <div key={ref.id} className="flex justify-between py-1 border-b" style={{ borderColor: "rgba(255,255,255,0.02)" }}>
              <span className="text-[10px] text-subtle truncate mr-2">{ref.name}</span>
              <span className="text-[10px] font-mono text-muted shrink-0">
                {ref.metrics.views ? formatNumber(ref.metrics.views) : ref.metrics.medianViews ? `${formatNumber(ref.metrics.medianViews)} med` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Claude prompt */}
      <ClaudePrompt
        url={url}
        activeModes={activeModes}
        channelName={channel?.name || video.channel}
        channelSubs={channel?.subs || 0}
        channelMedian={channelMedian}
        videoViews={video.views}
        videoVelocity={video.velocity}
        videoEngagement={video.engagement}
        isOutlier={video.isOutlier}
        vrsScore={video.vrs.estimatedFullScore}
      />
    </div>
  );
}
