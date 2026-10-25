import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPANSION_METRICS, normalizeExpansionDataset, parseCsv, validateExpansionSnapshot, extractLivebenchModelSettings } from './sourceExpansionSnapshotUtils.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url)));
const snapshot = read('sourceExpansionSnapshot.json');
const manifest = read('sourceExpansionReviewedMappings.json');
assert.deepEqual(validateExpansionSnapshot(snapshot, manifest), {
  datasets: 22, sourceRecords: 1627, reviewedMappings: 328, reviewedTargets: 637,
});
assert.equal(EXPANSION_METRICS.length, 33);
assert.doesNotMatch(JSON.stringify({snapshot, manifest, metrics: EXPANSION_METRICS}), /opencompass|司南/iu, 'Removed source data must not remain in snapshots or mappings.');
const definitions = new Map(EXPANSION_METRICS.map(metric => [metric.id, metric]));
const admitted = new Set(manifest.entries.map(entry => entry.recordId));
assert.equal(new Set(snapshot.records.filter(record => admitted.has(record.id))
  .flatMap(record => record.observations.filter(observation => observation.rawValue !== null).map(observation => observation.metricId))).size, 33);

for (const record of snapshot.records) {
  assert.match(record.sourceDate, /^\d{4}-\d{2}-\d{2}$/u);
  assert.match(record.sha256, /^[a-f\d]{64}$/u);
  for (const observation of record.observations) {
    assert.equal(definitions.get(observation.metricId).sourceType, record.source);
    assert.equal(definitions.get(observation.metricId).benchmarkVersion, observation.benchmarkVersion);
  }
  if (record.identity.ambiguousIdentity) assert.equal(admitted.has(record.id), false,
    'Conflicting DesignArena rows must remain excluded, even if one score is higher.');
}
assert.ok(snapshot.records.some(record => record.identity.ambiguousIdentity));
for (const entry of manifest.entries) {
  assert.equal(/openai\/gpt-6-(?:astra|luna)-pro-/u.test(entry.baseSourceRecordId), false,
    'Distinct Pro products cannot supply ordinary Astra/Luna evidence.');
}

assert.deepEqual(parseCsv('model,value,note\r\n"a,b",0,"two\nlines"\r\nb,,"a""b"\r\n'), [
  { model: 'a,b', value: '0', note: 'two\nlines' }, { model: 'b', value: null, note: 'a"b' },
]);
assert.throws(() => parseCsv('a,a\n1,2\n'), /columns/u);
assert.throws(() => parseCsv('a,b\n"broken'), /Unterminated/u);

const dataset = id => ({ id, url: 'https://example.test/source', fetchedAt: '2026-10-24T12:00:00Z', sha256: 'a'.repeat(64) });
const liveDataset = { ...dataset('livebench2'), modelSettings: { a: { displayName: 'A', effort: 'high' } } };
const live = normalizeExpansionDataset(liveDataset, 'model,long_agentic,reasoning,coding,browser,data_analysis,research,design\na,0,80,,n/a,40,20,60\n')[0];
assert.equal(live.observations.find(row => row.metricId === 'livebench2_long_agentic').rawValue, 0);
assert.equal(live.observations.find(row => row.metricId === 'livebench2_coding').rawValue, null);
assert.equal(live.observations.find(row => row.metricId === 'livebench2_browser').rawValue, null);
assert.equal(live.observations.find(row => row.metricId === 'livebench2_reasoning').rawValue, .8);
assert.throws(() => normalizeExpansionDataset(liveDataset, 'model,long_agentic,reasoning,coding,browser,data_analysis,research,design\na,101,80,20,10,40,20,60\n'), /scale/u);
assert.throws(() => normalizeExpansionDataset(dataset('livebench2'), 'model,long_agentic\na,0\n'), /columns/u);
const settingsSource = 'const m={"claude-opus-5.5":{displayName:"Opus",effort:"max",url:"https://example.test/opus"},"gemini-4-argon":{displayName:"Argon",effort:"high",url:"https://example.test/argon"}};globalThis.livebenchSettingsExecuted=true;';
assert.equal(extractLivebenchModelSettings(settingsSource)['gemini-4-argon'].effort, 'high');
assert.equal(globalThis.livebenchSettingsExecuted, undefined, 'Public model metadata is parsed without executing its JavaScript.');
assert.throws(() => extractLivebenchModelSettings(settingsSource.replace('effort:"high"', 'effort:fetch("/private")')), /Missing/u);

const epoch = normalizeExpansionDataset(dataset('epoch-mirrorcode'), [{ id: 'run-a',
  'Model version': 'gemini-4-argon_high', 'Started at': '2026-10-14T00:00:00Z',
  'Release date': '2026-09-30', mean_score: '0.2', 'Best score (across scorers)': '0.9', stderr: '0.03' }])[0];
assert.equal(epoch.observations[0].rawValue, .2, 'Use the selected run mean, not Best score.');
assert.equal(epoch.observations[0].standardError, .03);
assert.equal(epoch.observations[0].confidenceLow, undefined);
assert.equal(epoch.observations[0].confidenceHigh, undefined);

const sourceDrift = structuredClone(snapshot);
sourceDrift.records.find(record => admitted.has(record.id)).identity.modelPermaslug = 'different/model-version';
assert.throws(() => validateExpansionSnapshot(sourceDrift, manifest), /needs review/u);
const versionDrift = structuredClone(snapshot);
versionDrift.records[0].observations[0].benchmarkVersion = 'unreviewed-next-version';
assert.throws(() => validateExpansionSnapshot(versionDrift, manifest), /version/u);
assert.throws(() => validateExpansionSnapshot({ ...snapshot, records: [...snapshot.records, snapshot.records[0]] }, manifest), /Duplicate/u);
console.log('Expanded source extraction, exact versions, missing/zero scales, mean-vs-best, uncertainty, duplicate and mirror guards: PASS');
