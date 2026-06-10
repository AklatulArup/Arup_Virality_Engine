"use client";

// useSkillScore — fetches the Phase-4 prediction contract for the current
// report subject. Re-scores (debounced) when creator analytics change, so
// adding a completion % flips gates from insufficient_evidence live.

import { useEffect, useState } from "react";
import type { ManualInputs, Platform, Forecast } from "@/lib/forecast";
import type { EnrichedVideo } from "@/lib/types";
import type { PredictionContract } from "@/lib/scoring/canon";

export function useSkillScore(params: {
  video: EnrichedVideo;
  platform: Platform;
  manualInputs: ManualInputs;
  aiEstimatedKeys: Set<keyof ManualInputs>;
  forecast: Forecast;
}) {
  const { video, platform, manualInputs, aiEstimatedKeys, forecast } = params;
  const [contract, setContract] = useState<PredictionContract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !video.id) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          contentId: video.id,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: (video as { shares?: number }).shares ?? null,
          saves: (video as { saves?: number }).saves ?? null,
          publishedAt: video.publishedAt ?? null,
          creatorFollowers: (video as unknown as { creatorFollowers?: number }).creatorFollowers ?? null,
          manualInputs,
          aiEstimatedKeys: Array.from(aiEstimatedKeys),
          region: (video as unknown as { region?: string }).region ?? null,
          baselineMedian: forecast.baseline?.median ?? null,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.ok && d.contract) setContract(d.contract as PredictionContract);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, platform, JSON.stringify(manualInputs), aiEstimatedKeys.size, forecast.baseline?.median]);

  return { contract, loading };
}
