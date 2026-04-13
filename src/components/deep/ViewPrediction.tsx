"use client";

import type { ViewPrediction as ViewPredictionType } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import ConfidenceLabel from "../ConfidenceLabel";
import SixMonthTimeline from "./SixMonthTimeline";

interface ViewPredictionProps {
  prediction: ViewPredictionType;
}

export default function ViewPrediction({ prediction }: ViewPredictionProps) {
  const range = prediction.high - prediction.low;
  const expectedPct =
    range > 0
      ? ((prediction.expected - prediction.low) / range) * 100
      : 50;

  const growthPct = Math.round((prediction.growthRate - 1) * 100);
  const isGrowing = growthPct > 0;

  return (
    <div className="space-y-4">
      {/* Main prediction bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-muted font-mono">
            PREDICTED VIEW RANGE FOR NEXT VIDEO
          </div>
          <ConfidenceLabel level={prediction.confidence} />
        </div>

        {/* Range visualization */}
        <div className="relative">
          {/* Background bar */}
          <div
            className="h-[40px] rounded-lg relative overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, color-mix(in srgb, var(--color-vrs-rework) 15%, transparent), color-mix(in srgb, var(--color-vrs-competitive) 15%, transparent), color-mix(in srgb, var(--color-vrs-excellent) 15%, transparent))",
            }}
          >
            {/* Expected marker */}
            <div
              className="absolute top-0 bottom-0 w-[3px] rounded-full"
              style={{
                left: `${Math.min(Math.max(expectedPct, 5), 95)}%`,
                background: "var(--color-accent)",
                boxShadow: "0 0 8px var(--color-accent)",
              }}
            />
          </div>

          {/* Labels below bar */}
          <div className="flex justify-between mt-1.5">
            <div className="text-left">
              <div className="text-[16px] font-bold font-mono" style={{ color: "var(--color-vrs-competitive)" }}>
                {formatNumber(prediction.low)}
              </div>
              <div className="text-[8px] text-muted font-mono">LOW</div>
            </div>
            <div className="text-center">
              <div
                className="text-[20px] font-extrabold font-mono"
                style={{ color: "var(--color-accent)" }}
              >
                {formatNumber(prediction.expected)}
              </div>
              <div className="text-[8px] text-muted font-mono">EXPECTED</div>
            </div>
            <div className="text-right">
              <div className="text-[16px] font-bold font-mono" style={{ color: "var(--color-vrs-excellent)" }}>
                {formatNumber(prediction.high)}
              </div>
              <div className="text-[8px] text-muted font-mono">HIGH</div>
            </div>
          </div>
        </div>
      </div>

      {/* Growth rate indicator */}
      <div className="flex items-center gap-3">
        <div className="bg-surface rounded-lg p-2.5 flex-1">
          <div className="text-[9px] text-muted font-mono">GROWTH RATE</div>
          <div
            className="text-[18px] font-bold font-mono mt-0.5"
            style={{
              color: isGrowing
                ? "var(--color-vrs-excellent)"
                : growthPct < 0
                  ? "var(--color-vrs-rework)"
                  : "var(--color-text-subtle)",
            }}
          >
            {isGrowing ? "+" : ""}
            {growthPct}%
          </div>
          <div className="text-[9px] text-muted">monthly</div>
        </div>
        <div className="bg-surface rounded-lg p-2.5 flex-1">
          <div className="text-[9px] text-muted font-mono">MULTIPLIER</div>
          <div className="text-[18px] font-bold font-mono mt-0.5">
            {prediction.growthRate.toFixed(2)}x
          </div>
          <div className="text-[9px] text-muted">vs historical</div>
        </div>
      </div>

      {/* Basis explanation */}
      <div className="text-[10px] text-subtle leading-relaxed">
        {prediction.basis}
      </div>

      {/* 6-Month Projection */}
      {prediction.sixMonthProjection && prediction.sixMonthProjection.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <SixMonthTimeline projections={prediction.sixMonthProjection} />
        </div>
      )}

      {/* Comparable videos */}
      {prediction.comparableVideos.length > 0 && (
        <div>
          <div className="text-[9px] text-muted font-mono mb-1.5">
            COMPARABLE VIDEOS USED FOR HIGH RANGE
          </div>
          <div className="space-y-1">
            {prediction.comparableVideos.map((v, i) => (
              <div
                key={i}
                className="flex justify-between py-0.5 border-b"
                style={{ borderColor: "rgba(139,92,246,0.06)" }}
              >
                <span className="text-[10px] text-subtle truncate mr-2 flex-1">
                  {v.title}
                </span>
                <span
                  className="text-[10px] font-mono font-bold shrink-0"
                  style={{ color: "var(--color-accent)" }}
                >
                  {formatNumber(v.views)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
