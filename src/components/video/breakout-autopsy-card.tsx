"use client";

// "Why this one is popping" — renders only on breakouts (≥3× the creator's
// normal). Decomposes the outperformance into video quality × same-week tide
// × market week × residual luck via src/lib/autopsy.ts. Buckets without data
// say "collecting" instead of inventing a number; the residual is the user's
// measured luck and shrinks as the pool + volatility log grow.

import { useEffect, useMemo, useState } from "react";
import type { Forecast, Platform } from "@/lib/forecast";
import type { EnrichedVideo } from "@/lib/types";
import { computeAutopsy, type VolDay } from "@/lib/autopsy";
import { usePool } from "@/hooks/use-pool";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BREAKOUT_MIN_X = 3; // show the autopsy from ×3 vs normal upward

export function BreakoutAutopsyCard({
  forecast: f,
  video,
  platform,
}: {
  forecast: Forecast;
  video: EnrichedVideo;
  platform: Platform;
}) {
  const { entries: poolEntries } = usePool();
  const [volWeek, setVolWeek] = useState<VolDay[] | null>(null);

  const isBreakout = video.views > 0 && video.vsBaseline >= BREAKOUT_MIN_X && !!video.publishedAt;

  useEffect(() => {
    if (!isBreakout) return;
    const t0 = new Date(video.publishedAt).getTime();
    const from = new Date(t0 - 3 * 86_400_000).toISOString().slice(0, 10);
    let cancelled = false;
    fetch(`/api/forecast/vol-history?from=${from}&days=7`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setVolWeek(j?.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setVolWeek([]);
      });
    return () => { cancelled = true; };
  }, [isBreakout, video.publishedAt]);

  const autopsy = useMemo(
    () =>
      isBreakout
        ? computeAutopsy({
            total: video.vsBaseline,
            videoId: video.id,
            platform,
            publishedAt: video.publishedAt,
            scoreMultiplier: f.scoreMultiplier.median,
            score: f.scoreMultiplier.score,
            poolEntries,
            volWeek,
          })
        : null,
    [isBreakout, video.vsBaseline, video.id, video.publishedAt, platform, f.scoreMultiplier, poolEntries, volWeek],
  );

  if (!autopsy) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">
          Why this one is popping
          <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground">
            ×{autopsy.total} vs their normal — where it came from
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60">
          {autopsy.factors.map((factor) => (
            <div key={factor.key} className="flex items-baseline gap-4 py-2.5">
              <div className="w-[130px] shrink-0 text-[12.5px] text-foreground">{factor.label}</div>
              <div className="w-[70px] shrink-0 font-mono text-[14px]" style={{ color: factor.value != null ? "#E8E6E1" : "#7E7B75" }}>
                {factor.value != null ? `×${factor.value}` : "—"}
              </div>
              <div className="text-[11.5px] leading-snug text-muted-foreground">
                {factor.value == null ? <span className="text-[#F0B35A]">collecting · </span> : null}
                {factor.note}
              </div>
            </div>
          ))}
          <div className="flex items-baseline gap-4 py-2.5">
            <div className="w-[130px] shrink-0 text-[12.5px] font-medium text-foreground">Unexplained (luck)</div>
            <div className="w-[70px] shrink-0 font-mono text-[14px] font-medium" style={{ color: "#A78BFA" }}>
              {autopsy.residual != null ? `×${autopsy.residual}` : "—"}
            </div>
            <div className="text-[11.5px] leading-snug text-muted-foreground">{autopsy.residualNote}</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          quality × tide × market × luck = ×{autopsy.total} · buckets fill in as the pool and the daily volatility log grow
        </div>
      </CardContent>
    </Card>
  );
}
