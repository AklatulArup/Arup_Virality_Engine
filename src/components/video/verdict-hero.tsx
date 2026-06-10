"use client";

// Z1 — verdict hero: the decision element. Plain-English verdict band +
// expected views + range + confidence dots + an inline trust footnote pulled
// from the calibration loop ("on TikTok we call direction right N%").

import { useEffect, useState } from "react";
import type { Forecast, Platform } from "@/lib/forecast";
import { verdictFor } from "./verdict";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { fetchOnce } from "@/hooks/fetch-once";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function useTrustFootnote(platform: Platform): string | null {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    fetchOnce("forecast-calibration", async () => {
      const r = await fetch("/api/forecast/calibration");
      return r.ok ? r.json() : null;
    })
      .then((d) => {
        const rows = (d as { byPlatform?: Array<{ platform: string; report: { sampleSize: number; directionCorrect: number } }> })
          ?.byPlatform;
        const row = rows?.find((p) => p.platform === platform);
        if (row && row.report.sampleSize >= 5) {
          setNote(
            `On ${PLATFORM_META[platform].label} we've called the direction right ${Math.round(row.report.directionCorrect * 100)}% of the time (${row.report.sampleSize} checked forecasts)`,
          );
        }
      })
      .catch(() => {});
  }, [platform]);
  return note;
}

function ConfidenceDots({ level, reasons }: { level: Forecast["confidence"]["level"]; reasons: string[] }) {
  const filled = level === "high" ? 4 : level === "medium" ? 3 : level === "low" ? 2 : 1;
  const word = level === "high" ? "High" : level === "medium" ? "Medium" : level === "low" ? "Low" : "Not enough data";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default items-center gap-1.5">
          <span className="flex gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full"
                style={{ background: i < filled ? "#E8E6E1" : "rgba(255,255,255,0.14)" }}
              />
            ))}
          </span>
          <span className="text-[11.5px] text-muted-foreground">Confidence: {word}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[320px]">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px]">
          {reasons.slice(0, 5).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function VerdictHero({ forecast: f, platform }: { forecast: Forecast; platform: Platform }) {
  const v = verdictFor(f);
  const trust = useTrustFootnote(platform);
  const horizonWord = f.horizonDays >= 180 ? "lifetime" : `${f.horizonDays}-day total`;
  const early = v.tier === "early";

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[8px] border border-border bg-card p-5"
      style={{ borderLeft: `4px solid ${v.color}`, background: `linear-gradient(90deg, ${v.color}10, var(--card) 40%)` }}
    >
      <div className="min-w-[260px] flex-1">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: v.color }}>
          {v.label}
        </div>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-foreground">{v.sentence}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-4">
          <ConfidenceDots level={f.confidence.level} reasons={f.confidence.reasons} />
          {trust ? (
            <Link href="/trust" className="font-mono text-[10.5px] text-muted-foreground underline-offset-2 hover:underline">
              {trust} →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="text-right">
        {early ? (
          <>
            <div className="font-mono text-[40px] font-medium leading-none text-foreground">
              {f.scoreMultiplier.score.toFixed(0)}
              <span className="ml-1 text-[16px] text-muted-foreground">/100</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-muted-foreground">Readiness score — content setup quality</div>
          </>
        ) : (
          <>
            <div className="font-mono text-[40px] font-medium leading-none text-foreground">
              {fmtCompact(f.lifetime.median)}
              <span className="ml-1.5 text-[14px] font-normal text-muted-foreground">views</span>
            </div>
            <div className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">
              Range {fmtCompact(f.lifetime.low)} – {fmtCompact(f.lifetime.high)} · 8 of 10 land inside
            </div>
            <div className="font-mono text-[10.5px] text-muted-foreground/70">Expected {horizonWord} on {PLATFORM_META[platform].label}</div>
          </>
        )}
      </div>
    </div>
  );
}
