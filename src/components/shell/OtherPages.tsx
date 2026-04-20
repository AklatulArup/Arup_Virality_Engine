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
import StarField from "./StarField";

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
      <StarField />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <PageHeader title="Bulk CSV Import" sub="Import · Enrich · Save all historical data" />

        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>Bulk CSV Import</span>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, letterSpacing: 1.3, color: T.inkFaint, textTransform: "uppercase" }}>
              Import creators · Extract keywords · Build historical dataset
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
      <StarField />
      <div style={{ position: "relative", zIndex: 1 }}>
        <section style={{ ...panelStyle, position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, right: 0, top: 0, height: 2,
            background: `linear-gradient(90deg, ${T.red}, ${T.amber}, ${T.green}, ${T.cyan}, ${T.purple}, ${T.pink})`,
            opacity: 0.45,
          }} />
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

const LIBRARIES = [
  { id: "keywords",    title: "Keyword Bank Manager", sub: "Niche · competitors · content types · languages", color: T.pink },
  { id: "hashtags",    title: "Hashtag Bank",         sub: "Tracked hashtags across categories",              color: T.cyan },
  { id: "competitors", title: "Competitor Bank",      sub: "Tracked prop-firm competitors",                    color: T.amber },
  { id: "blocklist",   title: "Creator Blocklist",    sub: "System disregards these creators when scraping",  color: T.gray },
];

export function LibrariesPage() {
  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <StarField />
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
              color: lib.color, fontSize: 13,
            }}>▶</div>
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

export function ReferencePoolPage() {
  const [rows, setRows] = useState<ReferenceEntry[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Views" | "Eng%" | "VRS" | "Length" | "Recent" | "A-Z">("Views");

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? rows.filter(r =>
          (r.name ?? "").toLowerCase().includes(q) ||
          (r.channelName ?? "").toLowerCase().includes(q) ||
          (r.tags ?? []).some(t => t.toLowerCase().includes(q))
        )
      : rows.slice();
    const score = (r: ReferenceEntry) => Number(r.metrics?.views ?? 0);
    const cmp = (a: ReferenceEntry, b: ReferenceEntry) => {
      if (sort === "Views")  return score(b) - score(a);
      if (sort === "Eng%")   return Number(b.metrics?.engagement ?? 0) - Number(a.metrics?.engagement ?? 0);
      if (sort === "VRS")    return Number(b.metrics?.vrsScore ?? 0)   - Number(a.metrics?.vrsScore ?? 0);
      if (sort === "Length") return Number(b.metrics?.durationSeconds ?? 0) - Number(a.metrics?.durationSeconds ?? 0);
      if (sort === "Recent") return (b.analyzedAt ?? "").localeCompare(a.analyzedAt ?? "");
      return (a.name ?? "").localeCompare(b.name ?? "");
    };
    return list.sort(cmp);
  }, [rows, search, sort]);

  const totalViews = rows.reduce((s, r) => s + Number(r.metrics?.views ?? 0), 0);
  const creators = new Set(rows.map(r => r.channelName ?? r.name).filter(Boolean)).size;
  const shorts = rows.filter(r => (Number(r.metrics?.durationSeconds ?? 0) > 0 && Number(r.metrics?.durationSeconds ?? 0) <= 60)).length;
  const full = rows.filter(r => Number(r.metrics?.durationSeconds ?? 0) > 60).length;
  const avgViews = rows.length > 0 ? totalViews / rows.length : 0;

  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <StarField />
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
                {rows.length} entries · {creators} creators · {fmtViews(totalViews)} total views
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 12 }}>
            <StatTile v={String(rows.length)}   k="videos"      c={T.cyan} />
            <StatTile v={String(shorts)}        k="shorts"      c={T.pink} />
            <StatTile v={String(full)}          k="full-length" c={T.red} />
            <StatTile v={String(creators)}      k="creators"    c={T.green} />
            <StatTile v={fmtViews(totalViews)}  k="total views" c={T.purple} />
            <StatTile v={fmtViews(avgViews)}    k="avg views"   c={T.amber} />
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos, creators, or tags…"
              style={{
                flex: 1, padding: "8px 12px",
                background: T.bgDeep, border: `1px solid ${T.line}`, borderRadius: 3,
                color: T.inkDim, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, outline: "none",
              }}
            />
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
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "70px 1fr 70px 80px 60px 60px",
              padding: "8px 10px", background: "rgba(255,255,255,0.02)",
              fontFamily: "IBM Plex Mono, monospace", fontSize: 8.5, letterSpacing: 1.3,
              textTransform: "uppercase", color: T.inkFaint,
              borderBottom: `1px solid ${T.line}`,
            }}>
              <div>Format</div>
              <div>Title / Creator</div>
              <div style={{ textAlign: "right" }}>Length</div>
              <div style={{ textAlign: "right" }}>Views</div>
              <div style={{ textAlign: "right" }}>VRS</div>
              <div style={{ textAlign: "right" }}>Eng</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px 14px", fontSize: 12, color: T.inkFaint, fontStyle: "italic", textAlign: "center" }}>
                {rows.length === 0 ? "Reference pool empty — analyze a creator to populate." : "No results match your search."}
              </div>
            ) : (
              filtered.slice(0, 50).map((r, i) => {
                const views    = Number(r.metrics?.views ?? 0);
                const eng      = Number(r.metrics?.engagement ?? 0);
                const vrs      = Number(r.metrics?.vrsScore ?? 0);
                const duration = Number(r.metrics?.durationSeconds ?? 0);
                const isShort  = duration > 0 && duration <= 60;
                const fmtLen   = duration > 0 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : "—";
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid", gridTemplateColumns: "70px 1fr 70px 80px 60px 60px",
                      padding: "9px 10px", alignItems: "center",
                      borderBottom: i < filtered.length - 1 ? `1px solid ${T.line}` : "none",
                      fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.inkDim,
                    }}
                  >
                    <span style={{
                      padding: "2px 6px", borderRadius: 2,
                      background: isShort ? T.amberDim : T.redDim,
                      color:      isShort ? T.amber    : T.red,
                      fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textAlign: "center", width: 52,
                    }}>{isShort ? "SHORT" : "FULL"}</span>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ color: T.ink, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name || "—"}
                      </div>
                      <div style={{ color: T.inkFaint, fontSize: 10, marginTop: 1 }}>{r.channelName ?? ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>{fmtLen}</div>
                    <div style={{ textAlign: "right", color: T.ink }}>{views > 0 ? fmtViews(views) : "—"}</div>
                    <div style={{ textAlign: "right" }}>{vrs > 0 ? vrs.toFixed(0) : "—"}</div>
                    <div style={{ textAlign: "right", color: eng > 3 ? T.green : T.inkDim }}>
                      {eng > 0 ? eng.toFixed(1) + "%" : "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
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
