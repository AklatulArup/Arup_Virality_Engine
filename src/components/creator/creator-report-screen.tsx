"use client";

// Creator Report card — "should we partner with this person?" Partner verdict
// hero, brand-risk alert at decision altitude, KPI row, reputation cards,
// recent videos table linking into Video Reports, and what's on file.

import { useMemo } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/forecast";
import { useCreatorReport, videoUrlFor } from "@/hooks/use-creator-report";
import { PLATFORM_META, PlatformBadge } from "@/components/layout/platform-meta";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TriangleAlert, ShieldAlert } from "lucide-react";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

type PartnerTier = "strong" | "conversation" | "mixed" | "risk" | "thin";

function partnerVerdict(r: ReturnType<typeof useCreatorReport>): { tier: PartnerTier; label: string; sentence: string; color: string } {
  const s = r.stats;
  if (!s || s.sample < 5) {
    return {
      tier: "thin",
      label: "Not enough data",
      sentence: "We have too little history on this creator to make a call — analyze a few of their videos to build the picture.",
      color: "#9E9C97",
    };
  }
  const polarized = r.crossPlatform?.signals.polarized ?? false;
  const repDown = (r.reputation?.multiplier ?? 1) < 0.9;
  if (polarized || repDown) {
    return {
      tier: "risk",
      label: polarized ? "Brand risk" : "High risk",
      sentence: polarized
        ? "Reception is split across platforms — loved in one place, negative in another. Check before partnering."
        : "Engagement is trending down and posting has cooled — momentum is working against a partnership right now.",
      color: "#E4574E",
    };
  }
  const growing = s.trend === "growing";
  const steady = s.cv < 0.9;
  const repUp = (r.reputation?.multiplier ?? 1) >= 1.0;
  if (growing && repUp && steady) {
    return {
      tier: "strong",
      label: "Strong candidate",
      sentence: `Steady ${fmtCompact(s.median)} views per post and growing, with a clean reputation — a solid partner profile.`,
      color: "#2ECC8A",
    };
  }
  if (s.trend === "declining") {
    return {
      tier: "mixed",
      label: "Mixed signals",
      sentence: `Typical reach is ${fmtCompact(s.median)} per post but the trend is declining — worth watching, not rushing.`,
      color: "#F0B35A",
    };
  }
  return {
    tier: "conversation",
    label: "Worth a conversation",
    sentence: `Reliable ${fmtCompact(s.median)} views per post with ${s.consistencyWord.toLowerCase()} output — no red flags in the data.`,
    color: "#60A5FA",
  };
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "pos" | "neg" | "neutral" }) {
  const color = tone === "pos" ? "#2ECC8A" : tone === "neg" ? "#F0B35A" : "#E8E6E1";
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-[20px] font-medium leading-tight" style={{ color }}>{value}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export function CreatorReportScreen({ platform, handle }: { platform: Platform; handle: string }) {
  const r = useCreatorReport(platform, handle);
  const verdict = useMemo(() => partnerVerdict(r), [r]);
  const display = r.channel?.name ?? `@${handle.replace(/^@/, "")}`;

  if (r.loading) {
    return (
      <div>
        <PageHeader title={display} description={`Partner report card · ${PLATFORM_META[platform].label}`} />
        <div className="mt-6 space-y-3">
          <div className="font-mono text-[12px] text-muted-foreground">{r.status || "Building the report…"}</div>
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        </div>
      </div>
    );
  }

  if (r.error) {
    return (
      <div>
        <PageHeader title={display} description={`Partner report card · ${PLATFORM_META[platform].label}`} />
        <Alert variant="destructive" className="mt-6">
          <TriangleAlert className="size-4" />
          <AlertTitle>Could not build this report</AlertTitle>
          <AlertDescription>{r.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const s = r.stats;

  return (
    <div>
      {/* Z0 — identity */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold text-foreground">{display}</h1>
            <PlatformBadge platform={platform} />
            {r.crossPlatform?.platformsPresent.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-[9.5px] text-muted-foreground">
                also on {p}
              </Badge>
            ))}
            {r.blocked ? (
              <Badge variant="outline" className="border-destructive/40 font-mono text-[9.5px] text-destructive">
                Blocked creator
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {r.channel?.subs ? `${fmtCompact(r.channel.subs)} followers · ` : ""}
            {r.niche && r.niche.niche !== "unknown" ? `${r.niche.niche.replace(/-/g, " ")} · ` : ""}
            {s ? `${s.sample} recent posts profiled` : "no history yet"}
          </p>
        </div>
        {r.videos[0] ? (
          <Link
            href={`/videos/analyze?u=${encodeURIComponent(videoUrlFor(platform, r.videos[0]))}`}
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-[12.5px] text-foreground transition-colors hover:border-ring"
          >
            Analyze their latest →
          </Link>
        ) : null}
      </div>

      {/* Z1 — partner verdict hero */}
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[8px] border border-border bg-card p-5"
        style={{ borderLeft: `4px solid ${verdict.color}`, background: `linear-gradient(90deg, ${verdict.color}10, var(--card) 40%)` }}
      >
        <div className="min-w-[260px] flex-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: verdict.color }}>
            {verdict.label}
          </div>
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-foreground">{verdict.sentence}</p>
        </div>
        {s ? (
          <div className="text-right">
            <div className="font-mono text-[40px] font-medium leading-none text-foreground">
              {fmtCompact(s.median)}
              <span className="ml-1.5 text-[14px] font-normal text-muted-foreground">typical views</span>
            </div>
            <div className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">
              middle half: {fmtCompact(s.p25)} – {fmtCompact(s.p75)} per post
            </div>
          </div>
        ) : null}
      </div>

      {/* Brand-risk alert — never buried */}
      {r.crossPlatform?.signals.polarized ? (
        <Alert className="mt-3 border-destructive/40">
          <ShieldAlert className="size-4 text-destructive" />
          <AlertTitle className="text-[13px] text-destructive">Brand risk: split reputation across platforms</AlertTitle>
          <AlertDescription className="text-[12px]">{r.crossPlatform.rationale}</AlertDescription>
        </Alert>
      ) : null}

      {/* Z2 — KPIs */}
      {s ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Typical views" value={fmtCompact(s.median)} sub="What a normal post does" />
          <Kpi
            label="Consistency"
            value={s.consistencyWord}
            sub="Predictability of results"
            tone={s.cv < 0.5 ? "pos" : s.cv > 1.2 ? "neg" : "neutral"}
          />
          <Kpi
            label="Trend"
            value={s.trend === "growing" ? "Growing ↑" : s.trend === "declining" ? "Declining ↓" : "Stable →"}
            sub="Recent posts vs. earlier ones"
            tone={s.trend === "growing" ? "pos" : s.trend === "declining" ? "neg" : "neutral"}
          />
          <Kpi
            label="Breakout rate"
            value={`${s.breakoutRate.toFixed(0)}%`}
            sub="Posts that blow past 3× their normal"
            tone={s.breakoutRate >= 15 ? "pos" : "neutral"}
          />
          <Kpi
            label="Engagement"
            value={`${s.medianEngagement.toFixed(1)}%`}
            sub="Likes + comments per view"
            tone={s.medianEngagement >= 4 ? "pos" : s.medianEngagement < 1 ? "neg" : "neutral"}
          />
          <Kpi label="Posting rhythm" value={s.cadenceLabel} sub="Algorithms reward steady schedules" />
        </div>
      ) : null}

      {/* Z3 — reputation cards */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {r.reputation ? (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px] font-semibold">Reputation here</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-[20px] font-medium" style={{ color: r.reputation.multiplier >= 1 ? "#2ECC8A" : "#F0B35A" }}>
                {r.reputation.multiplier >= 1 ? "+" : ""}
                {((r.reputation.multiplier - 1) * 100).toFixed(0)}%
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{r.reputation.rationale}</p>
            </CardContent>
          </Card>
        ) : null}
        {r.crossPlatform ? (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-[14px] font-semibold">Across platforms</CardTitle>
            </CardHeader>
            <CardContent>
              {r.crossPlatform.confidence === "none" ? (
                <p className="text-[12px] text-muted-foreground">
                  No footprint found on other platforms in our evidence pool — reputation judged here only.
                </p>
              ) : (
                <>
                  <div
                    className="font-mono text-[20px] font-medium"
                    style={{ color: r.crossPlatform.signals.polarized ? "#E4574E" : r.crossPlatform.multiplier >= 1 ? "#2ECC8A" : "#F0B35A" }}
                  >
                    {r.crossPlatform.multiplier >= 1 ? "+" : ""}
                    {((r.crossPlatform.multiplier - 1) * 100).toFixed(0)}%
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{r.crossPlatform.rationale}</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Z4 — recent videos */}
      {r.videos.length > 0 && s ? (
        <Card className="mt-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-[14px] font-semibold">Recent posts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Vs. their normal</TableHead>
                  <TableHead className="text-right">Readiness</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.videos.slice(0, 10).map((v) => {
                  const x = s.median > 0 ? v.views / s.median : null;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[380px] truncate text-[12.5px]">{v.title}</TableCell>
                      <TableCell className="text-right font-mono text-[12px]">{fmtCompact(v.views)}</TableCell>
                      <TableCell className="text-right font-mono text-[12px]" style={{ color: x != null && x >= 3 ? "#2ECC8A" : x != null && x < 0.5 ? "#F0B35A" : "#9E9C97" }}>
                        {x != null ? `×${x >= 10 ? Math.round(x) : x.toFixed(1)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12px] text-muted-foreground">
                        {v.vrs.estimatedFullScore.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/videos/analyze?u=${encodeURIComponent(videoUrlFor(platform, v))}`}
                          className="text-[11.5px] text-muted-foreground hover:text-primary"
                        >
                          Report →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Z5 — on file */}
      <Card className="mt-4">
        <CardContent className="py-4">
          <Accordion type="multiple">
            <AccordionItem value="memory">
              <AccordionTrigger className="text-[13px]">Private analytics on file</AccordionTrigger>
              <AccordionContent>
                {r.memory ? (
                  <div className="text-[12px] text-muted-foreground">
                    <p>
                      {Object.keys(r.memory.inputs).length} field{Object.keys(r.memory.inputs).length === 1 ? "" : "s"} saved
                      from past screenshots/CSVs — these pre-fill every new forecast for this creator.
                    </p>
                    <p className="mt-1 font-mono text-[11px]">
                      {Object.entries(r.memory.inputs)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    Nothing on file yet. Add a Creator Studio screenshot on any of their Video Reports and it sticks here.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
