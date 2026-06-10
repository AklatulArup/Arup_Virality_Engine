"use client";

// Video Report screen. P2 state: runs the full analyze pipeline + forecast
// bundle and renders a structured debug view (the parity harness). The real
// Z0–Z8 report UI replaces the debug body in P3 — the data wiring here is
// already final.

import { useEffect, useMemo } from "react";
import { useAnalyze } from "@/hooks/use-analyze";
import { useForecastBundle } from "@/hooks/use-forecast-bundle";
import { xPostToEnrichedVideo } from "@/lib/x-adapter";
import type { AnalysisResult, EnrichedVideo, VideoData, XPostData } from "@/lib/types";
import type { Platform } from "@/lib/forecast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

// Resolve the forecast subject (video + history + platform) from any analyze
// result shape — same promotion rules the legacy Dashboard used when mounting
// ForecastPanel.
function resolveSubject(result: AnalysisResult): { video: EnrichedVideo; history: VideoData[]; platform: Platform } | null {
  if (result.type === "video") {
    const platform = (result.video.platform ?? "youtube") as Platform;
    const history = result.recentVideos.filter((v) => v.id !== result.video.id);
    return { video: result.video, history, platform };
  }
  if (result.type === "tiktok-batch") {
    const top = result.topPerformers[0] ?? result.videos[0];
    if (!top) return null;
    const platform = (top.platform ?? "tiktok") as Platform;
    const history = result.videos.filter((v) => v.id !== top.id);
    return { video: top, history, platform };
  }
  // x-batch isn't a typed AnalysisResult member — the legacy pipeline casts it
  // into the union (preserved for parity), so detect it structurally.
  const loose = result as unknown as { type: string; posts?: XPostData[] };
  if (loose.type === "x-batch") {
    const posts = loose.posts;
    if (!posts?.length) return null;
    const video = xPostToEnrichedVideo(posts[0], posts);
    const history = posts.slice(1).map((p) => xPostToEnrichedVideo(p, posts));
    return { video, history, platform: "x" };
  }
  return null;
}

export function VideoAnalyzeScreen({ url }: { url: string }) {
  const { result, loading, status, error, run } = useAnalyze();

  useEffect(() => {
    void run(url);
  }, [run, url]);

  const subject = useMemo(() => (result ? resolveSubject(result) : null), [result]);

  return (
    <div>
      <PageHeader title="Video Report" description={url} />

      {loading ? (
        <div className="mt-6 space-y-3">
          <div className="font-mono text-[12px] text-muted-foreground">{status || "Working…"}</div>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <TriangleAlert className="size-4" />
          <AlertTitle>Could not analyze this link</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && result && subject ? (
        <ForecastDebug video={subject.video} history={subject.history} platform={subject.platform} />
      ) : null}

      {!loading && !error && result && !subject ? (
        <Card className="mt-6">
          <CardContent className="py-6 text-[13px] text-muted-foreground">
            Channel analysis complete — {result.type === "channel" ? result.health.videos.length : 0} videos profiled.
            The creator surface for this lands in the next phase.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// P2 parity harness body — replaced by the real Z0–Z8 zones in P3.
function ForecastDebug({ video, history, platform }: { video: EnrichedVideo; history: VideoData[]; platform: Platform }) {
  const bundle = useForecastBundle(video, history, platform);
  const f = bundle.result;

  const debug = {
    video: { id: video.id, title: video.title, channel: video.channel, views: video.views, platform },
    readiness: f.scoreMultiplier.score,
    lifetime: f.lifetime,
    d1: f.d1,
    d7: f.d7,
    d30: f.d30,
    horizonDays: f.horizonDays,
    confidence: f.confidence,
    baseline: f.baseline,
    trajectory: f.trajectory,
    lifecycleTier: f.lifecycleTier,
    signals: {
      seasonality: bundle.seasonality.multiplier,
      niche: { label: bundle.niche.niche, multiplier: bundle.nicheAdj.multiplier },
      reputation: bundle.reputation.multiplier,
      crossPlatform: bundle.crossPlatformRep.multiplier,
      sentiment: bundle.sentimentScore ?? null,
      aiEstimatedKeys: Array.from(bundle.aiEstimatedKeys),
      manualInputs: bundle.manualInputs,
      velocitySamples: bundle.velocitySamples.length,
      conformalLoaded: !!bundle.conformalTable,
      decayLoaded: !!bundle.decayTable,
      tuningFailed: bundle.configOverridesFailed,
    },
    dataUsed: f.dataUsed.map((d) => d.field),
    dataEstimated: f.dataEstimated.map((d) => d.field),
    dataMissing: f.dataMissing.map((d) => d.field),
    notes: f.notes,
    interpretation: f.interpretation,
  };

  return (
    <Card className="mt-6">
      <CardContent className="py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          P2 parity harness — forecast bundle output
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
