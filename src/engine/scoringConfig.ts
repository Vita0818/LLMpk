import type { CoverageStatus, DomainId } from '../types/llm_pk';

/**
 * Versioned scoring policy. Changes to coverage semantics must be made here
 * and released with a new version instead of being embedded in aggregation code.
 */
export const SCORING_CONFIG = {
  version: '3.0',
  practicalAdjustment: {
    version: '1.4',
    speed: {
      /** Positive utility approaches this reward without reaching it. */
      rewardScale: 7.5,
      /** Negative utility approaches this penalty without reaching it. */
      penaltyScale: 8,
    },
    cost: {
      /** Positive utility approaches this reward without reaching it. */
      rewardScale: 7.5,
      /** Negative utility approaches this penalty without reaching it. */
      penaltyScale: 12,
    },
  },
  reliability: {
    /** Absolute floor used by n_ref before it is capped by the cohort size. */
    participationMinimumAbsolute: 10,
    /** Fraction of the eligible cohort used by n_ref. */
    participationReferenceFraction: 0.60,
    /** max-to-median spread / typical 95% CI radius required for full strength. */
    fullSignalRatio: 2,
    discriminationTolerance: 1e-7,
  },
  coverage: {
    /** A domain needs at least 60% real weighted evidence to receive a score. */
    officialMinimum: 0.60,
    /** Lower positive coverage is visible for diagnosis but never scored. */
    provisionalMinimum: 0,
    overallMinimum: 0.75,
  },
  capabilityAggregate: {
    /** All six domains must pass their coverage gate before a total exists. */
    minimumAvailableDomains: 6,
  },
  readerCuration: {
    /**
     * Catalog curation remains separate from scoring. Preserve the compact
     * reader-facing preset set while scoring coverage and ranking eligibility
     * remain separate concerns.
     */
    minimumAvailableDomains: 1,
  },
} as const;

export const DOMAIN_IDS: readonly DomainId[] = [
  'chatting',
  'reasoning',
  'coding',
  'frontend',
  'agentic',
  'documents',
];

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  official: '正式',
  provisional: '部分覆盖',
  no_observed_data: '无观测数据',
  insufficient: '数据不足',
};

export function getCoverageStatus(coverage: number): CoverageStatus {
  if (coverage <= Number.EPSILON) {
    return 'no_observed_data';
  }

  if (coverage + Number.EPSILON >= SCORING_CONFIG.coverage.officialMinimum) {
    return 'official';
  }

  return 'provisional';
}
