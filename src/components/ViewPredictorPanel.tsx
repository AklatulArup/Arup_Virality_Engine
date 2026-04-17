"use client";

import React, { useMemo, useState } from "react";
import { predictViews, type ManualAnalyticsInputs, type PredictorPlatform, type DataSourceItem } from "@/lib/view-predictor";
import type { EnrichedVideo, VideoData } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface ViewPredictorPanelProps {
  video: EnrichedVideo;
  creatorHistory: VideoData[];
  platform: PredictorPlatform;
}

export default function ViewPredictorPanel({ video, creatorHistory, platform }: ViewPredictorPanelProps) {
  const [manualInputs, setManualInputs] = useState<ManualAnalyticsInputs>({});
  const [inputsExpanded, setInputsExpanded] = useState(false);

  const forecast = useMemo(
    () => predictViews(video, creatorHistory, platform, manualInputs),
    [video, creatorHistory, platform, manualInputs],
  );

  const update = (key: keyof ManualAnalyticsInputs, raw: string) => {
    const n = raw === "" ? undefined : Number(raw);
    setManualInputs(prev => ({ ...prev, [key]: Number.isFinite(n as number) ? n : undefined }));
  };

  const conf = forecast.confidence;
  const confColor =
    conf === "high"         ? "#2ECC8A" :
    conf === "medium"       ? "#60A5FA" :
    conf === "low"          ? "#F59E0B" :
                              "#FF6B7A";

  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        background: "rgba(10,10,8,0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >

      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <div style={{ fontSize: 11, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
            View Forecast · {platform}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: "#E8E6E1" }}>Predicted reach at 1d / 7d / 30d</h3>
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
          <span style={{ color: "#6B6964" }}>Confidence:</span>
          <span style={{ color: confColor, fontWeight: 600, textTransform: "uppercase" }}>{conf}</span>
        </div>
      </div>

      {/* Insufficient history case */}
      {forecast.creatorBaseline === null && (
        <div style={{ background: "rgba(255,107,122,0.08)", border: "1px solid rgba(255,107,122,0.3)", padding: 14, borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#FF6B7A", marginBottom: 4 }}>Not enough historical data to forecast</div>
          <div style={{ fontSize: 12.5, color: "#A8A6A1", lineHeight: 1.55 }}>
            {forecast.confidenceReason} Upload at least 3 past posts from this creator, or enter a manual baseline median below.
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label style={{ fontSize: 12, color: "#9E9C97", minWidth: 160 }}>Manual baseline median:</label>
            <input
              type="number"
              placeholder="e.g. 12500"
              onChange={(e) => update("manualBaselineMedian", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Forecast cards */}
      {forecast.creatorBaseline !== null && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "24 hours", data: forecast.day1,  color: "#60A5FA" },
            { label: "7 days",   data: forecast.day7,  color: "#A78BFA" },
            { label: "30 days",  data: forecast.day30, color: "#2ECC8A" },
          ].map(({ label, data, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 11, color: "#6B6964", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color, lineHeight: 1.1, marginBottom: 3 }}>
                {formatNumber(data.median)}
              </div>
              <div style={{ fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>
                {formatNumber(data.low)} – {formatNumber(data.high)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confidence explanation */}
      {forecast.creatorBaseline !== null && (
        <div style={{ fontSize: 12, color: "#A8A6A1", lineHeight: 1.6, padding: "0 2px" }}>
          {forecast.confidenceReason}
        </div>
      )}

      {/* Baseline box */}
      {forecast.creatorBaseline && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Creator baseline anchor</div>
          <div className="grid grid-cols-4 gap-3" style={{ fontSize: 12 }}>
            <div>
              <div style={{ color: "#6B6964", marginBottom: 2 }}>Past posts</div>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>{forecast.creatorBaseline.postCount}</div>
            </div>
            <div>
              <div style={{ color: "#6B6964", marginBottom: 2 }}>Median</div>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>{formatNumber(forecast.creatorBaseline.median)}</div>
            </div>
            <div>
              <div style={{ color: "#6B6964", marginBottom: 2 }}>p25 – p75</div>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>{formatNumber(forecast.creatorBaseline.p25)} – {formatNumber(forecast.creatorBaseline.p75)}</div>
            </div>
            <div>
              <div style={{ color: "#6B6964", marginBottom: 2 }}>Consistency (CV)</div>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>{forecast.creatorBaseline.coefficientOfVariation.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Data transparency — three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DataSection
          title={`Used (${forecast.dataUsed.length})`}
          items={forecast.dataUsed}
          color="#2ECC8A"
        />
        <DataSection
          title={`Estimated (${forecast.dataEstimated.length})`}
          items={forecast.dataEstimated}
          color="#F59E0B"
        />
        <DataSection
          title={`Missing (${forecast.dataMissing.length})`}
          items={forecast.dataMissing}
          color="#FF6B7A"
        />
      </div>

      {/* Manual inputs expander */}
      {forecast.dataMissing.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          <button
            onClick={() => setInputsExpanded(v => !v)}
            style={{
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.25)",
              color: "#60A5FA",
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            {inputsExpanded ? "▾" : "▸"}  Provide creator analytics data to tighten the forecast
          </button>

          {inputsExpanded && (
            <div style={{ marginTop: 14 }} className="space-y-3">
              <InputHelp>These fields are not available via any public API. Pull them from the creator's own analytics dashboard. The forecast recalculates as you type.</InputHelp>

              {platform === "tiktok" && (
                <>
                  <InputRow label="Completion rate %"  hint="TikTok Creator Studio → Analytics → content"
                    onChange={(v) => update("ttCompletionPct", v)} suffix="%" />
                  <InputRow label="Rewatch rate %"     hint="TikTok Creator Studio → Analytics → content"
                    onChange={(v) => update("ttRewatchPct", v)} suffix="%" />
                  <InputRow label="FYP traffic share %" hint="Creator Studio → Traffic Source"
                    onChange={(v) => update("ttFypViewPct", v)} suffix="%" />
                </>
              )}

              {platform === "instagram" && (
                <>
                  <InputRow label="Saves"              hint="Instagram Insights → This post → Interactions"
                    onChange={(v) => update("igSaves", v)} />
                  <InputRow label="DM sends"           hint="Instagram Insights — Mosseri's #1 signal for non-follower reach"
                    onChange={(v) => update("igSends", v)} />
                  <InputRow label="Reach"              hint="Instagram Insights → unique accounts reached"
                    onChange={(v) => update("igReach", v)} />
                  <InputRow label="3-second hold %"    hint="Instagram Insights → audience retention (if available)"
                    onChange={(v) => update("igHold3s", v)} suffix="%" />
                </>
              )}

              {(platform === "youtube" || platform === "youtube_short") && (
                <>
                  <InputRow label="Average view duration %" hint="YouTube Studio → Analytics → AVD as % of length"
                    onChange={(v) => update("ytAVDpct", v)} suffix="%" />
                  <InputRow label="Click-through rate %"    hint="YouTube Studio → Analytics → Impressions → CTR"
                    onChange={(v) => update("ytCTRpct", v)} suffix="%" />
                  <InputRow label="Impressions"              hint="YouTube Studio → Reach → Impressions"
                    onChange={(v) => update("ytImpressions", v)} />
                </>
              )}

              {platform === "x" && (
                <>
                  <InputRow label="TweepCred score"  hint="Visible to Premium users; below 65 hard-throttles distribution"
                    onChange={(v) => update("xTweepCred", v)} />
                  <InputRow label="Replies engaged by author" hint="Count of replies the author responded to (unlocks +75 signal)"
                    onChange={(v) => update("xReplyByAuthor", v)} />
                </>
              )}

              <InputRow label="Override baseline median" hint="Skip computed baseline and use a specific number"
                onChange={(v) => update("manualBaselineMedian", v)} />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {forecast.notes.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Computation notes</div>
          <ul className="space-y-1" style={{ listStyle: "none", padding: 0 }}>
            {forecast.notes.map((n, i) => (
              <li key={i} style={{ fontSize: 11.5, color: "#8A8883", lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#6B6964" }}>·</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DataSection({ title, items, color }: { title: string; items: DataSourceItem[]; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, minHeight: 120 }}>
      <div style={{ fontSize: 10, color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "#5E5C58", fontStyle: "italic" }}>None</div>
      ) : (
        <ul className="space-y-1.5" style={{ listStyle: "none", padding: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 11, lineHeight: 1.5 }}>
              <div style={{ color: "#E8E6E1", fontWeight: 500 }}>
                {item.label}
                {item.value !== undefined && (
                  <span style={{ color: "#8A8883", marginLeft: 6, fontFamily: "IBM Plex Mono, monospace" }}>
                    {typeof item.value === "number" ? formatNumber(item.value) : item.value}
                  </span>
                )}
              </div>
              {item.note && (
                <div style={{ color: "#6B6964", marginTop: 2, lineHeight: 1.5 }}>{item.note}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InputRow({ label, hint, onChange, suffix }: { label: string; hint: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div style={{ padding: "6px 0" }}>
      <div className="flex items-center gap-3">
        <label style={{ fontSize: 12, color: "#E8E6E1", minWidth: 180, flexShrink: 0 }}>{label}</label>
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            step="any"
            placeholder="—"
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
          {suffix && <span style={{ fontSize: 11, color: "#6B6964" }}>{suffix}</span>}
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "#6B6964", marginLeft: 192, marginTop: 3, lineHeight: 1.45 }}>{hint}</div>
    </div>
  );
}

function InputHelp({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, color: "#8A8883", fontStyle: "italic", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  padding: "5px 9px",
  fontSize: 12,
  color: "#E8E6E1",
  fontFamily: "IBM Plex Mono, monospace",
  outline: "none",
  maxWidth: 140,
};
