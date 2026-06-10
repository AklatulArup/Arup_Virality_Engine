"use client";

import { useState, useMemo } from "react";
import CollapsibleSection from "./CollapsibleSection";

interface HashtagBank {
  version: number;
  lastUpdated: string;
  categories: {
    viral: string[];
    brand: string[];
    niche: string[];
    campaign: string[];
  };
}

interface HashtagBankManagerProps {
  bank: HashtagBank;
  onChange: (bank: HashtagBank) => void;
}

type CategoryKey = "viral" | "brand" | "niche" | "campaign";

const CATEGORY_LABELS: Record<CategoryKey, { label: string; color: string }> = {
  viral: { label: "Viral", color: "#f59e0b" },
  brand: { label: "Brand", color: "#60A5FA" },
  niche: { label: "Niche", color: "#6366f1" },
  campaign: { label: "Campaign", color: "var(--color-accent-blue)" },
};

export default function HashtagBankManager({
  bank,
  onChange,
}: HashtagBankManagerProps) {
  const [activeTab, setActiveTab] = useState<CategoryKey>("viral");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [addText, setAddText] = useState("");

  const items = bank.categories[activeTab] || [];
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((t) => t.toLowerCase().includes(q));
  }, [items, query]);

  function toggleSelect(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function selectAllVisible() {
    const allSel = filtered.every((t) => selected.has(t));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSel) filtered.forEach((t) => next.delete(t));
      else filtered.forEach((t) => next.add(t));
      return next;
    });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const toDelete = [...selected];
      const res = await fetch("/api/hashtag-bank", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [activeTab]: toDelete }),
      });
      if (res.ok) {
        onChange({
          ...bank,
          categories: {
            ...bank.categories,
            [activeTab]: items.filter((t) => !selected.has(t)),
          },
          lastUpdated: new Date().toISOString(),
        });
        setSelected(new Set());
      }
    } catch {
      /* silent */
    }
    setBusy(false);
  }

  async function addNew() {
    const tokens = addText
      .split(/[\n,]+/)
      .map((s) => {
        const t = s.trim();
        return t.startsWith("#") ? t.toLowerCase() : `#${t.toLowerCase()}`;
      })
      .filter((t) => t.length > 1);
    if (tokens.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hashtag-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [activeTab]: tokens }),
      });
      if (res.ok) {
        const merged = Array.from(new Set([...items, ...tokens]));
        onChange({
          ...bank,
          categories: { ...bank.categories, [activeTab]: merged },
          lastUpdated: new Date().toISOString(),
        });
        setAddText("");
      }
    } catch {
      /* silent */
    }
    setBusy(false);
  }

  const total = Object.values(bank.categories).reduce((s, a) => s + a.length, 0);
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((t) => selected.has(t));

  return (
    <CollapsibleSection
      title="Hashtag Bank"
      subtitle={`${total} hashtags across ${Object.values(bank.categories).filter((a) => a.length > 0).length} categories`}
      accentColor="#f59e0b"
    >
      <div className="space-y-2.5">
        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((cat) => {
            const { label, color } = CATEGORY_LABELS[cat];
            const count = bank.categories[cat]?.length || 0;
            const active = activeTab === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveTab(cat);
                  setSelected(new Set());
                  setQuery("");
                }}
                className="text-[9px] font-mono px-2 py-1 rounded transition-colors"
                style={{
                  background: active
                    ? `color-mix(in srgb, ${color} 12%, transparent)`
                    : "transparent",
                  color: active ? color : "var(--color-text-[#9E9C97])",
                  border: `1px solid ${active ? color : "var(--color-border)"}`,
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + bulk actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${CATEGORY_LABELS[activeTab].label.toLowerCase()} hashtags...`}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
              style={{ color: "var(--color-foreground)" }}
            />
          </div>
          <button
            onClick={selectAllVisible}
            disabled={filtered.length === 0}
            className="text-[8px] font-mono px-2 py-1 rounded"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text-[#9E9C97])",
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}
          >
            {allSelectedOnPage ? "Unselect all" : "Select all visible"}
          </button>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={busy}
              className="text-[9px] font-mono px-2 py-1 rounded font-bold"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "var(--color-vrs-rework)",
                border: "1px solid rgba(239,68,68,0.3)",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? "Removing..." : `Remove ${selected.size}`}
            </button>
          )}
        </div>

        {/* Pill list */}
        <div
          className="border border-border rounded p-2 max-h-[240px] overflow-y-auto"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          {filtered.length === 0 ? (
            <div className="text-[10px] text-[#9E9C97] text-center py-3">
              {items.length === 0
                ? `No ${CATEGORY_LABELS[activeTab].label.toLowerCase()} hashtags yet`
                : "No matches"}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {filtered.map((tag) => {
                const isSel = selected.has(tag);
                const color = CATEGORY_LABELS[activeTab].color;
                return (
                  <button
                    key={tag}
                    onClick={() => toggleSelect(tag)}
                    className="text-[9px] font-mono px-2 py-0.5 rounded transition-colors"
                    style={{
                      background: isSel
                        ? "rgba(239,68,68,0.15)"
                        : `color-mix(in srgb, ${color} 8%, transparent)`,
                      color: isSel ? "var(--color-vrs-rework)" : color,
                      border: `1px solid ${isSel ? "rgba(239,68,68,0.4)" : "transparent"}`,
                    }}
                    title={isSel ? "Click to unselect" : "Click to select for removal"}
                  >
                    {isSel && <span className="mr-0.5">✕</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNew(); }}
            placeholder="Add hashtags (comma separated, # optional)"
            disabled={busy}
            className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
            style={{ color: "var(--color-foreground)" }}
          />
          <button
            onClick={addNew}
            disabled={busy || !addText.trim()}
            className="text-[10px] font-mono px-3 py-1.5 rounded font-bold"
            style={{
              background: !addText.trim()
                ? "rgba(255,255,255,0.04)"
                : "#f59e0b",
              color: !addText.trim() ? "var(--color-text-[#9E9C97])" : "#000",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
