import assert from 'node:assert/strict';
import publicLeaderboardSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { DETAIL_ONLY_METRIC_DEFINITIONS } from '../src/data/detailMetricDefinitions';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import {
  buildConfigurationMetricRows,
  CONFIGURATION_DETAIL_DOMAIN_ORDER,
  formatConfigurationRawMetricValue,
} from '../src/components/ConfigurationDetailContent';
import type {
  PublicLeaderboardScore,
  PublicLeaderboardSnapshot,
} from '../src/types/publicLeaderboard';

const snapshot =
  publicLeaderboardSnapshot as unknown as PublicLeaderboardSnapshot;
const apiScore = snapshot.scores.find(
  (item) => item.config.openRouterData && !item.config.subscriptionData
);
const subscriptionScore = snapshot.scores.find(
  (item) => item.config.subscriptionData
);

assert.ok(apiScore, 'expected at least one API configuration');
assert.ok(subscriptionScore, 'expected at least one subscription configuration');

const expectedBenchmarkIds = CONFIGURATION_DETAIL_DOMAIN_ORDER.flatMap((domainId) => [
  ...ALL_METRIC_DEFINITIONS.filter((metric) => metric.domain === domainId).map(
    (metric) => metric.id
  ),
  ...DETAIL_ONLY_METRIC_DEFINITIONS.filter(
    (metric) => metric.domain === domainId
  ).map((metric) => metric.id),
]);
const expectedTrailingIds = [
  'speed_throughput',
  'speed_ttft',
  'cost_input',
  'cost_output',
];

const assertSharedDetailContract = (score: PublicLeaderboardScore) => {
  const rows = buildConfigurationMetricRows(score);

  assert.equal(
    rows.length,
    ALL_METRIC_DEFINITIONS.length +
      DETAIL_ONLY_METRIC_DEFINITIONS.length +
      expectedTrailingIds.length
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    [...expectedBenchmarkIds, ...expectedTrailingIds]
  );
};

assertSharedDetailContract(apiScore);
assertSharedDetailContract(subscriptionScore);

const apiRows = buildConfigurationMetricRows(apiScore);
assert.equal(apiRows.at(-2)?.label, 'Input Price');
assert.equal(apiRows.at(-1)?.label, 'Output Price');

const subscriptionRows = buildConfigurationMetricRows(subscriptionScore);
assert.equal(subscriptionRows.at(-2)?.label, 'Monthly Price');
assert.equal(subscriptionRows.at(-1)?.label, 'API Equivalent');

for (const unit of ['Resolution Rate', 'Resolved Rate', 'Pass Rate']) {
  assert.equal(
    formatConfigurationRawMetricValue(0.373, unit),
    '37.3%',
    `${unit} must render as a percentage in configuration details.`,
  );
}

console.log(
  `Configuration detail content contract passed (${apiRows.length} aligned rows).`
);
