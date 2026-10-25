import assert from 'node:assert/strict';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import aaSnapshot from '../src/data/artificialAnalysisSourceSnapshot.json';
import arenaSnapshot from '../src/data/arenaRawExtraction.json';
import valsSnapshot from '../src/data/valsSourceSnapshot.json';
import valsReviews from '../src/data/valsReviewedMappings.json';
import { ALL_CONFIGURATION_PRESET_CANDIDATES, BUILT_IN_CONFIGURATION_PRESETS, BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT } from '../src/data/builtInConfigurationPresets';
import { READER_MODEL_ARCHIVALS } from '../src/data/readerModelRetirementPolicy';
import { CURRENT_COHORT_SNAPSHOT } from '../src/data/cohortMetadata';
import { VERIFIED_SOURCE_MODEL_CARDS, VERIFIED_SOURCE_OBSERVATIONS } from '../src/data/seedCards';
import { VERIFIED_HARNESS_SOURCE_MODEL_CARDS, VERIFIED_HARNESS_SOURCE_OBSERVATIONS } from '../src/data/harnessSeedCards';
import { buildValsSourceCards, type ValsSnapshot, type ValsReviewedManifest } from '../src/data/valsSeedCards';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import { SCORING_CONFIG } from '../src/engine/scoringConfig';
import { buildRepresentativeConfigurationQueue } from '../src/utils/playModeQueue';
import type { SourceModelCard, SourceObservation } from '../src/types/admin_mapping';

Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore();
store.resetToLatestVerifiedCatalog();
const installation = store.synchronizeBuiltInConfigurationPresets(true);
assert.equal(installation.invalidPresetCount, 0);
assert.equal(installation.unresolvedSourceCardCount, 0);
assert.equal(installation.mismatchedSourceCardCount, 0);
assert.equal(installation.installedBoxCount, 49);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.length, 49);
assert.equal(BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT, 33);
assert.equal(CURRENT_COHORT_SNAPSHOT.totalConfigs, publicSnapshot.scores.length);
assert.equal(CURRENT_COHORT_SNAPSHOT.snapshotDate, '2026-10-24');
assert.equal(buildRepresentativeConfigurationQueue(publicSnapshot.scores).length, 35);
for (const line of [...READER_MODEL_ARCHIVALS.map(entry => entry.modelGroupKey), 'muse_spark_13']) {
  assert.equal(BUILT_IN_CONFIGURATION_PRESETS.some(preset => preset.productLineId === line), false,
    'Archiving a series removes all its API, subscription and harness routes.');
  assert.equal(ALL_CONFIGURATION_PRESET_CANDIDATES.some(preset => preset.productLineId === line), true,
    'Historical candidate identities remain available for provenance.');
}

const scores = store.computeLeaderboardScores();
const scoreFor = (line: string) => {
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find(preset => preset.productLineId === line)!;
  assert.ok(preset, `${line} must have its reviewed configuration.`);
  const box = store.boxes.find(box => box.builtInPresetId === preset.id)!;
  assert.ok(box);
  return scores.find(score => score.config.id === box.id)!;
};
const kimi = scoreFor('kimi_k31_pro');
assert.equal(kimi.config.identity.modelName, 'Kimi K3.1 Pro');
assert.equal(kimi.config.valsData, undefined, 'K3 Vals runs cannot be relabelled as K3.1 Pro.');
assert.equal(kimi.config.observations.aa_coding_agent_index, undefined, 'The K3 Code CLI run remains a different model.');
assert.equal(kimi.domainScores.chatting.coverage, 0);
assert.equal(kimi.rawCapabilityScore, null);
assert.equal(kimi.config.openRouterData?.inputPricePerMToken, 2);
assert.equal(kimi.config.openRouterData?.outputPricePerMToken, 10);

const deepseek = scoreFor('deepseek_v41_flash_1017');
assert.ok(deepseek.config.execution.harness.startsWith('DeepSeek Harness'));
assert.equal(deepseek.config.valsData?.length, 9);
assert.equal(deepseek.config.observations.arena_agent_bash_recovery, undefined);
assert.equal(deepseek.config.observations.frontiercode_v11_main_pass_rate, undefined,
  'The dated 0910 Chisel run is not a 1017 DeepSeek Harness pass rate.');
assert.equal(deepseek.domainScores.chatting.coverage, 0.25,
  'The exact 1017 OpenCompass row supplies independent interaction evidence; older Arena rows stay absent.');
assert.equal(deepseek.rawCapabilityScore, null);
for (const line of ['kimi_k3', 'deepseek_v41_flash']) {
  assert.equal(BUILT_IN_CONFIGURATION_PRESETS.some(preset => preset.productLineId === line), false);
}
const deepseekCardId = 'card-aa-coding-agent-deepseek-harness-deepseek-v4-1-flash-1017-max';
const deepseekAgent = aaSnapshot.codingAgentRecords.find(row => row.displayLabel.startsWith('DeepSeek Harness - DeepSeek V4.1 Flash 1017'))!;
assert.equal(VERIFIED_HARNESS_SOURCE_OBSERVATIONS.find(row => row.sourceModelCardId === deepseekCardId
  && row.metricId === 'aa_coding_agent_index')?.rawValue, deepseekAgent.indexScore);
assert.equal(VERIFIED_HARNESS_SOURCE_MODEL_CARDS.find(card => card.id === deepseekCardId)
  ?.metadataJson?.execution?.hostModelSlug, null,
  'A removed upstream private host alias stays unknown, rather than inheriting a historical alias.');
assert.equal(VERIFIED_HARNESS_SOURCE_OBSERVATIONS.some(row => row.sourceModelCardId === deepseekCardId
  && ['aa_coding_agent_deepswe', 'aa_coding_agent_terminalbench_v2'].includes(row.metricId)), false);

const minimax = scoreFor('minimax_m31_flash');
assert.equal(minimax.config.valsData?.length, 6);
for (const id of ['vals_finance_agent_v2', 'vals_excel_modeling_v1', 'vals_code_migration_v1']) {
  assert.equal(minimax.config.observations[id], undefined,
    'An unpublished M3.1 standalone run must not borrow M3 results or an index subset.');
}
const spark = scoreFor('muse_spark_open');
assert.ok(spark.config.name.startsWith('Muse Spark Open XHigh'));
assert.equal(spark.config.observations.arena_code_webdev?.rawValue,
  arenaSnapshot.metrics.arena_code_webdev.rows.find(row => row.exactSourceModelName === 'Muse Spark Open (Max)')!.rawValue,
  'Use the available same-model Max grade while retaining its actual tier.');
assert.equal(spark.config.observations.arena_code_webdev?.benchmarkEvidence?.sourceProfile, 'Max');
assert.equal(spark.config.observations.arena_code_webdev?.benchmarkEvidence?.profileFallback, true);
assert.equal(spark.config.valsData?.length, 9);
for (const line of ['gemini_4_argon']) {
  assert.equal(scoreFor(line).eligibleForGlobalLeaderboard, true,
    `${line} now has enough independently published evidence under the unchanged gates.`);
}
for (const line of ['muse_wonder', 'claude_haiku_55']) {
  assert.equal(scoreFor(line).availableDomainCount, 6);
  assert.ok(scoreFor(line).overallCoverage < SCORING_CONFIG.coverage.overallMinimum);
  assert.equal(scoreFor(line).eligibleForGlobalLeaderboard, false);
}
assert.equal(scoreFor('muse_wonder_full').domainScores.chatting.coverage, 0);

assert.equal(SCORING_CONFIG.coverage.officialMinimum, 0.6);
assert.equal(SCORING_CONFIG.coverage.overallMinimum, 0.75);
assert.equal(ALL_METRIC_DEFINITIONS.find(metric => metric.id === 'vals_hlab_v11')?.internalWeightInDomain, 0.08);
assert.equal(ALL_METRIC_DEFINITIONS.some(metric => metric.id === 'vals_hlab_v1'), false);
for (const score of publicSnapshot.scores) {
  assert.equal(Object.hasOwn(score.config.observations, 'vals_hlab_v1'), false);
  const hlab = score.config.valsData?.find(row => row.metricId === 'vals_hlab_v11');
  if (hlab) assert.equal(hlab.benchmarkVersion, '1.1');
}
const fable = scoreFor('claude_fable_51');
assert.equal(fable.config.observations.vals_hlab_v11, undefined, 'A model absent from HLAB 1.1 stays missing.');
const wrongVersion = structuredClone(valsSnapshot) as unknown as ValsSnapshot;
wrongVersion.benchmarks.find(benchmark => benchmark.metadata.slug === 'hlab')!.metadata.version = '1';
const wrongReviews = structuredClone(valsReviews) as ValsReviewedManifest;
const reviewed = wrongReviews.entries.find(entry => entry.executions.some(execution => execution.benchmarkSlug === 'hlab'))!;
reviewed.executions.find(execution => execution.benchmarkSlug === 'hlab')!.benchmarkVersion = '1';
const bases = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
assert.equal(buildValsSourceCards(wrongVersion, bases, wrongReviews).cards
  .some(card => card.id === `card-vals-${reviewed.key}-hlab`), false,
  'The active metric itself pins 1.1 even when a manifest and payload are both changed to v1.');

const observations = JSON.parse(VERIFIED_SOURCE_OBSERVATIONS) as SourceObservation[];
const command = bases.find(card => card.id === 'card-arena-command-r-08-2024')!;
const commandPlus = bases.find(card => card.id === 'card-arena-command-r-plus-08-2024')!;
assert.ok(command && commandPlus);
assert.notEqual(command.metadataJson?.scope?.productLineId, commandPlus.metadataJson?.scope?.productLineId);
assert.notEqual(observations.find(row => row.sourceModelCardId === command.id && row.metricId === 'arena_text_instruction')?.rawValue,
  observations.find(row => row.sourceModelCardId === commandPlus.id && row.metricId === 'arena_text_instruction')?.rawValue,
  'The literal plus in an upstream key must keep two real model observations separate.');
console.log('October 24 models, serving boundaries, missing-version evidence, HLAB 1.1 and complete snapshot installation: PASS');
