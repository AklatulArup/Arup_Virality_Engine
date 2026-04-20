"use client";

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — FN Intel shell left rail
// ═══════════════════════════════════════════════════════════════════════════
//
// Vertical nav with: FundedNext Intel brand, Platform switcher (5 platforms
// with accent-color left edge on active), Analysis Modes grid (A-H + OLR),
// Reference Pool stat tiles, Tools navigation rows, and a footer button for
// forecast calibration.
//
// Modes are MULTI-SELECT (legacy behaviour restored 2026-04-20): clicking a
// chip toggles its presence in the active set. "ALL" selects every mode,
// "Clear" (via double-click on ALL) empties the set. Hovering a chip shows
// a rich tooltip with mode label + long description, portal-rendered so it
// escapes the sidebar's overflow clip.

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { T, PLATFORMS, MODES, type ShellRoute } from "@/lib/design-tokens";
import type { Platform } from "@/lib/forecast";

export interface PoolStats {
  videos:   number;
  creators: number;
  shorts:   number;
  keywords: number;
}

interface SidebarProps {
  route:       ShellRoute;
  setRoute:    (r: ShellRoute) => void;
  platform:    Platform;
  setPlatform: (p: Platform) => void;
  activeModes: Set<string>;
  toggleMode:  (id: string) => void;
  selectAllModes: () => void;
  clearModes:  () => void;
  pool:        PoolStats;
}

// Long-form descriptions shown in the rich hover tooltip. Keeps parity with
// the legacy ModeSelector's copy (`MODE_DESCRIPTIONS`).
const MODE_DESCRIPTIONS: Record<string, string> = {
  A:   "Explains distribution logic, ranking signals, and what drives reach in 2026.",
  B:   "Surfaces the latest algorithm changes affecting content performance.",
  C:   "Identifies why a video outperformed the channel median — hook, format, timing.",
  D:   "Reverse-engineers viral content: structure, pacing, title, thumbnail patterns.",
  E:   "Analyzes competitor strategies — what they post, how often, what's working.",
  F:   "Full URL breakdown — pulls every signal for a deep virality audit.",
  G:   "Virality Readiness Score (0–100) — rates algorithm push likelihood.",
  H:   "Updates the platform intelligence knowledge base with fresh briefing data.",
  OLR: "Outlier regression — cross-checks flagged outliers against a stricter baseline.",
};

export default function Sidebar({ route, setRoute, platform, setPlatform, activeModes, toggleMode, selectAllModes, clearModes, pool }: SidebarProps) {
  const platforms = Object.values(PLATFORMS);

  // Hover-tooltip anchor for mode chips. Portal-rendered so overflow:hidden
  // on the sidebar doesn't clip it.
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(null);

  return (
    <aside style={{
      width: 240, flexShrink: 0, height: "100%",
      background: T.bgDeep,
      borderRight: `1px solid ${T.line}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Brand — V5 flat: no gradient, no glow */}
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 3,
          background: T.bgPanel, border: `1px solid ${T.lineMid}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, fontSize: 11,
          color: T.ink, letterSpacing: 0.5,
        }}>FN</div>
        <div>
          <div style={{ fontSize: 13, color: T.ink, fontWeight: 500, letterSpacing: -0.2 }}>FundedNext Intel</div>
          <div style={monoLabelStyle}>Platform Intelligence</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 0" }}>
        <SideSection title="Platform">
          {platforms.map(p => {
            const active = platform === (p.id as Platform);
            return (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id as Platform)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 16px", border: "none",
                  background: active ? "rgba(255,255,255,0.03)" : "transparent",
                  borderLeft: `2px solid ${active ? p.color : "transparent"}`,
                  cursor: "pointer", textAlign: "left", color: "inherit",
                }}
              >
                <span style={{ width: 16, color: p.color, fontSize: 12, textAlign: "center" }}>{p.icon}</span>
                <span style={{ fontSize: 12, color: active ? T.ink : T.inkDim }}>{p.label}</span>
                {active && (
                  <span style={{
                    marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5,
                    color: p.color, padding: "2px 6px", border: `1px solid ${p.color}55`, borderRadius: 3,
                  }}>ACTIVE</span>
                )}
              </button>
            );
          })}
        </SideSection>

        <SideSection title="Analysis Modes">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, padding: "0 16px" }}>
            {MODES.map(m => {
              const active = activeModes.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMode(m.id)}
                  onMouseEnter={(e) => setHovered({ id: m.id, rect: e.currentTarget.getBoundingClientRect() })}
                  onMouseLeave={() => setHovered(prev => prev?.id === m.id ? null : prev)}
                  style={{
                    padding: m.id === "OLR" ? "7px 2px" : "7px 0", minHeight: 28,
                    border: `1px solid ${active ? m.color : T.lineMid}`,
                    background: active ? m.color + "22" : "transparent",
                    color: active ? m.color : T.inkDim,
                    borderRadius: 3, cursor: "pointer",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: m.id === "OLR" ? 9 : 11, fontWeight: 600,
                    transition: "background 120ms, color 120ms, border-color 120ms",
                  }}
                >{m.id}</button>
              );
            })}
            <button
              onClick={() => { if (activeModes.size === MODES.length) clearModes(); else selectAllModes(); }}
              title={activeModes.size === MODES.length ? "Clear all modes" : "Select every mode"}
              style={{
                padding: "7px 0",
                border: `1px solid ${activeModes.size === MODES.length ? T.inkDim : T.lineMid}`,
                background: "transparent",
                color: activeModes.size === MODES.length ? T.ink : T.inkMuted,
                borderRadius: 3,
                fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 600,
                cursor: "pointer",
              }}
            >{activeModes.size === MODES.length ? "×" : "ALL"}</button>
          </div>
        </SideSection>

        <SideSection title="Reference Pool">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 16px" }}>
            <PoolStat value={fmtCompact(pool.videos)}   label="videos"    color={T.green} />
            <PoolStat value={fmtCompact(pool.creators)} label="creators"  color={T.blue} />
            <PoolStat value={fmtCompact(pool.shorts)}   label="shorts"    color={T.pink} />
            <PoolStat value={fmtCompact(pool.keywords)} label="keywords"  color={T.amber} />
          </div>
        </SideSection>

        <SideSection title="Tools">
          <NavRow icon="⚙" title="Reverse Engineer" sub="Script · Hook · Title"         active={route === "reverse"}   onClick={() => setRoute("reverse")} />
          <NavRow icon="⎙" title="Analysis History" sub="Tracked re-checks"             active={route === "history"}   onClick={() => setRoute("history")} />
          <NavRow icon="⇪" title="Bulk CSV Import"  sub="Creators · Videos · History"   active={route === "bulk"}      onClick={() => setRoute("bulk")} />
          <NavRow icon="▦" title="History Calendar" sub="Views · Likes · Shares by date" active={route === "calendar"} onClick={() => setRoute("calendar")} />
          <NavRow icon="❏" title="Libraries"         sub="Keywords · Tags · Competitors" chev active={route === "libraries"} onClick={() => setRoute("libraries")} />
          <NavRow icon="↻" title="Reference Tools"   sub="Upload · Browse · Build pool"  chev active={route === "reference"} onClick={() => setRoute("reference")} />
        </SideSection>

        <div style={{ padding: "8px 16px" }}>
          <NavRow
            icon="◈" title="Forecast Result" sub="V2 · chart-hero panel"
            active={route === "forecast"} onClick={() => setRoute("forecast")} accent={T.cyan}
          />
        </div>
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${T.line}` }}>
        <button
          onClick={() => setRoute("calibration")}
          style={{
            width: "100%", padding: "10px 12px", background: "transparent",
            border: `1px solid ${T.purpleDim}`, color: T.purple,
            fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, letterSpacing: 0.8,
            borderRadius: 3, cursor: "pointer", textAlign: "left",
          }}
        >→ forecast calibration</button>
      </div>

      {hovered && typeof window !== "undefined" && <ModeTooltip hovered={hovered} />}
    </aside>
  );
}

// ─── Rich mode tooltip ─────────────────────────────────────────────────

const TOOLTIP_WIDTH = 220;

function ModeTooltip({ hovered }: { hovered: { id: string; rect: DOMRect } }) {
  const mode = MODES.find(m => m.id === hovered.id);
  if (!mode) return null;
  const left = hovered.rect.right + 12;
  const top  = hovered.rect.top + hovered.rect.height / 2;

  return createPortal(
    <div
      style={{
        position: "fixed", left, top,
        transform: "translateY(-50%)",
        width: TOOLTIP_WIDTH,
        zIndex: 9999, pointerEvents: "none",
      }}
    >
      {/* arrow */}
      <div style={{
        position: "absolute", left: -5, top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
        width: 8, height: 8,
        background: T.bgPanel,
        borderLeft:   `1px solid ${T.lineMid}`,
        borderBottom: `1px solid ${T.lineMid}`,
      }} />
      <div style={{
        background: T.bgPanel,
        border: `1px solid ${T.lineMid}`,
        borderRadius: 6, padding: "10px 12px",
        boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 20px ${mode.color}18`,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
            color: mode.color,
          }}>MODE {mode.id}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.ink }}>
            {mode.label}
          </span>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: T.inkMuted }}>
          {MODE_DESCRIPTIONS[mode.id] || mode.desc}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ padding: "0 16px 8px", ...monoLabelStyle }}>{title}</div>
      {children}
    </div>
  );
}

function PoolStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ padding: "10px 10px", borderRadius: 4, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.line}` }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 18, fontWeight: 500, color, letterSpacing: -0.3, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5, letterSpacing: 1.2, textTransform: "uppercase", color: T.inkFaint, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function NavRow({
  icon, title, sub, chev, active, onClick, accent,
}: {
  icon: string; title: string; sub: string; chev?: boolean;
  active?: boolean; onClick: () => void; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "8px 16px", border: "none",
        background: active ? "rgba(255,255,255,0.03)" : "transparent",
        borderLeft: `2px solid ${active ? (accent || T.purple) : "transparent"}`,
        cursor: "pointer", textAlign: "left", color: "inherit",
      }}
    >
      <span style={{ width: 16, color: active ? (accent || T.ink) : T.inkMuted, textAlign: "center", fontSize: 12 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: active ? T.ink : T.inkDim }}>{title}</div>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, color: T.inkFaint, marginTop: 2 }}>{sub}</div>
      </div>
      {chev && <span style={{ color: T.inkFaint, fontSize: 12 }}>›</span>}
    </button>
  );
}

// ─── STYLES / HELPERS ───────────────────────────────────────────────────

const monoLabelStyle: React.CSSProperties = {
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 8.5, letterSpacing: 1.6,
  textTransform: "uppercase",
  color: T.inkFaint,
  marginTop: 2,
};

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}
