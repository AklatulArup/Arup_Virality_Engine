"use client";

import { useState, useEffect } from "react";
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
  A: "Explains distribution logic, ranking signals, and what drives reach in 2026.",
  B: "Surfaces the latest algorithm changes affecting content performance.",
  C: "Identifies why a video outperformed the channel median — hook, format, timing.",
  D: "Reverse-engineers viral content: structure, pacing, title, thumbnail patterns.",
  E: "Analyzes competitor strategies — what they post, how often, what's working.",
  F: "Full URL breakdown — pulls every signal for a deep virality audit.",
  G: "Virality Readiness Score (0–100) — rates algorithm push likelihood.",
  H: "Updates the platform intelligence knowledge base with fresh briefing data.",
};

const TOOLTIP_WIDTH = 220;

function ModeTooltip({ mode, anchorRect }: { mode: typeof MODES[number]; anchorRect: DOMRect }) {
  const left = anchorRect.right + 12;
  const top  = anchorRect.top + anchorRect.height / 2;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{ position: "fixed", left, top, transform: "translateY(-50%)", width: TOOLTIP_WIDTH, zIndex: 9999 }}
    >
      {/* Arrow */}
      <div style={{
        position: "absolute", left: -5, top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
        width: 8, height: 8,
        background: "#0A0A08",
        borderLeft: `1px solid rgba(255,255,255,0.1)`,
        borderBottom: `1px solid rgba(255,255,255,0.1)`,
      }} />
      {/* Card */}
      <div style={{
        background: "rgba(10,10,8,0.97)",
        border: `1px solid rgba(255,255,255,0.10)`,
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 20px ${mode.color}18`,
        backdropFilter: "blur(16px)",
      }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ fontSize: 14 }}>{mode.icon}</span>
          <div>
            <span className="text-[10px] font-bold font-mono tracking-widest block" style={{ color: mode.color }}>
              MODE {mode.id}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: "#E8E6E1" }}>
              {mode.label}
            </span>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed m-0" style={{ color: "#9E9C97" }}>
          {MODE_DESCRIPTIONS[mode.id] || mode.desc}
        </p>
      </div>
    </div>,
    document.body
  );
}

export default function ModeSelector({ activeModes, onToggle, onSelectAll, onClear }: ModeSelectorProps) {
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [anchorRect, setAnchorRect]   = useState<DOMRect | null>(null);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const hoveredMode = MODES.find(m => m.id === hoveredId) ?? null;

  return (
    <div className="px-1 py-0.5">
      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => {
          const active   = activeModes.includes(m.id);
          const isHovered = hoveredId === m.id;

          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              onMouseEnter={(e) => { setHoveredId(m.id); setAnchorRect(e.currentTarget.getBoundingClientRect()); }}
              onMouseLeave={() => { setHoveredId(null); setAnchorRect(null); }}
              className="flex items-center gap-1 font-mono cursor-pointer"
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                border: `1px solid`,
                background: active
                  ? `color-mix(in srgb, ${m.color} 12%, transparent)`
                  : "rgba(255,255,255,0.03)",
                borderColor: active
                  ? `color-mix(in srgb, ${m.color} 35%, transparent)`
                  : "rgba(255,255,255,0.08)",
                color: active ? m.color : "#6B6860",
                transform: isHovered ? "scale(1.06)" : "scale(1)",
                transition: "all 0.15s ease",
                boxShadow: active
                  ? `0 0 8px color-mix(in srgb, ${m.color} 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)`
                  : isHovered
                    ? `0 0 0 1px rgba(255,255,255,0.1), 0 0 10px rgba(255,255,255,0.04)`
                    : "none",
              }}
            >
              <span style={{ fontSize: 9 }}>{m.icon}</span>
              {m.id}
            </button>
          );
        })}

        <button
          onClick={onSelectAll}
          className="font-mono cursor-pointer"
          style={{
            padding: "3px 7px", borderRadius: 6, fontSize: 9, fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
            color: "#6B6860", letterSpacing: "0.08em",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#E8E6E1"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#6B6860"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          ALL
        </button>
        <button
          onClick={onClear}
          className="font-mono cursor-pointer"
          style={{
            padding: "3px 7px", borderRadius: 6, fontSize: 9, fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
            color: "#6B6860", letterSpacing: "0.08em",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#FF4D6A"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,77,106,0.25)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#6B6860"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          CLR
        </button>
      </div>

      {mounted && hoveredMode && anchorRect && (
        <ModeTooltip mode={hoveredMode} anchorRect={anchorRect} />
      )}
    </div>
  );
}
