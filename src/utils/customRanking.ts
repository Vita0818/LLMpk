import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import { DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { DOMAIN_IDS } from '../engine/scoringConfig';

export type OverallPreferenceDimensionId = 'intelligence' | 'speed' | 'cost';
export type PreferenceDimensionId = DomainId | OverallPreferenceDimensionId;

export interface PreferenceDimensionDefinition<
  TId extends PreferenceDimensionId = PreferenceDimensionId,
> {
  id: TId;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export type PreferenceWeights = Record<PreferenceDimensionId, number>;

export const CAPABILITY_PREFERENCE_DIMENSIONS: readonly PreferenceDimensionDefinition<DomainId>[] = (
  DOMAIN_IDS.map((id) => {
    const definition = DOMAIN_DEFINITIONS[id];
    return {
      id,
      label: definition.nameEn,
      shortLabel: definition.nameEn,
      color: definition.color,
      description: definition.description,
    };
  })
);

export const OVERALL_PREFERENCE_DIMENSIONS: readonly PreferenceDimensionDefinition<OverallPreferenceDimensionId>[] = [
  {
    id: 'intelligence',
    label: 'Intelligence',
    shortLabel: 'Intelligence',
    color: '#581C87',
    description: '由六项理论能力偏好合成的整体能力',
  },
  {
    id: 'cost',
    label: 'Cost',
    shortLabel: 'Cost',
    color: '#6366F1',
    description: '同等使用场景下的价格优势',
  },
  {
    id: 'speed',
    label: 'Speed',
    shortLabel: 'Speed',
    color: '#F97316',
    description: '输出吞吐与首字延迟的综合表现',
  },
] as const;

export const PREFERENCE_DIMENSIONS: readonly PreferenceDimensionDefinition[] = [
  ...CAPABILITY_PREFERENCE_DIMENSIONS,
  ...OVERALL_PREFERENCE_DIMENSIONS,
] as const;

/**
 * The triangle controls relative multipliers, not absolute score spans. Equal
 * midpoint values form a neutral equilateral triangle: every component keeps
 * its own natural homepage-policy impact at 1x.
 */
export const OVERALL_PREFERENCE_BASELINE_WEIGHTS: Record<OverallPreferenceDimensionId, number> = {
  intelligence: 50,
  speed: 50,
  cost: 50,
};

export const DEFAULT_PREFERENCE_WEIGHTS: PreferenceWeights = {
  chatting: 50,
  math_science: 50,
  coding: 50,
  engineering: 50,
  agentic_work: 50,
  search_knowledge: 50,
  ...OVERALL_PREFERENCE_BASELINE_WEIGHTS,
};

export interface PersonalizedScoreResult {
  score: number | null;
  coverage: number;
}

export interface CustomRankedScore<T extends PublicLeaderboardScore = PublicLeaderboardScore> {
  item: T;
  personalizedScore: number | null;
  preferenceCoverage: number;
}

export const clampPreferenceWeight = (value: number) => (
  Math.max(0, Math.min(100, Math.round(value)))
);

export const getNormalizedPreferenceShares = (
  weights: PreferenceWeights,
  dimensions: readonly PreferenceDimensionDefinition[] = PREFERENCE_DIMENSIONS,
): Record<PreferenceDimensionId, number> => {
  const total = dimensions.reduce(
    (sum, dimension) => sum + clampPreferenceWeight(weights[dimension.id]),
    0,
  );
  const shares = Object.fromEntries(
    PREFERENCE_DIMENSIONS.map((dimension) => [dimension.id, 0]),
  ) as Record<PreferenceDimensionId, number>;
  dimensions.forEach((dimension) => {
    shares[dimension.id] = total > 0
      ? clampPreferenceWeight(weights[dimension.id]) / total
      : 0;
  });
  return shares;
};

export const getPreferenceDimensionScore = (
  item: PublicLeaderboardScore,
  dimensionId: PreferenceDimensionId,
): number | null => {
  if (dimensionId === 'intelligence') {
    const score = item.rawCapabilityScore;
    return score === null || !Number.isFinite(score)
      ? null
      : Math.max(0, Math.min(100, score));
  }
  if (dimensionId === 'speed') {
    const delta = item.practicalBreakdown.speedDelta;
    return delta === null || !Number.isFinite(delta) ? null : 50 + delta;
  }
  if (dimensionId === 'cost') {
    const delta = item.practicalBreakdown.costDelta;
    return delta === null || !Number.isFinite(delta) ? null : 50 + delta;
  }

  const score = item.domainScores[dimensionId].score;
  return score === null || !Number.isFinite(score)
    ? null
    : Math.max(0, Math.min(100, score));
};

interface WeightedPreferenceScore {
  score: number;
  weight: number;
}

const weightedGeometricMean = (
  available: readonly WeightedPreferenceScore[],
): number | null => {
  const availableWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
  if (availableWeight <= 0) return null;
  if (available.some((entry) => entry.score <= 0)) return 0;

  const weightedLogScore = available.reduce(
    (sum, entry) => sum + (entry.weight / availableWeight) * Math.log(entry.score / 100),
    0,
  );
  return 100 * Math.exp(weightedLogScore);
};

/**
 * Hierarchical preference model:
 * 1. The six-point capability hexagon combines the observed domain scores
 *    into a user-defined Intelligence score.
 * 2. The three-point triangle scales centered Intelligence, Speed Delta, and
 *    Cost Delta contributions relative to the homepage policy baseline.
 *    Default weights therefore reproduce the homepage Practical score exactly.
 *    Missing observations are excluded at their own layer and the remaining
 *    selected weights are renormalized.
 */
export const calculatePersonalizedScore = (
  item: PublicLeaderboardScore,
  weights: PreferenceWeights,
): PersonalizedScoreResult => {
  const selectedCapabilityWeight = CAPABILITY_PREFERENCE_DIMENSIONS.reduce(
    (sum, dimension) => sum + clampPreferenceWeight(weights[dimension.id]),
    0,
  );
  const availableCapabilities = CAPABILITY_PREFERENCE_DIMENSIONS.flatMap((dimension) => {
    const weight = clampPreferenceWeight(weights[dimension.id]);
    if (weight <= 0) return [];
    const score = getPreferenceDimensionScore(item, dimension.id);
    return score === null ? [] : [{ score, weight }];
  });
  const availableCapabilityWeight = availableCapabilities.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
  const intelligenceScore = weightedGeometricMean(availableCapabilities);
  const intelligenceCoverage = selectedCapabilityWeight > 0
    ? availableCapabilityWeight / selectedCapabilityWeight
    : 0;

  const selectedOverallFactor = OVERALL_PREFERENCE_DIMENSIONS.reduce(
    (sum, dimension) => sum
      + clampPreferenceWeight(weights[dimension.id])
        / OVERALL_PREFERENCE_BASELINE_WEIGHTS[dimension.id],
    0,
  );
  if (selectedOverallFactor <= 0) {
    return { score: null, coverage: 0 };
  }

  const availableOverall = OVERALL_PREFERENCE_DIMENSIONS.flatMap((dimension) => {
    const weight = clampPreferenceWeight(weights[dimension.id]);
    if (weight <= 0) return [];
    const factor = weight / OVERALL_PREFERENCE_BASELINE_WEIGHTS[dimension.id];
    const score = dimension.id === 'intelligence'
      ? intelligenceScore
      : getPreferenceDimensionScore(item, dimension.id);
    return score === null ? [] : [{ centeredScore: score - 50, factor }];
  });
  const normalizationFactor = availableOverall.reduce(
    (largest, entry) => Math.max(largest, entry.factor),
    0,
  );
  if (normalizationFactor <= 0) return { score: null, coverage: 0 };
  const score = Math.max(0, 50 + availableOverall.reduce(
    (sum, entry) => sum + entry.factor * entry.centeredScore,
    0,
  ) / normalizationFactor);

  const coveredOverallFactor = OVERALL_PREFERENCE_DIMENSIONS.reduce((sum, dimension) => {
    const weight = clampPreferenceWeight(weights[dimension.id]);
    if (weight <= 0) return sum;
    const factor = weight / OVERALL_PREFERENCE_BASELINE_WEIGHTS[dimension.id];
    if (dimension.id === 'intelligence') {
      return intelligenceScore === null
        ? sum
        : sum + factor * intelligenceCoverage;
    }
    return getPreferenceDimensionScore(item, dimension.id) === null
      ? sum
      : sum + factor;
  }, 0);

  return {
    score,
    coverage: coveredOverallFactor / selectedOverallFactor,
  };
};

export const rankScoresByPreferences = <T extends PublicLeaderboardScore>(
  items: T[],
  weights: PreferenceWeights,
): CustomRankedScore<T>[] => (
  items
    .map((item) => {
      const result = calculatePersonalizedScore(item, weights);
      return {
        item,
        personalizedScore: result.score,
        preferenceCoverage: result.coverage,
      };
    })
    .sort((left, right) => {
      if (left.personalizedScore === null && right.personalizedScore === null) {
        return left.item.config.name.localeCompare(right.item.config.name);
      }
      if (left.personalizedScore === null) return 1;
      if (right.personalizedScore === null) return -1;

      return right.personalizedScore - left.personalizedScore
        || (right.item.practicalBreakdown.practicalScore ?? Number.NEGATIVE_INFINITY)
          - (left.item.practicalBreakdown.practicalScore ?? Number.NEGATIVE_INFINITY)
        || (right.item.rawCapabilityScore ?? Number.NEGATIVE_INFINITY)
          - (left.item.rawCapabilityScore ?? Number.NEGATIVE_INFINITY)
        || left.item.config.name.localeCompare(right.item.config.name);
    })
);
