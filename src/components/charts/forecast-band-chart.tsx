"use client";

// Trajectory chart: cumulative view projection with a low–high band, the
// expected (median) line, the creator-baseline reference, observed velocity
// samples as the solid "actual" line, and a "today" marker. Dumb component —
// the card computes the points; this renders. Only src/components/charts/*
// imports recharts (bundle isolation).

import { Area, ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface BandPoint {
  day: number;
  band: [number, number] | null;
  median: number | null;
  actual: number | null;
}

function fmtCompactViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export function ForecastBandChart({
  data,
  accent,
  baseline,
  todayDay,
}: {
  data: BandPoint[];
  accent: string;
  baseline: number | null;
  todayDay: number | null;
}) {
  const config: ChartConfig = {
    median: { label: "Expected", color: accent },
    actual: { label: "Actual", color: "#E8E6E1" },
    band: { label: "Range", color: accent },
  };

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="day"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(d: number) => `d${Math.round(d)}`}
          tick={{ fontSize: 11, fill: "#7E7B75", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtCompactViews}
          tick={{ fontSize: 11, fill: "#7E7B75", fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label: unknown, payload: unknown) => {
                // Some hover targets pass a non-numeric label (mixed actual/
                // projection points) — fall back to the point's own day.
                const n = Number(label);
                if (Number.isFinite(n)) return `Day ${Math.round(n)}`;
                const p = payload as Array<{ payload?: { day?: number } }> | undefined;
                const d = p?.[0]?.payload?.day;
                return Number.isFinite(d) ? `Day ${Math.round(d!)}` : "—";
              }}
              formatter={(value: unknown, name: unknown) => {
                if (Array.isArray(value)) {
                  return [`${fmtCompactViews(value[0])} – ${fmtCompactViews(value[1])}`, "Range"];
                }
                return [fmtCompactViews(Number(value)), name === "actual" ? "Actual" : "Expected"];
              }}
            />
          }
        />
        <Area dataKey="band" stroke="none" fill={accent} fillOpacity={0.1} isAnimationActive={false} connectNulls />
        <Line dataKey="median" stroke={accent} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
        <Line
          dataKey="actual"
          stroke="#E8E6E1"
          strokeWidth={1.5}
          dot={{ r: 3, fill: "#E8E6E1", strokeWidth: 0 }}
          isAnimationActive={false}
          connectNulls
        />
        {baseline != null && baseline > 0 ? (
          <ReferenceLine
            y={baseline}
            stroke="rgba(255,255,255,0.16)"
            strokeDasharray="4 4"
            label={{ value: "creator normal", position: "insideTopRight", fontSize: 10, fill: "#7E7B75" }}
          />
        ) : null}
        {todayDay != null && todayDay > 0 ? (
          <ReferenceLine
            x={todayDay}
            stroke="rgba(255,255,255,0.16)"
            strokeDasharray="4 4"
            label={{ value: "today", position: "insideTopLeft", fontSize: 10, fill: "#7E7B75" }}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
