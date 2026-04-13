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
  accentColor = "var(--color-accent)",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(13,13,30,0.85)",
        border: open
          ? `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`
          : "1px solid rgba(99,102,241,0.18)",
        boxShadow: open
          ? `0 0 20px color-mix(in srgb, ${accentColor} 10%, transparent), inset 0 0 20px color-mix(in srgb, ${accentColor} 3%, transparent)`
          : "none",
        transition: "all 0.3s ease",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{
          background: open
            ? `color-mix(in srgb, ${accentColor} 6%, transparent)`
            : "transparent",
        }}
      >
        <span
          className="text-xs transition-transform duration-200 shrink-0"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            color: accentColor,
            filter: open ? `drop-shadow(0 0 4px ${accentColor})` : "none",
            transition: "transform 0.2s, filter 0.2s",
          }}
        >
          &#9654;
        </span>
        <div className="flex-1">
          <div
            className="text-[13px] font-semibold transition-colors"
            style={{ color: open ? accentColor : "var(--color-foreground)" }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>{subtitle}</div>
          )}
        </div>
        {open && (
          <div
            className="shrink-0 w-1.5 h-1.5 rounded-full"
            style={{
              background: accentColor,
              boxShadow: `0 0 6px ${accentColor}, 0 0 12px color-mix(in srgb, ${accentColor} 50%, transparent)`,
              animation: "glowPulse 2s ease-in-out infinite",
            }}
          />
        )}
      </button>
      {open && (
        <div
          className="px-4 pb-4"
          style={{
            borderTop: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`,
            paddingTop: 12,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
