export type MetricSource = 'Artificial Analysis' | 'Arena.ai' | 'OpenRouter';

export type MetricType = 
  | 'accuracy'                   // Pass@1, Accuracy (Logit transformed)
  | 'error_rate'                 // Raw bad-event rate; invert to 1-p, then Logit
  | 'continuous_relative'        // Bradley-Terry, Elo, Net percentage improvement
  | 'positive_higher_better'     // Throughput (log transformed)
  | 'positive_lower_better';     // Latency, Price (negative log transformed)

export type DomainId = 
  | 'chatting' 
  | 'math_science' 
  | 'coding'
  | 'engineering'
  | 'agentic_work' 
  | 'search_knowledge';

/** Coverage is a data-quality state that remains separate from the score. */
export type CoverageStatus =
  | 'official'
  | 'provisional'
  | 'no_observed_data'
  /** @deprecated Kept for compatibility with previously persisted state. */
  | 'insufficient';

export type MetricUncertaintyStatus =
  | 'estimated'
  | 'uncertainty_unknown'
  | 'insufficient_discrimination'
  | 'no_observed_data';

export interface DomainDefinition {
  id: DomainId;
  name: string;
  nameEn: string;
  weight: number; // Equal before renormalizing over available domains in v1.2
  color: string;
  description: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  source: MetricSource;
  domain: DomainId;
  metricType: MetricType;
  internalWeightInDomain: number; // Percentage within domain (sum to 1.0)
  higherIsBetter: boolean;
  unit: string;
  description: string;
  officialUrl?: string;
}

export interface MetricObservation {
  metricId: string;
  rawValue: number | null; // null if missing
  confidenceLow?: number;
  confidenceHigh?: number;
  /** Published 95% CI radius on the raw metric scale. */
  confidenceRadius?: number;
  sampleSize?: number;
  testDate?: string;
  harness?: string;
}

export interface OpenRouterCostSpeedData {
  inputPricePerMToken: number;   // USD / 1M input tokens
  outputPricePerMToken: number;  // USD / 1M output tokens
  cacheReadPricePerMToken?: number;
  reasoningPricePerMToken?: number;
  ttftP50Seconds: number;        // Time to first token (seconds)
  throughputP50TokensPerSec: number; // Output speed (tokens/sec)
  e2eLatencyP50Seconds?: number;
  uptime30d?: number;            // percentage, e.g., 99.8
}

/**
 * Fixed-price subscription economics expressed against the same model's API
 * route. The usable quota fraction is model-specific: 1 means the full plan
 * allowance is available, while 0.5 means only half can be spent on it.
 */
export interface SubscriptionCostData {
  planName: string;
  monthlyPriceUSD: number;
  apiEquivalentCostUSD: number;
  usableQuotaFraction: number;
}

export interface LLMConfiguration {
  id: string;
  name: string;
  provider: string; // e.g. OpenAI, Anthropic, Google, Moonshot, DeepSeek

  /**
   * False for an alternative access route that shares the same model,
   * harness, and capability evidence with a reference configuration. It still
   * receives scores, but must not double-weight the calibration cohort.
   */
  capabilityReferenceIncluded?: boolean;
  
  // 1. Identity
  identity: {
    modelName: string;
    modelVersion: string;
    reasoningEffort: 'None' | 'Low' | 'Medium' | 'High' | 'X-High' | 'Deep Think';
    contextWindowTokens: number;
  };
  
  // 2. Execution
  execution: {
    harness: string; // e.g. Codex CLI, Claude Code, Antigravity Agent, OpenCode, LeChat
    agentFramework?: string;
    toolPermissions: string[];
  };

  // 3. Infrastructure / Access
  access: {
    entryPoint:
      | 'OpenRouter API'
      | 'Direct Provider API'
      | 'ChatGPT Subscription'
      | 'Claude Subscription'
      | 'Google Subscription'
      | 'xAI Subscription'
      | 'vLLM Local';
    routingPolicy?: 'default' | 'price' | 'throughput' | 'fixed';
    providerEndpoint?: string;
  };

  // OpenRouter Speed/Cost details if applicable
  openRouterData?: OpenRouterCostSpeedData;

  // Fixed-price subscription details, when this is a subscription route.
  subscriptionData?: SubscriptionCostData;

  // Atomic Observations map: metricId -> MetricObservation
  observations: Record<string, MetricObservation>;
  
  // Custom badges
  tags?: string[];
}

export interface AtomicScoreDetail {
  metricId: string;
  metricName: string;
  source: MetricSource;
  domain: DomainId;
  rawValue: number | null;
  transformedValue: number | null;
  /** Max=100 / median=50 score before reliability shrinkage; null when missing. */
  baseNormalizedScore: number | null;
  /** Effective score after reliability shrinkage; missing observations equal 50. */
  normalizedScore: number | null;
  configuredWeightInDomain: number;
  /** Scoring v1.2 retains the configured weight even when the observation is missing. */
  weightInDomain: number;
  observedConfigCount: number;
  eligibleConfigCount: number;
  referenceConfigCount: number;
  participationReliability: number;
  discriminationReliability: number;
  reliability: number;
  uncertaintyRadius: number | null;
  uncertaintyStatus: MetricUncertaintyStatus;
  isMissing: boolean;
}

export interface DomainScoreDetail {
  domainId: DomainId;
  domainName: string;
  rawGeometricIndex: number | null;
  /** Null when the entire domain has zero real observations. */
  score: number | null;
  coverage: number; // 0.0 to 1.0
  coverageStatus: CoverageStatus;
  insufficientCoverage: boolean; // UI compatibility; true for no-observation/legacy-insufficient states
  metricDetails: AtomicScoreDetail[];
}

export interface PracticalScoreBreakdown {
  /** Direct geometric mean of the available normalized domain scores. */
  rawCapabilityScore: number | null;
  speedDelta: number | null; // (-8, +7.5), null without source-backed speed data
  costDelta: number | null;  // (-12, +7.5), null without source-backed cost data
  practicalScore: number | null;
  speedUtility: number | null;
  costUtility: number | null;
  effectiveScenarioCostUSD: number | null;
  referenceCostUSD: number | null;
  throughputRatio: number | null;
  latencyRatio: number | null;
}

export interface ProcessedConfigurationScore {
  config: LLMConfiguration;
  domainScores: Record<DomainId, DomainScoreDetail>;
  /**
   * Legacy property name retained for API compatibility. Scoring v1.2 fills
   * partially missing metrics with neutral 50 inside a domain, but excludes a
   * wholly unobserved domain from the final geometric mean.
   */
  rawCapabilityScore: number | null;
  practicalBreakdown: PracticalScoreBreakdown;
  overallCoverage: number;
  /** Number of domains with at least one real observation (0–6). */
  availableDomainCount: number;
  coverageStatus: CoverageStatus;
  /** Whether a capability score exists and can receive a rank. */
  eligibleForGlobalLeaderboard: boolean;
}

export interface CohortSnapshot {
  id: string;
  name: string;
  scoringVersion: string; // e.g. "1.2"
  snapshotDate: string;   // "2026-07-26"
  totalConfigs: number;
  description: string;
}
