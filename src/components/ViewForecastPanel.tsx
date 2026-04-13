"use client";

import { useMemo, useState } from "react";
import { forecastViews } from "@/lib/view-forecast";
import { formatNumber } from "@/lib/formatters";
import type { EnrichedVideo } from "@/lib/types";

interface ViewForecastPanelProps {
  video: EnrichedVideo;
  forecastDate: string;
  onDateChange: (date: string) => void;
}

export default function ViewForecastPanel({ video, forecastDate, onDateChange }: ViewForecastPanelProps) {
  const [showSignals, setShowSignals] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const forecast = useMemo(() => {
    if (!forecastDate) return null;
    const target = new Date(forecastDate + "T12:00:00");
    if (isNaN(target.getTime())) return null;
    return forecastViews(video, target);
  }, [video, forecastDate]);

  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 730 * 86400000).toISOString().split("T")[0];

  const confidenceColor = { high: "#30D158", medium: "#FFD60A", low: "#FF453A" };

  // Bar chart max for monthly projections
  const barMax = forecast ? Math.max(...forecast.monthlyProjections.map(m => m.high)) : 1;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(18,18,18,0.95)" }}
    >
      {/* ── Header ── */}
      <div
        className="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight" style={{ color: "#f5f5f7" }}>
              View Count Forecast
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: "#86868b" }}>
              {forecast?.platformLabel ?? "Select a future date to predict views"} · {forecast ? `${forecast.daysSincePublish}d of data` : "waiting for date"}
            </p>
          </div>
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-2.5">
          <label className="text-[11px] font-medium" style={{ color: "#86868b" }}>
            Target date
          </label>
          <input
            type="date"
            value={forecastDate}
            min={today}
            max={maxDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-xl px-3 py-2 text-[13px] font-mono outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#f5f5f7",
              colorScheme: "dark",
            }}
          />
        </div>
      </div>

      {/* ── No date selected state ── */}
      {!forecast && (
        <div className="px-6 py-12 text-center" style={{ color: "#86868b" }}>
          <div className="text-3xl mb-3" style={{ opacity: 0.3 }}>📅</div>
          <div className="text-[14px] font-medium mb-1" style={{ color: "#f5f5f7" }}>Pick a target date above</div>
          <div className="text-[12px]">The model will predict where this video's views will be on that date</div>
        </div>
      )}

      {forecast && (
        <>
          {/* ── Main prediction bar ── */}
          <div className="px-6 py-5">
            {/* Context line */}
            <div className="text-[11px] mb-4" style={{ color: "#86868b" }}>
              Day <span className="font-mono" style={{ color: "#f5f5f7" }}>{forecast.daysToTarget}</span> after publish
              {forecast.daysToTarget > forecast.daysSincePublish && (
                <> · <span style={{ color: "var(--color-accent)" }}>
                  +{forecast.daysToTarget - forecast.daysSincePublish} days from today
                </span></>
              )}
              {" · "}Confidence:{" "}
              <span style={{ color: confidenceColor[forecast.confidence] }} className="font-medium">
                {forecast.confidence}
              </span>
            </div>

            {/* Low / Expected / High cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "LOW", value: forecast.low, color: "#86868b", dim: true },
                { label: "EXPECTED", value: forecast.mid, color: "var(--color-accent)", dim: false },
                { label: "HIGH", value: forecast.high, color: "#FFD60A", dim: false },
              ].map(({ label, value, color, dim }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4 text-center"
                  style={{
                    background: dim ? "rgba(255,255,255,0.03)" : `color-mix(in srgb, ${color} 8%, rgba(255,255,255,0.04))`,
                    border: `1px solid ${dim ? "rgba(255,255,255,0.06)" : `color-mix(in srgb, ${color} 20%, transparent)`}`,
                  }}
                >
                  <div className="text-[9px] font-mono font-bold tracking-widest mb-2" style={{ color: "#86868b" }}>
                    {label}
                  </div>
                  <div className="text-[26px] font-bold tracking-tight leading-none" style={{ color }}>
                    {formatNumber(value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Gradient range bar */}
            <div className="relative mb-2">
              <div
                className="h-2 rounded-full"
                style={{ background: "linear-gradient(90deg, #FF453A 0%, #FFD60A 40%, #30D158 70%, #00D4AA 100%)" }}
              />
              {/* Marker for expected */}
              {forecast.high > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-black"
                  style={{
                    left: `${Math.min(95, (forecast.mid / forecast.high) * 85 + 5)}%`,
                    background: "var(--color-accent)",
                    boxShadow: "0 0 8px rgba(0,212,170,0.6)",
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-[9px] font-mono mb-4" style={{ color: "#86868b" }}>
              <span>0</span>
              <span style={{ color: "var(--color-accent)" }}>{formatNumber(forecast.mid)} expected</span>
              <span>{formatNumber(forecast.high)}</span>
            </div>

            {/* Current progress */}
            <div className="flex justify-between text-[10px] mb-1" style={{ color: "#86868b" }}>
              <span>Current — {formatNumber(video.views)}</span>
              <span>{forecast.mid > 0 ? Math.round((video.views / forecast.mid) * 100) : 0}% of expected</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (video.views / forecast.mid) * 100)}%`,
                  background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-blue))",
                }}
              />
            </div>
          </div>

          {/* ── Virality Coefficient ── */}
          <div
            className="mx-6 mb-5 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: `color-mix(in srgb, ${forecast.coefficient.color} 6%, rgba(255,255,255,0.03))`,
              border: `1px solid color-mix(in srgb, ${forecast.coefficient.color} 20%, transparent)`,
            }}
          >
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest mb-1" style={{ color: "#86868b" }}>
                Virality Coefficient — K = i × c
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold font-mono" style={{ color: forecast.coefficient.color }}>
                  K = {forecast.coefficient.K}
                </span>
                <span className="text-[11px]" style={{ color: "#86868b" }}>
                  {forecast.coefficient.K >= 1 ? "≥1 exponential" : "<1 contained"}
                </span>
              </div>
              <div className="text-[12px] mt-1 font-medium" style={{ color: forecast.coefficient.color }}>
                {forecast.coefficient.verdict}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[10px]" style={{ color: "#86868b" }}>
                Shares / 1K views: <span className="font-mono" style={{ color: "#f5f5f7" }}>{forecast.coefficient.shares}</span>
              </div>
              <div className="text-[10px]" style={{ color: "#86868b" }}>
                Share conversion: <span className="font-mono" style={{ color: "#f5f5f7" }}>{forecast.coefficient.conversion}%</span>
              </div>
            </div>
          </div>

          {/* ── Platform score breakdown ── */}
          <div className="mx-6 mb-5">
            <button
              onClick={() => setShowFormula(v => !v)}
              className="w-full flex items-center justify-between text-left mb-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "#f5f5f7" }}>
                  {forecast.platformScore.platform === "youtube" ? "YouTube Long-form" :
                   forecast.platformScore.platform === "youtube_short" ? "YouTube Shorts" :
                   forecast.platformScore.platform === "tiktok" ? "TikTok" : "Instagram Reels"} Algorithm Score
                </span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(0,212,170,0.12)",
                    color: "var(--color-accent)",
                    border: "1px solid rgba(0,212,170,0.2)",
                  }}
                >
                  {(forecast.platformScore.score * 100).toFixed(0)}%
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "#86868b" }}>{showFormula ? "▲ hide" : "▼ show"}</span>
            </button>

            {showFormula && (
              <div className="space-y-2.5">
                <div
                  className="rounded-xl px-3 py-2 text-[10px] font-mono"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#86868b" }}
                >
                  {forecast.platformScore.formula}
                </div>
                {forecast.platformScore.signals.map((sig) => (
                  <div key={sig.label} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span style={{ color: "#f5f5f7" }}>{sig.label}</span>
                      <span className="font-mono" style={{ color: "#86868b" }}>
                        w:{(sig.weight * 100).toFixed(0)}% · {(sig.value * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${sig.value * 100}%`,
                          background: sig.value >= 0.7 ? "#30D158" : sig.value >= 0.4 ? "#FFD60A" : "#FF453A",
                        }}
                      />
                    </div>
                    <div className="text-[9px]" style={{ color: "#86868b" }}>{sig.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 6-month projection chart ── */}
          <div className="mx-6 mb-5">
            <div className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: "#86868b" }}>
              6-Month View Projection
            </div>
            <div className="space-y-1.5">
              {forecast.monthlyProjections.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono w-14 shrink-0" style={{ color: "#86868b" }}>
                    Month {m.month}
                  </span>
                  <div className="flex-1 relative h-6 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {/* High bar */}
                    <div
                      className="absolute top-0 h-full rounded-lg"
                      style={{
                        left: 0,
                        width: `${(m.high / barMax) * 100}%`,
                        background: "rgba(0,183,100,0.25)",
                      }}
                    />
                    {/* Mid bar */}
                    <div
                      className="absolute top-0 h-full rounded-lg"
                      style={{
                        left: 0,
                        width: `${(m.mid / barMax) * 100}%`,
                        background: "rgba(0,212,170,0.5)",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[9px] font-mono font-bold" style={{ color: "#f5f5f7" }}>
                        {formatNumber(m.mid)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono w-12 text-right shrink-0" style={{ color: "#86868b" }}>
                    {formatNumber(m.high)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: "rgba(0,212,170,0.5)" }} />
                <span className="text-[9px]" style={{ color: "#86868b" }}>Average trajectory</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: "rgba(0,183,100,0.25)" }} />
                <span className="text-[9px]" style={{ color: "#86868b" }}>Highest possible</span>
              </div>
            </div>
          </div>

          {/* ── Replication signals ── */}
          <div className="mx-6 mb-5">
            <button
              onClick={() => setShowSignals(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-[12px] font-semibold" style={{ color: "#f5f5f7" }}>
                How to replicate this performance
              </span>
              <span className="text-[10px]" style={{ color: "#86868b" }}>{showSignals ? "▲ hide" : "▼ show"}</span>
            </button>
            {showSignals && (
              <div className="mt-3 space-y-2">
                {forecast.replicationSignals.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#f5f5f7" }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
