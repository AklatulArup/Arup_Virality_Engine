"use client";

// Playbooks — per-platform "what breaks out in our niche" mined live from the
// evidence pool (src/lib/playbooks.ts). Pure client compute over the pool the
// provider already holds; every number names its sample size. The Copy-brief
// button turns a platform's findings into a paste-ready creative brief for a
// partner creator.

import { useMemo, useState } from "react";
import type { Platform } from "@/lib/forecast";
import { minePlaybook, composeBrief, BREAKOUT_MIN_X } from "@/lib/playbooks";
import { usePool } from "@/hooks/use-pool";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube_short", "youtube", "x"];

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function CopyBriefButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-[11.5px]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? "Copied — paste it to the creator" : "Copy creative brief"}
    </Button>
  );
}

export function PlaybooksScreen() {
  const { entries, loading } = usePool();

  const playbooks = useMemo(
    () => PLATFORMS.map((p) => ({ platform: p, pb: minePlaybook(entries, p) })),
    [entries],
  );

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader
        title="Playbooks"
        description={`What actually breaks out in your niche — a breakout is any video doing ≥${BREAKOUT_MIN_X}× its creator's normal. Mined live from the evidence pool; sharpens as the pool grows.`}
      />

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        playbooks.map(({ platform, pb }) => {
          const meta = PLATFORM_META[platform];
          return (
            <Card key={platform} className="mt-4">
              <CardHeader className="pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-[14px] font-semibold">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                      {pb.thin
                        ? "still collecting"
                        : `${pb.breakouts} breakouts · ${pb.channels} creators · ${pb.videos} videos`}
                    </span>
                  </CardTitle>
                  {!pb.thin && pb.findings.length > 0 ? (
                    <CopyBriefButton text={composeBrief(pb, meta.label)} />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {pb.thin ? (
                  <div className="text-[12.5px] text-muted-foreground">
                    Not enough history yet — needs 30+ videos from creators with 5+ videos each. Import more{" "}
                    {meta.label} handles and this fills in.
                  </div>
                ) : (
                  <>
                    {/* Findings */}
                    {pb.findings.length > 0 ? (
                      <div className="divide-y divide-border/60">
                        {pb.findings.slice(0, 8).map((f) => (
                          <div key={`${f.dimension}-${f.trait}`} className="flex items-baseline gap-4 py-2">
                            <span className="w-[110px] shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              {f.dimension}
                            </span>
                            <span className="min-w-0 flex-1 text-[12.5px] text-foreground">{f.trait}</span>
                            <span className="shrink-0 font-mono text-[13px] font-medium" style={{ color: "#2ECC8A" }}>
                              ×{f.lift}
                            </span>
                            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                              in {Math.round(f.breakoutShare * 100)}% of breakouts vs {Math.round(f.baseShare * 100)}%
                              overall ({f.n})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-muted-foreground">
                        No trait stands out yet — breakouts here look like everything else so far. More data sharpens
                        this.
                      </div>
                    )}

                    {/* Examples */}
                    {pb.examples.length > 0 ? (
                      <div className="mt-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          Steal the format, not the video
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {pb.examples.map((e) => (
                            <div key={`${e.channel}-${e.title}`} className="flex items-baseline gap-3 text-[12px]">
                              <span className="shrink-0 font-mono font-medium" style={{ color: meta.color }}>
                                ×{e.multiple}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-foreground">{e.title || "(no title)"}</span>
                              <span className="hidden shrink-0 text-muted-foreground sm:block">
                                {e.channel} · {fmtCompact(e.views)} views
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <div className="mt-4 font-mono text-[10.5px] text-muted-foreground">
        Lift = how much more often breakouts carry a trait vs all videos from the same creators. Posting windows are
        UTC. Correlation, not causation — the brief is a starting format, the audition system still decides.
      </div>
    </div>
  );
}
