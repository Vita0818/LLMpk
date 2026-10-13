import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detailedModelRecords } from './artificialAnalysisModelExtraction.mjs';
import { gdpPdfComparisonRecords, mergePublishedGdpPdfRecords } from './artificialAnalysisProfessionalExtraction.mjs';

// The AA transport split release metadata from effort-specific records.
// An intentionally different release slug proves the join uses the published
// relation, rather than parsing/guessing a date from a model name.
const detailed = Array.from({ length: 100 }, (_, index) => ({
  slug: `test-model-${index}-high`,
  name: `Test model ${index} (High)`,
  intelligenceIndex: index,
  modelCreatorName: 'Test publisher',
  terminalBench21: index / 100,
}));
const releases = detailed.map((_, index) => ({
  slug: `publisher-release-${index}`,
  name: `Test model ${index}`,
  releaseDate: '2026-09-29',
  creator: { slug: 'test-publisher', name: 'Test publisher' },
}));
const options = detailed.map((model, index) => ({
  slug: model.slug,
  name: model.name,
  releaseSlug: releases[index].slug,
}));
const extract = (metadata) => detailedModelRecords(JSON.stringify({
  ...metadata,
  leaderboard: { models: detailed },
}));
const current = extract({ modelReleases: { releases, models: options } });
assert.equal(current.length, 100);
assert.equal(current[0].releaseDate, '2026-09-29');
assert.equal(current[0].releaseSlug, 'publisher-release-0');
assert.equal(current[0].modelCreatorSlug, 'test-publisher');
assert.equal(current[0].terminalbenchV21, 0);
const legacy = extract({ identities: { models: detailed.map((model) => ({
  slug: model.slug,
  name: model.name,
  releaseDate: '2026-07-01',
  creator: { id: 'publisher-uuid', name: 'Test publisher' },
})) } });
assert.equal(legacy[0].releaseDate, '2026-07-01');
assert.equal(legacy[0].modelCreatorId, 'publisher-uuid');
const unknown = extract({ modelReleases: {
  releases: releases.slice(1),
  models: options,
} });
assert.equal(unknown[0].releaseDate, null, 'An unmatched release must remain missing.');

const professionalIdentities = new Map([
  ['model-max', {id:'model-max',slug:'model-max',name:'Model (Max)',releaseDate:'2026-10-07'}],
  ['model-high', {id:'model-high',slug:'model-high',name:'Model (High)',releaseDate:'2026-10-07'}],
]);
const professionalPayload = {models:[
  {id:'uuid-max',slug:'model-max',name:'Model (Max)',releaseDate:'2026-10-07',gdpPdfAllPass:0},
  {id:'uuid-high',slug:'model-high',name:'Model (High)',releaseDate:'2026-10-07',gdpPdfAllPass:0.2},
  {id:'unknown',slug:'unreviewed-model',name:'Model (Max)',gdpPdfAllPass:0.9},
  {slug:'model-missing',gdpPdfAllPass:null},
]};
const professionalRows = gdpPdfComparisonRecords(JSON.stringify(professionalPayload), professionalIdentities);
assert.deepEqual(professionalRows.map(row=>[row.id,row.gdpPdfAllPass]).sort(), [['model-high',0.2],['model-max',0]]);
const framedProfessionalPayload = 'e:'+JSON.stringify({currentModel:professionalPayload.models[0],models:[professionalPayload.models[1]]})+'\nf:I[123,[]]\n';
assert.deepEqual(gdpPdfComparisonRecords(framedProfessionalPayload,professionalIdentities),professionalRows,
  'The profile model itself must accompany its peer comparison array.');
assert.equal(mergePublishedGdpPdfRecords([professionalRows[0]], professionalRows).length, 2,
  'Public model comparisons supplement the initial chart subset with exact source rows.');
assert.throws(()=>mergePublishedGdpPdfRecords([{...professionalRows[0],gdpPdfAllPass:0.1}],professionalRows), /Conflicting/u);
const changedProfessionalRelease=structuredClone(professionalPayload);
changedProfessionalRelease.models[0].releaseDate='2026-10-08';
assert.throws(()=>gdpPdfComparisonRecords(JSON.stringify(changedProfessionalRelease),professionalIdentities), /release changed/u);

// Exercise the actual Arena HTML extractor for both upstream field names.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'llmpk-source-extraction-'));
const script = fileURLToPath(new URL('./build-arena-raw-extraction.mjs', import.meta.url));
const html = (payload) => `<script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(payload)])})</script>`;
const snapshotFiles = [
  'arena_text_instruction', 'arena_text_multiturn', 'arena_text_creative',
  'arena_text_hard', 'arena_text_math', 'arena_text_coding',
  'arena_code_webdev', 'arena_search',
];
try {
  for (const name of snapshotFiles) {
    fs.writeFileSync(path.join(directory, `arena_subpage_${name}.html`), html({
      leaderboard: { entries: [{ modelKey: 'test-model', rating: 1234, rank: 1 }] },
    }));
  }
  const run = (signals, environment = {}) => {
    fs.writeFileSync(path.join(directory, 'arena_subpage_arena_agent.html'), html({
      snapshot: { rows: [{ model: 'Test model', rank: 1, signalScores: {
        task_outcome_explicit: 0.1, praise_complaint: 0.2,
        bash_recovery_steps: 0.3, tool_hallucination: 0.01, ...signals,
      } }] },
    }));
    return spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, ARENA_SNAPSHOT_DIR: directory,
        ARENA_RAW_EXTRACTION_OUTPUT: path.join(directory, 'out.json'), ...environment },
    });
  };
  for (const field of ['steerability', 'steering_burden']) {
    const result = run({ [field]: -0.0123 });
    assert.equal(result.status, 0, result.stderr);
    const rows = JSON.parse(fs.readFileSync(path.join(directory, 'out.json')))
      .metrics.arena_agent_steerability.rows;
    assert.equal(rows[0].rawValue, -0.0123, 'Copy the source value without changing scale or sign.');
    assert.equal(rows[0].sourceRecord.signalScores[field], -0.0123);
  }
  fs.copyFileSync(path.join(directory, 'out.json'), path.join(directory, 'previous.json'));
  const replacedRecovery = { steering_burden: -0.0123, bash_recovery_steps: null, bash_reliability_no_prereq: 0.08 };
  assert.notEqual(run(replacedRecovery).status, 0, 'A different Bash signal must not silently occupy the recovery slot.');
  const retained = run(replacedRecovery, { ARENA_PREVIOUS_EXTRACTION_PATH: path.join(directory, 'previous.json') });
  assert.equal(retained.status, 0, retained.stderr);
  const retainedRecovery = JSON.parse(fs.readFileSync(path.join(directory, 'out.json'))).metrics.arena_agent_bash_recovery;
  assert.equal(retainedRecovery.rows[0].rawValue, 0.3);
  assert.equal(retainedRecovery.rows[0].sourceRecord.signalScores.bash_recovery_steps, 0.3);
  assert.ok(retainedRecovery.retention.reason.includes('different task'));
  assert.notEqual(run({}).status, 0, 'A missing source signal must still fail closed.');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log('AA release identities and Arena source signal extraction: PASS');
