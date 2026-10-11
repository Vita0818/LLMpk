import { sha256 } from './sourceSnapshotUtils.mjs';

export const OPENROUTER_BENCHMARK_API_URL =
  'https://openrouter.ai/api/v1/benchmarks?source=openrouter&include_run_config=true';
export const OPENROUTER_BENCHMARK_KEY_NAME = 'LLMPK_OPENROUTER_BENCHMARK_API_KEY';
export const OPENROUTER_EXPORT_BASE_URL = 'https://openrouter.ai/api/v1/datasets/exports';
export const OPENROUTER_BENCHMARK_DATASETS = [
  'benchmark-leaderboard',
  'search-benchmark-lanes',
];

const CLASSIC_PAGES = {
  gpqa_diamond: 'https://openrouter.ai/benchmarks/gpqa-diamond',
  tau_bench_verified_airline: 'https://openrouter.ai/benchmarks/tau2-bench-airline',
};
const SEARCH_PAGES = {
  search_browsecomp: 'https://openrouter.ai/benchmarks/browsecomp',
  search_dsqa: 'https://openrouter.ai/benchmarks/deepsearchqa',
  search_hle: 'https://openrouter.ai/benchmarks/hle',
  search_widesearch: 'https://openrouter.ai/benchmarks/widesearch',
};

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function fraction(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function nullableNonnegative(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateOpenRouterExportManifest(manifest, dataset, {
  now = new Date(),
  maximumSnapshotAgeDays = 3,
} = {}) {
  requireValue(OPENROUTER_BENCHMARK_DATASETS.includes(dataset), 'Unsupported OpenRouter benchmark dataset.');
  requireValue(manifest?.dataset === dataset && manifest.schema_version === 'v1',
    'OpenRouter export manifest has an unexpected dataset or schema.');
  const date = manifest.snapshot_date;
  requireValue(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(date)
    && timestamp(date + 'T00:00:00Z')
    && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date,
  'OpenRouter export manifest has an invalid snapshot date.');
  requireValue(timestamp(manifest.retrieved_at)
    && manifest.retrieved_at.slice(0, 10) === date,
  'OpenRouter export manifest has an invalid retrieval time.');
  const age = new Date(now).getTime() - Date.parse(manifest.retrieved_at);
  requireValue(Number.isFinite(age) && age >= -5 * 60_000
    && age <= maximumSnapshotAgeDays * 24 * 60 * 60_000,
  'OpenRouter export manifest is outside the accepted snapshot freshness window.');
  requireValue(positiveInteger(manifest.row_count), 'OpenRouter export manifest has no benchmark rows.');
  requireValue(manifest.license?.name === 'CC BY 4.0' && nonemptyString(manifest.attribution),
    'OpenRouter export manifest is missing its license or attribution.');
  const file = manifest.files?.json;
  requireValue(file?.url === `${OPENROUTER_EXPORT_BASE_URL}/${dataset}/${date}.json`
    && positiveInteger(file.bytes) && typeof file.sha256 === 'string'
    && /^[a-f0-9]{64}$/u.test(file.sha256),
  'OpenRouter export manifest has an invalid dated JSON file or checksum.');
  return manifest;
}

function validateRows(payload) {
  const classic = payload.dataset === 'benchmark-leaderboard';
  const pages = classic ? CLASSIC_PAGES : SEARCH_PAGES;
  const identities = new Set();
  for (const row of payload.rows) {
    const label = `${payload.dataset}: ${row?.model_permaslug ?? '(missing model)'}`;
    requireValue(row && Object.hasOwn(pages, row.benchmark)
      && row.benchmark_page_url === pages[row.benchmark]
      && nonemptyString(row.model_permaslug)
      && row.model_permaslug.includes('/') && positiveInteger(row.total_questions),
    `${label}: malformed benchmark identity or sample size.`);
    const runTime = classic ? row.last_run_timestamp : row.last_run_at;
    requireValue(timestamp(runTime)
      && Date.parse(runTime) <= Date.parse(payload.retrieved_at) + 5 * 60_000,
    `${label}: invalid or future benchmark run timestamp.`);
    let key;
    if (classic) {
      requireValue(nonemptyString(row.model_name)
        && (row.model_slug === null || nonemptyString(row.model_slug))
        && nonemptyString(row.provider_name) && fraction(row.accuracy)
        && (row.accuracy_std_dev === null || fraction(row.accuracy_std_dev))
        && positiveInteger(row.run_count)
        && nullableNonnegative(row.avg_cost_per_task_usd)
        && nullableNonnegative(row.avg_duration_per_task_ms)
        && nullableNonnegative(row.avg_output_tokens_per_task),
      `${label}: malformed provider leaderboard values.`);
      key = [row.benchmark, row.model_permaslug, row.provider_name];
    } else {
      requireValue((row.model_name === null || nonemptyString(row.model_name))
        && nonemptyString(row.search_engine) && ['server-tool', 'plugin'].includes(row.surface)
        && (row.max_agent_turns === null || positiveInteger(row.max_agent_turns))
        && (row.reasoning_effort === null || nonemptyString(row.reasoning_effort))
        && fraction(row.score) && fraction(row.item_f1) && positiveInteger(row.runs)
        && Number.isSafeInteger(row.total_correct)
        && row.total_correct >= 0 && row.total_correct <= row.total_questions
        && Math.abs(row.score - row.total_correct / row.total_questions) <= 1e-6
        && nullableNonnegative(row.cost_per_task_usd)
        && nullableNonnegative(row.latency_mean_ms),
      `${label}: malformed search configuration or score.`);
      key = [row.benchmark, row.model_permaslug, row.search_engine, row.surface,
        row.max_agent_turns, row.reasoning_effort];
    }
    const identity = JSON.stringify(key);
    requireValue(!identities.has(identity), `${label}: duplicate benchmark configuration.`);
    identities.add(identity);
  }
}

/** Preserve the source envelope and both search score definitions verbatim. */
export function verifyOpenRouterBenchmarkExport(body, manifest, options = {}) {
  validateOpenRouterExportManifest(manifest, manifest?.dataset, options);
  requireValue(Buffer.byteLength(body) === manifest.files.json.bytes
    && sha256(body) === manifest.files.json.sha256,
  'OpenRouter benchmark export failed its byte-size or SHA-256 integrity check.');
  const payload = JSON.parse(body);
  requireValue(payload?.dataset === manifest.dataset && payload.schema_version === 'v1'
    && payload.snapshot_date === manifest.snapshot_date
    && payload.retrieved_at === manifest.retrieved_at
    && payload.row_count === manifest.row_count
    && Array.isArray(payload.rows) && payload.rows.length === manifest.row_count,
  'OpenRouter benchmark export does not match its manifest.');
  requireValue(payload.license?.name === manifest.license.name
    && payload.attribution === manifest.attribution
    && nonemptyString(payload.methodology) && Array.isArray(payload.columns),
  'OpenRouter benchmark export is missing its provenance or column definitions.');
  validateRows(payload);
  return payload;
}

export function summarizeOpenRouterBenchmarkExport(payload) {
  const classic = payload.dataset === 'benchmark-leaderboard';
  const benchmarks = {};
  for (const row of payload.rows) {
    const group = benchmarks[row.benchmark] ??= {
      rowCount: 0, models: new Set(), providers: new Set(), searchEngines: new Set(),
      reasoningEfforts: new Set(), surfaces: new Set(), oldestRun: null, newestRun: null,
      primaryScoreField: classic ? 'accuracy' : row.benchmark === 'search_widesearch' ? 'item_f1' : 'score',
    };
    group.rowCount += 1;
    group.models.add(row.model_permaslug);
    if (classic) group.providers.add(row.provider_name);
    else {
      group.searchEngines.add(row.search_engine);
      group.reasoningEfforts.add(row.reasoning_effort);
      group.surfaces.add(row.surface);
    }
    const date = classic ? row.last_run_timestamp : row.last_run_at;
    if (group.oldestRun === null || date < group.oldestRun) group.oldestRun = date;
    if (group.newestRun === null || date > group.newestRun) group.newestRun = date;
  }
  return {
    rowCount: payload.rows.length,
    uniqueModelVersions: new Set(payload.rows.map(row => row.model_permaslug)).size,
    missingDisplayNames: payload.rows.filter(row => row.model_name === null).length,
    providerLabelsRequiringReview: classic
      ? payload.rows.filter(row => /\b(?:fake|test|dummy)\s*provider\b/iu.test(row.provider_name))
        .map(row => ({ benchmark: row.benchmark, model_permaslug: row.model_permaslug, provider_name: row.provider_name }))
      : [],
    benchmarks: Object.fromEntries(Object.entries(benchmarks).map(([name, group]) => [name, {
      rowCount: group.rowCount, uniqueModelVersions: group.models.size,
      providers: [...group.providers].sort(), searchEngines: [...group.searchEngines].sort(),
      reasoningEfforts: [...group.reasoningEfforts].sort(), surfaces: [...group.surfaces].sort(),
      oldestRun: group.oldestRun, newestRun: group.newestRun, primaryScoreField: group.primaryScoreField,
    }])),
  };
}

export function validateOpenRouterBenchmarkApiPayload(payload) {
  requireValue(Array.isArray(payload?.data) && payload.data.length > 0
    && payload.meta?.source === 'openrouter' && timestamp(payload.meta.as_of),
  'OpenRouter Benchmark API returned an empty or unexpected source envelope.');
  for (const row of payload.data) {
    requireValue(row?.source === 'openrouter' && nonemptyString(row.model_permaslug)
      && nonemptyString(row.display_name) && positiveInteger(row.total_tasks)
      && timestamp(row.last_run_timestamp), 'OpenRouter Benchmark API returned a malformed model row.');
    if (Object.hasOwn(CLASSIC_PAGES, row.benchmark_type)) {
      requireValue(fraction(row.accuracy), 'OpenRouter Benchmark API returned invalid accuracy.');
    } else {
      requireValue(Object.hasOwn(SEARCH_PAGES, row.benchmark_type) && fraction(row.primary_score)
        && row.primary_metric === (row.benchmark_type === 'search_widesearch' ? 'f1_by_item' : 'accuracy')
        && nonemptyString(row.search_engine) && ['server-tool', 'plugin'].includes(row.search_surface),
      'OpenRouter Benchmark API returned an unknown benchmark or mismatched search metric.');
    }
  }
  return payload;
}
