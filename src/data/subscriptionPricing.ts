/**
 * Reviewed subscription measurements, keyed by exact plan AND model.
 * Values are monthly API-equivalent allowances for SemiAnalysis's agentic
 * workload. They are not cash credits, API access, or a measured allowance
 * for LLMpk's uncached 1M-input + 0.25M-output comparison scenario.
 */
export const SUBSCRIPTION_PRICING_CHECKED_ON = '2026-10-11';
export const SEMIANALYSIS_SUBSCRIPTION_SOURCE =
  'https://newsletter.semianalysis.com/p/anthropic-subscriptions-offer-5x';

export interface SubscriptionPricingEvidence {
  id: string;
  kind: 'measured' | 'legacy-estimate';
  checkedOn: string;
  sourceUrl?: string;
  publishedOn?: string;
  workload?: 'agentic';
}

export interface MeasuredSubscriptionPricing extends SubscriptionPricingEvidence {
  kind: 'measured';
  planName: string;
  modelName: string;
  monthlyPriceUSD: number;
  /** Net allowance: already includes any model-specific quota cap. */
  usableApiEquivalentCostUSD: number;
  usableQuotaFraction: number;
  chartUrl: string;
}

const FLAGSHIP_CHART =
  'https://substack-post-media.s3.amazonaws.com/public/images/181ea48e-2e63-4f41-a742-c7af3d7eeb15_2048x1157.png';
const MID_TIER_CHART =
  'https://substack-post-media.s3.amazonaws.com/public/images/44bfcff4-5589-4822-a348-bc4e83cf478b_2048x1161.png';
const CLAUDE_CHART =
  'https://substack-post-media.s3.amazonaws.com/public/images/8fc90004-5853-4cd5-87ff-465898c5ee6b_2048x1033.png';

type MeasurementInput = Pick<MeasuredSubscriptionPricing,
  | 'id' | 'planName' | 'modelName' | 'monthlyPriceUSD'
  | 'usableApiEquivalentCostUSD' | 'usableQuotaFraction' | 'chartUrl'>;

const REVIEWED_MEASUREMENTS: readonly MeasurementInput[] = [
  { id: 'sa-2026-10-05-plus-sol-6-1', planName: 'ChatGPT Plus', modelName: 'GPT-6.1 Sol', monthlyPriceUSD: 20, usableApiEquivalentCostUSD: 211, usableQuotaFraction: 1, chartUrl: MID_TIER_CHART },
  { id: 'sa-2026-10-05-pro-200-sol-6-1', planName: 'ChatGPT Pro $200', modelName: 'GPT-6.1 Sol', monthlyPriceUSD: 200, usableApiEquivalentCostUSD: 2084, usableQuotaFraction: 1, chartUrl: MID_TIER_CHART },
  { id: 'sa-2026-10-05-plus-astra-6', planName: 'ChatGPT Plus', modelName: 'GPT-6 Astra', monthlyPriceUSD: 20, usableApiEquivalentCostUSD: 162, usableQuotaFraction: 1, chartUrl: FLAGSHIP_CHART },
  { id: 'sa-2026-10-05-pro-200-astra-6', planName: 'ChatGPT Pro $200', modelName: 'GPT-6 Astra', monthlyPriceUSD: 200, usableApiEquivalentCostUSD: 2897, usableQuotaFraction: 1, chartUrl: FLAGSHIP_CHART },
  { id: 'sa-2026-10-05-pro-opus-5-5', planName: 'Claude Pro', modelName: 'Claude Opus 5.5', monthlyPriceUSD: 20, usableApiEquivalentCostUSD: 1178, usableQuotaFraction: 1, chartUrl: MID_TIER_CHART },
  { id: 'sa-2026-10-05-max-20x-opus-5-5', planName: 'Claude Max 20×', modelName: 'Claude Opus 5.5', monthlyPriceUSD: 200, usableApiEquivalentCostUSD: 11726, usableQuotaFraction: 1, chartUrl: MID_TIER_CHART },
  { id: 'sa-2026-10-05-pro-sonnet-5-5', planName: 'Claude Pro', modelName: 'Claude Sonnet 5.5', monthlyPriceUSD: 20, usableApiEquivalentCostUSD: 1241, usableQuotaFraction: 1, chartUrl: CLAUDE_CHART },
  { id: 'sa-2026-10-05-max-20x-sonnet-5-5', planName: 'Claude Max 20×', modelName: 'Claude Sonnet 5.5', monthlyPriceUSD: 200, usableApiEquivalentCostUSD: 12524, usableQuotaFraction: 1, chartUrl: CLAUDE_CHART },
  // $2,485 is already capped at Fable's 50% share. The scoring engine uses
  // a full-plan basis × share, so the preset builder must store 4,970 × 0.5.
  { id: 'sa-2026-10-05-max-20x-fable-5-1', planName: 'Claude Max 20×', modelName: 'Claude Fable 5.1', monthlyPriceUSD: 200, usableApiEquivalentCostUSD: 2485, usableQuotaFraction: 0.5, chartUrl: FLAGSHIP_CHART },
];

export const SEMIANALYSIS_SUBSCRIPTION_PRICING: readonly MeasuredSubscriptionPricing[] =
  REVIEWED_MEASUREMENTS.map((measurement) => ({
    ...measurement,
    kind: 'measured',
    sourceUrl: SEMIANALYSIS_SUBSCRIPTION_SOURCE,
    publishedOn: '2026-10-05',
    checkedOn: SUBSCRIPTION_PRICING_CHECKED_ON,
    workload: 'agentic',
  }));

export const LEGACY_SUBSCRIPTION_PRICING_EVIDENCE: SubscriptionPricingEvidence = {
  id: 'legacy-subscription-estimate',
  kind: 'legacy-estimate',
  checkedOn: SUBSCRIPTION_PRICING_CHECKED_ON,
};

export function findMeasuredSubscriptionPricing(
  planName: string,
  modelName: string,
): MeasuredSubscriptionPricing | undefined {
  return SEMIANALYSIS_SUBSCRIPTION_PRICING.find((measurement) => (
    measurement.planName === planName && measurement.modelName === modelName
  ));
}

export function getSubscriptionPricingEvidence(
  id: string | undefined,
): SubscriptionPricingEvidence | undefined {
  if (id === LEGACY_SUBSCRIPTION_PRICING_EVIDENCE.id) {
    return LEGACY_SUBSCRIPTION_PRICING_EVIDENCE;
  }
  return SEMIANALYSIS_SUBSCRIPTION_PRICING.find((measurement) => measurement.id === id);
}
