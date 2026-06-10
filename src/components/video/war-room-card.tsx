"use client";

// Z6 — AI review: war-room verdict (on demand, expandable), thumbnail check
// (YT/Shorts), hook check (TikTok/IG). Every card is explicit about being an
// AI opinion and whether it feeds the forecast.

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Forecast, Platform } from "@/lib/forecast";
import type { EnrichedVideo } from "@/lib/types";
import type { ThumbnailScore, HookScore } from "@/hooks/use-forecast-bundle";
import { PLATFORM_META } from "@/components/layout/platform-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Image as ImageIcon, Zap } from "lucide-react";

function buildVerdictPrompt(video: EnrichedVideo, f: Forecast, platform: Platform): string {
  const lines = [
    `Platform: ${PLATFORM_META[platform].label}`,
    `Title: ${video.title}`,
    `Creator: ${video.channel}`,
    `Current views: ${video.views.toLocaleString()} (${video.days} days old)`,
    f.baseline ? `Creator's typical views (median of ${f.baseline.postsUsed} posts): ${f.baseline.median.toLocaleString()}` : "No creator baseline available.",
    `Readiness score: ${f.scoreMultiplier.score.toFixed(0)}/100 — ${f.scoreMultiplier.rationale}`,
    `Forecast: expected ${f.lifetime.median.toLocaleString()} views (range ${f.lifetime.low.toLocaleString()}–${f.lifetime.high.toLocaleString()}), confidence ${f.confidence.level}.`,
    f.trajectory ? `Live pace: ${f.trajectory.outperformance.toFixed(2)}× expected at this age (${f.trajectory.verdict}).` : "Pre-publish — no live pace yet.",
    f.dataMissing.length > 0 ? `Missing private inputs: ${f.dataMissing.map((d) => d.label).join(", ")}.` : "All high-value inputs present.",
    `Engine interpretation: ${f.interpretation}`,
  ];
  return lines.join("\n");
}

export function WarRoomCard({ video, forecast: f, platform, thumbnailCTR, hookStrength }: {
  video: EnrichedVideo;
  forecast: Forecast;
  platform: Platform;
  thumbnailCTR: ThumbnailScore | null;
  hookStrength: HookScore | null;
}) {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerdict = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/claude-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildVerdictPrompt(video, f, platform), persona: "verdict", platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.text && data.text.length > 20) setText(data.text);
      else setError(data.error ?? "No response from the AI reviewer — likely out of daily quota. Try again later.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  };

  const showThumb = (platform === "youtube" || platform === "youtube_short") && thumbnailCTR;
  const showHook = (platform === "tiktok" || platform === "instagram") && hookStrength;

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {/* War-room verdict */}
      <Card className={!showThumb && !showHook ? "lg:col-span-3" : "lg:col-span-1"}>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
            <Sparkles className="size-4 text-[#9B87E8]" />
            War-room read
          </CardTitle>
        </CardHeader>
        <CardContent>
          {text ? (
            <>
              <p className="line-clamp-5 whitespace-pre-line text-[12.5px] leading-relaxed text-foreground">{text}</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-[11.5px] text-muted-foreground">
                    Read the full brief
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>War-room brief</DialogTitle>
                  </DialogHeader>
                  <p className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-foreground">
                    {text}
                  </p>
                  <p className="font-mono text-[10.5px] text-muted-foreground">AI opinion — does not change the forecast.</p>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">
                A second opinion: what the platform is doing with this video right now, what happens next, and the one
                move to make in the next 48 hours.
              </p>
              <Button size="sm" className="mt-3" onClick={runVerdict} disabled={running}>
                {running ? "Deliberating…" : "Run the war room"}
              </Button>
              {error ? <p className="mt-2 text-[11.5px] text-[#F0B35A]">{error}</p> : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Thumbnail check */}
      {showThumb ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
              <ImageIcon className="size-4 text-[#E4574E]" />
              Thumbnail check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="" className="h-14 w-24 shrink-0 rounded border border-border object-cover" />
              ) : null}
              <div>
                <div className="font-mono text-[18px] font-medium text-foreground">
                  ~{thumbnailCTR.estimatedCTR.toFixed(1)}%
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">est. click-through</span>
                </div>
                <div className="font-mono text-[10.5px] text-muted-foreground">
                  {thumbnailCTR.totalPoints}/{thumbnailCTR.maxPoints} packaging checks passed
                </div>
              </div>
            </div>
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{thumbnailCTR.rationale}</p>
            <p className="mt-2 font-mono text-[10px] text-[#9B87E8]">Feeds the CTR estimate above — marked AI estimate.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Hook check */}
      {showHook ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
              <Zap className="size-4 text-[#2ECFD9]" />
              Hook check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-[18px] font-medium text-foreground">
              {platform === "tiktok"
                ? `~${Math.round(hookStrength.estimatedCompletionPct)}%`
                : `~${Math.round(hookStrength.estimatedHold3sPct)}%`}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                {platform === "tiktok" ? "est. completion" : "est. 3-second hold"}
              </span>
            </div>
            <div className="font-mono text-[10.5px] text-muted-foreground">
              Opens with: {hookStrength.dominantFormula.replace(/-/g, " ")}
            </div>
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{hookStrength.rationale}</p>
            <p className="mt-2 font-mono text-[10px] text-[#9B87E8]">
              Feeds the {platform === "tiktok" ? "completion" : "hold"} estimate above — marked AI estimate.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
