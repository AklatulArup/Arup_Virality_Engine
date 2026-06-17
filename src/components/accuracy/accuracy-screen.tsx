"use client";

// Accuracy — the plain-English, visual answer to "how good is the engine, and
// how much did the latest work help?" Reads the backtest report
// (/api/forecast/accuracy) populated by the calibration scripts. Deliberately
// separate from the Trust Center, which grades LIVE forecasts as they mature;
// this is the backtest view that exists today, clearly labelled as such.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/forecast";
import type { AccuracyReport, PlatformAccuracy } from "@/lib/accuracy-report";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ORDER: Platform[] = ["youtube_short", "tiktok", "instagram", "youtube", "x"];
const GREEN = "#2ECC8A";
const AMBER = "#F0B35A";
const MUTED = "#6B6964";

function pct(n: number | undefined): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}

// "Typical miss" → an accuracy share the layman reads as "how close on average".
// 100% miss ≈ "off by the whole number"; we render closeness = 1 - miss, floored
// at 0 so the bar never goes negative on a wild platform.
function closeness(miss: number | undefined): number | null {
  if (miss == null) return null;
  return Math.max(0, Math.min(1, 1 - miss));
}

function Bar({ value, color, track = "rgba(255,255,255,0.06)" }: { value: number; color: string; track?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

function PlatformCard({ platform, a }: { platform: Platform; a: PlatformAccuracy | undefined }) {
  const meta = PLATFORM_META[platform];
  const hasData = a && (a.sampleSize ?? 0) > 0;
  const thin = !a || (a.sampleSize ?? 0) < 25;

  const closeAfter = closeness(a?.typicalMissAfter);
  const closeBefore = closeness(a?.typicalMissBefore);
  const improvedPts =
    a?.typicalMissBefore != null && a?.typicalMissAfter != null
      ? Math.round((a.typicalMissBefore - a.typicalMissAfter) * 100)
      : null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
            {hasData ? `backtested on ${a!.sampleSize!.toLocaleString()} videos` : "no backtest data yet"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData || thin ? (
          <div className="text-[12.5px] text-muted-foreground">
            {hasData
              ? `Only ${a!.sampleSize} videos so far — not enough to score this platform yet. Import more ${meta.label} creators and it fills in.`
              : `Still collecting — analyze or import ${meta.label} content and this platform gets scored.`}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Day-one closeness, before vs now */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Day-one closeness
                </span>
                {improvedPts != null && improvedPts > 0 ? (
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: "rgba(46,204,138,0.4)", color: GREEN }}>
                    +{improvedPts} pts sharper
                  </span>
                ) : null}
              </div>
              {closeBefore != null ? (
                <div className="mb-2 flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[10.5px] text-muted-foreground">before</span>
                  <Bar value={closeBefore} color={MUTED} />
                  <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{pct(closeBefore)}</span>
                </div>
              ) : null}
              {closeAfter != null ? (
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[10.5px]" style={{ color: meta.color }}>now</span>
                  <Bar value={closeAfter} color={meta.color} />
                  <span className="w-9 shrink-0 text-right font-mono text-[11px] font-medium text-foreground">{pct(closeAfter)}</span>
                </div>
              ) : null}
              <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
                How close the single &ldquo;expected&rdquo; number lands to reality, on day one before any views exist —
                {a?.correctionShipped ? " lifted by this week's day-0 fix." : " no day-0 fix applied here yet."}
              </p>
            </div>

            {/* Expected hit rate — how often the single guess itself is close */}
            {a?.expectedHitClose != null || a?.expectedHitBallpark != null ? (
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Expected number hit rate
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11.5px] text-foreground">Spot-on</span>
                      <span className="font-mono text-[13px] font-medium" style={{ color: meta.color }}>{pct(a?.expectedHitClose)}</span>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground">within ±25% of real</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11.5px] text-foreground">Right ballpark</span>
                      <span className="font-mono text-[13px] font-medium" style={{ color: meta.color }}>{pct(a?.expectedHitBallpark)}</span>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground">within 2× (half to double)</span>
                  </div>
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
                  How often the single &ldquo;expected&rdquo; number itself lands close — day one, blind. The range below
                  is the safer read; the single number is a centre of gravity.
                </p>
              </div>
            ) : null}

            {/* Range hit rate */}
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Range hit rate
              </div>
              <div className="relative">
                <Bar value={a?.rangeHitRate ?? 0} color={(a?.rangeHitRate ?? 0) >= (a?.rangeTarget ?? 0.8) ? GREEN : AMBER} />
                {/* 80% target tick */}
                <div className="absolute -top-0.5 h-3 w-px" style={{ left: `${(a?.rangeTarget ?? 0.8) * 100}%`, background: "rgba(255,255,255,0.45)" }} />
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
                {a?.rangeHitRate != null ? (
                  <>
                    The real number lands inside the low–high range{" "}
                    <span className="font-medium text-foreground">{pct(a.rangeHitRate)}</span> of the time
                    {a.rangeShipped ? " (target 80% — met, so these learned ranges are live)." : " — below the 80% target, so this platform still uses the safe default range."}
                  </>
                ) : (
                  "Not enough data to measure the range yet."
                )}
              </p>
              {a?.rangeLowMult != null && a?.rangeHighMult != null ? (
                <p className="mt-1.5 text-[11px] leading-snug" style={{ color: MUTED }}>
                  <span style={{ color: AMBER }}>*</span> How wide: the range spans about{" "}
                  <span className="font-mono text-foreground">×{a.rangeLowMult}</span> to{" "}
                  <span className="font-mono text-foreground">×{a.rangeHighMult}</span> of the expected number — e.g. a{" "}
                  forecast of <span className="font-mono">10K</span> means roughly{" "}
                  <span className="font-mono text-foreground">{fmtViews(10000 * a.rangeLowMult)}–{fmtViews(10000 * a.rangeHighMult)}</span>.
                  Narrowing this is the goal as the pool grows.
                </p>
              ) : null}
              {a?.creatorBandLowMult != null && a?.creatorBandHighMult != null ? (
                <p className="mt-1.5 text-[11px] leading-snug" style={{ color: MUTED }}>
                  <span style={{ color: GREEN }}>✓</span> For an established creator (8+ of their own videos), the engine
                  narrows this to their own track record — typically{" "}
                  <span className="font-mono" style={{ color: meta.color }}>×{a.creatorBandLowMult}–×{a.creatorBandHighMult}</span>{" "}
                  (a 10K forecast → <span className="font-mono text-foreground">{fmtViews(10000 * a.creatorBandLowMult)}–{fmtViews(10000 * a.creatorBandHighMult)}</span>).
                  {a.creatorBandCreators ? ` ${a.creatorBandCreators} creators qualify so far.` : ""}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AccuracyScreen() {
  const [report, setReport] = useState<AccuracyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // no-store: the report changes whenever calibration reruns or the pool is
    // backfilled, so always pull fresh rather than show a cached copy.
    fetch("/api/forecast/accuracy", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          if (d?.ok) setReport(d.report ?? null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const byPlatform = report?.byPlatform ?? {};

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title="Accuracy"
        description="How close the engine gets, per platform — and how much the latest calibration helped. Two numbers matter: how close the single guess lands, and how often reality falls inside the range."
      />

      {/* What you're looking at */}
      <Card className="mt-4 border-primary/30">
        <CardContent className="space-y-2 py-4 text-[12.5px] leading-relaxed text-muted-foreground">
          <p>
            These are <span className="text-foreground">backtest</span> results: we take real videos from the evidence
            library, hide each one&apos;s view count, predict it blind as if it were day one, then compare to what
            actually happened. It&apos;s how we can show accuracy <span className="text-foreground">before</span> enough
            of our own live forecasts have matured.
          </p>
          <p>
            Live scoring of the engine&apos;s own predictions is separate and starts as forecasts age — see the{" "}
            <Link href="/trust" className="text-primary underline-offset-2 hover:underline">Trust Center</Link>.
          </p>
        </CardContent>
      </Card>

      {/* The luck ceiling — why 100% is impossible */}
      <Card className="mt-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">The luck ceiling — why no tool hits 100%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mt-1 flex h-7 w-full overflow-hidden rounded-[6px]">
            <div className="flex items-center justify-center" style={{ width: "85%", background: "rgba(46,204,138,0.22)", color: GREEN }}>
              <span className="font-mono text-[11px]">~85% explainable</span>
            </div>
            <div className="flex items-center justify-center" style={{ width: "15%", background: "rgba(240,179,90,0.22)", color: AMBER }}>
              <span className="font-mono text-[11px]">~15% luck</span>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Roughly <span className="text-foreground">10–15% of whether something goes viral is pure luck</span> — which
            of two near-identical videos the algorithm decides to push that day, a stranger resharing at the right
            moment. No tool can predict that part; it&apos;s the same coin-flip for everyone. So the realistic ceiling
            for any forecaster is about <span className="text-foreground">85%</span>, and on day-one short-form it&apos;s
            lower still. We measure that luck per video on each breakout&apos;s{" "}
            <span className="text-foreground">autopsy</span> (the &ldquo;unexplained&rdquo; share) — it&apos;s why we
            give a range, not a promise, and why the numbers below should never read 100%.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : !report ? (
        <Card className="mt-4">
          <CardContent className="py-6 text-[13px] text-muted-foreground">
            No accuracy report yet — the calibration hasn&apos;t run against the pool. It populates the next time the
            engine recalibrates.
          </CardContent>
        </Card>
      ) : (
        ORDER.map((p) => <PlatformCard key={p} platform={p} a={byPlatform[p]} />)
      )}

      {/* Plain-English glossary */}
      <Card className="mt-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">What these mean</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground">Day-one closeness</span> — how near the single &ldquo;expected&rdquo;
            number gets to the real count, predicting blind before any views exist. Day one is the hardest moment to
            predict, so this is the engine at its toughest. <span className="text-foreground">&ldquo;Before&rdquo; vs
            &ldquo;now&rdquo;</span> shows what this week&apos;s day-0 fix changed.
          </p>
          <p>
            <span className="text-foreground">Range hit rate</span> — how often the true number lands inside the
            low–high bracket. This is the one to trust in a negotiation: aim to quote the <span className="text-foreground">low</span> end,
            because the bracket catches reality ~8 times in 10 when it&apos;s working.
          </p>
          <p className="border-l-2 border-primary pl-3 text-foreground">
            Short-form on day one is genuinely hard — a chunk of virality is luck no tool can predict. The honest play:
            trust the range, treat the single number as a centre of gravity, and re-check on day 2–3 once real views
            sharpen everything.
          </p>
        </CardContent>
      </Card>

      {report?.computedAt ? (
        <div className="mt-4 font-mono text-[10.5px] text-muted-foreground">
          Backtest last recomputed {new Date(report.computedAt).toISOString().slice(0, 10)} · refreshes as the pool
          grows and as live grades mature.
        </div>
      ) : null}
    </div>
  );
}
