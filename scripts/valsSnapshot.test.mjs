import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VALS_BENCHMARK_SLUGS, extractValsBenchmarkViewUrl, validateValsBenchmarkPayload,
  validateReviewedValsRows, valsExecutionIdentity, valsProfileIdentity, extractValsFallbackNotices,
} from './valsSnapshotUtils.mjs';
import { extractValsRefusalDatasets, extractValsRefusalModulePath, validateValsRefusalRecord } from './valsRefusalMetadata.mjs';

const snapshot = JSON.parse(readFileSync(new URL('../src/data/valsSourceSnapshot.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../src/data/valsReviewedMappings.json', import.meta.url), 'utf8'));
assert.deepEqual(snapshot.benchmarks.map(item => item.metadata.slug), VALS_BENCHMARK_SLUGS);
assert.equal(snapshot.counts.modelIds, new Set(snapshot.benchmarks.flatMap(item => item.metadata.models)).size);
assert.equal(snapshot.counts.observedRows, snapshot.benchmarks.reduce((sum, item) => sum + item.observedRows, 0));
assert.deepEqual(validateReviewedValsRows(snapshot.benchmarks, manifest), { reviewedModels: 33, reviewedRows: 327 });
for (const benchmark of snapshot.benchmarks) {
  validateValsBenchmarkPayload(benchmark, benchmark.metadata.slug, { now: snapshot.fetchedAt });
  assert.match(benchmark.source.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(new URL(benchmark.source.dataUrl).origin, 'https://www.vals.ai');
  for (const [model, record] of Object.entries(benchmark.refusalFallback ?? {})) {
    validateValsRefusalRecord(record, benchmark.tasks.overall[model]?.accuracy ?? null, model);
  }
}

const props = value => JSON.stringify({ benchmarkViewUrl: [0, value] }).replaceAll('"', '&quot;');
const island = value => `<astro-island component-url="/_astro/BenchmarkViewLoader.hash.js" props="${props(value)}"></astro-island>`;
const dataPath = '/_astro/benchmark_view_vals_index.hash.json';
assert.equal(extractValsBenchmarkViewUrl(island(dataPath)), `https://www.vals.ai${dataPath}`);
assert.throws(() => extractValsBenchmarkViewUrl('<script>window.fetch("/unrelated")</script>'), /exactly one/u);
assert.throws(() => extractValsBenchmarkViewUrl(island(dataPath) + island(dataPath)), /exactly one/u);
for (const url of ['https://other.example/results.json', '//other.example/x.json', 'javascript:alert(1)', '/api/private.json']) {
  assert.throws(() => extractValsBenchmarkViewUrl(island(url)), /unsupported/u);
}

const row = { accuracy: 0, stderr: 0, latency: 2, cost_per_test: 0, reasoning_effort: 'high', harness: 'OpenHands' };
const fixture = {
  metadata: { slug: 'fixture', benchmark: 'Fixture', version: '1', updated: '2026-10-07',
    models: ['model-a', 'model-b'], total_models: 2, tasks: { overall: 'Overall' } },
  tasks: { overall: { 'model-a': row, 'model-b': { ...row, accuracy: 100 } } },
};
const options = { minimumRows: 2, now: '2026-10-12T00:00:00Z' };
assert.equal(validateValsBenchmarkPayload(fixture, 'fixture', options).observedRows, 2);
for (const field of ['accuracy', 'stderr', 'latency', 'cost_per_test']) {
  for (const value of [-1, Infinity, '1']) {
    const bad = structuredClone(fixture);
    bad.tasks.overall['model-a'][field] = value;
    assert.throws(() => validateValsBenchmarkPayload(bad, 'fixture', options), /Invalid Vals/u);
  }
}
assert.throws(() => validateValsBenchmarkPayload({ ...fixture, metadata: { ...fixture.metadata, slug: 'other' } }, 'fixture', options), /identity/u);
assert.throws(() => validateValsBenchmarkPayload({ ...fixture, metadata: { ...fixture.metadata, models: ['model-a', 'model-a'] } }, 'fixture', options), /identity/u);
assert.throws(() => validateValsBenchmarkPayload({ ...fixture, metadata: { ...fixture.metadata, updated: '2026-02-30' } }, 'fixture', options), /date/u);
assert.throws(() => validateValsBenchmarkPayload({ ...fixture, metadata: { ...fixture.metadata, updated: '2027-01-01' } }, 'fixture', options), /date/u);
const nullFixture = structuredClone(fixture);
nullFixture.metadata.models.push('missing-model');
nullFixture.metadata.total_models += 1;
nullFixture.tasks.overall['missing-model'] = { ...row, accuracy: null, stderr: null };
assert.equal(validateValsBenchmarkPayload(nullFixture, 'fixture', options).tasks.overall['missing-model'].accuracy, null);
assert.equal(valsProfileIdentity({ reasoning_effort: '0.99' }).level, null, 'Unknown numerical efforts cannot be ordered as XHigh.');
assert.deepEqual(valsProfileIdentity({}), { label: 'Default', level: 0, disclosed: false });

const review = { schemaVersion: 'vals-reviewed-mappings/v1', entries: [{
  key: 'model-a', modelId: 'model-a', targets: [], executions: [{ benchmarkSlug: 'fixture',
    benchmarkVersion: '1', task: 'overall', settings: valsExecutionIdentity(row), profile: valsProfileIdentity(row) }],
}] };
const benchmark = { metadata: fixture.metadata, tasks: fixture.tasks };
assert.equal(validateReviewedValsRows([benchmark], review).reviewedRows, 1);
const scoreRefresh = structuredClone(benchmark);
scoreRefresh.tasks.overall['model-a'].accuracy = 33;
assert.equal(validateReviewedValsRows([scoreRefresh], review).reviewedRows, 1);
for (const field of ['reasoning_effort', 'harness', 'max_output_tokens', 'provider']) {
  const changed = structuredClone(benchmark);
  changed.tasks.overall['model-a'][field] = 'changed';
  assert.throws(() => validateReviewedValsRows([changed], review), /needs review/u);
}
const wrongProfile = structuredClone(review);
wrongProfile.entries[0].executions[0].profile = { label: 'Max', level: 6, disclosed: true };
assert.throws(() => validateReviewedValsRows([benchmark], wrongProfile), /needs review/u);
assert.throws(() => validateReviewedValsRows([benchmark], { ...review, entries: [...review.entries, review.entries[0]] }), /Duplicate/u);
const removed = structuredClone(benchmark);
delete removed.tasks.overall['model-a'];
assert.throws(() => validateReviewedValsRows([removed], review), /needs review/u);
assert.deepEqual(extractValsFallbackNotices('<p>Provider refusal used a fallback model &amp; retained the score.</p><p>Other notes.</p>'),
  ['Provider refusal used a fallback model & retained the score.']);
assert.ok(Object.values(snapshot.benchmarks.find(item => item.metadata.slug === 'vals_index').refusalFallback)
  .some(record => record?.status === 'available' && record.fallbacks > 0),
  'Official fallback evidence must survive even when the page removes its prose notice.');
const staticSource = 'const v=1,b="fixture",m={"model-a":{benchmarks:{fixture:{fallbacks:2}}}},d={schemaVersion:v,benchmark:b,models:m};globalThis.valsExecuted=true;';
assert.equal(extractValsRefusalDatasets(staticSource).get('fixture').models['model-a'].benchmarks.fixture.fallbacks, 2);
assert.equal(globalThis.valsExecuted, undefined, 'Published JavaScript must never be executed.');
assert.throws(() => extractValsRefusalDatasets('const d=fetch("https://private.example");'), /changed/u);
assert.equal(extractValsRefusalModulePath('import "./WipeSwap.hash.js";'), './WipeSwap.hash.js');
assert.throws(() => extractValsRefusalModulePath('import "https://other.example/WipeSwap.hash.js";'), /changed/u);
assert.throws(() => validateValsRefusalRecord({ status: 'available', publishedScorePct: 50, noFallbackScorePct: 60,
  totalTasks: 10, fallbacks: 1, refusals: 0 }, 50, 'bad'), /does not match/u);
assert.throws(() => validateValsRefusalRecord({ status: 'available', publishedScorePct: 50, noFallbackScorePct: 40,
  totalTasks: 10, fallbacks: 1, refusals: 0 }, 60, 'stale'), /does not match/u);

console.log('Vals official JSON references, numeric/null/date validation, pinned version/effort/harness refresh and refusal notices: PASS');
