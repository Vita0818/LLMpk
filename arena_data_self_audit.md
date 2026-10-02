# Arena data self-audit

- Audit status: **VALIDATED**
- Audit status validates provenance, score integrity, and Arena reconciliation; it is not by itself a claim that every upstream source was fetched live in this run.
- Audit time: 2026-10-02T08:20:28.688Z
- Raw extraction: `src/data/arenaRawExtraction.json` (arena-raw-extraction/v1)
- Catalog: `src/data/seedCards.ts`
- Scope: `oagxm-current-product-lines` (oagxm-current-product-lines/v11-2026-10-02-releases)
- Catalog refresh status: **MIXED_SNAPSHOT_REBUILD**
- Catalog freshness disclosure: The catalog mixes direct raw extraction with official-source and/or verified-catalog snapshots. This audit validates provenance and reconciliation, not a fully live three-source refresh.

## OAGXM current-product scope

- Scope provenance findings: 0
- Product lines with no source record in this snapshot: 2
- General source-catalog records outside this curated scope: 1438 cards / 7658 observations; card and observation scopes still reconcile exactly.
- All 79 configured product lines are formal text/agent models; no image/audio/safety-only line is admitted to this capability scope.

## Arena per-metric reconciliation

The `source*` columns retain complete public-leaderboard extraction facts. The unprefixed columns are the explicit OAGXM scope admitted to the database and are the values compared for validation.

| Metric | sourceExtractedRowCount | sourceDuplicateRowCount | sourceUniqueModelCount | extractedRowCount | duplicateRowCount | uniqueModelCount | databaseAvailableCount | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| arena_text_instruction | 410 | 0 | 410 | 72 | 0 | 72 | 72 | VALID |
| arena_text_multiturn | 408 | 0 | 408 | 72 | 0 | 72 | 72 | VALID |
| arena_text_creative | 408 | 0 | 408 | 72 | 0 | 72 | 72 | VALID |
| arena_text_hard | 410 | 0 | 410 | 72 | 0 | 72 | 72 | VALID |
| arena_text_math | 395 | 0 | 395 | 71 | 0 | 71 | 71 | VALID |
| arena_text_coding | 405 | 0 | 405 | 72 | 0 | 72 | 72 | VALID |
| arena_code_webdev | 138 | 1 | 137 | 69 | 0 | 69 | 69 | VALID |
| arena_search | 34 | 0 | 34 | 10 | 0 | 10 | 10 | VALID |
| arena_agent_success | 48 | 0 | 48 | 44 | 0 | 44 | 44 | VALID |
| arena_agent_praise | 48 | 0 | 48 | 44 | 0 | 44 | 44 | VALID |
| arena_agent_steerability | 48 | 0 | 48 | 44 | 0 | 44 | 44 | VALID |
| arena_agent_bash_recovery | 48 | 0 | 48 | 44 | 0 | 44 | 44 | VALID |
| arena_agent_tool_hallucination | 48 | 0 | 48 | 44 | 0 | 44 | 44 | VALID |

Total effective Arena observations: 730; sum of 13 unique available counts: 730; conservation: PASS.

## Catalog provenance

- Cards: 1972 (AA 686, Arena 465, OpenRouter 821)
- Available observations: 11580 (AA 7091, Arena 2847, OpenRouter 1642)
- Provenance / source ownership findings: 0
- Unproven default 0 / 50 values: 0
- Full live three-source refresh: no
- Source input modes:
  - arena: official-arena-raw-extraction — 465 cards, 2847 available observations (direct_source_extraction)
  - artificial_analysis: official-aa-structured-snapshot — 686 cards, 7091 available observations (official_source_snapshot)
  - openrouter: 3d/1w stabilized endpoint medians, followed by an equal-weight mean across current OpenRouter Standard endpoints; raw current rows, auxiliary traffic-weighted mean, median, quartiles, and range retained in the verified snapshot — 398 cards, 796 available observations (official_source_snapshot)
  - openrouter: official-openrouter-local-snapshot — 423 cards, 846 available observations (official_source_snapshot)

## Integrity checks

- Local generated score code in production paths: none found
- Missing metric treated as 50: not found
- Radar missing domain rendered as 50: not found
- Array-position mismatch: not found

## Verdict

VALIDATED — every available catalog observation has verified source provenance; all 13 Arena metrics reconcile from raw source rows to the deduplicated database; no default 0/50, generated numeric data, or positional mismatch was found. Catalog refresh status remains **MIXED_SNAPSHOT_REBUILD**; consult the input-mode disclosure above before treating this as a fully live source refresh.

### Warnings

- oagxm: A configured scope product line had no record in any of the three sources for this snapshot.
- catalog: Catalog input freshness is not a fully live three-source refresh; see catalog input modes and disclosure.

