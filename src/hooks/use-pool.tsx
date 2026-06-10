"use client";

// ═══════════════════════════════════════════════════════════════════════════
// POOL PROVIDER — single session-wide reference-pool store
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the legacy pattern of four surfaces independently fetching the
// full /api/reference-store payload (~3.5MB) and re-syncing through the
// `ve:pool-updated` window event. One fetch per session; every pool or bank
// mutation goes through `write()`, which refreshes the shared store on
// success so all consumers (sidebar counts, creator index, reports) stay
// live without an event bus.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { ReferenceEntry } from "@/lib/types";
import { computePoolStats, sidebarCounts, type PoolStats } from "@/lib/pool-stats";

interface PoolContextValue {
  entries: ReferenceEntry[];
  stats: PoolStats | null;
  counts: { videos: number; creators: number; shorts: number } | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Run a mutating fetch (pool/bank writes); refreshes the store when the response is ok. */
  write: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const PoolContext = createContext<PoolContextValue | null>(null);

export function PoolProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ReferenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guards out-of-order responses when refresh() overlaps itself.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const r = await fetch("/api/reference-store");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (seq.current !== mySeq) return;
      const list = Array.isArray(d?.entries) ? (d.entries as ReferenceEntry[]) : [];
      setEntries(list);
      setError(null);
    } catch (e) {
      if (seq.current !== mySeq) return;
      setError(e instanceof Error ? e.message : "Could not load the evidence pool");
    } finally {
      if (seq.current === mySeq) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const write = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      if (res.ok) void refresh();
      return res;
    },
    [refresh],
  );

  const stats = useMemo(() => (entries.length > 0 ? computePoolStats(entries) : null), [entries]);
  const counts = useMemo(() => (entries.length > 0 ? sidebarCounts(entries) : null), [entries]);

  const value = useMemo(
    () => ({ entries, stats, counts, loading, error, refresh, write }),
    [entries, stats, counts, loading, error, refresh, write],
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function usePool(): PoolContextValue {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error("usePool must be used inside <PoolProvider>");
  return ctx;
}
