"use client";

// Z8 — accountability: log this forecast as a commitment, see past logs for
// this video, and know when the engine will grade itself.

import type { Forecast, Platform, DateProjection } from "@/lib/forecast";
import type { EnrichedVideo } from "@/lib/types";
import { useForecastLog } from "@/hooks/use-forecast-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

// Maturity (days until the outcome cron re-checks actual views) — mirrors the
// collect-outcomes cron's MATURITY_DAYS table.
const MATURITY_DAYS: Record<Platform, number> = {
  x: 3,
  tiktok: 30,
  instagram: 35,
  youtube_short: 90,
  youtube: 90,
};

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function ForecastLogCard({
  video,
  forecast: f,
  platform,
  sourceUrl,
  targetDate,
  dateProjection,
}: {
  video: EnrichedVideo;
  forecast: Forecast;
  platform: Platform;
  sourceUrl: string;
  targetDate: string;
  dateProjection: DateProjection | null;
}) {
  const { entries, loading, saving, add, remove } = useForecastLog();
  const mine = entries.filter((e) => e.videoId === video.id);

  const maturityDate = video.publishedAt
    ? new Date(new Date(video.publishedAt).getTime() + MATURITY_DAYS[platform] * 86_400_000)
    : null;

  const logIt = async () => {
    const proj = dateProjection && !dateProjection.beforePublish ? dateProjection : null;
    const ok = await add({
      analyzedAt: new Date().toISOString(),
      targetDate,
      videoId: video.id,
      videoUrl: sourceUrl,
      videoTitle: video.title,
      platform,
      creatorHandle: video.channel,
      lowViews: proj ? proj.low : f.lifetime.low,
      expectedViews: proj ? proj.median : f.lifetime.median,
      highViews: proj ? proj.high : f.lifetime.high,
      currentViewsAtAnalysis: video.views,
    });
    if (ok) toast.success("Forecast logged — it will be graded against the real number.");
    else toast.error("Could not save the log entry.");
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between pb-0">
        <CardTitle className="text-[14px] font-semibold">On the record</CardTitle>
        <Button size="sm" variant="outline" onClick={logIt} disabled={saving || f.confidence.level === "insufficient"}>
          {saving ? "Saving…" : "Log this forecast"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-[12px] text-muted-foreground">
          Every forecast is stored automatically and graded once the video matures
          {maturityDate
            ? ` — we'll check the actual number around ${maturityDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
            : ""}
          . Logging it here additionally puts it on the team record.
        </p>

        {loading ? null : mine.length > 0 ? (
          <div className="mt-3 divide-y divide-border">
            {mine.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {new Date(e.recordedAt).toLocaleDateString()}
                </Badge>
                <span className="font-mono text-[12.5px] text-foreground">
                  {fmtCompact(e.lowViews)} – <span className="font-medium">{fmtCompact(e.expectedViews)}</span> –{" "}
                  {fmtCompact(e.highViews)}
                </span>
                <span className="text-[11.5px] text-muted-foreground">by {e.targetDate || "horizon"}</span>
                <button
                  type="button"
                  onClick={() => void remove(e.id)}
                  className="ml-auto text-muted-foreground/60 transition-colors hover:text-destructive"
                  aria-label="Delete log entry"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">No logged predictions for this video yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
