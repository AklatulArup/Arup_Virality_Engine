"use client";

import type { DeepAnalysis } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";
import OutlierBreakdown from "./deep/OutlierBreakdown";
import Recommendations from "./deep/Recommendations";

interface DeepAnalysisPanelProps {
  analysis: DeepAnalysis;
  channelName: string;
}

export default function DeepAnalysisPanel({
  analysis,
  channelName,
}: DeepAnalysisPanelProps) {
  const hasEnoughData =
    analysis.monthlyTrajectory.length > 0 ||
    analysis.recommendations.length > 0;

  if (!hasEnoughData) return null;

  return (
    <div className="space-y-2 mt-4">
      <div className="text-[10px] text-muted font-mono px-1 mb-2">
        DEEP ANALYSIS &middot; {channelName.toUpperCase()}
      </div>

      {/* Recommendations — open by default (highest immediate value) */}
      <CollapsibleSection
        title="Actionable Recommendations"
        subtitle={`${analysis.recommendations.length} recommendations based on content patterns and platform algorithms`}
        defaultOpen={true}
        accentColor="var(--color-vrs-excellent)"
      >
        <Recommendations recommendations={analysis.recommendations} />
      </CollapsibleSection>

      {/* Outlier Breakdown */}
      {analysis.outlierInsights.length > 0 && (
        <CollapsibleSection
          title="Outlier Breakdown"
          subtitle={`${analysis.outlierInsights.length} video(s) exceeded 3x channel median — why they went viral`}
          accentColor="var(--color-mode-c)"
        >
          <OutlierBreakdown insights={analysis.outlierInsights} />
        </CollapsibleSection>
      )}

    </div>
  );
}
