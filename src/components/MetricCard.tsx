"use client";

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  tip?: string;
  index?: number;
}

// Icon map per label
const ICONS: Record<string, string> = {
  "Total Views":  "◈",
  "Views":        "◈",
  "Likes":        "♥",
  "Comments":     "◎",
  "Engagement":   "◆",
  "Velocity":     "▶",
  "Subscribers":  "✦",
  "Ch. Median":   "⊟",
  "Videos":       "▦",
  "Creators":     "◉",
  "Avg Views":    "◈",
  "Avg Engage":   "◆",
  "Top Views":    "★",
  "Pool videos":  "▦",
  "Avg views":    "◈",
};

export default function MetricCard({
  label,
  value,
  color = "#60A5FA",
  tip,
  index = 0,
}: MetricCardProps) {
  const [hovered, setHovered] = useState(false);
  const icon = ICONS[label] ?? "◈";

  return (
    <div
      title={tip}
      className="cursor-default select-none"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 12,
        background: hovered ? `rgba(255,255,255,0.06)` : "rgba(255,255,255,0.038)",
        border: `1px solid ${hovered ? `${color}40` : "rgba(255,255,255,0.10)"}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 32px rgba(0,0,0,0.45), 0 0 20px ${color}20`
          : "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 12px rgba(0,0,0,0.3)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "all 0.18s cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden",
        animationDelay: `${index * 0.05}s`,
        animation: "fadeUpIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        opacity: hovered ? 1 : 0.55,
        transition: "opacity 0.2s",
        pointerEvents: "none",
      }} />

      {/* Icon chip */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}14`,
        border: `1px solid ${color}28`,
        color,
        fontSize: 14,
        boxShadow: hovered ? `0 0 12px ${color}40` : "none",
        transition: "box-shadow 0.2s",
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-mono uppercase"
          style={{ fontSize: 9, color: "rgba(232,230,225,0.40)", letterSpacing: "0.12em", marginBottom: 3 }}
        >
          {label}
        </div>
        <div
          className="font-mono font-extrabold leading-none"
          style={{
            fontSize: 19,
            color,
            textShadow: hovered
              ? `0 0 14px ${color}AA, 0 0 32px ${color}44`
              : `0 0 10px ${color}55`,
            transition: "text-shadow 0.25s",
            letterSpacing: "-0.01em",
          }}
        >
          {value}
        </div>
      </div>

      {/* Corner glow */}
      <div style={{
        position: "absolute", bottom: -16, right: -16,
        width: 60, height: 60, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0.3,
        transition: "opacity 0.3s",
        pointerEvents: "none",
      }} />
    </div>
  );
}
