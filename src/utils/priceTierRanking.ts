import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import { getPriceTier, PRICE_TIERS, type PriceTierId } from './priceTiers';

export type PriceRankingSortKey = 'rawCapabilityScore' | 'practicalScore' | DomainId;
export const DEFAULT_PRICE_TIER: PriceTierId = PRICE_TIERS[0].id;

export const priceTierPageHash = (tierId: PriceTierId) => `#prices/${tierId.replace('/', '-')}`;

export function priceTierFromHash(hash: string): PriceTierId | null {
  if (hash !== '#prices' && !hash.startsWith('#prices/')) return null;
  return PRICE_TIERS.find(tier => priceTierPageHash(tier.id) === hash)?.id ?? DEFAULT_PRICE_TIER;
}

const scoreValue = (item: PublicLeaderboardScore, key: PriceRankingSortKey): number | null => {
  const value = key === 'practicalScore' ? item.practicalBreakdown.practicalScore
    : key === 'rawCapabilityScore' ? item.rawCapabilityScore : item.domainScores[key].score;
  return value !== null && Number.isFinite(value) ? value : null;
};

/** Filter the complete inventory before ranking; never fold an API into a different price tier. */
export function rankPriceTierConfigurations<T extends PublicLeaderboardScore>(
  scores: readonly T[],
  tierId: PriceTierId,
  sortKey: PriceRankingSortKey = 'practicalScore',
  sortOrder: 'asc' | 'desc' = 'desc',
): { item: T; rank: number | null }[] {
  const compare = (left: T, right: T, order: 'asc' | 'desc') => {
    const a = scoreValue(left, sortKey);
    const b = scoreValue(right, sortKey);
    if (a === null && b === null) return left.config.name.localeCompare(right.config.name);
    if (a === null) return 1;
    if (b === null) return -1;
    return (order === 'desc' ? b - a : a - b)
      || (right.rawCapabilityScore ?? Number.NEGATIVE_INFINITY) - (left.rawCapabilityScore ?? Number.NEGATIVE_INFINITY)
      || left.config.name.localeCompare(right.config.name);
  };
  const descending = scores
    .filter(item => getPriceTier(item.practicalBreakdown.effectiveScenarioCostUSD)?.id === tierId)
    .sort((left, right) => compare(left, right, 'desc'));
  let rank = 0;
  const rows = descending.map(item => ({
    item,
    rank: item.eligibleForGlobalLeaderboard && scoreValue(item, sortKey) !== null ? ++rank : null,
  }));
  // Reversing the display order must not relabel the weakest score as rank #1.
  return sortOrder === 'desc' ? rows : rows.sort((left, right) => compare(left.item, right.item, 'asc'));
}
