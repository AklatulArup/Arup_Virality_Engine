"use client";

// Z3 — trajectory chart + custom-date projection. The card computes the
// projection points (same shareAt math as forecast.ts: fitted decay curve
// when trusted, hand-tuned platform curve otherwise); the chart just renders.

import { useMemo } from "react";
import type { Forecast, Platform, DateProjection } from "@/lib/forecast";
import { PLATFORM_CONFIG } from "@/lib/forecast";
import { fittedCumulativeShare, type DecayTable } from "@/lib/decay-fit";
import type { EnrichedVideo } from "@/lib/types";
import type { VelocitySample } from "@/hooks/use-forecast-bundle";
import { ForecastBandChart, type BandPoint } from "@/components/charts/forecast-band-chart";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function TrajectoryCard({
  forecast: f,
  platform,
  video,
  velocitySamples,
  decayTable,
  targetDate,
  setTargetDate,
  dateProjection,
}: {
  forecast: Forecast;
  platform: Platform;
  video: EnrichedVideo;
  velocitySamples: VelocitySample[];
  decayTable: DecayTable | null;
  targetDate: string;
  setTargetDate: (d: string) => void;
  dateProjection: DateProjection | null;
}) {
  const accent = PLATFORM_META[platform].color;
  const horizon = f.horizonDays;
  const fittedUsed = !!decayTable?.byPlatform?.[platform];

  const data = useMemo<BandPoint[]>(() => {
    const shareAt = (d: number) =>
      fittedCumulativeShare(decayTable, platform, d) ?? PLATFORM_CONFIG[platform].cumulativeShare(d);
    const points: BandPoint[] = [];
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const day = (horizon * i) / N;
      const s = shareAt(day);
      points.push({
        day: Math.round(day * 100) / 100,
        band: [Math.round(f.lifetime.low * s), Math.round(f.lifetime.high * s)],
        median: Math.round(f.lifetime.median * s),
        actual: null,
      });
    }
    for (const v of velocitySamples) {
      points.push({ day: Math.round((v.ageHours / 24) * 100) / 100, band: null, median: null, actual: v.views });
    }
    // Current views as the latest actual point. Date.now() is intentional —
    // fractional age for videos posted <24h ago; repo convention disable.
    // eslint-disable-next-line react-hooks/purity
    const ageDays = video.days > 0 ? video.days : video.publishedAt ? Math.max(0.05, (Date.now() - new Date(video.publishedAt).getTime()) / 86_400_000) : null;
    if (ageDays != null && video.views > 0 && ageDays <= horizon) {
      points.push({ day: Math.round(ageDays * 100) / 100, band: null, median: null, actual: video.views });
    }
    return points.sort((a, b) => a.day - b.day);
  }, [f.lifetime, horizon, platform, decayTable, velocitySamples, video.days, video.publishedAt, video.views]);

  const todayDay = video.days > 0 ? Math.min(video.days, horizon) : null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">How views should build</CardTitle>
      </CardHeader>
      <CardContent>
        <ForecastBandChart data={data} accent={accent} baseline={f.baseline?.median ?? null} todayDay={todayDay} />
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
          {fittedUsed
            ? `Build-up curve measured from ${decayTable?.byPlatform?.[platform]?.videoCount ?? "—"} matured ${PLATFORM_META[platform].label} videos`
            : "Build-up curve from platform defaults — not enough matured videos yet"}
          {" · solid line = actual views"}
        </div>

        {/* Custom-date projection */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[6px] border border-border bg-background px-4 py-3">
          <label className="text-[12.5px] text-muted-foreground" htmlFor="proj-date">
            Where will it be on
          </label>
          <input
            id="proj-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-[6px] border border-input bg-card px-2.5 py-1.5 font-mono text-[12.5px] text-foreground outline-none focus:border-ring"
          />
          {dateProjection && !dateProjection.beforePublish ? (
            <div className="flex items-center gap-5 font-mono text-[13px]">
              <span className="text-muted-foreground">
                Low <span className="text-foreground">{fmtCompact(dateProjection.low)}</span>
              </span>
              <span className="text-muted-foreground">
                Expected <span className="font-medium" style={{ color: accent }}>{fmtCompact(dateProjection.median)}</span>
              </span>
              <span className="text-muted-foreground">
                High <span className="text-foreground">{fmtCompact(dateProjection.high)}</span>
              </span>
              {dateProjection.beyondHorizon ? (
                <span className="text-[10.5px] text-muted-foreground">past the {f.horizonDays}d horizon — flat from there</span>
              ) : null}
              {dateProjection.low === dateProjection.median &&
              dateProjection.median === dateProjection.high &&
              dateProjection.median === video.views ? (
                <span className="text-[10.5px] text-[#F0B35A]">
                  pinned at today&apos;s views — the model expects little additional growth by this date
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[11.5px] text-muted-foreground">Pick a date on or after the publish date.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
