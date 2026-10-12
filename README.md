# LLMpk

LLMpk is a configuration-level LLM leaderboard that combines Chatting, Reasoning, Coding, Frontend, Agentic, Documents, pricing, and latency observations from multiple
public benchmark sources.

## Local development

```bash
npm ci
npm run dev
```

The development server is available at `http://localhost:5173/`.

Recording playback is enabled for local development and local builds. Set
`VITE_ENABLE_PLAY_MODE=false` to produce the public-reader build without the
playback controls.

## Validation

```bash
npm test
npm run build
```

## Deployment

Pushes to `main` are tested, built, and deployed to GitHub Pages by
`.github/workflows/deploy-pages.yml`. The workflow explicitly disables the
local-only recording playback feature while publishing the same current data.

The production site is expected at:

<https://vita0818.github.io/LLMpk/>

## Current scoring policy

The reviewed successor-pruned inventory contains 30 model families / 48 configurations.
The reader view folds equivalent model/harness/radar access routes, preferring
the highest subscription tier. Its table and all selectors share the same 32
visible configurations; the complete scoring inventory stays available internally.
Scoring v3.1 uses 26 metrics, including seven standalone Vals benchmarks, and
requires every domain to reach 60% weighted observed evidence and
at least 75% overall coverage before assigning a total or rank. Missing
observations are null; insufficient configurations remain inspectable.

- [Scoring v3.1](llm_pk_scoring_methodology_v3_1.md)
- [Domain weights v3.1](llm_pk_domain_classification_weighting_v3_1.md)
- [Source registry v3.1](llm_pk_data_source_registry_v3_1.md)

Refresh the current FrontierCode 1.1 Main evidence with `npm run refresh:frontiercode`.
DesignArena Overall Frontend is sourced through OpenRouter's authenticated
Benchmark API and connected through an explicit, reviewed mapping manifest.
The October 8 capture links 12 current model families / 22 configurations,
including two explicitly reviewed Opus subscription variants added October 11.
Undisclosed effort keeps its Default fallback; missing versions stay missing.

```bash
npm run refresh:design-arena
```

This uses `LLMPK_OPENROUTER_BENCHMARK_API_KEY` from `.env.benchmarks.local`.
Source refresh updates published values only after the reviewed identities
validate. New model or profile links must be authored in
`src/data/designArenaReviewedMappings.json`; they are not inferred from a
model ID or selected by highest Elo.

## Vals AI evidence and scoring

Vals AI is available in the source-card pool and in an expandable section on
configuration and comparison details. The October 12 capture contains the
Vals Index 2.1 and eight standalone components: Finance Agent v2, Excel
Modeling, Vibe Code Bench 1.1, Code Migration, Terminal-Bench 4.0, Legal
Research, Harvey HLAB, and Tax Agent Bench. Their source update dates are
October 7–8. Seven standalone tasks participate in v3.1; Vals Index and Vals
Terminal-Bench remain references to avoid duplicate aggregation and task weighting.

```bash
npm run refresh:vals
npm run test:vals
```

The fetcher follows each official page's `BenchmarkViewLoader` JSON reference;
no API key is required. It retains all published task/category rows, source
dates, settings, standard errors, task costs, durations, raw-file paths and
SHA-256 hashes. `src/data/valsReviewedMappings.json` pins the admitted model
version and each benchmark's actual execution settings. Changed or missing
reviewed executions fail refresh before the published snapshot is replaced.

The capture has 111 source model/execution identifiers and 8,819 result rows.
Reviewed mappings produce 198 cards from 24 source identities, including a
separate, unlinked Muse Spark Max identity. Source evidence attaches
to 39 existing configurations. The reader inventory remains 30 model product
lines / 48 configurations / 32 visible representatives.

The detail section displays source effort, benchmark environment, standard
error, update date and published versus original-model scores. Vals runs retain their own execution identity;
OpenHands results are not relabelled as Claude Code or Codex measurements.
The standalone Code Migration run remains separate from the Vals Index's
smaller migration subset. Official refusal/fallback statistics are parsed as
static data from the chart module, without executing it. Disclosed fallback
tasks use Vals' published `noFallbackScorePct` (fallback tasks count as failures);
the original published result and fallback count remain visible. Missing
metadata is marked unknown. The cleaned result does not reuse a mixed run's
standard error. Task cost/duration do not enter API pricing,
TTFT or throughput. Unordered effort and missing dated model versions remain
unlinked where no reviewed profile/version match exists.

## Subscription pricing

The October 11 review uses [SemiAnalysis's October subscription tests](https://newsletter.semianalysis.com/p/anthropic-subscriptions-offer-5x)
for nine exact plan/model combinations across GPT-6.1 Sol, GPT-6 Astra,
Claude Opus 5.5, Sonnet 5.5, and Fable 5.1. The reviewed values and chart
references live in `src/data/subscriptionPricing.ts`; they do not refresh
automatically with API prices or transfer to successor models.

API Equivalent displays the usable monthly allowance. Fable's $2,485 already
includes its 50% cap. Cost scoring maps the measured agentic discount to the
site's standard API scenario, assuming full utilization; this is an estimate
for that scenario, not a guaranteed allowance. Unmatched legacy estimates
retain their old values and display `≈`. See the [source registry](llm_pk_data_source_registry_v3.md)
for the complete reviewed table and limitations.

## OpenRouter benchmark inspection

```bash
npm run refresh:openrouter-benchmarks -- --public-only
```

This captures OpenRouter's public GPQA / tau-bench provider leaderboard and
web-search configurations. It checks the dated manifests, byte sizes, SHA-256
hashes, configuration uniqueness, score definitions, and actual run timestamps.
The diagnostic snapshot is saved to
`.cache/oagxm-source-snapshots/openrouter-benchmarks/latest.snapshot.json`.
It is independent of the scoring snapshots and reader inventory.

For the authenticated `GET /api/v1/benchmarks?source=openrouter` endpoint,
copy `.env.example` to `.env.benchmarks.local` and set the dedicated
`LLMPK_OPENROUTER_BENCHMARK_API_KEY`. The fetcher reads only that named key
from the file or process environment; `OPENROUTER_API_KEY` is never used.
The local file is ignored by Git and its values are not exported into the
environment or included in snapshots.

```bash
npm run refresh:openrouter-benchmarks -- --api-only
# With a dedicated key configured, inspect both the API and public exports:
npm run refresh:openrouter-benchmarks
npm run test:openrouter-benchmarks
```

API responses preserve citation metadata and published search run settings.
The public export keeps all provider and search configurations; an API response
is not assumed to be an exhaustive inventory. See
[the pipeline notes](SOURCE_DATA_PIPELINE.md#openrouter-benchmark-inspection)
for source semantics and integration limits.
