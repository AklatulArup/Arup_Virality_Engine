"use client";

import { useState } from "react";
import type { TitleVariant, KeywordBank } from "@/lib/types";
import { scoreTitleVariant, generateTitleVariants } from "@/lib/title-scoring";
import CollapsibleSection from "./CollapsibleSection";

interface TitleScoringPanelProps {
  currentTitle: string;
  bank: KeywordBank;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "var(--color-vrs-excellent)" : value >= 40 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[8px] text-[#9E9C97] font-mono w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-sm overflow-hidden bg-background">
        <div className="h-full rounded-sm" style={{ width: `${value}%`, background: color, opacity: 0.7 }} />
      </div>
      <span className="text-[8px] font-mono w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function VariantCard({ variant, isCurrent }: { variant: TitleVariant; isCurrent?: boolean }) {
  const scoreColor = variant.score >= 70 ? "var(--color-vrs-excellent)" : variant.score >= 45 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)";
  return (
    <div className="border border-border rounded-md p-2.5 mb-2" style={isCurrent ? { borderColor: "#60A5FA", background: "rgba(0,229,160,0.03)" } : {}}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          {isCurrent && <span className="text-[7px] font-mono text-[#60A5FA] mr-1">CURRENT</span>}
          <div className="text-[11px] font-semibold leading-snug">{variant.title}</div>
        </div>
        <span className="text-[14px] font-mono font-bold ml-2 shrink-0" style={{ color: scoreColor }}>
          {variant.score}
        </span>
      </div>
      <ScoreBar label="Hook" value={variant.breakdown.hookStrength} />
      <ScoreBar label="Curiosity" value={variant.breakdown.curiosityGap} />
      <ScoreBar label="Numbers" value={variant.breakdown.numberPresence} />
      <ScoreBar label="Length" value={variant.breakdown.lengthOptimal} />
      <ScoreBar label="Keywords" value={variant.breakdown.keywordDensity} />
      <ScoreBar label="Emotion" value={variant.breakdown.emotionalPull} />
      <ScoreBar label="Clarity" value={variant.breakdown.clarityScore} />
      {variant.feedback.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {variant.feedback.map((f, i) => (
            <div key={i} className="text-[8px] text-[#9E9C97]">&#x2022; {f}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TitleScoringPanel({ currentTitle, bank }: TitleScoringPanelProps) {
  const [showVariants, setShowVariants] = useState(false);
  const currentScore = scoreTitleVariant(currentTitle, bank);

  // Extract topic from current title for variant generation
  const topic = currentTitle.replace(/[^\w\s]/g, "").split(" ").slice(0, 4).join(" ");
  const variants = showVariants ? generateTitleVariants(topic, bank) : [];

  return (
    <CollapsibleSection
      title="Title A/B Scoring"
      subtitle={`Current title scores ${currentScore.score}/100`}
      accentColor="var(--color-mode-c)"
    >
      <VariantCard variant={currentScore} isCurrent />

      <button
        onClick={() => setShowVariants(!showVariants)}
        className="text-[9px] font-mono px-2 py-1 rounded border border-border hover:border-accent transition-colors"
      >
        {showVariants ? "Hide" : "Generate"} Title Variants
      </button>

      {showVariants && variants.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-mono text-[#9E9C97] tracking-widest mb-1.5">GENERATED VARIANTS</div>
          {variants.map((v, i) => (
            <VariantCard key={i} variant={v} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
