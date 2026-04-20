"use client";

// ═══════════════════════════════════════════════════════════════════════════
// POOL COVERAGE PANEL — the single, shared renderer for pool size + coverage.
// ═══════════════════════════════════════════════════════════════════════════
//
// Previously three surfaces (LandingPage, Dashboard inline, Reference Pool
// Browser header) each rendered their own version of "how big is the pool
// and how ready is it?" — with their own counting logic and their own layout.
// That drift is what produced the YTL=2,219 / YTS=703 vs YTL=2,219 / YTS=0
// contradictions on the same app.
//
// This file collapses that to one component. All callers pass the same
// `PoolStats` object (from `computePoolStats`) and get the same visual
// treatment — breakdown tiles, grand-total coverage bars, per-platform
// table. A future edit here changes every surface at once.
//
// The file also exports the V5 primitives (V5SectionHeader, V5Cell,
// tableRowGrid, tableHeaderStyle) because multiple parts of the shell still
// use them for non-pool sections (right-rail, learning accuracy, etc.).

import React from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import { fmtCount, fmtCompact } from "@/lib/number-format";
import type { computePoolStats, PlatformRow } from "@/lib/pool-stats";

type PoolStats = ReturnType<typeof computePoolStats>;

// ─── MAIN PANEL ──────────────────────────────────────────────────────────

export function PoolCoveragePanel({ stats }: { stats: PoolStats }) {
  const lastAgo = fmtAgo(stats.lastIngestedAt);
  const youtubeRow = stats.rows.find(r => r.id === "youtube");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div>
          <V5SectionHeader>Pool coverage · learning accuracy</V5SectionHeader>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.green, letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.inkMuted, lineHeight: 1.55, marginTop: -6 }}>
        Updates in real-time as you analyse content or bulk-import creators. The more entries the pool has, the more accurate the forecast engine becomes.
      </div>

      {/* Top row: big pool size + per-format totals */}
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
        border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden",
      }}>
        <V5Cell
          big
          label="Pool size"
          value={fmtCount(stats.totalEntries)}
          sub={`${fmtCount(stats.totalCreators)} creators · last added ${lastAgo}`}
          color={T.ink}
        />
        <V5Cell
          label="Long-form"
          value={fmtCount(stats.totalLong)}
          sub="YT watch URLs"
          color={T.red}
        />
        <V5Cell
          label="Shorts"
          value={fmtCount(stats.totalShorts)}
          sub="YT Shorts bucket"
          color={T.pink}
        />
        <V5Cell
          label="Other platforms"
          value={fmtCount(stats.totalEntries - stats.totalLong - stats.totalShorts)}
          sub="TikTok + IG + X"
          color={T.cyan}
        />
      </div>

      {/* Coverage targets — 3 bars */}
      <div>
        <V5SectionHeader>Coverage targets</V5SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${T.line}`, borderRadius: 4, padding: "14px 16px" }}>
          <CoverageBar label="Workable minimum" sub="engine functions"        color={T.amber} cur={stats.grand.current} target={stats.grand.min} />
          <CoverageBar label="Standard target"  sub="reliable benchmarking"   color={T.blue}  cur={stats.grand.current} target={stats.grand.std} />
          <CoverageBar label="Mature pool"      sub="niche-specific patterns" color={T.green} cur={stats.grand.current} target={stats.grand.mat} />
        </div>
      </div>

      {/* Per-platform table */}
      <div>
        <V5SectionHeader>Per platform — sorted by count</V5SectionHeader>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={tableHeaderStyle}>
            <div>Platform</div>
            <div style={{ textAlign: "right" }}>Videos</div>
            <div style={{ textAlign: "right" }}>Creators</div>
            <div style={{ textAlign: "right" }}>% of pool</div>
            <div>Status</div>
            <div>Progress</div>
            <div style={{ textAlign: "right" }}>Next</div>
          </div>
          {stats.rows.map((row, i) => (
            <PlatformTableRow
              key={row.id} row={row}
              last={i === stats.rows.length - 1}
            />
          ))}
          {stats.skipped > 0 && (
            <div style={{
              padding: "8px 12px", fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10, color: T.inkFaint,
              background: T.bgRow, borderTop: `1px solid ${T.line}`,
            }}>
              {stats.skipped} entr{stats.skipped === 1 ? "y" : "ies"} skipped — missing platform field
            </div>
          )}
        </div>
        {youtubeRow && stats.totalShorts > 0 && (
          <div style={{
            fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint,
            marginTop: 6, lineHeight: 1.55,
          }}>
            YouTube is split by format: long-form (watch URLs) vs. shorts (videoFormat&nbsp;=&nbsp;&quot;short&quot;). Both count toward the YouTube coverage milestones.
          </div>
        )}
      </div>
    </section>
  );
}

// ─── PLATFORM TABLE ROW ──────────────────────────────────────────────────

export function PlatformTableRow({ row, last }: { row: PlatformRow; last: boolean }) {
  const pl = PLATFORMS[row.id];
  const remaining = row.nextTarget === null ? 0 : Math.max(0, row.nextTarget - row.count);
  const pctToNext = row.nextTarget === null ? 1 : Math.min(1, row.count / row.nextTarget);
  const statusColor =
    row.status === "mature"     ? T.green :
    row.status === "standard"   ? T.blue  :
    row.status === "functional" ? T.amber :
    row.status === "below-min"  ? T.amber :
                                   T.inkMuted;
  const statusText =
    row.status === "mature"     ? "mature" :
    row.status === "standard"   ? "standard" :
    row.status === "functional" ? "workable" :
    row.status === "below-min"  ? "below min" :
                                   "empty";
  const nextText =
    row.nextTarget === null ? "✓ mature" :
    remaining === 0         ? "✓"         :
                               `${fmtCompact(remaining)} to ${row.label ?? "next"}`;

  return (
    <div style={{
      ...tableRowGrid,
      padding: "11px 16px", alignItems: "center",
      fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim,
      borderBottom: last ? "none" : `1px solid ${T.line}`,
    }}>
      {/* Platform */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: pl.color, flexShrink: 0 }} />
        <span style={{ color: pl.color, fontWeight: 600 }}>{pl.code}</span>
        <span style={{ color: T.inkFaint, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pl.short}
        </span>
      </div>

      <div style={{ textAlign: "right", color: row.count > 0 ? T.ink : T.inkFaint, fontVariantNumeric: "tabular-nums" }}>
        {fmtCount(row.count)}
      </div>

      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtCount(row.creators)}
      </div>

      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {row.pct > 0 ? `${row.pct.toFixed(1)}%` : "—"}
      </div>

      <div>
        <span style={{
          display: "inline-block",
          padding: "2px 8px", borderRadius: 3,
          background: `${statusColor}14`,
          border: `1px solid ${statusColor}33`,
          color: statusColor,
          fontSize: 10, letterSpacing: 0.4,
          whiteSpace: "nowrap",
        }}>
          {statusText}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pctToNext * 100}%`, height: "100%", background: pl.color, opacity: 0.7 }} />
        </div>
      </div>

      <div style={{
        textAlign: "right",
        color: row.nextTarget === null ? T.green : T.inkFaint,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}>
        {nextText}
      </div>
    </div>
  );
}

// ─── COVERAGE BAR (grand totals) ─────────────────────────────────────────

export function CoverageBar({ label, sub, color, cur, target }: { label: string; sub: string; color: string; cur: number; target: number }) {
  const pct = target > 0 ? Math.min(1, cur / target) : 0;
  const met = cur >= target;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: color }} />
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.ink }}>{label}</span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint }}>· {sub}</span>
        <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: met ? T.green : T.inkDim }}>
          {met && "✓ "}{fmtCount(cur)} / {fmtCount(target)}
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: color, opacity: 0.8, borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ─── V5 PRIMITIVES ───────────────────────────────────────────────────────

export function V5SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
      letterSpacing: 1.3, textTransform: "uppercase", color: T.inkFaint,
      marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.line}`,
    }}>{children}</div>
  );
}

export function V5Cell({ label, value, sub, big, color }: { label: string; value: string; sub?: string; big?: boolean; color?: string }) {
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

// Shared grid template for the per-platform table — same columns used by
// the header and every data row so alignment stays locked.
export const tableRowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "150px 90px 90px 80px 110px 1fr 140px",
  columnGap: 18,
};

export const tableHeaderStyle: React.CSSProperties = {
  ...tableRowGrid,
  padding: "9px 16px", background: T.bgRow,
  fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.2,
  textTransform: "uppercase", color: T.inkFaint,
  borderBottom: `1px solid ${T.line}`,
  alignItems: "center",
};

// ─── TIME-AGO HELPER ─────────────────────────────────────────────────────

export function fmtAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diff = Date.now() - then;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60)        return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)        return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)         return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30)          return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)         return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
