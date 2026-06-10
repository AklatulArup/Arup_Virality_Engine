"use client";

import { useState, useMemo } from "react";
import type { ReferenceEntry, VideoFormat, SentimentLabel } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { getVRSColor } from "@/lib/vrs";
import { classifyVideoFormat, formatDuration as fmtDur, quickSentiment } from "@/lib/video-classifier";
import CollapsibleSection from "./CollapsibleSection";

interface ReferenceSearchProps {
  entries: ReferenceEntry[];
  onRemove?: (ids: string[]) => void;
  onBlockCreator?: (channelId: string, channelName: string) => void;
}

type SortKey = "views" | "engagement" | "vrs" | "recent" | "name" | "duration";
type FilterType = "all" | "video" | "channel";
type FormatFilter = "all" | "short" | "full";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "engagement", label: "Eng%" },
  { key: "vrs", label: "VRS" },
  { key: "duration", label: "Length" },
  { key: "recent", label: "Recent" },
  { key: "name", label: "A-Z" },
];

function getMetricValue(entry: ReferenceEntry, key: SortKey): number {
  if (key === "views") return entry.metrics.views ?? entry.metrics.medianViews ?? 0;
  if (key === "engagement") return entry.metrics.engagement ?? 0;
  if (key === "vrs") return entry.metrics.vrsScore ?? 0;
  if (key === "recent") return new Date(entry.analyzedAt).getTime();
  if (key === "duration") return entry.durationSeconds ?? 0;
  return 0;
}

/** Derive format for entries that don't have it stored yet */
function deriveFormat(e: ReferenceEntry): VideoFormat {
  if (e.videoFormat) return e.videoFormat;
  return classifyVideoFormat(e.durationSeconds, e.name, e.tags, e.description, e.platform);
}

/** Derive sentiment for entries that don't have it stored yet */
function deriveSentiment(e: ReferenceEntry): SentimentLabel {
  if (e.sentiment) return e.sentiment;
  const text = [e.name, ...(e.tags || []).slice(0, 10)].join(" ");
  return quickSentiment(text).label;
}

const SENTIMENT_CONFIG: Record<SentimentLabel, { color: string; icon: string }> = {
  positive: { color: "#22c55e", icon: "+" },
  neutral: { color: "#94a3b8", icon: "\u2022" },
  negative: { color: "#ef4444", icon: "\u2212" },
};

export default function ReferenceSearch({ entries, onRemove, onBlockCreator }: ReferenceSearchProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("views");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const PAGE_SIZE = 30;

  // Stats
  const stats = useMemo(() => {
    const videos = entries.filter((e) => e.type === "video");
    const channels = entries.filter((e) => e.type === "channel");
    const viewsArr = videos.map((e) => e.metrics.views ?? 0).filter((v) => v > 0);
    const totalViews = viewsArr.reduce((a, b) => a + b, 0);
    const avgViews = viewsArr.length > 0 ? Math.round(totalViews / viewsArr.length) : 0;
    const uniqueChannels = new Set(entries.map((e) => e.channelName)).size;
    const withVRS = videos.filter((e) => e.metrics.vrsScore && e.metrics.vrsScore > 0);
    const avgVRS = withVRS.length > 0 ? Math.round(withVRS.reduce((a, e) => a + (e.metrics.vrsScore ?? 0), 0) / withVRS.length) : 0;
    const shorts = videos.filter((e) => deriveFormat(e) === "short").length;
    const fullLen = videos.filter((e) => deriveFormat(e) === "full").length;
    return { videos: videos.length, channels: channels.length, avgViews, uniqueChannels, avgVRS, totalViews, shorts, fullLen };
  }, [entries]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = [...entries];
    if (filterType !== "all") {
      list = list.filter((e) => e.type === filterType);
    }
    if (formatFilter !== "all") {
      list = list.filter((e) => e.type === "video" && deriveFormat(e) === formatFilter);
    }
    if (query.trim().length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.channelName.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => getMetricValue(b, sortBy) - getMetricValue(a, sortBy));
    }
    return list;
  }, [entries, query, sortBy, filterType, formatFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleQuery = (val: string) => { setQuery(val); setPage(0); };
  const handleSort = (key: SortKey) => { setSortBy(key); setPage(0); };
  const handleFilter = (type: FilterType) => { setFilterType(type); setPage(0); };
  const handleFormatFilter = (f: FormatFilter) => { setFormatFilter(f); setPage(0); };

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    const pageIds = pageEntries.map((e) => e.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    setRemoving(true);
    try {
      const ids = [...selected];
      const res = await fetch("/api/reference-store", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelected(new Set());
        onRemove?.(ids);
      }
    } catch { /* silent */ }
    setRemoving(false);
  };

  const blockSelected = async () => {
    if (selected.size === 0 || !onBlockCreator) return;
    setRemoving(true);
    try {
      // Collect unique channelId/channelName pairs from selected entries
      const seen = new Set<string>();
      const targets: { channelId: string; channelName: string }[] = [];
      for (const entry of entries) {
        if (!selected.has(entry.id)) continue;
        const key = entry.channelId || entry.channelName;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        targets.push({ channelId: entry.channelId, channelName: entry.channelName });
      }

      const channels = targets.map((t) => t.channelId).filter((c) => /^UC[a-zA-Z0-9_-]{22}$/.test(c));
      const creators = targets.map((t) => t.channelName.toLowerCase()).filter(Boolean);

      const res = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, creators, purgeReferences: true }),
      });
      if (res.ok) {
        // Notify parent: remove all matching entries from local state
        const removedIds = entries
          .filter(
            (e) =>
              channels.includes(e.channelId) ||
              creators.includes((e.channelName || "").toLowerCase())
          )
          .map((e) => e.id);
        setSelected(new Set());
        onRemove?.(removedIds);
        // First target is enough for the parent to refresh blocklist viewer
        if (targets[0]) onBlockCreator(targets[0].channelId, targets[0].channelName);
      }
    } catch {
      /* silent */
    }
    setRemoving(false);
  };

  const blockSingleCreator = async (channelId: string, channelName: string) => {
    if (!onBlockCreator) return;
    setRemoving(true);
    try {
      const channels = /^UC[a-zA-Z0-9_-]{22}$/.test(channelId) ? [channelId] : [];
      const creators = channelName ? [channelName.toLowerCase()] : [];
      const res = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, creators, purgeReferences: true }),
      });
      if (res.ok) {
        const removedIds = entries
          .filter(
            (e) =>
              e.channelId === channelId ||
              (e.channelName || "").toLowerCase() === channelName.toLowerCase()
          )
          .map((e) => e.id);
        onRemove?.(removedIds);
        onBlockCreator(channelId, channelName);
      }
    } catch {
      /* silent */
    }
    setRemoving(false);
  };

  const removeSingle = async (id: string) => {
    setRemoving(true);
    try {
      const res = await fetch("/api/reference-store", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (res.ok) {
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
        onRemove?.([id]);
      }
    } catch { /* silent */ }
    setRemoving(false);
  };

  const pageAllSelected = pageEntries.length > 0 && pageEntries.every((e) => selected.has(e.id));

  return (
    <CollapsibleSection
      title="Reference Pool Browser"
      subtitle={`${entries.length} entries \u00b7 ${stats.uniqueChannels} creators \u00b7 ${formatNumber(stats.totalViews)} total views`}
      accentColor="var(--color-accent-blue)"
      defaultOpen
    >
      <div className="space-y-2.5">
        {/* Stats row */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Videos", value: stats.videos, color: "#60A5FA" },
            { label: "Shorts", value: stats.shorts, color: "#f59e0b" },
            { label: "Full-Length", value: stats.fullLen, color: "#6366f1" },
            { label: "Channels", value: stats.channels, color: "var(--color-accent-blue)" },
            { label: "Creators", value: stats.uniqueChannels, color: "var(--color-mode-c)" },
            { label: "Avg Views", value: formatNumber(stats.avgViews), color: "var(--color-mode-e)" },
          ].map((s) => (
            <div key={s.label} className="text-center px-2.5 py-1.5 rounded border border-border bg-background">
              <div className="text-[11px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[7px] font-mono text-[#9E9C97] tracking-widest">{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Search + filters bar */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              placeholder="Search videos, creators, or tags..."
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              style={{ color: "var(--color-foreground)" }}
            />
            {query && (
              <button
                onClick={() => handleQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9E9C97] hover:text-subtle"
              >
                {"\u2715"}
              </button>
            )}
          </div>
          {/* Type filter */}
          <div className="flex gap-0.5">
            {(["all", "video", "channel"] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleFilter(t)}
                className="text-[8px] font-mono px-2 py-1 rounded transition-colors"
                style={{
                  background: filterType === t ? "rgba(0,229,160,0.1)" : "transparent",
                  color: filterType === t ? "#60A5FA" : "var(--color-text-[#9E9C97])",
                  border: `1px solid ${filterType === t ? "#60A5FA" : "var(--color-border)"}`,
                }}
              >
                {t === "all" ? `All (${entries.length})` : t === "video" ? `Videos (${stats.videos})` : `Ch (${stats.channels})`}
              </button>
            ))}
          </div>
          {/* Format filter */}
          <div className="flex gap-0.5">
            {([
              { key: "all" as FormatFilter, label: "All Formats", color: "var(--color-accent-blue)" },
              { key: "short" as FormatFilter, label: `Shorts (${stats.shorts})`, color: "#f59e0b" },
              { key: "full" as FormatFilter, label: `Full (${stats.fullLen})`, color: "#6366f1" },
            ]).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => handleFormatFilter(key)}
                className="text-[8px] font-mono px-2 py-1 rounded transition-colors"
                style={{
                  background: formatFilter === key ? `color-mix(in srgb, ${color} 12%, transparent)` : "transparent",
                  color: formatFilter === key ? color : "var(--color-text-[#9E9C97])",
                  border: `1px solid ${formatFilter === key ? color : "var(--color-border)"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort bar + bulk actions */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-mono text-[#9E9C97] tracking-widest mr-1">SORT</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors"
              style={{
                background: sortBy === opt.key ? "rgba(100,149,237,0.12)" : "transparent",
                color: sortBy === opt.key ? "var(--color-accent-blue)" : "var(--color-text-[#9E9C97])",
                border: `1px solid ${sortBy === opt.key ? "var(--color-accent-blue)" : "transparent"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
          <span className="text-[8px] text-[#9E9C97] font-mono ml-auto">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
          {selected.size > 0 && (
            <>
              <button
                onClick={removeSelected}
                disabled={removing}
                className="text-[8px] font-mono px-2 py-0.5 rounded transition-colors ml-1"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  color: "var(--color-vrs-rework)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  opacity: removing ? 0.5 : 1,
                }}
              >
                {removing ? "Working..." : `Remove ${selected.size}`}
              </button>
              {onBlockCreator && (
                <button
                  onClick={blockSelected}
                  disabled={removing}
                  className="text-[8px] font-mono px-2 py-0.5 rounded transition-colors"
                  style={{
                    background: "rgba(239,68,68,0.18)",
                    color: "#fff",
                    border: "1px solid rgba(239,68,68,0.5)",
                    opacity: removing ? 0.5 : 1,
                  }}
                  title="Block these creators and purge all their entries"
                >
                  Block creators
                </button>
              )}
            </>
          )}
        </div>

        {/* Video list */}
        <div className="border border-border rounded overflow-hidden">
          {/* Table header */}
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-mono text-[#9E9C97] tracking-widest"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <button
              onClick={togglePageAll}
              className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
              style={{
                borderColor: pageAllSelected ? "#60A5FA" : "var(--color-border)",
                background: pageAllSelected ? "rgba(0,229,160,0.15)" : "transparent",
              }}
            >
              {pageAllSelected && <span className="text-[8px]" style={{ color: "#60A5FA" }}>{"\u2713"}</span>}
            </button>
            <span className="w-10 shrink-0">FORMAT</span>
            <span className="flex-1">TITLE / CREATOR</span>
            <span className="w-12 text-right shrink-0">LENGTH</span>
            <span className="w-14 text-right shrink-0">VIEWS</span>
            <span className="w-10 text-right shrink-0">ENG%</span>
            <span className="w-10 text-right shrink-0">SENT</span>
            {onBlockCreator && <span className="w-5 shrink-0"></span>}
            <span className="w-5 shrink-0"></span>
          </div>

          {/* Entries */}
          <div className="max-h-[420px] overflow-y-auto">
            {pageEntries.length === 0 && (
              <div className="text-[10px] text-[#9E9C97] text-center py-6">
                {query.length >= 2 ? `No matches for \u201c${query}\u201d` : "No entries in reference pool"}
              </div>
            )}
            {pageEntries.map((entry, i) => {
              const views = entry.metrics.views ?? entry.metrics.medianViews ?? 0;
              const eng = entry.metrics.engagement ?? 0;
              const rowBg = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";
              const isSelected = selected.has(entry.id);
              const format = deriveFormat(entry);
              const sentiment = deriveSentiment(entry);
              const sentCfg = SENTIMENT_CONFIG[sentiment];
              const dur = entry.durationSeconds;
              const durStr = dur && dur > 0 ? (entry.duration || fmtDur(dur)) : "\u2014";

              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-hover transition-colors"
                  style={{
                    background: isSelected ? "rgba(239,68,68,0.04)" : rowBg,
                    borderTop: "1px solid rgba(255,255,255,0.025)",
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(entry.id)}
                    className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: isSelected ? "var(--color-vrs-rework)" : "var(--color-border)",
                      background: isSelected ? "rgba(239,68,68,0.15)" : "transparent",
                    }}
                  >
                    {isSelected && <span className="text-[8px]" style={{ color: "var(--color-vrs-rework)" }}>{"\u2713"}</span>}
                  </button>

                  {/* Format badge */}
                  <span
                    className="text-[7px] font-mono font-bold px-1 py-0.5 rounded w-10 text-center shrink-0"
                    style={{
                      background: entry.type === "channel"
                        ? "color-mix(in srgb, var(--color-accent-blue) 15%, transparent)"
                        : format === "short"
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(99,102,241,0.12)",
                      color: entry.type === "channel"
                        ? "var(--color-accent-blue)"
                        : format === "short" ? "#f59e0b" : "#6366f1",
                    }}
                  >
                    {entry.type === "channel" ? "CH" : format === "short" ? "SHORT" : "FULL"}
                  </span>

                  {/* Title + channel */}
                  <div className="flex-1 min-w-0" style={{ overflow: "hidden", minWidth: 0 }}>
                    <a
                      href={entry.type === "channel" ? `https://www.youtube.com/channel/${entry.id}` : `https://www.youtube.com/watch?v=${entry.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] truncate leading-tight block hover:underline"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {entry.name}
                    </a>
                    <div className="text-[7px] text-[#9E9C97] font-mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                      {entry.channelName}
                      {entry.tags && entry.tags.length > 0 && (
                        <span className="ml-1 opacity-50">
                          {entry.tags.slice(0, 2).map((t) => `#${t.slice(0,12)}`).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Duration / Length */}
                  <span className="text-[8px] font-mono w-12 text-right shrink-0 text-[#9E9C97]">
                    {durStr}
                  </span>

                  {/* Views */}
                  <span
                    className="text-[9px] font-mono w-14 text-right shrink-0"
                    style={{
                      color: views >= 100000 ? "var(--color-vrs-excellent)" : views >= 10000 ? "#60A5FA" : "var(--color-text-[#9E9C97])",
                    }}
                  >
                    {views > 0 ? formatNumber(views) : "\u2014"}
                  </span>

                  {/* Engagement */}
                  <span
                    className="text-[9px] font-mono w-10 text-right shrink-0"
                    style={{
                      color: eng >= 5 ? "var(--color-vrs-excellent)" : eng >= 2 ? "#60A5FA" : "var(--color-text-[#9E9C97])",
                    }}
                  >
                    {eng > 0 ? `${eng.toFixed(1)}%` : "\u2014"}
                  </span>

                  {/* Sentiment */}
                  <span
                    className="text-[8px] font-mono font-bold w-10 text-center shrink-0"
                    style={{ color: sentCfg.color }}
                    title={`${sentiment} sentiment`}
                  >
                    <span
                      className="inline-block w-4 h-4 leading-4 rounded-full text-center text-[8px]"
                      style={{ background: `color-mix(in srgb, ${sentCfg.color} 15%, transparent)` }}
                    >
                      {sentCfg.icon}
                    </span>
                  </span>

                  {/* Block creator button */}
                  {onBlockCreator && (
                    <button
                      onClick={() => blockSingleCreator(entry.channelId, entry.channelName)}
                      disabled={removing}
                      className="w-5 shrink-0 text-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Block creator: ${entry.channelName}`}
                    >
                      <span className="text-[10px]" style={{ color: "var(--color-vrs-rework)" }}>{"\u2298"}</span>
                    </button>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeSingle(entry.id)}
                    disabled={removing}
                    className="w-5 shrink-0 text-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from pool"
                  >
                    <span className="text-[10px]" style={{ color: "var(--color-vrs-rework)" }}>{"\u2715"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-[8px] font-mono px-2 py-0.5 rounded border border-border transition-colors"
              style={{
                color: page === 0 ? "var(--color-text-[#9E9C97])" : "#60A5FA",
                opacity: page === 0 ? 0.4 : 1,
              }}
            >
              {"\u2190"} Prev
            </button>
            <span className="text-[8px] font-mono text-[#9E9C97]">
              Page {page + 1} of {totalPages} {"\u00b7"} showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-[8px] font-mono px-2 py-0.5 rounded border border-border transition-colors"
              style={{
                color: page >= totalPages - 1 ? "var(--color-text-[#9E9C97])" : "#60A5FA",
                opacity: page >= totalPages - 1 ? 0.4 : 1,
              }}
            >
              Next {"\u2192"}
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
