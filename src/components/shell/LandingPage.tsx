"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PAGE — Live Signal Feed + Pool Coverage
// ═══════════════════════════════════════════════════════════════════════════
//
// Default page. Live data: reference pool stats computed from
// /api/reference-store; VRS/engagement signals surfaced as a pulsing feed.
// Ported from `page-landing.jsx` with real data instead of mock.

import React, { useEffect, useMemo, useState } from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import StarField from "./StarField";
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
  pctFill:  number;
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
        const arr: ReferenceEntry[] = Array.isArray(d?.entries) ? d.entries
                                     : Array.isArray(d)        ? d
                                     : [];
        setEntries(arr);
      })
      .catch(() => {});
  }, []);

  // Aggregate pool by platform from real entries.
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
        pctFill:  total > 0 ? (row.count / total) * 100 : 0,
        min:      targets.min,
        std:      targets.std,
        mat:      targets.mat,
      };
    });

    // Grand targets: sum of all platforms (rough proxy for the aggregate milestones)
    const grand = {
      current: total,
      min: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.min, 0),
      std: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.std, 0),
      mat: Object.values(PLATFORM_TARGETS).reduce((s, t) => s + t.mat, 0),
    };

    return { rows, total, creators: allCreators.size, grand };
  }, [entries]);

  // Derive signal feed from real pool — pure compute, no setState-in-effect.
  const signals = useMemo(() => {
    const hasEntries = entries.length > 0;
    const vrsValues = entries.map(e => Number(e.metrics?.vrsScore ?? 0)).filter(v => v > 0);
    const avgVRS = vrsValues.length > 0 ? vrsValues.reduce((s, v) => s + v, 0) / vrsValues.length : 0;
    const engValues = entries.map(e => Number(e.metrics?.engagement ?? 0)).filter(v => v > 0);
    const avgEng = engValues.length > 0 ? engValues.reduce((s, v) => s + v, 0) / engValues.length : 0;
    const highVRS = entries.filter(e => Number(e.metrics?.vrsScore ?? 0) >= 80).length;
    const topCreator = [...entries].sort((a, b) => Number(b.metrics?.vrsScore ?? 0) - Number(a.metrics?.vrsScore ?? 0))[0];

    return [
      { label: "Reference pool depth",   value: `${fmtCompact(pool.total)} videos`, color: T.red,    pulse: hasEntries },
      { label: "Pool avg VRS score",     value: avgVRS > 0 ? `${avgVRS.toFixed(0)}/100` : "—", color: T.amber, pulse: avgVRS >= 60 },
      { label: "Pool avg engagement",    value: avgEng > 0 ? `${avgEng.toFixed(1)}%` : "—",     color: T.amber, pulse: true },
      { label: "High-VRS content (≥80)", value: `${highVRS} videos`,                           color: T.green, pulse: highVRS > 0 },
      { label: "Creators in pool",       value: `${fmtCompact(pool.creators)}`,                color: T.red,   pulse: false },
      { label: "Top VRS",                value: topCreator?.name
                                                   ? `${topCreator.name.slice(0, 24)} · ${Number(topCreator.metrics?.vrsScore ?? 0).toFixed(0)}/100`
                                                   : "—", color: T.cyan, pulse: !!topCreator },
    ];
  }, [entries, pool]);

  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <StarField />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <LiveSignalFeed signals={signals} />
        <PoolCoverage pool={pool} />
      </div>
    </div>
  );
}

// ─── LIVE SIGNAL FEED ──────────────────────────────────────────────────

function LiveSignalFeed({ signals }: { signals: Array<{ label: string; value: string; color: string; pulse: boolean }> }) {
  return (
    <section style={{
      background: T.bgPanel, border: `1px solid ${T.line}`,
      borderRadius: 4, padding: "14px 18px",
    }}>
      <div style={monoEyebrow}>Live Signal Feed</div>
      {signals.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 0",
            borderBottom: i < signals.length - 1 ? `1px solid ${T.line}` : "none",
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: 99, background: s.color,
            boxShadow: s.pulse ? `0 0 8px ${s.color}` : "none", flexShrink: 0,
          }} />
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: T.inkDim, flex: 1 }}>
            {s.label}
          </span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: s.color }}>
            {s.value}
          </span>
        </div>
      ))}
    </section>
  );
}

// ─── POOL COVERAGE ─────────────────────────────────────────────────────

function PoolCoverage({ pool }: { pool: { rows: PlatformPoolRow[]; total: number; creators: number; grand: { current: number; min: number; std: number; mat: number } } }) {
  const toMature = Math.max(0, pool.grand.mat - pool.grand.current);
  return (
    <section style={{
      background: T.bgPanel, border: `1px solid ${T.line}`,
      borderRadius: 4, padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={monoEyebrow}>Pool Coverage · Learning Accuracy</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.green, letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: T.inkMuted, marginBottom: 18, lineHeight: 1.55 }}>
        Updates in real-time as you analyse content. The more you analyse, the more accurate the engine&apos;s forecasts become.
      </div>

      {/* Grand total */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
        <div>
          <div style={monoEyebrow}>Pool Size</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 40, fontWeight: 300, color: T.ink, letterSpacing: -1.2, lineHeight: 1 }}>
              {pool.total.toLocaleString()}
            </div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkMuted }}>
              videos · {pool.creators.toLocaleString()} creators
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={monoEyebrow}>Next Tier</div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: T.green }}>
            {toMature.toLocaleString()} <span style={{ color: T.inkMuted, fontSize: 11 }}>to mature pool</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        <CoverageBar label="Mergeable minimum" sub="engine functions"       color={T.amber} cur={pool.grand.current} target={pool.grand.min} />
        <CoverageBar label="Standard target"   sub="reliable benchmarking"  color={T.blue}  cur={pool.grand.current} target={pool.grand.std} />
        <CoverageBar label="Mature pool"       sub="niche-specific patterns" color={T.green} cur={pool.grand.current} target={pool.grand.mat} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={monoEyebrow}>Pool Composition</div>
          <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 0.8, color: T.inkFaint }}>by platform</span>
        </div>
        <CompositionBar rows={pool.rows} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 10 }}>
          {pool.rows.map(p => {
            const pl = PLATFORMS[p.id];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, color: T.inkMuted }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: p.color }} />
                <span style={{ color: pl.color }}>{pl.code}</span>
                <span>{p.pctFill.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={monoEyebrow}>Per Platform</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10 }}>
        {pool.rows.map(p => <PlatformTile key={p.id} data={p} />)}
      </div>
    </section>
  );
}

function CoverageBar({ label, sub, color, cur, target }: { label: string; sub: string; color: string; cur: number; target: number }) {
  const pct = target > 0 ? Math.min(1, cur / target) : 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: color, marginRight: 4 }} />
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.ink }}>{label}</span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint }}>— {sub}</span>
        <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim }}>
          {cur.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: color, opacity: 0.85, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function CompositionBar({ rows }: { rows: PlatformPoolRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div style={{ height: 12, display: "flex", borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
      {rows.map(p => {
        const w = total > 0 ? (p.count / total) * 100 : 0;
        return w > 0 ? <div key={p.id} style={{ width: `${w}%`, background: p.color }} /> : null;
      })}
    </div>
  );
}

function PlatformTile({ data }: { data: PlatformPoolRow }) {
  const p = PLATFORMS[data.id];
  const pctMin = data.count >= data.min ? 100 : (data.count / data.min) * 100;
  const remain = Math.max(0, data.min - data.count);
  return (
    <div style={{ padding: "10px 12px", background: T.bgPanelHi, border: `1px solid ${T.line}`, borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color: p.color, fontFamily: "IBM Plex Mono, monospace", fontSize: 10, fontWeight: 600 }}>{p.code}</span>
        <span style={{ fontSize: 10, color: T.inkDim }}>{p.label}</span>
        <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: p.color }}>{data.count.toLocaleString()}</span>
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, color: T.inkFaint, marginBottom: 6 }}>
        {data.creators > 0 ? `${data.creators} creators` : `min ${data.min} · std ${data.std}`}
      </div>
      <div style={{ height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 99, marginBottom: 4 }}>
        <div style={{ width: `${pctMin}%`, height: "100%", background: p.color, opacity: 0.7, borderRadius: 99 }} />
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, color: T.inkFaint }}>
        {data.count >= data.mat ? "✓ mature" : remain > 0 ? `${remain} to minimum` : `${data.mat - data.count} to mature`}
      </div>
    </div>
  );
}

// ─── STYLES / HELPERS ─────────────────────────────────────────────────

const monoEyebrow: React.CSSProperties = {
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 9, letterSpacing: 1.6,
  textTransform: "uppercase", color: T.inkFaint,
  marginBottom: 12,
};

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
