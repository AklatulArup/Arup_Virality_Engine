"use client";

// Z2 — six KPI cards. Every card: label + mono value + a "so what" sub-label.

import type { Forecast } from "@/lib/forecast";
import { Card, CardContent } from "@/components/ui/card";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// Plain-English distribution stage (lifecycle tier translated per the
// language rule — never raw tier ids).
export function stageLabel(tier: string | undefined | null): { label: string; tone: "pos" | "neg" | "neutral" } {
  switch (tier) {
    case "tier-1-hook": return { label: "Testing", tone: "neutral" };
    case "tier-1-stuck": return { label: "Stalled early", tone: "neg" };
    case "tier-2-rising": return { label: "Picking up", tone: "pos" };
    case "tier-2-stuck": return { label: "Stalled mid", tone: "neg" };
    case "tier-3-viral": return { label: "Going viral", tone: "pos" };
    case "tier-4-plateau": return { label: "Peaked", tone: "neutral" };
    default: return { label: "—", tone: "neutral" };
  }
}

export interface CompletenessSummary {
  measured: number;
  aiEstimated: number;
  missing: number;
  total: number;
  pct: number;
}

export function completenessOf(f: Forecast): CompletenessSummary {
  const measured = f.dataUsed.filter((d) => d.source === "manual").length;
  const aiEstimated = f.dataEstimated.length;
  const missing = f.dataMissing.filter((d) => d.userCanProvide).length;
  const total = measured + aiEstimated + missing;
  return { measured, aiEstimated, missing, total, pct: total > 0 ? Math.round((measured / total) * 100) : 100 };
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "pos" | "neg" | "neutral" }) {
  const valueColor = tone === "pos" ? "#2ECC8A" : tone === "neg" ? "#F0B35A" : "#E8E6E1";
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-[22px] font-medium leading-tight" style={{ color: valueColor }}>
          {value}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export function KpiRow({ forecast: f }: { forecast: Forecast }) {
  const score = f.scoreMultiplier.score;
  const vsNormal = f.baseline && f.baseline.median > 0 ? f.lifetime.median / f.baseline.median : null;
  const stage = stageLabel(f.lifecycleTier?.tier);
  const pace = f.trajectory?.outperformance ?? null;
  const comp = completenessOf(f);

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Readiness"
        value={score.toFixed(0)}
        sub="Setup quality before the algorithm decides"
        tone={score >= 65 ? "pos" : score < 40 ? "neg" : "neutral"}
      />
      <Kpi
        label="Vs. their normal"
        value={vsNormal != null ? `×${vsNormal >= 10 ? Math.round(vsNormal) : vsNormal.toFixed(1)}` : "—"}
        sub={f.baseline ? `Forecast vs. their median ${fmtCompact(f.baseline.median)}` : "No baseline yet"}
        tone={vsNormal != null && vsNormal > 1.2 ? "pos" : vsNormal != null && vsNormal < 0.8 ? "neg" : "neutral"}
      />
      <Kpi label="Day-7 views" value={f.d7.median > 0 ? fmtCompact(f.d7.median) : "—"} sub="Expected one week in" />
      <Kpi
        label="Distribution stage"
        value={stage.label}
        sub="Where the platform's testing process has put it"
        tone={stage.tone}
      />
      <Kpi
        label="Pace right now"
        value={pace != null ? `×${pace >= 100 ? Math.round(pace).toLocaleString() : pace.toFixed(2)}` : "—"}
        sub="Actual views vs. expected at this age — live"
        tone={pace != null && pace >= 1.15 ? "pos" : pace != null && pace < 0.85 ? "neg" : "neutral"}
      />
      <Kpi
        label="Data completeness"
        value={`${comp.pct}%`}
        sub={`${comp.measured} of ${comp.total} high-value inputs measured — more data, tighter range`}
        tone={comp.pct >= 60 ? "pos" : comp.pct < 30 ? "neg" : "neutral"}
      />
    </div>
  );
}
