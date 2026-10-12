> Current scoring policy: [Registry v3.1](llm_pk_data_source_registry_v3_1.md), [Weights v3.1](llm_pk_domain_classification_weighting_v3_1.md), [Scoring v3.1](llm_pk_scoring_methodology_v3_1.md). Earlier source captures below remain historical provenance.

## October 3 scoring migration

The reader inventory is successor-pruned to 30 families / 40 configurations,
with all historical comparator pins removed. Raw historical source cards stay
available; local synchronization removes retired built-in boxes and preserves
user drafts. Inventory membership is reviewed separately from scoring, so
changing weights cannot silently expand the default model pool.

The new domains are Chatting, Reasoning, Coding, Frontend, Agentic and Documents.
AA capability scoring uses only HLE, CritPt, TB4 and GDP.pdf; legacy evaluation
records are detail-only. Each domain needs 60% real weighted coverage, all six
must qualify, and overall coverage must reach 75%. Missing scores are null.

The full staged refresh now includes FrontierCode before cross-source validation.
`npm run refresh:frontiercode` also captures the official current 1.1 Main JSON,
including exact efforts/harnesses, source hash and raw snapshot path. Current
Cognition rows supersede rounded September static evidence when exact identities
match. Other versions and environments do not borrow these rows.

`npm run refresh:design-arena` uses the dedicated
LLMPK_OPENROUTER_BENCHMARK_API_KEY from .env.benchmarks.local to read the
official DesignArena Models Arena / codecategories data through OpenRouter.
The October 8 capture retains 149 raw source configurations. Thirteen source
identities have been reviewed explicitly; twelve model families / twenty
existing configurations receive the Frontend metric. Undisclosed source
effort retains an authored Default-to-higher fallback. Same-ID XHigh and Max
records remain separate, and missing versions retain the missing 40% weight.

## October 11 subscription pricing review

`src/data/subscriptionPricing.ts` records nine exact plan/model allowances
from SemiAnalysis's October 5 public agentic-workload charts, reviewed on
October 11. Eight subscription variants of four existing models bring the
inventory to 48 configurations / 30 families, still 32 visible representatives.
Opus's two access variants are explicitly added to the DesignArena mapping
manifest (22 targets total); no benchmark results or missing efforts are inferred.

Fable's $2,485 net allowance is stored as a $4,970 full-plan basis × 50%,
applying its cap exactly once. Unmatched plans keep an explicit legacy-estimate
marker. These reviewed subscription measurements are independent of automatic
API/source refreshes. After editing the reviewed records, regenerate the public
snapshot and run the mapping, scoring, detail, playback and source tests.

# Source data refresh pipeline

The source refresh is intentionally separate from configuration matching,
domain composition, weights, and scoring. It copies published records without
calculating substitute benchmark values. The active registry now combines the
three bulk sources with five direct benchmark metrics published by four
benchmark-owner sites.

## Full refresh

```bash
npm run refresh:source-snapshots
```

The command:

1. fetches Artificial Analysis model, professional-evaluation, and Coding
   Agent records;
2. fetches all nine Arena leaderboard pages and extracts 13 metric tables;
3. fetches the OpenRouter model catalog and every available Standard endpoint
   performance row, including endpoint input/output prices, time to first
   token, output speed, and request counts;
4. when the dedicated benchmark key is configured, stages DesignArena and
   validates its source shape and every reviewed source configuration;
5. validates structure, provenance, target-model coverage, field types,
   row-count regressions, and cross-source freshness;
6. publishes the staged snapshots only if every check passes.

Failed runs remain under `.cache/oagxm-source-snapshots/<run-id>` for
inspection and do not replace the published files.

Snapshot refresh deliberately does not promote a model into the reader-facing
catalog. After reviewing the validation report, rebuild the source cards with:

```bash
npm run rebuild:source-catalog
```

The rebuild copies Artificial Analysis records, deduplicated Arena rows, and
OpenRouter catalog plus Standard-endpoint aggregates into `src/data/seedCards.ts`.
Versioned direct-leaderboard rows live separately in
`src/data/replacementBenchmarkSeedCards.ts`; rebuilding the bulk catalog does
not overwrite them.
Missing upstream values remain missing. The configuration curation layer then
admits only profiles that meet its capability-domain and evidence rules; run
`npm test`, the audit commands, and `npm run build` before publishing.

For OpenRouter, the raw provider-endpoint rows are kept intact. A second
`modelAggregates` layer summarizes every model across all accepted Standard
endpoints. Each of input price, output price, time to first token, and output
speed includes the arithmetic mean used by the source-card builder plus the
request-weighted mean, median, p25, p75, minimum, maximum, endpoint count, and
request count for audit. The latency statistic is necessarily a summary of
provider endpoint p50 values because OpenRouter does not expose request-level
samples from which a true global p50 could be recomputed.

## Direct benchmark replacements

The v1.2 registry also loads these publisher-owned leaderboards directly:

- Scale Labs EnigmaEval, updated 2026-07-23;
- Terminal-Bench-Science 0.1, released 2026-08-27;
- SWE-rebench v2, current scored window 2026-05-15 through 2026-07-01;
- Terminal-Bench 4.0, released 2026-08-28 and snapshotted 2026-09-04;
- Cognition FrontierCode 1.1 Main Pass Rate, released 2026-07-07 and
  snapshotted 2026-09-03.

These records retain the publisher URL, benchmark version or time window,
task count, trials, uncertainty kind, reasoning effort, and harness when the
source publishes them. They may be linked only to a compatible existing
three-part configuration; a leaderboard row never manufactures a new reader
configuration. Old HLE, GPQA Diamond, SciCode, Terminal-Bench v2.1, and AA
Coding Agent Terminal-Bench v2 rows remain raw historical evidence but are no
longer active scoring metrics.

## Published snapshots

- `src/data/artificialAnalysisSourceSnapshot.json`
- `src/data/arenaRawExtraction.json`
- `src/data/openRouterCatalogSnapshot.json`
- `src/data/openRouterPerformanceSnapshot.json`
- `src/data/designArenaSourceSnapshot.json` (when the dedicated key is configured)
- `src/data/sourceSnapshotValidationReport.json`

The raw AA and Arena HTML captures, SHA-256 hashes, response metadata, and run
manifest are retained under the run directory recorded in
`.cache/oagxm-source-snapshots/latest.json`.

## September 25 model refresh

The September 25 refresh adds source-backed GPT-6 Astra, Sol, and Luna;
Claude Opus 5.5; Grok 4.7; DeepSeek V4.1 Flash; MiMo-V2.6-Pro;
Step 5 Preview; Qwen3.8-2.4T-A95B; and the fixed Qwen3.8-Max 0902
snapshot. MiMo-V2.6-Flash is present in the source catalog and configuration
candidate set, but remains outside the scored reader inventory until an
independent capability observation is published. The reader-facing
Qwen3.8-Max configuration accepts only source rows explicitly identified as
0902; an unversioned Arena row and Qwen3.8 Max Prime are kept separate.

Artificial Analysis now publishes the model leaderboard under source-native
slugs rather than model UUIDs. Its Coding Agent page exposes only the current
top 20 rows; older rows remain in the snapshot with their original dates
where existing historical configurations still cite them. Current Coding
Agent DeepSWE v1.1 and Terminal-Bench 4.0 component results are not placed
into the older DeepSWE and Terminal-Bench v2 scoring slots. Arena's five
Agent signals are validated against the same active 43-model cohort.
OpenRouter's Standard history series now uses bare endpoint IDs and date-only
weekly buckets; the speed stabilizer accepts both the new and older shapes.

The current AA model table no longer exposes a raw GDPval-AA v2 Elo for the
active aa_gdpval_v2 metric. Its coverage is zero after this refresh. The
normalized AA field is retained in the raw snapshot but is not substituted
for the differently scaled Elo metric; choosing its replacement belongs to
the next metric-registry and weighting revision.

The AA refresh also captures GDP.pdf All-pass from the official evaluation
page and Terminal-Bench 4.0 from the official AA model table. Both are
source-visible, detail-only observations until the next scoring version
selects the active metrics and weights. The GDP.pdf page currently exposes
32 scored model rows in its initial public payload; missing rows remain
missing rather than inferred from its 183-model chart population.

## October 2 model refresh

The October 2 snapshot contains 689 AA model records, 87 Coding Agent
records (31 current and 56 retained historical executions), all 13 Arena
tables, 464 OpenRouter catalog routes, and Standard performance aggregates
for 410 models across 1,723 accepted endpoints. Cross-source validation
passes all 33 checks, including release-date coverage and the five measured
efforts for each new Sol and Sonnet family.

The reader inventory grows from 91 to 93 configurations; all 91 previous
configuration names remain present. GPT-6.1 Sol Max with Codex CLI and
Claude Sonnet 5.5 Max with Claude Code are newly admitted. Low, Medium,
High, XHigh, and Max model and CLI records remain individually addressable
in the candidate/source pool, while reader curation retains the strongest
measured production execution. Sonnet's ordinary AA model records retain
the publisher's Default Fallback disclosure. Current Coding Agent
DeepSWE v1.1 and Terminal-Bench 4.0 components do not fill older-version
scoring slots; the new configurations currently have three scored domains,
and missing domains remain missing.

MiMo-V2.6-Flash now has independent AA capability evidence. The existing
one-model-per-non-key-vendor policy still selects MiMo-V2.6-Pro for Xiaomi.
MiMo Pro keeps its reviewed Default API identity and explicitly links the
same OpenRouter Standard route's practical records after AA stopped
publishing its speed values. GPT-6.1 Sol Pro has its own scope and retains
catalog/practical evidence without borrowing ordinary Sol capability.

Gemini 4 Argon High is preserved as preview evidence in the source pool.
Google's [September 30 announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/)
restricts its current rollout to invited Fairwind participants, and AA marks
its Antigravity CLI execution unavailable. It remains outside the public
reader inventory until a public access route is published.

Two upstream transport changes are covered by extraction regressions:

- AA model options now reference a separate `releases` table through an
  explicit `releaseSlug`. The parser joins that relation to recover each
  effort's release date; it also accepts the older embedded identity shape.
  A missing release relation stays missing and is caught by validation.
- Arena renamed the Steerability score and CI fields to `steering_burden`.
  Both score extraction and scoring uncertainty accept the new and older
  keys without changing source scale or sign. The audit also handles the
  shared GPT-6 Sol/Luna announcement URL without letting Sol's name in the
  URL override Luna's exact row identity. The retired unversioned DeepSeek
  V4 Pro Agent row no longer supplies the Preview configuration's fallback.

The run's raw captures and refreshed manifest are recorded in
`.cache/oagxm-source-snapshots/latest.json`. Pre-refresh published data is
retained under `.cache/pre-refresh-2026-10-02/` for local comparison.

## Design Arena access

Run npm run refresh:design-arena with LLMPK_OPENROUTER_BENCHMARK_API_KEY in
.env.benchmarks.local or the process environment. The command calls the
OpenRouter Benchmark API with source=design-arena, arena=models and
category=codecategories; no separate DesignArena key is required. It retains
the complete raw response and publishes design-arena-source-snapshot/v2 only
after source validation and reviewed source-identity checks pass.

src/data/designArenaReviewedMappings.json is the admission manifest. Each
entry names the exact source model version and display identity, a versioned
OpenRouter base card, source effort disclosure, and unchanged target preset
identity. The frontend builder rechecks the pinned catalog version, product
line, model/profile/harness, and unique complete source row. A permaslug alone
is insufficient. The reviewed Muse Spark XHigh and Max rows have separate
source cards, and Max has no lower-profile target. Undisclosed effort uses
explicit Default fallback only for the authored target configurations.

Source API as-of time, capture time and unavailable leaderboard update time
are separate fields. Sample size, confidence bounds and per-row benchmark
or harness versions are not invented. The published all-zero tournament
counts remain raw metadata, not scoring sample counts. Task latency and API
pricing in these rows do not overwrite OpenRouter practical measurements.

With the dedicated key configured, the full source-refresh command stages
this snapshot alongside the other sources. Without the key, it preserves
the committed DesignArena capture. New source identities require a mapping
review, and a renamed, missing or duplicate reviewed identity fails refresh
without replacing the published snapshot. Use npm run test:design-arena to
check transport validation, version/effort isolation, target admission,
coverage and runtime fallback authorization.

## OpenRouter benchmark inspection

Added October 8, 2026. OpenRouter exposes its own GPQA Diamond, airline
tau-bench, BrowseComp, DeepSearchQA, search HLE, and WideSearch results through
`GET https://openrouter.ai/api/v1/benchmarks?source=openrouter&include_run_config=true`.
The authenticated endpoint uses a dedicated project key named
`LLMPK_OPENROUTER_BENCHMARK_API_KEY`; configure it in `.env.benchmarks.local`
or the process environment. This fetcher never falls back to `OPENROUTER_API_KEY`.
Only the dedicated variable is read from the local file, and the file is ignored
by Git. No key is written into a request URL, snapshot, or log.

`npm run refresh:openrouter-benchmarks -- --public-only` requires no key.
It reads the public `benchmark-leaderboard` and `search-benchmark-lanes`
export manifests and downloads their immutable dated JSON files. If a dated
file has a transport failure, the `latest.json` alias is accepted only when
its byte size and SHA-256 match the same dated manifest exactly. A checksum
failure never triggers that fallback. Citation, license, methodology, column
definitions, source fields, nulls, and the complete rows are retained.

The output remains diagnostic-only under
`.cache/oagxm-source-snapshots/openrouter-benchmarks/latest.snapshot.json`,
with raw files and manifests in a dated run directory. Override the output
with `LLMPK_OPENROUTER_BENCHMARK_SNAPSHOT_OUTPUT` if needed. The full scoring
refresh does not promote these observations into an existing metric slot.

The inspection enforces provider-level uniqueness for classic benchmarks and
the full model/engine/surface/turn-budget/effort grain for search. WideSearch's
`item_f1` is kept separate from strict whole-task `score`; other search suites
use `score` as the primary accuracy field. Export dates and benchmark run dates
are reported separately. `accuracy_std_dev` describes variation across runs,
not a confidence interval for the model's score. Task-generation time is not
TTFT, and per-task benchmark cost is not the token price used in practical scoring.

The classic exports omit reasoning effort and per-run harness versions. Search
exports retain effort and search settings but can contain old model versions
and null names. A current model route does not prove a version/effort/harness
match with a reader configuration. Published provider labels suggesting test
data are flagged for review and remain in the raw capture. No observation is
silently filtered, imputed, mapped to a successor, or assigned a scoring weight.

The official [Data API documentation](https://openrouter.ai/docs/cookbook/administration/data-api)
describes authentication and API score definitions. The public
[dataset README](https://openrouter.ai/api/v1/datasets/exports/README.md)
and each dated manifest define export schemas, aggregation, and attribution.
Exports are licensed under CC BY 4.0; preserve the returned attribution when
republishing them. The website's wider media/artifact benchmark catalog is not
an assertion that those datasets are available through this endpoint.

## Vals AI access

Added October 12, 2026. `npm run refresh:vals` reads the official Vals Index
and its eight standalone component pages. Each page identifies its public
JSON through `BenchmarkViewLoader`; the fetcher extracts this reference
without executing page scripts, requires the official `www.vals.ai` origin,
and validates the JSON's benchmark identity, model inventory, task tables,
dates, numeric ranges and nulls. No authentication is needed.

Complete JSON and HTML captures stay in a dated raw cache. The committed
`vals-source-snapshot/v1` keeps all task/category results and public metadata,
source and capture dates, settings, standard errors, costs, durations, token
totals, checksums and any refusal-fallback notices from the methodology page.
The capture contains nine benchmark views, 111 model/execution identifiers
and 8,819 observed result rows. Result-row counts are not sample counts.

`src/data/valsReviewedMappings.json` pins 24 source identities against fixed
catalog versions and 198 `overall` executions. Each execution pins benchmark
version, model ID, task, effort, harness, provider, output budget and sampling
settings. A changed/missing reviewed identity fails refresh without replacing
the published snapshot; new source models do not gain automatic mappings.
The full source-refresh command stages Vals alongside the other sources and
publishes only after the individual Vals checks and cross-source checks pass.

`src/data/valsSeedCards.ts` produces source cards and versioned observations,
then attaches authored evidence to existing reader configuration identities.
Unmapped rows stay in the snapshot. Unknown numerical efforts stay unlinked;
Muse Spark Max does not fill XHigh, and undated Qwen Max does not fill 0902.
Vals benchmark scaffolding remains its own environment in the public detail
data. Native source-card metadata is kept out of the public bundle; the public
snapshot includes only the small display evidence structure.

Vals Index and standalone results remain separate, including Code Migration's
index subset versus its full standalone task suite. Vals task cost and elapsed
time never overwrite API price, TTFT or throughput. Standard errors are not
converted into confidence intervals. V3.1 selects seven standalone Vals metrics,
bringing the weighted set to 26; the aggregate index and Vals TB4 stay references.
Reader admission remains a separate, explicit policy.

The page loader identifies the chart's refusal/fallback metadata module.
The fetcher parses its static literal declarations with `@babel/parser`, never
executing the upstream module. The module's checksum and raw capture are kept.
Metadata must match the published model/benchmark score. When fallback tasks
are disclosed, scoring uses the official `noFallbackScorePct`; it preserves
the published score and fallback/refusal counts. Unavailable metadata remains
unknown. The original-model score receives no invented or borrowed SE.

Environment overrides: `VALS_SNAPSHOT_OUTPUT` and `VALS_RAW_SNAPSHOT_DIR`.
Use `npm run test:vals` for source parsing, settings/version isolation,
missing/zero evidence, official refusal attribution, the public display contract
and v3.1 capability/coverage calculations.

## Individual commands

```bash
npm run refresh:artificial-analysis
npm run refresh:arena
npm run refresh:openrouter-catalog
npm run refresh:openrouter-performance
npm run validate:source-snapshots
```

The full refresh is the production path because it stages and atomically
publishes all sources together. Individual commands are useful for diagnostics.

## Current validation sentinels

The validator explicitly checks that these previously missed records exist:

- Kimi K3 model atomics and Kimi Code CLI row;
- GPT-5.4 with Codex;
- Claude Sonnet 4.6 with Claude Code;
- Claude Opus 4.6 with Claude Code;
- Kimi K2.6 with Claude Code.
- GPT-6 Astra, Sol, and Luna;
- GPT-6.1 Sol and Claude Sonnet 5.5 across all five measured efforts;
- Gemini 4 Argon and MiMo-V2.6-Flash capability records;
- Claude Opus 5.5 and Grok 4.7;
- DeepSeek V4.1 Flash, MiMo-V2.6-Pro, Step 5 Preview, Qwen3.8-Max 0902,
  and Qwen3.8-2.4T-A95B.

It also verifies that AA-Briefcase, AutomationBench-AA, Harvey LAB-AA, and
EnterpriseOps-Gym-AA are captured as independent source tables. These records
are not connected to scoring until the matching and metric-registry phase.
