"use client";

import { useState, useEffect } from "react";
import { parseInput } from "@/lib/url-parser";

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  loading: boolean;
  status: string;
  error: string | null;
}

export default function UrlInput({ onAnalyze, loading, status, error }: UrlInputProps) {
  const [url, setUrl]               = useState("");
  const [detectedLabel, setLabel]   = useState("");
  const [focused, setFocused]       = useState(false);
  const hasUrl = url.trim().length > 0;

  useEffect(() => {
    // Derived state: parse input label when URL changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (url.trim().length > 5) setLabel(parseInput(url).label);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setLabel("");
  }, [url]);

  const handleSubmit = () => { if (hasUrl && !loading) onAnalyze(url.trim()); };

  return (
    <div className="flex items-center gap-2.5 w-full">
      {/* ── Input ── */}
      <div
        className="flex-1 flex items-center gap-3 rounded-xl overflow-hidden transition-all duration-200"
        style={{
          height: 44,
          padding: "0 14px",
          background: focused ? "rgba(8,8,6,0.95)" : "rgba(4,4,2,0.90)",
          backdropFilter: "blur(16px)",
          border: focused ? "1px solid rgba(96,165,250,0.55)" : "1px solid rgba(255,255,255,0.12)",
          boxShadow: focused
            ? "0 0 0 3px rgba(96,165,250,0.12), 0 0 24px rgba(96,165,250,0.08), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: focused ? 0.7 : 0.3, transition: "opacity 0.2s" }}>
          <circle cx="6.5" cy="6.5" r="5" stroke="#60A5FA" strokeWidth="1.4"/>
          <path d="M10.5 10.5L13 13" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>

        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Paste a YouTube URL, channel @handle, or video link…"
          className="flex-1 bg-transparent border-none outline-none"
          style={{ fontSize: 13.5, color: "#E8E6E1", caretColor: "#60A5FA", letterSpacing: "0.01em" }}
        />

        {detectedLabel && (
          <span
            className="shrink-0 font-mono font-semibold"
            style={{
              fontSize: 9, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 99,
              background: "rgba(96,165,250,0.14)",
              border: "1px solid rgba(96,165,250,0.35)",
              color: "#60A5FA",
              boxShadow: "0 0 8px rgba(96,165,250,0.2)",
            }}
          >
            {detectedLabel}
          </span>
        )}
      </div>

      {/* ── Analyze button — YouTube blue ── */}
      <button
        onClick={handleSubmit}
        disabled={loading || !hasUrl}
        className="shrink-0 flex items-center gap-2 font-semibold rounded-xl"
        style={{
          height: 44, padding: "0 22px", fontSize: 13,
          background: hasUrl
            ? "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)"
            : "rgba(255,255,255,0.06)",
          color: hasUrl ? "#fff" : "#4A4845",
          border: hasUrl ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
          cursor: loading || !hasUrl ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: hasUrl
            ? "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(96,165,250,0.2), 0 0 20px rgba(96,165,250,0.35), 0 0 60px rgba(96,165,250,0.12)"
            : "none",
        }}
        onMouseEnter={e => {
          if (!loading && hasUrl) {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(96,165,250,0.4), 0 0 32px rgba(96,165,250,0.55), 0 0 80px rgba(96,165,250,0.2)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = hasUrl
            ? "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(96,165,250,0.2), 0 0 20px rgba(96,165,250,0.35), 0 0 60px rgba(96,165,250,0.12)"
            : "none";
          (e.currentTarget as HTMLButtonElement).style.transform = "none";
        }}
      >
        {loading ? (
          <span className="orbital-loader" style={{ width: 15, height: 15, borderWidth: 1.5 }} />
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5h9M8 3l3.5 3.5L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Analyze
          </>
        )}
      </button>
    </div>
  );
}
