"use client";

import type { UploadCadenceResult } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface UploadCadencePanelProps {
  cadence: UploadCadenceResult;
}

export default function UploadCadencePanel({ cadence }: UploadCadencePanelProps) {
  if (cadence.entries.length === 0) return null;

  const maxViews = Math.max(...cadence.entries.map((e) => e.avgViews), 1);

  return (
    <CollapsibleSection
      title="Upload Cadence Analysis"
      subtitle={`Best cadence: ${cadence.bestCadence} \u00b7 Consistency-views correlation: ${cadence.correlation}`}
      accentColor="var(--color-mode-a)"
    >
      <div className="space-y-1.5">
        {cadence.entries.slice(0, 12).map((entry) => (
          <div key={entry.channelName} className="py-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-semibold truncate mr-2">{entry.channelName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-background text-[#9E9C97]">
                  {entry.cadenceLabel}
                </span>
                <span className="text-[8px] font-mono text-[#9E9C97]">
                  {entry.avgDaysBetweenUploads}d avg
                </span>
                <span className="text-[8px] font-mono" style={{
                  color: entry.consistency > 0.7 ? "var(--color-vrs-excellent)" : entry.consistency > 0.4 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)"
                }}>
                  {Math.round(entry.consistency * 100)}% consistent
                </span>
                <span className="text-[9px] font-mono font-bold">{formatNumber(entry.avgViews)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-sm overflow-hidden bg-background">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(entry.avgViews / maxViews) * 100}%`,
                  background: "var(--color-mode-a)",
                  opacity: 0.5,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
