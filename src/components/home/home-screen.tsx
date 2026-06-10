"use client";

// Home — the launcher. One keystroke from either surface: the omnibox hero,
// recent work to resume, and a one-line system pulse. Not a dashboard.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Clapperboard, Users } from "lucide-react";
import { useCommand } from "@/components/layout/command-context";
import { usePool } from "@/hooks/use-pool";
import { fetchOnce } from "@/hooks/fetch-once";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import type { Platform } from "@/lib/forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryEntry {
  id: string;
  url: string;
  platform: string;
  title: string;
  channelName: string;
  checkedAt: string;
  metrics: Record<string, number | string>;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function platformOf(p: string): Platform {
  return (p === "youtube_short" || p === "tiktok" || p === "instagram" || p === "x" ? p : "youtube") as Platform;
}

export function HomeScreen() {
  const { openCommand } = useCommand();
  const { counts } = usePool();
  const [recent, setRecent] = useState<HistoryEntry[] | null>(null);
  const [pulse, setPulse] = useState<{ direction: number; samples: number; pending: number } | null>(null);

  useEffect(() => {
    fetch("/api/analysis-history")
      .then((r) => r.json())
      .then((d) => setRecent(Array.isArray(d?.entries) ? d.entries.slice(0, 8) : []))
      .catch(() => setRecent([]));
    fetchOnce("forecast-calibration", async () => {
      const r = await fetch("/api/forecast/calibration");
      return r.ok ? r.json() : null;
    })
      .then((d) => {
        const dd = d as { report?: { directionCorrect: number; sampleSize: number }; sampleSize?: number; withOutcomes?: number } | null;
        if (dd) {
          setPulse({
            direction: dd.report?.sampleSize ? Math.round(dd.report.directionCorrect * 100) : 0,
            samples: dd.report?.sampleSize ?? 0,
            pending: Math.max(0, (dd.sampleSize ?? 0) - (dd.withOutcomes ?? 0)),
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* Z1 — command hero */}
      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">What are we looking at?</h1>
        <button
          type="button"
          onClick={openCommand}
          className="mt-6 flex w-full max-w-[680px] items-center gap-3 rounded-[10px] border border-input bg-card px-5 py-4 text-left transition-colors hover:border-ring"
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="flex-1 text-[15px] text-muted-foreground">Paste a video URL, a channel link, or @handle…</span>
          <kbd className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">⌘K</kbd>
        </button>
        <div className="mt-4 flex gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clapperboard className="size-3.5" /> video link → forecast report
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> creator or @handle → partner card
          </span>
        </div>
      </div>

      {/* Z2 — continue working */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">Pick up where you left off</CardTitle>
        </CardHeader>
        <CardContent>
          {recent === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : recent.length === 0 ? (
            <div className="py-4 text-[12.5px] leading-relaxed text-muted-foreground">
              <p>Three steps: 1 — paste a link (⌘K). 2 — get the forecast and the verdict. 3 — the engine grades itself when real numbers land.</p>
              <p className="mt-1.5">
                Or start by{" "}
                <Link href="/library/import" className="text-primary underline-offset-2 hover:underline">
                  importing creator history →
                </Link>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((e) => {
                const p = platformOf(e.platform);
                return (
                  <Link
                    key={e.id}
                    href={`/videos/analyze?u=${encodeURIComponent(e.url)}`}
                    className="flex items-center gap-3 py-2 transition-colors hover:bg-accent/40"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: PLATFORM_META[p].color }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{e.title}</span>
                    <span className="hidden text-[11.5px] text-muted-foreground sm:block">{e.channelName}</span>
                    <span className="font-mono text-[11.5px] text-muted-foreground">
                      {fmtCompact(Number(e.metrics.views) || 0)} views
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Z3 — system pulse */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 pb-2 font-mono text-[11px] text-muted-foreground">
        <Link href="/library/pool" className="hover:text-foreground">
          Evidence pool {counts ? counts.videos.toLocaleString() : "…"} entries
        </Link>
        <span className="text-border">·</span>
        <Link href="/trust" className="hover:text-foreground">
          {pulse && pulse.samples > 0
            ? `Calls right ${pulse.direction}% (${pulse.samples} graded)`
            : "Accuracy: grading in progress"}
        </Link>
        <span className="text-border">·</span>
        <Link href="/trust" className="hover:text-foreground">
          {pulse ? `${pulse.pending.toLocaleString()} forecasts awaiting results` : "…"}
        </Link>
      </div>
    </div>
  );
}
