import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import { SCORING_CONFIG } from '../src/engine/scoringConfig';
import { DETAIL_ONLY_METRIC_DEFINITIONS } from '../src/data/detailMetricDefinitions';
import type { DomainId } from '../src/types/llm_pk';
import type {
  PublicLeaderboardScore,
  PublicLeaderboardSnapshot,
} from '../src/types/publicLeaderboard';

const DOMAIN_IDS: readonly DomainId[] = [
  'chatting',
  'reasoning',
  'coding',
  'frontend',
  'agentic',
  'documents',
];

const PUBLIC_METRIC_IDS = new Set([
  ...ALL_METRIC_DEFINITIONS.map((metric) => metric.id),
  ...DETAIL_ONLY_METRIC_DEFINITIONS.map((metric) => metric.id),
]);
const SCORING_METRIC_IDS = new Set(ALL_METRIC_DEFINITIONS.map(metric => metric.id));
const PRACTICAL_FALLBACK_METRIC_IDS = new Set([
  'aa_price_input', 'aa_price_output', 'aa_throughput_median', 'aa_ttft_median',
]);

function publicConfigurationId(configurationName: string): string {
  const digest = createHash('sha256')
    .update(configurationName)
    .digest('hex')
    .slice(0, 16);
  return `config-${digest}`;
}

// Node 24+ exposes an optional localStorage shim. The private build-time store
// must use its deterministic no-browser path rather than any runner-local
// state.
Reflect.deleteProperty(globalThis, 'localStorage');
const { adminMappingStore } = await import('../src/store/adminMappingStore');

adminMappingStore.resetToLatestVerifiedCatalog();
const installation = adminMappingStore.synchronizeBuiltInConfigurationPresets(true);
if (installation.invalidPresetCount > 0 || installation.unresolvedSourceCardCount > 0
  || installation.mismatchedSourceCardCount > 0) {
  throw new Error(`Public snapshot has an incomplete configuration installation: ${JSON.stringify(installation)}`);
}

const scores: PublicLeaderboardScore[] = adminMappingStore
  .computeLeaderboardScores()
  .map((score) => {
    const unweighted = Object.keys(score.config.observations).filter(id =>
      !SCORING_METRIC_IDS.has(id) && !PRACTICAL_FALLBACK_METRIC_IDS.has(id));
    if (unweighted.length > 0) {
      throw new Error(`Configuration ${score.config.name} has benchmark evidence without scoring weights: ${unweighted.join(', ')}.`);
    }
    const observations = Object.fromEntries(
      Object.entries(score.config.observations)
        .filter(([metricId]) => PUBLIC_METRIC_IDS.has(metricId))
        .map(([metricId, observation]) => [
          metricId,
          {
            metricId,
            rawValue: observation.rawValue,
            ...(observation.testDate ? { sourceSnapshotDate: observation.testDate } : {}),
            ...(observation.benchmarkEvidence ? { benchmarkEvidence: {
              sourceUrl: observation.benchmarkEvidence.sourceUrl,
              benchmarkVersion: observation.benchmarkEvidence.benchmarkVersion,
              sourceProfile: observation.benchmarkEvidence.sourceProfile,
              sourceHarness: observation.benchmarkEvidence.sourceHarness,
              sourceUpdated: observation.benchmarkEvidence.sourceUpdated,
              notes: observation.benchmarkEvidence.notes,
              profileFallback: Boolean(observation.benchmarkEvidence.profileFallback),
              ...(observation.benchmarkEvidence.standardError !== undefined
                ? { standardError: observation.benchmarkEvidence.standardError } : {}),
            } } : {}),
          },
        ]),
    );

    const domainScores = Object.fromEntries(
      DOMAIN_IDS.map((domainId) => [
        domainId,
        { score: score.domainScores[domainId].score,
          coverage: score.domainScores[domainId].coverage,
          coverageStatus: score.domainScores[domainId].coverageStatus },
      ]),
    ) as PublicLeaderboardScore['domainScores'];

    const sourceOpenRouterData = score.config.openRouterData;
    const openRouterData = sourceOpenRouterData
      ? {
          inputPricePerMToken: sourceOpenRouterData.inputPricePerMToken,
          outputPricePerMToken: sourceOpenRouterData.outputPricePerMToken,
          ttftP50Seconds: sourceOpenRouterData.ttftP50Seconds,
          throughputP50TokensPerSec: sourceOpenRouterData.throughputP50TokensPerSec,
      }
      : undefined;
    const sourceSubscriptionData = score.config.subscriptionData;
    const valsData = score.config.valsData?.map(evidence => ({
      metricId: evidence.metricId, rawValue: evidence.rawValue, standardError: evidence.standardError,
      publishedRawValue: evidence.publishedRawValue, scoreBasis: evidence.scoreBasis,
      fallbackCount: evidence.fallbackCount, refusalCount: evidence.refusalCount,
      benchmarkVersion: evidence.benchmarkVersion, sourceUrl: evidence.sourceUrl,
      sourceUpdated: evidence.sourceUpdated, sourceProfile: evidence.sourceProfile,
      sourceHarness: evidence.sourceHarness, profileFallback: evidence.profileFallback,
      hasRefusalFallbackNotice: evidence.hasRefusalFallbackNotice,
    }));
    const subscriptionData = sourceSubscriptionData
      ? {
          planName: sourceSubscriptionData.planName,
          monthlyPriceUSD: sourceSubscriptionData.monthlyPriceUSD,
          apiEquivalentCostUSD: sourceSubscriptionData.apiEquivalentCostUSD,
          usableQuotaFraction: sourceSubscriptionData.usableQuotaFraction,
          ...(sourceSubscriptionData.pricingEvidenceId
            ? { pricingEvidenceId: sourceSubscriptionData.pricingEvidenceId }
            : {}),
        }
      : undefined;

    return {
      config: {
        id: publicConfigurationId(score.config.name),
        name: score.config.name,
        provider: score.config.provider,
        execution: {
          harness: score.config.execution.harness,
        },
        observations,
        ...(openRouterData ? { openRouterData } : {}),
        ...(subscriptionData ? { subscriptionData } : {}),
        ...(valsData?.length ? { valsData } : {}),
      },
      domainScores,
      overallCoverage: score.overallCoverage,
      availableDomainCount: score.availableDomainCount,
      rawCapabilityScore: score.rawCapabilityScore,
      practicalBreakdown: score.practicalBreakdown,
      eligibleForGlobalLeaderboard: score.eligibleForGlobalLeaderboard,
    };
  });

const snapshot: PublicLeaderboardSnapshot = {
  schemaVersion: 2,
  scoringVersion: SCORING_CONFIG.version,
  scores,
};
if (scores.length !== installation.presetCount) {
  throw new Error(`Public snapshot lost configurations: ${scores.length}/${installation.presetCount}.`);
}

const outputPath = resolve(
  process.env.PUBLIC_LEADERBOARD_SNAPSHOT_OUTPUT
    ?? 'src/data/publicLeaderboardSnapshot.json',
);

writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
console.log(`Generated public leaderboard snapshot with ${scores.length} configurations.`);
