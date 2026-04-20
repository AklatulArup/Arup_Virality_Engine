"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PAGE — V5 data-dense two-column, live-refreshing pool coverage
// ═══════════════════════════════════════════════════════════════════════════
//
// Main column: redesigned Pool Coverage panel (header with live total +
// last-ingested timestamp, three coverage bars, platform table sorted by
// count) + Live Signal Feed. Right rail: total reach, per-platform bars,
// next milestone, learning loop stats, last ingestions.
//
// Data comes from `/api/reference-store` and flows through `computePoolStats`
// (src/lib/pool-stats.ts) — the same bucketer the Sidebar uses, so the two
// surfaces are guaranteed to agree.

import React, { useEffect, useMemo, useState } from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import { computePoolStats, type MinimalEntry, type PlatformRow } from "@/lib/pool-stats";
import type { Platform } from "@/lib/forecast";
import { fmtCompact } from "@/lib/number-format";
import {
  PoolCoveragePanel,
  V5SectionHeader,
  fmtAgo,
} from "./PoolCoveragePanel";

export default function LandingPage() {
  const [entries, setEntries] = useState<MinimalEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      fetch("/api/reference-store")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const arr: MinimalEntry[] = Array.isArray(d?.entries) ? d.entries : Array.isArray(d) ? d : [];
          setEntries(arr);
        })
        .catch(() => {});
    };
    refresh();
    // Live refresh: legacy Dashboard fires ve:pool-updated after every
    // successful analyze / bulk import / reference-store POST.
    window.addEventListener("ve:pool-updated", refresh);
    return () => window.removeEventListener("ve:pool-updated", refresh);
  }, []);

  const stats = useMemo(() => computePoolStats(entries), [entries]);

  const signals = useMemo(() => {
    const hasEntries = entries.length > 0;
    const vrs = entries.map(e => Number(e.metrics?.vrsScore ?? 0)).filter(v => v > 0);
    const avgVRS = vrs.length > 0 ? vrs.reduce((s, v) => s + v, 0) / vrs.length : 0;
    const eng = entries.map(e => Number(e.metrics?.engagement ?? 0)).filter(v => v > 0);
    const avgEng = eng.length > 0 ? eng.reduce((s, v) => s + v, 0) / eng.length : 0;
    const highVRS = entries.filter(e => Number(e.metrics?.vrsScore ?? 0) >= 80).length;
    const totalViews = entries.reduce((s, e) => s + Number(e.metrics?.views ?? 0), 0);
    return [
      { label: "Pool depth",              value: `${fmtCompact(stats.totalEntries)} items`,                                      color: T.red,    active: hasEntries },
      { label: "Unique creators",         value: `${fmtCompact(stats.totalCreators)}`,                                            color: T.red,    active: stats.totalCreators > 0 },
      { label: "Total reach",             value: totalViews > 0 ? `${fmtCompact(totalViews)} views` : "—",                       color: T.purple, active: totalViews > 0 },
      { label: "Avg VRS",                 value: avgVRS > 0 ? `${avgVRS.toFixed(0)}/100` : "—",                                  color: T.amber,  active: avgVRS >= 60 },
      { label: "Avg engagement",          value: avgEng > 0 ? `${avgEng.toFixed(1)}%` : "—",                                     color: T.amber,  active: avgEng > 0 },
      { label: "High-VRS content (≥80)",  value: `${highVRS} videos`,                                                             color: T.green,  active: highVRS > 0 },
    ];
  }, [entries, stats]);

  // 5 most recent ingestions for the right-rail feed.
  const recent = useMemo(() => {
    return [...entries]
      .filter(e => typeof e.analyzedAt === "string")
      .sort((a, b) => (b.analyzedAt ?? "").localeCompare(a.analyzedAt ?? ""))
      .slice(0, 5);
  }, [entries]);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 320px",
      height: "100%", color: T.ink, fontFamily: "IBM Plex Sans, sans-serif",
    }}>
      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 22, borderRight: `1px solid ${T.line}`, overflowY: "auto" }}>
        <PoolCoveragePanel stats={stats} />
        <LearningAccuracy />
        <LiveSignalFeed signals={signals} />
      </main>

      {/* ── RIGHT RAIL ──────────────────────────────────────────── */}
      <aside style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 22, background: T.bgDeep, overflowY: "auto" }}>
        <RailTotal entries={entries} stats={stats} />
        <RailPlatformBars rows={stats.rows} />
        <RailNextMilestone stats={stats} />
        <RailRecentIngestions recent={recent} />
        <RailLearningLoop />
      </aside>
    </div>
  );
}

// The PoolCoverage panel + its atoms live in `./PoolCoveragePanel.tsx` and
// are imported at the top of this file. One renderer for Landing + Dashboard.

// ─── LIVE SIGNAL FEED (main, below pool coverage) ──────────────────────

function LiveSignalFeed({ signals }: { signals: Array<{ label: string; value: string; color: string; active: boolean }> }) {
  return (
    <div>
      <V5SectionHeader>Live signal feed</V5SectionHeader>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 4 }}>
        {signals.map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center",
              padding: "10px 14px",
              borderBottom: i < signals.length - 1 ? `1px solid ${T.line}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: s.color, opacity: s.active ? 1 : 0.3, flexShrink: 0 }} />
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: T.inkDim }}>{s.label}</span>
            </div>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: s.active ? s.color : T.inkFaint }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEARNING ACCURACY PANEL ──────────────────────────────────────────
//
// Shows the real measured accuracy (MdAPE, 80% coverage, direction-correct)
// per platform from the forecast-learning loop. Reads /api/forecast/calibration
// which aggregates every persisted ForecastSnapshot whose outcome has
// matured (the collect-outcomes cron re-scrapes the video at the platform's
// maturity window and writes back the actual view count).
//
// When the per-platform sample size is below 20 the report is untrustworthy,
// so we surface a "warming up · awaiting N more outcomes" state instead of
// a meaningless MdAPE number. That honesty matters — showing "MdAPE 3%" on
// n=2 would be a lie.

const MIN_SAMPLE = 20;
// Per-platform maturity windows (days) used by the collect-outcomes cron.
const MATURITY_DAYS: Record<string, number> = {
  youtube:       90,
  youtube_short: 60,
  tiktok:        30,
  instagram:     35,
  x:              3,
};

interface CalibrationReportLite {
  platform:        string;
  sampleSize:      number;
  medianAPE:       number;
  coverage:        number;
  directionCorrect:number;
  meanSignedError: number;
}

interface CalibrationAPI {
  ok: boolean;
  byPlatform?: Array<{ platform: string; report: CalibrationReportLite }>;
  withOutcomes?: number;
  sampleSize?:   number;
  reason?:       string;
}

function LearningAccuracy() {
  const [data,    setData]    = useState<CalibrationAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      fetch("/api/forecast/calibration")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (cancelled) return;
          if (!d) { setErr("fetch_failed"); setLoading(false); return; }
          setData(d as CalibrationAPI);
          setErr(null);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setErr("network_error");
          setLoading(false);
        });
    };
    load();
    // Refresh whenever the pool updates (new analyses can mean new outcomes
    // if any of the just-analyzed videos crossed the maturity window).
    window.addEventListener("ve:pool-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("ve:pool-updated", load);
    };
  }, []);

  const rows = useMemo(() => {
    const byPlatform = data?.byPlatform ?? [];
    // Maintain a stable platform order matching the rest of the UI.
    const order: Platform[] = ["youtube", "youtube_short", "tiktok", "instagram", "x"];
    return order.map(p => {
      const found = byPlatform.find(b => b.platform === p);
      return { platform: p, report: found?.report };
    });
  }, [data]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <V5SectionHeader>Learning accuracy · per platform</V5SectionHeader>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99,
            background: (data?.withOutcomes ?? 0) > 0 ? T.green : T.amber,
            boxShadow: `0 0 8px ${(data?.withOutcomes ?? 0) > 0 ? T.green : T.amber}`,
          }} />
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkDim, letterSpacing: 1 }}>
            {loading ? "LOADING"
              : err   ? "OFFLINE"
              : (data?.withOutcomes ?? 0) === 0 ? "WARMING UP"
              : `${data?.withOutcomes} MATURED`}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.inkMuted, lineHeight: 1.55, marginBottom: 14 }}>
        Measured median % error of past forecasts where the actual view count has matured. Until
        each platform crosses <span style={{ fontFamily: "IBM Plex Mono, monospace", color: T.ink }}>{MIN_SAMPLE}</span> matured outcomes the
        reading is shown as &ldquo;warming up&rdquo; — we don&apos;t report a MdAPE we can&apos;t trust.
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "140px 80px 80px 80px 1fr 120px",
          columnGap: 14,
          padding: "9px 14px",
          background: T.bgRow,
          borderBottom: `1px solid ${T.line}`,
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 9.5,
          color: T.inkFaint,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          <div>Platform</div>
          <div style={{ textAlign: "right" }}>MdAPE</div>
          <div style={{ textAlign: "right" }}>80% cov.</div>
          <div style={{ textAlign: "right" }}>Direction</div>
          <div>Confidence</div>
          <div style={{ textAlign: "right" }}>Status</div>
        </div>
        {rows.map((row, i) => (
          <AccuracyRow
            key={row.platform}
            platform={row.platform}
            report={row.report}
            last={i === rows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function AccuracyRow({
  platform,
  report,
  last,
}: {
  platform: Platform;
  report:   CalibrationReportLite | undefined;
  last:     boolean;
}) {
  const pl = PLATFORMS[platform];
  const n  = report?.sampleSize ?? 0;
  const matured       = n >= MIN_SAMPLE;
  const mdapePct      = report ? report.medianAPE * 100 : 0;
  const coveragePct   = report ? report.coverage * 100  : 0;
  const directionPct  = report ? report.directionCorrect * 100 : 0;

  // MdAPE color bands — tighter = greener.
  const mdapeColor =
    !matured        ? T.inkFaint :
    mdapePct <= 15  ? T.green    :
    mdapePct <= 25  ? T.blue     :
    mdapePct <= 40  ? T.amber    :
                      T.red;

  // Confidence readout: either a realistic % based on MdAPE, or an "awaiting"
  // countdown telling the RM how many more outcomes + how long.
  let confidenceBar: React.ReactNode;
  if (matured) {
    // Convert MdAPE → rough "confidence %" (100 - mdape, floored at 0, with
    // a coverage penalty if the interval doesn't hit its 80% target).
    const coverageGap = Math.max(0, 80 - coveragePct); // 0 if ≥ 80
    const confidence  = Math.max(0, Math.min(100, 100 - mdapePct - coverageGap * 0.5));
    const fillColor   = confidence >= 75 ? T.green : confidence >= 55 ? T.blue : confidence >= 35 ? T.amber : T.red;
    confidenceBar = (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: T.line, borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            width: `${confidence}%`, height: "100%",
            background: `linear-gradient(90deg, ${fillColor}66, ${fillColor})`,
            boxShadow: `0 0 6px ${fillColor}66`,
            transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
          }} />
        </div>
        <span style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5,
          color: fillColor, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right",
        }}>
          {confidence.toFixed(0)}%
        </span>
      </div>
    );
  } else {
    const need       = Math.max(0, MIN_SAMPLE - n);
    const maturityD  = MATURITY_DAYS[platform] ?? 30;
    confidenceBar = (
      <div style={{
        fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5,
        color: T.inkMuted, lineHeight: 1.5,
      }}>
        {n === 0
          ? <>no outcomes yet · {maturityD}d after first forecast</>
          : <>warming up · <span style={{ color: T.amber }}>{need} more needed</span> (of {MIN_SAMPLE})</>
        }
      </div>
    );
  }

  // Status pill
  const status =
    !report || n === 0 ? { text: "awaiting",   color: T.inkFaint } :
    !matured           ? { text: "warming up", color: T.amber    } :
    mdapePct <= 20     ? { text: "reliable",   color: T.green    } :
    mdapePct <= 35     ? { text: "workable",   color: T.blue     } :
                         { text: "needs tune", color: T.red      };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 80px 80px 80px 1fr 120px",
      columnGap: 14,
      padding: "11px 14px",
      alignItems: "center",
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: 11,
      color: T.inkDim,
      borderBottom: last ? "none" : `1px solid ${T.line}`,
    }}>
      {/* Platform */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: pl.color, flexShrink: 0 }} />
        <span style={{ color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pl.label}
        </span>
      </div>
      {/* MdAPE */}
      <div style={{ textAlign: "right", color: mdapeColor, fontVariantNumeric: "tabular-nums" }}>
        {matured ? `${mdapePct.toFixed(1)}%` : "—"}
      </div>
      {/* Coverage */}
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: matured ? T.inkDim : T.inkFaint }}>
        {matured ? `${coveragePct.toFixed(0)}%` : "—"}
      </div>
      {/* Direction accuracy */}
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: matured ? T.inkDim : T.inkFaint }}>
        {matured ? `${directionPct.toFixed(0)}%` : "—"}
      </div>
      {/* Confidence bar or warming-up text */}
      <div>{confidenceBar}</div>
      {/* Status pill */}
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, letterSpacing: "0.05em",
          padding: "3px 10px", borderRadius: 99,
          background: `${status.color}14`,
          border:     `1px solid ${status.color}33`,
          color:       status.color,
          textTransform: "uppercase",
          whiteSpace:    "nowrap",
        }}>
          {status.text}
        </span>
      </div>
    </div>
  );
}

// PlatformTableRow + CoverageBar moved to PoolCoveragePanel.tsx — imported at top.

// ─── RIGHT RAIL SECTIONS ───────────────────────────────────────────────

function RailTotal({ entries, stats }: { entries: MinimalEntry[]; stats: ReturnType<typeof computePoolStats> }) {
  const totalViews = entries.reduce((s, e) => s + Number(e.metrics?.views ?? 0), 0);
  return (
    <div>
      <V5SectionHeader>Total reach</V5SectionHeader>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 300, color: T.ink, letterSpacing: -0.5 }}>
        {fmtCompact(totalViews)}
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint, marginTop: 3 }}>
        views across {stats.totalEntries.toLocaleString()} entries
      </div>
    </div>
  );
}

function RailPlatformBars({ rows }: { rows: PlatformRow[] }) {
  return (
    <div>
      <V5SectionHeader>Coverage · per platform</V5SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map(pl => {
          const plObj = PLATFORMS[pl.id];
          const pct = pl.count / Math.max(1, pl.mat);
          return (
            <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: plObj.color }} />
              <span style={{ flex: 1, color: T.inkMuted }}>{plObj.code}</span>
              <span style={{ color: T.inkFaint, width: 44, textAlign: "right" }}>{pl.count.toLocaleString()}</span>
              <div style={{ width: 36, height: 3, background: T.line, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", background: plObj.color, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailNextMilestone({ stats }: { stats: ReturnType<typeof computePoolStats> }) {
  const toMature = Math.max(0, stats.grand.mat - stats.totalEntries);
  const toStd    = Math.max(0, stats.grand.std - stats.totalEntries);
  const toMin    = Math.max(0, stats.grand.min - stats.totalEntries);
  const nextLabel =
    toMin > 0     ? { n: toMin,    label: "workable minimum", color: T.amber } :
    toStd > 0     ? { n: toStd,    label: "standard target",  color: T.blue  } :
                    { n: toMature, label: "mature pool",      color: T.green };
  return (
    <div>
      <V5SectionHeader>Next milestone</V5SectionHeader>
      <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
        <span style={{ color: nextLabel.color }}>
          {nextLabel.n > 0 ? `${nextLabel.n.toLocaleString()} entries` : "✓ all milestones hit"}
        </span>
        {nextLabel.n > 0 && <> to <strong style={{ fontWeight: 500 }}>{nextLabel.label}</strong></>}
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint, marginTop: 5, lineHeight: 1.6 }}>
        Bulk-import or paste a URL to grow the pool — every analyzed creator adds their recent videos too.
      </div>
    </div>
  );
}

function RailRecentIngestions({ recent }: { recent: MinimalEntry[] }) {
  if (recent.length === 0) {
    return (
      <div>
        <V5SectionHeader>Last ingestions</V5SectionHeader>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint, fontStyle: "italic" }}>
          none yet — paste a URL to start
        </div>
      </div>
    );
  }
  return (
    <div>
      <V5SectionHeader>Last {recent.length} ingestions</V5SectionHeader>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 4 }}>
        {recent.map((e, i) => {
          const pl = e.platform && e.platform in PLATFORMS ? PLATFORMS[e.platform as Platform] : null;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              borderBottom: i < recent.length - 1 ? `1px solid ${T.line}` : "none",
              fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: pl?.color ?? T.inkFaint, flexShrink: 0 }} />
              <span style={{ color: T.inkFaint, width: 44, flexShrink: 0 }}>{fmtAgo(e.analyzedAt ?? null)}</span>
              <span style={{ color: pl ? pl.color : T.inkMuted, width: 32, flexShrink: 0 }}>{pl?.code ?? "—"}</span>
              <span style={{
                flex: 1, color: T.inkDim,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {e.name || e.title || e.channelName || "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailLearningLoop() {
  return (
    <div>
      <V5SectionHeader>Learning loop</V5SectionHeader>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 4 }}>
        {([
          ["MdAPE (30d rolling)",    "see /admin/calibration"],
          ["Coverage bias",          "—"],
          ["Conformal strata ready", "—"],
        ] as const).map((row, i, arr) => (
          <div
            key={i}
            style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 12px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
              borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : "none",
            }}
          >
            <span style={{ color: T.inkDim }}>{row[0]}</span>
            <span style={{ color: T.ink }}>{row[1]}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, color: T.inkFaint, marginTop: 6 }}>
        populated once outcomes mature · /admin/calibration
      </div>
    </div>
  );
}

// V5 primitives + fmt helpers moved to PoolCoveragePanel.tsx — imported at top.
