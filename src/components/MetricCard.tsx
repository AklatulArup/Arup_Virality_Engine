"use client";

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
}

export default function MetricCard({ label, value, color = "#E8E8FF" }: MetricCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="holo-card relative px-3 py-2 cursor-default select-none"
      style={{
        background: hovered
          ? `color-mix(in srgb, ${color} 8%, rgba(13,13,30,0.95))`
          : "rgba(13,13,30,0.8)",
        border: `1px solid color-mix(in srgb, ${color} ${hovered ? "35%" : "18%"}, transparent)`,
        borderRadius: 8,
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered
          ? `0 4px 20px color-mix(in srgb, ${color} 20%, transparent), 0 0 0 1px color-mix(in srgb, ${color} 25%, transparent)`
          : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Corner accent */}
      <div
        style={{
          position: "absolute",
          top: 0, right: 0,
          width: 16, height: 16,
          background: `linear-gradient(225deg, color-mix(in srgb, ${color} 40%, transparent), transparent)`,
          borderTopRightRadius: 8,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.25s",
        }}
      />
      <div
        className="text-[8px] font-mono uppercase tracking-widest mb-0.5"
        style={{ color: "rgba(232,232,255,0.45)" }}
      >
        {label}
      </div>
      <div
        className="text-[15px] font-extrabold font-mono leading-tight"
        style={{
          color,
          textShadow: hovered
            ? `0 0 10px color-mix(in srgb, ${color} 70%, transparent), 0 0 25px color-mix(in srgb, ${color} 35%, transparent)`
            : `0 0 6px color-mix(in srgb, ${color} 30%, transparent)`,
          transition: "text-shadow 0.25s",
        }}
      >
        {value}
      </div>
    </div>
  );
}
