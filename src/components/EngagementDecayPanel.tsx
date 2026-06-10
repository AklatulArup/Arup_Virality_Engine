"use client";

import type { EngagementDecay } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import CollapsibleSection from "./CollapsibleSection";

interface EngagementDecayPanelProps {
  decay: EngagementDecay;
  currentViews: number;
}

const PHASE_COLORS: Record<string, string> = {
  growth: "var(--color-vrs-excellent)",
  plateau: "var(--color-vrs-competitive)",
  decay: "var(--color-vrs-rework)",
  evergreen: "var(--color-accent-blue)",
};

export default function EngagementDecayPanel({ decay, currentViews }: EngagementDecayPanelProps) {
  const phaseColor = PHASE_COLORS[decay.currentPhase] || "#9E9C97";

  return (
    <CollapsibleSection
      title="Content Lifecycle"
      subtitle={`${decay.phaseLabel} \u00b7 ${formatNumber(Math.round(decay.dailyVelocity))}/day`}
      accentColor={phaseColor}
    >
      <div className="flex gap-4 items-start">
        {/* Phase indicator */}
        <div className="text-center">
          <div className="text-[20px] font-mono font-bold" style={{ color: phaseColor }}>
            {decay.phaseLabel}
          </div>
          <div className="text-[8px] text-[#9E9C97] mt-0.5">CURRENT PHASE</div>
        </div>

        {/* Metrics */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[8px] text-[#9E9C97] font-mono">DAILY VELOCITY</div>
            <div className="text-[12px] font-mono font-bold">{formatNumber(Math.round(decay.dailyVelocity))}</div>
          </div>
          <div>
            <div className="text-[8px] text-[#9E9C97] font-mono">WEEKLY VELOCITY</div>
            <div className="text-[12px] font-mono font-bold">{formatNumber(decay.weeklyVelocity)}</div>
          </div>
          <div>
            <div className="text-[8px] text-[#9E9C97] font-mono">DECAY RATE</div>
            <div className="text-[12px] font-mono font-bold" style={{ color: decay.decayRate > 0.5 ? "var(--color-vrs-rework)" : "var(--color-vrs-excellent)" }}>
              {Math.round(decay.decayRate * 100)}%
            </div>
          </div>
          <div>
            <div className="text-[8px] text-[#9E9C97] font-mono">EST. LIFETIME VIEWS</div>
            <div className="text-[12px] font-mono font-bold" style={{ color: "#60A5FA" }}>
              {formatNumber(decay.estimatedLifetimeViews)}
            </div>
          </div>
        </div>
      </div>

      {/* Visual lifecycle bar */}
      <div className="mt-3">
        <div className="flex h-2 rounded-sm overflow-hidden bg-background">
          {["growth", "plateau", "decay", "evergreen"].map((phase) => (
            <div
              key={phase}
              className="h-full transition-all"
              style={{
                flex: phase === decay.currentPhase ? 2 : 1,
                background: PHASE_COLORS[phase],
                opacity: phase === decay.currentPhase ? 0.8 : 0.15,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          {["Growth", "Plateau", "Decay", "Evergreen"].map((label) => (
            <span key={label} className="text-[7px] text-[#9E9C97] font-mono">{label}</span>
          ))}
        </div>
      </div>

      {/* Progress bar: current vs lifetime */}
      <div className="mt-2.5">
        <div className="flex justify-between text-[8px] font-mono text-[#9E9C97] mb-0.5">
          <span>Current: {formatNumber(currentViews)}</span>
          <span>Projected: {formatNumber(decay.estimatedLifetimeViews)}</span>
        </div>
        <div className="h-2 rounded-sm overflow-hidden bg-background">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${Math.min(100, (currentViews / decay.estimatedLifetimeViews) * 100)}%`,
              background: phaseColor,
              opacity: 0.6,
            }}
          />
        </div>
      </div>

      {decay.isEvergreen && (
        <div className="mt-2 text-[9px] font-mono px-2 py-1 rounded" style={{ background: "rgba(96,165,250,0.08)", color: "var(--color-accent-blue)" }}>
          &#x1F331; Evergreen content — this video continues generating consistent views over time
        </div>
      )}

      <div className="mt-2 text-[8px] text-[#9E9C97]">{decay.phaseBasis}</div>
    </CollapsibleSection>
  );
}
