"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ModeId } from "@/lib/types";
import { MODES } from "@/lib/modes";

interface ModeSelectorProps {
  activeModes: ModeId[];
  onToggle: (id: ModeId) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  A: "Explains how the platform algorithm works — distribution logic, ranking signals, and what drives reach in 2026.",
  B: "Surfaces the latest algorithm changes and platform updates affecting content performance.",
  C: "Identifies why a specific video outperformed the channel median — hook, format, timing, or topic signals.",
  D: "Reverse-engineers viral content to extract the exact formula: structure, pacing, title, thumbnail patterns.",
  E: "Analyzes competitor strategies — what they post, how often, what's working, and gaps you can exploit.",
  F: "Full URL breakdown — pulls every signal from a video or channel link for a deep virality audit.",
  G: "Virality Readiness Score (0–100) — rates how likely content is to be pushed by the algorithm.",
  H: "Updates the platform intelligence knowledge base with fresh algorithm briefing data.",
};

const TOOLTIP_WIDTH = 220;

function ModeTooltip({ mode, anchorRect }: { mode: typeof MODES[number]; anchorRect: DOMRect }) {
  // Place tooltip to the right of the sidebar (left edge = anchorRect.right + gap)
  const left = anchorRect.right + 10;
  const top = anchorRect.top + anchorRect.height / 2;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        left,
        top,
        transform: "translateY(-50%)",
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
      }}
    >
      {/* Left arrow */}
      <div
        style={{
          position: "absolute",
          left: -5,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          width: 9,
          height: 9,
          background: "#0E0E2A",
          borderLeft: `1px solid color-mix(in srgb, ${mode.color} 35%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${mode.color} 35%, transparent)`,
        }}
      />
      {/* Card */}
      <div
        className="rounded-xl px-3 py-2.5"
        style={{
          background: "#0E0E2A",
          border: `1px solid color-mix(in srgb, ${mode.color} 35%, transparent)`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.08)",
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base leading-none">{mode.icon}</span>
          <div>
            <span className="text-[11px] font-bold leading-none block" style={{ color: mode.color }}>
              Mode {mode.id}
            </span>
            <span className="text-[10px] font-semibold leading-none" style={{ color: "#F0F0FF" }}>
              {mode.label}
            </span>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed m-0" style={{ color: "#9090C0" }}>
          {MODE_DESCRIPTIONS[mode.id] || mode.desc}
        </p>
      </div>
    </div>,
    document.body
  );
}

export default function ModeSelector({
  activeModes,
  onToggle,
  onSelectAll,
  onClear,
}: ModeSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const hoveredMode = MODES.find(m => m.id === hoveredId) ?? null;

  return (
    <div className="px-1 py-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {MODES.map((m) => {
          const active = activeModes.includes(m.id);
          const isHovered = hoveredId === m.id;

          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              onMouseEnter={(e) => {
                setHoveredId(m.id);
                setAnchorRect(e.currentTarget.getBoundingClientRect());
              }}
              onMouseLeave={() => { setHoveredId(null); setAnchorRect(null); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold font-mono border cursor-pointer"
              style={{
                background: active
                  ? `color-mix(in srgb, ${m.color} 12%, transparent)`
                  : "transparent",
                borderColor: active
                  ? `color-mix(in srgb, ${m.color} 30%, transparent)`
                  : "rgba(139,92,246,0.18)",
                color: active ? m.color : "rgba(139,92,246,0.50)",
                transform: isHovered ? "scale(1.08)" : "scale(1)",
                transition: "transform 0.15s ease",
              }}
            >
              <span className="text-xs">{m.icon}</span>
              {m.id}
            </button>
          );
        })}

        <button
          onClick={onSelectAll}
          className="rounded px-1.5 py-0.5 text-[8px] font-mono border cursor-pointer"
          style={{ color: "rgba(139,92,246,0.45)", borderColor: "rgba(139,92,246,0.18)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#F0F0FF")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(139,92,246,0.45)")}
        >
          ALL
        </button>
        <button
          onClick={onClear}
          className="rounded px-1.5 py-0.5 text-[8px] font-mono border cursor-pointer"
          style={{ color: "rgba(139,92,246,0.45)", borderColor: "rgba(139,92,246,0.18)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#F0F0FF")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(139,92,246,0.45)")}
        >
          CLR
        </button>
      </div>

      {/* Portal tooltip — rendered into document.body, never clips */}
      {mounted && hoveredMode && anchorRect && (
        <ModeTooltip mode={hoveredMode} anchorRect={anchorRect} />
      )}
    </div>
  );
}
