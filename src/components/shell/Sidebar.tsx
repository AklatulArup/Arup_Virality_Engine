"use client";

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — FN Intel shell left rail
// ═══════════════════════════════════════════════════════════════════════════
//
// Vertical nav with: FundedNext Intel brand, Platform switcher (5 platforms
// with accent-color left edge on active), Analysis Modes grid (A-H + OLR),
// Reference Pool stat tiles, Tools navigation rows, and a footer button for
// forecast calibration. Ported from `app-chrome.jsx` Sidebar in the design
// handoff. Heights are compact — this is a dense sidebar by design.

import React from "react";
import { T, PLATFORMS, MODES, type ShellRoute } from "@/lib/design-tokens";
import type { Platform } from "@/lib/forecast";

export interface PoolStats {
  videos:   number;
  creators: number;
  shorts:   number;
  keywords: number;
}

interface SidebarProps {
  route:      ShellRoute;
  setRoute:   (r: ShellRoute) => void;
  platform:   Platform;
  setPlatform:(p: Platform) => void;
  mode:       string;
  setMode:    (m: string) => void;
  pool:       PoolStats;
}

export default function Sidebar({ route, setRoute, platform, setPlatform, mode, setMode, pool }: SidebarProps) {
  const platforms = Object.values(PLATFORMS);

  return (
    <aside style={{
      width: 240, flexShrink: 0, height: "100%",
      background: T.bgDeep,
      borderRight: `1px solid ${T.line}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Brand */}
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 5,
          background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, fontSize: 12, color: T.bgDeep,
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
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={`${m.label} — ${m.desc}`}
                  style={{
                    padding: m.id === "OLR" ? "7px 2px" : "7px 0", minHeight: 28,
                    border: `1px solid ${active ? m.color : T.lineMid}`,
                    background: active ? m.color + "22" : "transparent",
                    color: active ? m.color : T.inkDim,
                    borderRadius: 3, cursor: "pointer",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: m.id === "OLR" ? 9 : 11, fontWeight: 600,
                  }}
                >{m.id}</button>
              );
            })}
            <button style={{
              padding: "7px 0", border: `1px solid ${T.lineMid}`, background: "transparent",
              color: T.inkMuted, borderRadius: 3,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>ALL</button>
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
    </aside>
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
