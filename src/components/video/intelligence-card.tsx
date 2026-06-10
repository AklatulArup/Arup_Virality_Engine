"use client";

// Z7 — Intelligence: the resurrected analysis libs, grouped by the question an
// RM would actually ask (Packaging / Timing / Competition / Audience), behind
// progressive disclosure. Every metric carries its "so what".

import type { VideoIntel } from "@/hooks/use-video-intel";
import type { Platform } from "@/lib/forecast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12px] text-muted-foreground">{k}</span>
      <span className="text-right">
        <span className="font-mono text-[12.5px] text-foreground">{v}</span>
        {sub ? <span className="ml-2 text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
    </div>
  );
}

function Bullets({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "warn" }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed" style={{ color: tone === "warn" ? "#F0B35A" : "#B5B2AB" }}>
      {items.slice(0, 4).map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function slotLabel(day: number, hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${DAY_NAMES[day] ?? day} ${h}${hour < 12 ? "am" : "pm"}`;
}

export function IntelligenceCard({ intel, platform }: { intel: VideoIntel; platform: Platform }) {
  const { nicheRanking, descSEO, engDecay, crossPromo, publishTime, tagCorrelation, uploadCadence, competitorGap } = intel;
  const isYouTube = platform === "youtube" || platform === "youtube_short";

  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">Intelligence</CardTitle>
        <p className="text-[11.5px] text-muted-foreground">Deeper context from the evidence pool — open what you need.</p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple">
          {/* ── Packaging ── */}
          <AccordionItem value="packaging">
            <AccordionTrigger className="text-[13px]">Packaging — does the wrapper sell the click?</AccordionTrigger>
            <AccordionContent>
              {descSEO ? (
                <div className="mb-3">
                  <Row k="Description quality" v={`${descSEO.overallScore}/100`} sub={`${descSEO.wordCount} words`} />
                  <Row
                    k="First two lines (what viewers see)"
                    v={descSEO.aboveFoldScore >= 60 ? "Working" : "Weak"}
                    sub={`${descSEO.aboveFoldScore}/100`}
                  />
                  <Bullets items={descSEO.issues} tone="warn" />
                  <Bullets items={descSEO.suggestions} />
                </div>
              ) : (
                <p className="text-[11.5px] text-muted-foreground">Description analysis needs the keyword bank — still loading.</p>
              )}
              {isYouTube && crossPromo ? (
                <div className="border-t border-border pt-2">
                  <Row
                    k="Ecosystem links (videos, playlists, socials)"
                    v={`${crossPromo.ecosystemScore}/100`}
                    sub={`${crossPromo.videoLinks + crossPromo.playlistLinks} internal · ${crossPromo.socialLinks.length} social`}
                  />
                  <Bullets items={crossPromo.suggestions} />
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          {/* ── Timing ── */}
          <AccordionItem value="timing">
            <AccordionTrigger className="text-[13px]">Timing — when does this niche actually get watched?</AccordionTrigger>
            <AccordionContent>
              {publishTime && publishTime.bestSlots.length > 0 ? (
                <div className="mb-3">
                  <Row
                    k="Best publish window (across the pool)"
                    v={slotLabel(publishTime.bestSlots[0].day, publishTime.bestSlots[0].hour)}
                    sub={`avg ${fmtCompact(publishTime.bestSlots[0].avgViews)} views`}
                  />
                  {publishTime.bestSlots[1] ? (
                    <Row
                      k="Runner-up"
                      v={slotLabel(publishTime.bestSlots[1].day, publishTime.bestSlots[1].hour)}
                      sub={`avg ${fmtCompact(publishTime.bestSlots[1].avgViews)} views`}
                    />
                  ) : null}
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    Ranked by average views across {publishTime.totalVideosAnalyzed.toLocaleString()} pool videos.
                  </p>
                </div>
              ) : (
                <p className="text-[11.5px] text-muted-foreground">Needs more pool history to rank publish windows.</p>
              )}
              {uploadCadence && uploadCadence.entries.length > 0 ? (
                <div className="border-t border-border pt-2">
                  <Row
                    k="Cadence that wins in this pool"
                    v={uploadCadence.bestCadence}
                    sub={`avg ${fmtCompact(uploadCadence.bestCadenceAvgViews)} views`}
                  />
                  <Row
                    k="Consistency ↔ views correlation"
                    v={uploadCadence.correlation.toFixed(2)}
                    sub="steady schedules get rewarded"
                  />
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          {/* ── Competition ── */}
          <AccordionItem value="competition">
            <AccordionTrigger className="text-[13px]">Competition — where does this sit in the niche?</AccordionTrigger>
            <AccordionContent>
              {nicheRanking ? (
                <div className="mb-3">
                  <Row
                    k="Views rank in niche"
                    v={`#${nicheRanking.rankByViews} of ${nicheRanking.totalNicheVideos}`}
                    sub={`top ${Math.max(1, 100 - nicheRanking.percentileViews).toFixed(0)}%`}
                  />
                  <Row k="Readiness rank" v={`#${nicheRanking.rankByVRS} of ${nicheRanking.totalNicheVideos}`} />
                </div>
              ) : (
                <p className="text-[11.5px] text-muted-foreground">Niche ranking needs pool history + keyword bank.</p>
              )}
              {competitorGap && competitorGap.opportunities.length > 0 ? (
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-[12px] text-foreground">Open opportunities</p>
                  <Bullets items={competitorGap.opportunities} />
                  {competitorGap.missingFormats.length > 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Formats competitors use that we have none of: {competitorGap.missingFormats.slice(0, 4).join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {tagCorrelation && tagCorrelation.topTags.length > 0 ? (
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-[12px] text-foreground">Tags that travel</p>
                  <p className="font-mono text-[11.5px] text-muted-foreground">
                    {tagCorrelation.topTags.slice(0, 5).map((t) => `${t.tag} (${fmtCompact(t.avgViews)})`).join(" · ")}
                  </p>
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          {/* ── Audience ── */}
          <AccordionItem value="audience">
            <AccordionTrigger className="text-[13px]">Audience — is this still earning attention?</AccordionTrigger>
            <AccordionContent>
              {engDecay ? (
                <div>
                  <Row k="Life stage" v={engDecay.phaseLabel} sub={engDecay.phaseBasis} />
                  <Row k="Earning per day right now" v={`${fmtCompact(engDecay.dailyVelocity)} views`} />
                  {engDecay.isEvergreen ? (
                    <p className="mt-1 text-[11.5px] text-[#2ECC8A]">
                      Evergreen — still compounding well past its launch window.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
