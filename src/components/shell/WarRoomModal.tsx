"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WAR ROOM MODAL — 9-seat round table overlay
// ═══════════════════════════════════════════════════════════════════════════
//
// Fullscreen modal with an SVG round table visualization: 9 expert seats
// arranged in a circle with connecting lines to a central node. Triggers
// nothing by itself — the "Run Analysis" button is a hook for the existing
// Expert War Room pipeline. Ported from `page-forecast.jsx::WarRoomModal`.

import React from "react";
import { T } from "@/lib/design-tokens";

interface WarRoomModalProps {
  open:     boolean;
  onClose:  () => void;
  onRun?:   () => void;
}

const EXPERTS: Array<{ label: string; sub: string; color: string; a: number }> = [
  { label: "Trend",       sub: "Analyst",      color: T.cyan,   a: -90 },
  { label: "Algorithm",   sub: "Analyst",      color: T.amber,  a: -50 },
  { label: "Audience",    sub: "Psychologist", color: T.purple, a: -10 },
  { label: "Content",     sub: "Strategist",   color: T.blue,   a:  30 },
  { label: "Reverse",     sub: "Engineer",     color: T.pink,   a:  70 },
  { label: "Creator",     sub: "Coach",        color: T.green,  a: 110 },
  { label: "Competitive", sub: "Intel",        color: T.red,    a: 150 },
  { label: "Risk",        sub: "Auditor",      color: "#B69DEB", a: 190 },
  { label: "Script",      sub: "Architect",    color: "#D999B6", a: 230 },
];

export default function WarRoomModal({ open, onClose, onRun }: WarRoomModalProps) {
  if (!open) return null;
  const W = 1000, H = 620, cx = W / 2, cy = H / 2, R = 220;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(7,8,10,0.88)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%", maxWidth: 1100, height: "86%",
          background: T.bgDeep, border: `1px solid ${T.line}`,
          borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, borderRadius: 3,
              background: T.bgPanel, border: `1px solid ${T.line}`,
              color: T.inkMuted, cursor: "pointer",
            }}
          >×</button>
          <div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>Expert War Room</div>
            <div style={{
              fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.2,
              color: T.inkFaint, textTransform: "uppercase", marginTop: 2,
            }}>9 experts · sequential deliberation</div>
          </div>
          <button
            onClick={onRun}
            style={{
              marginLeft: "auto", padding: "6px 14px", borderRadius: 3,
              background: T.redDim, border: `1px solid ${T.red}55`,
              color: T.red, fontFamily: "IBM Plex Mono, monospace",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >↯ Run Analysis</button>
        </div>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
            {/* scatter stars */}
            {Array.from({ length: 40 }).map((_, i) => (
              <circle
                key={i}
                cx={(i * 97) % W} cy={(i * 53) % H}
                r={0.7 + (i % 3) * 0.3}
                fill="#FFFFFF" opacity={0.1 + (i % 5) * 0.04}
              />
            ))}
            {/* rays to centre */}
            {EXPERTS.map((e, i) => {
              const a = e.a * Math.PI / 180;
              const ex = cx + Math.cos(a) * R;
              const ey = cy + Math.sin(a) * R;
              return (
                <line
                  key={`ray-${i}`}
                  x1={cx} y1={cy} x2={ex} y2={ey}
                  stroke={e.color} strokeOpacity="0.18" strokeDasharray="2 5"
                />
              );
            })}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" />
            <circle cx={cx} cy={cy} r={130} fill="none" stroke="rgba(255,255,255,0.08)" />
            <text x={cx} y={cy - 4} textAnchor="middle" fill={T.inkFaint}
                  fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="2">
              ROUND TABLE · 9 SEATS
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fill={T.inkMuted}
                  fontFamily="IBM Plex Sans, sans-serif" fontSize="12">
              Press Run Analysis to convene
            </text>
            {EXPERTS.map((e, i) => {
              const a = e.a * Math.PI / 180;
              const ex = cx + Math.cos(a) * R;
              const ey = cy + Math.sin(a) * R;
              const labelAbove = e.a < 0 || e.a > 180;
              const ly = labelAbove ? ey - 40 : ey + 42;
              return (
                <g key={`seat-${i}`}>
                  <rect x={ex - 20} y={ey - 20} width="40" height="40" rx="6"
                        fill={T.bgPanel} stroke={e.color} strokeOpacity="0.5" />
                  <text x={ex} y={ey + 4} textAnchor="middle"
                        fill={e.color} fontFamily="IBM Plex Mono, monospace"
                        fontSize="13" fontWeight="600">{e.label[0]}</text>
                  <text x={ex} y={ly} textAnchor="middle"
                        fill={T.inkDim} fontFamily="IBM Plex Mono, monospace"
                        fontSize="10" letterSpacing="1">{e.label.toUpperCase()}</text>
                  <text x={ex} y={ly + 12} textAnchor="middle"
                        fill={T.inkFaint} fontFamily="IBM Plex Sans, sans-serif" fontSize="10">
                    {e.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
