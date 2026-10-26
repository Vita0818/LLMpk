import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import publicLeaderboardSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { CURRENT_COHORT_SNAPSHOT } from '../src/data/cohortMetadata';
import { buildPriceTierDataset } from '../src/data/priceTierDataset';
import type { PublicLeaderboardSnapshot } from '../src/types/publicLeaderboard';
import { buildRepresentativeConfigurationQueue } from '../src/utils/playModeQueue';
import { getPriceTier, PRICE_TIER_BOUNDARIES, PRICE_TIERS } from '../src/utils/priceTiers';
import { DEFAULT_PRICE_TIER, priceTierFromHash, priceTierPageHash, rankPriceTierConfigurations } from '../src/utils/priceTierRanking';

const labels = ['0.10/0.50', '0.20/1', '0.40/2', '1/5', '2/10', '4/20', '10/50'];
const centers = [0.225, 0.45, 0.9, 2.25, 4.5, 9, 22.5];
const expectedBoundaries = [
  0.3181980515339464,
  0.6363961030678927,
  1.4230249470757708,
  3.181980515339464,
  6.363961030678928,
  14.230249470757707,
];

assert.deepEqual(PRICE_TIERS.map(tier => tier.id), labels);
assert.deepEqual(PRICE_TIERS.map(tier => tier.scenarioCostUSD), centers);
assert.equal(PRICE_TIER_BOUNDARIES.length, 6);
for (const [index, boundary] of PRICE_TIER_BOUNDARIES.entries()) {
  assert.ok(Math.abs(boundary - expectedBoundaries[index]) < 1e-12);
  assert.equal(getPriceTier(boundary - 1e-10)?.id, labels[index]);
  assert.equal(getPriceTier(boundary)?.id, labels[index + 1], 'boundary equality belongs to the higher tier');
  assert.equal(getPriceTier(boundary + 1e-10)?.id, labels[index + 1]);
  assert.equal(PRICE_TIERS[index].upperBoundUSD, PRICE_TIERS[index + 1].lowerBoundUSD);
}
for (const [index, cost] of centers.entries()) {
  assert.equal(getPriceTier(cost)?.id, labels[index]);
}

// A rounded display boundary must not replace the true boundary in classification.
assert.equal(getPriceTier(0.318198)?.id, '0.10/0.50');
assert.equal(getPriceTier(1.423025)?.id, '1/5');
assert.equal(getPriceTier(0)?.id, '0.10/0.50', 'free routes belong to the lowest tier');
assert.equal(getPriceTier(100)?.id, '10/50');
assert.equal(getPriceTier(Number.MAX_VALUE)?.id, '10/50', 'the top tier has no upper limit');
for (const invalid of [null, undefined, NaN, Infinity, -Infinity, -0.01]) {
  assert.equal(getPriceTier(invalid), null, 'unknown or invalid costs cannot be classified as free');
}

// Different input/output ratios still use the chosen weighted scenario.
assert.equal(getPriceTier(0.3 + 0.25 * 1.2)?.id, '0.20/1');
assert.equal(getPriceTier(2 + 0.25 * 6)?.id, '2/10');

const scores = (publicLeaderboardSnapshot as unknown as PublicLeaderboardSnapshot).scores;
const opusRoutes = scores.filter(item => item.config.name.startsWith('Claude Opus 5.5 Max |'));
const opusAPI = opusRoutes.find(item => !item.config.subscriptionData);
const opusSubscription = opusRoutes.find(item => item.config.subscriptionData?.planName === 'Claude Max 20×');
assert.ok(opusAPI && opusSubscription);
assert.equal(getPriceTier(opusAPI.practicalBreakdown.effectiveScenarioCostUSD)?.id, '4/20');
assert.equal(getPriceTier(opusSubscription.practicalBreakdown.effectiveScenarioCostUSD)?.id, '0.10/0.50',
  'subscription classification uses the existing effective cost, not its model API list price');
const unknownSubscription = scores.find(item => item.config.name.startsWith('Muse Wonder Full Max |'));
assert.ok(unknownSubscription?.config.subscriptionData);
assert.equal(getPriceTier(unknownSubscription.practicalBreakdown.effectiveScenarioCostUSD), null);

const readerScores = buildRepresentativeConfigurationQueue(scores);
const groups = [...labels, 'unknown'].map(id => ({
  id,
  members: readerScores.filter(item => (getPriceTier(item.practicalBreakdown.effectiveScenarioCostUSD)?.id ?? 'unknown') === id),
}));
assert.equal(groups.reduce((total, group) => total + group.members.length, 0), readerScores.length);
assert.equal(new Set(groups.flatMap(group => group.members.map(item => item.config.id))).size, readerScores.length);
assert.ok(groups.some(group => group.members.some(item => !item.eligibleForGlobalLeaderboard)),
  'missing benchmark coverage does not exclude a priced model from classification');

console.log('Price tier boundary and snapshot integration tests passed.');

const sourceFile = (path: string) => ({
  path,
  sha256: createHash('sha256').update(readFileSync(resolve(path), 'utf8')).digest('hex'),
});
const source = {
  leaderboard: sourceFile('src/data/publicLeaderboardSnapshot.json'),
  subscriptionEvidence: sourceFile('src/data/subscriptionPricing.ts'),
  cohort: { id: CURRENT_COHORT_SNAPSHOT.id, snapshotDate: CURRENT_COHORT_SNAPSHOT.snapshotDate },
};
const sourceSnapshot = publicLeaderboardSnapshot as unknown as PublicLeaderboardSnapshot;
const sourceBefore = JSON.stringify(sourceSnapshot);
const dataset = buildPriceTierDataset(sourceSnapshot, source);
assert.equal(JSON.stringify(sourceSnapshot), sourceBefore, 'classification must not modify prices, scores, or access routes');
assert.deepEqual(dataset, JSON.parse(readFileSync(resolve('src/data/priceTierSnapshot.json'), 'utf8')),
  'the committed data and source hashes must match the reproducible generator');
assert.equal(dataset.summary.configurationCount, scores.length);
assert.equal(dataset.summary.readerConfigurationCount, readerScores.length);
assert.equal(dataset.summary.maxReconciliationDifferenceUSD, 0, 'all current costs reconcile exactly');
assert.deepEqual(dataset.groups.flatMap(group => group.configurationIds).sort(), scores.map(item => item.config.id).sort(),
  'all API and subscription routes belong to exactly one group, including unknowns');
assert.deepEqual(dataset.groups.flatMap(group => group.readerConfigurationIds).sort(), readerScores.map(item => item.config.id).sort());

const records = new Map(dataset.configurations.map(item => [item.configurationId, item]));
for (const record of dataset.configurations) {
  assert.ok(records.get(record.representativeConfigurationId)?.isReaderRepresentative,
    'every folded route must reference a real reader representative');
  assert.equal(record.status === 'unknown', record.tierId === null);
  assert.equal(record.status === 'unknown', record.missingFields.length > 0);
}
const opusRecord = records.get(opusSubscription.config.id)!;
assert.equal(opusRecord.apiPricing.tierId, '4/20', 'raw API pricing remains separately inspectable');
assert.equal(opusRecord.tierId, '0.10/0.50');
assert.equal(opusRecord.subscriptionPricing?.evidence.kind, 'measured');
const fableRecord = dataset.configurations.find(item => item.modelProfile === 'Claude Fable 5.1 Max' && item.access === 'subscription')!;
assert.equal(fableRecord.subscriptionPricing?.usableMonthlyApiEquivalentUSD, 2485, 'the 50% quota cap applies exactly once');
assert.equal(fableRecord.tierId, '1/5');
const unknownRecord = records.get(unknownSubscription.config.id)!;
assert.equal(unknownRecord.status, 'unknown');
assert.equal(unknownRecord.subscriptionPricing?.evidence.kind, 'official-plan-only');
assert.deepEqual(unknownRecord.missingFields, [
  'inputPricePerMToken', 'outputPricePerMToken', 'apiEquivalentCostUSD', 'usableQuotaFraction',
]);
const legacyRecord = dataset.configurations.find(item => item.configurationName === 'Gemini 3.5 Flash-Lite High | --- | Google AI Pro')!;
assert.equal(legacyRecord.subscriptionPricing?.evidence.kind, 'legacy-estimate');
assert.equal(legacyRecord.subscriptionPricing?.evidence.sourceUrl, null, 'legacy estimates must not inherit measured-source links');
const freeRecord = dataset.configurations.find(item => item.modelProfile === 'Inkling XHigh')!;
assert.equal(freeRecord.effectiveScenarioCostUSD, 0);
assert.equal(freeRecord.tierId, '0.10/0.50');

const expectInvalid = (mutate: (copy: PublicLeaderboardSnapshot) => void, message: RegExp) => {
  const copy = structuredClone(sourceSnapshot);
  mutate(copy);
  assert.throws(() => buildPriceTierDataset(copy, source), message);
};
expectInvalid(copy => { copy.scores.push(structuredClone(copy.scores[0])); }, /duplicate configuration identity/u);
expectInvalid(copy => { copy.scores[0].config.openRouterData!.inputPricePerMToken = -1; }, /Invalid nonnegative price/u);
expectInvalid(copy => { copy.scores[0].config.openRouterData!.outputPricePerMToken = NaN; }, /Invalid nonnegative price/u);
expectInvalid(copy => { copy.scores[0].practicalBreakdown.effectiveScenarioCostUSD! += 0.1; }, /Scenario cost mismatch/u);
expectInvalid(copy => { copy.scores[0].practicalBreakdown.effectiveScenarioCostUSD = null; }, /Missing-price mismatch/u);
expectInvalid(copy => {
  copy.scores.find(item => item.config.id === opusSubscription.config.id)!.config.subscriptionData!.pricingEvidenceId = 'missing-evidence';
}, /Unknown subscription evidence/u);
expectInvalid(copy => {
  copy.scores.find(item => item.config.id === opusSubscription.config.id)!.config.subscriptionData!.apiEquivalentCostUSD! /= 2;
}, /Subscription measurement does not match/u);
expectInvalid(copy => {
  copy.scores.find(item => item.config.id === opusSubscription.config.id)!.config.name = 'Claude Opus future version | Claude Code | Claude Max 20×';
}, /Subscription measurement does not match/u);
expectInvalid(copy => {
  copy.scores.find(item => item.config.id === opusSubscription.config.id)!.config.subscriptionData!.usableQuotaFraction = 1.5;
}, /Invalid subscription conversion/u);

// Unknown prices remain unknown even if the same-model API price exists.
const missingAllowance = structuredClone(sourceSnapshot);
const missingAllowanceScore = missingAllowance.scores.find(item => item.config.id === legacyRecord.configurationId)!;
missingAllowanceScore.config.subscriptionData!.apiEquivalentCostUSD = null;
missingAllowanceScore.practicalBreakdown.effectiveScenarioCostUSD = null;
const missingAllowanceRecord = buildPriceTierDataset(missingAllowance, source).configurations
  .find(item => item.configurationId === legacyRecord.configurationId)!;
assert.equal(missingAllowanceRecord.tierId, null);
assert.equal(missingAllowanceRecord.apiPricing.tierId, '0.40/2');
assert.deepEqual(missingAllowanceRecord.missingFields, ['apiEquivalentCostUSD']);

console.log('Price dataset identity, provenance, reconciliation, quota, unknown-price and stale-snapshot checks passed.');

for (const tier of PRICE_TIERS) {
  const rows = rankPriceTierConfigurations(scores, tier.id);
  const savedGroup = dataset.groups.find(group => group.tierId === tier.id)!;
  assert.deepEqual(rows.map(row => row.item.config.id).sort(), [...savedGroup.configurationIds].sort(),
    'the price page must include every route in its tier, including folded API routes');
  assert.deepEqual(rows.flatMap(row => row.rank === null ? [] : [row.rank]),
    Array.from({ length: rows.filter(row => row.rank !== null).length }, (_, index) => index + 1),
    'qualified ranks restart at one in each price tier without gaps');
  const descendingRanks = new Map(rows.map(row => [row.item.config.id, row.rank]));
  const ascending = rankPriceTierConfigurations(scores, tier.id, 'practicalScore', 'asc');
  for (const row of ascending) assert.equal(row.rank, descendingRanks.get(row.item.config.id));
  assert.equal(priceTierFromHash(priceTierPageHash(tier.id)), tier.id, 'direct links must round-trip every tier');
}
assert.equal(priceTierFromHash('#prices'), DEFAULT_PRICE_TIER);
assert.equal(priceTierFromHash('#prices/invalid'), DEFAULT_PRICE_TIER);
assert.equal(priceTierFromHash(''), null);
assert.equal(priceTierFromHash('#overview'), null);

const twoTen = rankPriceTierConfigurations(scores, '2/10');
assert.deepEqual(twoTen.filter(row => row.rank !== null).map(row => [row.item.config.name.split('|')[0].trim(), row.rank]), [
  ['Gemini 4 Argon High', 1], ['Claude Sonnet 5.5 Max', 2], ['GPT-6.1 Sol Max', 3], ['Grok 4.7 XHigh', 4],
]);
assert.equal(twoTen.length, 7);
assert.equal(twoTen.filter(row => row.rank === null).length, 3, 'insufficient configurations remain visible without a rank');
assert.deepEqual(rankPriceTierConfigurations(scores, '10/50').map(row => [row.item.config.name.split('|')[0].trim(), row.rank]), [
  ['Claude Fable 5.1 Max', 1], ['GPT-6 Astra Max', 2],
]);
assert.equal(rankPriceTierConfigurations(scores, '4/20')[0].item.config.id, opusAPI.config.id,
  'the API configuration must not be replaced by its cheaper subscription in this tier');
const codingRows = rankPriceTierConfigurations(scores, '2/10', 'coding');
assert.equal(codingRows.find(row => row.rank === 1)?.item.config.name.split('|')[0].trim(), 'Gemini 4 Argon High');
assert.ok(codingRows.filter(row => !row.item.eligibleForGlobalLeaderboard).every(row => row.rank === null));
assert.equal(JSON.stringify(sourceSnapshot), sourceBefore);
console.log('Price page complete-inventory filtering, within-tier ranks, ascending sorts and direct-link tests passed.');
