const PRICE_TIER_ANCHORS = [
  { id: '0.10/0.50', input: 0.1, output: 0.5 },
  { id: '0.20/1', input: 0.2, output: 1 },
  { id: '0.40/2', input: 0.4, output: 2 },
  { id: '1/5', input: 1, output: 5 },
  { id: '2/10', input: 2, output: 10 },
  { id: '4/20', input: 4, output: 20 },
  { id: '10/50', input: 10, output: 50 },
] as const;

export type PriceTierId = typeof PRICE_TIER_ANCHORS[number]['id'];

export interface PriceTier {
  id: PriceTierId;
  /** Reference API prices in USD per million input/output tokens. */
  input: number;
  output: number;
  /** Cost of 1M input + 0.25M output tokens, matching practical scoring. */
  scenarioCostUSD: number;
  lowerBoundUSD: number;
  upperBoundUSD: number | null;
}

const scenarioCosts = PRICE_TIER_ANCHORS.map(({ input, output }) => input + 0.25 * output);

/** Keep full precision for classification; rounding is display-only. */
export const PRICE_TIER_BOUNDARIES = scenarioCosts.slice(1).map((cost, index) => (
  Math.sqrt(scenarioCosts[index] * cost)
));

export const PRICE_TIERS: readonly PriceTier[] = PRICE_TIER_ANCHORS.map((anchor, index) => ({
  ...anchor,
  scenarioCostUSD: scenarioCosts[index],
  lowerBoundUSD: index === 0 ? 0 : PRICE_TIER_BOUNDARIES[index - 1],
  upperBoundUSD: PRICE_TIER_BOUNDARIES[index] ?? null,
}));

/**
 * Classify the existing effective scenario cost, including subscription
 * conversion. Do not substitute API list prices for an unknown subscription
 * allowance. Ranges include their lower bound; equality goes to the higher tier.
 */
export function getPriceTier(effectiveScenarioCostUSD: number | null | undefined): PriceTier | null {
  if (typeof effectiveScenarioCostUSD !== 'number'
    || !Number.isFinite(effectiveScenarioCostUSD) || effectiveScenarioCostUSD < 0) return null;

  return PRICE_TIERS.find(tier => tier.upperBoundUSD === null
    || effectiveScenarioCostUSD < tier.upperBoundUSD) ?? null;
}
