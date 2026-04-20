// Legacy `formatNumber` kept as an alias so the ~30 existing call sites don't
// break. New code should import directly from `./number-format` and pick
// explicitly between `fmtCompact` (rounded: "2.2K") and `fmtCount` (precise:
// "2,219"). See number-format.ts for usage rules.
import { fmtCompact } from "./number-format";
export { fmtCount, fmtCompact, fmtPercent, fmtPercentRatio, fmtReach } from "./number-format";

export function formatNumber(n: number): string {
  return fmtCompact(n);
}

/** Deprecated alias. Use fmtCompact or fmtCount explicitly. */
export function fmt(n: number): string { return fmtCompact(n); }

export function daysAgo(dateStr: string): number {
  return Math.max(
    1,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  );
}

export function velocity(views: number, days: number): number {
  return Math.round(views / Math.max(1, days));
}

export function engagement(
  likes: number,
  comments: number,
  views: number
): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPercent(n: number, decimals: number = 1): string {
  return `${n.toFixed(decimals)}%`;
}
