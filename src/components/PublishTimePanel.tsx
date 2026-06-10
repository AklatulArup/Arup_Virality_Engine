"use client";

import type { PublishTimeHeatmap } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface PublishTimePanelProps {
  heatmap: PublishTimeHeatmap;
}

export default function PublishTimePanel({ heatmap }: PublishTimePanelProps) {
  const maxVal = Math.max(...heatmap.dayHourGrid.flat(), 1);

  // Show condensed hours: 6am-11pm in 3-hour blocks
  const hourBlocks = [0, 3, 6, 9, 12, 15, 18, 21];
  const hourLabels = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

  return (
    <CollapsibleSection
      title="Publish Time Optimization"
      subtitle={`${heatmap.totalVideosAnalyzed} videos analyzed — best posting windows`}
      accentColor="#60A5FA"
    >
      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${hourBlocks.length}, 1fr)` }}>
          {/* Header row */}
          <div />
          {hourLabels.map((h) => (
            <div key={h} className="text-[8px] text-[#9E9C97] text-center font-mono">{h}</div>
          ))}

          {/* Data rows */}
          {heatmap.dayLabels.map((day, d) => (
            <>
              <div key={`label-${d}`} className="text-[9px] text-[#9E9C97] font-mono flex items-center">{day}</div>
              {hourBlocks.map((h, hi) => {
                // Average the 3-hour block
                const blockViews = [0, 1, 2].reduce((s, offset) => {
                  const hr = h + offset;
                  return s + (hr < 24 ? heatmap.dayHourGrid[d][hr] : 0);
                }, 0) / 3;
                const intensity = blockViews / maxVal;
                return (
                  <div
                    key={`${d}-${hi}`}
                    className="rounded-sm h-5 flex items-center justify-center"
                    style={{
                      background: intensity > 0
                        ? `rgba(0, 229, 160, ${Math.max(0.05, intensity * 0.8)})`
                        : "rgba(255,255,255,0.02)",
                    }}
                    title={`${day} ${hourLabels[hi]}: ${formatNumber(Math.round(blockViews))} avg views`}
                  >
                    {blockViews > maxVal * 0.5 && (
                      <span className="text-[7px] font-mono" style={{ color: "var(--color-vrs-excellent)" }}>
                        {formatNumber(Math.round(blockViews))}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Best slots */}
      {heatmap.bestSlots.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-mono text-[#9E9C97] tracking-widest mb-1">BEST POSTING TIMES</div>
          <div className="flex flex-wrap gap-1.5">
            {heatmap.bestSlots.map((slot, i) => (
              <span
                key={i}
                className="text-[9px] font-mono px-2 py-0.5 rounded"
                style={{ background: "rgba(0,229,160,0.08)", color: "var(--color-vrs-excellent)" }}
              >
                {heatmap.dayLabels[slot.day]} {slot.hour}:00 UTC &middot; {formatNumber(slot.avgViews)} avg ({slot.videoCount} videos)
              </span>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
