"use client";

// Video Report screen — the full Z0–Z8 surface on the extracted data layer.
// Batch analyses (TikTok/IG profile scrapes, X timelines) render a subject
// table; clicking a row re-renders the report for that video.

import { useEffect, useMemo, useState } from "react";
import { useAnalyze } from "@/hooks/use-analyze";
import { useForecastBundle } from "@/hooks/use-forecast-bundle";
import { useVideoIntel } from "@/hooks/use-video-intel";
import { usePool } from "@/hooks/use-pool";
import { xPostToEnrichedVideo } from "@/lib/x-adapter";
import type { AnalysisResult, ChannelData, EnrichedVideo, VideoData, XPostData } from "@/lib/types";
import type { Platform } from "@/lib/forecast";
import { PageHeader } from "@/components/layout/page-header";
import { useSkillScore } from "@/hooks/use-skill-score";
import { AlgorithmReadCard } from "./algorithm-read-card";
import { IdentityBar } from "./identity-bar";
import { VerdictHero } from "./verdict-hero";
import { KpiRow } from "./kpi-row";
import { TrajectoryCard } from "./trajectory-card";
import { YourDataCard } from "./your-data-card";
import { SignalsCard } from "./signals-card";
import { WarRoomCard } from "./war-room-card";
import { IntelligenceCard } from "./intelligence-card";
import { ForecastLogCard } from "./forecast-log-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Subject {
  video: EnrichedVideo;
  history: VideoData[];
  channel: ChannelData | null;
  recentVideos: EnrichedVideo[];
  platform: Platform;
  batch: EnrichedVideo[] | null;
}

function resolveSubject(result: AnalysisResult, selectedId: string | null): Subject | null {
  if (result.type === "video") {
    const platform = (result.video.platform ?? "youtube") as Platform;
    return {
      video: result.video,
      history: result.recentVideos.filter((v) => v.id !== result.video.id),
      channel: result.channel,
      recentVideos: result.recentVideos,
      platform,
      batch: null,
    };
  }
  if (result.type === "tiktok-batch") {
    const pick = (selectedId && result.videos.find((v) => v.id === selectedId)) || result.topPerformers[0] || result.videos[0];
    if (!pick) return null;
    const platform = (pick.platform ?? "tiktok") as Platform;
    return {
      video: pick,
      history: result.videos.filter((v) => v.id !== pick.id),
      channel: null,
      recentVideos: result.videos,
      platform,
      batch: result.videos,
    };
  }
  const loose = result as unknown as { type: string; posts?: XPostData[] };
  if (loose.type === "x-batch" && loose.posts?.length) {
    const posts = loose.posts;
    const enriched = posts.map((p) => xPostToEnrichedVideo(p, posts));
    const pick = (selectedId && enriched.find((v) => v.id === selectedId)) || enriched[0];
    return {
      video: pick,
      history: enriched.filter((v) => v.id !== pick.id),
      channel: null,
      recentVideos: enriched,
      platform: "x",
      batch: enriched,
    };
  }
  return null;
}

export function VideoAnalyzeScreen({ url }: { url: string }) {
  const { result, loading, status, error, run } = useAnalyze();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void run(url);
  }, [run, url]);

  const subject = useMemo(() => (result ? resolveSubject(result, selectedId) : null), [result, selectedId]);

  return (
    <div>
      {loading ? (
        <>
          <PageHeader title="Video Report" description={url} />
          <div className="mt-6 space-y-3">
            <div className="font-mono text-[12px] text-muted-foreground">{status || "Working…"}</div>
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </>
      ) : null}

      {error ? (
        <>
          <PageHeader title="Video Report" description={url} />
          <Alert variant="destructive" className="mt-6">
            <TriangleAlert className="size-4" />
            <AlertTitle>Could not analyze this link</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </>
      ) : null}

      {!loading && !error && result && subject ? (
        <FullReport key={subject.video.id} subject={subject} sourceUrl={url} onReanalyze={() => void run(url)} onPick={setSelectedId} />
      ) : null}

      {!loading && !error && result && !subject && result.type === "channel" ? (
        <>
          <PageHeader title="Channel analyzed" description={result.health.channel.name} />
          <Card className="mt-6">
            <CardContent className="py-6 text-[13px] text-muted-foreground">
              {result.health.videos.length} videos profiled and added to the evidence pool. The full partner view lives
              on the{" "}
              <Link
                href={`/creators/youtube/${encodeURIComponent(result.health.channel.id)}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                creator report card →
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function FullReport({
  subject,
  sourceUrl,
  onReanalyze,
  onPick,
}: {
  subject: Subject;
  sourceUrl: string;
  onReanalyze: () => void;
  onPick: (id: string) => void;
}) {
  const { video, history, platform, batch } = subject;
  const bundle = useForecastBundle(video, history, platform);
  const { entries: poolEntries } = usePool();
  const intel = useVideoIntel({
    video,
    recentVideos: subject.recentVideos,
    channel: subject.channel,
    poolEntries,
    platform,
  });
  const f = bundle.result;
  const skill = useSkillScore({
    video,
    platform,
    manualInputs: bundle.manualInputs,
    aiEstimatedKeys: bundle.aiEstimatedKeys,
    forecast: f,
  });

  return (
    <div>
      <IdentityBar video={video} platform={platform} sourceUrl={sourceUrl} onReanalyze={onReanalyze} />
      <VerdictHero forecast={f} platform={platform} />
      <KpiRow forecast={f} />
      {f.confidence.level !== "insufficient" ? (
        <TrajectoryCard
          forecast={f}
          platform={platform}
          video={video}
          velocitySamples={bundle.velocitySamples}
          decayTable={bundle.decayTable}
          targetDate={bundle.targetDate}
          setTargetDate={bundle.setTargetDate}
          dateProjection={bundle.dateProjection}
        />
      ) : (
        <Alert className="mt-4 border-[#F0B35A]/30">
          <TriangleAlert className="size-4 text-[#F0B35A]" />
          <AlertTitle className="text-[13px]">Not enough history to forecast views</AlertTitle>
          <AlertDescription className="text-[12px]">
            {f.interpretation} If you know this creator&apos;s typical views, add it under &ldquo;Type it in&rdquo; below
            — the forecast unlocks immediately.
          </AlertDescription>
        </Alert>
      )}
      <YourDataCard
        forecast={f}
        platform={platform}
        manualInputs={bundle.manualInputs}
        updateInput={bundle.updateInput}
        aiEstimatedKeys={bundle.aiEstimatedKeys}
        ocrStatus={bundle.ocrStatus}
        csvStatus={bundle.csvStatus}
        ingestImage={bundle.ingestImage}
        ingestCsv={bundle.ingestCsv}
        setPasteCaptureEnabled={bundle.setPasteCaptureEnabled}
      />
      <SignalsCard forecast={f} bundle={bundle} platform={platform} />
      <AlgorithmReadCard contract={skill.contract} loading={skill.loading} />
      <WarRoomCard video={video} forecast={f} platform={platform} thumbnailCTR={bundle.thumbnailCTR} hookStrength={bundle.hookStrength} />
      <IntelligenceCard intel={intel} platform={platform} />
      <ForecastLogCard
        video={video}
        forecast={f}
        platform={platform}
        sourceUrl={sourceUrl}
        targetDate={bundle.targetDate}
        dateProjection={bundle.dateProjection}
      />

      {batch && batch.length > 1 ? (
        <Card className="mt-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-[14px] font-semibold">Everything we pulled ({batch.length})</CardTitle>
            <p className="text-[11.5px] text-muted-foreground">Click a row to run the report on that one instead.</p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {batch.slice(0, 15).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onPick(v.id)}
                  className={cn(
                    "flex w-full items-baseline gap-3 py-2 text-left transition-colors hover:bg-accent/40",
                    v.id === video.id && "bg-accent/30",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{v.title}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{v.views.toLocaleString()} views</span>
                  <span className="w-14 text-right font-mono text-[12px] text-muted-foreground">
                    {v.vrs.estimatedFullScore.toFixed(0)}/100
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
