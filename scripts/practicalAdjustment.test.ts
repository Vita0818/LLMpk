import assert from 'node:assert/strict';
import { calculateMedian, calculateUtilityRatio, processLLMpkBatchScoring, DOMAIN_DEFINITIONS } from '../src/engine/scoringEngine';
import { calculatePracticalAdjustments, PRACTICAL_TASK_DEFINITIONS } from '../src/engine/practicalScoring';
import { buildPracticalTaskMeasurements } from '../src/data/practicalTaskEvidence';
import { SCORING_CONFIG } from '../src/engine/scoringConfig';
import type { LLMConfiguration, PracticalTaskMeasurement } from '../src/types/llm_pk';
import type { SourceModelCard, SourceObservation } from '../src/types/admin_mapping';
import publicSnapshot from '../src/data/publicLeaderboardSnapshot.json';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
assert.equal(publicSnapshot.practicalAdjustmentVersion, SCORING_CONFIG.practicalAdjustment.version);
const task = (time: number, cost: number, extra: Partial<PracticalTaskMeasurement> = {}): PracticalTaskMeasurement => ({
  id: 'aa-agent', family: 'aa-agent', benchmark: 'AA Coding Agents', comparisonKey: 'same-suite-v2',
  referenceKey: `run-${time}`, timeSeconds: time, apiCostUSD: cost, quality: 0.6,
  measurement: 'agent-wall-clock', sourceUrl: 'https://artificialanalysis.ai/agents/coding-agents',
  sourceUpdated: '2026-10-24', sourceProfile: 'Max', sourceHarness: 'Codex CLI', notes: 'test fixture', ...extra,
});
const config = (id: string, time: number, throughput: number, cost = 10): LLMConfiguration => ({
  id, name: id, provider: 'test', identity: { modelName: id, modelVersion: 'Max', reasoningEffort: 'X-High', contextWindowTokens: 1000 },
  execution: { harness: 'Codex CLI', toolPermissions: [] }, access: { entryPoint: 'Direct Provider API' }, observations: {},
  openRouterData: { inputPricePerMToken: 1, outputPricePerMToken: 4, ttftP50Seconds: 1, throughputP50TokensPerSec: throughput },
  practicalMeasurements: [task(time, cost)],
});
const adjustments = (configs: LLMConfiguration[]) => calculatePracticalAdjustments(configs, calculateMedian, calculateUtilityRatio);

near(PRACTICAL_TASK_DEFINITIONS.reduce((sum, row) => sum + row.weight, 0), 0.7);
assert.equal(PRACTICAL_TASK_DEFINITIONS.length, 13, '11 standalone Vals tasks; composite Index is excluded.');
near(SCORING_CONFIG.practicalAdjustment.weights.throughput + SCORING_CONFIG.practicalAdjustment.weights.ttft, 0.3);
assert.equal(SCORING_CONFIG.practicalAdjustment.weights.scenarioCost, 0.3);
assert.equal(SCORING_CONFIG.practicalAdjustment.speed.rewardScale, 7.5);
assert.equal(SCORING_CONFIG.practicalAdjustment.speed.penaltyScale, 8);
assert.equal(SCORING_CONFIG.practicalAdjustment.cost.rewardScale, 7.5);
assert.equal(SCORING_CONFIG.practicalAdjustment.cost.penaltyScale, 12);

// The model that finishes the same task sooner wins despite slower streaming.
const fastTask = config('task-fast', 50, 10);
const slowTask = config('task-slow', 100, 20);
const [fast, slow] = adjustments([fastTask, slowTask]);
near(fast.speedUtility!, 0.35 / 3 - 0.15 / 3);
near(slow.speedUtility!, -0.35 * 0.25 + 0.15 * 0.25);
assert.ok(fast.speedDelta! > slow.speedDelta!);
near(fast.speedCoverage!, 0.65);
for (const row of [fast, slow]) {
  near(row.components!.filter(component => component.domain === 'speed').reduce((sum, component) => sum + component.weight, 0), 1);
  near(row.components!.filter(component => component.domain === 'cost').reduce((sum, component) => sum + component.weight, 0), 1);
}

// Missing tasks keep their weight unspent; fast-failing runs earn no task bonus.
const requestOnly = { ...fastTask, practicalMeasurements: undefined };
const [only] = adjustments([requestOnly, slowTask]);
near(only.speedCoverage!, 0.3);
near(only.speedUtility!, -0.15 / 3);
const failed = structuredClone(fastTask); failed.practicalMeasurements![0].quality = 0;
assert.equal(adjustments([failed, slowTask])[0].components!.find(row => row.id === 'speed-task-aa-agent')!.utility, null);
const noData = { ...fastTask, practicalMeasurements: undefined, openRouterData: undefined };
assert.equal(adjustments([noData])[0].speedDelta, null);
assert.equal(adjustments([noData])[0].costDelta, null);
const free = config('free-task', 50, 10, 0);
assert.ok(adjustments([free, slowTask])[0].components!.find(row => row.id === 'cost-task-aa-agent')!.utility! > 0.99);

// Incomparable suites do not share a median, and subscription copies do not
// change anyone's task or response speed reference.
const anotherSuite = config('different-suite', 10000, 10);
anotherSuite.practicalMeasurements![0].comparisonKey = 'different-suite-v1';
near(adjustments([fastTask, anotherSuite])[0].components!.find(row => row.id === 'speed-task-aa-agent')!.utility!, 0);
const subscription = structuredClone(fastTask); subscription.id = 'subscription';
subscription.subscriptionData = { planName: 'Claude Max 20×', monthlyPriceUSD: 200,
  apiEquivalentCostUSD: 4970, usableQuotaFraction: 0.5, pricingEvidenceId: 'sa-2026-10-05-max-20x-fable-5-1' };
const withSubscription = adjustments([fastTask, slowTask, subscription]);
near(withSubscription[0].speedDelta!, fast.speedDelta!);
near(withSubscription[2].speedDelta!, fast.speedDelta!);
near(withSubscription[2].components!.find(row => row.id === 'cost-task-aa-agent')!.rawValue!, 10 * 200 / 2485);
const unknownQuota = structuredClone(subscription); unknownQuota.subscriptionData!.apiEquivalentCostUSD = null;
assert.equal(adjustments([unknownQuota, slowTask])[0].costDelta, null);
const legacy = structuredClone(subscription); legacy.subscriptionData!.pricingEvidenceId = 'legacy-subscription-estimate';
assert.equal(adjustments([legacy, slowTask])[0].components!.find(row => row.id === 'cost-task-aa-agent')!.rawValue, null);
const reasoningMix = structuredClone(subscription); reasoningMix.practicalMeasurements![0] = task(50, 10, { id: 'aa-index', family: 'aa-index' });
assert.equal(adjustments([reasoningMix, slowTask])[0].components!.find(row => row.id === 'cost-task-aa-index')!.rawValue, null);

const valsCard: SourceModelCard = { id: 'fixture-vals', source: 'vals', exactSourceModelName: 'fixture-model', latestSnapshotDate: '2026-10-24',
  metadataJson: { sourceIdentity: { benchmarkSlug: 'emb', benchmarkName: 'Excel Modeling', benchmarkVersion: '1', task: 'overall', sourceRecordId: 'fixture-model' } } };
const valsObservation: SourceObservation = { id: 'fixture-observation', sourceModelCardId: valsCard.id, metricId: 'vals_excel_modeling_v1', rawValue: 0.7, unit: '%', snapshotDate: '2026-10-24',
  metadataJson: { sourceRecord: { latency: 2106.434, cost_per_test: 11.018974 }, valsEvidence: { sourceUrl: 'https://www.vals.ai/benchmarks/emb', sourceUpdated: '2026-10-20', sourceProfile: 'Max', sourceHarness: null, hasRefusalFallbackNotice: false } } };
const linked = { card: valsCard, observations: [valsObservation], provenance: { kind: 'exact' as const } };
assert.equal(buildPracticalTaskMeasurements([linked], 'Codex CLI')[0].timeSeconds, 2106.434, 'Vals latency is seconds: official 35m06s.');
assert.deepEqual(buildPracticalTaskMeasurements([{ ...linked, provenance: { kind: 'lower_profile_fallback', sourceProfile: 'High', sourceLevel: 4, targetProfile: 'Max', targetLevel: 6 } }], 'Codex CLI'), []);
const mixedFallback = structuredClone(linked); mixedFallback.observations[0].metadataJson!.valsEvidence.hasRefusalFallbackNotice = true;
assert.deepEqual(buildPracticalTaskMeasurements([mixedFallback], 'Codex CLI'), []);
const composite = structuredClone(linked); composite.card.metadataJson!.sourceIdentity.benchmarkSlug = 'vals_index';
assert.deepEqual(buildPracticalTaskMeasurements([composite], 'Codex CLI'), []);

// Real configured rows: task metrics alter only additive deltas; capability
// values, observation coverage, rank eligibility, and radar axes are identical.
Reflect.deleteProperty(globalThis, 'localStorage');
const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const store = new AdminMappingStore(); store.installBuiltInConfigurationPresets();
const scores = store.computeLeaderboardScores();
const sol = scores.find(score => score.config.name.startsWith('GPT-6.1 Sol') && !score.config.subscriptionData)!;
const agentLink = store.getLinkedCardStack(sol.config.id).find(entry => entry.card.id.startsWith('card-aa-coding-agent-'))!;
const linkedAgent = { card: agentLink.card, provenance: { kind: 'exact' as const }, observations: store.getCardObservations(agentLink.card.id) };
assert.equal(buildPracticalTaskMeasurements([linkedAgent], 'Codex CLI')[0].family, 'aa-agent');
assert.deepEqual(buildPracticalTaskMeasurements([linkedAgent], 'Claude Code'), [], 'A Codex task timing cannot become a Claude Code timing.');
const renamedAgent = structuredClone(linkedAgent); renamedAgent.card.exactSourceModelName += ' different-version';
assert.deepEqual(buildPracticalTaskMeasurements([renamedAgent], 'Codex CLI'), [], 'Renaming the model cannot inherit its task timing.');
const withoutTasks = processLLMpkBatchScoring(scores.map(score => ({ ...score.config, practicalMeasurements: undefined })));
assert.equal(scores.length, 49);
assert.equal(Object.keys(DOMAIN_DEFINITIONS).length, 6);
let affected = 0;
for (const [index, score] of scores.entries()) {
  assert.deepEqual(score.domainScores, withoutTasks[index].domainScores);
  assert.equal(score.rawCapabilityScore, withoutTasks[index].rawCapabilityScore);
  assert.equal(score.eligibleForGlobalLeaderboard, withoutTasks[index].eligibleForGlobalLeaderboard);
  const b = score.practicalBreakdown;
  if (b.speedDelta !== withoutTasks[index].practicalBreakdown.speedDelta) affected++;
  if (b.practicalScore !== null) near(b.practicalScore, Math.max(0, score.rawCapabilityScore! + b.speedDelta! + b.costDelta!));
  assert.ok((b.speedDelta ?? 0) <= 7.5 && (b.speedDelta ?? 0) >= -8);
  assert.ok((b.costDelta ?? 0) <= 7.5 && (b.costDelta ?? 0) >= -12);
}
assert.ok(affected > 10, 'Task evidence must actually affect shipped practical adjustments.');
console.log(`Practical v1.5 task/response budgets, measured subscription costs, missingness, source identity and unchanged radar: PASS (${affected} task-sensitive configurations).`);
