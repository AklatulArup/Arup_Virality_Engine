"use client";

import type { LanguageCPA } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import CollapsibleSection from "./CollapsibleSection";

interface LanguageCPAPanelProps {
  data: LanguageCPA[];
  totalVideos: number;
}

export default function LanguageCPAPanel({ data, totalVideos }: LanguageCPAPanelProps) {
  if (data.length < 2) return null;

  const maxAvgViews = Math.max(...data.map((d) => d.avgViews), 1);

  return (
    <CollapsibleSection
      title="Language-Based Content Performance"
      subtitle={`${data.length} languages detected across ${totalVideos} videos`}
      accentColor="var(--color-accent-blue)"
    >
      <div className="space-y-1.5">
        {data.map((lang) => {
          const barWidth = (lang.avgViews / maxAvgViews) * 100;
          return (
            <div key={lang.language} className="py-1.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold">{lang.label}</span>
                  <span className="text-[9px] text-[#9E9C97] font-mono">
                    {lang.videoCount} video{lang.videoCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-mono text-[#9E9C97]">
                    {formatNumber(lang.avgViews)} avg views
                  </span>
                  <span className="text-[9px] font-mono text-[#9E9C97]">
                    {lang.avgEngagement}% eng
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: getVRSColor(lang.avgVRS) }}
                  >
                    {lang.avgVRS}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-sm overflow-hidden bg-background">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${barWidth}%`,
                    background: "var(--color-accent-blue)",
                    opacity: 0.5,
                  }}
                />
              </div>
              {lang.topVideo && (
                <div className="text-[8px] text-[#9E9C97] mt-0.5 truncate">
                  Top: &ldquo;{lang.topVideo.title}&rdquo; ({formatNumber(lang.topVideo.views)} views)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
