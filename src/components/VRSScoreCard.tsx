"use client";

import { useState } from "react";
import type { VRSResult, VRSTier } from "@/lib/types";
import { getVRSColor, getVRSLabel, getTierColor, getStatusIcon, getVRSExplanation } from "@/lib/vrs";

interface VRSScoreCardProps {
  vrs: VRSResult;
  label?: string; // "VRS" or "TRS"
  referenceCount?: number; // how many entries in the reference pool
}

const TIER_LABELS: Record<VRSTier, string> = {
  1: "CRITICAL",
  2: "STRONG",
  3: "SUPPORT",
  4: "BASELINE",
};

export default function VRSScoreCard({ vrs, label = "VRS", referenceCount = 0 }: VRSScoreCardProps) {
  const assessedColor = getVRSColor(vrs.score);
  const estimatedColor = getVRSColor(vrs.estimatedFullScore);
  const estimatedLabel = getVRSLabel(vrs.estimatedFullScore);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const assessedCount = vrs.criteria.length - vrs.hiddenCount;
  const assessedPct = Math.round(
    (vrs.possible / vrs.totalWeight) * 100
  );

  const explanation = getVRSExplanation(
    vrs.estimatedFullScore,
    assessedCount,
    vrs.criteria.length,
    referenceCount
  );

  return (
    <div className="bg-surface border border-border rounded-[10px] p-3.5">
      {/* Header with dual scores */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="text-[10px] font-mono text-muted tracking-widest">
              VIRAL READINESS SCORE
            </div>
            {/* Info tooltip trigger */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowInfoTooltip(true)}
                onMouseLeave={() => setShowInfoTooltip(false)}
                onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
                style={{
                  background: showInfoTooltip ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
                  color: showInfoTooltip ? "#000" : "var(--color-text-muted)",
                }}
              >
                ?
              </button>
              {showInfoTooltip && (
                <div
                  className="absolute left-6 top-0 z-50 w-[340px] p-3.5 rounded-lg shadow-xl"
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="text-[10px] font-mono font-bold mb-2" style={{ color: estimatedColor }}>
                    {label} {vrs.estimatedFullScore}% — {estimatedLabel}
                  </div>
                  <div className="text-[10px] text-subtle leading-relaxed whitespace-pre-line">
                    {explanation}
                  </div>
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="text-[9px] text-muted font-mono">
                      {assessedCount} auto-assessed + {vrs.hiddenCount} estimated = {vrs.criteria.length} total criteria
                    </div>
                    <div className="text-[9px] text-muted font-mono">
                      {assessedPct}% of weight directly measured
                    </div>
                    {referenceCount > 0 && (
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: "var(--color-accent)" }}>
                        {referenceCount} videos/channels in reference pool
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary: Estimated Full Score */}
          <div
            className="text-4xl font-extrabold font-mono leading-none"
            style={{ color: estimatedColor }}
          >
            {vrs.estimatedFullScore}%
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            estimated full score &middot; {estimatedLabel}
          </div>

          {/* Secondary: Assessed Score */}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="text-[13px] font-bold font-mono"
              style={{ color: assessedColor }}
            >
              {vrs.score}%
            </span>
            <span className="text-[9px] text-muted">
              assessed ({assessedCount}/{vrs.criteria.length} criteria &middot; {assessedPct}% weight)
            </span>
          </div>

          {/* Score bar */}
          <div className="mt-1.5 flex gap-0.5 h-1.5 rounded-full overflow-hidden w-48">
            <div
              className="rounded-l-full"
              style={{
                width: `${vrs.estimatedFullScore}%`,
                background: estimatedColor,
                opacity: 0.9,
              }}
            />
            <div
              className="flex-1 rounded-r-full"
              style={{
                background: "rgba(139,92,246,0.08)",
              }}
            />
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[8px] text-border-light">
            <span>
              <span style={{ color: assessedColor }}>&#9632;</span> {vrs.earned.toFixed(1)}/{vrs.possible.toFixed(1)} assessed
            </span>
            <span>
              <span style={{ color: "var(--color-vrs-competitive)" }}>&#9632;</span> ~{vrs.estimatedHiddenScore}/{(vrs.totalWeight - vrs.possible).toFixed(0)} hidden est.
            </span>
          </div>
        </div>

        {/* Circular progress */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg
            width="64"
            height="64"
            className="absolute"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={`color-mix(in srgb, ${estimatedColor} 10%, transparent)`}
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={assessedColor}
              strokeWidth="4"
              strokeDasharray={`${(vrs.earned / vrs.totalWeight) * 176} 176`}
              strokeLinecap="round"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={estimatedColor}
              strokeWidth="4"
              strokeDasharray={`${(vrs.estimatedHiddenScore / vrs.totalWeight) * 176} 176`}
              strokeDashoffset={`${-((vrs.earned / vrs.totalWeight) * 176)}`}
              strokeLinecap="round"
              opacity={0.4}
            />
          </svg>
          <span
            className="text-[15px] font-extrabold font-mono z-10"
            style={{ color: estimatedColor }}
          >
            {vrs.estimatedFullScore}
          </span>
        </div>
      </div>

      {/* Tier breakdowns */}
      {([1, 2, 3, 4] as VRSTier[]).map((tier) => {
        const summary = vrs.tierSummaries.find((t) => t.tier === tier)!;
        const items = vrs.criteria.filter((c) => c.tier === tier);
        const tierColor = getTierColor(tier);

        return (
          <div key={tier} className="mb-3">
            <div className="flex justify-between mb-1">
              <span
                className="text-[9px] font-mono font-bold tracking-wide"
                style={{ color: tierColor }}
              >
                T{tier} {TIER_LABELS[tier]}
              </span>
              <span className="text-[9px] font-mono text-muted">
                {summary.earned.toFixed(1)}/{summary.possible.toFixed(1)}
              </span>
            </div>
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.id)
                    }
                    className="w-full flex items-center gap-1.5 py-1 border-b hover:bg-surface-hover transition-colors"
                    style={{ borderColor: "rgba(139,92,246,0.06)" }}
                  >
                    <span className="text-[11px] w-[18px] text-center shrink-0">
                      {getStatusIcon(item.status)}
                    </span>
                    <span
                      className="flex-1 text-[11px] text-left"
                      style={{
                        color:
                          item.status === "pass"
                            ? "rgba(255,255,255,0.75)"
                            : item.status === "partial"
                              ? "var(--color-vrs-competitive)"
                              : item.status === "fail"
                                ? "var(--color-vrs-rework)"
                                : "rgba(255,255,255,0.2)",
                      }}
                    >
                      {item.label}
                    </span>
                    <span className="text-[9px] font-mono text-border-light w-7 text-right shrink-0">
                      w:{item.weight}
                    </span>
                    <span
                      className="text-[9px] font-mono w-8 text-right shrink-0"
                      style={{
                        color:
                          item.status === "pass"
                            ? "var(--color-vrs-excellent)"
                            : item.status === "partial"
                              ? "var(--color-vrs-competitive)"
                              : item.status === "fail"
                                ? "var(--color-vrs-rework)"
                                : "var(--color-border-light)",
                      }}
                    >
                      {item.status === "hidden"
                        ? "\u2014"
                        : item.points.toFixed(1)}
                    </span>
                    <span
                      className="text-[8px] ml-0.5 transition-transform duration-150 shrink-0"
                      style={{
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      &#9654;
                    </span>
                  </button>
                  {isExpanded && (
                    <div
                      className="ml-[22px] mr-2 py-2 px-2.5 mb-1 rounded text-[10px] leading-relaxed"
                      style={{
                        background:
                          item.status === "pass"
                            ? "color-mix(in srgb, var(--color-vrs-excellent) 5%, transparent)"
                            : item.status === "partial"
                              ? "color-mix(in srgb, var(--color-vrs-competitive) 5%, transparent)"
                              : item.status === "fail"
                                ? "color-mix(in srgb, var(--color-vrs-rework) 5%, transparent)"
                                : "color-mix(in srgb, var(--color-vrs-competitive) 3%, transparent)",
                        color: "var(--color-text-subtle)",
                        borderLeft: `2px solid ${
                          item.status === "pass"
                            ? "var(--color-vrs-excellent)"
                            : item.status === "partial"
                              ? "var(--color-vrs-competitive)"
                              : item.status === "fail"
                                ? "var(--color-vrs-rework)"
                                : "var(--color-vrs-competitive)"
                        }`,
                      }}
                    >
                      {item.rationale}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Gap Analysis */}
      {vrs.gaps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[9px] font-mono text-vrs-competitive tracking-widest mb-2">
            GAP ANALYSIS (by weight impact)
          </div>
          {vrs.gaps.slice(0, 5).map((gap) => (
            <div
              key={gap.id}
              className="flex items-center gap-1.5 py-0.5 text-[10px]"
            >
              <span>{getStatusIcon(gap.status)}</span>
              <span className="flex-1 text-subtle">{gap.label}</span>
              <span
                className="font-mono font-bold"
                style={{ color: "var(--color-vrs-rework)" }}
              >
                -{(gap.maxPoints - gap.points).toFixed(1)}pts
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hidden criteria note */}
      {vrs.hiddenCount > 0 && (
        <div
          className="rounded-md p-2.5 mt-3"
          style={{ background: "rgba(255,200,0,0.04)" }}
        >
          <div className="text-[9px] font-mono mb-1" style={{ color: "var(--color-vrs-competitive)" }}>
            &#x1F50D; HIDDEN CRITERIA ({vrs.hiddenCount}) &middot; EST. ~{vrs.estimatedHiddenScore} / {(vrs.totalWeight - vrs.possible).toFixed(0)} pts
          </div>
          <div className="text-[10px] text-muted leading-relaxed">
            Thumbnail packaging, mobile readiness, visual promise alignment, and audio quality
            require visual/audio analysis. Hidden scores are estimated from engagement
            velocity, like/comment ratios, and content packaging quality.
            The estimated full score ({vrs.estimatedFullScore}%) projects total performance
            if all {vrs.criteria.length} criteria were assessed.
          </div>
        </div>
      )}
    </div>
  );
}
