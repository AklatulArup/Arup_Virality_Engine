"use client";

// /creators index — the evidence pool grouped by creator. Who's in our
// universe, how big they typically are, and where to click for the verdict.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Platform } from "@/lib/forecast";
import { usePool } from "@/hooks/use-pool";
import { bucketOf } from "@/lib/pool-stats";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CreatorRow {
  name: string;
  handleKey: string;
  platforms: Platform[];
  primary: Platform;
  videoCount: number;
  medianViews: number;
  lastSeen: string;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function CreatorsIndex() {
  const { entries, loading } = usePool();
  const [q, setQ] = useState("");

  const rows = useMemo<CreatorRow[]>(() => {
    const byCreator = new Map<string, { name: string; platforms: Map<Platform, number>; views: number[]; count: number; lastSeen: string }>();
    for (const e of entries) {
      if (e.type !== "video") continue;
      const bucket = bucketOf(e);
      if (!bucket) continue;
      const name = (e.channelName ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]/g, "");
      if (key.length < 2) continue;
      const fallback: { name: string; platforms: Map<Platform, number>; views: number[]; count: number; lastSeen: string } = {
        name,
        platforms: new Map<Platform, number>(),
        views: [],
        count: 0,
        lastSeen: "",
      };
      const slot = byCreator.get(key) ?? fallback;
      slot.platforms.set(bucket, (slot.platforms.get(bucket) ?? 0) + 1);
      const v = Number(e.metrics?.views) || 0;
      if (v > 0) slot.views.push(v);
      slot.count += 1;
      if (e.analyzedAt && e.analyzedAt > slot.lastSeen) slot.lastSeen = e.analyzedAt;
      byCreator.set(key, slot);
    }
    const list: CreatorRow[] = [];
    for (const [key, s] of byCreator.entries()) {
      if (s.count < 2) continue; // single stray entries aren't a "creator" yet
      const primary = [...s.platforms.entries()].sort((a, b) => b[1] - a[1])[0][0];
      list.push({
        name: s.name,
        handleKey: key,
        platforms: [...s.platforms.keys()],
        primary,
        videoCount: s.count,
        medianViews: median(s.views),
        lastSeen: s.lastSeen,
      });
    }
    return list.sort((a, b) => b.medianViews - a.medianViews);
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows).slice(0, 100);
  }, [rows, q]);

  const reportHref = (r: CreatorRow) => {
    const plat = r.primary === "youtube_short" ? "youtube" : r.primary;
    return `/creators/${plat}/${encodeURIComponent(r.name.replace(/^@/, ""))}`;
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          {rows.length.toLocaleString()} creators with 2+ tracked posts in the evidence pool
        </p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators…" className="h-8 w-[260px] text-[13px]" />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          The pool is empty — analyze a creator or import history to build the universe.
        </p>
      ) : (
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Platforms</TableHead>
              <TableHead className="text-right">Tracked posts</TableHead>
              <TableHead className="text-right">Typical views</TableHead>
              <TableHead className="text-right">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.handleKey}>
                <TableCell>
                  <Link href={reportHref(r)} className="text-[12.5px] text-foreground hover:text-primary">
                    {r.name} →
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex gap-1.5">
                    {r.platforms.map((p) => (
                      <Tooltip key={p}>
                        <TooltipTrigger asChild>
                          <span className="size-2.5 cursor-default rounded-full" style={{ background: PLATFORM_META[p].color }} />
                        </TooltipTrigger>
                        <TooltipContent className="font-mono text-[10.5px]">{PLATFORM_META[p].label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-[12px]">{r.videoCount}</TableCell>
                <TableCell className="text-right font-mono text-[12px]">{fmtCompact(r.medianViews)}</TableCell>
                <TableCell className="text-right font-mono text-[11.5px] text-muted-foreground">
                  {r.lastSeen ? new Date(r.lastSeen).toLocaleDateString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
