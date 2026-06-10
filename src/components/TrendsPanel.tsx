"use client";

import { useState } from "react";
import type { KeywordBank } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface TrendsPanelProps {
  bank: KeywordBank;
}

interface TrendData {
  keyword: string;
  trend: string;
  currentInterest: number;
  peakInterest: number;
  relatedQueries: { query: string; value: number }[];
  timeline: { date: string; value: number }[];
}

interface ComparisonData {
  keywords: string[];
  summaries: { keyword: string; currentAvg: number; peak: number }[];
}

export default function TrendsPanel({ bank }: TrendsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quickKeywords = [
    "prop firm", "forex trading", "funded trader", "FTMO", "FundedNext",
    ...bank.categories.competitors.slice(0, 3),
  ];

  const fetchTrend = async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trends?keyword=${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setTrendData(await res.json());
      setComparison(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  const compareFirms = async () => {
    setLoading(true);
    setError(null);
    try {
      const keywords = bank.categories.competitors.slice(0, 5);
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setComparison(await res.json());
      setTrendData(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  const trendColor = (trend: string) =>
    trend === "rising" ? "var(--color-vrs-excellent)" :
    trend === "declining" ? "var(--color-vrs-rework)" :
    "var(--color-vrs-competitive)";

  return (
    <CollapsibleSection
      title="Google Trends Intelligence"
      subtitle="Real-time trend data for niche keywords — free, no API key"
      accentColor="var(--color-mode-c)"
    >
      <div className="space-y-3">
        {/* Quick keywords */}
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">QUICK TREND CHECK</div>
          <div className="flex flex-wrap gap-1">
            {quickKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => fetchTrend(kw)}
                disabled={loading}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-border hover:border-accent transition-colors"
                style={{ color: "var(--color-subtle)" }}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Compare competitors button */}
        <button
          onClick={compareFirms}
          disabled={loading}
          className="text-[9px] font-mono px-3 py-1 rounded border border-border hover:border-accent transition-colors"
          style={{ color: "#60A5FA" }}
        >
          {loading ? "Loading..." : "Compare Top 5 Prop Firms"}
        </button>

        {error && (
          <div className="text-[9px] font-mono" style={{ color: "var(--color-vrs-rework)" }}>{error}</div>
        )}

        {/* Single keyword result */}
        {trendData && (
          <div className="p-2 rounded border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-bold">{trendData.keyword}</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: trendColor(trendData.trend) }}>
                {trendData.trend === "rising" ? "\u2191" : trendData.trend === "declining" ? "\u2193" : "\u2192"} {trendData.trend.toUpperCase()}
              </span>
            </div>

            {/* Mini sparkline */}
            <div className="flex items-end gap-px h-8 mb-2">
              {trendData.timeline.slice(-24).map((point, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(2, (point.value / Math.max(trendData.peakInterest, 1)) * 100)}%`,
                    background: trendColor(trendData.trend),
                    opacity: i >= 20 ? 0.8 : 0.3,
                  }}
                />
              ))}
            </div>

            <div className="flex gap-4 text-[8px] font-mono">
              <div>
                <span className="text-[#9E9C97]">Current:</span>{" "}
                <span className="font-bold">{trendData.currentInterest}</span>
              </div>
              <div>
                <span className="text-[#9E9C97]">Peak:</span>{" "}
                <span className="font-bold">{trendData.peakInterest}</span>
              </div>
            </div>

            {/* Related queries */}
            {trendData.relatedQueries.length > 0 && (
              <div className="mt-2">
                <div className="text-[7px] font-mono text-[#9E9C97] tracking-widest mb-0.5">RELATED QUERIES</div>
                <div className="flex flex-wrap gap-1">
                  {trendData.relatedQueries.slice(0, 6).map((q) => (
                    <button
                      key={q.query}
                      onClick={() => fetchTrend(q.query)}
                      className="text-[7px] font-mono px-1 py-0.5 rounded bg-background text-subtle hover:text-[#60A5FA] transition-colors"
                    >
                      {q.query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison result */}
        {comparison && (
          <div className="p-2 rounded border border-border">
            <div className="text-[9px] font-mono text-[#9E9C97] mb-2">PROP FIRM TREND COMPARISON</div>
            {comparison.summaries.sort((a, b) => b.currentAvg - a.currentAvg).map((s) => {
              const maxCurrent = Math.max(...comparison.summaries.map((x) => x.currentAvg), 1);
              return (
                <div key={s.keyword} className="flex items-center gap-2 py-1">
                  <span className="text-[9px] font-mono w-28 truncate shrink-0">{s.keyword}</span>
                  <div className="flex-1 h-2 rounded-sm overflow-hidden bg-background">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(s.currentAvg / maxCurrent) * 100}%`,
                        background: "#60A5FA",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-mono w-8 text-right">{s.currentAvg}</span>
                  <span className="text-[7px] font-mono text-[#9E9C97] w-12 text-right">pk: {s.peak}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
