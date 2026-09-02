import {
  existsSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asFiniteNumber,
  atomicWriteJson,
} from './sourceSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PATHS = {
  artificialAnalysis: path.resolve(
    process.env.AA_SOURCE_SNAPSHOT_PATH
      ?? path.join(ROOT, 'src', 'data', 'artificialAnalysisSourceSnapshot.json'),
  ),
  arena: path.resolve(
    process.env.ARENA_RAW_EXTRACTION_PATH
      ?? path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json'),
  ),
  openRouterCatalog: path.resolve(
    process.env.OPENROUTER_CATALOG_SNAPSHOT_PATH
      ?? path.join(ROOT, 'src', 'data', 'openRouterCatalogSnapshot.json'),
  ),
  openRouterPerformance: path.resolve(
    process.env.OPENROUTER_PERFORMANCE_SNAPSHOT_PATH
      ?? path.join(ROOT, 'src', 'data', 'openRouterPerformanceSnapshot.json'),
  ),
};
const OUTPUT_PATH = path.resolve(
  process.env.SOURCE_SNAPSHOT_VALIDATION_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'sourceSnapshotValidationReport.json'),
);
const REFERENCE_PATHS = {
  artificialAnalysis: path.resolve(
    process.env.AA_REFERENCE_SNAPSHOT_PATH
      ?? path.join(ROOT, 'src', 'data', 'artificialAnalysisSourceSnapshot.json'),
  ),
  arena: path.resolve(
    process.env.ARENA_REFERENCE_SNAPSHOT_PATH
      ?? path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json'),
  ),
  openRouterPerformance: path.resolve(
    process.env.OPENROUTER_PERFORMANCE_REFERENCE_PATH
      ?? path.join(ROOT, 'src', 'data', 'openRouterPerformanceSnapshot.json'),
  ),
};

const REQUIRED_ARENA_METRICS = [
  'arena_text_instruction',
  'arena_text_multiturn',
  'arena_text_creative',
  'arena_text_hard',
  'arena_text_math',
  'arena_text_coding',
  'arena_code_webdev',
  'arena_search',
  'arena_agent_success',
  'arena_agent_praise',
  'arena_agent_steerability',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
];

function readJson(filepath, label) {
  if (!existsSync(filepath)) throw new Error(`Missing ${label}: ${filepath}`);
  try {
    return JSON.parse(readFileSync(filepath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function freshEnough(value, maximumAgeHours = 48) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= maximumAgeHours * 60 * 60 * 1_000
    && timestamp <= Date.now() + 5 * 60 * 1_000;
}

function finiteOrNull(value) {
  return value === null || value === undefined || asFiniteNumber(value) !== null;
}

function uniqueValues(records, selector) {
  const values = records.map(selector);
  return values.length === new Set(values).size;
}

function referenceSnapshot(filepath, currentPath) {
  if (filepath === currentPath || !existsSync(filepath)) return null;
  return readJson(filepath, `reference snapshot ${filepath}`);
}

const checks = [];
function check(id, description, passed, details = {}) {
  checks.push({
    id,
    description,
    passed: Boolean(passed),
    details,
  });
}

function validateArtificialAnalysis(snapshot) {
  const models = Array.isArray(snapshot?.modelRecords) ? snapshot.modelRecords : [];
  const codingRows = Array.isArray(snapshot?.codingAgentRecords)
    ? snapshot.codingAgentRecords
    : [];
  const evaluations = snapshot?.evaluationRecords && typeof snapshot.evaluationRecords === 'object'
    ? snapshot.evaluationRecords
    : {};

  check(
    'aa-schema',
    'Artificial Analysis snapshot uses the expected schema.',
    snapshot?.schemaVersion === 'artificial-analysis-source-snapshot/v1',
    { schemaVersion: snapshot?.schemaVersion ?? null },
  );
  check(
    'aa-freshness',
    'Artificial Analysis snapshot was fetched recently.',
    freshEnough(snapshot?.fetchedAt),
    { fetchedAt: snapshot?.fetchedAt ?? null },
  );
  check(
    'aa-model-volume',
    'Artificial Analysis contains a non-truncated model catalog.',
    models.length >= 400,
    { modelRecords: models.length, minimum: 400 },
  );
  check(
    'aa-model-identities',
    'Artificial Analysis model IDs and slugs are unique and complete.',
    models.every((model) => (
      typeof model?.id === 'string'
      && typeof model?.slug === 'string'
      && typeof model?.name === 'string'
      && typeof model?.modelCreatorName === 'string'
    ))
      && uniqueValues(models, (model) => model.id)
      && uniqueValues(models, (model) => model.slug),
    {
      uniqueIds: new Set(models.map((model) => model?.id)).size,
      uniqueSlugs: new Set(models.map((model) => model?.slug)).size,
    },
  );

  const numericModelFields = [
    'hle',
    'gpqa',
    'critpt',
    'scicode',
    'lcr',
    'omniscienceAccuracy',
    'omniscienceNonHallucination',
    'gdpvalNormalized',
    'tauBanking',
    'terminalbenchV21',
    'ifbench',
    'apexAgents',
    'itbenchSre',
    'mmmuPro',
  ];
  check(
    'aa-numeric-fields',
    'Known Artificial Analysis score fields are finite numbers or explicit nulls.',
    models.every((model) => numericModelFields.every((field) => finiteOrNull(model?.[field]))),
    {
      fields: numericModelFields,
    },
  );

  const metricCoverage = Object.fromEntries(numericModelFields.map((field) => [
    field,
    models.filter((model) => Number.isFinite(model?.[field])).length,
  ]));
  check(
    'aa-core-coverage',
    'High-coverage AA atomics were not truncated.',
    metricCoverage.hle >= 400
      && metricCoverage.gpqa >= 400
      && metricCoverage.scicode >= 400,
    {
      hle: metricCoverage.hle,
      gpqa: metricCoverage.gpqa,
      scicode: metricCoverage.scicode,
      minimumEach: 400,
    },
  );
  check(
    'aa-new-evaluation-fields',
    'AA main records retain newer IFBench, APEX-Agents, ITBench and MMMU-Pro fields.',
    metricCoverage.ifbench >= 300
      && metricCoverage.apexAgents >= 10
      && metricCoverage.itbenchSre >= 10
      && metricCoverage.mmmuPro >= 100,
    {
      ifbench: metricCoverage.ifbench,
      apexAgents: metricCoverage.apexAgents,
      itbenchSre: metricCoverage.itbenchSre,
      mmmuPro: metricCoverage.mmmuPro,
    },
  );

  const requiredEvaluationIds = [
    'aa-briefcase',
    'automationbench-aa',
    'harvey-lab-aa',
    'enterprise-ops-gym-aa',
  ];
  check(
    'aa-professional-evaluations',
    'All four professional/engineering AA evaluation tables were captured.',
    requiredEvaluationIds.every((id) => (
      Array.isArray(evaluations[id])
      && evaluations[id].length >= 10
      && evaluations[id].every((record) => (
        typeof record?.id === 'string'
        && typeof record?.slug === 'string'
        && typeof record?.name === 'string'
      ))
    )),
    {
      rows: Object.fromEntries(requiredEvaluationIds.map((id) => [
        id,
        Array.isArray(evaluations[id]) ? evaluations[id].length : 0,
      ])),
    },
  );

  const targetModels = [
    ['Kimi K3', /Kimi K3/iu],
    ['GPT-5.4', /GPT-5[.]4/iu],
    ['Claude Sonnet 4.6', /Claude Sonnet 4[.]6/iu],
    ['Claude Opus 4.6', /Claude Opus 4[.]6/iu],
    ['Claude Fable 5.1', /Claude Fable 5[.]1/iu],
    ['GLM-5.3-Flash', /GLM-5[.]3-Flash/iu],
    ['Qwen3.8-Flash-Next', /Qwen3[.]8-Flash-Next/iu],
  ];
  check(
    'aa-target-models',
    'Target flagship model families are present in the AA model records.',
    targetModels.every(([, pattern]) => models.some((model) => pattern.test(model.name))),
    {
      targets: Object.fromEntries(targetModels.map(([label, pattern]) => [
        label,
        models.filter((model) => pattern.test(model.name)).map((model) => model.name),
      ])),
    },
  );

  const targetHarnessRows = [
    ['Kimi Code CLI / Kimi K3', /Kimi Code CLI - Kimi K3/iu],
    ['Codex / GPT-5.6 Sol', /Codex - GPT-5[.]6 Sol/iu],
    ['Claude Code / Sonnet 4.6', /Claude Code - Sonnet 4[.]6/iu],
    ['Claude Code / Opus 4.8', /Claude Code - Opus 4[.]8/iu],
    ['Claude Code / Kimi K2.6', /Claude Code - Kimi K2[.]6/iu],
  ];
  check(
    'aa-target-harness-rows',
    'Previously missing target model+harness rows are present.',
    targetHarnessRows.every(([, pattern]) => (
      codingRows.some((record) => pattern.test(record.displayLabel))
    )),
    {
      targets: Object.fromEntries(targetHarnessRows.map(([label, pattern]) => [
        label,
        codingRows.filter((record) => pattern.test(record.displayLabel))
          .map((record) => record.displayLabel),
      ])),
    },
  );
  check(
    'aa-coding-agent-integrity',
    'AA Coding Agent rows have unique IDs, model+harness identity, and finite component scores.',
    codingRows.length >= 40
      && uniqueValues(codingRows, (record) => record.id)
      && codingRows.every((record) => (
        typeof record?.agentName === 'string'
        && typeof record?.displayLabel === 'string'
        && typeof record?.hostModelSlug === 'string'
        && Number.isFinite(record?.indexScore)
        && Array.isArray(record?.evals)
        && record.evals.length >= 2
        && record.evals.every((evaluation) => (
          typeof evaluation?.datasetIndexName === 'string'
          && Number.isFinite(evaluation?.mean?.reward)
        ))
      )),
    {
      rows: codingRows.length,
      harnesses: [...new Set(codingRows.map((record) => record.agentName))].sort(),
    },
  );

  const reference = referenceSnapshot(
    REFERENCE_PATHS.artificialAnalysis,
    PATHS.artificialAnalysis,
  );
  if (reference) {
    const referenceCount = Array.isArray(reference.modelRecords)
      ? reference.modelRecords.length
      : 0;
    check(
      'aa-volume-regression',
      'AA model record volume did not regress by more than 20%.',
      referenceCount === 0 || models.length >= referenceCount * 0.8,
      { current: models.length, reference: referenceCount },
    );
  }

  return {
    modelRecords: models.length,
    codingAgentRecords: codingRows.length,
    codingAgentHarnesses: [...new Set(codingRows.map((record) => record.agentName))].sort(),
    metricCoverage,
    evaluationRows: Object.fromEntries(
      Object.entries(evaluations).map(([id, records]) => [
        id,
        Array.isArray(records) ? records.length : 0,
      ]),
    ),
  };
}

function validateArena(snapshot) {
  const metrics = snapshot?.metrics && typeof snapshot.metrics === 'object'
    ? snapshot.metrics
    : {};
  const metricIds = Object.keys(metrics);
  check(
    'arena-schema',
    'Arena extraction uses the expected schema.',
    snapshot?.schemaVersion === 'arena-raw-extraction/v1',
    { schemaVersion: snapshot?.schemaVersion ?? null },
  );
  check(
    'arena-freshness',
    'Arena extraction was produced recently.',
    freshEnough(snapshot?.extractedAt),
    { extractedAt: snapshot?.extractedAt ?? null },
  );
  check(
    'arena-metric-set',
    'Arena contains exactly the required 13 metric tables.',
    REQUIRED_ARENA_METRICS.every((id) => metricIds.includes(id))
      && metricIds.length === REQUIRED_ARENA_METRICS.length,
    {
      expected: REQUIRED_ARENA_METRICS,
      actual: metricIds.sort(),
    },
  );

  const rowCounts = {};
  let rowsAreValid = true;
  for (const metricId of REQUIRED_ARENA_METRICS) {
    const metric = metrics[metricId];
    const rows = Array.isArray(metric?.rows) ? metric.rows : [];
    rowCounts[metricId] = rows.length;
    if (
      rows.length < 5
      || typeof metric?.sourceUrl !== 'string'
      || typeof metric?.sourceSnapshotSha256 !== 'string'
      || metric.sourceSnapshotSha256.length !== 64
      || !uniqueValues(rows, (row) => row.sourceRecordId)
      || !rows.every((row) => (
        typeof row?.sourceRecordId === 'string'
        && typeof row?.exactSourceModelName === 'string'
        && Number.isFinite(row?.rawValue)
        && typeof row?.sourceUrl === 'string'
      ))
    ) {
      rowsAreValid = false;
    }
  }
  check(
    'arena-row-integrity',
    'Every Arena metric has non-trivial, uniquely identified, finite source rows.',
    rowsAreValid,
    { rowCounts, minimumEach: 5 },
  );

  const reference = referenceSnapshot(REFERENCE_PATHS.arena, PATHS.arena);
  if (reference?.metrics) {
    const regressions = [];
    for (const metricId of REQUIRED_ARENA_METRICS) {
      const current = rowCounts[metricId] ?? 0;
      const previous = Array.isArray(reference.metrics?.[metricId]?.rows)
        ? reference.metrics[metricId].rows.length
        : 0;
      if (previous > 0 && current < previous * 0.8) {
        regressions.push({ metricId, current, previous });
      }
    }
    check(
      'arena-volume-regression',
      'No Arena metric lost more than 20% of its source rows.',
      regressions.length === 0,
      { regressions },
    );
  }
  return { metricRowCounts: rowCounts };
}

function validateOpenRouterCatalog(snapshot) {
  const records = Array.isArray(snapshot?.data) ? snapshot.data : [];
  check(
    'openrouter-catalog-schema',
    'OpenRouter catalog uses the expected schema.',
    snapshot?.schemaVersion === 'openrouter-catalog-snapshot/v1',
    { schemaVersion: snapshot?.schemaVersion ?? null },
  );
  check(
    'openrouter-catalog-freshness',
    'OpenRouter catalog was fetched recently.',
    freshEnough(snapshot?.fetchedAt),
    { fetchedAt: snapshot?.fetchedAt ?? null },
  );
  check(
    'openrouter-catalog-integrity',
    'OpenRouter catalog is non-trivial and has unique model IDs.',
    records.length >= 200
      && records.every((record) => typeof record?.id === 'string')
      && uniqueValues(records, (record) => record.id),
    {
      modelRecords: records.length,
      uniqueIds: new Set(records.map((record) => record?.id)).size,
    },
  );
  const targetIds = [
    'openai/gpt-5.4',
    'anthropic/claude-opus-4.6',
    'anthropic/claude-fable-5.1',
    'tencent/hy4-preview',
  ];
  check(
    'openrouter-target-models',
    'OpenRouter contains target flagship API model records.',
    targetIds.every((id) => records.some((record) => record.id === id)),
    {
      targets: Object.fromEntries(targetIds.map((id) => [
        id,
        records.some((record) => record.id === id),
      ])),
    },
  );
  const pricingCoverage = {
    prompt: records.filter((record) => asFiniteNumber(record?.pricing?.prompt) !== null).length,
    completion: records.filter((record) => asFiniteNumber(record?.pricing?.completion) !== null).length,
    cacheRead: records.filter((record) => (
      asFiniteNumber(record?.pricing?.input_cache_read) !== null
    )).length,
    cacheWrite: records.filter((record) => (
      asFiniteNumber(record?.pricing?.input_cache_write) !== null
    )).length,
    reasoning: records.filter((record) => (
      asFiniteNumber(record?.pricing?.internal_reasoning) !== null
    )).length,
    request: records.filter((record) => asFiniteNumber(record?.pricing?.request) !== null).length,
    webSearch: records.filter((record) => (
      asFiniteNumber(record?.pricing?.web_search) !== null
    )).length,
  };
  check(
    'openrouter-pricing-coverage',
    'OpenRouter retained base and optional published pricing fields.',
    pricingCoverage.prompt >= 150
      && pricingCoverage.completion >= 150
      && pricingCoverage.cacheRead > 0
      && pricingCoverage.cacheWrite > 0
      && pricingCoverage.reasoning > 0,
    pricingCoverage,
  );
  return {
    modelRecords: records.length,
    canonicalTextModelRecords: snapshot?.counts?.canonicalTextModelRecords ?? null,
    pricingCoverage,
    pricingFields: snapshot?.pricingFields ?? [],
  };
}

function validateOpenRouterPerformance(snapshot) {
  const records = Array.isArray(snapshot?.records) ? snapshot.records : [];
  const modelAggregates = Array.isArray(snapshot?.modelAggregates)
    ? snapshot.modelAggregates
    : [];
  const failures = Array.isArray(snapshot?.failures) ? snapshot.failures : [];
  const historyFailures = Array.isArray(snapshot?.historyFailures)
    ? snapshot.historyFailures
    : [];
  const stabilizedSchema = snapshot?.schemaVersion === 'openrouter-performance-snapshot/v2';
  check(
    'openrouter-performance-schema',
    'OpenRouter performance snapshot uses the expected schema.',
    snapshot?.schemaVersion === 'openrouter-performance-snapshot/v1'
      || stabilizedSchema,
    { schemaVersion: snapshot?.schemaVersion ?? null },
  );
  check(
    'openrouter-performance-freshness',
    'OpenRouter performance snapshot was fetched recently.',
    freshEnough(snapshot?.fetchedAt),
    { fetchedAt: snapshot?.fetchedAt ?? null },
  );
  check(
    'openrouter-performance-completeness',
    'OpenRouter performance refresh had no transient request failures.',
    failures.length === 0
      && (!stabilizedSchema || historyFailures.length === 0)
      && records.length >= 200,
    {
      endpointRecords: records.length,
      failedModels: failures.length,
      failedHistoryRequests: historyFailures.length,
      modelsWithPerformance: snapshot?.counts?.modelsWithPerformance ?? null,
    },
  );
  check(
    'openrouter-performance-integrity',
    'Every retained Standard endpoint has finite p50 latency, throughput and request count.',
    records.every((record) => (
      record?.variant === 'standard'
      && typeof record?.modelId === 'string'
      && typeof record?.endpointId === 'string'
      && Number.isFinite(record?.stats?.p50LatencyMilliseconds)
      && record.stats.p50LatencyMilliseconds > 0
      && Number.isFinite(record?.stats?.p50ThroughputTokensPerSecond)
      && record.stats.p50ThroughputTokensPerSecond > 0
      && Number.isFinite(record?.stats?.requestCount)
      && record.stats.requestCount > 0
      && record?.pricing?.rawPublishedPricing
      && typeof record.pricing.rawPublishedPricing === 'object'
    )),
    { endpointRecords: records.length },
  );
  if (stabilizedSchema) {
    const allowedSources = new Set([
      'three-day-plus-one-week-history',
      'three-day-history',
      'one-week-history',
      'current-window-fallback',
    ]);
    const stabilizedMeasureResults = records.flatMap((record) => [
      record?.stats?.speedStabilization?.latencyMilliseconds,
      record?.stats?.speedStabilization?.throughputTokensPerSecond,
    ]);
    check(
      'openrouter-speed-stabilization',
      'OpenRouter speed values use auditable 3d/1w endpoint histories with bounded fallback.',
      snapshot?.selectionPolicy?.speedStabilization?.algorithmVersion
        === 'openrouter-endpoint-history-median-geomean/v1'
        && stabilizedMeasureResults.length === records.length * 2
        && stabilizedMeasureResults.every((result) => (
          result?.algorithmVersion === 'openrouter-endpoint-history-median-geomean/v1'
          && Number.isFinite(result?.value)
          && result.value > 0
          && Number.isFinite(result?.currentWindowValue)
          && result.currentWindowValue > 0
          && allowedSources.has(result?.source)
          && result?.windows?.threeDay
          && result?.windows?.oneWeek
        ))
        && records.every((record) => (
          Number.isFinite(record?.stats?.stabilizedP50LatencyMilliseconds)
          && record.stats.stabilizedP50LatencyMilliseconds > 0
          && Number.isFinite(record?.stats?.stabilizedP50ThroughputTokensPerSecond)
          && record.stats.stabilizedP50ThroughputTokensPerSecond > 0
        ))
        && snapshot?.counts?.stabilizedMeasureValues === records.length * 2
        && snapshot?.counts?.historyBackedMeasureValues
          + snapshot?.counts?.currentWindowFallbackMeasureValues
          === snapshot?.counts?.stabilizedMeasureValues
        && Number.isFinite(snapshot?.counts?.historyBackedMeasureCoverage)
        && snapshot.counts.historyBackedMeasureCoverage >= 0.5
        && snapshot.counts.historyBackedMeasureCoverage <= 1
        && snapshot?.counts?.historyRequestsAttempted
          === (snapshot?.counts?.modelsWithPerformance ?? 0) * 4
        && snapshot?.counts?.historyRequestsSucceeded
          + snapshot?.counts?.historyRequestsFailed
          === snapshot?.counts?.historyRequestsAttempted,
      {
        algorithmVersion:
          snapshot?.selectionPolicy?.speedStabilization?.algorithmVersion ?? null,
        historyBackedMeasureCoverage:
          snapshot?.counts?.historyBackedMeasureCoverage ?? null,
        historyBackedMeasureValues:
          snapshot?.counts?.historyBackedMeasureValues ?? null,
        currentWindowFallbackMeasureValues:
          snapshot?.counts?.currentWindowFallbackMeasureValues ?? null,
        historyRequestsAttempted:
          snapshot?.counts?.historyRequestsAttempted ?? null,
        historyRequestsFailed: snapshot?.counts?.historyRequestsFailed ?? null,
      },
    );
  }
  const requiredAggregateMeasures = [
    'inputPricePerToken',
    'outputPricePerToken',
    'timeToFirstTokenMilliseconds',
    'outputSpeedTokensPerSecond',
    ...(stabilizedSchema ? [
      'instantaneousTimeToFirstTokenMilliseconds',
      'instantaneousOutputSpeedTokensPerSecond',
    ] : []),
  ];
  check(
    'openrouter-model-aggregates',
    'Every model with performance has provider-neutral price, TTFT, and output-speed summaries.',
    modelAggregates.length === snapshot?.counts?.modelsWithPerformance
      && uniqueValues(modelAggregates, (record) => record.modelId)
      && modelAggregates.every((record) => (
        typeof record?.modelId === 'string'
        && Number.isInteger(record?.endpointCount)
        && record.endpointCount >= 1
        && Number.isInteger(record?.providerCount)
        && record.providerCount >= 1
        && requiredAggregateMeasures.every((measureId) => {
          const measure = record?.measures?.[measureId];
          return measure
            && Number.isFinite(measure.arithmeticMean)
            && Number.isFinite(measure.requestWeightedMean)
            && Number.isFinite(measure.median)
            && Number.isFinite(measure.minimum)
            && Number.isFinite(measure.maximum)
            && Number.isInteger(measure.contributingEndpointCount)
            && measure.contributingEndpointCount >= 1;
        })
      )),
    {
      modelAggregates: modelAggregates.length,
      modelsWithPerformance: snapshot?.counts?.modelsWithPerformance ?? null,
      requiredMeasures: requiredAggregateMeasures,
      singleEndpointModels: modelAggregates.filter((record) => record.endpointCount === 1).length,
      multipleEndpointModels: modelAggregates.filter((record) => record.endpointCount > 1).length,
    },
  );
  check(
    'openrouter-endpoint-accounting',
    'OpenRouter reports how many returned endpoint rows were accepted or rejected.',
    Number.isInteger(snapshot?.counts?.returnedEndpointRows)
      && Number.isInteger(snapshot?.counts?.acceptedEndpointRows)
      && Number.isInteger(snapshot?.counts?.rejectedEndpointRows)
      && snapshot.counts.returnedEndpointRows
        === snapshot.counts.acceptedEndpointRows + snapshot.counts.rejectedEndpointRows
      && snapshot.counts.acceptedEndpointRows === records.length,
    {
      returned: snapshot?.counts?.returnedEndpointRows ?? null,
      accepted: snapshot?.counts?.acceptedEndpointRows ?? null,
      rejected: snapshot?.counts?.rejectedEndpointRows ?? null,
      rejectedMissingLatency: snapshot?.counts?.rejectedMissingLatency ?? null,
      rejectedMissingThroughput: snapshot?.counts?.rejectedMissingThroughput ?? null,
      rejectedMissingOrZeroRequestCount:
        snapshot?.counts?.rejectedMissingOrZeroRequestCount ?? null,
    },
  );

  const reference = referenceSnapshot(
    REFERENCE_PATHS.openRouterPerformance,
    PATHS.openRouterPerformance,
  );
  if (reference) {
    const current = snapshot?.counts?.modelsWithPerformance ?? 0;
    const previous = reference?.counts?.modelsWithPerformance ?? 0;
    check(
      'openrouter-performance-regression',
      'OpenRouter models-with-performance coverage did not regress by more than 20%.',
      previous === 0 || current >= previous * 0.8,
      { current, previous },
    );
  }
  return {
    ...snapshot?.counts,
    endpointRecords: records.length,
    aggregateCoverage: {
      modelAggregates: modelAggregates.length,
      singleEndpointModels: modelAggregates.filter((record) => record.endpointCount === 1).length,
      multipleEndpointModels: modelAggregates.filter((record) => record.endpointCount > 1).length,
      fourMeasureCompleteModels: modelAggregates.filter((record) => (
        requiredAggregateMeasures.every((measureId) => (
          Number.isFinite(record?.measures?.[measureId]?.arithmeticMean)
        ))
      )).length,
    },
  };
}

let report;
try {
  const snapshots = {
    artificialAnalysis: readJson(PATHS.artificialAnalysis, 'Artificial Analysis snapshot'),
    arena: readJson(PATHS.arena, 'Arena extraction'),
    openRouterCatalog: readJson(PATHS.openRouterCatalog, 'OpenRouter catalog snapshot'),
    openRouterPerformance: readJson(
      PATHS.openRouterPerformance,
      'OpenRouter performance snapshot',
    ),
  };
  const coverage = {
    artificialAnalysis: validateArtificialAnalysis(snapshots.artificialAnalysis),
    arena: validateArena(snapshots.arena),
    openRouterCatalog: validateOpenRouterCatalog(snapshots.openRouterCatalog),
    openRouterPerformance: validateOpenRouterPerformance(snapshots.openRouterPerformance),
  };
  const failedChecks = checks.filter((item) => !item.passed);
  report = {
    schemaVersion: 'source-snapshot-validation-report/v1',
    validatedAt: new Date().toISOString(),
    status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
    inputs: Object.fromEntries(
      Object.entries(PATHS).map(([source, filepath]) => [
        source,
        path.relative(ROOT, filepath),
      ]),
    ),
    summary: {
      checks: checks.length,
      passed: checks.length - failedChecks.length,
      failed: failedChecks.length,
    },
    coverage,
    checks,
  };
  atomicWriteJson(OUTPUT_PATH, report);
  console.log(JSON.stringify({
    status: report.status,
    output: path.relative(ROOT, OUTPUT_PATH),
    summary: report.summary,
    coverage,
    failedChecks: failedChecks.map((item) => ({
      id: item.id,
      details: item.details,
    })),
  }, null, 2));
  if (failedChecks.length > 0) process.exitCode = 1;
} catch (error) {
  report = {
    schemaVersion: 'source-snapshot-validation-report/v1',
    validatedAt: new Date().toISOString(),
    status: 'FAIL',
    inputs: Object.fromEntries(
      Object.entries(PATHS).map(([source, filepath]) => [
        source,
        path.relative(ROOT, filepath),
      ]),
    ),
    summary: {
      checks: checks.length,
      passed: checks.filter((item) => item.passed).length,
      failed: checks.filter((item) => !item.passed).length + 1,
    },
    fatalError: error instanceof Error ? error.message : String(error),
    checks,
  };
  atomicWriteJson(OUTPUT_PATH, report);
  console.error(report.fatalError);
  process.exitCode = 1;
}
