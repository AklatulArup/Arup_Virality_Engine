"use client";

// Z1.5 — "Virality potential": breakout odds, working ceiling, and the
// conditions the upside case depends on. Dumb card — all math lives in
// src/lib/viral-potential.ts; this renders the three answers an RM needs
// before promising anything to a partner.

import { useMemo } from "react";
import type { Forecast, Platform } from "@/lib/forecast";
import type { EnrichedVideo, VideoData, ReferenceEntry } from "@/lib/types";
import { computeViralPotential, BREAKOUT_X } from "@/lib/viral-potential";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function ViralPotentialCard({
  forecast: f,
  video,
  platform,
  velocitySamples,
  creatorHistory,
  poolEntries,
}: {
  forecast: Forecast;
  video: EnrichedVideo;
  platform: Platform;
  velocitySamples: Array<{ ageHours: number; views: number }>;
  creatorHistory: VideoData[];
  poolEntries: ReferenceEntry[];
}) {
  const potential = useMemo(
    () =>
      computeViralPotential({
        forecast: f,
        video: { views: video.views, days: video.days },
        creatorHistory,
        platform,
        velocitySamples,
        poolEntries,
      }),
    [f, video.views, video.days, creatorHistory, platform, velocitySamples, poolEntries],
  );

  const { breakout, ceiling, conditions } = potential;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">Virality potential</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Breakout odds */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Breakout odds
              {breakout?.liveAdjusted ? (
                <span className="ml-2 rounded border border-[#2ECC8A]/40 px-1 py-0.5 text-[9px] normal-case tracking-normal text-[#2ECC8A]">
                  live-adjusted
                </span>
              ) : null}
            </div>
            <div
              className="mt-1.5 font-mono text-[24px] font-medium"
              style={{ color: breakout && breakout.pct >= 20 ? "#2ECC8A" : "#E8E6E1" }}
            >
              {breakout ? `1 in ${breakout.oneInN}` : "—"}
            </div>
            <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              {breakout
                ? `~${breakout.pct < 10 ? breakout.pct.toFixed(1) : Math.round(breakout.pct)}% chance this clears ${BREAKOUT_X}× their normal. Based on ${breakout.basis}.`
                : "Not enough history to put a number on it yet — analyze more of this creator or grow the pool."}
            </div>
          </div>

          {/* Ceiling */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Ceiling
              <span
                className="ml-2 rounded border px-1 py-0.5 text-[9px] normal-case tracking-normal"
                style={
                  ceiling.capped
                    ? { borderColor: "rgba(240,179,90,0.4)", color: "#F0B35A" }
                    : { borderColor: "rgba(46,204,138,0.4)", color: "#2ECC8A" }
                }
              >
                {ceiling.capped ? "capped" : "open"}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[24px] font-medium text-foreground">
              {fmtCompact(ceiling.value)}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">views</span>
            </div>
            <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{ceiling.reason}</div>
          </div>

          {/* Conditions */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              What must stay true
            </div>
            {conditions.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5 text-[11.5px] leading-snug text-muted-foreground">
                {conditions.map((c) => (
                  <li key={c} className="flex gap-1.5">
                    <span className="text-[#F0B35A]">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                Nothing critical outstanding — the evidence is already in.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
