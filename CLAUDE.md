@AGENTS.md

# FundedNext Virality Engine

This repo is an internal tool used by FundedNext's Relationship Management (RM) and Partnerships team. It takes a URL from any major short/long video platform (YouTube, TikTok, Instagram Reels, X/Twitter), pulls public data, and produces a Bayesian-blended forecast for expected views with a learning loop that improves itself from outcomes over time.

Primary users: FundedNext RM team. Terminology convention: use "RM" / "RM team", never "BD". Plain English throughout, no algorithmic jargon.

Live deployment: https://virality-engin.vercel.app
GitHub: https://github.com/AklatulArup/Arup_Virality_Engine
Hosting: Vercel Hobby tier (one cron per day max — relevant to anything scheduled)

## Quick architecture map

Framework: Next.js 16 (Turbopack, React 19, React Compiler active). App router. Tailwind. TypeScript strict.

Persistent state: Upstash Redis via Vercel Marketplace integration. All env vars prefixed `KV_*`. There is a safe wrapper at `src/lib/kv.ts` that no-ops gracefully if env vars are missing.

External APIs:
- YouTube Data API (videos, channels, comments)
- Apify (TikTok, Instagram, X scrapers — token env vars are `APIFY_TOKEN_TWITTER` plus fallbacks for `TikTok_API_Key` / `Instagram_API_Key` / canonical `APIFY_TOKEN`)
- Google Gemini (war room expert outputs, sentiment analysis — key `GEMINI_API_KEY` with `_2` fallback)
- Anthropic Claude (fallback AI — `Claude_AI_Summary_API_KEY` / `ANTHROPIC_API_KEY`)
- GNews (market volatility signal — key `GNEWS_API` with `GNEWS_API_KEY` fallback)

Crons (Vercel Hobby = once-daily limit):
- `/api/cron/collect-outcomes` — 4am UTC. Re-scrapes mature videos (platform-specific maturity: X=3d, TikTok=30d, IG=35d, YT=90d). Records actual views against stored predictions.
- `/api/cron/track-velocity` — 5:30am UTC. Samples views at 24h / 48h / 72h / 7d / 14d / 30d milestones. Originally hourly but downgraded to daily due to Hobby tier. For full hourly granularity, either upgrade to Pro or add a GitHub Actions workflow pinging the endpoint.

CRON_SECRET env var is set and checked by both cron endpoints (rejects unauthenticated pings with 401).

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
- `forecast/log` — manual prediction records (GET list, POST new, DELETE by id)
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

- Velocity tracker runs once daily (Hobby tier). Early-hour samples (1h/3h/6h/12h) are unavailable without GitHub Actions or Pro upgrade. Cost: ~5% of achievable MdAPE improvement on TikTok/IG for videos under 24h old.
- TikTok and Instagram comment sentiment not wired — requires TikTok Research API approval (1-4 weeks) and IG Graph API business auth flow. Only YouTube sentiment is live.
- The calibration page is empty until the first X posts mature (3 days from first forecast). TikTok/IG populate at 30d. YouTube at 90d.

## For RM-facing language

Never use: "BD team", "BD partner", algorithmic jargon like "C_comp", "H_3s", "R_loop", "Phase 1/2/3" labels. All team references are "RM" / "RM team". Plain English. Numbers and specifics over theory.
