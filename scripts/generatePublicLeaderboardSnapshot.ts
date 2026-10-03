import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
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
adminMappingStore.synchronizeBuiltInConfigurationPresets(true);

const scores: PublicLeaderboardScore[] = adminMappingStore
  .computeLeaderboardScores()
  .map((score) => {
    const observations = Object.fromEntries(
      Object.entries(score.config.observations)
        .filter(([metricId]) => PUBLIC_METRIC_IDS.has(metricId))
        .map(([metricId, observation]) => [
          metricId,
          {
            metricId,
            rawValue: observation.rawValue,
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
    const subscriptionData = sourceSubscriptionData
      ? {
          planName: sourceSubscriptionData.planName,
          monthlyPriceUSD: sourceSubscriptionData.monthlyPriceUSD,
          apiEquivalentCostUSD: sourceSubscriptionData.apiEquivalentCostUSD,
          usableQuotaFraction: sourceSubscriptionData.usableQuotaFraction,
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
  scores,
};

const outputPath = resolve(
  process.env.PUBLIC_LEADERBOARD_SNAPSHOT_OUTPUT
    ?? 'src/data/publicLeaderboardSnapshot.json',
);

writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
console.log(`Generated public leaderboard snapshot with ${scores.length} configurations.`);
