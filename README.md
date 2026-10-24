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

The reviewed inventory contains 33 model families / 49 configurations after
successor pruning and the October 24 reader cleanup.
The reader view folds equivalent model/harness/radar access routes, preferring
the highest subscription tier. Its table and all selectors share the same 35
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
The October 24 capture retains 17 reviewed source rows; after cleanup it links
12 current model families / 21 configurations,
including dated Gemini 4 Argon and DeepSeek V4.1 Flash 1017 records.
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

Vals AI is available in the source-card pool and in the shared metric list on
configuration and comparison details. All nine metrics appear once, alongside
the other benchmarks, with the two non-scoring rows visibly marked as references.
Source links and execution conditions remain available on their rows; there is
no separate Vals accordion. The October 24 capture contains the
Vals Index 2.2 and eight standalone components: Finance Agent v2, Excel
Modeling, Vibe Code Bench 1.1, Code Migration, Terminal-Bench 4.0, Legal
Research, HLAB-Vals 1.1, and Tax Agent Bench. Their source update dates range
from October 18 to October 22. Seven standalone tasks participate in v3.1; Vals Index and Vals
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

The capture has 120 source model/execution identifiers and 6,673 result rows.
Reviewed mappings produce 259 cards from 33 source identities, including a
separate, unlinked Muse Spark Max identity. Source evidence attaches
to 39 existing configurations. The reader inventory contains 33 model product
lines / 49 configurations / 35 visible representatives. Index 2.2 and HLAB 1.1
publish smaller model sets; removed executions stay missing. HLAB 1.0 is not
used to backfill a missing 1.1 run, and the active metric pins its version
independently of the reviewed mapping manifest.

## October 24 model and source refresh

Kimi K3.1 Pro and DeepSeek V4.1 Flash 1017 supersede K3 and the September 10
Flash release in the reader inventory. Their historical raw records remain
available. MiniMax M3.1 Flash and Muse Spark Open are separate current lines;
the newly public Gemini 4 Argon API and independently observed MiMo-V2.6-Flash
also enter the reader view. MiMo Pro and Flash retain distinct Default
identities. Kimi K3.1 Pro has no reviewed Vals or Kimi Code execution yet.

The new DeepSeek execution uses the actual DeepSeek Harness; Spark Open uses
Muse Code XHigh. Neither borrows an older model's CLI or FrontierCode result.
Spark Open's Fireworks Max WebDev row cannot be used for XHigh. Newly
published Arena Text records now let Wonder and Haiku 5.5 qualify under the
unchanged six-domain and 75% overall coverage gates. Wonder Full stays
separate and retains its unknown subscription allowance. After the reader
cleanup, there are 20 ranked and 15 insufficient reader representatives.

The cleanup removes every shipped route of GPT-5.6 Terra, MiniMax M3,
Qwen3.7 Plus, Mistral Medium 3.5 and Muse Spark 1.3: five model families and
seven configurations. Spark 1.3 has an AA deprecated/successor record; the
other four are editorial inventory archives, not provider end-of-life claims.
Their raw records, reviewed source cards and historical candidates remain
available. Distinct budget lines such as Flash-Lite and Nemotron stay in the
reader inventory. The inventory version migrates installed built-in boxes;
unrelated user drafts remain intact. Weights and coverage gates are unchanged.

AA now sends a current-only `initialModels` transport. The fetcher joins it
to the complete public model comparison by exact slug and release date,
including the separately framed profile model. It retains the real source
page and native field path and rejects conflicting benchmark values. The
snapshot has 709 models and 101 coding-agent records; public creator/display
identities replace omitted internal host aliases without inventing them.

OpenRouter's `variant=standard` response also includes separately labelled
service tiers. The fetcher checks `service_tier`, `derived_service_tier`,
the provider route, and public availability. Flex, Priority and Highspeed
endpoints are excluded from the Standard aggregates, with rejection evidence
retained. The capture has 401 model aggregates from 1,561 accepted endpoints.
The public snapshot build fails if any reviewed configuration cannot install.
Run `npm run test:october24-models` for the release and source-boundary checks.

## October 13 model refresh

The current inventory adds Muse Wonder Max with Muse Code, Muse Wonder Full
Max through the Muse Code Maximum Usage subscription, Claude Haiku 5.5 Max
with Claude Code, and Mistral Large 4 Preview High through its public API.
Wonder and Wonder Full have separate model identities. Spark 1.3 and Mistral
Medium 3.5 remain distinct available product lines. Haiku 4.5 is superseded.

All four releases have nine explicitly reviewed Vals runs. Haiku and Mistral
also have dated DesignArena mappings; Haiku's five FrontierCode efforts retain
their actual Claude Code harness. No Devin Fusion multi-model score is assigned
to Haiku alone. Full's Vals identity is pinned to its AA model record and
October 12 release because no OpenRouter API route exists for that model.

Muse Code Maximum Usage is officially $200/month, but its API-equivalent
allowance is unpublished. The detail view shows the monthly price and an
unknown allowance; cost adjustment and practical score remain null. Wonder,
Wonder Full and Haiku still lack Arena Chatting evidence and receive no total
or rank under the existing coverage gates. Mistral Large 4 qualifies. The
reader inventory has 21 ranked and 15 insufficient representatives.

AA GDP.pdf's initial chart selects only 32 models. The official public model
comparison records provide 212 exact GDP.pdf scores, including the profile
model itself. The fetcher joins published slugs and release dates, rejects
conflicting overlap values, and records the actual comparison-page provenance.
This keeps chart selection from deleting valid measurements. LongCat's real
zero Terminal-Bench score and its published GDP.pdf result remain real data.

Arena Text/Search now use the `/leaderboard/chat/` paths. This refresh captured
the nine public pages' complete inline Flight data through the normal browser
after HTTP capture returned Cloudflare 403. Capture method, timestamps and
hashes are recorded separately. Arena's new `bash_reliability_no_prereq` is
not substituted for `bash_recovery_steps`; historical recovery evidence keeps
its October 2 dates. FrontierCode's unpublished flagging rates remain null
while its published pass rates remain usable. Scoring weights stay at v3.1.

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
