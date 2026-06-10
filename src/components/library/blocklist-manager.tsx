"use client";

// Library → Blocklist: creators excluded from forecasts, reports, and the
// evidence pool.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { X } from "lucide-react";

export function BlocklistManager() {
  const [channels, setChannels] = useState<string[] | null>(null);
  const [creators, setCreators] = useState<string[] | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    fetch("/api/blocklist")
      .then((r) => r.json())
      .then((d) => {
        setChannels(Array.isArray(d?.channels) ? d.channels : []);
        setCreators(Array.isArray(d?.creators) ? d.creators : []);
      })
      .catch(() => {
        setChannels([]);
        setCreators([]);
      });
  }, []);
  useEffect(() => load(), [load]);

  const add = async () => {
    const v = name.trim();
    if (!v) return;
    const r = await fetch("/api/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v.startsWith("UC") && v.length === 24 ? { channels: [v] } : { creators: [v] }),
    });
    if (r.ok) {
      toast.success(`${v} blocked — excluded from forecasts and the pool.`);
      setName("");
      load();
    }
  };

  const remove = async (item: string, kind: "channels" | "creators") => {
    const r = await fetch("/api/blocklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [kind]: [item] }),
    });
    if (r.ok) {
      toast.success("Unblocked.");
      load();
    }
  };

  return (
    <Card className="mt-5">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">Blocked creators</CardTitle>
        <p className="text-[11.5px] text-muted-foreground">
          Excluded from forecasts, reports, and the evidence pool. Add a creator name or a YouTube channel ID.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Creator name or UC… channel ID" className="h-8 max-w-[320px] text-[12.5px]" />
          <Button type="submit" size="sm" variant="outline" className="h-8">Block</Button>
        </form>

        {channels === null || creators === null ? (
          <Skeleton className="mt-4 h-10 w-full" />
        ) : channels.length + creators.length === 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">Nobody is blocked.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {creators.map((c) => (
              <span key={`c-${c}`} className="inline-flex items-center gap-1 rounded-[4px] border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-mono text-[11px] text-foreground">
                {c}
                <button type="button" onClick={() => void remove(c, "creators")} className="text-muted-foreground/60 hover:text-foreground" aria-label={`Unblock ${c}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {channels.map((c) => (
              <span key={`ch-${c}`} className="inline-flex items-center gap-1 rounded-[4px] border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-mono text-[11px] text-foreground">
                {c}
                <button type="button" onClick={() => void remove(c, "channels")} className="text-muted-foreground/60 hover:text-foreground" aria-label={`Unblock ${c}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
