"use client";

import { useEffect, useState } from "react";
import type { Blocklist } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";

interface CreatorBlocklistProps {
  /** Bumps when blocklist may have changed externally (e.g. block-from-row action) */
  refreshKey?: number;
  /** Called when the blocklist changes — parent should refresh reference store if purgeReferences was true */
  onChange?: (blocklist: Blocklist) => void;
}

export default function CreatorBlocklist({
  refreshKey = 0,
  onChange,
}: CreatorBlocklistProps) {
  const [blocklist, setBlocklist] = useState<Blocklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [addText, setAddText] = useState("");
  const [purgeRefs, setPurgeRefs] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/blocklist");
      if (res.ok) {
        const data: Blocklist = await res.json();
        setBlocklist(data);
      }
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    // Fire-and-forget mount/dep load — setState happens after async fetch, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [refreshKey]);

  async function addCreators() {
    const tokens = addText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;

    // Anything that looks like a YouTube channel ID (starts with UC + 22 chars) → channels
    // Otherwise → creator name
    const channels: string[] = [];
    const creators: string[] = [];
    for (const t of tokens) {
      if (/^UC[a-zA-Z0-9_-]{22}$/.test(t)) channels.push(t);
      else creators.push(t.replace(/^@/, ""));
    }

    setLoading(true);
    try {
      const res = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, creators, purgeReferences: purgeRefs }),
      });
      if (res.ok) {
        const data = await res.json();
        setBlocklist(data.blocklist);
        setAddText("");
        onChange?.(data.blocklist);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }

  async function unblock(kind: "channels" | "creators", value: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/blocklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [kind]: [value] }),
      });
      if (res.ok) {
        const data = await res.json();
        setBlocklist(data.blocklist);
        onChange?.(data.blocklist);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }

  if (!blocklist) {
    return (
      <CollapsibleSection title="Creator Blocklist" accentColor="var(--color-vrs-rework)">
        <div className="text-[10px] text-muted">Loading...</div>
      </CollapsibleSection>
    );
  }

  const total = blocklist.channels.length + blocklist.creators.length;

  return (
    <CollapsibleSection
      title="Creator Blocklist"
      subtitle={`${total} blocked · system disregards these creators when scraping & importing`}
      accentColor="var(--color-vrs-rework)"
    >
      <div className="space-y-2.5">
        {/* Add form */}
        <div>
          <label className="text-[8px] font-mono text-muted tracking-widest block mb-1">
            BLOCK CREATORS OR CHANNEL IDS (COMMA SEPARATED)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCreators();
              }}
              placeholder="e.g. spamcreator, @trash, UCxxxxxxxxxxxxxxxxxxxxxx"
              disabled={loading}
              className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              style={{ color: "var(--color-foreground)" }}
            />
            <button
              onClick={addCreators}
              disabled={loading || !addText.trim()}
              className="text-[10px] font-mono px-3 py-1.5 rounded font-bold"
              style={{
                background: !addText.trim()
                  ? "rgba(255,255,255,0.04)"
                  : "var(--color-vrs-rework)",
                color: !addText.trim() ? "var(--color-text-muted)" : "#fff",
                opacity: loading ? 0.5 : 1,
              }}
            >
              Block
            </button>
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={purgeRefs}
              onChange={(e) => setPurgeRefs(e.target.checked)}
              disabled={loading}
            />
            <span className="text-[9px] font-mono text-muted">
              Also purge existing entries from reference pool
            </span>
          </label>
        </div>

        {/* Blocked creators list */}
        {blocklist.creators.length > 0 && (
          <div>
            <div className="text-[8px] font-mono text-muted tracking-widest mb-1">
              CREATOR NAMES ({blocklist.creators.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {blocklist.creators.map((c) => (
                <button
                  key={c}
                  onClick={() => unblock("creators", c)}
                  disabled={loading}
                  className="text-[9px] font-mono px-2 py-0.5 rounded transition-colors group"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--color-vrs-rework)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                  title="Click to unblock"
                >
                  {c}
                  <span className="ml-1 opacity-50 group-hover:opacity-100">{"\u2715"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Blocked channel IDs */}
        {blocklist.channels.length > 0 && (
          <div>
            <div className="text-[8px] font-mono text-muted tracking-widest mb-1">
              CHANNEL IDS ({blocklist.channels.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {blocklist.channels.map((c) => (
                <button
                  key={c}
                  onClick={() => unblock("channels", c)}
                  disabled={loading}
                  className="text-[8px] font-mono px-2 py-0.5 rounded transition-colors group"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--color-vrs-rework)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                  title={`Click to unblock ${c}`}
                >
                  {c.length > 14 ? `${c.slice(0, 14)}…` : c}
                  <span className="ml-1 opacity-50 group-hover:opacity-100">{"\u2715"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <div className="text-[10px] text-muted text-center py-2">
            No creators blocked yet. Block low-quality or off-niche creators to keep your reference pool clean.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
