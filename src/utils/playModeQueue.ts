import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';

export const PLAY_MODE_DOMAIN_ORDER: readonly DomainId[] = [
  'chatting',
  'math_science',
  'coding',
  'engineering',
  'agentic_work',
  'search_knowledge',
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
 * - The route with the highest practical score represents each collapsed group.
 * - The returned queue is ranked from highest to lowest practical score.
 */
export const buildPlayModeQueue = <T extends PublicLeaderboardScore>(
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
    .map((group) => [...group].sort(compareRepresentativeRoute)[0])
    .sort(compareRepresentativeRoute);
};

/**
 * Gives the representative playback routes their radar-overview order without
 * changing which access route represents each identical radar profile.
 */
export const sortRadarOverviewScores = <T extends PublicLeaderboardScore>(
  representativeScores: readonly T[],
): T[] => [...representativeScores].sort(compareRawCapabilityRoute);
