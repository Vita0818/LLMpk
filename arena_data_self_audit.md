# Arena data self-audit

- Audit status: **VALIDATED**
- Audit status validates provenance, score integrity, and Arena reconciliation; it is not by itself a claim that every upstream source was fetched live in this run.
- Audit time: 2026-09-02T01:17:35.531Z
- Raw extraction: `src/data/arenaRawExtraction.json` (arena-raw-extraction/v1)
- Catalog: `src/data/seedCards.ts`
- Scope: `oagxm-current-product-lines` (oagxm-current-product-lines/v8-2026-09-01-releases)
- Catalog refresh status: **MIXED_SNAPSHOT_REBUILD**
- Catalog freshness disclosure: The catalog mixes direct raw extraction with official-source and/or verified-catalog snapshots. This audit validates provenance and reconciliation, not a fully live three-source refresh.

## OAGXM current-product scope

- Scope provenance findings: 0
- Product lines with no source record in this snapshot: 2
- General source-catalog records outside this curated scope: 1397 cards / 8075 observations; card and observation scopes still reconcile exactly.
- All 63 configured product lines are formal text/agent models; no image/audio/safety-only line is admitted to this capability scope.

## Arena per-metric reconciliation

The `source*` columns retain complete public-leaderboard extraction facts. The unprefixed columns are the explicit OAGXM scope admitted to the database and are the values compared for validation.

| Metric | sourceExtractedRowCount | sourceDuplicateRowCount | sourceUniqueModelCount | extractedRowCount | duplicateRowCount | uniqueModelCount | databaseAvailableCount | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| arena_text_instruction | 398 | 0 | 398 | 61 | 0 | 61 | 61 | VALID |
| arena_text_multiturn | 396 | 0 | 396 | 61 | 0 | 61 | 61 | VALID |
| arena_text_creative | 396 | 0 | 396 | 61 | 0 | 61 | 61 | VALID |
| arena_text_hard | 398 | 0 | 398 | 61 | 0 | 61 | 61 | VALID |
| arena_text_math | 381 | 0 | 381 | 59 | 0 | 59 | 59 | VALID |
| arena_text_coding | 393 | 0 | 393 | 61 | 0 | 61 | 61 | VALID |
| arena_code_webdev | 121 | 1 | 120 | 53 | 0 | 53 | 53 | VALID |
| arena_search | 34 | 0 | 34 | 10 | 0 | 10 | 10 | VALID |
| arena_agent_success | 56 | 0 | 56 | 45 | 0 | 45 | 45 | VALID |
| arena_agent_praise | 56 | 0 | 56 | 45 | 0 | 45 | 45 | VALID |
| arena_agent_steerability | 56 | 0 | 56 | 45 | 0 | 45 | 45 | VALID |
| arena_agent_bash_recovery | 56 | 0 | 56 | 45 | 0 | 45 | 45 | VALID |
| arena_agent_tool_hallucination | 56 | 0 | 56 | 45 | 0 | 45 | 45 | VALID |

Total effective Arena observations: 652; sum of 13 unique available counts: 652; conservation: PASS.

## Catalog provenance

- Cards: 1810 (AA 630, Arena 451, OpenRouter 729)
- Available observations: 11108 (AA 6854, Arena 2796, OpenRouter 1458)
- Provenance / source ownership findings: 0
- Unproven default 0 / 50 values: 0
- Full live three-source refresh: no
- Source input modes:
  - arena: official-arena-raw-extraction — 451 cards, 2796 available observations (direct_source_extraction)
  - artificial_analysis: official-aa-structured-snapshot — 630 cards, 6854 available observations (official_source_snapshot)
  - openrouter: 3d/1w stabilized endpoint medians, followed by an equal-weight mean across current OpenRouter Standard endpoints; raw current rows, auxiliary traffic-weighted mean, median, quartiles, and range retained in the verified snapshot — 344 cards, 688 available observations (official_source_snapshot)
  - openrouter: official-openrouter-local-snapshot — 385 cards, 770 available observations (official_source_snapshot)

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

