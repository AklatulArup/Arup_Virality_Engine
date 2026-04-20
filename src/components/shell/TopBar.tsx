"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TOP BAR — URL input + Analyze button
// ═══════════════════════════════════════════════════════════════════════════
//
// Horizontal bar above the main content area. Contains a platform code chip
// (YTL / YTS / TTK / IGR / X), a URL input, and the Analyze action that
// triggers the fetch-then-navigate flow. Mirrors `app-chrome.jsx::TopBar`
// from the design handoff.

import React, { useState } from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import type { Platform } from "@/lib/forecast";

interface TopBarProps {
  platform:  Platform;
  onAnalyze: (url: string) => void;
  onMenu?:   () => void;
}

export default function TopBar({ platform, onAnalyze, onMenu }: TopBarProps) {
  const p = PLATFORMS[platform];
  const [url, setUrl] = useState("");

  const submit = () => {
    const trimmed = url.trim();
    if (trimmed) onAnalyze(trimmed);
  };

  return (
    <div style={{
      padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
      borderBottom: `1px solid ${T.line}`, background: T.bgDeep,
    }}>
      {onMenu && (
        <button onClick={onMenu} aria-label="Menu" style={{
          width: 32, height: 32, borderRadius: 4, background: T.bgPanel,
          border: `1px solid ${T.line}`, color: T.inkDim, cursor: "pointer",
          fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
        }}>☰</button>
      )}

      <div style={{
        padding: "6px 12px", borderRadius: 4,
        background: p.bg, border: `1px solid ${p.color}55`, color: p.color,
        fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      }}>
        <span>{p.icon}</span>{p.code}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{
          flex: 1, position: "relative", display: "flex", alignItems: "center",
          background: T.bgPanel, border: `1px solid ${T.line}`, borderRadius: 4,
        }}
      >
        <span style={{ padding: "0 10px", color: T.inkFaint, fontSize: 12 }}>⌕</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={`Paste a ${p.short} URL, channel @handle, or video link…`}
          style={{
            flex: 1, padding: "9px 4px", background: "transparent", border: "none",
            color: T.ink, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, outline: "none",
          }}
        />
      </form>

      <button
        onClick={submit}
        disabled={!url.trim()}
        style={{
          padding: "9px 16px", borderRadius: 4,
          background: url.trim() ? T.purpleDim : T.bgPanel,
          border: `1px solid ${url.trim() ? `${T.purple}55` : T.line}`,
          color: url.trim() ? T.purple : T.inkDim,
          fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
          cursor: url.trim() ? "pointer" : "default",
          display: "flex", alignItems: "center", gap: 6,
          opacity: url.trim() ? 1 : 0.7,
        }}
      >→ Analyze</button>
    </div>
  );
}
