"use client";

// useForecastLog — the RM's curated prediction record ("I'm committing to
// this number"). Wraps /api/forecast/log.

import { useCallback, useEffect, useState } from "react";

export interface ForecastLogEntry {
  id: string;
  recordedAt: string;
  analyzedAt: string;
  targetDate: string;
  videoId?: string;
  videoUrl?: string;
  videoTitle?: string;
  platform: string;
  creatorHandle?: string;
  lowViews: number;
  expectedViews: number;
  highViews: number;
  currentViewsAtAnalysis?: number;
  notes?: string;
}

export function useForecastLog() {
  const [entries, setEntries] = useState<ForecastLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/forecast/log");
      const d = await r.json().catch(() => null);
      if (d?.ok && Array.isArray(d.entries)) setEntries(d.entries);
    } catch {
      /* list stays */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (entry: Omit<ForecastLogEntry, "id" | "recordedAt">) => {
      setSaving(true);
      try {
        const r = await fetch("/api/forecast/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const d = await r.json().catch(() => null);
        if (d?.ok) await refresh();
        return !!d?.ok;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/forecast/log?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        await refresh();
      } catch {
        /* keep list */
      }
    },
    [refresh],
  );

  return { entries, loading, saving, add, remove };
}
