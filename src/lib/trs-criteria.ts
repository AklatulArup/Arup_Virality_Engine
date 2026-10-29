import type { VideoData, VRSCriterion } from "./types";

// TikTok Readiness Score (TRS) — 2026 edition
// 20 criteria, 100 points total.
//
// Sources: TikTok Creator Learning Hub (Jan 2026), Socialinsider 2025 Benchmarks,
// Dash Hudson 2025 Social Media Benchmarks, TikTok USDS algorithm retraining (Oracle, Jan 2026).
//
// Key 2026 changes folded in:
//  • Completion threshold raised to ~70% (was 50%).
//  • "Qualified View" = watched ≥5 seconds — Creator Rewards payout metric (not confirmed FYP ranking math).
//  • Rewatch rate now outranks follower count.
//  • TikTok SEO is a direct ranking signal — spoken words, captions, on-screen text are indexed.
//  • Original audio now preferred over trending audio for long-term distribution.
//  • 1-3 minute videos get aggressive push via Creator Rewards Program.
//  • Oracle/USDS retraining on US-only data — timing instability through mid-2026.
//  • Aggregated / reposted / watermarked content (CapCut/IG/YT logos) actively demoted.

function getTikTok(d: VideoData) {
  return {
    shares:    d.shares ?? 0,
    saves:     d.saves ?? 0,
    tags:      d.tags || [],
    followers: (d as { creatorFollowers?: number }).creatorFollowers ?? 0,
    soundName:     (d as { soundName?: string }).soundName ?? "",
    soundOriginal: (d as { soundOriginal?: boolean }).soundOriginal ?? false,
    description: d.description || "",
  };
}

export const TT_CRITERIA: VRSCriterion[] = [

  // ─── TIER 1: Critical (50 points) ────────────────────────────────────────

  {
    id: "tt-completion-70",
    label: "Completion rate toward 70% threshold",
    weight: 14,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { followers } = getTikTok(d);
      if (d.views === 0 || d.durationSeconds === 0) return null;
      const viewsPerFollower = followers > 0 ? d.views / followers : 1;
      const dur = d.durationSeconds;
      const inOptimalLength = dur >= 15 && dur <= 45;
      if (viewsPerFollower > 3 && inOptimalLength) return 1;
      if (viewsPerFollower > 1 && dur <= 60) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { followers } = getTikTok(d);
      const vpf = followers > 0 ? (d.views / followers).toFixed(1) : "N/A";
      const dur = d.durationSeconds;
      if (score === null) return "Insufficient data for completion estimate.";
      if (score === 1)
        return `${vpf}x reach vs follower count, ${dur}s duration. Strong signal that completion is near or above TikTok 2026's 70% threshold. The algorithm promotes content that holds viewers to the end.`;
      if (score === 0.5)
        return `${vpf}x reach, ${dur}s. Moderate completion. In 2026 the minimum for wider distribution is 70%, up from 50%. If duration is over 45s, consider cutting to 20-30s to raise completion ratio.`;
      return `${vpf}x reach, ${dur}s. Likely under the 70% completion threshold. Videos that miss this bar stay in 200-view jail. Shorten to 20-30s, or add rewatch hooks (hidden details that resolve on second viewing).`;
    },
  },
  {
    id: "tt-rewatch-signal",
    label: "Rewatch / loop signal  (strongest 2026 signal)",
    weight: 11,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { shares, saves } = getTikTok(d);
      if (d.views === 0) return 0;
      const saveR  = (saves  / d.views) * 100;
      const shareR = (shares / d.views) * 100;
      const combined = saveR + shareR;
      if (combined >= 1.5) return 1;
      if (combined >= 0.7) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { shares, saves } = getTikTok(d);
      const saveR  = d.views > 0 ? ((saves  / d.views) * 100).toFixed(3) : "0";
      const shareR = d.views > 0 ? ((shares / d.views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Save rate ${saveR}% + share rate ${shareR}% = strong rewatch signal. In 2026, rewatch rate outranks follower count. One viewer watching three times signals more than three viewers watching once.`;
      if (score === 0.5)
        return `Save ${saveR}% + share ${shareR}%, moderate. Design for rewatch: add a hidden detail at 3 seconds that only makes sense on second viewing, or end with a frame that loops seamlessly into the opening.`;
      return `Save ${saveR}% + share ${shareR}%, weak rewatch signal. Rewatches are the single highest-value 2026 TikTok signal. Add a reveal in the last 2 seconds that makes viewers want to see the setup again.`;
    },
  },
  {
    id: "tt-share-rate",
    label: "Share rate  (27x a like in ranking weights)",
    weight: 9,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { shares } = getTikTok(d);
      if (d.views === 0) return 0;
      const ratio = (shares / d.views) * 100;
      return ratio >= 1 ? 1 : ratio >= 0.3 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { shares } = getTikTok(d);
      const ratio = d.views > 0 ? ((shares / d.views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Share rate ${ratio}%, strong. Shares are weighted far higher than likes in TikTok's ranking. A video with 50,000 views and 200 shares outperforms one with 100,000 views and 20 shares over time.`;
      if (score === 0.5)
        return `Share rate ${ratio}%, moderate. Add a "send this to someone who..." moment targeted at a specific type of person, not generic shareable content. Tribal identity content drives DM shares.`;
      return `Share rate ${ratio}%, weak. Shares are the #1 distribution-triggering action on TikTok. Content that doesn't generate shares rarely breaks past the first test audience.`;
    },
  },
  {
    id: "tt-save-rate",
    label: "Save rate  (reference / utility signal)",
    weight: 8,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { saves } = getTikTok(d);
      if (d.views === 0) return 0;
      const ratio = (saves / d.views) * 100;
      if (ratio >= 2)   return 1;
      if (ratio >= 0.5) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { saves } = getTikTok(d);
      const ratio = d.views > 0 ? ((saves / d.views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Save rate ${ratio}%, strong. Per Hootsuite 2025, save rate above 2% makes a video 3.4x more likely to hit the FYP. Content with high saves has reference value: step-by-step tutorials, comparison lists, specific dollar amounts.`;
      if (score === 0.5)
        return `Save rate ${ratio}%, moderate. Brand benchmark is 1.2%. Add one piece of specific reference information — an exact rule, a specific number, a comparison — that viewers will want to return to.`;
      return `Save rate ${ratio}%, weak. Saves signal lasting utility. Content that is purely entertaining gets watched and forgotten; content with a specific takeaway gets saved.`;
    },
  },
  {
    id: "tt-qualified-view",
    label: "5-second qualified view (Creator Rewards)",
    weight: 8,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const eng = (d.likes + d.comments + (d.shares ?? 0) + (d.saves ?? 0)) / Math.max(1, d.views) * 100;
      const dur = d.durationSeconds;
      if (eng >= 3 && dur >= 60) return 1;
      if (eng >= 1.5) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const eng = ((d.likes + d.comments + (d.shares ?? 0) + (d.saves ?? 0)) / Math.max(1, d.views) * 100).toFixed(2);
      const dur = d.durationSeconds;
      if (score === 1)
        return `${eng}% engagement, ${dur}s duration. Strong qualified-view signal. "Qualified Views" (watched 5+ seconds) are the 2026 Creator Rewards metric. Videos over 60s earn ~$0.50 to $1.00 per 1,000 qualified views.`;
      if (score === 0.5)
        return `${eng}% engagement, ${dur}s. Moderate. The first 2 seconds determine qualified views. Open with visual pattern interrupt, bold text statement, or provocative claim — never a logo or intro sequence.`;
      return `${eng}% engagement, ${dur}s. Weak qualified-view signal. If viewers drop off before the 5-second mark, the video fails TikTok's qualified-view threshold and gets buried.`;
    },
  },

  // ─── TIER 2: Strong signals (25 points) ──────────────────────────────────

  {
    id: "tt-seo-keywords",
    label: "TikTok SEO — keywords in caption and speech",
    weight: 6,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { description, tags } = getTikTok(d);
      const captionLen = description.length;
      const hasKeywords = tags.length >= 2 && tags.length <= 6;
      const hasContextualCaption = captionLen > 50 && captionLen < 200;
      if (hasKeywords && hasContextualCaption) return 1;
      if (hasKeywords || hasContextualCaption) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { description, tags } = getTikTok(d);
      if (score === 1)
        return `Caption is ${description.length} chars with ${tags.length} keyword tags. Strong SEO signal. In 2026 TikTok search is a direct ranking metric. 49% of US consumers use TikTok as a search engine (Adobe, Jan 2026). TikTok transcribes spoken words and indexes them.`;
      if (score === 0.5)
        return `Partial SEO signal. TikTok 2026 treats spoken words, captions, and on-screen text as search indexing input. Say the keyword in the first 3 seconds. Write it on screen. Include it in the caption.`;
      return `Weak SEO signal. Generic captions with few specific keywords miss TikTok's search surface. Unlike FYP distribution which decays within 48 hours, search-driven discovery compounds over weeks.`;
    },
  },
  {
    id: "tt-original-audio",
    label: "Original audio or voice (2026 boost)",
    weight: 6,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { soundName, soundOriginal } = getTikTok(d);
      if (soundOriginal) return 1;
      if (soundName && soundName.length > 0) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { soundName, soundOriginal } = getTikTok(d);
      if (score === 1)
        return `Original audio detected${soundName ? ` (${soundName})` : ""}. TikTok 2026 favours videos with original voice or music over videos using only trending sounds. Original audio that other creators reuse creates a viral flywheel.`;
      if (score === 0.5)
        return `Using a named sound (${soundName}). Fine as a baseline; trending sounds give initial distribution boost during the first 48 hours of their early-adoption phase. Pair with your own voiceover to compound the ranking advantage.`;
      return `No sound signal detected. In 2026 videos with a real person speaking to camera outperform music-only clips. Add a voiceover even on a music-driven clip.`;
    },
  },
  {
    id: "tt-comment-depth",
    label: "Comment depth — substantive replies",
    weight: 5,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      if (d.views === 0) return 0;
      const ratio = (d.comments / d.views) * 100;
      if (ratio >= 1)   return 1;
      if (ratio >= 0.5) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const ratio = d.views > 0 ? ((d.comments / d.views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Comment rate ${ratio}%, strong. In 2026 TikTok weights comment depth over raw count. Longer, substantive comments signal deeper engagement than emoji-only replies. Reply to substantive comments in the first hour to compound the signal.`;
      if (score === 0.5)
        return `Comment rate ${ratio}%, moderate. Ask a specific, unanswerable-in-one-word question in the caption or on-screen text to invite substantive replies.`;
      return `Comment rate ${ratio}%, weak. Low comment engagement is a strong kill signal — TikTok treats it as evidence the content didn't spark genuine reaction.`;
    },
  },
  {
    id: "tt-originality",
    label: "Originality — no watermarks / repost markers",
    weight: 5,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { description, soundOriginal } = getTikTok(d);
      const t = description.toLowerCase();
      const isRepost = /repost|via @|credit to|credits:|cr:/.test(t);
      if (isRepost) return 0;
      if (soundOriginal) return 1;
      return 0.5;
    },
    rationale: (_d: VideoData, score: number | null) => {
      if (score === 1)
        return `Original content with original audio. Full originality score. TikTok 2026 actively demotes duplicated material and content sourced from other creators. Originality is a baseline eligibility criterion.`;
      if (score === 0.5)
        return `No repost markers detected. Native creation on-platform (not uploaded from CapCut/IG/YouTube with watermarks) is required for FYP eligibility. Watermarks from other platforms tank reach.`;
      return `Repost or credit signal in caption. If the content is original, rewrite the caption to remove "repost", "via @", or "credit to" — the algorithm uses these as demotion signals.`;
    },
  },

  // ─── TIER 3: Supporting (17 points) ──────────────────────────────────────

  {
    id: "tt-hook-strength",
    label: "First 1-2 second hook",
    weight: 5,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const text = (d.description || d.title || "").toLowerCase();
      const firstLine = text.split("\n")[0] || text.slice(0, 80);
      const hasHookPattern = /\d+|\$|%|why|how|secret|truth|stop|never|actually|unpopular|hot take/i.test(firstLine);
      const hasPatternInterrupt = /wait|stop|look|did you know|watch this/i.test(firstLine);
      if (hasHookPattern && hasPatternInterrupt) return 1;
      if (hasHookPattern || hasPatternInterrupt) return 0.75;
      return 0.25;
    },
    rationale: (d: VideoData, _score: number | null) => {
      const firstLine = (d.description || d.title || "").split("\n")[0]?.slice(0, 80) ?? "";
      return `First-line text: "${firstLine}". 2026 TikTok algorithm measures drop-off from the first frame. The hook must be visual, textual, or auditory within the first 1-2 seconds. Open with: bold text statement, provocative claim, visual surprise, or a number. Never open with a logo, intro sequence, or "Hey guys."`;
    },
  },
  {
    id: "tt-niche-consistency",
    label: "Niche consistency  (follower-first testing)",
    weight: 4,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { tags } = getTikTok(d);
      const hasNicheTag = tags.some(t => /prop|trader|trading|forex|finance|money|funded|challenge|daytrading/i.test(t));
      if (hasNicheTag && tags.length >= 2 && tags.length <= 5) return 1;
      if (hasNicheTag) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { tags } = getTikTok(d);
      if (score === 1)
        return `${tags.length} tags including niche-specific keywords. Good for TikTok's seed-audience testing. The algorithm classifies accounts by niche consistency and tests new videos on audiences who engaged with your previous niche content first.`;
      if (score === 0.5)
        return `Partial niche signal. Post consistently within one niche so TikTok's classifier identifies your account cleanly. Faceless channels and niche-consistent accounts benefit most from seed-audience testing.`;
      return `Weak niche signal. Niche inconsistency confuses the classifier and delays wider testing. Pick one primary content pillar and 3-5 related tags that appear on every video.`;
    },
  },
  {
    id: "tt-duration-fit",
    label: "Duration fits 2026 strategy (20-40s OR 60s+)",
    weight: 4,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const dur = d.durationSeconds;
      if ((dur >= 20 && dur <= 40) || (dur >= 60 && dur <= 180)) return 1;
      if (dur >= 15 && dur <= 60) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const dur = d.durationSeconds;
      if (score === 1)
        return `${dur}s duration fits one of the two optimal 2026 bands: 20-40s for maximum completion rate, or 60-180s for Creator Rewards Program eligibility and higher distribution.`;
      if (score === 0.5)
        return `${dur}s, moderate fit. 2026's sweet spots are 20-40s (max completion) or 60-180s (Creator Rewards + longer-form push). 45-55s is the dead zone: too long for max completion, too short for the longer-form boost.`;
      return `${dur}s, suboptimal duration for 2026. Either cut to 20-30s for completion rate, or extend to 60+ seconds to qualify for the higher payout and longer-form algorithmic push.`;
    },
  },
  {
    id: "tt-hashtag-restraint",
    label: "Hashtags — 2 to 5 targeted (no #fyp spam)",
    weight: 4,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { tags } = getTikTok(d);
      const hasGenericSpam = tags.some(t => /^(fyp|foryou|foryoupage|viral|xyz)$/i.test(t));
      if (hasGenericSpam) return 0;
      if (tags.length >= 2 && tags.length <= 5) return 1;
      if (tags.length === 1 || tags.length === 6 || tags.length === 7) return 0.5;
      return 0.25;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { tags } = getTikTok(d);
      if (score === 0 && tags.some(t => /^(fyp|foryou|viral)$/i.test(t)))
        return `Generic #fyp / #foryou / #viral detected. These are ignored or actively demoted by the 2026 algorithm. Replace with 2-5 niche-specific hashtags.`;
      if (score === 1)
        return `${tags.length} targeted hashtags. Optimal. TikTok 2026 uses hashtags as supporting topic signals, not the primary discovery mechanism. 2-5 specific tags are enough.`;
      return `${tags.length} hashtags. Adjust to 2-5 niche-specific tags. Hashtag stuffing no longer boosts reach; it triggers the spam classifier.`;
    },
  },

  // ─── TIER 4: Baseline (8 points) ─────────────────────────────────────────

  {
    id: "tt-first-hour-engagement",
    label: "First-hour engagement velocity",
    weight: 3,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot fully assess from post-hoc data. First-hour engagement velocity triggers the expansion decision. Reply to every comment in the first hour to signal active conversation. Post when your audience is most active (TikTok Analytics → Audience → Active Times).",
  },
  {
    id: "tt-not-interested",
    label: "\"Not interested\" signal (negative feedback)",
    weight: 3,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot directly measure. The algorithm treats \"Not Interested\" taps and quick scroll-aways as explicit negative feedback and reduces future distribution for similar content patterns. Avoid clickbait thumbnails that violate expectations.",
  },
  {
    id: "tt-usds-transition",
    label: "Oracle/USDS algorithm transition (2026 context)",
    weight: 2,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "US algorithm being retrained on Oracle infrastructure through mid-2026. Expect temporary distribution fluctuations. Maintain consistent posting — creators who pause during retraining recover slower. Focus on fundamentals (watch time, completion, shares) as these signals carry over regardless of operator.",
  },
];
