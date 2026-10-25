import assert from 'node:assert/strict';
import snapshot from '../src/data/valsSourceSnapshot.json';
import reviews from '../src/data/valsReviewedMappings.json';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from '../src/data/seedCards';
import {
  buildValsSourceCards, VERIFIED_VALS_SOURCE_MODEL_CARDS, VERIFIED_VALS_SOURCE_OBSERVATIONS,
  UNMATCHED_REVIEWED_VALS_MAPPINGS, type ValsSnapshot, type ValsReviewedManifest,
} from '../src/data/valsSeedCards';
import { BUILT_IN_CONFIGURATION_PRESETS, BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT } from '../src/data/builtInConfigurationPresets';
import { ALL_METRIC_DEFINITIONS, processLLMpkBatchScoring } from '../src/engine/scoringEngine';
import { buildRepresentativeConfigurationQueue } from '../src/utils/playModeQueue';
import { buildConfigurationMetricRows } from '../src/components/ConfigurationDetailContent';
import type { SourceModelCard } from '../src/types/admin_mapping';
import type { PublicLeaderboardSnapshot } from '../src/types/publicLeaderboard';

const data = snapshot as unknown as ValsSnapshot;
const manifest = reviews as unknown as ValsReviewedManifest;
const bases = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
const published = publicSnapshot as unknown as PublicLeaderboardSnapshot;
assert.deepEqual(UNMATCHED_REVIEWED_VALS_MAPPINGS, []);
assert.equal(VERIFIED_VALS_SOURCE_MODEL_CARDS.length, 327);
assert.equal(VERIFIED_VALS_SOURCE_OBSERVATIONS.length, 327);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.length, 49);
assert.equal(BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT, 33);
assert.equal(ALL_METRIC_DEFINITIONS.length, 84);
assert.equal(ALL_METRIC_DEFINITIONS.filter(metric => metric.id.startsWith('vals_')).length, 12);
assert.equal(ALL_METRIC_DEFINITIONS.some(metric => ['vals_index_v22', 'vals_terminalbench_v4'].includes(metric.id)), true);
assert.equal(buildRepresentativeConfigurationQueue(published.scores).length, 35);

for (const review of manifest.entries) {
  for (const execution of review.executions) {
    const cardId = `card-vals-${review.key}-${execution.benchmarkSlug}`;
    const benchmark = data.benchmarks.find(item => item.metadata.slug === execution.benchmarkSlug)!;
    const raw = benchmark.tasks[execution.task][review.modelId];
    const observation = VERIFIED_VALS_SOURCE_OBSERVATIONS.find(item => item.sourceModelCardId === cardId)!;
    const refusal = benchmark.refusalFallback?.[review.modelId];
    const cleaned = refusal?.status === 'available' && refusal.fallbacks > 0;
    assert.equal(observation.rawValue, cleaned ? refusal.noFallbackScorePct / 100 : raw.accuracy === null ? null : raw.accuracy / 100);
    assert.equal(observation.metadataJson?.standardError, !cleaned && typeof raw.stderr === 'number' ? raw.stderr / 100 : null);
    assert.equal(observation.confidenceLow, undefined, 'Standard errors must not become invented confidence intervals.');
    assert.equal(observation.confidenceHigh, undefined);
    assert.equal(observation.metadataJson?.valsEvidence.sourceUpdated, benchmark.metadata.updated);
    assert.equal(observation.metadataJson?.valsEvidence.sourceHarness, raw.harness ?? null);
  }
}

const museKey = 'meta-muse-spark-1-3';
const maxKey = 'meta-muse-spark-1-3-max';
const museId = `card-vals-${museKey}-vibe-code`;
const maxId = `card-vals-${maxKey}-vibe-code`;
const museScore = VERIFIED_VALS_SOURCE_OBSERVATIONS.find(item => item.sourceModelCardId === museId)!;
const maxScore = VERIFIED_VALS_SOURCE_OBSERVATIONS.find(item => item.sourceModelCardId === maxId)!;
assert.notEqual(museScore.rawValue, maxScore.rawValue);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.some(preset => preset.sourceCardLinks?.some(link => link.cardId === maxId)), false);
const withoutXHigh = structuredClone(data);
for (const benchmark of withoutXHigh.benchmarks) delete benchmark.tasks.overall['meta/muse_spark_1_3'];
const missing = buildValsSourceCards(withoutXHigh, bases, manifest);
assert.equal(missing.cards.some(card => card.id === museId), false);
assert.equal(missing.cards.some(card => card.id === maxId), true, 'Max stays separately addressable and never fills missing XHigh.');
const wrongVersion = structuredClone(manifest);
wrongVersion.entries[0].canonicalModelVersion = 'anthropic/claude-fable-5-20260609';
assert.ok(buildValsSourceCards(data, bases, wrongVersion).unmatchedReviewedMappings.length > 0);
const duplicateBenchmark = { ...data, benchmarks: [...data.benchmarks, data.benchmarks.find(item => item.metadata.slug === 'vibe-code')!] };
assert.equal(buildValsSourceCards(duplicateBenchmark, bases, manifest).cards.some(card => card.id === museId), false);
for (const preset of BUILT_IN_CONFIGURATION_PRESETS.filter(preset => preset.productLineId === 'qwen_38_max')) {
  assert.equal(preset.sourceCardLinks?.some(link => link.cardId.startsWith('card-vals-')) ?? false, false);
}

const sonnet = published.scores.find(score => score.config.name.startsWith('Claude Sonnet 5.5'))!;
const migration = sonnet.config.valsData!.find(row => row.metricId === 'vals_code_migration_v1')!;
const index = data.benchmarks.find(item => item.metadata.slug === 'vals_index')!;
assert.equal(migration.rawValue, 0.69825);
assert.notEqual(migration.rawValue, index.tasks.code_migration['anthropic/claude-sonnet-5-5'].accuracy! / 100,
  'The standalone full migration run must not be replaced by the index subset.');
assert.equal(sonnet.config.valsData!.find(row => row.metricId === 'vals_index_v22')!.hasRefusalFallbackNotice, true);
assert.equal(sonnet.config.valsData!.find(row => row.metricId === 'vals_vibe_code_v11')!.sourceHarness, 'OpenHands');
assert.equal(buildConfigurationMetricRows(sonnet).length, 88, 'All 84 weighted metrics and four practical fields share one list.');
const migrationRow = buildConfigurationMetricRows(sonnet).find(row => row.id === 'vals_code_migration_v1')!;
assert.equal(migrationRow.value, '69.8%');
assert.equal(migrationRow.sourceUrl, migration.sourceUrl);
assert.match(migrationRow.title, /SE/u);
assert.match(migrationRow.title, /来源更新/u);
const zero = structuredClone(sonnet);
zero.config.observations.vals_index_v22.rawValue = 0;
assert.equal(buildConfigurationMetricRows(zero).find(row => row.id === 'vals_index_v22')!.value, '0.0%');
zero.config.observations.vals_index_v22.rawValue = null;
assert.equal(buildConfigurationMetricRows(zero).find(row => row.id === 'vals_index_v22')!.value, '--');

Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore();
store.installBuiltInConfigurationPresets();
assert.equal(store.cards.filter(card => card.source === 'vals').length, 327);
const scores = store.computeLeaderboardScores();
assert.equal(scores.filter(score => score.config.valsData?.length).length, 39);
const altered = processLLMpkBatchScoring(scores.map(score => ({
  ...score.config, valsData: undefined,
  observations: Object.fromEntries(Object.entries(score.config.observations).map(([id, row]) => [id,
    id.startsWith('vals_') ? { ...row, rawValue: 1 } : row])),
})));
for (const score of scores) {
  const comparison = altered.find(item => item.config.id === score.config.id)!;
  assert.deepEqual(score.domainScores.chatting, comparison.domainScores.chatting);
  assert.equal(score.practicalBreakdown.costDelta, comparison.practicalBreakdown.costDelta, 'Vals task cost must not overwrite API price.');
  assert.equal(score.practicalBreakdown.speedDelta, comparison.practicalBreakdown.speedDelta, 'Vals duration must not overwrite TTFT.');
}
assert.ok(scores.some(score => score.rawCapabilityScore !== altered.find(item => item.config.id === score.config.id)!.rawCapabilityScore),
  'Changing a selected Vals observation must affect v3.4 capability scores.');
const opus = published.scores.find(score => score.config.name.startsWith('Claude Opus 5.5'))!;
const opusMigration = opus.config.valsData!.find(row => row.metricId === 'vals_code_migration_v1')!;
assert.equal(opusMigration.rawValue, 18.416 / 100);
assert.equal(opusMigration.publishedRawValue, 66.646 / 100);
assert.equal(opusMigration.scoreBasis, 'no-fallback');
assert.equal(opusMigration.fallbackCount, 106);
assert.equal(opusMigration.standardError, null, 'Published mixed-run uncertainty cannot be reused for the cleaned score.');
const fallbackBox = store.boxes.find(box => {
  const links = store.getLinkedCardStack(box.id, 'vals');
  return links.length > 0 && links.every(({ link }) => Boolean(link.provenance && link.provenance.kind !== 'exact'));
})!;
assert.ok(fallbackBox);
store.updateBox(fallbackBox.id, { identity: { ...fallbackBox.identity,
  model: { ...fallbackBox.identity?.model, profile: 'Low' },
} });
assert.equal(store.getLinkedCardStack(fallbackBox.id, 'vals').length, 0,
  'An authored upward profile link must stop supplying evidence after the target identity changes.');

console.log(`Vals reviewed version/effort links, official no-fallback scores, source isolation and v3.4 scoring: PASS (${VERIFIED_VALS_SOURCE_MODEL_CARDS.length} cards, ${scores.filter(score => score.config.valsData?.length).length} configurations)`);
