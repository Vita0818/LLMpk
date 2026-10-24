import assert from 'node:assert/strict';
import snapshot from '../src/data/designArenaSourceSnapshot.json';
import reviews from '../src/data/designArenaReviewedMappings.json';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import {
  buildDesignArenaSourceCards, VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS,
  VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS, UNMATCHED_REVIEWED_DESIGN_ARENA_MAPPINGS,
} from '../src/data/designArenaSeedCards';
import { VERIFIED_SOURCE_MODEL_CARDS } from '../src/data/seedCards';
import { BUILT_IN_CONFIGURATION_PRESETS } from '../src/data/builtInConfigurationPresets';
import { READER_CURRENT_MODEL_GROUP_KEYS, RETIRED_READER_MODEL_GROUP_KEYS } from '../src/data/readerModelRetirementPolicy';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import type { SourceModelCard } from '../src/types/admin_mapping';

const baseCards = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
assert.equal(snapshot.schemaVersion, 'design-arena-source-snapshot/v2');
assert.ok(snapshot.rows.length >= reviews.entries.length);
assert.equal(snapshot.responseMeta.model_count, new Set(snapshot.rows.map(row => row.model_permaslug)).size);
assert.equal(snapshot.lastUpdated, null);
assert.equal(snapshot.sourceAsOf, snapshot.responseMeta.as_of);
assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS.length, 17);
assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS.length, 17);
assert.deepEqual(UNMATCHED_REVIEWED_DESIGN_ARENA_MAPPINGS, []);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.length, 49);
assert.equal(READER_CURRENT_MODEL_GROUP_KEYS.size, 33);
assert.equal(ALL_METRIC_DEFINITIONS.length, 48);
assert.equal(ALL_METRIC_DEFINITIONS.find(metric => metric.id === 'designarena_frontend')?.internalWeightInDomain, 0.3);

const targetIds = new Set<string>();
for (const review of reviews.entries) {
  const sourceRows = snapshot.rows.filter(row => row.arena === review.source.arena
    && row.category === review.source.category && row.model_permaslug === review.source.modelPermaslug
    && row.display_name === review.source.displayName);
  assert.equal(sourceRows.length, 1);
  const observation = VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS.find(row => row.sourceModelCardId === review.cardId)!;
  assert.equal(observation.rawValue, sourceRows[0].elo);
  assert.equal(observation.metadataJson?.sourceSampleCount, null);
  assert.equal(observation.metadataJson?.uncertaintyStatus, 'unknown');
  assert.equal(observation.metadataJson?.sourceLastUpdated, null);
  assert.equal(observation.confidenceLow, undefined);
  assert.equal(observation.confidenceHigh, undefined);
  assert.equal(observation.metadataJson?.sourceEnvironment, 'DesignArena Models Arena / codecategories');
  assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS.find(card => card.id === review.cardId)
    ?.metadataJson?.sourceIdentity?.canonicalModelVersion, review.canonicalModelVersion);
  for (const target of review.targets) {
    assert.equal(targetIds.has(target.presetId), false);
    targetIds.add(target.presetId);
    const preset = BUILT_IN_CONFIGURATION_PRESETS.find(preset => preset.id === target.presetId)!;
    assert.ok(preset, 'Reviewed targets must remain in the existing inventory.');
    assert.equal(preset.productLineId, review.productLineId);
    assert.equal(preset.identity.model.name, target.modelName);
    assert.equal(preset.identity.model.profile, target.profile);
    assert.equal(preset.identity.harness.name, target.harness);
    const link = preset.sourceCardLinks?.find(link => link.cardId === review.cardId);
    assert.deepEqual(link?.provenance, target.provenance);
    const score = publicSnapshot.scores.find(score => score.config.name === preset.displayName)!;
    assert.equal(score.config.observations.designarena_frontend?.rawValue, sourceRows[0].elo);
    const webdev = score.config.observations.arena_code_webdev?.rawValue;
    const vibeCode = (score.config.observations as Record<string, { rawValue: number | null }>).vals_vibe_code_v11?.rawValue;
    const expectedCoverage = 0.3 + (Number.isFinite(webdev) ? 0.4 : 0) + (Number.isFinite(vibeCode) ? 0.3 : 0);
    assert.ok(Math.abs(score.domainScores.frontend.coverage - expectedCoverage) < 1e-12);
    if (expectedCoverage + Number.EPSILON < 0.6) {
      assert.equal(score.domainScores.frontend.score, null);
      assert.equal(score.eligibleForGlobalLeaderboard, false);
    }
  }
}
assert.equal(targetIds.size, 21);
for (const preset of BUILT_IN_CONFIGURATION_PRESETS) {
  const designLinks = preset.sourceCardLinks?.filter(link => link.cardId.startsWith('card-designarena-')) ?? [];
  assert.equal(designLinks.length, targetIds.has(preset.id) ? 1 : 0);
}
for (const exclusion of reviews.exclusions) {
  const presets = BUILT_IN_CONFIGURATION_PRESETS.filter(preset => preset.productLineId === exclusion.productLineId);
  if (RETIRED_READER_MODEL_GROUP_KEYS.has(exclusion.productLineId)) {
    assert.equal(presets.length, 0, 'Historical exclusion records cannot reinstall an archived model.');
    continue;
  }
  assert.ok(presets.length > 0);
  for (const preset of presets) {
    const score = publicSnapshot.scores.find(score => score.config.name === preset.displayName)!;
    assert.equal(score.config.observations.designarena_frontend?.rawValue, undefined,
      'A missing version must not borrow its predecessor or a different product.');
  }
}

const museXHigh = 'card-designarena-muse-spark-13-xhigh';
const museMax = 'card-designarena-muse-spark-13-max';
const sourceXHigh = snapshot.rows.find(row => row.display_name === 'Muse Spark 1.3 (xhigh)')!;
const sourceMax = snapshot.rows.find(row => row.display_name === 'Muse Spark 1.3 Max')!;
assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS.find(row => row.sourceModelCardId === museXHigh)?.rawValue, sourceXHigh.elo);
assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS.find(row => row.sourceModelCardId === museMax)?.rawValue, sourceMax.elo);
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.some(preset => preset.sourceCardLinks?.some(link => link.cardId === museMax)), false);
const withoutXHigh = buildDesignArenaSourceCards({ ...snapshot,
  rows: snapshot.rows.filter(row => row.display_name !== 'Muse Spark 1.3 (xhigh)'),
}, baseCards);
assert.equal(withoutXHigh.cards.some(card => card.id === museXHigh), false,
  'Removing XHigh must not cause selection of the same-ID Max result.');
assert.equal(withoutXHigh.cards.some(card => card.id === museMax), true);
assert.ok(withoutXHigh.unmatchedReviewedMappings.includes(museXHigh));
const higherMax = buildDesignArenaSourceCards({ ...snapshot,
  rows: snapshot.rows.map(row => row.display_name === 'Muse Spark 1.3 Max' ? { ...row, elo: 2450 } : row),
}, baseCards);
assert.equal(higherMax.observations.find(row => row.sourceModelCardId === museXHigh)?.rawValue, sourceXHigh.elo,
  'A higher-scoring Max row must not replace the reviewed XHigh configuration.');
const wrongVersion = buildDesignArenaSourceCards({ ...snapshot,
  rows: snapshot.rows.map(row => row.display_name === 'Muse Spark 1.3 (xhigh)'
    ? { ...row, model_permaslug: 'meta/muse-spark-1.2-20260805' } : row),
}, baseCards);
assert.equal(wrongVersion.cards.some(card => card.id === museXHigh), false);
const duplicatedSource = buildDesignArenaSourceCards({ ...snapshot,
  rows: [...snapshot.rows, snapshot.rows.find(row => row.display_name === 'Muse Spark 1.3 (xhigh)')!],
}, baseCards);
assert.equal(duplicatedSource.cards.some(card => card.id === museXHigh), false);
const conflictingBase = buildDesignArenaSourceCards(snapshot, [...baseCards,
  { ...baseCards.find(card => card.id === 'card-openrouter-meta-muse-spark-1-3')! },
]);
assert.equal(conflictingBase.cards.some(card => card.id === museXHigh), false);

Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore();
store.installBuiltInConfigurationPresets();
const opus = store.boxes.find(box => box.builtInPresetId === 'builtin.harness.claude-opus-5-5.max.claude-code')!;
assert.ok(store.getLinkedCardStack(opus.id).some(({ card }) => card.id === 'card-designarena-claude-opus-55-default'));
store.updateBox(opus.id, { identity: { ...opus.identity,
  model: { ...opus.identity?.model, profile: 'Low' },
} });
assert.equal(store.getLinkedCardStack(opus.id).some(({ card }) => card.id === 'card-designarena-claude-opus-55-default'), false,
  'An authored Default-to-Max fallback must be removed after an operator changes the target identity.');

console.log(`DesignArena reviewed model/version/effort links, subscription access variants, missing evidence and runtime fallback authorization: PASS (${VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS.length} source rows, ${targetIds.size} configurations)`);
