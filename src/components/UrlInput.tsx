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
  const [url, setUrl] = useState("");
  const [detectedLabel, setDetectedLabel] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (url.trim().length > 5) {
      const parsed = parseInput(url);
      setDetectedLabel(parsed.label);
    } else {
      setDetectedLabel("");
    }
  }, [url]);

  const handleSubmit = () => {
    if (url.trim() && !loading) onAnalyze(url.trim());
  };

  const hasUrl = url.trim().length > 0;

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Input container */}
      <div
        className="flex-1 flex items-center gap-2 rounded-[9px] px-3.5 overflow-hidden transition-all duration-200"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: focused
            ? "1px solid rgba(96,165,250,0.4)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: focused
            ? "0 0 0 3px rgba(96,165,250,0.07), inset 0 1px 0 rgba(96,165,250,0.05)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
          <circle cx="6" cy="6" r="4.5" stroke="#E8E6E1" strokeWidth="1.2"/>
          <path d="M10 10L12.5 12.5" stroke="#E8E6E1" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>

        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Paste YouTube URL, channel @handle, or video link..."
          className="flex-1 bg-transparent border-none outline-none text-[13px] py-2.5"
          style={{ color: "#E8E6E1", caretColor: "#60A5FA" }}
        />

        {/* Detected type badge */}
        {detectedLabel && (
          <span
            className="shrink-0 font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(96,165,250,0.10)",
              border: "1px solid rgba(96,165,250,0.2)",
              color: "#60A5FA",
              letterSpacing: "0.06em",
            }}
          >
            {detectedLabel}
          </span>
        )}
      </div>

      {/* Analyze button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !hasUrl}
        className="btn-cosmic shrink-0 flex items-center gap-2"
        style={{ minWidth: 96, justifyContent: "center", height: 40 }}
      >
        {loading ? (
          <span className="orbital-loader" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Analyze
          </>
        )}
      </button>
    </div>
  );
}
