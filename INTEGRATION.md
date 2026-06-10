# Skill ↔ Engine Integration

The **engine is the senses** (live ingestion: platform APIs, scrapers, creator
analytics, hourly velocity tracking). The **`platform-content-virality` skill
(v5.1) is the brain** (algorithm models, phase gates, formal math, calibration
protocol). This document is the operating manual for the wiring between them.

## Data flow

```
                       ┌────────────── THE SKILL (single source of truth) ─────────────┐
                       │  ~/.claude/skills/platform-content-virality/                  │
                       │  SKILL.md · references/algorithm-math.md · platform files     │
                       └──────────────────────────┬─────────────────────────────────────┘
                                                  │  npx tsx scripts/sync-knowledge.ts
                                                  ▼
                       src/lib/scoring/knowledge/{_meta,tiktok,instagram,youtube,
                                                  youtube_short,x}.json  (versioned)
                                                  │
 ENGINE SENSES                                    ▼
 YouTube API / TikWM / Apify ──┐    ┌──────────── SCORING CORE ────────────┐
 manualInputs (RM/OCR/CSV/mem) ─┼──► adapters.ts → canonical vars (+n)     │
 velocity cron (KV snapshots) ──┘    gates.ts    → Wilson verdicts         │
                                     composites.ts → phase-gated score     │
                                     waves.ts    → m̂ₖ, ceiling, horizons  │
                                     score.ts    → PREDICTION CONTRACT ────┼──► /api/score
                                     └─────────────────────────────────────┘      │
                                                  ▲                               ▼
                    KV skill-calibration:current  │            Video Report "Algorithm read" card
                                                  │            KV skill-score:{id} (+ ids index)
                       /api/calibration/run ──────┘                               │
                       (calibrate.ts: §4 logistic fit,        nightly outcomes ───┘
                        Brier + deciles, 50-post backtest)    (collect-outcomes cron)
```

## Module map

| File | Role |
|---|---|
| `scripts/sync-knowledge.ts` | Parses skill MD → `knowledge/*.json`. Fails loudly on unparseable anchors. |
| `src/lib/scoring/canon.ts` | Canonical types (`Rate{value,n}`), knowledge loader, staleness math, contract types. |
| `src/lib/scoring/math.ts` | §6 helpers verbatim: `wilsonLb shrink waveCeiling xScore linkedinCommentValue googleCitationP xTotalExposure brier sigmoid`. |
| `src/lib/scoring/composites.ts` | The four phase-gated composites verbatim, weights injected from knowledge. |
| `src/lib/scoring/adapters.ts` | Raw payload + creator analytics + velocity → canonical variables. Missing = `null`, never 0. |
| `src/lib/scoring/gates.ts` | Wilson-bounded verdicts; **n < 100 ⇒ `insufficient_evidence`** (Rule 9). |
| `src/lib/scoring/waves.ts` | m̂ₖ = Δₖ/Rₖ₋₁ from ≥12h snapshot buckets; ceiling N₀/(1−m̂); horizon projections (X = decay integral). |
| `src/lib/scoring/score.ts` | Orchestrator → the JSON contract; prior vs calibrated probability. |
| `src/lib/scoring/calibrate.ts` | §4 protocol: label 10×-median, logistic on z-scores (IRLS), Brier + decile reliability, backtest gate. |
| `/api/score` | POST → contract; persists `skill-score:{id}` for the calibration dataset. |
| `/api/calibration/run` | GET status · POST run (adopts only when backtest beats frozen). Trust Center has the button. |
| `scripts/test-scoring.ts` | The 6 acceptance tests + worked-example anchors. Run: `npx tsx scripts/test-scoring.ts`. |

## Field map (raw → canonical §1.1)

| Canonical | TikTok | Instagram | YouTube LF | YT Shorts | X | n |
|---|---|---|---|---|---|---|
| `C_comp` | `ttCompletionPct`/100 | — | — | `ytAVDpct`/100 (proxy, noted) | — | views |
| `H_3s` | — | `igHold3s`/100 | — | — | — | views |
| `R_loop` | `ttRewatchPct`/100 | manual | — | manual | — | views |
| `s` | TikWM `share_count/play_count` (exact) | shares/views | — | shares/views | (reposts+quotes)/views | views |
| `save_rate` | TikWM `collect_count/play_count` | `igSaves/igReach` | — | — | bookmarks/views | views/reach |
| `SPR` | — | `igSends/igReach` | — | — | — | igReach |
| `CTR` | — | — | `ytCTRpct`/100 | AI thumbnail est. (flagged) | — | `ytImpressions` (true n) else views |
| `AVD` | — | — | `ytAVDpct`/100 | — | — | views |
| `v₁` (e_1hr) | ≤90min snapshot ÷ followers | same | same | same | first-hour rate | snapshot views |
| `V_vs`, `R_30s`, hook_2s | **no public source → null → insufficient_evidence** | | | | | |
| X counts | — | — | — | — | likes/reposts/replies/quotes/bookmarks public; author-replied/dwell/mute/report **null** (caveated) | impressions=views |
| `TweepCred` | — | — | — | — | `xTweepCred` (manual) | — |
| us/global fork | TikWM `region` | — | — | — | — | — |
| Wave snapshots | `velocity:{id}` KV series, views-as-reach proxy (caveated) | | | | | exact |

**Hard rules enforced in code:** every rate ships its `n`; missing data is
`null`; no gate verdict below n≈100; dashboard-sourced rates get n = views at
scoring time; AI-estimated inputs are flagged in caveats.

## Re-sync after a skill update (Mode 7 sweep)

```bash
# 1. Update the skill (its own Mode 7 sweep edits the reference files)
# 2. Re-sync — zero engine code changes:
npx tsx scripts/sync-knowledge.ts          # default SKILL_DIR=~/.claude/skills/platform-content-virality
# or: SKILL_DIR=/path/to/skill npx tsx scripts/sync-knowledge.ts
# 3. Sanity: npx tsx scripts/test-scoring.ts   (worked-example anchors must hold)
# 4. Commit the regenerated src/lib/scoring/knowledge/*.json and deploy.
```

Staleness: when the skill's calibration stamp exceeds 60 days (Domain A), the
sync warns and **every contract carries a stale-knowledge caveat** until you
sweep + re-sync.

## Running calibration (§4)

- **Trust Center → "Probability calibration" → Run calibration** (or
  `POST /api/calibration/run`, optional body `{"viralMultiple": 10}`).
- Dataset: persisted `skill-score:*` contracts joined with matured outcomes
  (≥30 days of life) from the nightly collect-outcomes cron. Label:
  `actual > multiple × channel median`.
- The candidate fit is adopted **only** when its Brier on the held-out most
  recent ≤50 posts beats the frozen probabilities. Until first adoption every
  contract says **"prior — uncalibrated"**.
- Provenance: adopted/rejected runs append to KV `skill-calibration:history`;
  knowledge sync events live in `src/lib/scoring/knowledge/weights-history.jsonl`.
- Brier target ≤ 0.18; decile reliability is shown in the Trust Center.

## Known limitations (deliberate)

- LinkedIn + Google models are ported and acceptance-tested for math parity
  (`linkedinCommentValue`, `googleCitationP`) but have **no adapters** —
  LinkedIn is scoped out of the engine; no Google ingestion exists.
- FirstPromoter is not ingested yet; the calibration dataset is the engine's
  own snapshot/outcome store (same §4 semantics). Adding FirstPromoter later
  only requires another adapter + the same `skill-score` persistence.
- Per-niche (μ,σ) z-scoring: the calibration job currently standardizes
  against the calibration dataset itself (platform-level). Niche-level tables
  become meaningful once per-niche sample sizes justify them.
