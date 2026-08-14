import assert from 'node:assert/strict';
import {
  ALL_METRIC_DEFINITIONS,
  DOMAIN_DEFINITIONS,
  processLLMpkBatchScoring,
  transformRawMetric,
} from '../src/engine/scoringEngine';
import { DOMAIN_IDS, getCoverageStatus, SCORING_CONFIG } from '../src/engine/scoringConfig';
import { DETAIL_ONLY_METRIC_DEFINITIONS } from '../src/data/detailMetricDefinitions';
import type { DomainId, LLMConfiguration, MetricDefinition, MetricObservation } from '../src/types/llm_pk';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../src/utils/practicalAdjustment';

const makeConfiguration = (
  id: string,
  observations: Record<string, MetricObservation>,
): LLMConfiguration => ({
  id,
  name: id,
  provider: 'Test',
  identity: {
    modelName: id,
    modelVersion: 'test',
    reasoningEffort: 'None',
    contextWindowTokens: 1,
  },
  execution: {
    harness: 'test',
    toolPermissions: [],
  },
  access: {
    entryPoint: 'Direct Provider API',
  },
  observations,
});

const metric = (
  id: string,
  internalWeightInDomain: number,
  domain: DomainId = 'chatting',
): MetricDefinition => ({
  id,
  name: id,
  source: 'Arena.ai',
  domain,
  metricType: 'continuous_relative',
  internalWeightInDomain,
  higherIsBetter: true,
  unit: 'Score',
  description: 'test metric',
});

const observation = (metricId: string, rawValue: number): MetricObservation => ({
  metricId,
  rawValue,
});

const nearlyEqual = (actual: number, expected: number, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

assert.deepEqual(Object.keys(DOMAIN_DEFINITIONS), [...DOMAIN_IDS]);
nearlyEqual(
  transformRawMetric(0.2, 'error_rate'),
  Math.log(0.8 / 0.2),
);
assert.equal(new Set(ALL_METRIC_DEFINITIONS.map((definition) => definition.id)).size, ALL_METRIC_DEFINITIONS.length);
assert.equal(
  ALL_METRIC_DEFINITIONS.some((definition) => definition.id === 'aa_coding_agent_index'),
  false,
  'The composite AA Coding Agent Index must not be scored beside its three component metrics.',
);
assert.equal(
  new Set(DETAIL_ONLY_METRIC_DEFINITIONS.map((definition) => definition.id)).size,
  DETAIL_ONLY_METRIC_DEFINITIONS.length,
  'Detail-only metrics must have unique IDs.',
);
const scoringMetricIds = new Set(ALL_METRIC_DEFINITIONS.map((definition) => definition.id));
for (const definition of DETAIL_ONLY_METRIC_DEFINITIONS) {
  assert.equal(
    scoringMetricIds.has(definition.id),
    false,
    `${definition.id} must remain display-only until the scoring algorithm is deliberately revised.`,
  );
}
DOMAIN_IDS.forEach((domainId) => {
  const totalWeight = ALL_METRIC_DEFINITIONS
    .filter((definition) => definition.domain === domainId)
    .reduce((sum, definition) => sum + definition.internalWeightInDomain, 0);
  nearlyEqual(totalWeight, 1);
});
const metricDefinitionsById = new Map(
  ALL_METRIC_DEFINITIONS.map((definition) => [definition.id, definition]),
);
assert.equal(metricDefinitionsById.get('aa_tau3_banking')?.domain, 'agentic_work');
nearlyEqual(metricDefinitionsById.get('aa_tau3_banking')?.internalWeightInDomain || 0, 0.40);
assert.equal(metricDefinitionsById.get('arena_code_webdev')?.domain, 'engineering');
nearlyEqual(metricDefinitionsById.get('arena_code_webdev')?.internalWeightInDomain || 0, 0.10);
nearlyEqual(metricDefinitionsById.get('aa_gdpval_v2')?.internalWeightInDomain || 0, 0.20);
nearlyEqual(metricDefinitionsById.get('aa_terminalbench_v21')?.internalWeightInDomain || 0, 0.30);

// Scoring v1.2: a missing metric contributes neutral 50 while retaining its
// configured weight. The observed 70% metric must not be inflated to 100%.
const metrics = [metric('available_metric', 0.7), metric('missing_metric', 0.3)];
const [partiallyObserved, fullyObserved] = processLLMpkBatchScoring([
  makeConfiguration('partially-observed', {
    available_metric: observation('available_metric', 90),
  }),
  makeConfiguration('fully-observed', {
    available_metric: observation('available_metric', 70),
    missing_metric: observation('missing_metric', 40),
  }),
], metrics);

const partialDomain = partiallyObserved.domainScores.chatting;
const availableDetail = partialDomain.metricDetails.find((detail) => detail.metricId === 'available_metric');
const missingDetail = partialDomain.metricDetails.find((detail) => detail.metricId === 'missing_metric');

assert.ok(availableDetail);
assert.ok(missingDetail);
assert.equal(partialDomain.coverage, 0.7);
assert.equal(partialDomain.coverageStatus, 'official');
assert.equal(partialDomain.score === null, false);
assert.equal(availableDetail.normalizedScore === null, false);
assert.equal(missingDetail.baseNormalizedScore, null);
assert.equal(missingDetail.normalizedScore, 50);
assert.equal(missingDetail.rawValue, null);
assert.equal(availableDetail.weightInDomain, 0.7);
assert.equal(missingDetail.weightInDomain, 0.3);
assert.equal(availableDetail.configuredWeightInDomain, 0.7);
assert.equal(missingDetail.configuredWeightInDomain, 0.3);
nearlyEqual(
  partialDomain.rawGeometricIndex!,
  0.7 * Math.log(availableDetail.normalizedScore! / 50)
    + 0.3 * Math.log(missingDetail.normalizedScore! / 50),
);

// A domain with no observations is unavailable. It is shown as missing and
// cannot manufacture a capability score when no other domain is observed.
const [unobserved] = processLLMpkBatchScoring([
  makeConfiguration('unobserved', {}),
], metrics);
assert.equal(unobserved.domainScores.chatting.coverageStatus, 'no_observed_data');
assert.equal(unobserved.domainScores.chatting.score, null);
assert.equal(unobserved.rawCapabilityScore, null);
assert.equal(unobserved.availableDomainCount, 0);
assert.equal(unobserved.coverageStatus, 'insufficient');
assert.equal(unobserved.eligibleForGlobalLeaderboard, false);

assert.equal(getCoverageStatus(SCORING_CONFIG.coverage.officialMinimum), 'official');
assert.equal(getCoverageStatus(SCORING_CONFIG.coverage.officialMinimum - 0.001), 'provisional');
assert.equal(getCoverageStatus(0), 'no_observed_data');
assert.deepEqual(SCORING_CONFIG.practicalAdjustment, {
  version: '1.4',
  speed: {
    rewardScale: 7.5,
    penaltyScale: 8,
  },
  cost: {
    rewardScale: 7.5,
    penaltyScale: 12,
  },
});
assert.equal(
  SCORING_CONFIG.practicalAdjustment.speed.rewardScale
    + SCORING_CONFIG.practicalAdjustment.cost.rewardScale,
  15,
);
assert.equal(
  SCORING_CONFIG.practicalAdjustment.speed.penaltyScale
    + SCORING_CONFIG.practicalAdjustment.cost.penaltyScale,
  20,
);

// Sparse metric participation narrows the effective score range. Five observed
// configurations among 35 eligible ones use n_ref=max(10, ceil(.6*35))=21.
const sparseMetric = metric('sparse_metric', 1);
const sparseRawValues = [100, 75, 50, 25, 0];
const sparseConfigurations = Array.from({ length: 35 }, (_, index) => (
  makeConfiguration(
    `sparse-${index}`,
    index < sparseRawValues.length
      ? { sparse_metric: observation('sparse_metric', sparseRawValues[index]) }
      : {},
  )
));
const sparseResults = processLLMpkBatchScoring(sparseConfigurations, [sparseMetric]);
const sparseTopDetail = sparseResults[0].domainScores.chatting.metricDetails[0];
const sparseMissingDetail = sparseResults.at(-1)!.domainScores.chatting.metricDetails[0];
const expectedSparseReliability = 5 / 21;
assert.equal(sparseTopDetail.observedConfigCount, 5);
assert.equal(sparseTopDetail.eligibleConfigCount, 35);
assert.equal(sparseTopDetail.referenceConfigCount, 21);
nearlyEqual(sparseTopDetail.participationReliability, expectedSparseReliability);
nearlyEqual(sparseTopDetail.discriminationReliability, 1);
nearlyEqual(sparseTopDetail.reliability, expectedSparseReliability);
assert.equal(sparseTopDetail.baseNormalizedScore, 100);
nearlyEqual(
  sparseTopDetail.normalizedScore!,
  50 + expectedSparseReliability * 50,
);
assert.equal(sparseTopDetail.uncertaintyStatus, 'uncertainty_unknown');
assert.equal(sparseMissingDetail.baseNormalizedScore, null);
assert.equal(sparseMissingDetail.normalizedScore, 50);

// A narrow max-to-median spread relative to the reported 95% interval also
// contracts the range. spread=.375, typical radius=1 and fullSignalRatio=2,
// therefore rho_signal=.1875.
const uncertainMetric = metric('uncertain_metric', 1);
const uncertainObservation = (
  rawValue: number,
): MetricObservation => ({
  metricId: 'uncertain_metric',
  rawValue,
  confidenceLow: rawValue - 1,
  confidenceHigh: rawValue + 1,
});
const uncertainResults = processLLMpkBatchScoring([
  makeConfiguration('uncertain-top', {
    uncertain_metric: uncertainObservation(1),
  }),
  makeConfiguration('uncertain-median', {
    uncertain_metric: uncertainObservation(0.625),
  }),
  makeConfiguration('uncertain-low', {
    uncertain_metric: uncertainObservation(0.25),
  }),
], [uncertainMetric]);
const uncertainTopDetail = uncertainResults[0].domainScores.chatting.metricDetails[0];
assert.equal(uncertainTopDetail.baseNormalizedScore, 100);
nearlyEqual(uncertainTopDetail.uncertaintyRadius!, 1);
nearlyEqual(uncertainTopDetail.participationReliability, 1);
nearlyEqual(uncertainTopDetail.discriminationReliability, 0.1875);
nearlyEqual(uncertainTopDetail.reliability, 0.1875);
nearlyEqual(uncertainTopDetail.normalizedScore!, 59.375);
assert.equal(uncertainTopDetail.uncertaintyStatus, 'estimated');

// The whole-model capability score is the direct geometric mean of all six
// displayed domain scores. It must not be normalized a second time.
const sixDomains: DomainId[] = [
  'chatting',
  'math_science',
  'coding',
  'engineering',
  'agentic_work',
  'search_knowledge',
];
const sixDomainMetrics = sixDomains.map((domain) => metric(`metric_${domain}`, 1, domain));
const alphaObservations = Object.fromEntries(
  sixDomains.map((domain, index) => [
    `metric_${domain}`,
    observation(`metric_${domain}`, index === sixDomains.length - 1 ? 0 : 100),
  ]),
);
const betaObservations = Object.fromEntries(
  sixDomains.map((domain, index) => [
    `metric_${domain}`,
    observation(`metric_${domain}`, index === sixDomains.length - 1 ? 100 : 0),
  ]),
);
const [alpha, beta] = processLLMpkBatchScoring([
  makeConfiguration('alpha-six-domain-geometric', alphaObservations),
  makeConfiguration('beta-six-domain-geometric', betaObservations),
], sixDomainMetrics);

const capabilityGeometricMean = (item: typeof alpha) => {
  const domainScores = sixDomains.map((domain) => item.domainScores[domain].score);
  assert.ok(domainScores.every((score): score is number => score !== null));
  return Math.exp(domainScores.reduce(
    (sum, score) => sum + Math.log(score!) / sixDomains.length,
    0,
  ));
};
nearlyEqual(alpha.rawCapabilityScore!, capabilityGeometricMean(alpha));
nearlyEqual(beta.rawCapabilityScore!, capabilityGeometricMean(beta));
assert.ok(alpha.rawCapabilityScore! < 100);
assert.ok(beta.rawCapabilityScore! < 50);
assert.equal(alpha.availableDomainCount, sixDomains.length);

// Wholly missing domains are unavailable and excluded from the capability
// mean. The remaining observed domains are reweighted equally.
const fourAvailableDomains = sixDomains.slice(0, 4);
const fourDomainMetrics = sixDomains.map((domain) => metric(`partial_metric_${domain}`, 1, domain));
const partialObservations = Object.fromEntries(
  fourAvailableDomains.map((domain, index) => [
    `partial_metric_${domain}`,
    observation(`partial_metric_${domain}`, 100 - index * 10),
  ]),
);
const comparisonPartialObservations = Object.fromEntries(
  fourAvailableDomains.map((domain, index) => [
    `partial_metric_${domain}`,
    observation(`partial_metric_${domain}`, index * 10),
  ]),
);
const [fourDomainItem] = processLLMpkBatchScoring([
  makeConfiguration('four-domain-provisional', partialObservations),
  makeConfiguration('four-domain-comparison', comparisonPartialObservations),
], fourDomainMetrics);
assert.equal(fourDomainItem.availableDomainCount, 4);
assert.equal(fourDomainItem.domainScores.agentic_work.score, null);
assert.equal(fourDomainItem.domainScores.search_knowledge.score, null);
assert.equal(fourDomainItem.domainScores.agentic_work.coverageStatus, 'no_observed_data');
assert.equal(fourDomainItem.domainScores.search_knowledge.coverageStatus, 'no_observed_data');
assert.equal(typeof fourDomainItem.rawCapabilityScore, 'number');
const fourObservedScores = fourAvailableDomains.map(
  (domain) => fourDomainItem.domainScores[domain].score,
);
assert.ok(fourObservedScores.every((score): score is number => score !== null));
nearlyEqual(
  fourDomainItem.rawCapabilityScore!,
  Math.exp(fourObservedScores.reduce(
    (sum, score) => sum + Math.log(score) / fourObservedScores.length,
    0,
  )),
);
assert.equal(fourDomainItem.coverageStatus, 'provisional');
assert.equal(fourDomainItem.eligibleForGlobalLeaderboard, true);

const duplicateAccessMetric = metric('duplicate_access_metric', 1);
const capabilityReferenceHigh = makeConfiguration('reference-high', {
  duplicate_access_metric: observation('duplicate_access_metric', 1000),
});
const capabilityReferenceLow = makeConfiguration('reference-low', {
  duplicate_access_metric: observation('duplicate_access_metric', 900),
});
const baselineCapabilityScores = processLLMpkBatchScoring(
  [capabilityReferenceHigh, capabilityReferenceLow],
  [duplicateAccessMetric],
);
const comparisonOnlySubscription = makeConfiguration('subscription-copy', {
  duplicate_access_metric: observation('duplicate_access_metric', 1000),
});
comparisonOnlySubscription.capabilityReferenceIncluded = false;
const capabilityScoresWithSubscription = processLLMpkBatchScoring(
  [
    capabilityReferenceHigh,
    capabilityReferenceLow,
    comparisonOnlySubscription,
  ],
  [duplicateAccessMetric],
);
for (const baseline of baselineCapabilityScores) {
  const withSubscription = capabilityScoresWithSubscription.find(
    (result) => result.config.id === baseline.config.id,
  );
  assert.ok(withSubscription);
  nearlyEqual(withSubscription.rawCapabilityScore!, baseline.rawCapabilityScore!);
}
nearlyEqual(
  capabilityScoresWithSubscription.find(
    (result) => result.config.id === 'subscription-copy',
  )!.rawCapabilityScore!,
  baselineCapabilityScores.find(
    (result) => result.config.id === 'reference-high',
  )!.rawCapabilityScore!,
);

const apiCostConfiguration = makeConfiguration('api-cost-route', {});
apiCostConfiguration.openRouterData = {
  inputPricePerMToken: 10,
  outputPricePerMToken: 20,
  ttftP50Seconds: 1,
  throughputP50TokensPerSec: 50,
};
const chatGptSubscriptionConfiguration = makeConfiguration(
  'chatgpt-pro-subscription',
  {},
);
chatGptSubscriptionConfiguration.openRouterData = {
  ...apiCostConfiguration.openRouterData,
};
chatGptSubscriptionConfiguration.subscriptionData = {
  planName: 'ChatGPT Pro 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: 2000,
  usableQuotaFraction: 1,
};
const chatGptPlusConfiguration = makeConfiguration('chatgpt-plus', {});
chatGptPlusConfiguration.openRouterData = {
  ...apiCostConfiguration.openRouterData,
};
chatGptPlusConfiguration.subscriptionData = {
  planName: 'ChatGPT Plus',
  monthlyPriceUSD: 20,
  apiEquivalentCostUSD: 100,
  usableQuotaFraction: 1,
};
const claudeSubscriptionConfiguration = makeConfiguration(
  'claude-max-subscription',
  {},
);
claudeSubscriptionConfiguration.openRouterData = {
  ...apiCostConfiguration.openRouterData,
};
claudeSubscriptionConfiguration.subscriptionData = {
  planName: 'Claude Max 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: 1600,
  usableQuotaFraction: 0.5,
};
const claudeProFableConfiguration = makeConfiguration('claude-pro-fable', {});
claudeProFableConfiguration.openRouterData = {
  ...apiCostConfiguration.openRouterData,
};
claudeProFableConfiguration.subscriptionData = {
  planName: 'Claude Pro',
  monthlyPriceUSD: 20,
  apiEquivalentCostUSD: 80,
  usableQuotaFraction: 0.5,
};
const claudeMaxOpusConfiguration = makeConfiguration('claude-max-opus', {});
claudeMaxOpusConfiguration.openRouterData = {
  ...apiCostConfiguration.openRouterData,
};
claudeMaxOpusConfiguration.subscriptionData = {
  planName: 'Claude Max 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: 1600,
  usableQuotaFraction: 1,
};
const subscriptionCostResults = processLLMpkBatchScoring([
  apiCostConfiguration,
  chatGptPlusConfiguration,
  chatGptSubscriptionConfiguration,
  claudeProFableConfiguration,
  claudeSubscriptionConfiguration,
  claudeMaxOpusConfiguration,
]);
const subscriptionCostsById = new Map(subscriptionCostResults.map((result) => [
  result.config.id,
  result.practicalBreakdown.effectiveScenarioCostUSD,
]));
nearlyEqual(subscriptionCostsById.get('api-cost-route')!, 15);
nearlyEqual(
  subscriptionCostsById.get('chatgpt-pro-subscription')!,
  15 * 200 / 2000,
);
nearlyEqual(
  subscriptionCostsById.get('chatgpt-plus')!,
  15 * 20 / 100,
);
nearlyEqual(
  subscriptionCostsById.get('claude-max-subscription')!,
  15 * 200 / (1600 * 0.5),
);
nearlyEqual(
  subscriptionCostsById.get('claude-pro-fable')!,
  15 * 20 / (80 * 0.5),
);
nearlyEqual(
  subscriptionCostsById.get('claude-max-opus')!,
  15 * 200 / 1600,
);
assert.ok(
  subscriptionCostsById.get('claude-max-subscription')!
    > subscriptionCostsById.get('chatgpt-pro-subscription')!,
  'Fable 5 must not receive the unavailable half of the Claude Max allowance.',
);
nearlyEqual(
  subscriptionCostsById.get('chatgpt-plus')!,
  subscriptionCostsById.get('chatgpt-pro-subscription')! * 2,
);
nearlyEqual(
  subscriptionCostsById.get('claude-max-subscription')!,
  subscriptionCostsById.get('claude-max-opus')! * 2,
);

const adjustmentBreakdown = {
  rawCapabilityScore: 70,
  speedDelta: 2,
  costDelta: -0.75,
  practicalScore: 71.25,
  speedUtility: 0,
  costUtility: 0,
  effectiveScenarioCostUSD: 1,
  referenceCostUSD: 1,
  throughputRatio: 1,
  latencyRatio: 1,
};
assert.equal(getPracticalAdjustment(adjustmentBreakdown), 1.25);
assert.equal(formatPracticalAdjustment(1.25), '+1.3');
assert.equal(formatPracticalAdjustment(-1.25), '-1.3');
assert.equal(formatPracticalAdjustment(0), '0.0');
assert.equal(formatPracticalAdjustment(null), '数据不足');
assert.equal(practicalAdjustmentTextClass(1.25), 'text-emerald-600');
assert.equal(practicalAdjustmentTextClass(-1.25), 'text-rose-600');
assert.equal(
  getPracticalAdjustment({ ...adjustmentBreakdown, speedDelta: null }),
  null,
);

console.log('scoringEngine Scoring v1.2 + Practical Adjustment v1.4 policies: PASS');
