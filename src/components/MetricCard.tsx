"use client";

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  tip?: string;
  index?: number;
}

export default function MetricCard({
  label,
  value,
  color = "#60A5FA",
  tip,
  index = 0,
}: MetricCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      title={tip}
      className="metric-card cursor-default select-none"
      style={{
        animationDelay: `${index * 0.05}s`,
        animation: "fadeUpIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Colour accent line top */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
          opacity: hovered ? 1 : 0.5,
          transition: "opacity 0.2s",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Glow orb behind value */}
      <div
        style={{
          position: "absolute",
          bottom: -20, right: -20,
          width: 80, height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.3s",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          className="font-mono uppercase tracking-widest mb-2"
          style={{ fontSize: 9, color: "rgba(232,230,225,0.35)", letterSpacing: "0.12em" }}
        >
          {label}
        </div>
        <div
          className="font-mono font-extrabold leading-none"
          style={{
            fontSize: 20,
            color,
            textShadow: hovered
              ? `0 0 12px ${color}88, 0 0 28px ${color}44`
              : `0 0 8px ${color}44`,
            transition: "text-shadow 0.25s",
          }}
        >
          {value}
        </div>
      </div>

      {/* Bottom hover glow */}
      {hovered && (
        <div
          style={{
            position: "absolute", inset: 0,
            borderRadius: "inherit",
            background: `radial-gradient(ellipse at 50% 100%, ${color}0A 0%, transparent 65%)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
    </div>
  );
}
