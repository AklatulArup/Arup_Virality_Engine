@AGENTS.md

# FundedNext Virality Engine

This repo is an internal tool used by FundedNext's Relationship Management (RM) and Partnerships team. It takes a URL from any major short/long video platform (YouTube, TikTok, Instagram Reels, X/Twitter), pulls public data, and produces a Bayesian-blended forecast for expected views with a learning loop that improves itself from outcomes over time.

Primary users: FundedNext RM team. Terminology convention: use "RM" / "RM team", never "BD". Plain English throughout, no algorithmic jargon.

**Supported platforms: YouTube Long-Form, YouTube Shorts, TikTok, Instagram Reels, X.** LinkedIn was scoped out and removed from all code paths — do not re-add LinkedIn as a platform option, URL parser case, algorithm-intel entry, competitor handle, or anywhere else. LinkedIn URLs inside scraped video `description` text are legitimate creator data and preserved as-is.

Live deployment: https://virality-engin.vercel.app
GitHub: https://github.com/AklatulArup/Arup_Virality_Engine
Hosting: Vercel Hobby tier (one cron per day max — relevant to anything scheduled)

## Quick architecture map

Framework: Next.js 16 (Turbopack, React 19, React Compiler active). App router. Tailwind. TypeScript strict.

Persistent state: Upstash Redis via Vercel Marketplace integration. All env vars prefixed `KV_*`. There is a safe wrapper at `src/lib/kv.ts` that no-ops gracefully if env vars are missing.

External APIs:
- YouTube Data API (videos, channels, comments — `YOUTUBE_API_KEY`, `YOUTUBE_API_KEY_2` fallback)
- Apify (TikTok, Instagram, X scrapers). Tokens resolve through `src/lib/apify-token.ts` — set the canonical all-caps names `TIKTOK_API_KEY` / `INSTAGRAM_API_KEY` / `APIFY_TOKEN_TWITTER`, or the shared `APIFY_TOKEN`. Legacy mixed-case aliases (`TikTok_API_Key`, `Instagram_API_KEY_2`, `Instagram_API_Key`) are still accepted but discouraged — env var names are case-sensitive, so prefer the canonical names.
- TikWM (`src/lib/tikwm.ts`, keyless) — PRIMARY source for TikTok single-video URLs inside `/api/tiktok/scrape`: exact counters (`play_count` etc., vs Apify's UI-rounded numbers) + saves/duration/sound in ~2s. Profile scrapes stay on Apify (TikWM's feed endpoint is Cloudflare-challenged). Any TikWM failure falls back to Apify automatically; the key-health panel surfaces reachability. Requests need the browser User-Agent already set in the lib.
- Google Gemini (war room, sentiment, thumbnail/hook/OCR vision). Multi-key rotation via `src/lib/gemini-keys.ts`: `GEMINI_API_KEY` + `GEMINI_API_KEY_2..5` (each free key adds ~1,500 req/day). All Gemini callers — including `claude-verdict` and `health` — now go through the rotation helper.
- Groq (sentiment fallback when every Gemini key is exhausted — `GROQ_API_KEY`)
- Anthropic Claude (fallback AI — `Claude_AI_Summary_API_KEY` / `ANTHROPIC_API_KEY`)
- GNews (market volatility signal — `GNEWS_API_KEY`, then `GNEWS_API` / `NEWS_API_KEY`; silently degrades to free Google News RSS if unset)
- Upstash Redis / KV (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)

Crons (Vercel Hobby = once-daily limit):
- `/api/cron/collect-outcomes` — 4am UTC (Vercel). Re-scrapes mature videos (platform-specific maturity: X=3d, TikTok=30d, IG=35d, YT=90d). Records actual views against stored predictions.
- `/api/cron/track-velocity` — Vercel runs it once daily at 5:30am UTC as a safety net; the real cadence comes from the GitHub Actions workflow at `.github/workflows/track-velocity.yml`, which pings hourly at :05. This gives us the 1h/3h/6h/12h/24h/48h/72h samples the endpoint's schedule already defines. Hobby tier doesn't allow sub-daily Vercel crons, so GH Actions is the workaround. Requires repo secret `CRON_SECRET` (same value as Vercel env var).

CRON_SECRET gates both cron endpoints, and the check now FAILS CLOSED: if `CRON_SECRET` is unset the endpoints reject every request with 401 (previously an unset secret skipped the check, leaving them publicly callable). It must be set on Vercel AND match the GitHub Actions repo secret used by the hourly velocity workflow.

## Core files to know

**The forecast engine** — `src/lib/forecast.ts`
Single source of truth for view predictions. Exports `forecast()` and `projectAtDate()`. Composes tuning overrides from KV onto `PLATFORM_CONFIG` at request time. Inputs: video, creator history, platform, optional private analytics (Instagram saves, TikTok completion %, YouTube AVD/CTR), velocity samples, seasonality multiplier, sentiment score, niche multiplier, config overrides. Output: Bayesian blend of prior (score × baseline) and observed trajectory.

**The panel that renders the forecast** — `src/components/ForecastPanel.tsx`
Auto-fetches velocity samples, market volatility, YouTube comment sentiment (YT/YTS only), and applied tuning overrides. Contains the Custom Date Projection and the Forecast Log tab.

**The dashboard** — `src/components/Dashboard.tsx`
The entry point — sidebar, input tabs per platform, reference store integration, result display. ~2300 lines. The Pool Coverage panel lives here around line 1910.

**The learning loop** — `src/lib/forecast-learning.ts`
Two exported functions: `computeCalibration()` (browser, reads localStorage) and `computeCalibrationFrom(snapshots[])` (pure, used server-side by the calibration API). MdAPE, coverage, direction accuracy, bias.

**Other key libraries:**
- `src/lib/thumbnail-ctr-predictor.ts` — Gemini Vision scorer for YouTube / Shorts thumbnails. Scores against a 20-point checklist (from `thumbnail-deep-analysis.md`) and maps the score to an estimated CTR %. Called by `/api/thumbnail/score?url=...`, which KV-caches results by URL hash. The forecast engine consumes the estimate by auto-filling `manualInputs.ytCTRpct` — but the ForecastPanel tracks the key in `aiEstimatedKeys`, which is threaded through `forecast()` so confidence scoring doesn't count AI estimates as "real data" and the memory endpoint doesn't persist them.
- `src/lib/hook-strength-predictor.ts` — Gemini Vision scorer for TikTok / Instagram Reels covers. Evaluates first-frame + caption against the 5 hook formulas (contradiction / delayed-reveal / question / data / pattern-interrupt) plus visual stop-power + text-overlay clarity. Maps to `ttCompletionPct` (TikTok, 70% viral-gate targeted) or `igHold3s` (Instagram, 60% audition-gate targeted). Called by `/api/hook/score?url=...&platform=&caption=`, KV-cached by (url|caption-hash|platform). Same `aiEstimatedKeys` discipline as the thumbnail predictor.
- `src/lib/reputation.ts` — creator-level multiplier on baseline from local signals (engagement-rate trend recent-vs-early, recency of last post, baseline CV). Clamped [0.70, 1.25]. Threaded into `forecast()` alongside seasonality + niche multipliers as `reputationMultiplier`. No network calls — pure compute from `creatorHistory`.
- `src/lib/lifecycle-tier.ts` — short-form distribution-tier classifier. `classifyLifecycleTier()` takes `(platform, currentViews, ageHours, velocitySamples)` and returns one of `tier-1-hook / tier-1-stuck / tier-2-rising / tier-2-stuck / tier-3-viral / tier-4-plateau / not-applicable`. Only applies to TikTok/IG/Shorts (X is time-decay, YT LF is evergreen). `applyTierCeiling()` is called inside `forecast()` after the trajectory blend and conformal step — clamps `lifetime.high` **down** when the tier implies the distribution has capped (stuck or plateau). Never raises the forecast. The hourly velocity workflow from `.github/workflows/track-velocity.yml` is what feeds this with sufficient signal to distinguish stuck vs rising tier states.
- `src/lib/conformal.ts` — empirical quantile intervals. Computes `ConformalTable` from the snapshot pool; `applyConformalBounds()` is called inside `forecast()` to replace the hand-tuned upside/downside bands with residual-derived quantiles when a matching (platform × score-band) stratum has ≥20 samples. Falls through to the hand-tuned bands when data is thin — zero-regression. Persisted to KV at `config:conformal-quantiles`.
- `src/lib/decay-fit.ts` — learned cumulative-share (decay) curves. Fits per-platform "what fraction of lifetime views by day N" from matured outcomes joined with velocity tracks; persisted to KV at `config:decay-curves`. `forecast()` uses the fitted curve (via the `shareAt` helper) when a platform has ≥15 matured videos, else the hand-tuned `lerpShare` knots — zero regression. Recomputed in `collect-outcomes` alongside conformal. An empirical measured curve, not a model. Endpoint: `/api/forecast/decay` (GET table, POST `recompute`/`clear`).
- `src/lib/apify-token.ts` — single source of truth for the Apify token per platform (canonical all-caps + legacy mixed-case + shared `APIFY_TOKEN`); used by every TikTok/IG/X scrape + comments route.
- `src/lib/analytics-ocr.ts` — Gemini Vision wrapper that parses a Creator Studio / Insights / YT Studio / X Premium screenshot into `Partial<ManualInputs>`. Called by `/api/analytics/ocr`. Uses `gemini-2.0-flash` with `responseMimeType: application/json`. Refuses to invent numbers — if a field isn't clearly visible it's omitted.
- `src/lib/analytics-memory.ts` — per-creator KV memory of last-submitted `ManualInputs`. Keyed `creator-analytics:<platform>:<handle-normalized>`. Loaded on mount in `ForecastPanel` (pre-fills empty fields only — never clobbers RM input), saved on change (debounced 1.5s).
- `src/lib/seasonality.ts` — day-of-week + market volatility
- `src/lib/niche-classifier.ts` — 7 niches, keyword-based (prop-trading, crypto-trader, forex-specialist, options-trader, lifestyle-trader, general-finance, non-finance)
- `src/lib/reference-store.ts` — builds ReferenceEntry objects; `buildEntryFromVideo()` is used by every platform's analyze flow to ingest the full fetched history into the pool
- `src/lib/kv.ts` — Upstash Redis wrapper with safe no-ops, namespaced keys `fn:virality:*`
- `src/lib/psychology.ts`, `src/lib/trend-intelligence.ts`, `src/lib/x-adapter.ts`

## API endpoints worth knowing

Under `/api/`:

- `analyze?url=<youtube-url>` — main YouTube analyzer
- `tiktok/scrape` / `instagram/scrape` / `x/scrape` — Apify-backed batch scrapers
- `youtube/comments?videoId=...` — YouTube Data API comments fetcher (for sentiment)
- `reference-store` — pool entries (GET list, POST add)
- `forecast/snapshot` — persists every forecast to KV (POST from client, used by calibration)
- `forecast/calibration` — computes MdAPE from stored snapshots + outcomes
- `forecast/velocity?videoId=...` — reads velocity samples for a video
- `forecast/sentiment` — Gemini-backed comment sentiment classifier
- `forecast/tuning` — GET applied overrides, POST `apply`/`reject`/`revert`/`clear-all`
- `forecast/conformal` — GET current conformal quantile table, POST `recompute` or `clear`. Recomputed automatically at the end of `collect-outcomes` whenever new outcomes land.
- `forecast/log` — manual prediction records (GET list, POST new, DELETE by id)
- `thumbnail/score` — GET `?url=<thumbnail-url>` → `{ score: { totalPoints, estimatedCTR, ctrConfidence, perCriterion[], rationale } }`. Fetches the image server-side, calls Gemini Vision on the 20-point checklist, KV-caches by URL hash.
- `hook/score` — GET `?url=<cover-url>&platform=<tiktok|instagram>&caption=<text>` → `{ score: { totalPoints, dominantFormula, matches[], estimatedCompletionPct, estimatedHold3sPct, ... } }`. Short-form first-frame + caption scorer. KV-cached by (url | caption hash | platform).
- `forecast/tier-stats` — GET → tier distribution counts per platform from persisted snapshots. Used by the admin observability panel.
- `analytics/ocr` — POST `{ imageBase64, mimeType }` → `{ extraction: { fields, detectedPlatform, summary, warnings } }`. Calls Gemini Vision to parse a creator-studio screenshot. Max image 6MB base64.
- `analytics/memory` — per-creator memory of `ManualInputs`. `GET ?platform=&handle=` returns the record; `POST { platform, handle, inputs, sourceVideoId?, source? }` merges non-null fields and persists.
- `cron/collect-outcomes` / `cron/track-velocity` — the two Vercel crons

## The learning loop end-to-end

1. Every forecast the engine produces POSTs to `/api/forecast/snapshot` and lands in Redis with full context
2. Every analyze flow also dumps the creator's full fetched history into `/api/reference-store` — Pool Coverage panel ticks up live
3. Nightly 4am UTC cron re-scrapes mature videos, records actual view counts on the same snapshot
4. Hourly (daily on Hobby) cron samples velocity at platform milestones
5. `/admin/calibration` reads all snapshots with outcomes, computes MdAPE per platform / per score band / per age band, shows worst 5 predictions
6. When sample size >= 20 per platform, `suggestAdjustments()` proposes tuning overrides
7. RM clicks Apply on the admin page -> override persists to `config:tuning-overrides` in Redis
8. ForecastPanel fetches overrides on mount, threads them through `forecast(input.configOverrides)`
9. `forecast()` composes override onto `PLATFORM_CONFIG[platform]` before running

Override-able parameters: `upsideMultiplier`, `downsideMultiplier`, `scoreExponent`, `minBaselinePosts`.

**Conformal intervals (parallel track to tuning overrides):** when `collect-outcomes` records a new outcome it also calls `recomputeConformalTable()` from `src/lib/conformal.ts` → writes `config:conformal-quantiles` to KV. ForecastPanel fetches this on mount and passes it to `forecast()`. Inside `forecast()`, after the trajectory blend, `applyConformalBounds()` replaces `lifetime.low/high` with empirical residual quantiles **only if** the stratum (platform × score-band, or platform-pooled fallback) has ≥20 samples. Otherwise the hand-tuned bands survive untouched. The median is never modified — conformal only recalibrates uncertainty.

## Deployment notes

Build fails on Hobby if any cron uses more-frequent-than-daily expressions. Build fails on any ESLint error (warnings are fine). Always run `npx eslint src/` before pushing, not just `tsc --noEmit` — React Compiler rules `react-hooks/purity` and `react-hooks/set-state-in-effect` catch patterns that TypeScript doesn't.

Common patterns to use eslint-disable-next-line for:
- `react-hooks/purity` when using `Date.now()` or `Math.random()` intentionally during render
- `react-hooks/set-state-in-effect` when the effect's purpose IS to sync state from an external source (e.g. loading from API on mount)

JSX string literals with apostrophes or quotes need to be escaped: `don&apos;t`, `&ldquo;quoted&rdquo;`.

## Styling conventions

Dark theme throughout. Colors:
- Background: `#0A0A08` (page), `rgba(0,0,0,0.22)` (raised surfaces)
- Text: `#E8E6E1` (primary), `#B8B6B1` (secondary), `#8A8883` (muted), `#6B6964` (labels), `#5E5A57` (tertiary hint)
- Accent: `#A78BFA` (purple — forecast/admin), `#2ECC8A` (green — positive/done), `#60A5FA` (blue — info), `#F59E0B` (amber — warning/minimum), `#FF6B7A` (red — error/negative), `#FFD54F` (yellow — highlight)
- Per-platform: YouTube `#EF4444`, YouTube Shorts `#EC4899`, Instagram `#E879F9`, TikTok `#06B6D4`, X `#9CA3AF`

Fonts: `IBM Plex Sans` (body) and `IBM Plex Mono` (labels, numbers, technical data). The font loader occasionally fails in sandboxed build environments; Vercel handles this fine.

Uppercase + letter-spacing 0.08-0.12em for eyebrow labels. Numbers are almost always mono.

## Working conventions

- Commits: descriptive subject + substantive body explaining what changed and why. Multi-paragraph bodies are normal for this repo.
- When adding a new data-carrying field anywhere, thread it end-to-end: type definition, input builder, forecast consumer, UI display. Don't orphan fields.
- Before claiming anything "works" or "is live", verify the commit shows green CI on GitHub (green tick 1/1) and Vercel's Deployments tab shows `Ready` for the right commit hash. Hobby-tier crons and ESLint errors are the two most common build blockers.

## Known limitations / open items

- TikTok and Instagram comment sentiment not wired — requires TikTok Research API approval (1-4 weeks) and IG Graph API business auth flow. Only YouTube sentiment is live.
- Direct pull of private creator analytics (TikTok Research API, IG Graph API, YouTube Analytics API OAuth) is NOT yet wired — all external-analytics APIs are approval-gated (1-4wk each). Interim workaround is the screenshot-OCR + per-creator memory flow at `src/lib/analytics-ocr.ts` + `src/lib/analytics-memory.ts`: RMs paste a Creator Studio screenshot and Gemini Vision fills the fields. When/if direct API access is approved, the memory endpoint is the correct place to write ingested values.
- The calibration page is empty until the first X posts mature (3 days from first forecast). TikTok/IG populate at 30d. YouTube at 90d.

## For RM-facing language

Never use: "BD team", "BD partner", algorithmic jargon like "C_comp", "H_3s", "R_loop", "Phase 1/2/3" labels. All team references are "RM" / "RM team". Plain English. Numbers and specifics over theory.
