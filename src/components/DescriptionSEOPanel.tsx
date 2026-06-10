"use client";

import type { DescriptionSEO } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";

interface DescriptionSEOPanelProps {
  seo: DescriptionSEO;
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-[10px]" style={{ color: passed ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
        {passed ? "\u2713" : "\u2717"}
      </span>
      <span className="text-[9px] text-subtle">{label}</span>
    </div>
  );
}

export default function DescriptionSEOPanel({ seo }: DescriptionSEOPanelProps) {
  const scoreColor = seo.overallScore >= 70 ? "var(--color-vrs-excellent)" : seo.overallScore >= 40 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)";

  return (
    <CollapsibleSection
      title="Description SEO Analysis"
      subtitle={`Score: ${seo.overallScore}/100 \u00b7 ${seo.wordCount} words`}
      accentColor="var(--color-accent-blue)"
    >
      <div className="flex gap-4 mb-3">
        {/* Score */}
        <div className="text-center">
          <div className="text-[24px] font-mono font-bold" style={{ color: scoreColor }}>{seo.overallScore}</div>
          <div className="text-[8px] text-[#9E9C97]">SEO SCORE</div>
        </div>

        {/* Checklist */}
        <div className="flex-1">
          <CheckItem label="Timestamps / Chapters" passed={seo.hasTimestamps} />
          <CheckItem label="Links present" passed={seo.hasLinks} />
          <CheckItem label="Call-to-action" passed={seo.hasCTA} />
          <CheckItem label="Hashtags" passed={seo.hasHashtags} />
          <CheckItem label={`Niche keywords (${seo.keywordDensity.length} found)`} passed={seo.keywordDensity.length >= 2} />
          <CheckItem label={`Above-fold hook (${seo.aboveFoldScore}/100)`} passed={seo.aboveFoldScore >= 50} />
        </div>
      </div>

      {/* Above-fold preview */}
      {seo.aboveFoldHook && (
        <div className="mb-2.5">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">ABOVE-THE-FOLD PREVIEW</div>
          <div className="text-[9px] text-subtle bg-background rounded p-2 font-mono leading-relaxed">
            {seo.aboveFoldHook.slice(0, 200)}
          </div>
        </div>
      )}

      {/* Keywords found */}
      {seo.keywordDensity.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">KEYWORDS FOUND</div>
          <div className="flex flex-wrap gap-1">
            {seo.keywordDensity.slice(0, 8).map((kw) => (
              <span key={kw.keyword} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-background text-subtle">
                {kw.keyword} ({kw.count}x)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Issues + Suggestions */}
      {seo.issues.length > 0 && (
        <div className="mb-2">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">ISSUES</div>
          {seo.issues.map((issue, i) => (
            <div key={i} className="text-[8px] text-subtle py-0.5">
              <span style={{ color: "var(--color-vrs-rework)" }}>{"\u2717"}</span> {issue}
            </div>
          ))}
        </div>
      )}
      {seo.suggestions.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">SUGGESTIONS</div>
          {seo.suggestions.map((s, i) => (
            <div key={i} className="text-[8px] text-subtle py-0.5">
              <span style={{ color: "var(--color-vrs-competitive)" }}>{"\u2192"}</span> {s}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
