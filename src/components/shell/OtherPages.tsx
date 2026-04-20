"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BULK / CALENDAR / LIBRARIES / REFERENCE PAGES
// ═══════════════════════════════════════════════════════════════════════════
//
// Grouped into one file because each is primarily layout + content; business
// logic for the full versions lives in the legacy Dashboard components which
// these pages either embed or link to. Ported from `page-tools.jsx`.

import React, { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/design-tokens";
import { computePoolStats, type MinimalEntry } from "@/lib/pool-stats";
import { fmtCount } from "@/lib/number-format";

interface ReferenceEntry {
  id?:       string;
  platform?: string;
  type?:     string;
  name?:     string;
  channelName?: string;
  metrics?:  Record<string, number | string>;
  analyzedAt?: string;
  tags?:     string[];
}

// ═════════════════════════════ BULK CSV IMPORT ═════════════════════════

export function BulkImportPage() {
  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <PageHeader title="Bulk CSV Import" sub="Import · Enrich · Save all historical data" />

        {/* Callout pointing RMs to the NEW private-analytics CSV upload path
            (TikTok Studio / Meta Business Suite exports). That flow lives in
            the ForecastPanel per-creator — not here — so without this
            pointer an RM looking at "CSV Import" would assume this page
            handles it and miss the feature entirely. */}
        <section style={{
          ...panelStyle,
          borderColor: `${T.cyan}33`,
          background: `${T.cyan}08`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 4,
              background: `${T.cyan}22`, border: `1px solid ${T.cyan}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: T.cyan, fontSize: 12, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace",
              flexShrink: 0,
            }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginBottom: 4 }}>
                Looking for private-analytics CSV (TikTok Studio / Meta Business Suite)?
              </div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkMuted, lineHeight: 1.6 }}>
                Per-post Creator Studio exports (completion %, saves, reach, 3-sec plays) upload from the Forecast panel — after analyzing a TikTok or Instagram creator, use the <span style={{ color: T.cyan }}>&ldquo;Import analytics CSV&rdquo;</span> button next to the screenshot-OCR dropzone. That flow writes to per-creator memory.
                <br />
                The CSV importer below is for <span style={{ color: T.ink }}>bulk creator ingestion</span> (URLs + handles) — different purpose.
              </div>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>Bulk creator import</span>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, letterSpacing: 1.3, color: T.inkFaint, textTransform: "uppercase" }}>
              Creators · Videos · Extract keywords · Build historical dataset
            </span>
          </div>

          <InsetBox title="Accepted CSV Formats">
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim, lineHeight: 1.7,
            }}>
              <div>• <span style={{ color: T.cyan }}>YT Channel:</span> @Mrbeast or youtube.com/c/…</div>
              <div>• <span style={{ color: T.cyan }}>YT Video:</span> youtube.com/watch?v=…</div>
              <div>• <span style={{ color: T.cyan }}>TikTok CSV:</span> @handle or tiktok.com/…</div>
              <div>• <span style={{ color: T.cyan }}>Instagram:</span> @handle or instagram.com/…</div>
              <div>• <span style={{ color: T.cyan }}>YT Shorts:</span> youtube.com/shorts/…</div>
              <div>• <span style={{ color: T.cyan }}>Metrics CSV:</span> URL + views + likes + comments</div>
              <div>• <span style={{ color: T.cyan }}>URL list:</span> One URL/@handle per line</div>
            </div>
          </InsetBox>

          <InsetBox title="How to export your data from each platform">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <ExportBlock color={T.purple} icon="◈" name="Instagram" steps={[
                "Go to your Professional Dashboard",
                "Tap 'See all insights'",
                "Filter by Content type → Reels/Posts",
                "Tap '⋯' → Export data → Download CSV",
                "Or use Creator Studio → Content Library → Export",
              ]} />
              <ExportBlock color={T.cyan} icon="♪" name="TikTok" steps={[
                "Open TikTok Creator Center",
                "Analytics → Content tab",
                "Filter date range",
                "Click 'Download data' → CSV",
                "Or use TikTok Business Center Analytics",
              ]} />
              <ExportBlock color={T.red} icon="▶" name="YouTube" steps={[
                "YouTube Studio → Analytics",
                "Click 'Advanced mode'",
                "Select date range + metrics",
                "Click 'Export current view' (↓)",
                "Download as CSV",
              ]} />
            </div>
          </InsetBox>

          <textarea
            defaultValue={"Paste URLs, @handles, or drop a CSV file here…\n\nExamples:\n@MrBeast\nhttps://youtube.com/watch?v=abc123\n@khaby.lame\nhttps://instagram.com/cristiano"}
            style={{
              width: "100%", minHeight: 160, resize: "vertical", padding: 14,
              background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 4,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: T.inkMuted,
              outline: "none", marginBottom: 12,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={inlineBtn}>📂 Upload CSV</button>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkFaint }}>Depth:</span>
            <select defaultValue="50" style={{
              padding: "8px 10px", background: T.bgDeep, border: `1px solid ${T.line}`,
              color: T.inkDim, borderRadius: 3,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
            }}>
              <option value="25">25 videos/channel</option>
              <option value="50">50 videos/channel</option>
              <option value="100">100 videos/channel</option>
            </select>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint }}>per creator</span>
            <button style={{
              marginLeft: "auto", padding: "9px 18px", borderRadius: 3,
              background: T.amberDim, border: `1px solid ${T.amber}55`,
              color: T.amber, fontFamily: "IBM Plex Mono, monospace",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>⚡ Run Import</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExportBlock({ color, icon, name, steps }: { color: string; icon: string; name: string; steps: string[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color, fontSize: 12 }}>{icon}</span>
        <span style={{ color, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, fontWeight: 600 }}>{name}</span>
      </div>
      <ol style={{
        margin: 0, paddingLeft: 16,
        fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim, lineHeight: 1.85,
      }}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

// ═════════════════════════════ CALENDAR ═════════════════════════════════

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  // Fetch reference store to heat the calendar from real publishedAt dates.
  const [heatByDay, setHeatByDay] = useState<Record<number, { v: number; color: string }>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/reference-store")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const entries: ReferenceEntry[] = Array.isArray(d?.entries) ? d.entries : Array.isArray(d) ? d : [];
        const map: Record<number, number> = {};
        for (const e of entries) {
          const iso = e.analyzedAt ?? (e.metrics?.publishedAt as string | undefined) ?? "";
          if (typeof iso !== "string") continue;
          const dt = new Date(iso);
          if (dt.getFullYear() !== year || dt.getMonth() !== month) continue;
          const day = dt.getDate();
          const views = Number(e.metrics?.views ?? 0);
          map[day] = (map[day] ?? 0) + views;
        }
        const heat: Record<number, { v: number; color: string }> = {};
        for (const [day, v] of Object.entries(map)) {
          heat[Number(day)] = { v, color: pickHeatColor(v) };
        }
        setHeatByDay(heat);
      })
      .catch(() => {});
  }, [year, month]);

  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 15, color: T.ink, fontWeight: 600 }}>Historical Data Calendar</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, letterSpacing: 1.3, color: T.inkFaint, textTransform: "uppercase", marginTop: 3 }}>
                {Object.keys(heatByDay).length} days with data in {monthName}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 12 }}>
            <button
              onClick={() => { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}
              style={navBtn}
            >‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, color: T.ink, fontWeight: 500 }}>{monthName}</div>
            </div>
            <button
              onClick={() => { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}
              style={navBtn}
            >›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} style={{
                fontFamily: "IBM Plex Mono, monospace", fontSize: 10, letterSpacing: 1.2,
                textTransform: "uppercase", color: T.inkFaint, textAlign: "left", padding: "0 8px",
              }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} style={{ height: 68 }} />;
              const item = heatByDay[d];
              return (
                <div
                  key={i}
                  style={{
                    height: 68, borderRadius: 4, padding: "6px 8px",
                    background: item ? `${item.color}18` : "rgba(255,255,255,0.015)",
                    border: item ? `1px solid ${item.color}44` : `1px solid ${T.line}`,
                    position: "relative",
                    outline: d === todayDay ? `1px solid ${T.inkDim}` : "none",
                  }}
                >
                  <div style={{
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 12,
                    color: item ? T.ink : T.inkFaint,
                    fontWeight: item ? 500 : 400,
                    textAlign: "right",
                  }}>{d}</div>
                  {item && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-30%)", textAlign: "center" }}>
                      <div style={{ width: 5, height: 5, borderRadius: 99, background: item.color, margin: "0 auto 4px", boxShadow: `0 0 6px ${item.color}` }} />
                      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: item.color }}>{fmtViews(item.v)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 14, marginTop: 14,
            fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, color: T.inkMuted,
          }}>
            <span style={{ letterSpacing: 1.2, textTransform: "uppercase", color: T.inkFaint }}>Heat scale</span>
            <Heat color="#2a2b2e"   label="0" />
            <Heat color={T.green}   label="1k+" />
            <Heat color={T.blue}    label="10k+" />
            <Heat color={T.purple}  label="50k+" />
            <Heat color={T.amber}   label="100k+" />
            <Heat color={T.pink}    label="500k+" />
          </div>
        </section>
      </div>
    </div>
  );
}

function Heat({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, opacity: 0.7 }} />
      {label}
    </span>
  );
}

function pickHeatColor(v: number): string {
  if (v >= 500_000) return T.pink;
  if (v >= 100_000) return T.amber;
  if (v >= 50_000)  return T.purple;
  if (v >= 10_000)  return T.blue;
  if (v >= 1_000)   return T.green;
  return "#2a2b2e";
}

// ═════════════════════════════ LIBRARIES ═════════════════════════════════

// Each library gets a distinct glyph so the cards read at a glance.
// Previously every card used the same `▶` triangle, which made the
// four libraries visually indistinguishable.
const LIBRARIES = [
  { id: "keywords",    title: "Keyword Bank Manager", sub: "Niche · competitors · content types · languages", color: T.pink,   icon: "Kw" },
  { id: "hashtags",    title: "Hashtag Bank",         sub: "Tracked hashtags across categories",              color: T.cyan,   icon: "#" },
  { id: "competitors", title: "Competitor Bank",      sub: "Tracked prop-firm competitors",                    color: T.amber,  icon: "vs" },
  { id: "blocklist",   title: "Creator Blocklist",    sub: "System disregards these creators when scraping",  color: T.gray,   icon: "⊘" },
];

export function LibrariesPage() {
  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <PageHeader title="Libraries" sub="Keywords · Hashtags · Competitors · Blocklist" />
        {LIBRARIES.map(lib => (
          <div
            key={lib.id}
            style={{
              padding: "14px 16px", background: T.bgPanel, border: `1px solid ${T.line}`,
              borderRadius: 4, display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 4,
              background: `${lib.color}22`, border: `1px solid ${lib.color}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: lib.color, fontSize: lib.icon.length > 1 ? 11 : 14,
              fontWeight: 600, fontFamily: "IBM Plex Mono, monospace",
            }}>{lib.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{lib.title}</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, color: T.inkFaint, marginTop: 3 }}>{lib.sub}</div>
            </div>
            <button style={{
              padding: "5px 14px", borderRadius: 99, background: "transparent",
              border: `1px solid ${T.line}`, color: T.inkDim,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 10, letterSpacing: 1, cursor: "pointer",
            }}>VIEW</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════ REFERENCE POOL BROWSER ═══════════════════

// Helper — reads durationSeconds from the top level (where ingestion stores it)
// with a fallback to metrics.durationSeconds for legacy entries. Returns seconds.
function readDurationSeconds(r: ReferenceEntry): number {
  return (
    Number((r as unknown as { durationSeconds?: number }).durationSeconds ?? 0) ||
    Number(r.metrics?.durationSeconds ?? 0)
  );
}

// Bucket an entry into its canonical platform, re-classifying YouTube by
// duration/videoFormat so YTS entries don't fall into YTL.
function rowPlatform(r: ReferenceEntry): "youtube" | "youtube_short" | "tiktok" | "instagram" | "x" | "unknown" {
  const p = typeof r.platform === "string" ? r.platform : "";
  if (p === "tiktok" || p === "instagram" || p === "x" || p === "youtube_short") return p;
  if (p === "youtube") {
    const d = readDurationSeconds(r);
    const fmt = (r as unknown as { videoFormat?: string }).videoFormat ?? "";
    return (fmt === "short" || (d > 0 && d <= 60)) ? "youtube_short" : "youtube";
  }
  return "unknown";
}

const PAGE_SIZE = 50;

type PlatformFilter = "all" | "youtube" | "youtube_short" | "tiktok" | "instagram" | "x";

export function ReferencePoolPage() {
  const [rows, setRows] = useState<ReferenceEntry[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Views" | "Eng%" | "VRS" | "Length" | "Recent" | "A-Z">("Views");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/reference-store")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const arr: ReferenceEntry[] = Array.isArray(d?.entries) ? d.entries : Array.isArray(d) ? d : [];
        setRows(arr);
      })
      .catch(() => {});
  }, []);

  // Reset to page 0 whenever filters change, otherwise page=5 with a
  // freshly-filtered 12-row set would show an empty list. The effect's
  // purpose IS to sync state from external inputs, so the rule is disabled.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); }, [search, sort, platformFilter]);

  // Filter → sort pipeline. Filtering happens first (platform + text search)
  // then sorting, then pagination slicing.
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = rows.filter(r => {
      if (platformFilter !== "all" && rowPlatform(r) !== platformFilter) return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.channelName ?? "").toLowerCase().includes(q) ||
        (r.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    });
    const score = (r: ReferenceEntry) => Number(r.metrics?.views ?? 0);
    const cmp = (a: ReferenceEntry, b: ReferenceEntry) => {
      if (sort === "Views")  return score(b) - score(a);
      if (sort === "Eng%")   return Number(b.metrics?.engagement ?? 0) - Number(a.metrics?.engagement ?? 0);
      if (sort === "VRS")    return Number(b.metrics?.vrsScore ?? 0)   - Number(a.metrics?.vrsScore ?? 0);
      // Length sort now reads from the top-level durationSeconds so actual
      // video length sorts correctly (the previous metrics-only path was 0
      // for every row, so Length sort was a no-op).
      if (sort === "Length") return readDurationSeconds(b) - readDurationSeconds(a);
      if (sort === "Recent") return (b.analyzedAt ?? "").localeCompare(a.analyzedAt ?? "");
      return (a.name ?? "").localeCompare(b.name ?? "");
    };
    return base.sort(cmp);
  }, [rows, search, sort, platformFilter]);

  // Route all counts through the canonical pool-stats bucketer so the tiles
  // here AGREE with the Sidebar and the Landing page. See pool-stats.ts.
  const poolStats = useMemo(() => computePoolStats(rows as unknown as MinimalEntry[]), [rows]);
  const totalViews = rows.reduce((s, r) => s + Number(r.metrics?.views ?? 0), 0);
  const creators   = poolStats.totalCreators;
  const shorts     = poolStats.totalShorts;
  const full       = poolStats.totalLong;
  const videos     = poolStats.totalEntries;
  const avgViews   = videos > 0 ? totalViews / videos : 0;

  // Per-platform counts for the filter chips. Derived from computePoolStats
  // so the numbers match every other surface.
  const chipCounts = useMemo(() => {
    const map: Record<string, number> = { all: videos };
    for (const row of poolStats.rows) map[row.id] = row.count;
    return map;
  }, [poolStats, videos]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const firstRow  = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow   = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 3,
              background: T.cyanDim, color: T.cyan,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
            }}>▶</div>
            <div>
              <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>Reference Pool Browser</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, color: T.inkFaint, marginTop: 2 }}>
                {fmtCount(videos)} entries · {fmtCount(creators)} creators · {fmtViews(totalViews)} total views
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 12 }}>
            <StatTile v={fmtCount(videos)}      k="videos"      c={T.cyan} />
            <StatTile v={fmtCount(shorts)}      k="shorts"      c={T.pink} />
            <StatTile v={fmtCount(full)}        k="full-length" c={T.red} />
            <StatTile v={fmtCount(creators)}    k="creators"    c={T.green} />
            <StatTile v={fmtViews(totalViews)}  k="total views" c={T.purple} />
            <StatTile v={fmtViews(avgViews)}    k="avg views"   c={T.amber} />
          </div>

          {/* Platform filter chips — scope the browser view to a single
              platform. Count inside each chip is the live total after
              re-bucketing (matches sidebar + pool coverage). */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.3, color: T.inkFaint, textTransform: "uppercase", marginRight: 2 }}>Platform</span>
            {([
              { key: "all",           label: "All",     color: T.inkDim },
              { key: "youtube",       label: "YTL",     color: T.red    },
              { key: "youtube_short", label: "YTS",     color: T.pink   },
              { key: "tiktok",        label: "TTK",     color: T.cyan   },
              { key: "instagram",     label: "IGR",     color: T.purple },
              { key: "x",             label: "X",       color: T.gray   },
            ] as const).map(c => {
              const active = platformFilter === c.key;
              const count = chipCounts[c.key] ?? 0;
              return (
                <button
                  key={c.key}
                  onClick={() => setPlatformFilter(c.key as PlatformFilter)}
                  style={{
                    padding: "4px 10px", borderRadius: 2,
                    display: "flex", alignItems: "center", gap: 6,
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
                    background: active ? `${c.color}14` : "transparent",
                    border: `1px solid ${active ? `${c.color}55` : T.line}`,
                    color: active ? c.color : T.inkDim, cursor: "pointer",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: c.color, opacity: active ? 1 : 0.6 }} />
                  {c.label}
                  <span style={{ color: active ? c.color : T.inkFaint, fontSize: 9 }}>{fmtCount(count)}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos, creators, or tags… (live — no Enter needed)"
              style={{
                flex: 1, padding: "8px 12px",
                background: T.bgDeep, border: `1px solid ${T.lineMid}`, borderRadius: 3,
                color: T.inkDim, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  padding: "4px 10px", borderRadius: 2,
                  background: "transparent", border: `1px solid ${T.line}`,
                  color: T.inkFaint, fontFamily: "IBM Plex Mono, monospace", fontSize: 10, cursor: "pointer",
                }}
              >× clear</button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.3, color: T.inkFaint, textTransform: "uppercase" }}>Sort</span>
            {(["Views", "Eng%", "VRS", "Length", "Recent", "A-Z"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "4px 8px", borderRadius: 2,
                  fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
                  background: sort === s ? T.bgPanelHi : "transparent",
                  border: `1px solid ${sort === s ? T.lineMid : "transparent"}`,
                  color: sort === s ? T.ink : T.inkMuted, cursor: "pointer",
                }}
              >{s}</button>
            ))}
            <span style={{ marginLeft: "auto", fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: T.inkFaint }}>
              {filtered.length === 0
                ? "no results"
                : `${fmtCount(firstRow)}–${fmtCount(lastRow)} of ${fmtCount(filtered.length)}`}
            </span>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 3, overflow: "hidden" }}>
            {/* Columns widened from the old 70/1fr/70/80/60/60. New layout:
                Platform (60) + Format (60) + Title/Creator (1fr) + Length (70)
                + Views (85) + VRS (55) + Eng (60). Platform column is new so
                RMs can see at a glance which platform each row is on. */}
            <div style={{
              display: "grid", gridTemplateColumns: "60px 60px 1fr 70px 85px 55px 60px",
              columnGap: 10,
              padding: "8px 14px", background: "rgba(255,255,255,0.02)",
              fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5, letterSpacing: 1.3,
              textTransform: "uppercase", color: T.inkFaint,
              borderBottom: `1px solid ${T.line}`,
            }}>
              <div>Platform</div>
              <div>Format</div>
              <div>Title / Creator</div>
              <div style={{ textAlign: "right" }}>Length</div>
              <div style={{ textAlign: "right" }}>Views</div>
              <div style={{ textAlign: "right" }}>VRS</div>
              <div style={{ textAlign: "right" }}>Eng</div>
            </div>
            {pageRows.length === 0 ? (
              <div style={{ padding: "24px 14px", fontSize: 12, color: T.inkFaint, fontStyle: "italic", textAlign: "center" }}>
                {rows.length === 0
                  ? "Reference pool empty — analyze a creator to populate."
                  : filtered.length === 0
                    ? "No results match your search + filters."
                    : "No more rows."}
              </div>
            ) : (
              pageRows.map((r, i) => {
                const views    = Number(r.metrics?.views ?? 0);
                const eng      = Number(r.metrics?.engagement ?? 0);
                const vrs      = Number(r.metrics?.vrsScore ?? 0);
                const duration = readDurationSeconds(r);
                const videoFormat = (r as unknown as { videoFormat?: string }).videoFormat ?? "";
                const isShort  = videoFormat === "short" || (duration > 0 && duration <= 60);
                const fmtLen   = duration > 0 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : "—";
                const plat     = rowPlatform(r);
                const platColor =
                  plat === "youtube"       ? T.red    :
                  plat === "youtube_short" ? T.pink   :
                  plat === "tiktok"        ? T.cyan   :
                  plat === "instagram"     ? T.purple :
                  plat === "x"             ? T.gray   :
                                             T.inkFaint;
                const platCode =
                  plat === "youtube"       ? "YTL" :
                  plat === "youtube_short" ? "YTS" :
                  plat === "tiktok"        ? "TTK" :
                  plat === "instagram"     ? "IGR" :
                  plat === "x"             ? "X"   :
                                             "—";
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid", gridTemplateColumns: "60px 60px 1fr 70px 85px 55px 60px",
                      columnGap: 10,
                      padding: "9px 14px", alignItems: "center",
                      borderBottom: i < pageRows.length - 1 ? `1px solid ${T.line}` : "none",
                      fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim,
                    }}
                  >
                    {/* Platform chip */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4,
                      color: platColor,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: platColor }} />
                      {platCode}
                    </span>
                    {/* Format badge (SHORT/FULL) */}
                    <span style={{
                      padding: "2px 6px", borderRadius: 2,
                      background: isShort ? T.amberDim : T.redDim,
                      color:      isShort ? T.amber    : T.red,
                      fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textAlign: "center", width: 52,
                    }}>{isShort ? "SHORT" : "FULL"}</span>
                    {/* Title + creator */}
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ color: T.ink, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name || "—"}
                      </div>
                      <div style={{ color: T.inkFaint, fontSize: 10, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.channelName ?? ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtLen}</div>
                    <div style={{ textAlign: "right", color: T.ink, fontVariantNumeric: "tabular-nums" }}>
                      {views > 0 ? fmtViews(views) : "—"}
                    </div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {vrs > 0 ? vrs.toFixed(0) : "—"}
                    </div>
                    <div style={{ textAlign: "right", color: eng > 3 ? T.green : T.inkDim, fontVariantNumeric: "tabular-nums" }}>
                      {eng > 0 ? eng.toFixed(1) + "%" : "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination — only shown when there's more than one page. Previously
              the browser sliced to 50 entries with no way to see the rest; on
              a 2,200-entry pool that hid ~98% of the data. */}
          {filtered.length > PAGE_SIZE && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginTop: 10, fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5,
            }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={paginationBtnStyle(page === 0)}
              >← Prev</button>
              <span style={{ color: T.inkMuted }}>
                Page <span style={{ color: T.ink, fontWeight: 600 }}>{page + 1}</span> of {fmtCount(pageCount)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={paginationBtnStyle(page >= pageCount - 1)}
              >Next →</button>
              <span style={{ marginLeft: "auto", color: T.inkFaint }}>
                {PAGE_SIZE} per page
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 3,
    background: disabled ? "transparent" : T.bgPanelHi,
    border: `1px solid ${disabled ? T.line : T.lineMid}`,
    color: disabled ? T.inkFaint : T.inkDim,
    fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

// ═════════════════════════════ SHARED SUB-COMPONENTS ════════════════════

function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{title}</div>
        <div style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.3,
          textTransform: "uppercase", color: T.inkFaint, marginTop: 3,
        }}>{sub}</div>
      </div>
    </div>
  );
}

function InsetBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 14, borderRadius: 4,
      background: "rgba(255,255,255,0.02)", border: `1px solid ${T.line}`,
      marginBottom: 12,
    }}>
      <div style={{
        fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.4,
        textTransform: "uppercase", color: T.inkFaint, marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

function StatTile({ v, k, c }: { v: string; k: string; c: string }) {
  return (
    <div style={{ padding: "8px 10px", background: T.bgPanelHi, border: `1px solid ${T.line}`, borderRadius: 3 }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: c, fontWeight: 500, lineHeight: 1 }}>{v}</div>
      <div style={{
        fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5, letterSpacing: 1.2,
        textTransform: "uppercase", color: T.inkFaint, marginTop: 3,
      }}>{k}</div>
    </div>
  );
}

// ─── SHARED STYLES / HELPERS ──────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: T.bgPanel, border: `1px solid ${T.line}`,
  borderRadius: 4, padding: "16px 18px",
};

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 3,
  background: T.bgDeep, border: `1px solid ${T.line}`,
  color: T.inkDim, cursor: "pointer", fontSize: 14,
};

const inlineBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 3,
  background: T.bgDeep, border: `1px solid ${T.line}`,
  color: T.inkDim, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, cursor: "pointer",
};

function fmtViews(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}
