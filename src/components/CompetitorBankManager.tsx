"use client";

import { useState } from "react";
import CollapsibleSection from "./CollapsibleSection";

export interface Competitor {
  name: string;
  space: string;
  handles: {
    youtube?: string;
    instagram?: string;
    tiktok?: string;
    x?: string;
  };
}

interface CompetitorBankManagerProps {
  competitors: Competitor[];
  onChange: (competitors: Competitor[]) => void;
}

const PLATFORMS = ["youtube", "instagram", "tiktok", "x"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_LABELS: Record<Platform, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "#ef4444" },
  instagram: { label: "Instagram", color: "#ec4899" },
  tiktok: { label: "TikTok", color: "#06b6d4" },
  x: { label: "X / Twitter", color: "#94a3b8" },
};

const emptyForm = (): Competitor => ({
  name: "",
  space: "Prop firm",
  handles: {},
});

export default function CompetitorBankManager({
  competitors,
  onChange,
}: CompetitorBankManagerProps) {
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null); // name of competitor being edited
  const [form, setForm] = useState<Competitor>(emptyForm());
  const [showAdd, setShowAdd] = useState(false);

  function startAdd() {
    setForm(emptyForm());
    setEditTarget(null);
    setShowAdd(true);
  }

  function startEdit(c: Competitor) {
    setForm({ ...c, handles: { ...c.handles } });
    setEditTarget(c.name);
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm());
  }

  async function saveForm() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/competitor-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const isEdit = competitors.some(
          (c) => c.name.toLowerCase() === form.name.toLowerCase()
        );
        const updated = isEdit
          ? competitors.map((c) =>
              c.name.toLowerCase() === form.name.toLowerCase() ? form : c
            )
          : [...competitors, form];
        onChange(updated);
        cancelForm();
      }
    } catch {
      /* silent */
    }
    setBusy(false);
  }

  async function deleteCompetitor(name: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/competitor-bank", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        onChange(competitors.filter((c) => c.name !== name));
      }
    } catch {
      /* silent */
    }
    setBusy(false);
  }

  return (
    <CollapsibleSection
      title="Competitor Bank"
      subtitle={`${competitors.length} competitor${competitors.length !== 1 ? "s" : ""} tracked`}
      accentColor="#6366f1"
    >
      <div className="space-y-2">
        {/* Competitor rows */}
        {competitors.length === 0 ? (
          <div className="text-[10px] text-[#9E9C97] text-center py-4">
            No competitors tracked yet
          </div>
        ) : (
          <div className="space-y-1.5">
            {competitors.map((c) => (
              <div
                key={c.name}
                className="border border-border rounded px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[11px] font-mono font-bold"
                        style={{ color: "var(--color-foreground)" }}
                      >
                        {c.name}
                      </span>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(99,102,241,0.12)",
                          color: "#6366f1",
                          border: "1px solid rgba(99,102,241,0.25)",
                        }}
                      >
                        {c.space}
                      </span>
                    </div>
                    {/* Platform handle pills */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(Object.keys(c.handles) as Platform[])
                        .filter((p) => c.handles[p])
                        .map((p) => {
                          const { label, color } = PLATFORM_LABELS[p] || {
                            label: p,
                            color: "var(--color-text-[#9E9C97])",
                          };
                          return (
                            <span
                              key={p}
                              className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: `color-mix(in srgb, ${color} 8%, transparent)`,
                                color,
                                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                              }}
                            >
                              {label}: {c.handles[p]}
                            </span>
                          );
                        })}
                      {Object.values(c.handles).every((h) => !h) && (
                        <span
                          className="text-[8px] font-mono"
                          style={{ color: "var(--color-text-[#9E9C97])" }}
                        >
                          No handles set
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(c)}
                      disabled={busy}
                      className="text-[9px] font-mono px-2 py-1 rounded"
                      style={{
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-[#9E9C97])",
                      }}
                      title="Edit competitor"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCompetitor(c.name)}
                      disabled={busy}
                      className="text-[9px] font-mono px-2 py-1 rounded"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        color: "var(--color-vrs-rework)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        opacity: busy ? 0.5 : 1,
                      }}
                      title="Remove competitor"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit form */}
        {showAdd ? (
          <div
            className="border border-border rounded p-3 space-y-2.5 mt-1"
            style={{ background: "rgba(255,255,255,0.025)" }}
          >
            <div className="text-[9px] font-mono font-bold uppercase tracking-wider"
              style={{ color: "#6366f1" }}>
              {editTarget ? `Editing: ${editTarget}` : "Add Competitor"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-mono uppercase tracking-wider"
                  style={{ color: "var(--color-text-[#9E9C97])" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!!editTarget}
                  placeholder="e.g. FTMO"
                  className="w-full mt-1 bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
                  style={{
                    color: "var(--color-foreground)",
                    opacity: editTarget ? 0.6 : 1,
                  }}
                />
              </div>
              <div>
                <label className="text-[8px] font-mono uppercase tracking-wider"
                  style={{ color: "var(--color-text-[#9E9C97])" }}>
                  Space
                </label>
                <input
                  type="text"
                  value={form.space}
                  onChange={(e) => setForm({ ...form, space: e.target.value })}
                  placeholder="e.g. Prop firm"
                  className="w-full mt-1 bg-background border border-border rounded px-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-accent"
                  style={{ color: "var(--color-foreground)" }}
                />
              </div>
            </div>
            {/* Platform handles */}
            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider mb-1.5"
                style={{ color: "var(--color-text-[#9E9C97])" }}>
                Platform Handles
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {PLATFORMS.map((p) => {
                  const { label, color } = PLATFORM_LABELS[p];
                  return (
                    <div key={p} className="flex items-center gap-2">
                      <span
                        className="text-[8px] font-mono w-16 shrink-0"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <input
                        type="text"
                        value={form.handles[p] || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            handles: { ...form.handles, [p]: e.target.value.trim() || undefined },
                          })
                        }
                        placeholder={p === "youtube" ? "@handle" : "handle"}
                        className="flex-1 bg-background border border-border rounded px-2 py-1 text-[9px] font-mono focus:outline-none"
                        style={{
                          color: "var(--color-foreground)",
                          borderColor: form.handles[p]
                            ? `color-mix(in srgb, ${color} 40%, var(--color-border))`
                            : "var(--color-border)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Form actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveForm}
                disabled={busy || !form.name.trim()}
                className="text-[10px] font-mono px-3 py-1.5 rounded font-bold"
                style={{
                  background: !form.name.trim() ? "rgba(255,255,255,0.04)" : "#6366f1",
                  color: !form.name.trim() ? "var(--color-text-[#9E9C97])" : "#fff",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? "Saving..." : editTarget ? "Update" : "Add Competitor"}
              </button>
              <button
                onClick={cancelForm}
                disabled={busy}
                className="text-[10px] font-mono px-3 py-1.5 rounded"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-[#9E9C97])",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startAdd}
            className="w-full text-[9px] font-mono py-1.5 rounded border-dashed"
            style={{
              border: "1px dashed var(--color-border)",
              color: "var(--color-text-[#9E9C97])",
            }}
          >
            + Add competitor
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}
