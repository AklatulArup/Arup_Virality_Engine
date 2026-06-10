"use client";

import { useState, useRef } from "react";
import type { KeywordBank } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";

interface ReferencePoolBuilderProps {
  bank: KeywordBank;
  onComplete: (added: number) => void;
  onBatchSaved?: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
];

type ParamCategory = "competitors" | "keywords" | "hashtags";

export default function ReferencePoolBuilder({ bank, onComplete, onBatchSaved }: ReferencePoolBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ searched: number; uniqueVideos: number; added: number; skipped: number } | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["en", "es", "ar", "pt", "hi"]);

  // Search parameter state — user can add/remove tags per category
  const [extraCompetitors, setExtraCompetitors] = useState<string[]>([]);
  const [extraKeywords, setExtraKeywords] = useState<string[]>([]);
  const [extraHashtags, setExtraHashtags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeCategory, setActiveCategory] = useState<ParamCategory>("competitors");
  const inputRef = useRef<HTMLInputElement>(null);

  // All competitors (from bank + user-added)
  const allCompetitors = [...new Set([...bank.categories.competitors, ...extraCompetitors])];
  const allKeywords = [...new Set([...bank.categories.niche.slice(0, 10), ...extraKeywords])];
  const allHashtags = extraHashtags;

  // Build search queries from all parameters
  const buildQueries = (): string[] => {
    const queries = new Set<string>();

    // Competitor-based queries
    for (const comp of allCompetitors.slice(0, 15)) {
      queries.add(`${comp} review`);
      queries.add(`${comp} payout`);
      queries.add(`${comp} challenge`);
    }

    // Keyword-based queries
    for (const kw of allKeywords.slice(0, 15)) {
      queries.add(kw);
    }

    // Hashtag-based queries (YouTube searches hashtags too)
    for (const ht of allHashtags) {
      queries.add(ht.startsWith("#") ? ht : `#${ht}`);
    }

    // Fixed high-value queries
    queries.add("prop firm challenge");
    queries.add("funded trader");
    queries.add("forex prop firm");
    queries.add("prop firm review");
    queries.add("prop firm payout proof");
    queries.add("how to pass prop firm");
    queries.add("best prop firm 2026");
    queries.add("prop firm strategy");
    queries.add("prop firm scam or legit");

    return [...queries];
  };

  const addParam = () => {
    const val = inputValue.trim();
    if (!val) return;

    if (activeCategory === "competitors") {
      if (!extraCompetitors.includes(val.toLowerCase())) {
        setExtraCompetitors((prev) => [...prev, val]);
      }
    } else if (activeCategory === "keywords") {
      if (!extraKeywords.includes(val.toLowerCase())) {
        setExtraKeywords((prev) => [...prev, val]);
      }
    } else {
      const cleaned = val.startsWith("#") ? val : `#${val}`;
      if (!extraHashtags.includes(cleaned.toLowerCase())) {
        setExtraHashtags((prev) => [...prev, cleaned]);
      }
    }
    setInputValue("");
    inputRef.current?.focus();
  };

  const removeParam = (category: ParamCategory, value: string) => {
    if (category === "competitors") setExtraCompetitors((prev) => prev.filter((v) => v !== value));
    else if (category === "keywords") setExtraKeywords((prev) => prev.filter((v) => v !== value));
    else setExtraHashtags((prev) => prev.filter((v) => v !== value));
  };

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const runScrape = async () => {
    setLoading(true);
    setResult(null);

    const allQueries = buildQueries();
    setStatus(`Searching ${allQueries.length} queries in ${selectedLangs.length} languages...`);

    try {
      const searchRes = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: allQueries,
          languages: selectedLangs,
          maxPerQuery: 50,
        }),
      });

      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error || "Search failed");
      }

      const searchData = await searchRes.json();
      setStatus(`Found ${searchData.uniqueVideos} unique videos. Adding to reference pool...`);

      let added = 0;
      let updated = 0;
      const entries = searchData.entries || [];
      const batchSize = 50;

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const storeRes = await fetch("/api/reference-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        if (storeRes.ok) {
          const storeData = await storeRes.json();
          added += storeData.added || 0;
          updated += storeData.updated || 0;
          onBatchSaved?.();
        }
        setStatus(`Adding... ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
      }

      const quotaWarning = searchData.quotaExhausted ? " (stopped early — API quota hit)" : "";
      setResult({ searched: searchData.searched, uniqueVideos: searchData.uniqueVideos, added, skipped: updated });
      setStatus(quotaWarning);
      onComplete(added);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }

    setLoading(false);
  };

  const queries = buildQueries();
  const quotaEstimate = queries.length * selectedLangs.length * 100 + 100;

  const categoryColors: Record<ParamCategory, string> = {
    competitors: "var(--color-mode-e)",
    keywords: "#60A5FA",
    hashtags: "var(--color-accent-blue)",
  };

  return (
    <CollapsibleSection
      title="Reference Pool Builder"
      subtitle={`${queries.length} queries \u00b7 ${selectedLangs.length} languages \u00b7 ${allCompetitors.length} competitors`}
      accentColor="#60A5FA"
    >
      <div className="space-y-3">
        {/* ── Search Parameter Bar ── */}
        <div className="rounded-lg border border-border p-2.5" style={{ background: "rgba(0,229,160,0.02)" }}>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1.5">SEARCH PARAMETERS</div>

          {/* Category tabs */}
          <div className="flex gap-1 mb-2">
            {(["competitors", "keywords", "hashtags"] as ParamCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-[8px] font-mono px-2 py-0.5 rounded transition-colors"
                style={{
                  background: activeCategory === cat ? `color-mix(in srgb, ${categoryColors[cat]} 15%, transparent)` : "transparent",
                  color: activeCategory === cat ? categoryColors[cat] : "var(--color-text-[#9E9C97])",
                  border: `1px solid ${activeCategory === cat ? categoryColors[cat] : "var(--color-border)"}`,
                }}
              >
                {cat === "competitors" ? `Competitors (${allCompetitors.length})` :
                 cat === "keywords" ? `Keywords (${allKeywords.length})` :
                 `Hashtags (${allHashtags.length})`}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex gap-1.5 mb-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParam(); } }}
              className="flex-1 text-[10px] font-mono bg-background border border-border rounded px-2 py-1.5"
              style={{ color: "var(--color-foreground)" }}
              placeholder={
                activeCategory === "competitors" ? "Add a competitor name (e.g., True Forex Funds)" :
                activeCategory === "keywords" ? "Add a search keyword (e.g., gold scalping strategy)" :
                "Add a hashtag (e.g., #propfirm)"
              }
            />
            <button
              onClick={addParam}
              className="text-[9px] font-mono font-bold px-3 py-1 rounded shrink-0"
              style={{ background: categoryColors[activeCategory], color: "black" }}
            >
              Add
            </button>
          </div>

          {/* Tags display — show all three categories */}
          <div className="space-y-1.5">
            {/* Competitors */}
            {allCompetitors.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[7px] font-mono text-[#9E9C97] w-14 shrink-0">FIRMS</span>
                {allCompetitors.map((comp) => {
                  const isFromBank = bank.categories.competitors.includes(comp);
                  return (
                    <span
                      key={comp}
                      className="text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{
                        background: `color-mix(in srgb, ${categoryColors.competitors} 10%, transparent)`,
                        color: categoryColors.competitors,
                        border: `1px solid color-mix(in srgb, ${categoryColors.competitors} 20%, transparent)`,
                      }}
                    >
                      {comp}
                      {!isFromBank && (
                        <button
                          onClick={() => removeParam("competitors", comp)}
                          className="hover:opacity-70 ml-0.5"
                          style={{ color: categoryColors.competitors }}
                        >
                          {"\u00d7"}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* User-added keywords */}
            {extraKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[7px] font-mono text-[#9E9C97] w-14 shrink-0">KW</span>
                {extraKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                      background: `color-mix(in srgb, ${categoryColors.keywords} 10%, transparent)`,
                      color: categoryColors.keywords,
                      border: `1px solid color-mix(in srgb, ${categoryColors.keywords} 20%, transparent)`,
                    }}
                  >
                    {kw}
                    <button onClick={() => removeParam("keywords", kw)} className="hover:opacity-70 ml-0.5">{"\u00d7"}</button>
                  </span>
                ))}
              </div>
            )}

            {/* Hashtags */}
            {allHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[7px] font-mono text-[#9E9C97] w-14 shrink-0">TAGS</span>
                {allHashtags.map((ht) => (
                  <span
                    key={ht}
                    className="text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                      background: `color-mix(in srgb, ${categoryColors.hashtags} 10%, transparent)`,
                      color: categoryColors.hashtags,
                      border: `1px solid color-mix(in srgb, ${categoryColors.hashtags} 20%, transparent)`,
                    }}
                  >
                    {ht}
                    <button onClick={() => removeParam("hashtags", ht)} className="hover:opacity-70 ml-0.5">{"\u00d7"}</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Language selector */}
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">LANGUAGES ({selectedLangs.length} selected)</div>
          <div className="flex flex-wrap gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => toggleLang(lang.code)}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                style={{
                  borderColor: selectedLangs.includes(lang.code) ? "#60A5FA" : "var(--color-border)",
                  background: selectedLangs.includes(lang.code) ? "rgba(0,229,160,0.08)" : "transparent",
                  color: selectedLangs.includes(lang.code) ? "#60A5FA" : "var(--color-text-[#9E9C97])",
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generated queries preview */}
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-1">
            GENERATED QUERIES ({queries.length})
          </div>
          <div className="text-[7px] text-subtle bg-background rounded p-2 max-h-16 overflow-y-auto font-mono leading-relaxed">
            {queries.join(" | ")}
          </div>
        </div>

        {/* Quota + Run */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[8px] text-[#9E9C97]">
            ~{quotaEstimate.toLocaleString()} API units / 10,000 daily
          </div>
          <button
            onClick={runScrape}
            disabled={loading || selectedLangs.length === 0}
            className="text-[10px] font-mono font-bold px-6 py-2 rounded transition-colors"
            style={{
              background: loading ? "var(--color-surface)" : "#60A5FA",
              color: loading ? "var(--color-text-[#9E9C97])" : "black",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? status || "Searching..." : "Build Reference Pool"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="text-[9px] font-mono rounded p-2" style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)" }}>
            <div style={{ color: "var(--color-vrs-excellent)" }}>{"\u2713"} Scraped {result.searched} search queries</div>
            <div style={{ color: "var(--color-vrs-excellent)" }}>{"\u2713"} Found {result.uniqueVideos} unique videos</div>
            <div style={{ color: "var(--color-vrs-excellent)" }}>{"\u2713"} Added {result.added} to reference pool</div>
            {result.skipped > 0 && <div className="text-[#9E9C97]">{result.skipped} existing entries updated</div>}
            {status && <div className="text-[#9E9C97] mt-0.5">{status}</div>}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
