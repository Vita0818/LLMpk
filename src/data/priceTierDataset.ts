import type { PublicLeaderboardScore, PublicLeaderboardSnapshot } from '../types/publicLeaderboard';
import { getPriceTier, PRICE_TIERS } from '../utils/priceTiers';
import { buildRepresentativeConfigurationQueue, getPlayModeRouteGroupKey } from '../utils/playModeQueue';
import { getSubscriptionPricingEvidence, SEMIANALYSIS_SUBSCRIPTION_PRICING } from './subscriptionPricing';

export const PRICE_TIER_POLICY_VERSION = 'price-tiers/v1';

export interface PriceTierDatasetSource {
  leaderboard: { path: string; sha256: string };
  subscriptionEvidence: { path: string; sha256: string };
  cohort: { id: string; snapshotDate: string };
}

function priceNumber(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid nonnegative price at ${name}: ${String(value)}`);
  }
  return value;
}

const sameCost = (left: number, right: number) => (
  Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right))
);

function classifyConfiguration(item: PublicLeaderboardScore, sourceScoreIndex: number) {
  const { config } = item;
  const location = `scores[${sourceScoreIndex}] (${config.id})`;
  const modelProfile = config.name.split('|')[0].trim();
  const api = config.openRouterData;
  const subscription = config.subscriptionData;
  const missingFields: string[] = [];
  const inputPrice = priceNumber(api?.inputPricePerMToken, `${location}.inputPricePerMToken`);
  const outputPrice = priceNumber(api?.outputPricePerMToken, `${location}.outputPricePerMToken`);
  if (inputPrice === null) missingFields.push('inputPricePerMToken');
  if (outputPrice === null) missingFields.push('outputPricePerMToken');
  const apiScenarioCostUSD = inputPrice === null || outputPrice === null
    ? null : inputPrice + 0.25 * outputPrice;
  if (apiScenarioCostUSD !== null && !Number.isFinite(apiScenarioCostUSD)) {
    throw new Error(`API scenario cost overflow at ${location}`);
  }

  let multiplier: number | null = subscription ? null : 1;
  let subscriptionPricing = null;
  if (subscription) {
    const monthlyPriceUSD = priceNumber(subscription.monthlyPriceUSD, `${location}.monthlyPriceUSD`);
    const apiEquivalentCostUSD = priceNumber(subscription.apiEquivalentCostUSD, `${location}.apiEquivalentCostUSD`);
    const usableQuotaFraction = priceNumber(subscription.usableQuotaFraction, `${location}.usableQuotaFraction`);
    if (monthlyPriceUSD === null) missingFields.push('monthlyPriceUSD');
    if (apiEquivalentCostUSD === null) missingFields.push('apiEquivalentCostUSD');
    if (usableQuotaFraction === null) missingFields.push('usableQuotaFraction');
    if (monthlyPriceUSD === 0 || apiEquivalentCostUSD === 0
      || usableQuotaFraction === 0 || (usableQuotaFraction !== null && usableQuotaFraction > 1)) {
      throw new Error(`Invalid subscription conversion parameters at ${location}`);
    }
    const usableMonthlyApiEquivalentUSD = apiEquivalentCostUSD === null || usableQuotaFraction === null
      ? null : apiEquivalentCostUSD * usableQuotaFraction;
    multiplier = monthlyPriceUSD === null || usableMonthlyApiEquivalentUSD === null
      ? null : monthlyPriceUSD / usableMonthlyApiEquivalentUSD;
    if (multiplier !== null && !Number.isFinite(multiplier)) {
      throw new Error(`Subscription conversion overflow at ${location}`);
    }
    const evidence = getSubscriptionPricingEvidence(subscription.pricingEvidenceId);
    if (subscription.pricingEvidenceId && !evidence) {
      throw new Error(`Unknown subscription evidence ${subscription.pricingEvidenceId} at ${location}`);
    }
    const measurement = SEMIANALYSIS_SUBSCRIPTION_PRICING.find(entry => entry.id === evidence?.id);
    if (measurement && (measurement.planName !== subscription.planName
      || !(modelProfile === measurement.modelName || modelProfile.startsWith(`${measurement.modelName} `))
      || monthlyPriceUSD !== measurement.monthlyPriceUSD
      || usableQuotaFraction !== measurement.usableQuotaFraction
      || usableMonthlyApiEquivalentUSD === null
      || !sameCost(usableMonthlyApiEquivalentUSD, measurement.usableApiEquivalentCostUSD))) {
      throw new Error(`Subscription measurement does not match its plan, model or allowance at ${location}`);
    }
    subscriptionPricing = {
      planName: subscription.planName,
      monthlyPriceUSD,
      apiEquivalentCostUSD,
      usableQuotaFraction,
      usableMonthlyApiEquivalentUSD,
      costMultiplier: multiplier,
      evidence: {
        id: subscription.pricingEvidenceId ?? null,
        kind: evidence?.kind ?? 'unreviewed',
        checkedOn: evidence?.checkedOn ?? null,
        publishedOn: evidence?.publishedOn ?? null,
        sourceUrl: evidence?.sourceUrl ?? null,
        workload: evidence?.workload ?? null,
      },
    };
  }

  const calculatedCostUSD = apiScenarioCostUSD === null || multiplier === null
    ? null : apiScenarioCostUSD * multiplier;
  const effectiveScenarioCostUSD = priceNumber(
    item.practicalBreakdown.effectiveScenarioCostUSD, `${location}.effectiveScenarioCostUSD`,
  );
  if (calculatedCostUSD !== null && !Number.isFinite(calculatedCostUSD)) {
    throw new Error(`Effective scenario cost overflow at ${location}`);
  }
  if (calculatedCostUSD === null || effectiveScenarioCostUSD === null) {
    if (calculatedCostUSD !== effectiveScenarioCostUSD) {
      throw new Error(`Missing-price mismatch at ${location}; calculated ${calculatedCostUSD}, stored ${effectiveScenarioCostUSD}`);
    }
  } else if (!sameCost(calculatedCostUSD, effectiveScenarioCostUSD)
    || getPriceTier(calculatedCostUSD)?.id !== getPriceTier(effectiveScenarioCostUSD)?.id) {
    throw new Error(`Scenario cost mismatch at ${location}; calculated ${calculatedCostUSD}, stored ${effectiveScenarioCostUSD}`);
  }

  return {
    configurationId: config.id,
    configurationName: config.name,
    modelProfile,
    provider: config.provider,
    harness: config.execution.harness,
    access: subscription ? 'subscription' as const : 'api' as const,
    sourceScoreIndex,
    apiPricing: {
      inputPricePerMToken: inputPrice,
      outputPricePerMToken: outputPrice,
      scenarioCostUSD: apiScenarioCostUSD,
      tierId: getPriceTier(apiScenarioCostUSD)?.id ?? null,
    },
    subscriptionPricing,
    effectiveScenarioCostUSD,
    tierId: getPriceTier(effectiveScenarioCostUSD)?.id ?? null,
    status: effectiveScenarioCostUSD === null ? 'unknown' as const : 'classified' as const,
    pricingBasis: subscription ? 'subscription_full_utilization' as const : 'api_scenario' as const,
    missingFields,
    reconciliationDifferenceUSD: calculatedCostUSD === null || effectiveScenarioCostUSD === null
      ? null : Math.abs(calculatedCostUSD - effectiveScenarioCostUSD),
  };
}

/** Build a data-only classification, preserving every access route in the source. */
export function buildPriceTierDataset(snapshot: PublicLeaderboardSnapshot, source: PriceTierDatasetSource) {
  if (snapshot.schemaVersion !== 2 || !Array.isArray(snapshot.scores) || !snapshot.scores.length) {
    throw new Error('Price tier input must be a nonempty public leaderboard snapshot with schemaVersion 2.');
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of snapshot.scores) {
    const { id, name } = item.config;
    if (!id?.trim() || !name?.trim() || ids.has(id) || names.has(name)) {
      throw new Error(`Missing or duplicate configuration identity: ${id} (${name})`);
    }
    ids.add(id);
    names.add(name);
  }
  const representatives = buildRepresentativeConfigurationQueue(snapshot.scores);
  const representativeByGroup = new Map(representatives.map(item => [getPlayModeRouteGroupKey(item), item.config.id]));
  const configurations = snapshot.scores.map((item, index) => {
    const representativeConfigurationId = representativeByGroup.get(getPlayModeRouteGroupKey(item));
    if (!representativeConfigurationId) throw new Error(`Missing representative for ${item.config.id}`);
    return {
      ...classifyConfiguration(item, index),
      representativeConfigurationId,
      isReaderRepresentative: representativeConfigurationId === item.config.id,
    };
  });
  const groups = [...PRICE_TIERS.map(tier => tier.id), null].map(tierId => {
    const members = configurations.filter(item => item.tierId === tierId);
    return {
      tierId,
      configurationIds: members.map(item => item.configurationId),
      configurationCount: members.length,
      apiConfigurationCount: members.filter(item => item.access === 'api').length,
      subscriptionConfigurationCount: members.filter(item => item.access === 'subscription').length,
      readerConfigurationIds: members.filter(item => item.isReaderRepresentative).map(item => item.configurationId),
      readerConfigurationCount: members.filter(item => item.isReaderRepresentative).length,
    };
  });
  const subscriptions = configurations.filter(item => item.access === 'subscription');

  return {
    schemaVersion: 1 as const,
    policyVersion: PRICE_TIER_POLICY_VERSION,
    grain: 'configuration' as const,
    source: {
      ...source,
      scoringVersion: snapshot.scoringVersion ?? null,
      practicalAdjustmentVersion: snapshot.practicalAdjustmentVersion ?? null,
      freshnessNote: 'Uses the existing reviewed snapshot; the cohort date is not a new price check or a per-price observation date.',
    },
    policy: {
      currency: 'USD',
      apiPriceUnit: 'USD/1M tokens',
      scenario: { inputMTokens: 1, outputMTokens: 0.25 },
      apiCostFormula: 'inputPricePerMToken + 0.25 * outputPricePerMToken',
      subscriptionCostFormula: 'apiScenarioCostUSD * (monthlyPriceUSD / (apiEquivalentCostUSD * usableQuotaFraction))',
      boundaryMethod: 'geometric_mean_of_adjacent_scenario_costs',
      intervalConvention: 'lower_inclusive_upper_exclusive',
      equalityGoesTo: 'higher_tier',
      freeCostTierId: PRICE_TIERS[0].id,
      unknownTierId: null,
      subscriptionAssumption: 'Full utilization; agentic allowance measurements are an approximation for this token scenario. Legacy estimates remain explicitly labelled.',
    },
    tiers: PRICE_TIERS,
    summary: {
      configurationCount: configurations.length,
      distinctModelProfileCount: new Set(configurations.map(item => item.modelProfile)).size,
      apiConfigurationCount: configurations.length - subscriptions.length,
      subscriptionConfigurationCount: subscriptions.length,
      readerConfigurationCount: representatives.length,
      classifiedConfigurationCount: configurations.filter(item => item.status === 'classified').length,
      unknownConfigurationCount: configurations.filter(item => item.status === 'unknown').length,
      freeConfigurationCount: configurations.filter(item => item.effectiveScenarioCostUSD === 0).length,
      subscriptionEvidenceCounts: Object.fromEntries(
        ['measured', 'legacy-estimate', 'official-plan-only', 'unreviewed'].map(kind => [
          kind, subscriptions.filter(item => item.subscriptionPricing?.evidence.kind === kind).length,
        ]),
      ),
      maxReconciliationDifferenceUSD: Math.max(...configurations.map(item => item.reconciliationDifferenceUSD ?? 0)),
    },
    groups,
    configurations,
  };
}

export type PriceTierDataset = ReturnType<typeof buildPriceTierDataset>;
