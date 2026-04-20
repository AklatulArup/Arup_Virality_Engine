"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PAGE — V5 data-dense two-column
// ═══════════════════════════════════════════════════════════════════════════
//
// Main column: bordered-cell pool status row + coverage bars + per-platform
// table + live signal feed table. Right rail: total reach, per-platform bars,
// next milestone, learning loop stats. No starfield, no pulse, no glow.

import React, { useEffect, useMemo, useState } from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import type { Platform } from "@/lib/forecast";

interface ReferenceEntry {
  id?:       string;
  platform?: Platform;
  type?:     string;
  name?:     string;
  channelName?: string;
  metrics?:  Record<string, number | string>;
}

interface PlatformPoolRow {
  id:       Platform;
  count:    number;
  creators: number;
  color:    string;
  min:      number;
  std:      number;
  mat:      number;
}

const PLATFORM_TARGETS: Record<Platform, { min: number; std: number; mat: number }> = {
  youtube:       { min: 500, std: 1950, mat: 3800 },
  youtube_short: { min: 150, std: 400,  mat: 150  },
  instagram:     { min: 150, std: 400,  mat: 150  },
  tiktok:        { min: 150, std: 400,  mat: 150  },
  x:             { min: 400, std: 800,  mat: 1600 },
};

export default function LandingPage() {
  const [entries, setEntries] = useState<ReferenceEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/reference-store")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const arr: ReferenceEntry[] = Array.isArray(d?.entries) ? d.entries : Array.isArray(d) ? d : [];
        setEntries(arr);
      })
      .catch(() => {});
  }, []);

  const pool = useMemo(() => {
    const byPlatform: Record<Platform, { count: number; creators: Set<string> }> = {
      youtube:       { count: 0, creators: new Set() },
      youtube_short: { count: 0, creators: new Set() },
      instagram:     { count: 0, creators: new Set() },
      tiktok:        { count: 0, creators: new Set() },
      x:             { count: 0, creators: new Set() },
    };
    for (const e of entries) {
      const p = e?.platform;
      if (!p || !(p in byPlatform)) continue;
      byPlatform[p].count += 1;
      const handle = e.channelName ?? e.name;
      if (handle) byPlatform[p].creators.add(handle);
    }
    const total = Object.values(byPlatform).reduce((s, v) => s + v.count, 0);
    const allCreators = new Set<string>();
    for (const v of Object.values(byPlatform)) v.creators.forEach(c => allCreators.add(c));

    const rows: PlatformPoolRow[] = (Object.keys(byPlatform) as Platform[]).map(id => {
      const row = byPlatform[id];
      const targets = PLATFORM_TARGETS[id];
      return {
        id,
        count:    row.count,
        creators: row.creators.size,
        color:    PLATFORMS[id].color,
        min:      targets.min,
        std:      targets.std,
        mat:      targets.mat,
      };
    });

    const grand = {
      current: total,
      min: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.min, 0),
      std: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.std, 0),
      mat: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.mat, 0),
    };

    const totalViews = entries.reduce((s, e) => s + Number(e.metrics?.views ?? 0), 0);
    const shorts = entries.filter(e => {
      const d = Number(e.metrics?.durationSeconds ?? 0);
      return d > 0 && d <= 60;
    }).length;
    const full = entries.filter(e => Number(e.metrics?.durationSeconds ?? 0) > 60).length;

    return { rows, total, creators: allCreators.size, grand, totalViews, shorts, full };
  }, [entries]);

  const signals = useMemo(() => {
    const hasEntries = entries.length > 0;
    const vrsValues = entries.map(e => Number(e.metrics?.vrsScore ?? 0)).filter(v => v > 0);
    const avgVRS = vrsValues.length > 0 ? vrsValues.reduce((s, v) => s + v, 0) / vrsValues.length : 0;
    const engValues = entries.map(e => Number(e.metrics?.engagement ?? 0)).filter(v => v > 0);
    const avgEng = engValues.length > 0 ? engValues.reduce((s, v) => s + v, 0) / engValues.length : 0;
    const highVRS = entries.filter(e => Number(e.metrics?.vrsScore ?? 0) >= 80).length;
    const topCreator = [...entries].sort((a, b) => Number(b.metrics?.vrsScore ?? 0) - Number(a.metrics?.vrsScore ?? 0))[0];

    return [
      { label: "Reference pool depth",   value: `${fmtCompact(pool.total)} videos`,            color: T.red,    active: hasEntries },
      { label: "Pool avg VRS score",     value: avgVRS > 0 ? `${avgVRS.toFixed(0)}/100` : "—", color: T.amber,  active: avgVRS >= 60 },
      { label: "Pool avg engagement",    value: avgEng > 0 ? `${avgEng.toFixed(1)}%` : "—",    color: T.amber,  active: avgEng > 0 },
      { label: "High-VRS content (≥80)", value: `${highVRS} videos`,                           color: T.green,  active: highVRS > 0 },
      { label: "Creators in pool",       value: `${fmtCompact(pool.creators)}`,                color: T.red,    active: pool.creators > 0 },
      { label: "Top VRS",                value: topCreator?.name
                                                     ? `${topCreator.name.slice(0, 24)} · ${Number(topCreator.metrics?.vrsScore ?? 0).toFixed(0)}/100`
                                                     : "—",                                    color: T.cyan,   active: !!topCreator },
    ];
  }, [entries, pool]);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 320px",
      height: "100%", color: T.ink, fontFamily: "IBM Plex Sans, sans-serif",
    }}>
      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 22, borderRight: `1px solid ${T.line}`, overflowY: "auto" }}>

        {/* Pool status */}
        <div>
          <V5SectionHeader>Pool status</V5SectionHeader>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
            border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden",
          }}>
            <V5Cell big label="Pool size"
              value={pool.total.toLocaleString()}
              sub={`videos · ${pool.creators.toLocaleString()} creators`}
              color={T.ink} />
            <V5Cell label="To standard"
              value={Math.max(0, pool.grand.std - pool.total).toLocaleString()}
              sub="reliable" />
            <V5Cell label="To mature"
              value={Math.max(0, pool.grand.mat - pool.total).toLocaleString()}
              sub="niche patterns" />
            <V5Cell label="Total views"
              value={fmtCompact(pool.totalViews)}
              sub="across pool"
              color={T.green} />
          </div>
        </div>

        {/* Coverage targets */}
        <div>
          <V5SectionHeader>Coverage targets</V5SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${T.line}`, borderRadius: 4, padding: "14px 16px" }}>
            <CoverageBar label="Mergeable minimum" sub="engine functions"        color={T.amber} cur={pool.grand.current} target={pool.grand.min} />
            <CoverageBar label="Standard target"   sub="reliable benchmarking"   color={T.blue}  cur={pool.grand.current} target={pool.grand.std} />
            <CoverageBar label="Mature pool"       sub="niche-specific patterns" color={T.green} cur={pool.grand.current} target={pool.grand.mat} />
          </div>
        </div>

        {/* Composition + per-platform table */}
        <div>
          <V5SectionHeader>Composition · by platform</V5SectionHeader>
          <CompositionBar rows={pool.rows} />
          <div style={{ marginTop: 10, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "70px 1.2fr 70px 70px 1fr",
              padding: "8px 12px", background: T.bgRow,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.2,
              textTransform: "uppercase", color: T.inkFaint,
              borderBottom: `1px solid ${T.line}`,
            }}>
              <div>Platform</div><div>Status</div>
              <div style={{ textAlign: "right" }}>Videos</div>
              <div style={{ textAlign: "right" }}>Creators</div>
              <div style={{ textAlign: "right" }}>To minimum</div>
            </div>
            {pool.rows.map((row, i) => <PlatformRow key={row.id} row={row} last={i === pool.rows.length - 1} />)}
          </div>
        </div>

        {/* Live signal feed as table */}
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
      </main>

      {/* ── RIGHT RAIL ──────────────────────────────────────────── */}
      <aside style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 22, background: T.bgDeep, overflowY: "auto" }}>
        <div>
          <V5SectionHeader>Total reach</V5SectionHeader>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 300, color: T.ink, letterSpacing: -0.5 }}>
            {fmtCompact(pool.totalViews)}
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint, marginTop: 3 }}>
            views across pool · {pool.full.toLocaleString()} full + {pool.shorts.toLocaleString()} short
          </div>
        </div>

        <div>
          <V5SectionHeader>Coverage · per platform</V5SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {pool.rows.map(pl => {
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

        <div>
          <V5SectionHeader>Next milestone</V5SectionHeader>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
            <span style={{ color: T.green }}>{Math.max(0, pool.grand.mat - pool.total).toLocaleString()} videos</span> to mature pool
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint, marginTop: 5, lineHeight: 1.6 }}>
            Above mature pool ({pool.grand.mat.toLocaleString()} videos) the engine begins surfacing niche-specific patterns. Continue importing to accelerate.
          </div>
        </div>

        <div>
          <V5SectionHeader>Learning loop</V5SectionHeader>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 4 }}>
            {([
              ["last forecast resolved", "—"],
              ["MdAPE (30d rolling)",    "—"],
              ["coverage bias",          "—"],
              ["high-VRS hit rate",      "—"],
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
            populated once forecasts mature · see /admin/calibration
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── V5 PRIMITIVES (local copies — forecasts use the same pattern) ───

function V5SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
      letterSpacing: 1.3, textTransform: "uppercase", color: T.inkFaint,
      marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.line}`,
    }}>{children}</div>
  );
}

function V5Cell({ label, value, sub, big, color }: { label: string; value: string; sub?: string; big?: boolean; color?: string }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderRight: `1px solid ${T.line}`,
      background: big ? "rgba(255,255,255,0.018)" : "transparent",
    }}>
      <div style={{
        fontFamily: "IBM Plex Mono, monospace", fontSize: 10, letterSpacing: 1.2,
        textTransform: "uppercase", color: T.inkFaint, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: big ? 34 : 20, fontWeight: 300, letterSpacing: -0.5,
        color: color || T.ink, lineHeight: 1.1,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
          color: T.inkFaint, marginTop: 3,
        }}>{sub}</div>
      )}
    </div>
  );
}

function CoverageBar({ label, sub, color, cur, target }: { label: string; sub: string; color: string; cur: number; target: number }) {
  const pct = target > 0 ? Math.min(1, cur / target) : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: color }} />
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.ink }}>{label}</span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint }}>· {sub}</span>
        <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim }}>
          {cur.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: color, opacity: 0.8, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function CompositionBar({ rows }: { rows: PlatformPoolRow[] }) {
  const total = rows.reduce((s, p) => s + p.count, 0);
  return (
    <div style={{ height: 8, display: "flex", borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.line}` }}>
      {rows.map(p => {
        const w = total > 0 ? (p.count / total) * 100 : 0;
        return w > 0 ? <div key={p.id} style={{ width: `${w}%`, background: p.color, opacity: 0.75 }} /> : null;
      })}
    </div>
  );
}

function PlatformRow({ row, last }: { row: PlatformPoolRow; last: boolean }) {
  const pl = PLATFORMS[row.id];
  const status =
    row.count >= row.mat ? "mature" :
    row.count >= row.std ? "standard" :
    row.count >= row.min ? "functional" :
    row.count === 0      ? "empty" :
                            "below min";
  const statusColor =
    row.count >= row.mat ? T.green :
    row.count >= row.std ? T.blue :
    row.count >= row.min ? T.amber :
                            T.inkMuted;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "70px 1.2fr 70px 70px 1fr",
      padding: "10px 12px", alignItems: "center",
      fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim,
      borderBottom: last ? "none" : `1px solid ${T.line}`,
    }}>
      <div style={{ color: pl.color, fontWeight: 600 }}>{pl.code}</div>
      <div style={{ color: statusColor }}>{status}</div>
      <div style={{ textAlign: "right", color: T.ink }}>{row.count.toLocaleString()}</div>
      <div style={{ textAlign: "right" }}>{row.creators.toLocaleString()}</div>
      <div style={{ textAlign: "right", color: T.inkFaint }}>
        {row.count >= row.min ? "—" : `${(row.min - row.count).toLocaleString()} to go`}
      </div>
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
