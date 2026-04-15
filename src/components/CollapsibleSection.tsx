"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  accentColor = "#60A5FA",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        position: "relative",
        background: open ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.025)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${open ? `${accentColor}30` : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.25s",
        boxShadow: open
          ? `inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}08`
          : "inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Accent top border line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: open
          ? `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`
          : "transparent",
        transition: "background 0.25s",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-left"
        style={{
          padding: "14px 18px",
          background: "transparent",
          cursor: "pointer",
          border: "none",
          outline: "none",
        }}
      >
        {/* Arrow */}
        <span
          style={{
            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: open ? `${accentColor}20` : "rgba(255,255,255,0.05)",
            border: `1px solid ${open ? `${accentColor}40` : "rgba(255,255,255,0.08)"}`,
            color: open ? accentColor : "#6B6860",
            fontSize: 8, fontWeight: 700,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s, background 0.2s, color 0.2s, box-shadow 0.2s",
            boxShadow: open ? `0 0 8px ${accentColor}40` : "none",
          }}
        >
          ▶
        </span>

        <div className="flex-1 min-w-0">
          <div
            style={{
              fontSize: 13, fontWeight: 600,
              color: open ? "#E8E6E1" : "#B8B6B1",
              transition: "color 0.2s",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              className="font-mono"
              style={{ fontSize: 10, marginTop: 2, color: "#5E5A57", letterSpacing: "0.04em" }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Open/close pill */}
        <span
          className="font-mono shrink-0"
          style={{
            fontSize: 8, letterSpacing: "0.1em", padding: "2px 7px", borderRadius: 99,
            background: open ? `${accentColor}15` : "rgba(255,255,255,0.04)",
            border: `1px solid ${open ? `${accentColor}30` : "rgba(255,255,255,0.08)"}`,
            color: open ? accentColor : "#5E5A57",
            transition: "all 0.2s",
          }}
        >
          {open ? "OPEN" : "VIEW"}
        </span>
      </button>

      {/* Content */}
      {open && (
        <div
          style={{
            borderTop: `1px solid ${accentColor}18`,
            padding: "16px 18px",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
