"use client";

// useAnalyze — the per-platform scrape→enrich→persist pipeline behind every
// analyze surface. Thin stateful wrapper over src/hooks/pipeline/*, which is
// the legacy Dashboard.tsx analyze() transplanted branch-for-branch.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, KeywordBank } from "@/lib/types";
import { parseInput } from "@/lib/url-parser";
import { humanizeError } from "@/lib/humanize-errors";
import { usePool } from "@/hooks/use-pool";
import type { PipelineCtx } from "./pipeline/persist";
import { analyzeYouTubeVideo, analyzeYouTubeChannel } from "./pipeline/analyze-youtube";
import { analyzeTikTok } from "./pipeline/analyze-tiktok";
import { analyzeInstagram } from "./pipeline/analyze-instagram";
import { analyzeX } from "./pipeline/analyze-x";

export interface AnalyzeState {
  result: AnalysisResult | null;
  loading: boolean;
  status: string;
  error: string | null;
  lastUrl: string;
  run: (raw: string) => Promise<void>;
}

export function useAnalyze(): AnalyzeState {
  const { entries, write } = usePool();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState("");

  // Keyword bank — loaded once; expansions update it locally + persist.
  const [keywordBank, setKeywordBank] = useState<KeywordBank | null>(null);
  useEffect(() => {
    fetch("/api/keyword-bank")
      .then((r) => r.json())
      .then((bank: KeywordBank) => setKeywordBank(bank))
      .catch(() => {});
  }, []);

  // The pipeline reads pool/bank at run time, not closure-creation time.
  const entriesRef = useRef(entries);
  const bankRef = useRef(keywordBank);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    bankRef.current = keywordBank;
  }, [keywordBank]);

  const run = useCallback(
    async (raw: string) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setLastUrl(raw);

      const ctx: PipelineCtx = {
        poolWrite: write,
        poolEntries: entriesRef.current,
        keywordBank: bankRef.current,
        setKeywordBank,
        setStatus,
      };

      try {
        const parsed = parseInput(raw);

        if (parsed.type === "youtube-channel" && (parsed.handle || parsed.id)) {
          setResult(await analyzeYouTubeChannel(parsed, ctx));
        } else if (parsed.type === "youtube-video" || parsed.type === "youtube-short") {
          setResult(await analyzeYouTubeVideo(parsed, raw, ctx));
        } else if (parsed.type === "tiktok") {
          setResult(await analyzeTikTok(parsed, raw, ctx));
        } else if (parsed.type === "instagram") {
          setResult(await analyzeInstagram(parsed, raw, ctx));
        } else if (parsed.type === "x") {
          setResult(await analyzeX(parsed, raw, ctx));
        } else if (parsed.type === "unknown") {
          throw new Error("Could not detect input type. Paste a YouTube, TikTok, Instagram, or X URL / @handle.");
        } else {
          throw new Error(`${parsed.label} — paste a YouTube, TikTok, Instagram, or X URL.`);
        }
      } catch (e) {
        const h = humanizeError(e);
        setError(h.message);
        if (h.raw && h.raw !== h.message) console.error("[analyze]", h.raw);
        setStatus("");
      }

      setLoading(false);
    },
    [write],
  );

  return { result, loading, status, error, lastUrl, run };
}
