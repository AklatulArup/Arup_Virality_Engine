"use client";

// Z5 — signals applied: every multiplier that moved this forecast, with a
// plain-English why. Top rows visible, the rest behind "Show all".

import { useState } from "react";
import type { Forecast, Platform } from "@/lib/forecast";
import type { useForecastBundle } from "@/hooks/use-forecast-bundle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

type Bundle = ReturnType<typeof useForecastBundle>;

interface SignalRow {
  name: string;
  effect: string;
  tone: "pos" | "neg" | "neutral";
  why: string;
}

function rowsFrom(f: Forecast, b: Bundle, platform: Platform): SignalRow[] {
  const rows: SignalRow[] = [];
  const tone = (x: number): "pos" | "neg" | "neutral" => (x > 1.02 ? "pos" : x < 0.98 ? "neg" : "neutral");

  rows.push({
    name: "Content readiness",
    effect: `×${f.scoreMultiplier.median.toFixed(2)}`,
    tone: tone(f.scoreMultiplier.median),
    why: f.scoreMultiplier.rationale,
  });

  if (Math.abs(b.seasonality.multiplier - 1) > 0.02) {
    rows.push({
      name: "Timing & market",
      effect: `×${b.seasonality.multiplier.toFixed(2)}`,
      tone: tone(b.seasonality.multiplier),
      why: b.seasonality.rationales.join(" · ") || "Day-of-week and market conditions.",
    });
  }
  if (b.niche.niche !== "unknown" && Math.abs(b.nicheAdj.multiplier - 1) > 0.02) {
    rows.push({
      name: `Niche — ${b.niche.niche.replace(/-/g, " ")}`,
      effect: `×${b.nicheAdj.multiplier.toFixed(2)}`,
      tone: tone(b.nicheAdj.multiplier),
      why: b.niche.rationale,
    });
  }
  if (Math.abs(b.reputation.multiplier - 1) > 0.02) {
    rows.push({
      name: "Creator reputation",
      effect: `×${b.reputation.multiplier.toFixed(2)}`,
      tone: tone(b.reputation.multiplier),
      why: b.reputation.rationale,
    });
  }
  if (Math.abs(b.crossPlatformRep.multiplier - 1) > 0.02 || b.crossPlatformRep.signals.polarized) {
    rows.push({
      name: "Standing on other platforms",
      effect: `×${b.crossPlatformRep.multiplier.toFixed(2)}`,
      tone: b.crossPlatformRep.signals.polarized ? "neg" : tone(b.crossPlatformRep.multiplier),
      why: b.crossPlatformRep.rationale,
    });
  }
  if (typeof b.sentimentScore === "number") {
    rows.push({
      name: "Comment sentiment",
      effect: `${Math.round(b.sentimentScore)}/100`,
      tone: b.sentimentScore >= 60 ? "pos" : b.sentimentScore < 40 ? "neg" : "neutral",
      why: b.sentimentRationale ?? "Positive comments widen the upside; negative ones compress it.",
    });
  }
  const overrides = b.configOverrides[platform];
  if (overrides && Object.keys(overrides).length > 0) {
    rows.push({
      name: "Engine adjustments",
      effect: `${Object.keys(overrides).length} active`,
      tone: "neutral",
      why: "Corrections the engine learned from past misses on this platform — see the Trust Center.",
    });
  }
  return rows;
}

export function SignalsCard({ forecast: f, bundle, platform }: { forecast: Forecast; bundle: Bundle; platform: Platform }) {
  const [showAll, setShowAll] = useState(false);
  const rows = rowsFrom(f, bundle, platform);
  const visible = showAll ? rows : rows.slice(0, 4);
  const toneColor = { pos: "#2ECC8A", neg: "#F0B35A", neutral: "#9E9C97" } as const;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">What moved this forecast</CardTitle>
      </CardHeader>
      <CardContent>
        {bundle.configOverridesFailed ? (
          <Alert className="mb-3 border-[#F0B35A]/30 text-[#F0B35A]">
            <TriangleAlert className="size-4" />
            <AlertDescription className="text-[12px] text-[#F0B35A]">
              Could not load the engine&apos;s learned adjustments — this forecast is running on platform defaults.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="divide-y divide-border">
          {visible.map((r) => (
            <div key={r.name} className="flex items-baseline gap-4 py-2.5">
              <span className="w-[210px] shrink-0 text-[12.5px] text-foreground">{r.name}</span>
              <span className="w-[72px] shrink-0 font-mono text-[12.5px] font-medium" style={{ color: toneColor[r.tone] }}>
                {r.effect}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground" title={r.why}>
                {r.why}
              </span>
            </div>
          ))}
        </div>
        {rows.length > 4 ? (
          <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-[11.5px] text-muted-foreground" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer" : `Show all ${rows.length}`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
