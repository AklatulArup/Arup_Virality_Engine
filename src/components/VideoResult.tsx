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
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatters";
import { detectArchetypes, getArchetype } from "@/lib/archetypes";
import MetricCard from "./MetricCard";
import DeepAnalysisPanel from "./DeepAnalysisPanel";
import CollapsibleSection from "./CollapsibleSection";
import AlgorithmIntelPanel from "./AlgorithmIntelPanel";
import AdjacentVideos from "./AdjacentVideos";
import DescriptionSEOPanel from "./DescriptionSEOPanel";
import EngagementDecayPanel from "./EngagementDecayPanel";
import ThumbnailPanel from "./ThumbnailPanel";
import CompetitorGapPanel from "./CompetitorGapPanel";
import TagCorrelationPanel from "./TagCorrelationPanel";
import UploadCadencePanel from "./UploadCadencePanel";
import ExpertWarRoomPanel from "./ExpertWarRoomPanel";

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
  referenceStore?: import("@/lib/types").ReferenceStore | null;
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
  referenceStore,
}: VideoResultProps) {
  const archetypes = detectArchetypes(video.title, video.tags);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Expert War Room ── */}
      <ExpertWarRoomPanel
        video={video}
        channel={channel}
        channelMedian={channelMedian}
        recentVideos={recentVideos}
        referenceStore={referenceStore}
        keywordBank={keywordBank}
      />

      {/* ── Video hero card ── */}
      <div
        className="glass-card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: 12,
          display: "flex",
          gap: 0,
        }}
      >
        {/* Thumbnail */}
        {video.thumbnail && (
          <div style={{ position: "relative", flexShrink: 0, width: 200 }}>
            <Image
              src={video.thumbnail}
              alt={video.title}
              width={360}
              height={203}
              className="object-cover"
              style={{ width: 200, height: "100%", minHeight: 120, display: "block" }}
            />
            {/* Gradient overlay on thumbnail */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to right, transparent 60%, rgba(13,13,11,0.9))",
            }} />
          </div>
        )}

        <div className="flex-1 min-w-0 p-5">
          {/* Title + meta */}
          <div className="mb-3">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#E8E6E1", lineHeight: 1.4, marginBottom: 6 }}>
              {video.title}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono" style={{ fontSize: 11, color: "#8A8885" }}>
                {video.channel}
              </span>
              <span style={{ color: "#3A3835" }}>·</span>
              <span className="font-mono" style={{ fontSize: 11, color: "#8A8885" }}>
                {formatDate(video.publishedAt)}
              </span>
              {video.duration && (
                <>
                  <span style={{ color: "#3A3835" }}>·</span>
                  <span className="font-mono" style={{ fontSize: 11, color: "#8A8885" }}>{video.duration}</span>
                </>
              )}
            </div>
          </div>

          {/* Metric pills row */}
          <div className="flex gap-4 flex-wrap mb-3">
            {[
              { label: "VIEWS",    value: formatNumber(video.views),               color: "#2ECC8A" },
              { label: "LIKES",    value: formatNumber(video.likes),               color: "#60A5FA" },
              { label: "COMMENTS", value: formatNumber(video.comments),            color: "#A78BFA" },
              { label: "VELOCITY", value: `${formatNumber(video.velocity)}/d`,     color: "#7B4FFF" },
              { label: "ENGAGE",   value: `${video.engagement.toFixed(1)}%`,       color: "#F59E0B" },
              { label: "VS BASE",  value: `${video.vsBaseline}x`,                  color: video.vsBaseline >= 3 ? "#2ECC8A" : video.vsBaseline >= 1 ? "#F59E0B" : "#FF4D6A" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.12em", marginBottom: 2 }}>{label}</div>
                <div className="font-mono font-bold" style={{ fontSize: 16, color, textShadow: `0 0 10px ${color}88` }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap">
            {video.isOutlier && (
              <span
                className="font-mono font-bold"
                style={{
                  fontSize: 9, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 99,
                  background: "rgba(46,204,138,0.12)", border: "1px solid rgba(46,204,138,0.3)",
                  color: "#2ECC8A", boxShadow: "0 0 8px rgba(46,204,138,0.2)",
                }}
              >
                🔥 OUTLIER — {video.vsBaseline}x MEDIAN
              </span>
            )}
            {archetypes.map((id) => {
              const arch = getArchetype(id);
              if (!arch) return null;
              return (
                <span
                  key={id}
                  className="font-mono"
                  style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 99,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                    color: "#8A8885",
                  }}
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
                style={{ borderColor: "rgba(139,92,246,0.06)" }}
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

      {/* Description SEO */}
      {descriptionSEO && <DescriptionSEOPanel seo={descriptionSEO} />}

      {/* Engagement Decay / Content Lifecycle */}
      {engagementDecay && (
        <EngagementDecayPanel decay={engagementDecay} currentViews={video.views} />
      )}

      {/* Thumbnail Metadata */}
      {thumbnailAnalysis && <ThumbnailPanel analysis={thumbnailAnalysis} />}

      {/* ── Reference Pool Aggregate Panels ── */}

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

      {/* Reference Context */}
      {referenceContext && referenceContext.length > 0 && (
        <div className="bg-surface border border-border rounded-[10px] p-3.5">
          <div className="text-[9px] font-mono text-muted tracking-widest mb-2">
            REFERENCE LIBRARY &middot; {referenceContext.length} RELATED ENTRIES
          </div>
          {referenceContext.map((ref) => (
            <div key={ref.id} className="flex justify-between py-1 border-b" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
              <span className="text-[10px] text-subtle truncate mr-2">{ref.name}</span>
              <span className="text-[10px] font-mono text-muted shrink-0">
                {ref.metrics.views ? formatNumber(ref.metrics.views) : ref.metrics.medianViews ? `${formatNumber(ref.metrics.medianViews)} med` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
