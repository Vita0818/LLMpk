import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from './sourceSnapshotUtils.mjs';
import {
  OPENROUTER_BENCHMARK_API_URL, OPENROUTER_BENCHMARK_KEY_NAME, OPENROUTER_EXPORT_BASE_URL,
  summarizeOpenRouterBenchmarkExport, validateOpenRouterBenchmarkApiPayload,
  validateOpenRouterExportManifest, verifyOpenRouterBenchmarkExport,
} from './openRouterBenchmarkSnapshotUtils.mjs';
import { fetchBenchmarkApi, fetchPublicBenchmarkDataset, readBenchmarkApiKey } from './fetchOpenRouterBenchmarkSnapshot.mjs';

const now = '2026-10-08T12:00:00Z';
const classicRow = {
  benchmark: 'gpqa_diamond', benchmark_page_url: 'https://openrouter.ai/benchmarks/gpqa-diamond',
  model_permaslug: 'test/model-20261001', model_slug: 'test/model', model_name: 'Test Model',
  provider_name: 'auto-routing', accuracy: 0.8, accuracy_std_dev: null,
  run_count: 1, total_questions: 100, avg_cost_per_task_usd: null,
  avg_duration_per_task_ms: 0, avg_output_tokens_per_task: 120,
  last_run_timestamp: '2026-10-07T12:00:00Z',
};
const searchRow = {
  benchmark: 'search_widesearch', benchmark_page_url: 'https://openrouter.ai/benchmarks/widesearch',
  model_permaslug: 'test/model-20261001', model_name: null, search_engine: 'exa', surface: 'server-tool',
  max_agent_turns: 25, reasoning_effort: 'high', score: 0.21, item_f1: 0.84,
  runs: 1, total_questions: 100, total_correct: 21,
  cost_per_task_usd: 0.2, latency_mean_ms: null, last_run_at: '2026-08-11T12:00:00Z',
};

function fixture(dataset = 'benchmark-leaderboard', rows = [classicRow], overrides = {}) {
  const payload = {
    dataset, schema_version: 'v1', snapshot_date: '2026-10-08', retrieved_at: '2026-10-08T01:46:15Z',
    license: { name: 'CC BY 4.0' }, attribution: 'Source: OpenRouter (openrouter.ai).',
    methodology: 'Published benchmark aggregates.', columns: [{ name: 'benchmark', type: 'string' }],
    row_count: rows.length, rows, ...overrides,
  };
  const body = JSON.stringify(payload);
  const { rows: _rows, columns: _columns, methodology: _methodology, ...manifest } = payload;
  manifest.files = { json: {
    url: `${OPENROUTER_EXPORT_BASE_URL}/${dataset}/2026-10-08.json`,
    bytes: Buffer.byteLength(body), sha256: sha256(body),
  } };
  return { payload, body, manifest };
}

const classic = fixture();
assert.deepEqual(verifyOpenRouterBenchmarkExport(classic.body, classic.manifest, { now }), classic.payload);
assert.equal(verifyOpenRouterBenchmarkExport(classic.body, classic.manifest, { now }).rows[0].avg_cost_per_task_usd, null);
assert.equal(verifyOpenRouterBenchmarkExport(classic.body, classic.manifest, { now }).rows[0].avg_duration_per_task_ms, 0);
assert.throws(() => verifyOpenRouterBenchmarkExport(classic.body + ' ', classic.manifest, { now }), /integrity/u);
assert.throws(() => validateOpenRouterExportManifest({ ...classic.manifest,
  files: { json: { ...classic.manifest.files.json, url: 'https://example.com/snapshot.json' } },
}, 'benchmark-leaderboard', { now }), /dated JSON/u);
assert.throws(() => validateOpenRouterExportManifest(classic.manifest, 'benchmark-leaderboard', {
  now: '2026-10-15T12:00:00Z',
}), /freshness/u);
assert.throws(() => verifyOpenRouterBenchmarkExport(classic.body, {
  ...classic.manifest, row_count: 2,
}, { now }), /match its manifest/u);
for (const rows of [
  [classicRow, classicRow],
  [{ ...classicRow, accuracy: 80 }],
  [{ ...classicRow, last_run_timestamp: '2026-10-09T12:00:00Z' }],
]) {
  const invalid = fixture('benchmark-leaderboard', rows);
  assert.throws(() => verifyOpenRouterBenchmarkExport(invalid.body, invalid.manifest, { now }));
}

const search = fixture('search-benchmark-lanes', [searchRow, { ...searchRow, max_agent_turns: 1 }]);
const verifiedSearch = verifyOpenRouterBenchmarkExport(search.body, search.manifest, { now });
const searchSummary = summarizeOpenRouterBenchmarkExport(verifiedSearch);
assert.equal(searchSummary.benchmarks.search_widesearch.primaryScoreField, 'item_f1');
assert.equal(searchSummary.benchmarks.search_widesearch.rowCount, 2, 'Different turn budgets are distinct configurations.');
assert.equal(verifiedSearch.rows[0].score, 0.21, 'Strict task accuracy must stay separate from partial-credit F1.');
assert.equal(verifiedSearch.rows[0].item_f1, 0.84);
assert.equal(verifiedSearch.rows[0].model_name, null, 'Missing model names must not be invented.');
assert.equal(searchSummary.benchmarks.search_widesearch.newestRun, searchRow.last_run_at,
  'The export date must not replace the actual run date.');
for (const rows of [
  [searchRow, searchRow],
  [{ ...searchRow, score: 0.84 }],
  [{ ...searchRow, reasoning_effort: undefined }],
]) {
  const invalid = fixture('search-benchmark-lanes', rows);
  assert.throws(() => verifyOpenRouterBenchmarkExport(invalid.body, invalid.manifest, { now }));
}
const suspicious = fixture('benchmark-leaderboard', [{ ...classicRow, provider_name: 'FakeProvider' }]);
assert.equal(summarizeOpenRouterBenchmarkExport(suspicious.payload).providerLabelsRequiringReview.length, 1);
assert.equal(suspicious.payload.rows.length, 1, 'Review flags must not delete source records.');

const aliasCalls = [];
const aliasResult = await fetchPublicBenchmarkDataset('benchmark-leaderboard', { now,
  fetcher: async url => {
    aliasCalls.push(url);
    if (url.endsWith('latest.manifest.json')) return { body: JSON.stringify(classic.manifest), finalUrl: url };
    if (url.endsWith('/2026-10-08.json')) throw new Error('Simulated dated-file transport error');
    return { body: classic.body, finalUrl: url };
  },
});
assert.equal(aliasResult.source.usedLatestAlias, true);
assert.equal(aliasCalls.length, 3);
await assert.rejects(() => fetchPublicBenchmarkDataset('benchmark-leaderboard', { now,
  fetcher: async url => {
    if (url.endsWith('latest.manifest.json')) return { body: JSON.stringify(classic.manifest), finalUrl: url };
    if (url.endsWith('/2026-10-08.json')) throw new Error('Simulated dated-file transport error');
    return { body: classic.body + ' ', finalUrl: url };
  },
}), /integrity/u, 'A cached alias from another snapshot must never be accepted.');
const corruptDatedCalls = [];
await assert.rejects(() => fetchPublicBenchmarkDataset('benchmark-leaderboard', { now,
  fetcher: async url => {
    corruptDatedCalls.push(url);
    return { body: url.endsWith('latest.manifest.json') ? JSON.stringify(classic.manifest) : classic.body + ' ', finalUrl: url };
  },
}), /integrity/u);
assert.equal(corruptDatedCalls.length, 2, 'A checksum failure must not be hidden by alias fallback.');

const apiPayload = {
  data: [{ source: 'openrouter', model_permaslug: 'test/model-20261001', display_name: 'Test Model',
    benchmark_type: 'search_widesearch', primary_metric: 'f1_by_item', primary_score: 0.84,
    total_tasks: 100, search_engine: 'exa', search_surface: 'server-tool',
    run_config: { max_agent_turns: 25, reasoning_effort: 'high', temperature: 0.2 },
    last_run_timestamp: '2026-08-11T12:00:00Z' }],
  meta: { source: 'openrouter', as_of: now, citation: 'Source: OpenRouter evals.' },
};
assert.equal(validateOpenRouterBenchmarkApiPayload(apiPayload), apiPayload);
assert.throws(() => validateOpenRouterBenchmarkApiPayload({ ...apiPayload,
  data: [{ ...apiPayload.data[0], primary_metric: 'accuracy' }],
}), /mismatched search metric/u);
assert.throws(() => validateOpenRouterBenchmarkApiPayload({ ...apiPayload,
  data: [{ ...apiPayload.data[0], source: 'artificial-analysis' }],
}), /malformed model row/u);

const directory = mkdtempSync(path.join(os.tmpdir(), 'llmpk-benchmark-key-test-'));
try {
  const localEnvPath = path.join(directory, '.env.benchmarks.local');
  const environment = { OPENROUTER_API_KEY: 'other-app-test-key' };
  assert.equal(readBenchmarkApiKey({ environment, localEnvPath }), null);
  writeFileSync(localEnvPath, 'OPENROUTER_API_KEY=other-app-file-key\n');
  assert.equal(readBenchmarkApiKey({ environment, localEnvPath }), null);
  writeFileSync(localEnvPath, `${OPENROUTER_BENCHMARK_KEY_NAME}=dedicated-test-key\n`);
  assert.equal(readBenchmarkApiKey({ environment, localEnvPath }), 'dedicated-test-key');
  assert.deepEqual(environment, { OPENROUTER_API_KEY: 'other-app-test-key' }, 'Reading a key must not export it into the environment.');
  assert.equal(readBenchmarkApiKey({ environment: { [OPENROUTER_BENCHMARK_KEY_NAME]: '' }, localEnvPath }), null);
  const apiResult = await fetchBenchmarkApi(readBenchmarkApiKey({ environment, localEnvPath }), {
    fetcher: async (url, options) => {
      assert.equal(url, OPENROUTER_BENCHMARK_API_URL);
      assert.equal(options.headers.Authorization, 'Bearer dedicated-test-key');
      return { body: JSON.stringify(apiPayload), finalUrl: url };
    },
  });
  assert.deepEqual(apiResult.payload.meta, apiPayload.meta, 'Citation metadata must be retained.');
  assert.equal(JSON.stringify(apiResult).includes('dedicated-test-key'), false, 'Snapshot metadata must not contain a key.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('OpenRouter benchmark provenance, score semantics, configuration grain, alias integrity and dedicated-key isolation: PASS');
