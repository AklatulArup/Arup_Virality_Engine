"use client";

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY DRAWER — persistent bottom drawer
// ═══════════════════════════════════════════════════════════════════════════
//
// Shows recent analysis history across all pages. Ported from
// `app-chrome.jsx::HistoryDrawer`. Entries come from /api/analysis-history
// which Dashboard.tsx has always persisted to via the analyze flow.

import React, { useEffect, useState } from "react";
import { T } from "@/lib/design-tokens";
import StarField from "./StarField";

interface HistoryEntry {
  id:           string;
  url:          string;
  platform:     string;
  title:        string;
  channelName?: string;
  checkedAt:    string;
  metrics:      Record<string, number | string>;
}

interface HistoryDrawerProps {
  open:     boolean;
  onToggle: () => void;
}

export default function HistoryDrawer({ open, onToggle }: HistoryDrawerProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    fetch("/api/analysis-history")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d)) setEntries(d.slice(0, 8));
        else if (Array.isArray(d?.entries)) setEntries(d.entries.slice(0, 8));
      })
      .catch(() => {});
  }, [open]);

  return (
    <div style={{
      background: T.bgDeep,
      borderTop: `1px solid ${T.line}`,
      flexShrink: 0, position: "relative", zIndex: 5,
    }}>
      <div
        style={{
          padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div>
          <div style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>Analysis History</div>
          <div style={{
            fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5, letterSpacing: 1.4,
            color: T.inkFaint, textTransform: "uppercase", marginTop: 1,
          }}>
            Cross-Reference · Track Changes Over Time{entries.length > 0 ? ` · ${entries.length} entries` : ""}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            marginLeft: "auto", padding: "5px 10px", borderRadius: 3,
            background: "transparent", border: `1px solid ${T.line}`,
            color: T.inkDim, fontFamily: "IBM Plex Mono, monospace", fontSize: 10, cursor: "pointer",
          }}
        >{open ? "× Close" : "▴ Open"}</button>
      </div>

      {open && (
        <div style={{
          height: entries.length > 0 ? "auto" : 70,
          maxHeight: 240,
          borderTop: `1px solid ${T.line}`,
          background: "rgba(255,255,255,0.012)",
          position: "relative", overflow: "hidden",
        }}>
          {entries.length === 0 ? (
            <div style={{
              height: 70, display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <StarField />
              <div style={{
                fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
                color: T.inkMuted, position: "relative", zIndex: 1,
              }}>
                No analysis history yet. Analyse a video or channel to begin tracking.
              </div>
            </div>
          ) : (
            <div style={{ padding: "8px 20px", overflowY: "auto", maxHeight: 240 }}>
              {entries.map((e, i) => (
                <div
                  key={e.id ?? i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 60px 1fr 100px 100px",
                    gap: 12, padding: "8px 0",
                    borderBottom: i < entries.length - 1 ? `1px solid ${T.line}` : "none",
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim,
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: T.inkFaint }}>{fmtTime(e.checkedAt)}</span>
                  <span style={{ color: T.inkMuted }}>{e.platform}</span>
                  <span style={{ color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.title || e.url}
                  </span>
                  <span style={{ color: T.inkMuted }}>{e.channelName ?? ""}</span>
                  <span style={{ color: T.ink, textAlign: "right" }}>
                    {typeof e.metrics?.views === "number" ? fmtCompact(e.metrics.views) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function fmtCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}
