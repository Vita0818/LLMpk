import type { PublicLeaderboardScore } from '../types/publicLeaderboard';

/**
 * The three raw objectives used by the public Pareto view.
 *
 * Intelligence and output speed are maximized. Effective scenario cost is
 * minimized. Visual transforms (for example the logarithmic cost axis) must
 * never be applied before dominance is calculated.
 */
export interface ParetoObjectives {
  intelligence: number;
  effectiveScenarioCostUSD: number;
  outputTokensPerSecond: number;
}

export interface ParetoDatum<T extends PublicLeaderboardScore = PublicLeaderboardScore> {
  item: T;
  objectives: ParetoObjectives;
  /** One is the non-dominated frontier; larger values are successively dominated layers. */
  layer: number;
}

/** A point in the normalized objective cube used to build the visual envelope. */
export interface NormalizedParetoPoint {
  cost: number;
  intelligence: number;
  speed: number;
}

export interface ParetoEnvelopeFace {
  kind: 'top' | 'riser';
  points: [
    NormalizedParetoPoint,
    NormalizedParetoPoint,
    NormalizedParetoPoint,
    NormalizedParetoPoint,
  ];
}

export const getParetoObjectives = (
  item: PublicLeaderboardScore,
): ParetoObjectives | null => {
  const intelligence = item.rawCapabilityScore;
  const effectiveScenarioCostUSD = item.practicalBreakdown.effectiveScenarioCostUSD;
  const outputTokensPerSecond = item.config.openRouterData?.throughputP50TokensPerSec;

  if (
    item.eligibleForGlobalLeaderboard === false
    || intelligence === null
    || effectiveScenarioCostUSD === null
    || outputTokensPerSecond === undefined
    || !Number.isFinite(intelligence)
    || !Number.isFinite(effectiveScenarioCostUSD)
    || !Number.isFinite(outputTokensPerSecond)
    || effectiveScenarioCostUSD < 0
    || outputTokensPerSecond <= 0
  ) {
    return null;
  }

  return {
    intelligence,
    effectiveScenarioCostUSD,
    outputTokensPerSecond,
  };
};

/** True only when left is no worse in every objective and better in at least one. */
export const dominates = (
  left: ParetoObjectives,
  right: ParetoObjectives,
): boolean => {
  const noWorse = (
    left.intelligence >= right.intelligence
    && left.effectiveScenarioCostUSD <= right.effectiveScenarioCostUSD
    && left.outputTokensPerSecond >= right.outputTokensPerSecond
  );
  const strictlyBetter = (
    left.intelligence > right.intelligence
    || left.effectiveScenarioCostUSD < right.effectiveScenarioCostUSD
    || left.outputTokensPerSecond > right.outputTokensPerSecond
  );

  return noWorse && strictlyBetter;
};

/**
 * Extract every non-dominated layer. The dataset is intentionally small, so
 * the direct O(n^3) layered implementation keeps the definition inspectable.
 */
export const calculateParetoLayers = <T extends PublicLeaderboardScore>(
  items: readonly T[],
): ParetoDatum<T>[] => {
  const remaining = items.flatMap((item) => {
    const objectives = getParetoObjectives(item);
    return objectives ? [{ item, objectives }] : [];
  });
  const result: ParetoDatum<T>[] = [];
  let layer = 1;

  while (remaining.length > 0) {
    const frontier = remaining.filter((candidate) => (
      !remaining.some((other) => (
        other !== candidate && dominates(other.objectives, candidate.objectives)
      ))
    ));

    // This cannot happen for a finite strict partial order, but prevents a
    // malformed future comparator from creating an infinite loop.
    if (frontier.length === 0) break;

    frontier.forEach((datum) => result.push({ ...datum, layer }));
    const frontierItems = new Set(frontier.map((datum) => datum.item.config.id));
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (frontierItems.has(remaining[index].item.config.id)) {
        remaining.splice(index, 1);
      }
    }
    layer += 1;
  }

  return result;
};

export const getParetoFrontier = <T extends PublicLeaderboardScore>(
  items: readonly T[],
): ParetoDatum<T>[] => calculateParetoLayers(items).filter((datum) => datum.layer === 1);

export const countDominators = <T extends PublicLeaderboardScore>(
  target: ParetoDatum<T>,
  population: readonly ParetoDatum<T>[],
) => population.filter((candidate) => (
  candidate.item.config.id !== target.item.config.id
  && dominates(candidate.objectives, target.objectives)
)).length;

const ENVELOPE_EPSILON = 1e-12;

const normalizedBoundaryValues = (values: readonly number[]) => (
  Array.from(new Set([0, 1, ...values.map((value) => Math.max(0, Math.min(1, value)))]))
    .sort((left, right) => left - right)
);

/**
 * Builds the exact axis-aligned upper boundary of the dominated volume for a
 * finite three-objective Pareto set. The result is a staircase envelope, not
 * an interpolation between configurations.
 */
export const buildParetoEnvelopeFaces = (
  frontier: readonly NormalizedParetoPoint[],
): ParetoEnvelopeFace[] => {
  if (frontier.length === 0) return [];

  const costs = normalizedBoundaryValues(frontier.map((point) => point.cost));
  const speeds = normalizedBoundaryValues(frontier.map((point) => point.speed));
  const heights: Array<Array<number | null>> = costs.slice(0, -1).map(
    (costStart, costIndex) => speeds.slice(0, -1).map((speedStart, speedIndex) => {
      const sampleCost = (costStart + costs[costIndex + 1]) / 2;
      const sampleSpeed = (speedStart + speeds[speedIndex + 1]) / 2;
      const supportingPoints = frontier.filter((point) => (
        point.cost <= sampleCost + ENVELOPE_EPSILON
        && point.speed >= sampleSpeed - ENVELOPE_EPSILON
      ));
      return supportingPoints.length === 0
        ? null
        : Math.max(...supportingPoints.map((point) => point.intelligence));
    }),
  );
  const faces: ParetoEnvelopeFace[] = [];

  heights.forEach((column, costIndex) => {
    column.forEach((height, speedIndex) => {
      if (height === null) return;
      faces.push({
        kind: 'top',
        points: [
          { cost: costs[costIndex], intelligence: height, speed: speeds[speedIndex] },
          { cost: costs[costIndex + 1], intelligence: height, speed: speeds[speedIndex] },
          { cost: costs[costIndex + 1], intelligence: height, speed: speeds[speedIndex + 1] },
          { cost: costs[costIndex], intelligence: height, speed: speeds[speedIndex + 1] },
        ],
      });
    });
  });

  // Vertical risers at cost thresholds.
  for (let costBoundaryIndex = 1; costBoundaryIndex < costs.length - 1; costBoundaryIndex += 1) {
    for (let speedIndex = 0; speedIndex < speeds.length - 1; speedIndex += 1) {
      const leftHeight = heights[costBoundaryIndex - 1][speedIndex];
      const rightHeight = heights[costBoundaryIndex][speedIndex];
      const low = Math.min(leftHeight ?? 0, rightHeight ?? 0);
      const high = Math.max(leftHeight ?? 0, rightHeight ?? 0);
      if (high - low <= ENVELOPE_EPSILON) continue;
      const cost = costs[costBoundaryIndex];
      faces.push({
        kind: 'riser',
        points: [
          { cost, intelligence: low, speed: speeds[speedIndex] },
          { cost, intelligence: high, speed: speeds[speedIndex] },
          { cost, intelligence: high, speed: speeds[speedIndex + 1] },
          { cost, intelligence: low, speed: speeds[speedIndex + 1] },
        ],
      });
    }
  }

  // Vertical risers at speed thresholds.
  for (let speedBoundaryIndex = 1; speedBoundaryIndex < speeds.length - 1; speedBoundaryIndex += 1) {
    for (let costIndex = 0; costIndex < costs.length - 1; costIndex += 1) {
      const lowerSpeedHeight = heights[costIndex][speedBoundaryIndex - 1];
      const higherSpeedHeight = heights[costIndex][speedBoundaryIndex];
      const low = Math.min(lowerSpeedHeight ?? 0, higherSpeedHeight ?? 0);
      const high = Math.max(lowerSpeedHeight ?? 0, higherSpeedHeight ?? 0);
      if (high - low <= ENVELOPE_EPSILON) continue;
      const speed = speeds[speedBoundaryIndex];
      faces.push({
        kind: 'riser',
        points: [
          { cost: costs[costIndex], intelligence: low, speed },
          { cost: costs[costIndex], intelligence: high, speed },
          { cost: costs[costIndex + 1], intelligence: high, speed },
          { cost: costs[costIndex + 1], intelligence: low, speed },
        ],
      });
    }
  }

  return faces;
};
