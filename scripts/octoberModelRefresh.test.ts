import assert from 'node:assert/strict';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import arenaSnapshot from '../src/data/arenaRawExtraction.json';
import frontierSnapshot from '../src/data/frontierCodeSourceSnapshot.json';
import aaSnapshot from '../src/data/artificialAnalysisSourceSnapshot.json';
import valsSnapshot from '../src/data/valsSourceSnapshot.json';
import valsReviews from '../src/data/valsReviewedMappings.json';
import { BUILT_IN_CONFIGURATION_PRESETS } from '../src/data/builtInConfigurationPresets';
import { VERIFIED_SOURCE_MODEL_CARDS } from '../src/data/seedCards';
import { VERIFIED_HARNESS_SOURCE_OBSERVATIONS } from '../src/data/harnessSeedCards';
import { buildValsSourceCards, type ValsSnapshot, type ValsReviewedManifest } from '../src/data/valsSeedCards';
import { buildConfigurationMetricRows } from '../src/components/ConfigurationDetailContent';
import { processLLMpkBatchScoring } from '../src/engine/scoringEngine';
import { classifyOagxmModel } from '../src/data/oagxmScope';
import type { SourceModelCard } from '../src/types/admin_mapping';
import type { PublicLeaderboardSnapshot } from '../src/types/publicLeaderboard';

Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore();
store.resetToLatestVerifiedCatalog();
const installation = store.synchronizeBuiltInConfigurationPresets(true);
assert.equal(installation.invalidPresetCount, 0);
assert.equal(installation.unresolvedSourceCardCount, 0);
assert.equal(installation.mismatchedSourceCardCount, 0);

const expected = [
  ['muse_wonder', 'Muse Wonder'], ['muse_wonder_full', 'Muse Wonder Full'],
  ['claude_haiku_55', 'Claude Haiku 5.5'], ['mistral_large_4', 'Mistral Large 4 Preview'],
] as const;
const scores = store.computeLeaderboardScores();
assert.ok(aaSnapshot.evaluationRecords['gdp-pdf'].length > 200,
  'GDP.pdf must use the full public comparison records, not only its selected chart subset.');
const mediumPdf = aaSnapshot.evaluationRecords['gdp-pdf'].find(r => r.id === 'mistral-medium-3-5')!;
assert.equal(mediumPdf.gdpPdfAllPass, 0.028);
assert.ok(BUILT_IN_CONFIGURATION_PRESETS.filter(p => p.productLineId === 'step_5_preview')
  .every(p => p.identity.model.profile === 'High'), 'The published Step 5 API has no Max effort.');
for (const [line, model] of expected) {
  assert.equal(classifyOagxmModel(model)?.productLineId, line);
  const presets = BUILT_IN_CONFIGURATION_PRESETS.filter(p => p.productLineId === line);
  assert.equal(presets.length, 1, `${model} has one reviewed production access route.`);
  const box = store.boxes.find(b => b.builtInPresetId === presets[0].id)!;
  const score = scores.find(s => s.config.id === box.id)!;
  const review = valsReviews.entries.find(entry => entry.productLineId === line)!;
  assert.equal(score.config.valsData?.length, review.executions.length,
    'The current source can remove an index execution without filling it from an older version.');
  assert.equal(score.config.observations.arena_agent_bash_recovery, undefined,
    'New models must not borrow historical recovery scores or the different reliability signal.');
}

const published = publicSnapshot as unknown as PublicLeaderboardSnapshot;
const full = published.scores.find(s => s.config.name.startsWith('Muse Wonder Full '))!;
assert.deepEqual(full.config.subscriptionData, {
  planName: 'Muse Code Maximum Usage', monthlyPriceUSD: 200,
  apiEquivalentCostUSD: null, usableQuotaFraction: null,
  pricingEvidenceId: 'meta-muse-code-maximum-2026-10-12',
});
assert.equal(full.practicalBreakdown.costDelta, null);
assert.equal(full.practicalBreakdown.practicalScore, null);
assert.equal(full.config.openRouterData, undefined);
const monthly = buildConfigurationMetricRows(full).find(r => r.id === 'cost_input')!;
const allowance = buildConfigurationMetricRows(full).find(r => r.id === 'cost_output')!;
assert.equal(monthly.value, '200');
assert.equal(allowance.value, '--');
assert.ok(allowance.title.includes('尚未公布'));
assert.ok(VERIFIED_HARNESS_SOURCE_OBSERVATIONS.filter(o =>
  o.sourceModelCardId === 'card-aa-coding-agent-muse-code-muse-wonder-full-max')
  .every(o => o.metadataJson?.meanCostUsd === null));
assert.equal(BUILT_IN_CONFIGURATION_PRESETS.some(p => p.productLineId === 'muse_wonder_full' && p.access === 'api'), false);

const mistral = scores.find(s => s.config.identity.modelName === 'Mistral Large 4 Preview')!;
const internalFull = scores.find(s => s.config.identity.modelName === 'Muse Wonder Full')!;
assert.equal(internalFull.config.access.entryPoint, 'Meta Subscription');
assert.notEqual(internalFull.config.capabilityReferenceIncluded, false,
  'A subscription-only model is an independent calibration reference, not a duplicate API access route.');
assert.equal(mistral.eligibleForGlobalLeaderboard, false);
assert.ok(mistral.domainScores.agentic.coverage < 0.6, 'Expanded task evidence is missing; keep the unchanged domain gate.');
const quotaReference = scores.find(s => s.config.identity.modelName === 'Claude Opus 5.5')!;
const unknownQuota = processLLMpkBatchScoring([
  quotaReference.config,
  { ...quotaReference.config, id: 'known-monthly-unknown-quota', subscriptionData: full.config.subscriptionData },
]).find(s => s.config.id === 'known-monthly-unknown-quota')!;
assert.notEqual(unknownQuota.rawCapabilityScore, null);
assert.equal(unknownQuota.practicalBreakdown.effectiveScenarioCostUSD, null);
assert.equal(unknownQuota.practicalBreakdown.costDelta, null);
assert.equal(unknownQuota.practicalBreakdown.practicalScore, null,
  'A known monthly price with unknown allowance must not imply a free or estimated effective cost.');

const haiku = scores.find(s => s.config.identity.modelName === 'Claude Haiku 5.5')!;
const frontier = frontierSnapshot.rows.find(r => r.name === 'Claude Haiku 5.5' && r.effort === 'max')!;
assert.ok(frontier.flaggedRate === null || (Number.isFinite(frontier.flaggedRate)
  && frontier.flaggedRate >= 0 && frontier.flaggedRate <= 1),
  'A later published audit may replace the original unknown flagging rate.');
assert.equal(haiku.config.observations.frontiercode_v11_main_pass_rate.rawValue, frontier.passRate);
assert.equal(frontier.passRate, 0.5165);
assert.equal(haiku.config.openRouterData?.inputPricePerMToken, 0.1);
assert.equal(haiku.config.openRouterData?.outputPricePerMToken, 0.5);
for (const model of ['Muse Wonder ', 'Claude Haiku 5.5 ']) {
  const score = published.scores.find(s => s.config.name.startsWith(model))!;
  assert.ok(Math.abs(score.domainScores.chatting.coverage - 0.65) < 1e-12);
  assert.equal(score.availableDomainCount, 6);
  assert.ok(score.overallCoverage < 0.75);
  assert.equal(score.eligibleForGlobalLeaderboard, false,
    'Additional weighted tasks retain the overall gate even when all six domains pass.');
}
assert.equal(full.domainScores.chatting.coverage, 0);
assert.equal(full.rawCapabilityScore, null, 'Wonder Full must not borrow Wonder’s dialogue evidence.');

const retained = arenaSnapshot.metrics.arena_agent_bash_recovery;
assert.equal(retained.snapshotDate, '2026-10-02');
assert.ok('retention' in retained);
assert.ok(retained.rows.every(r => r.rawValue === r.sourceRecord.signalScores.bash_recovery_steps));

const reviews = structuredClone(valsReviews) as ValsReviewedManifest;
const fullReview = reviews.entries.find(e => e.productLineId === 'muse_wonder_full')!;
assert.equal(fullReview.baseSource, 'artificial_analysis');
fullReview.baseReleaseDate = '2026-10-11';
const bases = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
const changed = buildValsSourceCards(valsSnapshot as unknown as ValsSnapshot, bases, reviews);
assert.equal(changed.cards.some(c => c.id.startsWith('card-vals-meta-muse-wonder-full-')), false,
  'A changed subscription-only model release must fail the pinned Vals identity.');
assert.equal(changed.cards.filter(c => c.id.startsWith('card-vals-meta-muse-wonder-')).length,
  valsReviews.entries.find(entry => entry.productLineId === 'muse_wonder')!.executions.length,
  'Wonder and Wonder Full keep distinct base identities.');
console.log('October models: separate identities, subscription unknowns, exact efforts, retained task definitions and coverage gates: PASS');
