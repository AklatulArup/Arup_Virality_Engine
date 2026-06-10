// Platform display metadata for the new UI. Mirrors the legacy
// design-tokens.ts PLATFORMS palette (which dies at cutover) — the new tree
// never imports legacy UI tokens.

import type { Platform } from "@/lib/forecast";
import { Badge } from "@/components/ui/badge";

export const PLATFORM_META: Record<Platform, { code: string; label: string; color: string; dim: string }> = {
  youtube:       { code: "YTL", label: "YouTube",       color: "#E4574E", dim: "rgba(228,87,78,0.14)" },
  youtube_short: { code: "YTS", label: "YouTube Short", color: "#D96AA5", dim: "rgba(217,106,165,0.14)" },
  tiktok:        { code: "TTK", label: "TikTok",        color: "#2ECFD9", dim: "rgba(46,207,217,0.14)" },
  instagram:     { code: "IGR", label: "Instagram",     color: "#9B87E8", dim: "rgba(155,135,232,0.14)" },
  x:             { code: "X",   label: "X",             color: "#9E9C97", dim: "rgba(158,156,151,0.14)" },
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-border font-mono text-[10px] tracking-wide"
      style={{ color: meta.color, background: meta.dim }}
    >
      {meta.label}
    </Badge>
  );
}
