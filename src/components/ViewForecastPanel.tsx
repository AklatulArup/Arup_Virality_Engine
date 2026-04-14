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
  const [showConfidence, setShowConfidence] = useState(false);
  const [showKMath, setShowKMath] = useState(false);

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
              background: "rgba(139,92,246,0.12)",
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
              <button
                onClick={() => setShowConfidence(v => !v)}
                className="font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: confidenceColor[forecast.confidence] }}
              >
                {forecast.confidence} ({forecast.confidencePoints}/100)
              </button>
            </div>

            {/* ── Confidence breakdown ── */}
            {showConfidence && (
              <div
                className="mb-4 rounded-2xl p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(16px)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#86868b" }}>Why is confidence <span style={{ color: confidenceColor[forecast.confidence] }}>{forecast.confidence}</span>?</span>
                  <span className="text-[11px] font-mono" style={{ color: confidenceColor[forecast.confidence] }}>{forecast.confidencePoints} / 100 pts</span>
                </div>

                {/* Score bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${forecast.confidencePoints}%`,
                      background: `linear-gradient(90deg, ${confidenceColor[forecast.confidence]}, ${confidenceColor[forecast.confidence]}aa)`,
                    }}
                  />
                </div>

                {/* Factor rows */}
                <div className="space-y-2.5 pt-1">
                  {forecast.confidenceFactors.map((f) => (
                    <div key={f.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium" style={{ color: "#f5f5f7" }}>{f.label}</span>
                        <span className="text-[11px] font-mono" style={{ color: f.earned >= f.max * 0.7 ? "#30D158" : f.earned >= f.max * 0.4 ? "#FFD60A" : "#FF453A" }}>
                          {f.earned} / {f.max}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(f.earned / f.max) * 100}%`,
                            background: f.earned >= f.max * 0.7 ? "#30D158" : f.earned >= f.max * 0.4 ? "#FFD60A" : "#FF453A",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                      <p className="text-[10px]" style={{ color: "#86868b" }}>{f.tip}</p>
                    </div>
                  ))}
                </div>

                {/* How to improve */}
                <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#86868b" }}>How to raise confidence</div>
                  <ul className="space-y-1">
                    {forecast.confidencePoints < 70 && (
                      <>
                        {forecast.confidenceFactors.find(f => f.label === "Days of data" && f.earned < 28) && (
                          <li className="text-[11px]" style={{ color: "#f5f5f7" }}>⏳ Wait — confidence auto-increases as more days of data accumulate (full curve needs 14d+)</li>
                        )}
                        {forecast.confidenceFactors.find(f => f.label === "View volume" && f.earned < 14) && (
                          <li className="text-[11px]" style={{ color: "#f5f5f7" }}>📈 Promote the video to drive more views — models stabilise above 10K views</li>
                        )}
                        {forecast.confidenceFactors.find(f => f.label === "Engagement quality" && f.earned < 12) && (
                          <li className="text-[11px]" style={{ color: "#f5f5f7" }}>💬 Drive comments and likes via CTAs — engagement above 2% significantly improves accuracy</li>
                        )}
                        {forecast.confidenceFactors.find(f => f.label === "Platform score fit" && f.earned < 12) && (
                          <li className="text-[11px]" style={{ color: "#f5f5f7" }}>🎯 Add more reference videos to the pool — a richer pool calibrates the platform model to your niche</li>
                        )}
                      </>
                    )}
                    {forecast.confidencePoints >= 70 && (
                      <li className="text-[11px]" style={{ color: "#30D158" }}>✓ Confidence is high — projections are well-calibrated to this video&apos;s performance pattern</li>
                    )}
                  </ul>
                </div>
              </div>
            )}


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
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.10)" }}>
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
          {(() => {
            const K = forecast.coefficient.K;
            const i = forecast.coefficient.shares;
            const c = forecast.coefficient.conversion;
            return (
              <div
                className="mx-6 mb-5 rounded-2xl overflow-hidden"
                style={{
                  background: `color-mix(in srgb, ${forecast.coefficient.color} 6%, rgba(255,255,255,0.03))`,
                  border: `1px solid color-mix(in srgb, ${forecast.coefficient.color} 22%, transparent)`,
                  backdropFilter: "blur(16px)",
                }}
              >
                {/* Header row */}
                <button
                  onClick={() => setShowKMath(v => !v)}
                  className="w-full px-4 pt-4 pb-3 flex items-start justify-between gap-4 flex-wrap text-left"
                >
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "#86868b" }}>
                      VIRALITY COEFFICIENT
                    </div>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-[32px] font-bold font-mono leading-none" style={{ color: forecast.coefficient.color }}>
                        K = {K}
                      </span>
                      <div>
                        <div className="text-[11px] font-mono" style={{ color: "#86868b" }}>
                          {K >= 1.5 ? "≥1.5 exponential viral" : K >= 1 ? "≥1 self-spreading" : K >= 0.7 ? "0.7–1 contained steady" : "<0.7 declining"}
                        </div>
                        <div className="text-[12px] font-semibold mt-0.5" style={{ color: forecast.coefficient.color }}>
                          {forecast.coefficient.verdict}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] mb-1" style={{ color: "#86868b" }}>
                      i = <span className="font-mono" style={{ color: "#f5f5f7" }}>{i}</span> shares/1K views
                    </div>
                    <div className="text-[10px] mb-2" style={{ color: "#86868b" }}>
                      c = <span className="font-mono" style={{ color: "#f5f5f7" }}>{c}%</span> share→view conv.
                    </div>
                    <span className="text-[10px]" style={{ color: "#86868b" }}>{showKMath ? "▲ hide math" : "▼ full math"}</span>
                  </div>
                </button>

                {/* Expandable full math */}
                {showKMath && (
                  <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>

                    {/* Formula definition */}
                    <div className="pt-3">
                      <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#86868b" }}>THE FORMULA</div>
                      <div
                        className="rounded-xl px-4 py-3 font-mono text-[13px] text-center"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#f5f5f7" }}
                      >
                        K = i × c × 10 + platformScore × 0.5
                      </div>
                      <div className="mt-2 text-[11px] space-y-1" style={{ color: "#86868b" }}>
                        <div><span style={{ color: "#f5f5f7" }}>K</span> — Viral coefficient. &gt;1 = each view generates more than 1 new view (exponential). &lt;1 = shrinking reach.</div>
                        <div><span style={{ color: "#f5f5f7" }}>i</span> — Infectiousness: estimated shares per 1,000 views. Derived from like rate × share proxy.</div>
                        <div><span style={{ color: "#f5f5f7" }}>c</span> — Conversion: what % of people who see a share actually watch. Derived from platform score × baseline performance.</div>
                      </div>
                    </div>

                    {/* Step-by-step with actual values */}
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#86868b" }}>STEP-BY-STEP WITH YOUR NUMBERS</div>
                      <div className="space-y-2">
                        {[
                          {
                            step: "1",
                            label: "Like Rate",
                            formula: `likes ÷ views = ${video.likes.toLocaleString()} ÷ ${video.views.toLocaleString()}`,
                            result: `${((video.likes / Math.max(1, video.views)) * 100).toFixed(3)}%`,
                            explain: "What fraction of viewers click Like. Proxy for content satisfaction and share intent.",
                          },
                          {
                            step: "2",
                            label: "Share Proxy (i)",
                            formula: `(likeRate × 0.15) + (engRate × 0.05) = infectiousness per view`,
                            result: `${(((video.likes / Math.max(1, video.views)) * 0.15 + (video.engagement / 100) * 0.05) * 1000).toFixed(1)} shares/1K`,
                            explain: "Empirical: roughly 15% of likers share. Added 5% of engagement rate as a DM/send proxy.",
                          },
                          {
                            step: "3",
                            label: "Conversion (c)",
                            formula: `platformScore × (vsBaseline ÷ 3), capped at 1`,
                            result: `${c}%`,
                            explain: "How many people who see a shared link actually watch. Higher platform score = content that hooks cold audiences.",
                          },
                          {
                            step: "4",
                            label: "K Score",
                            formula: `(shareProxy × c × 10) + (platformScore × 0.5)`,
                            result: `K = ${K}`,
                            explain: K >= 1 ? "K ≥ 1: Every 1,000 views spawn more than 1,000 new views through sharing. Self-sustaining growth loop." : "K < 1: Shares are not generating enough new viewers to replace the source audience. Growth relies entirely on algorithm push.",
                          },
                        ].map(({ step, label, formula, result, explain }) => (
                          <div
                            key={step}
                            className="rounded-xl p-3"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                          >
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                  style={{ background: `color-mix(in srgb, ${forecast.coefficient.color} 20%, transparent)`, color: forecast.coefficient.color }}
                                >{step}</span>
                                <span className="text-[11px] font-semibold" style={{ color: "#f5f5f7" }}>{label}</span>
                              </div>
                              <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: forecast.coefficient.color }}>{result}</span>
                            </div>
                            <div className="text-[10px] font-mono ml-7 mb-1" style={{ color: "rgba(232,232,255,0.45)" }}>{formula}</div>
                            <div className="text-[10px] ml-7" style={{ color: "#86868b" }}>{explain}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Decision + what to do */}
                    <div
                      className="rounded-xl p-3.5"
                      style={{ background: `color-mix(in srgb, ${forecast.coefficient.color} 8%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${forecast.coefficient.color} 25%, transparent)` }}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#86868b" }}>DECISION & REASONING</div>
                      <div className="text-[11px] font-semibold mb-1" style={{ color: forecast.coefficient.color }}>{forecast.coefficient.verdict}</div>
                      <div className="text-[11px]" style={{ color: "#f5f5f7" }}>
                        {K >= 1.5 && "This content is in exponential growth. The sharing loop is self-sustaining — each view generates more than 1.5 new views through organic distribution. Publish a follow-up immediately to capture the momentum. Double down on the exact hook and format."}
                        {K >= 1 && K < 1.5 && "The algorithm is actively amplifying this content. Shares are converting to new viewers faster than the audience decays. Engage every comment to signal continued traction. Consider pinning the best comment to boost DMs."}
                        {K >= 0.7 && K < 1 && "Content is holding steady but not breaking out. The sharing loop exists but closes below 1 — each 1,000 views generates fewer than 1,000 new views from shares. Growth is sustained by algorithmic push alone. Optimise the thumbnail and title to improve CTR and trigger a second distribution wave."}
                        {K < 0.7 && "Organic spread is minimal. Fewer than 0.7 new views are generated per view through sharing — the content is not being passed along. The hook or topic may not be share-worthy for this audience. Analyse what the top 3 performers in the reference pool did differently at their hook (first 3 seconds)."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                  style={{ background: "rgba(139,92,246,0.07)", color: "#86868b" }}
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
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.10)" }}>
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
                  <div className="flex-1 relative h-6 rounded-lg overflow-hidden" style={{ background: "rgba(139,92,246,0.07)" }}>
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
                    style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)", color: "#f5f5f7" }}
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
