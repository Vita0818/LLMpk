import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';

export const PLAY_MODE_DOMAIN_ORDER: readonly DomainId[] = [
  'chatting',
  'reasoning',
  'coding',
  'frontend',
  'agentic',
  'documents',
];

const parseDisplayIdentity = (name: string) => {
  const [model, harness] = name.split('|').map((part) => part.trim());

  return {
    model: model || name.trim(),
    harness: harness || 'Chat',
  };
};

const radarSignature = (item: PublicLeaderboardScore) =>
  PLAY_MODE_DOMAIN_ORDER.map((domainId) => {
    const score = item.domainScores[domainId]?.score;
    return score === null || score === undefined ? 'null' : String(score);
  }).join('|');

/**
 * Access routes are merged only when the displayed model, harness, and all six
 * radar values match. This prevents similarly named configurations with
 * genuinely different capability evidence from being collapsed.
 */
export const getPlayModeRouteGroupKey = (item: PublicLeaderboardScore) => {
  const identity = parseDisplayIdentity(item.config.name);
  return `${identity.model}\u0000${identity.harness}\u0000${radarSignature(item)}`;
};

const nullableScore = (score: number | null | undefined) =>
  typeof score === 'number' && Number.isFinite(score)
    ? score
    : Number.NEGATIVE_INFINITY;

const compareRepresentativeRoute = (
  left: PublicLeaderboardScore,
  right: PublicLeaderboardScore,
) => (
  nullableScore(right.practicalBreakdown.practicalScore)
    - nullableScore(left.practicalBreakdown.practicalScore)
  || nullableScore(right.rawCapabilityScore)
    - nullableScore(left.rawCapabilityScore)
  || left.config.name.localeCompare(right.config.name)
);

const subscriptionTier = (item: PublicLeaderboardScore) => {
  const plan = item.config.subscriptionData?.planName ?? '';
  return /\bultra\b|\bmax\b|\bheavy\b/iu.test(plan) ? 3
    : /\bpro\b/iu.test(plan) ? 2
      : /\bplus\b/iu.test(plan) ? 1 : 0;
};

/** Reader policy: equivalent access routes prefer the highest subscription. */
const compareAccessRepresentative = (left: PublicLeaderboardScore, right: PublicLeaderboardScore) => {
  const leftPlan = left.config.subscriptionData;
  const rightPlan = right.config.subscriptionData;
  if (Boolean(leftPlan) !== Boolean(rightPlan)) return rightPlan ? 1 : -1;
  if (leftPlan && rightPlan) {
    const tierDifference = subscriptionTier(right) - subscriptionTier(left)
      || rightPlan.monthlyPriceUSD - leftPlan.monthlyPriceUSD
      || rightPlan.apiEquivalentCostUSD * rightPlan.usableQuotaFraction
        - leftPlan.apiEquivalentCostUSD * leftPlan.usableQuotaFraction;
    if (tierDifference) return tierDifference;
  }
  return nullableScore(right.practicalBreakdown.practicalScore) - nullableScore(left.practicalBreakdown.practicalScore)
    || nullableScore(right.practicalBreakdown.costDelta) - nullableScore(left.practicalBreakdown.costDelta)
    || compareRepresentativeRoute(left, right);
};

const compareRawCapabilityRoute = (
  left: PublicLeaderboardScore,
  right: PublicLeaderboardScore,
) => (
  nullableScore(right.rawCapabilityScore)
    - nullableScore(left.rawCapabilityScore)
  || nullableScore(right.practicalBreakdown.practicalScore)
    - nullableScore(left.practicalBreakdown.practicalScore)
  || left.config.name.localeCompare(right.config.name)
);

/**
 * Builds the recording/playback queue.
 *
 * - Every distinct model + harness + radar profile remains represented.
 * - API/subscription routes with the same radar profile are collapsed.
 * - The highest subscription tier represents equivalent access routes.
 * - API-only groups use practical score/cost when selecting a representative.
 * - The returned queue is ranked from highest to lowest practical score.
 */
export const buildRepresentativeConfigurationQueue = <T extends PublicLeaderboardScore>(
  scores: readonly T[],
): T[] => {
  const groupedRoutes = new Map<string, T[]>();

  scores.forEach((item) => {
    const key = getPlayModeRouteGroupKey(item);
    const group = groupedRoutes.get(key);
    if (group) {
      group.push(item);
    } else {
      groupedRoutes.set(key, [item]);
    }
  });

  return Array.from(groupedRoutes.values())
    .map((group) => [...group].sort(compareAccessRepresentative)[0])
    .sort(compareRepresentativeRoute);
};

/** Ordinal playback ranks are reserved for configurations passing all coverage gates. */
export const buildPlayModeQueue = <T extends PublicLeaderboardScore>(scores: readonly T[]): T[] => (
  buildRepresentativeConfigurationQueue(scores.filter(item => item.eligibleForGlobalLeaderboard))
);

/**
 * Gives the representative playback routes their radar-overview order without
 * changing which access route represents each identical radar profile.
 */
export const sortRadarOverviewScores = <T extends PublicLeaderboardScore>(
  representativeScores: readonly T[],
): T[] => [...representativeScores].sort(compareRawCapabilityRoute);
