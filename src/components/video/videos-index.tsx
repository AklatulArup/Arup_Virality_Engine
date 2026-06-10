"use client";

// /videos index — everything the team has analyzed, with what happened since
// we looked (views-now delta from the previous snapshot), plus the on-record
// forecast log as a second tab.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/forecast";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { useForecastLog } from "@/hooks/use-forecast-log";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryEntry {
  id: string;
  url: string;
  platform: string;
  title: string;
  channelName: string;
  checkedAt: string;
  metrics: Record<string, number | string>;
  previousSnapshot?: { checkedAt: string; metrics: Record<string, number | string> };
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function platformOf(p: string): Platform {
  return (p === "youtube_short" || p === "tiktok" || p === "instagram" || p === "x" ? p : "youtube") as Platform;
}

export function VideosIndex() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [q, setQ] = useState("");
  const log = useForecastLog();

  useEffect(() => {
    fetch("/api/analysis-history")
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d?.entries) ? d.entries : []))
      .catch(() => setEntries([]));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const needle = q.trim().toLowerCase();
    const list = needle
      ? entries.filter((e) => e.title.toLowerCase().includes(needle) || e.channelName.toLowerCase().includes(needle))
      : entries;
    return [...list].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1)).slice(0, 100);
  }, [entries, q]);

  return (
    <Tabs defaultValue="analyses" className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
          <TabsTrigger value="log">On the record</TabsTrigger>
        </TabsList>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or creator…"
          className="h-8 w-[260px] text-[13px]"
        />
      </div>

      <TabsContent value="analyses" className="mt-4">
        {entries === null ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            No analyses yet — paste a link in the command bar (⌘K).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Analyzed</TableHead>
                <TableHead className="text-right">Views then</TableHead>
                <TableHead className="text-right">Since we looked</TableHead>
                <TableHead className="text-right">Readiness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const p = platformOf(e.platform);
                const views = Number(e.metrics.views) || 0;
                const prev = e.previousSnapshot ? Number(e.previousSnapshot.metrics.views) || 0 : null;
                const delta = prev != null && prev > 0 ? views - prev : null;
                const vrs = Number(e.metrics.vrsScore) || null;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-[380px]">
                      <Link
                        href={`/videos/analyze?u=${encodeURIComponent(e.url)}`}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ background: PLATFORM_META[p].color }} />
                        <span className="truncate text-[12.5px]">{e.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">{e.channelName}</TableCell>
                    <TableCell className="font-mono text-[11.5px] text-muted-foreground">{ago(e.checkedAt)}</TableCell>
                    <TableCell className="text-right font-mono text-[12px]">{fmtCompact(views)}</TableCell>
                    <TableCell className="text-right font-mono text-[12px]">
                      {delta == null ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <span style={{ color: delta > 0 ? "#2ECC8A" : "#9E9C97" }}>
                          {delta >= 0 ? "+" : ""}
                          {fmtCompact(delta)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12px] text-muted-foreground">
                      {vrs != null ? vrs.toFixed(0) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="log" className="mt-4">
        {log.loading ? (
          <Skeleton className="h-9 w-full" />
        ) : log.entries.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            Nothing on the record yet — log a forecast from any Video Report.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Logged</TableHead>
                <TableHead>For date</TableHead>
                <TableHead className="text-right">Low</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">High</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[360px]">
                    {e.videoUrl ? (
                      <Link
                        href={`/videos/analyze?u=${encodeURIComponent(e.videoUrl)}`}
                        className="block truncate text-[12.5px] hover:text-primary"
                      >
                        {e.videoTitle ?? e.videoId ?? "—"}
                      </Link>
                    ) : (
                      <span className="truncate text-[12.5px]">{e.videoTitle ?? e.videoId ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">{ago(e.recordedAt)}</TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">{e.targetDate || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-[12px]">{fmtCompact(e.lowViews)}</TableCell>
                  <TableCell className="text-right font-mono text-[12px] text-foreground">{fmtCompact(e.expectedViews)}</TableCell>
                  <TableCell className="text-right font-mono text-[12px]">{fmtCompact(e.highViews)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  );
}
