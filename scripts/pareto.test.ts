import assert from 'node:assert/strict';
import type { PublicLeaderboardScore } from '../src/types/publicLeaderboard';
import {
  buildParetoEnvelopeFaces,
  calculateParetoLayers,
  dominates,
  getParetoFrontier,
  getParetoObjectives,
} from '../src/utils/pareto';

const score = (
  id: string,
  intelligence: number | null,
  cost: number | null,
  speed: number | null,
  eligible = true,
): PublicLeaderboardScore => ({
  config: {
    id,
    name: id,
    provider: 'Test',
    execution: { harness: 'Test' },
    observations: {},
    ...(speed === null
      ? {}
      : {
          openRouterData: {
            inputPricePerMToken: cost ?? 0,
            outputPricePerMToken: 0,
            ttftP50Seconds: 1,
            throughputP50TokensPerSec: speed,
          },
        }),
  },
  domainScores: {
    chatting: { score: intelligence },
    reasoning: { score: intelligence },
    coding: { score: intelligence },
    frontend: { score: intelligence },
    agentic: { score: intelligence },
    documents: { score: intelligence },
  },
  rawCapabilityScore: intelligence,
  practicalBreakdown: {
    rawCapabilityScore: intelligence,
    speedDelta: null,
    costDelta: null,
    practicalScore: null,
    speedUtility: null,
    costUtility: null,
    effectiveScenarioCostUSD: cost,
    referenceCostUSD: null,
    throughputRatio: null,
    latencyRatio: null,
  },
  eligibleForGlobalLeaderboard: eligible,
});

const strong = getParetoObjectives(score('strong', 80, 1, 100));
const weak = getParetoObjectives(score('weak', 70, 2, 90));
assert.ok(strong && weak);
assert.equal(dominates(strong, weak), true);
assert.equal(dominates(weak, strong), false);

const equalA = getParetoObjectives(score('equal-a', 50, 1, 50));
const equalB = getParetoObjectives(score('equal-b', 50, 1, 50));
assert.ok(equalA && equalB);
assert.equal(dominates(equalA, equalB), false, 'equal points must coexist on the frontier');

const population = [
  score('quality', 90, 5, 70),
  score('balanced', 80, 2, 90),
  score('economy', 60, 0, 110),
  score('dominated', 50, 4, 40),
];
assert.deepEqual(
  getParetoFrontier(population).map((datum) => datum.item.config.id),
  ['quality', 'balanced', 'economy'],
);

const layered = calculateParetoLayers(population);
assert.equal(layered.find((datum) => datum.item.config.id === 'dominated')?.layer, 2);
assert.equal(layered.find((datum) => datum.item.config.id === 'quality')?.layer, 1);

assert.equal(getParetoObjectives(score('missing-cost', 50, null, 50)), null);
assert.equal(getParetoObjectives(score('missing-speed', 50, 1, null)), null);
assert.equal(getParetoObjectives(score('ineligible', 50, 1, 50, false)), null);
assert.ok(getParetoObjectives(score('free', 50, 0, 50)), 'zero-cost routes are valid');

const singlePointEnvelope = buildParetoEnvelopeFaces([
  { cost: 0.25, intelligence: 0.75, speed: 0.5 },
]);
assert.equal(singlePointEnvelope.filter((face) => face.kind === 'top').length, 1);
assert.equal(singlePointEnvelope.filter((face) => face.kind === 'riser').length, 2);
assert.deepEqual(singlePointEnvelope.find((face) => face.kind === 'top')?.points, [
  { cost: 0.25, intelligence: 0.75, speed: 0 },
  { cost: 1, intelligence: 0.75, speed: 0 },
  { cost: 1, intelligence: 0.75, speed: 0.5 },
  { cost: 0.25, intelligence: 0.75, speed: 0.5 },
]);

console.log('pareto tests passed');
