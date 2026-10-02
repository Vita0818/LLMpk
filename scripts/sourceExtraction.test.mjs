import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detailedModelRecords } from './artificialAnalysisModelExtraction.mjs';

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
  const run = (signals) => {
    fs.writeFileSync(path.join(directory, 'arena_subpage_arena_agent.html'), html({
      snapshot: { rows: [{ model: 'Test model', rank: 1, signalScores: {
        task_outcome_explicit: 0.1, praise_complaint: 0.2,
        bash_recovery_steps: 0.3, tool_hallucination: 0.01, ...signals,
      } }] },
    }));
    return spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, ARENA_SNAPSHOT_DIR: directory,
        ARENA_RAW_EXTRACTION_OUTPUT: path.join(directory, 'out.json') },
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
  assert.notEqual(run({}).status, 0, 'A missing source signal must still fail closed.');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log('AA release identities and Arena source signal extraction: PASS');
