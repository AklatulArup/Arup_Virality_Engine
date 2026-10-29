import type { VideoData, VRSCriterion } from "./types";

// X (Twitter) Readiness Score (XRS) — 2026 edition
// 20 criteria, 100 points total.
//
// SOURCES (verified weights):
//   • github.com/twitter/the-algorithm-ml (Heavy Ranker weights, April 5 2023 — still canonical reference)
//   • github.com/xai-org/x-algorithm (January 2026 Grok/Phoenix release)
//
// PUBLISHED SCORING WEIGHTS (xai-org/x-algorithm home-mixer/params/param.rs, Aug 13 2026;
// multipliers on predicted probabilities — the 2023 +75/-369 table is retired):
//     share via copy link        : +20.0  (~30x a like)  ← highest positive weight
//     reply                      :  +5.0  (+15 more when the replier is a mutual follow)
//     quote                      :  +5.0
//     share via DM               :  +5.0
//     follow author              :  +4.0
//     share (generic)            :  +2.0
//     repost                     :  +1.0
//     like                       :  +0.66
//     open link                  :  +0.2  (no link penalty)
//     profile click              :   0.0
//     block / not interested / mute : -31.2 / -52.3 / -58.8
//     report                     : -234.0
//
// 2026 CHANGES (xai-org/x-algorithm Jan 2026 release):
//  • Grok-based Phoenix transformer replaces legacy Heavy Ranker MaskNet.
//  • All hand-engineered features and heuristics eliminated.
//  • Negative signals carry massive weights (block -3.0 in the summary scoring
//    layer that sits on top of the transformer). Optimises for long-term retention, not rage-bait.
//  • ~1,500 candidates blended 50/50 in-network vs out-of-network per feed refresh.
//  • Author Diversity Penalty: algorithm limits posts from same account per session.
//  • Premium boost: +4 to +16 TweepCred points.
//  • TweepCred threshold: below 0.65, only 3 of your tweets considered for distribution.
//  • 6-hour time decay — post visibility halves every 6 hours.

function getX(d: VideoData) {
  return {
    reposts:    (d as unknown as { reposts?: number }).reposts    ?? (d.shares ?? 0),
    quotes:     (d as unknown as { quotes?: number }).quotes      ?? 0,
    bookmarks:  (d as unknown as { bookmarks?: number }).bookmarks ?? (d.saves ?? 0),
    replies:    d.comments,
    likes:      d.likes,
    views:      d.views,
    hasLink:    (d as unknown as { hasLink?: boolean }).hasLink   ?? false,
    isThread:   (d as unknown as { isThread?: boolean }).isThread ?? false,
    hasVideo:   (d as unknown as { hasVideo?: boolean }).hasVideo ?? false,
    hasImage:   (d as unknown as { hasImage?: boolean }).hasImage ?? false,
    verified:   (d as unknown as { authorVerified?: boolean }).authorVerified ?? false,
    followers:  (d as unknown as { authorFollowers?: number }).authorFollowers ?? 0,
  };
}

export const X_CRITERIA: VRSCriterion[] = [

  // ─── TIER 1: Critical (50 points) ────────────────────────────────────────

  {
    id: "x-reply-depth",
    label: "Reply depth  (27x a like — Heavy Ranker weight 13.5)",
    weight: 18,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { replies, views } = getX(d);
      if (views === 0) return 0;
      const rate = (replies / views) * 100;
      return rate >= 0.5 ? 1 : rate >= 0.15 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { replies, views } = getX(d);
      const rate = views > 0 ? ((replies / views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Reply rate ${rate}%, strong. Replies score +5 in X's published weights — about 7.6x a like — and replies from mutual follows get +15 more.`;
      if (score === 0.5)
        return `Reply rate ${rate}%, moderate. Ask a specific, unanswerable-in-one-word question or post a contrarian claim that invites "well actually" responses. Reply to every reply in the first hour — the conversation has to happen inside the ~6-hour visibility window.`;
      return `Reply rate ${rate}%, weak. Replies carry ~7.6x the ranking weight of a like. Content that states a position (not just shares information) generates replies. Add a debatable claim or a direct question to the post.`;
    },
  },
  {
    id: "x-reply-engagement-signal",
    label: "Mutual-follow replies & copy-link shares  (weights +15 / +20)",
    weight: 10,
    tier: 1,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot directly measure from post metadata. In X's published weights (Aug 2026) the top positive signal is a copy-link share (+20, ~30x a like), and a reply from a mutual follow gets +15 on top of the +5 reply weight. Build mutual-follow density with trading peers, reply to every reply in the first 30 minutes, and post things people paste elsewhere — data, charts, payout proof. The old \"+75 author reply-back\" weight is retired.",
  },
  {
    id: "x-bookmark-rate",
    label: "Bookmark rate  (utility signal)",
    weight: 8,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { bookmarks, views } = getX(d);
      if (views === 0) return 0;
      const rate = (bookmarks / views) * 100;
      return rate >= 0.5 ? 1 : rate >= 0.1 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { bookmarks, views } = getX(d);
      const rate = views > 0 ? ((bookmarks / views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Bookmark rate ${rate}%, strong. Bookmarks signal lasting utility — content people intend to return to. Threads, frameworks, and reference content earn bookmarks. This content has "save for later" value.`;
      if (score === 0.5)
        return `Bookmark rate ${rate}%, moderate. Add one high-utility element: a specific number, a checklist, a framework, a comparison. Content that's too broad to memorise gets bookmarked.`;
      return `Bookmark rate ${rate}%, weak. Add one piece of specific, dense information per post that people want to find again.`;
    },
  },
  {
    id: "x-no-link-in-body",
    label: "Link posts carry a native hook  (no link penalty since Jul 2026)",
    weight: 4,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { hasLink } = getX(d);
      if (!hasLink) return 1;
      // Links are no longer penalized; a link post only loses if the hook fails to earn on-platform engagement.
      const likeRate = d.likes / Math.max(1, d.views) * 100;
      return likeRate >= 1 ? 1 : 0.5;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { hasLink } = getX(d);
      if (!hasLink || score === 1)
        return hasLink
          ? `Link in post body with healthy on-platform engagement. Fine — X dropped the link penalty in Jul 2026 (link opens score +0.2 in the published weights).`
          : `No external link in post body. Self-contained posts earn replies and shares on-platform, which is what X's published weights reward.`;
      return `Link in post body with weak on-platform engagement. Links are no longer penalized (Jul 2026), but a bare link earns only +0.2 per open — lead with a native hook, chart or claim so the post earns replies and shares before the click.`;
    },
  },
  {
    id: "x-retweet-rate",
    label: "Retweet rate  (weight +1.0 — baseline amplifier)",
    weight: 6,
    tier: 1,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { reposts, views } = getX(d);
      if (views === 0) return 0;
      const rate = (reposts / views) * 100;
      return rate >= 0.5 ? 1 : rate >= 0.15 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { reposts, views } = getX(d);
      const rate = views > 0 ? ((reposts / views) * 100).toFixed(3) : "0";
      if (score === 1)
        return `Retweet rate ${rate}%, strong. Retweets score +1.0 (2x a like) but compound through follower-graph cascades. Each retweet exposes the post to a new network.`;
      if (score === 0.5)
        return `Retweet rate ${rate}%, moderate. Add a retweet-worthy frame: a single standalone insight, a surprising statistic, or a position statement that needs no context to share.`;
      return `Retweet rate ${rate}%, weak. Retweetable content is a single standalone insight. If reading the post requires the surrounding thread to make sense, people don't retweet.`;
    },
  },

  // ─── TIER 2: Strong Signals (25 points) ──────────────────────────────────

  {
    id: "x-profile-click-signal",
    label: "Profile click + engagement  (weight +12)",
    weight: 6,
    tier: 2,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot directly measure from post metadata. A user clicking through to your profile AND then liking or replying to another tweet scores +12 in the Heavy Ranker — 24x a like. This is the parasocial signal. Optimise bio + pinned post so that a profile click converts to a follow or a second engagement. Post 2-3 items a day that cross-reference each other so a profile visitor can see a pattern.",
  },
  {
    id: "x-first-hour-velocity",
    label: "First-hour engagement velocity  (6-hour decay)",
    weight: 5,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const ageMs   = d.publishedAt ? Date.now() - new Date(d.publishedAt).getTime() : 999 * 86400000;
      const ageDays = ageMs / 86400000;
      const velocity = (d.likes + d.comments + (d.shares ?? 0)) / Math.max(1, d.views) * 100;
      if (velocity >= 2 && ageDays <= 1) return 1;
      if (velocity >= 1 || ageDays <= 1) return 0.5;
      return 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const vel = ((d.likes + d.comments + (d.shares ?? 0)) / Math.max(1, d.views) * 100).toFixed(2);
      const ageMs = d.publishedAt ? Date.now() - new Date(d.publishedAt).getTime() : 0;
      const ageDays = (ageMs / 86400000).toFixed(1);
      if (score === 1)
        return `${vel}% engagement, ${ageDays}d old. Strong first-hour velocity. X's time decay halves visibility score every 6 hours. A post that accumulates 80% of its engagement in the first 2 hours is the ideal X distribution pattern.`;
      if (score === 0.5)
        return `${vel}% engagement, ${ageDays}d old. Moderate. Post when your audience is active. Engage with every reply in the first 30 minutes. Each reply you generate resets the decay timer partially.`;
      return `${vel}% engagement, weak velocity. X is a 6-hour platform — if a post doesn't ignite in the first 6 hours, 95% of its potential reach is gone.`;
    },
  },
  {
    id: "x-thread-format",
    label: "Thread or long-form post  (dwell time signal)",
    weight: 5,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { isThread } = getX(d);
      const text = d.description || d.title || "";
      const isLong = text.length > 200;
      if (isThread || isLong) return 1;
      if (text.length > 100) return 0.5;
      return 0.25;
    },
    rationale: (d: VideoData, score: number | null) => {
      const { isThread } = getX(d);
      if (score === 1)
        return `${isThread ? "Thread detected" : "Long-form post"}. Each reply in a thread gets its own impression count. X's Grok transformer also rewards dwell time — the good_click_v2 signal (+10) measures 2+ minutes spent in a conversation. Threads and long posts trigger this.`;
      if (score === 0.5)
        return `Moderate post length. Threads work best for step-by-step breakdowns, series (challenge Day N), and rule explanations. Single posts work best for strong one-liner takes and data reveals.`;
      return `Short post. Single posts can go viral on X if the take is strong enough, but threads generate more reply depth, more bookmark rate, and more dwell time — all higher-weight signals.`;
    },
  },
  {
    id: "x-grok-relevance",
    label: "Grok transformer relevance  (Jan 2026 Phoenix model)",
    weight: 5,
    tier: 2,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot directly measure. Since January 2026 X uses Phoenix — a Grok-based transformer that reads every post and watches every video (100M+ per day per Musk). Hand-engineered features are eliminated; the transformer learns patterns from engagement sequences. Post content that aligns with what your followers have historically engaged with. Topic drift hurts more in 2026 than before.",
  },
  {
    id: "x-native-media",
    label: "Native image or video (no cross-platform watermarks)",
    weight: 4,
    tier: 2,
    autoAssessable: true,
    check: (d: VideoData) => {
      const { hasVideo, hasImage } = getX(d);
      if (hasVideo || hasImage) return 0.75;
      return 0.3;
    },
    rationale: (d: VideoData, _score: number | null) => {
      const { hasVideo, hasImage } = getX(d);
      if (hasVideo || hasImage)
        return `Native ${hasVideo ? "video" : "image"} detected. Good. Visual content on X typically gets 2-3x more impressions than text-only. Important: never cross-post video with TikTok or Instagram watermarks — X detects and deprioritises third-party branded content.`;
      return `Text-only post. X is the only major platform where text routinely beats video. Strong text posts can still dominate. A chart, screenshot, or native video adds impressions but isn't mandatory.`;
    },
  },

  // ─── TIER 3: Supporting (17 points) ──────────────────────────────────────

  {
    id: "x-tweepcred-threshold",
    label: "TweepCred score above 0.65",
    weight: 5,
    tier: 3,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot directly measure. Every X account has a TweepCred score (0-100) calculated via a weighted PageRank approach: account age, follower-to-following ratio, engagement quality, interactions with high-quality users. Below 0.65 (out of 1.0 normalised), only 3 of your tweets are considered for distribution per cycle — a hard throttle. Premium subscribers get +4 to +16 points. Build TweepCred by engaging with high-TweepCred accounts authentically.",
  },
  {
    id: "x-hook-first-line",
    label: "Strong first-line hook (bold, number, question)",
    weight: 5,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const text = (d.description || d.title || "").trim();
      const firstLine = text.split("\n")[0] || text.slice(0, 140);
      const hasNumber   = /\d/.test(firstLine.slice(0, 60));
      const hasQuestion = /\?/.test(firstLine);
      const hasBold     = /never|always|stop|this|unpopular|hot take|nobody|everyone|most/i.test(firstLine);
      const hasData     = /\$|%|\d+[kKmM]|#\d/.test(firstLine);
      if ((hasNumber || hasData) && (hasQuestion || hasBold)) return 1;
      if (hasNumber || hasData || hasQuestion || hasBold) return 0.75;
      return 0.25;
    },
    rationale: (d: VideoData, score: number | null) => {
      const firstLine = (d.description || d.title || "").split("\n")[0]?.slice(0, 100) ?? "";
      if (score === 1)
        return `First line: "${firstLine}". Strong hook. The first 140 characters are the entire post for most users — they don't click "read more". Number + contrarian claim is the highest dwell-time hook combination on X.`;
      if (score !== null && score >= 0.75)
        return `First line: "${firstLine}". Good hook element. Optimal formula: [Number/Data] + [Bold Claim] + [Implicit question]. Example: "97% of prop traders fail in month 1. Here's the one thing I did differently."`;
      return `First line: "${firstLine}". Weak hook. Lead with a number, a surprising statistic, or a contrarian claim that demands explanation.`;
    },
  },
  {
    id: "x-hashtag-minimal",
    label: "Hashtags: 0-2 (more = spam)",
    weight: 4,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const tags = d.tags?.length ?? 0;
      return tags <= 2 ? 1 : tags <= 4 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const tags = d.tags?.length ?? 0;
      if (score === 1)
        return `${tags} hashtag${tags === 1 ? "" : "s"}. Optimal. X 2026 downgrades posts with multiple hashtags by ~40% — they trigger the spam classifier. Grok reads the post text directly for topic classification; hashtags are not the discovery mechanism on X.`;
      if (score === 0.5)
        return `${tags} hashtags. Borderline. X treats 3+ hashtags as a spam signal. Reduce to maximum 2.`;
      return `${tags} hashtags. Spam signal. Remove all but the 1-2 most relevant. Grok reads the post content directly — hashtags are not needed for discovery here.`;
    },
  },
  {
    id: "x-like-rate",
    label: "Like rate  (weight +0.5 — lowest)",
    weight: 3,
    tier: 3,
    autoAssessable: true,
    check: (d: VideoData) => {
      const rate = d.likes / Math.max(1, d.views) * 100;
      return rate >= 2 ? 1 : rate >= 0.5 ? 0.5 : 0;
    },
    rationale: (d: VideoData, score: number | null) => {
      const rate = (d.likes / Math.max(1, d.views) * 100).toFixed(3);
      if (score === 1)
        return `Like rate ${rate}%, strong. Note: likes are the LOWEST-weight positive signal on X (+0.5 — 27x smaller than a reply). High likes with low replies signals content people appreciate but don't engage with. Pleasant but not distribution-driving.`;
      if (score === 0.5)
        return `Like rate ${rate}%, moderate. Likes are a baseline health check only. If likes are high but replies and quote tweets are low, the content is too "agreeable" — add a more provocative element to unlock higher-weight signals.`;
      return `Like rate ${rate}%, weak. The correct fix is to increase replies and quote tweets, not likes — they carry 27-50x more ranking weight.`;
    },
  },

  // ─── TIER 4: Baseline (8 points) ─────────────────────────────────────────

  {
    id: "x-post-timing",
    label: "Posted during 6-hour peak window",
    weight: 3,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Cannot assess from metadata. X posts lose 50% of visibility score every 6 hours. The entire lifespan is effectively the first 6 hours. Post when your audience is active — X Analytics → Audience → Active Hours. For global finance audiences, 8-10 AM EST and 12-2 PM EST are typical peak windows.",
  },
  {
    id: "x-author-diversity",
    label: "Author diversity penalty awareness",
    weight: 3,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "X applies an Author Diversity Scorer that limits how many posts from a single account appear in a user's feed per session. If you post 10 times a day, the algorithm won't show all 10 to followers — it picks the 2-3 strongest performers and suppresses the rest. Weaker posts dilute your average without adding reach. Sweet spot: 2-3 posts per day optimised for quality.",
  },
  {
    id: "x-negative-feedback",
    label: "Negative feedback avoidance  (weight -59 / -234)",
    weight: 2,
    tier: 4,
    autoAssessable: false,
    check: (_d: VideoData) => null,
    rationale: (_d: VideoData, _score: number | null) =>
      "Negative feedback weights are massive: -31.2 block, -52.3 \"not interested\", -58.8 mute, -234 report. A single report wipes out ~355 likes worth of score. X optimises for long-term retention, not short-term engagement — rage-bait that gets clicks but makes users block you is a net negative. Avoid inflammatory framing that goes beyond contrarian into attacking.",
  },
];
