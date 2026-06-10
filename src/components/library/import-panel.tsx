"use client";

// Library → Import: grow the evidence base. CSV exports (platform analytics)
// and bulk creator URLs (full-history ingestion).

import { useRef, useState } from "react";
import { usePool } from "@/hooks/use-pool";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileSpreadsheet, Users } from "lucide-react";

export function ImportPanel() {
  const { refresh } = usePool();
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [urls, setUrls] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const importCsv = async (file: File) => {
    setCsvBusy(true);
    try {
      const text = await file.text();
      const r = await fetch("/api/csv-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d) {
        const added = d.added ?? d.imported ?? d.count ?? "—";
        toast.success(`CSV imported — ${added} entries added to the pool.`);
        void refresh();
      } else {
        toast.error(d?.error ?? "Could not parse that CSV.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setCsvBusy(false);
    }
  };

  const runBulk = async () => {
    const list = urls
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const r = await fetch("/api/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: list, discographyDepth: 200 }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d) {
        const summary = typeof d.added === "number" ? `${d.added} entries added` : "Import complete";
        setBulkResult(summary);
        toast.success(summary);
        setUrls("");
        void refresh();
      } else {
        toast.error(d?.error ?? "Bulk import failed.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk import failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
            <FileSpreadsheet className="size-4 text-muted-foreground" />
            CSV import
          </CardTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Platform analytics exports (YouTube Studio, TikTok Studio, Meta Business Suite). Every row becomes pool
            evidence.
          </p>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => csvRef.current?.click()}
            disabled={csvBusy}
            className="flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-border bg-background px-4 py-10 text-center transition-colors hover:border-ring disabled:opacity-50"
          >
            <span className="text-[13px] text-foreground">{csvBusy ? "Importing…" : "Choose a CSV file"}</span>
            <span className="text-[11.5px] text-muted-foreground">We detect the platform&apos;s column layout automatically</span>
          </button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
            <Users className="size-4 text-muted-foreground" />
            Bulk creators
          </CardTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Paste creator URLs (one per line) — we ingest each creator&apos;s full recent history into the pool.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"https://www.youtube.com/@creator\nhttps://www.tiktok.com/@creator"}
            className="min-h-[120px] font-mono text-[12px]"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" onClick={() => void runBulk()} disabled={bulkBusy || !urls.trim()}>
              {bulkBusy ? "Ingesting…" : "Ingest history"}
            </Button>
            {bulkResult ? <span className="font-mono text-[11px] text-[#2ECC8A]">{bulkResult}</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
