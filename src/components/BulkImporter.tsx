"use client";

import { useState, useRef } from "react";
import CollapsibleSection from "./CollapsibleSection";

interface ImportResult {
  url: string;
  status: "ok" | "skipped" | "error" | "stub";
  platform: string;
  message: string;
  videoCount?: number;
  channelName?: string;
}

interface BulkImporterProps {
  onComplete: (added: number) => void;
}

const STATUS_COLORS: Record<ImportResult["status"], string> = {
  ok: "var(--color-vrs-excellent)",
  stub: "var(--color-accent-blue)",
  skipped: "var(--color-text-[#9E9C97])",
  error: "var(--color-vrs-rework)",
};

/**
 * Extract URLs from raw text input. Splits on newlines, commas, and whitespace.
 * Filters out blanks. Accepts handles like "@fundednext" too.
 */
function parseUrlsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extract URLs from CSV/TSV content. Looks at every cell and keeps anything
 * that looks like a URL or @handle.
 */
function parseUrlsFromCsv(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const urls: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Split on comma, tab, semicolon
    const cells = line.split(/[,\t;]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    for (const cell of cells) {
      if (!cell) continue;
      if (
        /^https?:\/\//i.test(cell) ||
        /^@[a-zA-Z0-9_.-]+$/.test(cell) ||
        /youtube\.com|youtu\.be|tiktok\.com|instagram\.com/i.test(cell)
      ) {
        urls.push(cell);
      }
    }
  }
  return urls;
}

export default function BulkImporter({ onComplete }: BulkImporterProps) {
  const [text, setText] = useState("");
  const [depth, setDepth] = useState(200);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{
    processed: number;
    added: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const urlCount = parseUrlsFromText(text).length;

  async function handleCsvFile(file: File) {
    try {
      const content = await file.text();
      const csvUrls = parseUrlsFromCsv(content);
      if (csvUrls.length === 0) {
        setError(`No URLs found in ${file.name}`);
        return;
      }
      setCsvName(`${file.name} (${csvUrls.length} URLs)`);
      // Append to existing text
      setText((prev) => {
        const existing = prev.trim();
        return existing ? `${existing}\n${csvUrls.join("\n")}` : csvUrls.join("\n");
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read CSV");
    }
  }

  async function runImport() {
    const urls = parseUrlsFromText(text);
    if (urls.length === 0) {
      setError("Add at least one URL or handle");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSummary(null);
    setProgress(`Importing ${urls.length} URL${urls.length !== 1 ? "s" : ""}...`);

    try {
      const res = await fetch("/api/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, discographyDepth: depth }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Import failed (${res.status})`);
      }
      const data: {
        success: boolean;
        processed: number;
        addedEntries: number;
        totalEntries: number;
        results: ImportResult[];
      } = await res.json();

      setResults(data.results);
      setSummary({
        processed: data.processed,
        added: data.addedEntries,
        total: data.totalEntries,
      });
      setProgress("");
      onComplete(data.addedEntries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setProgress("");
    }
    setLoading(false);
  }

  function resetAll() {
    setText("");
    setCsvName(null);
    setResults(null);
    setSummary(null);
    setError(null);
  }

  return (
    <CollapsibleSection
      title="Bulk Importer"
      subtitle="Paste video/channel links from YouTube, TikTok, Instagram — auto-fetches full creator discography"
      accentColor="#60A5FA"
      defaultOpen
    >
      <div className="space-y-3">
        {/* Input area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[9px] font-mono text-[#9E9C97] tracking-widest">
              URLS / HANDLES (ONE PER LINE)
            </label>
            <span className="text-[9px] font-mono text-[#9E9C97]">
              {urlCount} item{urlCount !== 1 ? "s" : ""}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            rows={6}
            placeholder={
              "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n" +
              "https://www.youtube.com/@fundednext\n" +
              "@traderlion\n" +
              "https://www.tiktok.com/@username/video/1234567890\n" +
              "https://www.instagram.com/reel/ABC123/"
            }
            className="w-full bg-background border border-border rounded px-2.5 py-2 text-[10px] font-mono focus:outline-none focus:border-accent resize-none"
            style={{ color: "var(--color-foreground)" }}
          />
          <div className="text-[8px] text-border-light mt-1">
            Pasting any video link auto-fetches the creator&apos;s entire
            discography. Channel handles, /channel/ID URLs, /@handle, /shorts/
            and full-length videos all work.
          </div>
        </div>

        {/* CSV upload + depth slider */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="text-[9px] font-mono px-2 py-1 rounded transition-colors"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-accent-blue)",
              background: "transparent",
            }}
          >
            + Append CSV file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsvFile(f);
              e.target.value = ""; // reset so same file re-uploads
            }}
          />
          {csvName && (
            <span className="text-[9px] font-mono text-[#9E9C97]">{csvName}</span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-[8px] font-mono text-[#9E9C97] tracking-widest">
              DEPTH PER CREATOR
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={depth}
              disabled={loading}
              onChange={(e) =>
                setDepth(
                  Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 200))
                )
              }
              className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-right focus:outline-none focus:border-accent"
              style={{ color: "var(--color-foreground)" }}
            />
            <span className="text-[8px] font-mono text-[#9E9C97]">videos</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={runImport}
            disabled={loading || urlCount === 0}
            className="text-[10px] font-mono px-3 py-1.5 rounded transition-colors font-bold"
            style={{
              background:
                loading || urlCount === 0
                  ? "rgba(255,255,255,0.04)"
                  : "#60A5FA",
              color:
                loading || urlCount === 0
                  ? "var(--color-text-[#9E9C97])"
                  : "#000",
              opacity: loading || urlCount === 0 ? 0.5 : 1,
            }}
          >
            {loading
              ? "Importing..."
              : `Import ${urlCount || ""} & fetch discography`}
          </button>
          {(text || results) && !loading && (
            <button
              onClick={resetAll}
              className="text-[9px] font-mono px-2 py-1 rounded transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-[#9E9C97])",
                background: "transparent",
              }}
            >
              Reset
            </button>
          )}
          {progress && (
            <span className="text-[9px] font-mono text-[#9E9C97]">{progress}</span>
          )}
        </div>

        {error && (
          <div
            className="text-[9px] font-mono px-2 py-1.5 rounded"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "var(--color-vrs-rework)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div
            className="text-[10px] font-mono px-2.5 py-2 rounded flex gap-3 flex-wrap"
            style={{
              background: "rgba(0,229,160,0.06)",
              border: "1px solid rgba(0,229,160,0.2)",
            }}
          >
            <span style={{ color: "var(--color-vrs-excellent)" }}>
              + {summary.added} new entries
            </span>
            <span className="text-[#9E9C97]">
              {summary.processed} URL{summary.processed !== 1 ? "s" : ""} processed
            </span>
            <span className="text-[#9E9C97]">
              {summary.total} total in pool
            </span>
          </div>
        )}

        {/* Per-URL results */}
        {results && results.length > 0 && (
          <div className="border border-border rounded overflow-hidden">
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-mono text-[#9E9C97] tracking-widest"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span className="w-12 shrink-0">STATUS</span>
              <span className="w-16 shrink-0">PLATFORM</span>
              <span className="flex-1">URL / CREATOR</span>
              <span className="w-12 text-right shrink-0">ADDED</span>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-mono"
                  style={{
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    borderTop: "1px solid rgba(255,255,255,0.025)",
                  }}
                >
                  <span
                    className="w-12 shrink-0 font-bold uppercase"
                    style={{ color: STATUS_COLORS[r.status] }}
                  >
                    {r.status}
                  </span>
                  <span className="w-16 shrink-0 text-[#9E9C97] uppercase">
                    {r.platform.replace("youtube-", "yt ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ color: "var(--color-foreground)" }}>
                      {r.channelName || r.url}
                    </div>
                    <div className="text-[8px] text-[#9E9C97] truncate">
                      {r.message}
                    </div>
                  </div>
                  <span
                    className="w-12 text-right shrink-0"
                    style={{
                      color:
                        r.videoCount && r.videoCount > 0
                          ? "#60A5FA"
                          : "var(--color-text-[#9E9C97])",
                    }}
                  >
                    {r.videoCount ? `+${r.videoCount}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
