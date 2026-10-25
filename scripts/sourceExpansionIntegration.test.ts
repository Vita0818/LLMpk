import assert from 'node:assert/strict';
import sourceSnapshot from '../src/data/sourceExpansionSnapshot.json';
import reviews from '../src/data/sourceExpansionReviewedMappings.json';
import metrics from '../src/data/sourceExpansionMetricDefinitions.json';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from '../src/data/seedCards';
import { buildExpansionSourceCards, VERIFIED_EXPANSION_SOURCE_MODEL_CARDS,
  VERIFIED_EXPANSION_SOURCE_OBSERVATIONS, UNMATCHED_REVIEWED_EXPANSION_MAPPINGS } from '../src/data/sourceExpansionSeedCards';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import { buildConfigurationMetricRows, formatMetricWeight } from '../src/components/ConfigurationDetailContent';
import { BUILT_IN_CONFIGURATION_PRESETS } from '../src/data/builtInConfigurationPresets';
import type { SourceModelCard } from '../src/types/admin_mapping';
import type { PublicLeaderboardScore } from '../src/types/publicLeaderboard';

const data = sourceSnapshot as unknown as Parameters<typeof buildExpansionSourceCards>[0];
const manifest = reviews as unknown as Parameters<typeof buildExpansionSourceCards>[2];
const bases = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
assert.deepEqual(UNMATCHED_REVIEWED_EXPANSION_MAPPINGS, []);
assert.equal(VERIFIED_EXPANSION_SOURCE_MODEL_CARDS.length, 343);
assert.equal(VERIFIED_EXPANSION_SOURCE_OBSERVATIONS.length, 820);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.length, 49);
assert.equal(ALL_METRIC_DEFINITIONS.length, 108);
assert.equal(formatMetricWeight(.006), '0.6%');
assert.equal(formatMetricWeight(.0075), '0.75%');
assert.equal(formatMetricWeight(.005), '0.5%');
for (const metric of metrics) {
  assert.ok(ALL_METRIC_DEFINITIONS.find(item => item.id === metric.id)!.internalWeightInDomain > 0);
  assert.ok(publicSnapshot.scores.some(score => typeof (score.config.observations as Record<string, { rawValue: unknown }>)[metric.id]?.rawValue === 'number'));
}
for (const entry of manifest.entries) for (const target of entry.targets) {
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find(preset => preset.id === target.presetId)!;
  assert.ok(preset);
  assert.equal(preset.identity.model.name, target.modelName);
  assert.equal(preset.identity.model.profile, target.profile);
  assert.equal(preset.identity.harness.name, target.harness);
  assert.deepEqual(preset.sourceCardLinks?.find(link => link.cardId === `card-expansion-${entry.recordId}`)?.provenance, target.provenance);
}
for (const line of ['muse_spark_open', 'qwen_38_27b', 'mimo_v26_pro', 'inkling', 'step_5_preview', 'nemotron_35_lightning']) {
  const entry = manifest.entries.find(entry => entry.datasetId === 'livebench2' && entry.productLineId === line)!;
  assert.ok(entry, 'Available same-model grades must be attached under the requested policy.');
  assert.ok(entry.targets.every(target => target.provenance.kind === 'available_profile_evidence'));
  for (const target of entry.targets) {
    const preset = BUILT_IN_CONFIGURATION_PRESETS.find(preset => preset.id === target.presetId)!;
    const score = publicSnapshot.scores.find(score => score.config.name === preset.displayName)!;
    assert.ok((score.config.observations as Record<string, { benchmarkEvidence?: { profileFallback?: boolean } }>).livebench2_coding.benchmarkEvidence?.profileFallback);
  }
}

for (const change of ['identity', 'version', 'base', 'duplicate', 'profile', 'harness'] as const) {
  const altered = structuredClone(data); const changedManifest = structuredClone(manifest);
  const record = altered.records.find(record => record.id === changedManifest.entries[0].recordId)!;
  if (change === 'identity') record.identity = { ...record.identity, changedSnapshot: true };
  if (change === 'version') record.observations[0].benchmarkVersion = 'older-version';
  if (change === 'base') changedManifest.entries[0].baseSourceRecordId = 'another/version';
  if (change === 'profile') record.profile = 'another-effort';
  if (change === 'harness') record.harness = 'another-harness';
  if (change === 'duplicate') (altered.records as typeof record[]).push({ ...record });
  assert.ok(buildExpansionSourceCards(altered, bases, changedManifest).unmatchedReviewedMappings.includes(record.id));
}

const argon = publicSnapshot.scores.find(score => score.config.name.startsWith('Gemini 4 Argon'))! as PublicLeaderboardScore;
const rows = buildConfigurationMetricRows(argon);
assert.equal(rows.length, 112);
assert.equal(rows.filter(row => row.weightInDomain! > 0).length, 108);
assert.match(rows.find(row => row.id === 'epoch_mirrorcode_v1')!.title, /SE .*标准误/u);
assert.match(rows.find(row => row.id === 'aa_scicode')!.title, /来源正在复核/u);
assert.equal(rows.find(row => row.id === 'aa_scicode')!.qualityStatus, 'under-review');
assert.equal(rows.find(row => row.id === 'aa_critpt')!.qualityStatus, 'legacy');
assert.match(rows.find(row => row.id === 'livebench2_design')!.title, /来源版本 2\.0\/2026-10-14/u);

Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore(); store.installBuiltInConfigurationPresets();
const fable = store.boxes.find(box => box.builtInPresetId === 'builtin.harness.claude-fable-5-1.max.claude-code')!;
const before = store.buildLLMConfiguration(fable);
assert.ok(before.observations.scale_swe_atlas_refactoring_v1);
const productionCard = VERIFIED_EXPANSION_SOURCE_MODEL_CARDS.find(card => card.metadataJson?.sourceIdentity?.productionHarness === 'Claude Code'
  && card.metadataJson?.scope?.productLineId === 'claude_fable_51')!;
const plain = store.createBox('draft-plain-fable', 'Draft plain Fable');
store.updateBox(plain.id, { identity: { model: { name: 'Claude Fable 5.1', profile: 'Max' }, harness: { name: '---' } } });
assert.ok(store.linkCardToBox(plain.id, productionCard.id));
assert.equal(store.buildLLMConfiguration(store.boxes.find(box => box.id === plain.id)!).observations.scale_swe_atlas_refactoring_v1, undefined,
  'A named Claude Code record cannot fill a plain Chat configuration even through a manual exact link.');
console.log('Expanded source cards, reviewed model/profile/harness links, unified positive weights, public provenance and production CLI isolation: PASS');
