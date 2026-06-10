"use client";

import type { TitleSentimentAnalysis } from "@/lib/sentiment";
import CollapsibleSection from "./CollapsibleSection";

interface SentimentPanelProps {
  analysis: TitleSentimentAnalysis;
}

const SENTIMENT_COLORS = {
  positive: "var(--color-vrs-excellent)",
  negative: "var(--color-vrs-rework)",
  neutral: "var(--color-vrs-competitive)",
};

export default function SentimentPanel({ analysis }: SentimentPanelProps) {
  return (
    <CollapsibleSection
      title="Content Sentiment Analysis"
      subtitle={`${analysis.overallSentiment} overall \u00b7 ${analysis.firmSentiment.length} firms analyzed`}
      accentColor={SENTIMENT_COLORS[analysis.overallSentiment]}
    >
      <div className="space-y-3">
        {/* Distribution bar */}
        <div>
          <div className="flex h-3 rounded-sm overflow-hidden">
            {analysis.distribution.positive > 0 && (
              <div style={{ width: `${analysis.distribution.positive}%`, background: SENTIMENT_COLORS.positive, opacity: 0.7 }} />
            )}
            {analysis.distribution.neutral > 0 && (
              <div style={{ width: `${analysis.distribution.neutral}%`, background: SENTIMENT_COLORS.neutral, opacity: 0.5 }} />
            )}
            {analysis.distribution.negative > 0 && (
              <div style={{ width: `${analysis.distribution.negative}%`, background: SENTIMENT_COLORS.negative, opacity: 0.7 }} />
            )}
          </div>
          <div className="flex justify-between mt-0.5 text-[7px] font-mono text-[#9E9C97]">
            <span style={{ color: SENTIMENT_COLORS.positive }}>{analysis.distribution.positive}% positive</span>
            <span style={{ color: SENTIMENT_COLORS.neutral }}>{analysis.distribution.neutral}% neutral</span>
            <span style={{ color: SENTIMENT_COLORS.negative }}>{analysis.distribution.negative}% negative</span>
          </div>
        </div>

        {/* Firm sentiment comparison */}
        {analysis.firmSentiment.length > 0 && (
          <div>
            <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">SENTIMENT BY PROP FIRM</div>
            <div className="space-y-1.5">
              {analysis.firmSentiment.map((fs) => (
                <div key={fs.firm} className="flex items-center gap-2">
                  <span className="text-[9px] font-mono w-28 truncate shrink-0">{fs.firm}</span>
                  <div className="flex-1 h-2 rounded-sm overflow-hidden bg-background relative">
                    {/* Center line at 0 */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                    {/* Score bar */}
                    <div
                      className="absolute top-0 bottom-0 rounded-sm"
                      style={{
                        left: fs.score >= 0 ? "50%" : `${50 + fs.score * 50}%`,
                        width: `${Math.abs(fs.score) * 50}%`,
                        background: SENTIMENT_COLORS[fs.sentiment],
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-mono w-8 text-right" style={{ color: SENTIMENT_COLORS[fs.sentiment] }}>
                    {fs.score > 0 ? "+" : ""}{fs.score}
                  </span>
                  <span className="text-[7px] font-mono text-[#9E9C97] w-6 text-right">{fs.videoCount}v</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top signals */}
        <div className="flex gap-4">
          {analysis.topPositiveSignals.length > 0 && (
            <div className="flex-1">
              <div className="text-[7px] font-mono tracking-widest mb-0.5" style={{ color: SENTIMENT_COLORS.positive }}>POSITIVE SIGNALS</div>
              {analysis.topPositiveSignals.map((s, i) => (
                <div key={i} className="text-[8px] text-subtle">{s}</div>
              ))}
            </div>
          )}
          {analysis.topNegativeSignals.length > 0 && (
            <div className="flex-1">
              <div className="text-[7px] font-mono tracking-widest mb-0.5" style={{ color: SENTIMENT_COLORS.negative }}>NEGATIVE SIGNALS</div>
              {analysis.topNegativeSignals.map((s, i) => (
                <div key={i} className="text-[8px] text-subtle">{s}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
