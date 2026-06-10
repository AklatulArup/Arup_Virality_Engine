"use client";

// Trust Center — the promoted /admin/calibration, rewritten in plain English.
// Answers: "can I trust these numbers in front of a partner, and is the
// engine getting smarter?" Jargon translation is enforced here:
//   direction accuracy → "Calls right" · Spearman ρ → "Ranking accuracy" ·
//   MdAPE → "Typical miss" · coverage → "Range hit rate" ·
//   conformal → "Learned ranges" · decay → "View build-up curves".

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/forecast";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { invalidateFetchOnce } from "@/hooks/fetch-once";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ── shapes (mirroring the API responses the admin page consumed) ──
interface CalReport {
  sampleSize: number;
  medianAPE: number;
  coverage: number;
  directionCorrect: number;
  spearman: number;
  meanSignedError: number;
  worstPredictions: Array<{ id: string; videoUrl?: string; predictedMedian: number; actualViews: number; apeError: number }>;
}
interface CalData {
  ok: boolean;
  report?: CalReport;
  suggestions?: Array<{
    platform: Platform;
    parameter: string;
    currentValue: number;
    suggestedValue: number;
    deltaPercent: number;
    confidence: string;
    sampleSize: number;
    rationale: string;
  }>;
  byPlatform?: Array<{ platform: Platform; report: CalReport }> | null;
  sampleSize?: number;
  withOutcomes?: number;
  message?: string;
}
interface Override {
  platform: Platform;
  parameter: string;
  deltaPercent: number;
  appliedAt: string;
  rationale: string;
}
interface KeyHealthReport {
  checkedAt: string;
  results: Array<{ service: string; keyVar: string; httpStatus: number | null; severity: "ok" | "warn" | "error" | "missing"; verdict: string; detail?: string }>;
  apifyCredit?: string;
  summary: { ok: number; warn: number; error: number; missing: number };
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ── Skill probability calibration (algorithm-math.md §4) ───────────────────

interface SkillCalReport {
  ranAt: string;
  sampleSize: number;
  positives: number;
  brierCandidate: number;
  brierFrozen: number;
  adopted: boolean;
  notes: string[];
  deciles: Array<{ decile: number; n: number; meanPredicted: number; hitRate: number }>;
}

function SkillCalibrationCard() {
  const [current, setCurrent] = useState<{ adoptedAt: string; brier: number; sampleSize: number } | null>(null);
  const [report, setReport] = useState<SkillCalReport | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/calibration/run")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setCurrent(d.current ?? null);
          setReport(d.lastReport ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const run = async () => {
    setRunning(true);
    try {
      const r = await fetch("/api/calibration/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json().catch(() => null);
      if (d?.ok && d.report) {
        setReport(d.report);
        if (d.report.adopted) {
          toast.success("New probability weights adopted — they beat the frozen ones on the backtest.");
          setCurrent({ adoptedAt: d.report.ranAt, brier: d.report.brierCandidate, sampleSize: d.report.sampleSize });
        } else {
          toast.info(d.report.notes?.[0] ?? "Run complete — frozen weights retained.");
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between pb-0">
        <div>
          <CardTitle className="text-[14px] font-semibold">Probability calibration (algorithm models)</CardTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Turns the algorithm-read scores into honest probabilities by fitting them against real outcomes. New
            weights are adopted only when they beat the current ones on held-out posts.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[11.5px]" onClick={() => void run()} disabled={running}>
          {running ? "Fitting…" : "Run calibration"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11.5px] text-muted-foreground">
          <span>
            Status:{" "}
            <span style={{ color: current ? "#2ECC8A" : "#F0B35A" }}>
              {current ? `calibrated (Brier ${current.brier.toFixed(3)}, n=${current.sampleSize})` : "prior — uncalibrated"}
            </span>
          </span>
          {report ? (
            <span>
              Last run: {new Date(report.ranAt).toLocaleDateString()} · n={report.sampleSize} ({report.positives} viral) ·
              candidate {Number.isFinite(report.brierCandidate) ? report.brierCandidate.toFixed(3) : "—"} vs frozen{" "}
              {Number.isFinite(report.brierFrozen) ? report.brierFrozen.toFixed(3) : "—"} · {report.adopted ? "ADOPTED" : "retained"}
            </span>
          ) : (
            <span>No runs yet — scores accumulate automatically; run once posts mature (≥30 days).</span>
          )}
        </div>
        {report && report.deciles.some((d) => d.n > 0) ? (
          <div className="mt-2 flex gap-1.5">
            {report.deciles.map((d) => (
              <div key={d.decile} className="flex-1 rounded border border-border bg-background px-1 py-1 text-center font-mono text-[9.5px] text-muted-foreground">
                <div>{(d.meanPredicted * 100).toFixed(0)}%</div>
                <div style={{ color: d.n > 0 && Number.isFinite(d.hitRate) ? "#E8E6E1" : undefined }}>
                  {d.n > 0 && Number.isFinite(d.hitRate) ? `${(d.hitRate * 100).toFixed(0)}%` : "—"}
                </div>
                <div>n{d.n}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, color = "#E8E6E1" }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-[26px] font-medium leading-tight" style={{ color }}>{value}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export function TrustScreen() {
  const [cal, setCal] = useState<CalData | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [health, setHealth] = useState<KeyHealthReport | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadCal = useCallback(() => {
    fetch("/api/forecast/calibration")
      .then((r) => r.json())
      .then(setCal)
      .catch(() => setCal({ ok: false }));
  }, []);
  const loadOverrides = useCallback(() => {
    fetch("/api/forecast/tuning")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.overrides)) setOverrides(d.overrides);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCal();
    loadOverrides();
    fetch("/api/admin/key-health")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.report) setHealth(d.report);
      })
      .catch(() => {});
  }, [loadCal, loadOverrides]);

  const applySuggestion = async (s: NonNullable<CalData["suggestions"]>[number]) => {
    const r = await fetch("/api/forecast/tuning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply",
        platform: s.platform,
        parameter: s.parameter,
        originalValue: s.currentValue,
        newValue: s.suggestedValue,
        deltaPercent: s.deltaPercent,
        rationale: s.rationale,
        sampleSize: s.sampleSize,
      }),
    });
    const d = await r.json().catch(() => null);
    if (d?.ok) {
      toast.success("Adjustment applied — the next forecast picks it up.");
      invalidateFetchOnce("forecast-tuning");
      loadOverrides();
    } else {
      toast.error(d?.error ?? "Could not apply.");
    }
  };

  const revert = async (o: Override) => {
    const r = await fetch("/api/forecast/tuning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revert", platform: o.platform, parameter: o.parameter }),
    });
    const d = await r.json().catch(() => null);
    if (d?.ok) {
      toast.success("Reverted to platform defaults.");
      invalidateFetchOnce("forecast-tuning");
      loadOverrides();
    }
  };

  const runHealth = async () => {
    setHealthRunning(true);
    try {
      const r = await fetch("/api/admin/key-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok && d.report) setHealth(d.report);
    } finally {
      setHealthRunning(false);
    }
  };

  if (!cal) {
    return (
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const r = cal.report;
  const hasData = !!r && r.sampleSize > 0;

  return (
    <div className="mt-6">
      {/* Headline scorecard */}
      {hasData && r ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Calls right"
              value={`${Math.round(r.directionCorrect * 100)}%`}
              sub="When we say a video beats the creator's normal, how often we're right — the number that matters for decisions"
              color="#2ECC8A"
            />
            <Stat
              label="Ranking accuracy"
              value={r.spearman.toFixed(2)}
              sub="When we say A beats B, how often A actually does (1.00 = perfect ordering)"
              color="#2ECC8A"
            />
            <Stat
              label="Typical miss"
              value={`±${Math.round(r.medianAPE * 100)}%`}
              sub="View counts are heavy-tailed — this never reaches zero. Direction and ranking are the honest targets."
            />
            <Stat
              label="Range hit rate"
              value={`${Math.round(r.coverage * 100)}%`}
              sub="How often the real number lands inside the range we gave (target: 80%)"
              color={r.coverage >= 0.7 ? "#2ECC8A" : "#F0B35A"}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {cal.sampleSize?.toLocaleString() ?? 0} forecasts logged · {cal.withOutcomes?.toLocaleString() ?? 0} graded
            against real results so far
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-[14px] text-foreground">The engine grades itself — results are still maturing.</p>
            <p className="mx-auto mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
              Every forecast is stored, then re-checked once the video matures (X posts after 3 days, TikTok after 30,
              Instagram 35, YouTube 90). The first scores appear here automatically — {cal.sampleSize?.toLocaleString() ?? 0}{" "}
              forecasts are already in the queue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-platform cards */}
      {cal.byPlatform && cal.byPlatform.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cal.byPlatform.map(({ platform, report }) => {
            const meta = PLATFORM_META[platform];
            const enough = report.sampleSize >= 20;
            return (
              <Card key={platform} className="py-0" style={{ borderTop: `2px solid ${meta.color}` }}>
                <CardContent className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-foreground">{meta.label}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">{report.sampleSize} graded</span>
                  </div>
                  {enough || report.sampleSize > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px]">
                      <span className="text-muted-foreground">Calls right</span>
                      <span className="text-right text-[#2ECC8A]">{Math.round(report.directionCorrect * 100)}%</span>
                      <span className="text-muted-foreground">Typical miss</span>
                      <span className="text-right">±{Math.round(report.medianAPE * 100)}%</span>
                      <span className="text-muted-foreground">Range hit rate</span>
                      <span className="text-right">{Math.round(report.coverage * 100)}%</span>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Progress value={(report.sampleSize / 20) * 100} className="h-1.5" />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Still collecting — {report.sampleSize} of 20 graded results needed
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Tuning suggestions */}
      {cal.suggestions && cal.suggestions.filter((s) => !dismissed.has(`${s.platform}-${s.parameter}`)).length > 0 ? (
        <Card className="mt-5">
          <CardHeader className="pb-0">
            <CardTitle className="text-[14px] font-semibold">The engine wants to adjust itself</CardTitle>
            <p className="text-[11.5px] text-muted-foreground">Based on measured misses. You decide.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {cal.suggestions
              .filter((s) => !dismissed.has(`${s.platform}-${s.parameter}`))
              .map((s, i) => (
                <div key={i} className="rounded-[6px] border border-[#F0B35A]/25 bg-[#F0B35A]/5 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      {PLATFORM_META[s.platform]?.label ?? s.platform} — {s.deltaPercent > 0 ? "raise" : "lower"}{" "}
                      {s.parameter === "upsideMultiplier" ? "the optimistic end of ranges" : s.parameter === "downsideMultiplier" ? "the floor of ranges" : "range sharpness"}{" "}
                      by {Math.abs(s.deltaPercent)}%
                    </span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {s.confidence} confidence · {s.sampleSize} results
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{s.rationale}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-7 text-[12px]" onClick={() => void applySuggestion(s)}>
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[12px] text-muted-foreground"
                      onClick={() => setDismissed((prev) => new Set(prev).add(`${s.platform}-${s.parameter}`))}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Applied overrides */}
      {overrides.length > 0 ? (
        <Card className="mt-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-[14px] font-semibold">Adjustments in effect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {overrides.map((o, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Badge variant="outline" className="font-mono text-[10px]" style={{ color: PLATFORM_META[o.platform]?.color }}>
                    {PLATFORM_META[o.platform]?.label ?? o.platform}
                  </Badge>
                  <span className="text-[12.5px] text-foreground">{o.parameter}</span>
                  <span className="font-mono text-[12px] text-[#2ECC8A]">
                    {o.deltaPercent > 0 ? "+" : ""}
                    {o.deltaPercent}%
                  </span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    since {new Date(o.appliedAt).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 text-[11.5px] text-muted-foreground" onClick={() => void revert(o)}>
                    Revert
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <SkillCalibrationCard />

      {/* Worst misses + system health */}
      <Card className="mt-4">
        <CardContent className="py-2">
          <Accordion type="multiple">
            {hasData && r && r.worstPredictions.length > 0 ? (
              <AccordionItem value="misses">
                <AccordionTrigger className="text-[13px]">Where we missed worst — what we&apos;re learning from</AccordionTrigger>
                <AccordionContent>
                  <div className="divide-y divide-border">
                    {r.worstPredictions.map((w, i) => (
                      <div key={w.id} className="flex items-center gap-3 py-2 font-mono text-[12px]">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <span>
                          said <span className="text-[#9B87E8]">{fmtCompact(w.predictedMedian)}</span> · got{" "}
                          <span className="text-[#2ECC8A]">{fmtCompact(w.actualViews)}</span>
                        </span>
                        <span className="ml-auto text-[#E4574E]">{Math.round(w.apeError * 100)}% off</span>
                        {w.videoUrl ? (
                          <Link href={`/videos/analyze?u=${encodeURIComponent(w.videoUrl)}`} className="text-[11px] text-muted-foreground hover:text-primary">
                            view →
                          </Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}
            <AccordionItem value="health">
              <AccordionTrigger className="text-[13px]">
                <span className="flex items-center gap-2">
                  Data sources & API keys
                  {health ? (
                    <span className="flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: health.summary.error > 0 ? "#E4574E" : health.summary.warn > 0 ? "#F0B35A" : "#2ECC8A" }} />
                      {health.summary.ok} ok · {health.summary.warn} limited · {health.summary.error} down
                    </span>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {health ? `Last checked ${new Date(health.checkedAt).toLocaleString()}` : "Never checked"}
                    {health?.apifyCredit ? ` · Scraping credit: ${health.apifyCredit}` : ""}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-[11.5px]" onClick={() => void runHealth()} disabled={healthRunning}>
                    {healthRunning ? "Checking…" : "Run live check"}
                  </Button>
                </div>
                {health ? (
                  <div className="divide-y divide-border">
                    {health.results.map((res, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 text-[11.5px]">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: res.severity === "ok" ? "#2ECC8A" : res.severity === "warn" ? "#F0B35A" : res.severity === "error" ? "#E4574E" : "#55534E" }}
                        />
                        <span className="w-24 shrink-0 text-foreground">{res.service}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground">
                          {res.keyVar}
                          {res.detail ? ` · ${res.detail}` : ""}
                        </span>
                        <span className="font-mono text-[10.5px]" style={{ color: res.severity === "ok" ? "#2ECC8A" : res.severity === "warn" ? "#F0B35A" : res.severity === "error" ? "#E4574E" : "#7E7B75" }}>
                          {res.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">Run a live check to test every key now.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
