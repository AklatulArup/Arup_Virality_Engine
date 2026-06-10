"use client";

// "Algorithm read" — the skill's quantified verdict on this post: gate table
// with Wilson-bounded verdicts, calibrated (or prior) virality probability,
// wave ratios → phase ceiling, projected views at the standard horizons,
// weakest gate + phase-matched coaching, honest caveats.

import { useState } from "react";
import type { PredictionContract, GateResult } from "@/lib/scoring/canon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BrainCircuit } from "lucide-react";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

const GATE_LABELS: Record<string, string> = {
  C_comp: "Completion",
  V_vs: "Viewed vs swiped",
  H_3s: "3-second hold",
  CTR: "Click-through",
  R_30s: "30s retention",
  e_1hr: "First-hour velocity",
  hook_2s: "2-second hook",
  originality: "Originality",
  TweepCred: "Account score",
};

function VerdictChip({ v }: { v: GateResult["verdict"] }) {
  const map = {
    pass: { label: "PASS", color: "#2ECC8A" },
    fail: { label: "FAIL", color: "#E4574E" },
    insufficient_evidence: { label: "NOT ENOUGH DATA", color: "#F0B35A" },
  } as const;
  const c = map[v];
  return (
    <Badge variant="outline" className="font-mono text-[9px]" style={{ color: c.color, borderColor: `${c.color}55` }}>
      {c.label}
    </Badge>
  );
}

export function AlgorithmReadCard({ contract, loading }: { contract: PredictionContract | null; loading: boolean }) {
  const [showCaveats, setShowCaveats] = useState(false);

  if (loading && !contract) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
            <BrainCircuit className="size-4 text-[#9B87E8]" />
            Algorithm read
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!contract) return null;

  const p = contract.virality_probability;
  const ceiling = contract.wave.ceiling;
  const proj = contract.projected_views;
  const horizons: Array<[string, number | null]> = [
    ["24h", proj.h24],
    ["72h", proj.h72],
    ["7d", proj.d7],
    ["30d", proj.d30],
  ];

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between pb-0">
        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
          <BrainCircuit className="size-4 text-[#9B87E8]" />
          Algorithm read
          <span className="font-mono text-[10px] font-normal text-muted-foreground">phase-gated · Wilson-bounded</span>
        </CardTitle>
        {p != null ? (
          <div className="text-right">
            <span className="font-mono text-[20px] font-medium text-foreground">{Math.round(p * 100)}%</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">virality probability</span>
            <Badge
              variant="outline"
              className="ml-2 font-mono text-[9px]"
              style={
                contract.probability_basis === "calibrated"
                  ? { color: "#2ECC8A", borderColor: "#2ECC8A55" }
                  : { color: "#F0B35A", borderColor: "#F0B35A55" }
              }
            >
              {contract.probability_basis}
            </Badge>
          </div>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">needs the platform&apos;s spine metric</span>
        )}
      </CardHeader>
      <CardContent>
        {/* Gates */}
        <div className="divide-y divide-border">
          {contract.gates.map((g) => (
            <div key={g.name} className="flex items-baseline gap-3 py-2">
              <span className="w-[150px] shrink-0 text-[12px] text-foreground">
                {GATE_LABELS[g.name] ?? g.name}
                <span className="ml-1.5 font-mono text-[9.5px] text-muted-foreground">{g.name}</span>
              </span>
              <span className="w-[170px] shrink-0 font-mono text-[11.5px] text-muted-foreground">
                {g.value != null ? (
                  <>
                    {(g.value * (g.name === "TweepCred" || g.name === "originality" ? 1 : 100)).toFixed(g.name === "TweepCred" ? 0 : 1)}
                    {g.name === "TweepCred" || g.name === "originality" ? "" : "%"}
                    {g.n != null ? ` (n=${g.n.toLocaleString()})` : ""}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className="w-[200px] shrink-0 font-mono text-[11px] text-muted-foreground">
                {g.wilson_lb != null
                  ? `95% floor ${(g.wilson_lb * 100).toFixed(1)}% vs gate ${(g.threshold * 100).toFixed(0)}%`
                  : g.name === "TweepCred"
                    ? `gate ≥ ${g.threshold}`
                    : `gate ${(g.threshold * 100).toFixed(0)}%`}
              </span>
              <span className="ml-auto">
                <VerdictChip v={g.verdict} />
              </span>
            </div>
          ))}
        </div>

        {/* Wave + projections */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[6px] border border-border bg-background px-4 py-3 font-mono text-[11.5px]">
          <span className="text-muted-foreground">
            spread per wave m̂:{" "}
            <span className="text-foreground">
              {contract.wave.m_hat_per_wave.length > 0 ? contract.wave.m_hat_per_wave.join(" → ") : "—"}
            </span>
          </span>
          <span className="text-muted-foreground">
            ceiling:{" "}
            <span className="text-foreground" style={ceiling === "unbounded" ? { color: "#2ECC8A" } : undefined}>
              {ceiling === "unbounded" ? "unbounded (Phase 4 trajectory)" : ceiling != null ? fmtCompact(ceiling) : "—"}
            </span>
          </span>
          <span className="text-muted-foreground">
            projected:{" "}
            {horizons.map(([label, v], i) => (
              <span key={label}>
                {i > 0 ? " · " : ""}
                {label} <span className="text-foreground">{v != null ? fmtCompact(v) : "—"}</span>
              </span>
            ))}
          </span>
        </div>

        {/* Weakest gate + coaching */}
        {contract.coaching ? (
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            {contract.weakest_gate ? (
              <span className="text-foreground">
                Weakest link: {GATE_LABELS[contract.weakest_gate] ?? contract.weakest_gate}.{" "}
              </span>
            ) : null}
            {contract.coaching}
          </p>
        ) : null}

        {/* Caveats */}
        {contract.caveats.length > 0 ? (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 font-mono text-[10.5px] text-muted-foreground"
              onClick={() => setShowCaveats((s) => !s)}
            >
              {showCaveats ? "hide" : "show"} {contract.caveats.length} caveat{contract.caveats.length === 1 ? "" : "s"}
            </Button>
            {showCaveats ? (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">
                {contract.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
