import assert from 'node:assert/strict';
import snapshot from '../src/data/publicLeaderboardSnapshot.json';
import weights from '../src/data/capabilityMetricWeights.json';
import { ALL_METRIC_DEFINITIONS, processLLMpkBatchScoring } from '../src/engine/scoringEngine';
import { DOMAIN_IDS, SCORING_CONFIG } from '../src/engine/scoringConfig';
import { buildConfigurationMetricRows } from '../src/components/ConfigurationDetailContent';
import { buildRepresentativeConfigurationQueue } from '../src/utils/playModeQueue';
import type { LLMConfiguration } from '../src/types/llm_pk';

assert.equal(SCORING_CONFIG.version, '3.2');
assert.equal(snapshot.scoringVersion, '3.2');
assert.equal(ALL_METRIC_DEFINITIONS.length, 48);
const definitions = new Map(ALL_METRIC_DEFINITIONS.map(metric => [metric.id, metric]));
assert.deepEqual([...definitions.keys()].sort(), Object.keys(weights).sort());
for (const domain of DOMAIN_IDS) {
  const sum = ALL_METRIC_DEFINITIONS.filter(metric => metric.domain === domain)
    .reduce((total, metric) => total + metric.internalWeightInDomain, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12, `${domain} must retain a complete 100% budget.`);
}
assert.ok(ALL_METRIC_DEFINITIONS.every(metric => metric.internalWeightInDomain > 0));
const budget = (ids: string[]) => ids.reduce((sum, id) => sum + definitions.get(id)!.internalWeightInDomain, 0);
assert.ok(Math.abs(budget(['aa_terminalbench_v4', 'vals_terminalbench_v4', 'tbench_v4',
  'aa_terminalbench_v21', 'aa_coding_agent_terminalbench_v2']) - 0.28) < 1e-12);
assert.ok(Math.abs(budget(['aa_coding_agent_index', 'aa_coding_agent_deepswe', 'aa_coding_agent_swe_atlas_qna']) - 0.15) < 1e-12);
assert.ok(Math.abs(budget(['aa_omniscience_accuracy', 'aa_omniscience_nonhallucination']) - 0.18) < 1e-12);

const observedIds = new Set(snapshot.scores.flatMap(score => Object.keys(score.config.observations)));
assert.deepEqual([...observedIds].sort(), [...definitions.keys()].sort(),
  'Every benchmark already attached to the current cohort must have a positive weight and public field.');
for (const score of snapshot.scores) {
  const rows = buildConfigurationMetricRows(score);
  assert.equal(rows.length, 52);
  assert.deepEqual(rows.slice(0, -4).map(row => row.id).sort(), [...definitions.keys()].sort());
  assert.ok(rows.slice(0, -4).every(row => row.weightInDomain! > 0));
  for (const observation of Object.values(score.config.observations)) {
    assert.match(observation.sourceSnapshotDate, /^\d{4}-\d{2}-\d{2}$/u,
      'Old versions must retain an inspectable source date.');
  }
}
const representatives = buildRepresentativeConfigurationQueue(snapshot.scores);
assert.equal(snapshot.scores.length, 49);
assert.equal(representatives.length, 35);
assert.equal(representatives.filter(score => score.eligibleForGlobalLeaderboard).length, 17);

// Exercise actual aggregation, not merely the presence of configuration values.
// The synthetic cohort gives every metric enough varying observations to carry a signal.
const fixtures: LLMConfiguration[] = Array.from({ length: 12 }, (_, i) => ({
  id: `fixture-${i}`, name: `Fixture ${i}`, provider: 'Test',
  identity: { modelName: `Fixture ${i}`, modelVersion: 'test', reasoningEffort: 'Max', contextWindowTokens: 1 },
  execution: { harness: 'Claude Code', toolPermissions: [] },
  access: { entryPoint: 'Direct Provider API' },
  observations: Object.fromEntries(ALL_METRIC_DEFINITIONS.map(metric => [metric.id, {
    metricId: metric.id, rawValue: metric.metricType === 'accuracy' ? 0.15 + i * 0.06 : 1000 + i * 40,
  }])),
}));
const baseline = processLLMpkBatchScoring(fixtures)[4];
assert.notEqual(baseline.rawCapabilityScore, null);
for (const metric of ALL_METRIC_DEFINITIONS) {
  const changed = structuredClone(fixtures);
  changed[4].observations[metric.id].rawValue = metric.metricType === 'accuracy' ? 0.95 : 1600;
  const result = processLLMpkBatchScoring(changed)[4];
  assert.notEqual(result.domainScores[metric.domain].rawGeometricIndex,
    baseline.domainScores[metric.domain].rawGeometricIndex,
    `${metric.id} must affect the domain's weighted aggregation.`);
}
const missing = structuredClone(fixtures);
missing[4].observations.vals_index_v22.rawValue = null;
const withMissing = processLLMpkBatchScoring(missing)[4];
assert.ok(Math.abs(withMissing.domainScores.agentic.coverage - 0.95) < 1e-12);
assert.equal(withMissing.domainScores.agentic.metricDetails.find(metric => metric.metricId === 'vals_index_v22')!.normalizedScore, null);

console.log('Scoring v3.2: all 48 metrics contribute, shared budgets, complete public display, dated evidence and unchanged coverage gates: PASS');
