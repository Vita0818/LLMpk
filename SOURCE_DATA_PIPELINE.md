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
4. validates structure, provenance, target-model coverage, field types,
   row-count regressions, and cross-source freshness;
5. publishes the staged snapshots only if every check passes.

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

The official Design Arena API publishes the Models Arena Overall Frontend
leaderboard at /api/v1/leaderboard/models/codecategories. It reports model
name, provider, OpenRouter model ID where available, Elo, win rate, average
generation time, and leaderboard update time. The API requires a Bearer key
requested through https://www.designarena.ai/developers/apply.

The fetcher is ready as npm run refresh:design-arena. Set
DESIGNARENA_API_KEY in a local environment or secret manager before running
it; never place the key in the repository. The command validates the source
shape, category, row uniqueness, score ranges, and update time before
writing a snapshot. No Design Arena score enters the public ranking until
an authenticated source snapshot exists and exact model/profile links and
the new weighting version are reviewed.

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
