"use client";

// Library → Evidence pool: browse + prune what every forecast is compared
// against. Per-platform coverage strip with honest thin-pool disclosure.

import { useMemo, useState } from "react";
import { usePool } from "@/hooks/use-pool";
import { bucketOf } from "@/lib/pool-stats";
import type { Platform } from "@/lib/forecast";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const PAGE = 50;

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function PoolBrowser() {
  const { entries, stats, loading, write } = usePool();
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState<Platform | "all">("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (plat !== "all" && bucketOf(e) !== plat) return false;
      if (!needle) return true;
      return (e.name ?? "").toLowerCase().includes(needle) || (e.channelName ?? "").toLowerCase().includes(needle);
    });
  }, [entries, q, plat]);

  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const remove = async (id: string) => {
    const res = await write("/api/reference-store", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.ok) toast.success("Removed from the pool.");
  };

  return (
    <div className="mt-5">
      {/* Coverage strip */}
      {stats ? (
        <div className="flex flex-wrap gap-2">
          {stats.rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setPlat((p) => (p === r.id ? "all" : r.id));
                setPage(0);
              }}
              className="rounded-[6px] border px-3 py-1.5 font-mono text-[11px] transition-colors"
              style={{
                borderColor: plat === r.id ? PLATFORM_META[r.id].color : "var(--border)",
                color: PLATFORM_META[r.id].color,
                background: plat === r.id ? PLATFORM_META[r.id].dim : "var(--card)",
              }}
            >
              {PLATFORM_META[r.id].label} {r.count.toLocaleString()}
              {r.status === "below-min" || r.status === "empty" ? (
                <span className="ml-1.5 text-[#F0B35A]">thin — forecasts use defaults</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">{filtered.length.toLocaleString()} entries{plat !== "all" ? ` on ${PLATFORM_META[plat].label}` : ""}</p>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search titles or creators…" className="h-8 w-[260px] text-[13px]" />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((e) => {
                const b = bucketOf(e);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-[420px]">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: b ? PLATFORM_META[b].color : "#55534E" }} />
                        <span className="truncate text-[12.5px]">{e.name}</span>
                        {e.type === "channel" ? <span className="font-mono text-[9.5px] text-muted-foreground">channel</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">{e.channelName}</TableCell>
                    <TableCell className="text-right font-mono text-[12px]">
                      {typeof e.metrics?.views === "number" ? fmtCompact(e.metrics.views) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                      {e.analyzedAt ? new Date(e.analyzedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => void remove(e.id)}
                        className="text-muted-foreground/50 transition-colors hover:text-destructive"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2 font-mono text-[11.5px] text-muted-foreground">
              <Button variant="ghost" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>←</Button>
              {page + 1} / {pages}
              <Button variant="ghost" size="sm" className="h-7" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>→</Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
