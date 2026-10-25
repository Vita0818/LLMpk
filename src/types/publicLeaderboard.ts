import type {
  DomainId,
  CoverageStatus,
  OpenRouterCostSpeedData,
  PracticalScoreBreakdown,
  SubscriptionCostData,
} from './llm_pk';

export interface PublicMetricObservation {
  metricId: string;
  rawValue: number | null;
  /** Original source snapshot date; not a claim that the task was rerun then. */
  sourceSnapshotDate?: string;
  benchmarkEvidence?: import('./llm_pk').BenchmarkEvidence;
}

export type PublicOpenRouterData = Pick<
  OpenRouterCostSpeedData,
  | 'inputPricePerMToken'
  | 'outputPricePerMToken'
  | 'ttftP50Seconds'
  | 'throughputP50TokensPerSec'
>;

export type PublicSubscriptionData = Pick<
  SubscriptionCostData,
  | 'planName'
  | 'monthlyPriceUSD'
  | 'apiEquivalentCostUSD'
  | 'usableQuotaFraction'
  | 'pricingEvidenceId'
>;

export interface PublicLeaderboardConfiguration {
  id: string;
  name: string;
  provider: string;
  execution: {
    harness: string;
  };
  observations: Record<string, PublicMetricObservation>;
  openRouterData?: PublicOpenRouterData;
  subscriptionData?: PublicSubscriptionData;
  valsData?: import('../data/valsMetricDefinitions').ValsBenchmarkEvidence[];
}

export interface PublicLeaderboardScore {
  config: PublicLeaderboardConfiguration;
  domainScores: Record<DomainId, { score: number | null; coverage: number; coverageStatus: CoverageStatus }>;
  overallCoverage: number;
  availableDomainCount: number;
  rawCapabilityScore: number | null;
  practicalBreakdown: PracticalScoreBreakdown;
  eligibleForGlobalLeaderboard: boolean;
}

export interface PublicLeaderboardSnapshot {
  schemaVersion: 2;
  scoringVersion?: string;
  practicalAdjustmentVersion?: string;
  scores: PublicLeaderboardScore[];
}
