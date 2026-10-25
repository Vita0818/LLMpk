import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import publicLeaderboardSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import { VALS_METRIC_DEFINITIONS } from '../src/data/valsMetricDefinitions';
import {
  buildConfigurationMetricRows,
  ConfigurationMetricList,
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
      expectedTrailingIds.length
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    [...expectedBenchmarkIds, ...expectedTrailingIds]
  );
  assert.equal(rows.filter(row => (row.weightInDomain ?? 0) > 0).length, 84,
    'Every benchmark row exposes its positive domain weight.');
  for (const columns of [1, 2] as const) {
    const markup = renderToStaticMarkup(createElement(ConfigurationMetricList, { scoreItem: score, columns }));
    assert.doesNotMatch(markup, /<details|<summary/u, 'Metrics must be visible without expanding a source-specific section.');
    for (const metric of VALS_METRIC_DEFINITIONS) {
      assert.equal(markup.split(`data-metric-id="${metric.id}"`).length - 1, 1,
        'Each Vals metric must appear exactly once in both shared layouts.');
    }
    assert.doesNotMatch(markup, /仅参考/u, 'The expanded scoring list has no reference-only metrics.');
  }
};

assertSharedDetailContract(apiScore);
assertSharedDetailContract(subscriptionScore);

const apiRows = buildConfigurationMetricRows(apiScore);
assert.equal(apiRows.at(-2)?.label, 'Input Price');
assert.equal(apiRows.at(-1)?.label, 'Output Price');

const subscriptionRows = buildConfigurationMetricRows(subscriptionScore);
assert.equal(subscriptionRows.at(-2)?.label, 'Monthly Price');
assert.equal(subscriptionRows.at(-1)?.label, 'API Equivalent');

const fable = snapshot.scores.find((item) => (
  item.config.subscriptionData?.pricingEvidenceId === 'sa-2026-10-05-max-20x-fable-5-1'
));
assert.ok(fable, 'Fable must use the reviewed SemiAnalysis record.');
const fableAllowanceRow = buildConfigurationMetricRows(fable).at(-1)!;
assert.equal(fableAllowanceRow.value, '2,485', 'Display the net Fable allowance exactly once.');
assert.match(fableAllowanceRow.title, /SemiAnalysis 2026-10-05/u);
assert.match(fableAllowanceRow.title, /50%/u);
const legacyEstimate = snapshot.scores.find((item) => (
  item.config.subscriptionData?.pricingEvidenceId === 'legacy-subscription-estimate'
));
assert.ok(legacyEstimate);
assert.match(buildConfigurationMetricRows(legacyEstimate).at(-1)!.value, /^≈ /u);
assert.match(buildConfigurationMetricRows(legacyEstimate).at(-1)!.title, /旧估算/u);

for (const unit of ['Resolution Rate', 'Resolved Rate', 'Pass Rate']) {
  assert.equal(
    formatConfigurationRawMetricValue(0.373, unit),
    '37.3%',
    `${unit} must render as a percentage in configuration details.`,
  );
}
assert.equal(formatConfigurationRawMetricValue(0.0252, 'Score Point'), '0.0252',
  'Small real Agent effects must not be displayed as a zero result.');
assert.equal(formatConfigurationRawMetricValue(0, 'Score Point'), '0');
assert.equal(formatConfigurationRawMetricValue(Infinity, 'Score Point'), '--');

console.log(
  `Configuration detail content contract passed (${apiRows.length} aligned rows).`
);
