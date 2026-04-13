"use client";

import Image from "next/image";
import type { ChannelHealth, ModeId, DeepAnalysis, ReferenceEntry } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import MetricCard from "./MetricCard";
import DeepAnalysisPanel from "./DeepAnalysisPanel";
import CollapsibleSection from "./CollapsibleSection";
import AlgorithmIntelPanel from "./AlgorithmIntelPanel";

interface ChannelResultProps {
  health: ChannelHealth;
  activeModes: ModeId[];
  deepAnalysis?: DeepAnalysis | null;
  referenceContext?: ReferenceEntry[];
}

const TREND_CONFIG = {
  growing: { label: "Growing", color: "var(--color-vrs-excellent)", icon: "\u2191" },
  stable: { label: "Stable", color: "var(--color-vrs-competitive)", icon: "\u2192" },
  declining: { label: "Declining", color: "var(--color-vrs-rework)", icon: "\u2193" },
};

export default function ChannelResult({
  health,
  activeModes,
  deepAnalysis,
  referenceContext,
}: ChannelResultProps) {
  const { channel, videos, medianViews, outliers, outlierRate, uploadFrequency, trend } = health;
  const trendInfo = TREND_CONFIG[trend];

  return (
    <div className="flex flex-col gap-3.5">
      {/* Channel header */}
      <div className="bg-surface border border-border rounded-[10px] p-3.5">
        <div className="flex items-center gap-2.5 mb-3">
          {channel.avatar && (
            <Image
              src={channel.avatar}
              alt={channel.name}
              width={44}
              height={44}
              className="rounded-full"
            />
          )}
          <div className="flex-1">
            <h2 className="text-base font-bold">{channel.name}</h2>
            <div className="text-[11px] text-muted">
              {formatNumber(channel.subs)} subs &middot; {channel.videoCount}{" "}
              videos &middot; {formatNumber(channel.totalViews)} total views
            </div>
          </div>
          <div
            className="text-[10px] font-mono font-bold px-2 py-1 rounded"
            style={{
              color: trendInfo.color,
              background: `color-mix(in srgb, ${trendInfo.color} 8%, transparent)`,
            }}
          >
            {trendInfo.icon} {trendInfo.label}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <MetricCard label="Median Views" value={formatNumber(medianViews)} />
          <MetricCard
            label="Median Velocity"
            value={`${formatNumber(health.medianVelocity)}/d`}
            color="var(--color-mode-c)"
          />
          <MetricCard
            label="Median Engage"
            value={`${health.medianEngagement.toFixed(1)}%`}
            color="var(--color-mode-e)"
          />
          <MetricCard
            label="Outliers"
            value={String(outliers.length)}
            color="var(--color-mode-c)"
          />
          <MetricCard
            label="Outlier Rate"
            value={`${outlierRate.toFixed(0)}%`}
            color={
              outlierRate >= 20
                ? "var(--color-vrs-excellent)"
                : outlierRate >= 10
                  ? "var(--color-vrs-competitive)"
                  : "var(--color-vrs-rework)"
            }
          />
          <MetricCard
            label="Upload Freq"
            value={uploadFrequency > 0 ? `${uploadFrequency}d` : "N/A"}
            color="var(--color-accent-blue)"
          />
          <MetricCard
            label="Analyzed"
            value={String(videos.length)}
            color="var(--color-accent)"
          />
        </div>
      </div>

      {/* Videos list */}
      <div className="bg-surface border border-border rounded-[10px] p-3.5">
        <div className="text-[9px] font-mono text-muted tracking-widest mb-2">
          VIDEOS BY VIEWS
        </div>
        {videos.map((v) => {
          const isOut = v.isOutlier;
          return (
            <div
              key={v.id}
              className="flex items-center gap-2 py-1.5 border-b"
              style={{ borderColor: "rgba(139,92,246,0.06)" }}
            >
              {v.thumbnail && (
                <Image
                  src={v.thumbnail}
                  alt={v.title}
                  width={72}
                  height={40}
                  className="rounded object-cover shrink-0"
                  style={{ width: 72, height: 40 }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[11px] font-semibold truncate"
                  style={{
                    color: isOut ? "#fff" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {v.title}
                </div>
                <div className="text-[9px] text-muted">
                  {v.days}d &middot; {v.duration} &middot;{" "}
                  {v.engagement.toFixed(1)}% eng
                </div>
              </div>
              <div className="text-right shrink-0 mr-1">
                <div
                  className="text-xs font-bold font-mono"
                  style={{
                    color: isOut
                      ? "var(--color-vrs-excellent)"
                      : "#fff",
                  }}
                >
                  {formatNumber(v.views)}
                </div>
                <div className="text-[9px] text-muted font-mono">
                  {formatNumber(v.velocity)}/d
                </div>
              </div>
              {activeModes.includes("G") && (
                <div className="w-9 text-center shrink-0">
                  <div
                    className="text-xs font-extrabold font-mono"
                    style={{ color: getVRSColor(v.vrs.estimatedFullScore) }}
                  >
                    {v.vrs.estimatedFullScore}
                  </div>
                  <div className="text-[7px] text-muted font-mono">VRS</div>
                </div>
              )}
              {isOut && (
                <span
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: "var(--color-vrs-excellent)",
                    background: "rgba(0,229,160,0.06)",
                  }}
                >
                  OUT
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Deep Analysis */}
      {deepAnalysis && (
        <DeepAnalysisPanel
          analysis={deepAnalysis}
          channelName={channel.name}
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
                {ref.metrics.medianViews ? `${formatNumber(ref.metrics.medianViews)} med` : ""}
                {ref.metrics.trend ? ` · ${ref.metrics.trend}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
