import assert from 'node:assert/strict';
import { DOMAIN_DEFINITIONS } from '../src/engine/scoringEngine';
import { DOMAIN_IDS, SCORING_CONFIG } from '../src/engine/scoringConfig';
import publicLeaderboardSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import type { PublicLeaderboardScore } from '../src/types/publicLeaderboard';
import { buildPlayModeQueue } from '../src/utils/playModeQueue';
import {
  CAPABILITY_PREFERENCE_DIMENSIONS,
  calculatePersonalizedScore,
  CUSTOM_RANKING_RESULT_LIMIT,
  DEFAULT_PREFERENCE_WEIGHTS,
  getNormalizedPreferenceShares,
  OVERALL_PREFERENCE_DIMENSIONS,
  OVERALL_PREFERENCE_BASELINE_WEIGHTS,
  PREFERENCE_DIMENSIONS,
  rankScoresByPreferences,
  rankTopScoresByPreferences,
  type OverallPreferenceDimensionId,
  type PreferenceWeights,
} from '../src/utils/customRanking';
import type { DomainId } from '../src/types/llm_pk';

const makeScore = (
  id: string,
  coding: number | null,
  speedUtility: number,
  costUtility: number,
): PublicLeaderboardScore => {
  const availableDomainScores = [50, 50, coding, 50, 50, 50].filter(
    (score): score is number => score !== null,
  );
  const rawCapabilityScore = availableDomainScores.some((score) => score <= 0)
    ? 0
    : 50 * Math.exp(availableDomainScores.reduce(
      (sum, score) => sum + Math.log(score / 50) / availableDomainScores.length,
      0,
    ));
  const speedDelta = speedUtility >= 0
    ? SCORING_CONFIG.practicalAdjustment.speed.rewardScale * speedUtility
    : SCORING_CONFIG.practicalAdjustment.speed.penaltyScale * speedUtility;
  const costDelta = costUtility >= 0
    ? SCORING_CONFIG.practicalAdjustment.cost.rewardScale * costUtility
    : SCORING_CONFIG.practicalAdjustment.cost.penaltyScale * costUtility;

  return {
    config: {
      id,
      name: `${id} | Test | Test API`,
      provider: 'Test',
      execution: { harness: 'Test' },
      observations: {},
    },
    domainScores: {
      chatting: { score: 50 },
      math_science: { score: 50 },
      coding: { score: coding },
      engineering: { score: 50 },
      agentic_work: { score: 50 },
      search_knowledge: { score: 50 },
    },
    rawCapabilityScore,
    practicalBreakdown: {
      rawCapabilityScore,
      speedDelta,
      costDelta,
      practicalScore: Math.max(0, rawCapabilityScore + speedDelta + costDelta),
      speedUtility,
      costUtility,
      effectiveScenarioCostUSD: 1,
      referenceCostUSD: 1,
      throughputRatio: 1,
      latencyRatio: 1,
    },
    eligibleForGlobalLeaderboard: true,
  };
};

const emptyWeights = (): PreferenceWeights => ({
  chatting: 0,
  math_science: 0,
  coding: 0,
  engineering: 0,
  agentic_work: 0,
  search_knowledge: 0,
  intelligence: 0,
  speed: 0,
  cost: 0,
});

const onlyOverall = (dimension: OverallPreferenceDimensionId): PreferenceWeights => ({
  ...emptyWeights(),
  [dimension]: 100,
});

const onlyCapability = (dimension: DomainId): PreferenceWeights => ({
  ...emptyWeights(),
  [dimension]: 100,
  intelligence: 100,
});

assert.equal(CAPABILITY_PREFERENCE_DIMENSIONS.length, 6);
assert.equal(OVERALL_PREFERENCE_DIMENSIONS.length, 3);
assert.equal(PREFERENCE_DIMENSIONS.length, 9);
assert.deepEqual(
  CAPABILITY_PREFERENCE_DIMENSIONS.map((dimension) => dimension.shortLabel),
  DOMAIN_IDS.map((domainId) => DOMAIN_DEFINITIONS[domainId].nameEn),
);
assert.deepEqual(OVERALL_PREFERENCE_BASELINE_WEIGHTS, {
  intelligence: 50,
  speed: 50,
  cost: 50,
});

const capabilityShares = getNormalizedPreferenceShares(
  DEFAULT_PREFERENCE_WEIGHTS,
  CAPABILITY_PREFERENCE_DIMENSIONS,
);
assert.ok(Math.abs(CAPABILITY_PREFERENCE_DIMENSIONS.reduce(
  (sum, dimension) => sum + capabilityShares[dimension.id],
  0,
) - 1) < 1e-12);
assert.ok(CAPABILITY_PREFERENCE_DIMENSIONS.every(
  (dimension) => Math.abs(capabilityShares[dimension.id] - 1 / 6) < 1e-12,
));

const overallShares = getNormalizedPreferenceShares(
  DEFAULT_PREFERENCE_WEIGHTS,
  OVERALL_PREFERENCE_DIMENSIONS,
);
assert.ok(Math.abs(OVERALL_PREFERENCE_DIMENSIONS.reduce(
  (sum, dimension) => sum + overallShares[dimension.id],
  0,
) - 1) < 1e-12);
assert.ok(OVERALL_PREFERENCE_DIMENSIONS.every(
  (dimension) => Math.abs(overallShares[dimension.id] - 1 / 3) < 1e-12,
));

const codingLeader = makeScore('coding-leader', 95, -0.5, -0.5);
const fastCheap = makeScore('fast-cheap', 40, 0.9, 0.8);

assert.equal(
  rankScoresByPreferences([fastCheap, codingLeader], onlyCapability('coding'))[0].item.config.id,
  'coding-leader',
);
assert.equal(
  rankScoresByPreferences([codingLeader, fastCheap], onlyOverall('speed'))[0].item.config.id,
  'fast-cheap',
);
assert.equal(
  rankScoresByPreferences([codingLeader, fastCheap], onlyOverall('cost'))[0].item.config.id,
  'fast-cheap',
);
assert.equal(
  rankScoresByPreferences(
    [fastCheap, codingLeader],
    {
      ...DEFAULT_PREFERENCE_WEIGHTS,
      intelligence: 100,
      speed: 0,
      cost: 0,
    },
  )[0].item.config.id,
  'coding-leader',
);

const allZero = onlyCapability('coding');
allZero.coding = 0;
assert.deepEqual(
  calculatePersonalizedScore(codingLeader, allZero),
  { score: null, coverage: 0 },
);

const missingCoding = makeScore('missing-coding', null, 0, 0);
assert.deepEqual(
  calculatePersonalizedScore(missingCoding, onlyCapability('coding')),
  { score: null, coverage: 0 },
);

const balancedScore = calculatePersonalizedScore(codingLeader, DEFAULT_PREFERENCE_WEIGHTS);
assert.equal(balancedScore.coverage, 1);
assert.ok(balancedScore.score !== null && balancedScore.score > 0);
assert.ok(Math.abs(
  balancedScore.score - codingLeader.practicalBreakdown.practicalScore!,
) < 1e-10);

const defaultRanked = rankScoresByPreferences(
  [codingLeader, fastCheap],
  DEFAULT_PREFERENCE_WEIGHTS,
);
const homepageRanked = [codingLeader, fastCheap].sort(
  (left, right) => right.practicalBreakdown.practicalScore!
    - left.practicalBreakdown.practicalScore!,
);
assert.deepEqual(
  defaultRanked.map((result) => result.item.config.id),
  homepageRanked.map((item) => item.config.id),
);
defaultRanked.forEach((result) => {
  assert.ok(Math.abs(
    result.personalizedScore! - result.item.practicalBreakdown.practicalScore!,
  ) < 1e-10);
});

const publicScores = publicLeaderboardSnapshot.scores as unknown as PublicLeaderboardScore[];
const representativePublicScores = buildPlayModeQueue(publicScores);
const representativeIds = new Set(
  representativePublicScores.map((item) => item.config.id),
);
const representativePublicRanking = rankScoresByPreferences(
  representativePublicScores,
  DEFAULT_PREFERENCE_WEIGHTS,
);
const customTopFive = rankTopScoresByPreferences(
  representativePublicScores,
  DEFAULT_PREFERENCE_WEIGHTS,
);
assert.equal(representativePublicScores.length, 45);
assert.equal(publicScores.length - representativePublicScores.length, 22);
assert.equal(representativePublicRanking.length, 45);
assert.equal(customTopFive.length, CUSTOM_RANKING_RESULT_LIMIT);
assert.ok(customTopFive.every((result) => representativeIds.has(result.item.config.id)));
assert.ok(publicScores
  .filter((item) => !representativeIds.has(item.config.id))
  .every((item) => !representativePublicRanking.some(
    (result) => result.item.config.id === item.config.id,
  )));

const defaultPublicRanking = rankScoresByPreferences(
  publicScores,
  DEFAULT_PREFERENCE_WEIGHTS,
);
defaultPublicRanking.forEach((result) => {
  assert.notEqual(result.item.practicalBreakdown.practicalScore, null);
  assert.notEqual(result.personalizedScore, null);
  assert.ok(Math.abs(
    result.personalizedScore! - result.item.practicalBreakdown.practicalScore!,
  ) < 1e-9);
});
const homepagePublicRanking = [...publicScores].sort((left, right) => {
  const practicalDifference = right.practicalBreakdown.practicalScore!
    - left.practicalBreakdown.practicalScore!;
  if (Math.abs(practicalDifference) > Number.EPSILON) return practicalDifference;
  return (right.rawCapabilityScore ?? Number.NEGATIVE_INFINITY)
    - (left.rawCapabilityScore ?? Number.NEGATIVE_INFINITY)
    || left.config.name.localeCompare(right.config.name);
});
assert.deepEqual(
  defaultPublicRanking.map((result) => result.item.config.id),
  homepagePublicRanking.map((item) => item.config.id),
);

console.log('custom ranking tests passed');
