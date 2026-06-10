"use client";

// useVideoIntel — the nine resurrected intelligence libs (computed in the
// legacy Dashboard but never rendered) plus adjacent-videos and niche ranking.
// Pure useMemo computes over data already in hand; the only fetch is the
// keyword bank (shared via fetchOnce).

import { useEffect, useMemo, useState } from "react";
import type { ChannelData, EnrichedVideo, KeywordBank, ReferenceEntry } from "@/lib/types";
import type { Platform } from "@/lib/forecast";
import { findAdjacentVideos } from "@/lib/adjacent-videos";
import { computeNicheRanking } from "@/lib/niche-ranking";
import { computeLanguageCPA } from "@/lib/language-detect";
import { analyzeDescriptionSEO } from "@/lib/description-seo";
import { computeEngagementDecay } from "@/lib/engagement-decay";
import { detectCrossPromotion } from "@/lib/cross-promotion";
import { computePublishTimeHeatmap } from "@/lib/publish-time";
import { computeTagCorrelation } from "@/lib/tag-correlation";
import { computeUploadCadence } from "@/lib/upload-cadence";
import { computeCompetitorGapMatrix } from "@/lib/competitor-gap";
import { fetchOnce } from "@/hooks/fetch-once";

export function useVideoIntel(params: {
  video: EnrichedVideo;
  recentVideos: EnrichedVideo[];
  channel: ChannelData | null;
  poolEntries: ReferenceEntry[];
  platform: Platform;
}) {
  const { video, recentVideos, channel, poolEntries } = params;

  const [keywordBank, setKeywordBank] = useState<KeywordBank | null>(null);
  useEffect(() => {
    fetchOnce("keyword-bank", async () => {
      const r = await fetch("/api/keyword-bank");
      return r.ok ? r.json() : null;
    })
      .then((bank) => {
        if (bank) setKeywordBank(bank as KeywordBank);
      })
      .catch(() => {});
  }, []);

  const adjacent = useMemo(
    () => (recentVideos.length > 1 ? findAdjacentVideos(video, recentVideos) : null),
    [video, recentVideos],
  );

  const nicheRanking = useMemo(
    () =>
      keywordBank && poolEntries.length > 0
        ? computeNicheRanking(
            video.title,
            video.views,
            video.vrs.estimatedFullScore,
            video.engagement,
            video.channel,
            poolEntries,
            keywordBank,
          )
        : null,
    [video, poolEntries, keywordBank],
  );

  const languageCPA = useMemo(
    () => (recentVideos.length >= 3 ? computeLanguageCPA(recentVideos) : null),
    [recentVideos],
  );

  const descSEO = useMemo(
    () => (keywordBank ? analyzeDescriptionSEO(video.description, video.title, keywordBank) : null),
    [video.description, video.title, keywordBank],
  );

  const engDecay = useMemo(() => computeEngagementDecay(video), [video]);
  const crossPromo = useMemo(() => detectCrossPromotion(video.description), [video.description]);

  const poolReady = poolEntries.length >= 3;
  const publishTime = useMemo(() => (poolReady ? computePublishTimeHeatmap(poolEntries) : null), [poolReady, poolEntries]);
  const tagCorrelation = useMemo(() => (poolReady ? computeTagCorrelation(poolEntries) : null), [poolReady, poolEntries]);
  const uploadCadence = useMemo(() => (poolReady ? computeUploadCadence(poolEntries) : null), [poolReady, poolEntries]);
  const competitorGap = useMemo(
    () => (poolReady && keywordBank ? computeCompetitorGapMatrix("fundednext", poolEntries, keywordBank) : null),
    [poolReady, poolEntries, keywordBank],
  );

  return {
    channel,
    adjacent,
    nicheRanking,
    languageCPA,
    descSEO,
    engDecay,
    crossPromo,
    publishTime,
    tagCorrelation,
    uploadCadence,
    competitorGap,
  };
}

export type VideoIntel = ReturnType<typeof useVideoIntel>;
