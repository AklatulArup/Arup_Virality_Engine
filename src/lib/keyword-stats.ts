// ═══════════════════════════════════════════════════════════════════════════
// KEYWORD BANK STATS — single source of truth for keyword counts
// ═══════════════════════════════════════════════════════════════════════════
//
// Previously the codebase had two different "keyword count" meanings:
//   • Sidebar / NewDashboard:  sum of ALL categories = 121
//   • Live Signal Feed:        categories.niche only = 87
//
// This module unifies both to the same value: `totalKeywords(bank)` sums
// every category because every saved keyword contributes equally to the
// pool's learning surface.

import type { KeywordBank } from "./types";

export function totalKeywords(bank: KeywordBank | null | undefined): number {
  if (!bank?.categories) return 0;
  const c = bank.categories;
  return (
    (Array.isArray(c.niche)       ? c.niche.length       : 0) +
    (Array.isArray(c.competitors) ? c.competitors.length : 0) +
    (Array.isArray(c.contentType) ? c.contentType.length : 0) +
    (Array.isArray(c.language)    ? c.language.length    : 0)
  );
}

export function keywordCategoryCounts(bank: KeywordBank | null | undefined): {
  niche: number; competitors: number; contentType: number; language: number; total: number;
} {
  const c = bank?.categories;
  const niche       = Array.isArray(c?.niche)       ? c!.niche.length       : 0;
  const competitors = Array.isArray(c?.competitors) ? c!.competitors.length : 0;
  const contentType = Array.isArray(c?.contentType) ? c!.contentType.length : 0;
  const language    = Array.isArray(c?.language)    ? c!.language.length    : 0;
  return { niche, competitors, contentType, language, total: niche + competitors + contentType + language };
}
