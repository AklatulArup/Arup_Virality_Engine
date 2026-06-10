"use client";

import type { ThumbnailAnalysis } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";

interface ThumbnailPanelProps {
  analysis: ThumbnailAnalysis;
}

export default function ThumbnailPanel({ analysis }: ThumbnailPanelProps) {
  const scoreColor = analysis.score >= 70 ? "var(--color-vrs-excellent)" : analysis.score >= 40 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)";

  return (
    <CollapsibleSection
      title="Thumbnail Analysis"
      subtitle={`Metadata score: ${analysis.score}/100`}
      accentColor="var(--color-mode-c)"
    >
      <div className="flex gap-4 items-start">
        <div className="text-center">
          <div className="text-[24px] font-mono font-bold" style={{ color: scoreColor }}>{analysis.score}</div>
          <div className="text-[8px] text-[#9E9C97]">METADATA</div>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: analysis.hasCustomThumbnail ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {analysis.hasCustomThumbnail ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Custom thumbnail {analysis.hasCustomThumbnail ? "detected" : "not detected"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: analysis.aspectRatioCorrect ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {analysis.aspectRatioCorrect ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">16:9 aspect ratio</span>
          </div>
          <div className="text-[9px] text-[#9E9C97]">Max resolution: {analysis.maxResolution}</div>
        </div>
      </div>

      {analysis.issues.length > 0 && (
        <div className="mt-2.5 space-y-0.5">
          {analysis.issues.map((issue, i) => (
            <div key={i} className="text-[8px] text-subtle">
              <span style={{ color: "var(--color-vrs-competitive)" }}>{"\u2192"}</span> {issue}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
