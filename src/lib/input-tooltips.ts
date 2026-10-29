// ═══════════════════════════════════════════════════════════════════════════
// MANUAL INPUT TOOLTIPS — the RM reference for creator analytics fields
// ═══════════════════════════════════════════════════════════════════════════
//
// Each entry describes:
//   what  — plain-English definition
//   where — exact navigation path in the creator's analytics dashboard
//   good  — value ranges that indicate healthy performance
//   bad   — value ranges that indicate problems
//   why   — how this input affects the forecast and which algorithm signal
//           it maps to in the 2026 ranker

export interface InputTooltip {
  what:  string;
  where: string;
  good:  string;
  bad:   string;
  why:   string;
}

export const INPUT_TOOLTIPS: Record<string, InputTooltip> = {

  // ─── TikTok ──────────────────────────────────────────────────────────────
  ttCompletionPct: {
    what:  "Share of viewers who watched the full video, end to end.",
    where: "TikTok Creator Studio → Analytics → Content → tap the video → 'Average watch time' / 'Finished watching %'",
    good:  "≥70% (the 2026 algorithm threshold for full distribution)",
    bad:   "<50% (hook failure — video gets throttled to the '200-view jail')",
    why:   "The #1 ranking signal on TikTok in 2026. Drives roughly 40% of the scoring formula. Below 70% and the algorithm stops promoting — above 70% and it amplifies.",
  },

  ttRewatchPct: {
    what:  "Share of viewers who watched the video more than once in the same session.",
    where: "TikTok Creator Studio → Analytics → Content → tap the video → 'Rewatch rate'",
    good:  "≥15% (content is loop-worthy or reference-worthy)",
    bad:   "<5% (one-and-done content, no replay value)",
    why:   "In 2026 rewatch rate outranks follower count as a ranking signal. High rewatch = TikTok treats your content as sticky, pushes to more For You pages.",
  },

  ttFypViewPct: {
    what:  "Share of views coming from the For You page vs. Following or Profile traffic.",
    where: "TikTok Creator Studio → Analytics → Overview → Traffic Sources",
    good:  "≥70% (algorithm is actively promoting)",
    bad:   "<40% (mostly seen by existing followers — no new reach)",
    why:   "High FYP share means the algorithm is amplifying to non-followers. Low FYP share means the video plateaued in the follower bubble and the audition phase failed.",
  },

  // ─── Instagram ───────────────────────────────────────────────────────────
  igSaves: {
    what:  "Number of people who saved the post to their Collections.",
    where: "Instagram app → your post → tap 'Insights' → scroll to Interactions → 'Saves'",
    good:  "≥1% of reach (e.g., 100 saves per 10,000 reached)",
    bad:   "<0.2% of reach",
    why:   "Saves signal high re-use intent and extend shelf life. High-save Reels get 2-4 weeks of extended distribution via 'Suggested for you'.",
  },

  igSends: {
    what:  "Number of times the post was shared in a DM.",
    where: "Instagram app → your post → tap 'Insights' → 'Shares' → 'DM shares'",
    good:  "≥0.5% of reach",
    bad:   "<0.1% of reach",
    why:   "Adam Mosseri has confirmed DM sends are Instagram's #1 signal for non-follower reach. Weighted 3-5× a like in the 2026 ranker. One of the biggest levers on IG.",
  },

  igReach: {
    what:  "Unique accounts that saw the post at least once.",
    where: "Instagram app → your post → tap 'Insights' → 'Accounts reached'",
    good:  ">2× follower count means it escaped the follower bubble",
    bad:   "<0.3× follower count — the audition phase failed",
    why:   "Reach is the denominator for the two most important Instagram ratios — sends/reach and likes/reach. Without reach you can't compute the ratios the algorithm actually uses.",
  },

  igHold3s: {
    what:  "Share of viewers who stayed past the 3-second mark.",
    where: "Instagram app → Insights → Professional → retention curve (if available on your plan)",
    good:  "≥70%",
    bad:   "<40% (hook failed the audition phase — no further distribution)",
    why:   "The 2026 audition system tests content on a small non-follower group first. If 3-sec hold is weak, the post is killed before most followers even see it.",
  },

  // ─── YouTube ─────────────────────────────────────────────────────────────
  ytAVDpct: {
    what:  "Average view duration expressed as a percentage of total video length.",
    where: "YouTube Studio → Analytics → Engagement → Average view duration (compare to video length)",
    good:  "≥50% for Long-Form (strong retention), ≥80% for Shorts",
    bad:   "<30% (viewers clicked but didn't stay — 'broken promise' between title/thumbnail and content)",
    why:   "Roughly 50% of the YouTube Long-Form ranking formula. If AVD is low, Browse and Suggested distribution collapse regardless of subscriber count.",
  },

  ytCTRpct: {
    what:  "Click-through rate — how often the thumbnail was clicked after being shown.",
    where: "YouTube Studio → Analytics → Reach → 'Impressions click-through rate'",
    good:  "≥4-6% for Long-Form (niche-dependent); ≥8% for Shorts",
    bad:   "<2% (triggers 'Browse/Suggested sunset' — YouTube stops showing the thumbnail)",
    why:   "Impressions × CTR × AVD is the distribution formula. Sub-2% CTR tells YouTube the thumbnail/title doesn't work, and distribution is cut off within days.",
  },

  ytImpressions: {
    what:  "Number of times the thumbnail was shown to potential viewers on YouTube surfaces.",
    where: "YouTube Studio → Analytics → Reach → 'Impressions'",
    good:  "Growing or stable over time (algorithm is still pushing the video)",
    bad:   "Dropping rapidly after initial 48h (video is sunsetting)",
    why:   "The supply side of distribution. If impressions are high but CTR is low, it's a thumbnail problem. If impressions are dropping, the video is exiting algorithmic rotation entirely.",
  },

  // ─── X (Twitter) ─────────────────────────────────────────────────────────
  xTweepCred: {
    what:  "X's internal account trust score (0-100). A per-account throttle gate.",
    where: "Not directly visible in the UI. Premium subscribers see approximations via 'Account Health' metrics. Below 65 is hard-throttled.",
    good:  "≥65 (normal distribution)",
    bad:   "<65 (hard throttle — only 3 posts per refresh cycle are even considered for ranking)",
    why:   "Verified via the open-source X algorithm code. TweepCred is a gate — even your best post can't rank well if your account's TweepCred is below 0.65. It's cumulative based on account history.",
  },

  xReplyByAuthor: {
    what:  "Count of replies in the thread that the post author has actually engaged back with.",
    where: "Manual count — open the post's replies, count how many times the author has responded.",
    good:  "Author engages back on ≥50% of replies in the first hour",
    bad:   "Author doesn't engage at all",
    why:   "Answering replies keeps the conversation alive inside X's ~6-hour visibility window. Replies weigh +5 (≈7.6 likes) and replies from mutual follows +15 more in X's published Aug-2026 weights; the old +75 author-reply weight is retired.",
  },

  // ─── Override ────────────────────────────────────────────────────────────
  baselineMedianOverride: {
    what:  "Force a specific median view count as the creator baseline, instead of computing one from scraped history.",
    where: "Use when you know the creator better than the scraped data does — new account, recent account-wide pivot, or when private analytics show a different median than public view counts.",
    good:  "Provide the true median if the creator recently changed niche/format",
    bad:   "Don't use unless you have a specific reason — the computed baseline is usually more accurate",
    why:   "Skips the computed creator baseline entirely. All score multipliers apply to this number instead. Use sparingly — trust the data when possible.",
  },
};
