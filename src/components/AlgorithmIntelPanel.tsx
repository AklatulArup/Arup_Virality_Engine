"use client";

import { useState } from "react";
import type { PlatformId } from "@/lib/types";
import { PLATFORM_INTEL } from "@/lib/algorithm-intel";
import ConfidenceLabel from "./ConfidenceLabel";

interface AlgorithmIntelPanelProps {
  highlightPlatform?: PlatformId;
}

const PLATFORM_ORDER: PlatformId[] = [
  "youtube",
  "youtube-shorts",
  "tiktok",
  "instagram",
  "x",
];

const WEIGHT_COLORS: Record<string, string> = {
  highest: "var(--color-vrs-excellent)",
  strong: "var(--color-vrs-strong)",
  moderate: "var(--color-vrs-competitive)",
  low: "var(--color-text-[#9E9C97])",
};

export default function AlgorithmIntelPanel({
  highlightPlatform = "youtube",
}: AlgorithmIntelPanelProps) {
  const [activePlatform, setActivePlatform] =
    useState<PlatformId>(highlightPlatform);

  const platform = PLATFORM_INTEL[activePlatform];
  if (!platform) return null;

  return (
    <div className="space-y-3">
      {/* Platform tabs */}
      <div className="flex gap-1 flex-wrap">
        {PLATFORM_ORDER.map((pid) => {
          const p = PLATFORM_INTEL[pid];
          const isActive = pid === activePlatform;
          return (
            <button
              key={pid}
              onClick={() => setActivePlatform(pid)}
              className="text-[10px] font-mono px-2.5 py-1.5 rounded transition-colors"
              style={{
                background: isActive
                  ? "color-mix(in srgb, #60A5FA 15%, transparent)"
                  : "var(--color-surface)",
                color: isActive
                  ? "#60A5FA"
                  : "var(--color-text-subtle)",
                border: `1px solid ${isActive ? "color-mix(in srgb, #60A5FA 30%, transparent)" : "var(--color-border)"}`,
              }}
            >
              {p.icon} {p.name}
            </button>
          );
        })}
      </div>

      {/* Signals */}
      <div>
        <div className="text-[10px] text-[#9E9C97] font-mono mb-2">
          RANKING SIGNALS
        </div>
        <div className="space-y-1.5">
          {platform.signals.map((s) => (
            <div
              key={s.name}
              className="flex items-start gap-2 p-2 rounded bg-surface"
            >
              <div
                className="w-[6px] h-[6px] rounded-full shrink-0 mt-1.5"
                style={{ background: WEIGHT_COLORS[s.weight] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold">{s.name}</span>
                  <span
                    className="text-[8px] font-mono px-1 py-0.5 rounded"
                    style={{
                      color: WEIGHT_COLORS[s.weight],
                      background: `color-mix(in srgb, ${WEIGHT_COLORS[s.weight]} 12%, transparent)`,
                    }}
                  >
                    {s.weight.toUpperCase()}
                  </span>
                  <ConfidenceLabel level={s.confidence} />
                </div>
                <div className="text-[10px] text-subtle mt-0.5 leading-relaxed">
                  {s.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: Key Behaviors + Optimal Formats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-[#9E9C97] font-mono mb-1.5">
            KEY BEHAVIORS
          </div>
          <div className="space-y-1">
            {platform.keyBehaviors.map((b, i) => (
              <div key={i} className="flex gap-1.5 text-[10px] text-subtle leading-relaxed">
                <span className="text-[#60A5FA] shrink-0">&#9656;</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#9E9C97] font-mono mb-1.5">
            OPTIMAL FORMATS
          </div>
          <div className="space-y-1">
            {platform.optimalFormats.map((f, i) => (
              <div key={i} className="flex gap-1.5 text-[10px] text-subtle leading-relaxed">
                <span style={{ color: "var(--color-vrs-strong)" }} className="shrink-0">&#10003;</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anti-patterns */}
      <div>
        <div className="text-[10px] text-[#9E9C97] font-mono mb-1.5">
          ANTI-PATTERNS (AVOID)
        </div>
        <div className="space-y-1">
          {platform.antiPatterns.map((a, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-subtle leading-relaxed">
              <span style={{ color: "var(--color-vrs-rework)" }} className="shrink-0">&#10007;</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[9px] text-border-light text-right">
        Last updated: {platform.lastUpdated}
      </div>
    </div>
  );
}
