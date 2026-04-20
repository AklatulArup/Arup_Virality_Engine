// ═══════════════════════════════════════════════════════════════════════════
// NUMBER FORMATTING — single source of truth for how counts render on screen
// ═══════════════════════════════════════════════════════════════════════════
//
// RULES OF USE
// ------------
// 1. Precise counts (pool size, entry counts, creator counts, keyword counts):
//      → `fmtCount(n)` — full number with commas (e.g. "2,219")
//    Use wherever accuracy matters or the number sits next to a label.
//
// 2. Hero / dashboard headline tiles where exact digits don't matter:
//      → `fmtCompact(n)` — rounded with K/M/B (e.g. "2.2K", "357M")
//    Use ONLY for decorative hero tiles. Never mix with `fmtCount` on the
//    same value on the same screen — pick one per value.
//
// 3. Percentages:
//      → `fmtPercent(n, digits)` — 0-100 scalar → "3.9%". `fmtPercentRatio`
//        converts 0-1 ratios to %.
//
// 4. Big views / reach numbers (always compact, never exact):
//      → `fmtReach(n)` — "1.2M views" / "714K views" style.
//
// Every number displayed in the app should go through one of these. Inline
// `.toLocaleString()` and ad-hoc K/M shortening is what caused "2.2K" to
// sit next to "2,219" on the same screen.

export function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${trim((n / 1_000_000_000).toFixed(1))}B`;
  if (abs >= 1_000_000)     return `${trim((n / 1_000_000).toFixed(1))}M`;
  if (abs >= 10_000)        return `${trim((n / 1_000).toFixed(0))}K`;
  if (abs >= 1_000)         return `${trim((n / 1_000).toFixed(1))}K`;
  return `${Math.round(n)}`;
}

export function fmtPercent(pct: number, digits = 1): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(digits)}%`;
}

export function fmtPercentRatio(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtReach(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${fmtCompact(n)} views`;
}

// Drop trailing ".0" — "2.0K" reads worse than "2K".
function trim(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
