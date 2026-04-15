"use client";

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  tip?: string;
  index?: number;
}

const ICONS: Record<string, string> = {
  "Total Views":  "👁",
  "Views":        "👁",
  "Likes":        "👍",
  "Comments":     "💬",
  "Engagement":   "⚡",
  "Velocity":     "🚀",
  "Subscribers":  "🔔",
  "Ch. Median":   "📊",
  "Videos":       "🎬",
  "Creators":     "✦",
  "Avg Views":    "◈",
  "Avg Engage":   "◆",
  "Top Views":    "★",
  "Pool videos":  "▦",
  "Avg views":    "◈",
};

// Geometric fallback icons (no emoji) — crisp monospace symbols
const GEO_ICONS: Record<string, string> = {
  "Total Views":  "◈",
  "Views":        "◈",
  "Likes":        "♥",
  "Comments":     "◎",
  "Engagement":   "◆",
  "Velocity":     "▶",
  "Subscribers":  "✦",
  "Ch. Median":   "⊟",
  "Videos Analyzed": "▦",
  "Total Views_b":"◈",
  "Avg Engagement":"◆",
  "Top Views":    "★",
  "Creators":     "◉",
};

export default function MetricCard({
  label,
  value,
  color = "#60A5FA",
  tip,
  index = 0,
}: MetricCardProps) {
  const [hovered, setHovered] = useState(false);
  const icon = GEO_ICONS[label] ?? "◈";

  return (
    <div
      title={tip}
      className="cursor-default select-none"
      style={{
        position: "relative",
        padding: "0",
        borderRadius: 14,
        overflow: "hidden",
        background: hovered ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${hovered ? `${color}50` : "rgba(255,255,255,0.11)"}`,
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 40px rgba(0,0,0,0.5), 0 0 24px ${color}22`
          : "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 16px rgba(0,0,0,0.35)",
        transform: hovered ? "translateY(-3px) scale(1.01)" : "translateY(0) scale(1)",
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        animationDelay: `${index * 0.06}s`,
        animation: "fadeUpIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Coloured top bar ── */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${color}00, ${color}CC, ${color}00)`,
        opacity: hovered ? 1 : 0.6,
        transition: "opacity 0.2s",
      }} />

      {/* ── Inner layout ── */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>

        {/* Icon square */}
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${color}22, ${color}0A)`,
          border: `1px solid ${color}35`,
          fontSize: 17,
          color,
          boxShadow: hovered ? `0 0 16px ${color}50, inset 0 1px 0 rgba(255,255,255,0.12)` : `inset 0 1px 0 rgba(255,255,255,0.08)`,
          transition: "box-shadow 0.22s",
          fontFamily: "monospace",
        }}>
          {icon}
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 9,
              color: "rgba(200,198,194,0.45)",
              letterSpacing: "0.14em",
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div
            className="font-mono font-black"
            style={{
              fontSize: 20,
              color,
              textShadow: hovered
                ? `0 0 16px ${color}CC, 0 0 40px ${color}55`
                : `0 0 12px ${color}66`,
              transition: "text-shadow 0.25s",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
        </div>
      </div>

      {/* Bottom ambient glow on hover */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 80% 110%, ${color}12 0%, transparent 60%)`,
          pointerEvents: "none",
          borderRadius: "inherit",
        }} />
      )}
    </div>
  );
}
