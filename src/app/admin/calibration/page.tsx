"use client";

import { useEffect, useState } from "react";
import type { CalibrationReport, LearningAdjustment } from "@/lib/forecast-learning";
import type { Platform } from "@/lib/forecast";

interface CalibrationData {
  ok:            boolean;
  reason?:       string;
  message?:      string;
  report?:       CalibrationReport;
  suggestions?:  LearningAdjustment[];
  byPlatform?:   Array<{ platform: Platform; report: CalibrationReport }> | null;
  sampleSize?:   number;
  withOutcomes?: number;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube:       "YouTube Long-Form",
  youtube_short: "YouTube Shorts",
  tiktok:        "TikTok",
  instagram:     "Instagram Reels",
  x:             "X (Twitter)",
};

export default function CalibrationPage() {
  const [data, setData]       = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forecast/calibration")
      .then(r => r.json())
      .then((d: CalibrationData) => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  if (loading) {
    return <PageShell><div style={{ color: "#6B6964" }}>Loading calibration data…</div></PageShell>;
  }

  if (!data?.ok) {
    return (
      <PageShell>
        <div style={warningStyle}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#FF6B7A", marginBottom: 6 }}>Calibration unavailable</div>
          <div style={{ fontSize: 12.5, color: "#A8A6A1", lineHeight: 1.55 }}>
            {data?.message ?? "Unknown error loading calibration data."}
          </div>
        </div>
      </PageShell>
    );
  }

  const { report, suggestions, byPlatform, sampleSize, withOutcomes } = data;

  return (
    <PageShell>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "#E8E6E1", marginBottom: 6 }}>
          Forecast accuracy calibration
        </h1>
        <p style={{ fontSize: 13, color: "#A8A6A1", lineHeight: 1.55 }}>
          Every forecast the engine makes is stored here. As videos mature we re-scrape
          the actual view counts and compute error metrics. Auto-tuning suggestions appear
          once we have at least 20 samples per platform.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        <HeadlineMetric label="Total snapshots"   value={(sampleSize ?? 0).toLocaleString()} />
        <HeadlineMetric label="With outcomes"     value={(withOutcomes ?? 0).toLocaleString()} />
        <HeadlineMetric label="Median error"      value={report && report.sampleSize > 0 ? `${(report.medianAPE * 100).toFixed(1)}%` : "—"} color="#60A5FA" />
        <HeadlineMetric label="Interval coverage" value={report && report.sampleSize > 0 ? `${(report.coverage * 100).toFixed(0)}%` : "—"} color="#A78BFA" />
      </div>

      {suggestions && suggestions.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeading>Tuning suggestions</SectionHeading>
          <div style={{ fontSize: 12, color: "#A8A6A1", marginBottom: 12 }}>
            The engine proposes these parameter changes based on observed bias. Review and apply selectively.
          </div>
          {suggestions.map((s, i) => (
            <SuggestionCard key={`${s.platform}-${s.parameter}-${i}`} suggestion={s} />
          ))}
        </section>
      )}

      <AppliedOverrides />

      <section style={{ marginBottom: 28 }}>
        <SectionHeading>By platform</SectionHeading>
        {byPlatform && byPlatform.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {byPlatform.map(({ platform, report: r }) => (
              <PlatformCard key={platform} platform={platform} report={r} />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#6B6964", fontStyle: "italic" }}>No data yet.</div>
        )}
      </section>

      {report && report.byScoreBand && report.byScoreBand.length > 0 && report.sampleSize > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeading>Error by score band</SectionHeading>
          <div style={{ fontSize: 11, color: "#6B6964", marginBottom: 10 }}>Median absolute percentage error across score ranges. Flat is good; big swings suggest the score → multiplier curve is miscalibrated.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {report.byScoreBand.map((b, i) => (
              <BandCard key={i} label={`Score ${b.min}–${b.max}`} n={b.n} mdape={b.medianAPE} />
            ))}
          </div>
        </section>
      )}

      {report && report.byAgeBand && report.byAgeBand.length > 0 && report.sampleSize > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeading>Error by age at forecast time</SectionHeading>
          <div style={{ fontSize: 11, color: "#6B6964", marginBottom: 10 }}>How accurate we are at different stages of a post&apos;s life. Younger posts should have higher error; that&apos;s normal.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {report.byAgeBand.map((b, i) => (
              <BandCard key={i} label={ageLabel(b.min, b.max)} n={b.n} mdape={b.medianAPE} />
            ))}
          </div>
        </section>
      )}

      {report && report.worstPredictions && report.worstPredictions.length > 0 && (
        <section>
          <SectionHeading>Worst 5 predictions</SectionHeading>
          <div style={{ fontSize: 11, color: "#6B6964", marginBottom: 10 }}>For debugging. These are the snapshots where our prediction was furthest off.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.worstPredictions.map((w, i) => (
              <div key={w.id} style={worstRowStyle}>
                <div style={{ fontSize: 11, color: "#6B6964", fontFamily: "IBM Plex Mono, monospace", minWidth: 24 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#E8E6E1" }}>
                    Predicted <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#A78BFA" }}>{w.predictedMedian.toLocaleString()}</span>
                    <span style={{ color: "#6B6964" }}> → actual </span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "#2ECC8A" }}>{w.actualViews.toLocaleString()}</span>
                  </div>
                  {w.videoUrl && (
                    <a href={w.videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: "#60A5FA", fontFamily: "IBM Plex Mono, monospace" }}>
                      {w.videoUrl}
                    </a>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#FF6B7A", fontFamily: "IBM Plex Mono, monospace" }}>
                  {(w.apeError * 100).toFixed(0)}% off
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A08", color: "#E8E6E1", padding: "32px 48px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h2>
  );
}

function HeadlineMetric({ label, value, color = "#E8E6E1" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 10.5, color: "#6B6964", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color, fontFamily: "IBM Plex Mono, monospace" }}>{value}</div>
    </div>
  );
}

function PlatformCard({ platform, report }: { platform: Platform; report: CalibrationReport }) {
  const hasData = report.sampleSize > 0;
  const mdapeColor =
    !hasData            ? "#6B6964" :
    report.medianAPE < 0.20 ? "#2ECC8A" :
    report.medianAPE < 0.35 ? "#60A5FA" :
    report.medianAPE < 0.50 ? "#F59E0B" :
                              "#FF6B7A";

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#E8E6E1", marginBottom: 10 }}>{PLATFORM_LABELS[platform]}</div>
      {hasData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, fontFamily: "IBM Plex Mono, monospace" }}>
          <Row label="Samples"   value={report.sampleSize.toString()} />
          <Row label="MdAPE"     value={`${(report.medianAPE * 100).toFixed(1)}%`} valueColor={mdapeColor} />
          <Row label="Coverage"  value={`${(report.coverage * 100).toFixed(0)}%`} />
          <Row label="Direction" value={`${(report.directionCorrect * 100).toFixed(0)}%`} />
          <Row label="Bias"      value={`${report.meanSignedError > 0 ? "+" : ""}${(report.meanSignedError * 100).toFixed(0)}%`} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#6B6964", fontStyle: "italic" }}>No matured samples yet</div>
      )}
    </div>
  );
}

function BandCard({ label, n, mdape }: { label: string; n: number; mdape: number }) {
  const hasData = n > 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, color: "#6B6964", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: hasData ? "#E8E6E1" : "#6B6964", fontFamily: "IBM Plex Mono, monospace" }}>
        {hasData ? `${(mdape * 100).toFixed(0)}%` : "—"}
      </div>
      <div style={{ fontSize: 10.5, color: "#6B6964", fontFamily: "IBM Plex Mono, monospace", marginTop: 2 }}>n={n}</div>
    </div>
  );
}

function Row({ label, value, valueColor = "#E8E6E1" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6B6964" }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── STYLES / HELPERS ────────────────────────────────────────────────────

function ageLabel(min: number, max: number): string {
  if (max === Infinity)  return `${min}d+`;
  if (min === 0 && max === 1) return "0–1d";
  return `${min}–${max}d`;
}

const warningStyle: React.CSSProperties = {
  background: "rgba(255,107,122,0.06)",
  border: "1px solid rgba(255,107,122,0.25)",
  borderRadius: 10,
  padding: "16px 18px",
};

const suggestionStyle: React.CSSProperties = {
  background: "rgba(255,213,79,0.04)",
  border: "1px solid rgba(255,213,79,0.2)",
  borderLeft: "3px solid #FFD54F",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 8,
};

const worstRowStyle: React.CSSProperties = {
  background: "rgba(255,107,122,0.03)",
  border: "1px solid rgba(255,107,122,0.12)",
  borderRadius: 6,
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

// ─── SUGGESTION CARD WITH APPLY/REJECT ────────────────────────────────────

function SuggestionCard({ suggestion }: { suggestion: LearningAdjustment }) {
  const [state, setState] = useState<"pending" | "applying" | "applied" | "rejected" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleApply = async () => {
    setState("applying");
    try {
      const r = await fetch("/api/forecast/tuning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          platform:      suggestion.platform,
          parameter:     suggestion.parameter,
          originalValue: suggestion.currentValue,
          newValue:      suggestion.suggestedValue,
          deltaPercent:  suggestion.deltaPercent,
          rationale:     suggestion.rationale,
          sampleSize:    suggestion.sampleSize,
        }),
      });
      const data = await r.json();
      if (data?.ok) setState("applied");
      else { setState("error"); setErrorMsg(data?.error ?? "Unknown error"); }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error");
    }
  };

  const handleReject = () => setState("rejected");

  const stateColors = {
    pending:   "#FFD54F",
    applying:  "#60A5FA",
    applied:   "#2ECC8A",
    rejected:  "#6B6964",
    error:     "#FF6B7A",
  } as const;
  const borderColor = stateColors[state];

  return (
    <div style={{ ...suggestionStyle, borderLeftColor: borderColor, opacity: state === "rejected" ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: borderColor }}>
          {PLATFORM_LABELS[suggestion.platform]} — {suggestion.parameter}
        </div>
        <div style={{ fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>
          {suggestion.deltaPercent > 0 ? "+" : ""}{suggestion.deltaPercent}% · {suggestion.confidence} conf · n={suggestion.sampleSize}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#A8A6A1", lineHeight: 1.55, marginBottom: 10 }}>
        {suggestion.rationale}
      </div>
      {state === "pending" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleApply} style={buttonPrimaryStyle}>Apply</button>
          <button onClick={handleReject} style={buttonSecondaryStyle}>Reject</button>
        </div>
      )}
      {state === "applying" && (
        <div style={{ fontSize: 11, color: "#60A5FA", fontFamily: "IBM Plex Mono, monospace" }}>Applying…</div>
      )}
      {state === "applied" && (
        <div style={{ fontSize: 11, color: "#2ECC8A", fontFamily: "IBM Plex Mono, monospace" }}>✓ Applied. Next forecasts will use this override.</div>
      )}
      {state === "rejected" && (
        <div style={{ fontSize: 11, color: "#6B6964", fontFamily: "IBM Plex Mono, monospace", fontStyle: "italic" }}>Rejected.</div>
      )}
      {state === "error" && (
        <div style={{ fontSize: 11, color: "#FF6B7A", fontFamily: "IBM Plex Mono, monospace" }}>Error: {errorMsg}</div>
      )}
    </div>
  );
}

// ─── APPLIED OVERRIDES LIST ───────────────────────────────────────────────

interface TuningOverride {
  platform:      Platform;
  parameter:     string;
  originalValue: number;
  newValue:      number;
  deltaPercent:  number;
  appliedAt:     string;
  rationale:     string;
  sampleSize:    number;
}

function AppliedOverrides() {
  const [overrides, setOverrides] = useState<TuningOverride[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/forecast/tuning")
      .then(r => r.json())
      .then(d => {
        if (d?.ok && Array.isArray(d.overrides)) setOverrides(d.overrides);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleRevert = async (o: TuningOverride) => {
    const r = await fetch("/api/forecast/tuning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revert", platform: o.platform, parameter: o.parameter }),
    });
    const d = await r.json();
    if (d?.ok && Array.isArray(d.state?.overrides)) setOverrides(d.state.overrides);
  };

  if (!loaded) return null;
  if (overrides.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeading>Currently applied overrides</SectionHeading>
      <div style={{ fontSize: 12, color: "#A8A6A1", marginBottom: 12 }}>
        Tuning adjustments you&apos;ve approved. Active on all forecasts until reverted.
      </div>
      {overrides.map((o, i) => (
        <div key={`${o.platform}-${o.parameter}-${i}`} style={appliedOverrideStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#2ECC8A" }}>
              {PLATFORM_LABELS[o.platform]} — {o.parameter}
            </div>
            <div style={{ fontSize: 11, color: "#8A8883", fontFamily: "IBM Plex Mono, monospace" }}>
              {o.deltaPercent > 0 ? "+" : ""}{o.deltaPercent}% · applied {new Date(o.appliedAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#A8A6A1", lineHeight: 1.5, marginBottom: 8 }}>{o.rationale}</div>
          <button onClick={() => handleRevert(o)} style={buttonSecondaryStyle}>Revert</button>
        </div>
      ))}
    </section>
  );
}

const buttonPrimaryStyle: React.CSSProperties = {
  background: "rgba(255,213,79,0.15)",
  border: "1px solid rgba(255,213,79,0.5)",
  color: "#FFD54F",
  padding: "5px 14px",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const buttonSecondaryStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#A8A6A1",
  padding: "5px 14px",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const appliedOverrideStyle: React.CSSProperties = {
  background: "rgba(46,204,138,0.04)",
  border: "1px solid rgba(46,204,138,0.25)",
  borderLeft: "3px solid #2ECC8A",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 8,
};
