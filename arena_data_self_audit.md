# Arena data self-audit

- Audit status: **VALIDATED**
- Audit status validates provenance, score integrity, and Arena reconciliation; it is not by itself a claim that every upstream source was fetched live in this run.
- Audit time: 2026-08-26T16:10:12.099Z
- Raw extraction: `src/data/arenaRawExtraction.json` (arena-raw-extraction/v1)
- Catalog: `src/data/seedCards.ts`
- Scope: `oagxm-current-product-lines` (oagxm-current-product-lines/v6-2026-08-26-releases)
- Catalog refresh status: **MIXED_SNAPSHOT_REBUILD**
- Catalog freshness disclosure: The catalog mixes direct raw extraction with official-source and/or verified-catalog snapshots. This audit validates provenance and reconciliation, not a fully live three-source refresh.

## OAGXM current-product scope

- Scope provenance findings: 0
- Product lines with no source record in this snapshot: 2
- General source-catalog records outside this curated scope: 1401 cards / 8005 observations; card and observation scopes still reconcile exactly.
- All 60 configured product lines are formal text/agent models; no image/audio/safety-only line is admitted to this capability scope.

## Arena per-metric reconciliation

The `source*` columns retain complete public-leaderboard extraction facts. The unprefixed columns are the explicit OAGXM scope admitted to the database and are the values compared for validation.

| Metric | sourceExtractedRowCount | sourceDuplicateRowCount | sourceUniqueModelCount | extractedRowCount | duplicateRowCount | uniqueModelCount | databaseAvailableCount | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| arena_text_instruction | 394 | 0 | 394 | 60 | 0 | 60 | 60 | VALID |
| arena_text_multiturn | 392 | 0 | 392 | 60 | 0 | 60 | 60 | VALID |
| arena_text_creative | 392 | 0 | 392 | 60 | 0 | 60 | 60 | VALID |
| arena_text_hard | 394 | 0 | 394 | 60 | 0 | 60 | 60 | VALID |
| arena_text_math | 377 | 0 | 377 | 55 | 0 | 55 | 55 | VALID |
| arena_text_coding | 389 | 0 | 389 | 60 | 0 | 60 | 60 | VALID |
| arena_code_webdev | 120 | 1 | 119 | 51 | 0 | 51 | 51 | VALID |
| arena_search | 34 | 0 | 34 | 10 | 0 | 10 | 10 | VALID |
| arena_agent_success | 53 | 0 | 53 | 42 | 0 | 42 | 42 | VALID |
| arena_agent_praise | 53 | 0 | 53 | 42 | 0 | 42 | 42 | VALID |
| arena_agent_steerability | 53 | 0 | 53 | 42 | 0 | 42 | 42 | VALID |
| arena_agent_bash_recovery | 53 | 0 | 53 | 42 | 0 | 42 | 42 | VALID |
| arena_agent_tool_hallucination | 53 | 0 | 53 | 42 | 0 | 42 | 42 | VALID |

Total effective Arena observations: 626; sum of 13 unique available counts: 626; conservation: PASS.

## Catalog provenance

- Cards: 1799 (AA 618, Arena 446, OpenRouter 735)
- Available observations: 10882 (AA 6656, Arena 2756, OpenRouter 1470)
- Provenance / source ownership findings: 0
- Unproven default 0 / 50 values: 0
- Full live three-source refresh: no
- Source input modes:
  - arena: official-arena-raw-extraction — 446 cards, 2756 available observations (direct_source_extraction)
  - artificial_analysis: official-aa-structured-snapshot — 618 cards, 6656 available observations (official_source_snapshot)
  - openrouter: 3d/1w stabilized endpoint medians, followed by an equal-weight mean across current OpenRouter Standard endpoints; raw current rows, auxiliary traffic-weighted mean, median, quartiles, and range retained in the verified snapshot — 352 cards, 704 available observations (official_source_snapshot)
  - openrouter: official-openrouter-local-snapshot — 383 cards, 766 available observations (official_source_snapshot)

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

