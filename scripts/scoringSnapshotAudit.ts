import type { AtomicScoreDetail } from '../src/types/llm_pk';
import { SCORING_CONFIG } from '../src/engine/scoringConfig';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.values.set(String(key), String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

const { AdminMappingStore } = await import('../src/store/adminMappingStore');

const round = (value: number | null | undefined, digits = 4): number | null => (
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null
);

const store = new AdminMappingStore();
const install = store.installBuiltInConfigurationPresets();
const scores = store.computeLeaderboardScores();
const allMetricDetails = scores.flatMap((score) => (
  Object.values(score.domainScores).flatMap((domain) => domain.metricDetails)
));

const metricDetailById = new Map<string, AtomicScoreDetail>();
allMetricDetails.forEach((detail) => {
  if (!metricDetailById.has(detail.metricId)) {
    metricDetailById.set(detail.metricId, detail);
  }
});

const metricReliability = [...metricDetailById.values()]
  .map((detail) => {
    const observedEffectiveScores = allMetricDetails
      .filter((candidate) => (
        candidate.metricId === detail.metricId && !candidate.isMissing
      ))
      .map((candidate) => candidate.normalizedScore)
      .filter((value): value is number => (
        typeof value === 'number' && Number.isFinite(value)
      ));
    return {
      metricId: detail.metricId,
      domain: detail.domain,
      observedConfigCount: detail.observedConfigCount,
      eligibleConfigCount: detail.eligibleConfigCount,
      referenceConfigCount: detail.referenceConfigCount,
      participationReliability: round(detail.participationReliability),
      discriminationReliability: round(detail.discriminationReliability),
      reliability: round(detail.reliability),
      uncertaintyStatus: detail.uncertaintyStatus,
      effectiveMin: observedEffectiveScores.length > 0
        ? round(Math.min(...observedEffectiveScores))
        : null,
      effectiveMax: observedEffectiveScores.length > 0
        ? round(Math.max(...observedEffectiveScores))
        : null,
    };
  })
  .sort((left, right) => (
    (left.reliability ?? 0) - (right.reliability ?? 0)
    || left.metricId.localeCompare(right.metricId, 'en-US')
  ));

const ranking = [...scores]
  .sort((left, right) => (
    (right.rawCapabilityScore ?? -1) - (left.rawCapabilityScore ?? -1)
    || left.config.name.localeCompare(right.config.name, 'en-US')
  ))
  .map((score, index) => ({
    rank: index + 1,
    configuration: score.config.name,
    capabilityScore: round(score.rawCapabilityScore, 3),
    practicalScore: round(score.practicalBreakdown.practicalScore, 3),
    practicalAdjustment: (
      score.practicalBreakdown.speedDelta === null
      || score.practicalBreakdown.costDelta === null
    )
      ? null
      : round(
        score.practicalBreakdown.speedDelta
          + score.practicalBreakdown.costDelta,
        3,
      ),
    coverage: round(score.overallCoverage, 3),
    coverageStatus: score.coverageStatus,
    observedDomains: score.availableDomainCount,
    domainScores: Object.fromEntries(
      Object.entries(score.domainScores).map(([domainId, domain]) => [
        domainId,
        round(domain.score, 3),
      ]),
    ),
  }));

const missingDetails = allMetricDetails.filter((detail) => detail.isMissing);
const noObservedDomains = scores.flatMap((score) => (
  Object.values(score.domainScores).filter(
    (domain) => domain.coverageStatus === 'no_observed_data',
  )
));
const tolerance = 1e-10;
const invariants = {
  missingMetricDetails: missingDetails.length,
  missingMetricsWithNumericScores: missingDetails.filter(
    (detail) => detail.normalizedScore !== null,
  ).length,
  missingMetricsWithAggregationWeight: missingDetails.filter(
    (detail) => (
      Math.abs(detail.weightInDomain) > tolerance
    ),
  ).length,
  noObservedDomains: noObservedDomains.length,
  noObservedDomainsWithNumericScore: noObservedDomains.filter(
    (domain) => domain.score !== null,
  ).length,
  nullDomainScores: scores.flatMap(
    (score) => Object.values(score.domainScores),
  ).filter((domain) => domain.score === null).length,
  nullCapabilityScores: scores.filter(
    (score) => score.rawCapabilityScore === null,
  ).length,
  nonRankableConfigurations: scores.filter(
    (score) => !score.eligibleForGlobalLeaderboard,
  ).length,
};

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  scoringVersion: scores.length > 0 ? SCORING_CONFIG.version : null,
  install,
  configurationCount: scores.length,
  invariants,
  metricReliability,
  ranking,
}, null, 2));
