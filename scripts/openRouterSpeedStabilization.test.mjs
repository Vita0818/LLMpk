import assert from 'node:assert/strict';
import {
  OPENROUTER_SPEED_STABILIZATION_VERSION,
  stabilizeOpenRouterEndpointMetric,
  summarizeOpenRouterHistoryWindow,
} from './openRouterSpeedStabilization.mjs';

const ENDPOINT_ID = 'endpoint-a';
const NOW = new Date('2026-08-07T13:37:00.000Z');

function bucket(timestamp, value, extras = {}) {
  return {
    x: timestamp.replace('T', ' ').replace('.000Z', ''),
    y: {
      [`${ENDPOINT_ID}::default`]: value,
      [`${ENDPOINT_ID}::flex`]: extras.flex ?? value * 50,
      [`${ENDPOINT_ID}::priority`]: extras.priority ?? value / 50,
    },
  };
}

function hourlyPayload(valueForIndex, count = 86) {
  const start = Date.parse('2026-08-04T00:00:00.000Z');
  return {
    data: Array.from({ length: count }, (_, index) => bucket(
      new Date(start + index * 60 * 60 * 1_000).toISOString(),
      valueForIndex(index),
    )),
  };
}

function dailyPayload(valueForIndex, count = 8) {
  const start = Date.parse('2026-07-31T00:00:00.000Z');
  return {
    data: Array.from({ length: count }, (_, index) => bucket(
      new Date(start + index * 24 * 60 * 60 * 1_000).toISOString(),
      valueForIndex(index),
    )),
  };
}

const completedHours = summarizeOpenRouterHistoryWindow({
  payload: hourlyPayload((index) => (index === 84 ? 10_000 : 100)),
  endpointId: ENDPOINT_ID,
  windowName: 'threeDay',
  currentValue: 100,
  now: NOW,
});
assert.equal(completedHours.sampleCount, 72);
assert.equal(completedHours.firstBucketAt, '2026-08-04T13:00:00.000Z');
assert.equal(completedHours.lastBucketAt, '2026-08-07T12:00:00.000Z');
assert.equal(completedHours.median, 100, 'a completed-hour outlier must not move the median');
assert.equal(completedHours.coverageRatio, 1);
assert.equal(completedHours.usable, true);

const bareEndpointSeries = summarizeOpenRouterHistoryWindow({
  payload: {
    data: hourlyPayload(() => 90).data.map((row) => ({
      x: row.x,
      y: { [ENDPOINT_ID]: 90 },
    })),
  },
  endpointId: ENDPOINT_ID,
  windowName: 'threeDay',
  currentValue: 100,
  now: NOW,
});
assert.equal(bareEndpointSeries.sampleCount, 72);
assert.equal(bareEndpointSeries.median, 90);
assert.equal(bareEndpointSeries.usable, true);

const completedDays = summarizeOpenRouterHistoryWindow({
  payload: dailyPayload((index) => (index === 7 ? 999_999 : 200)),
  endpointId: ENDPOINT_ID,
  windowName: 'oneWeek',
  currentValue: 200,
  now: NOW,
});
assert.equal(completedDays.sampleCount, 7);
assert.equal(completedDays.firstBucketAt, '2026-07-31T00:00:00.000Z');
assert.equal(completedDays.lastBucketAt, '2026-08-06T00:00:00.000Z');
assert.equal(completedDays.median, 200, 'the incomplete current day must be discarded');

const dateOnlyDays = summarizeOpenRouterHistoryWindow({
  payload: {
    data: dailyPayload(() => 200).data.map((row) => ({
      ...row,
      x: row.x.slice(0, 10),
      y: { [ENDPOINT_ID]: 200 },
    })),
  },
  endpointId: ENDPOINT_ID,
  windowName: 'oneWeek',
  currentValue: 200,
  now: NOW,
});
assert.equal(dateOnlyDays.sampleCount, 7);
assert.equal(dateOnlyDays.usable, true);

const fullCoverageBlend = stabilizeOpenRouterEndpointMetric({
  currentValue: 125,
  endpointId: ENDPOINT_ID,
  threeDayPayload: hourlyPayload(() => 100),
  oneWeekPayload: dailyPayload(() => 200),
  now: NOW,
});
assert.equal(fullCoverageBlend.algorithmVersion, OPENROUTER_SPEED_STABILIZATION_VERSION);
assert.equal(fullCoverageBlend.source, 'three-day-plus-one-week-history');
assert.equal(fullCoverageBlend.normalizedWeights.threeDay, 0.6);
assert.equal(fullCoverageBlend.normalizedWeights.oneWeek, 0.4);
assert.ok(Math.abs(fullCoverageBlend.value - (100 ** 0.6) * (200 ** 0.4)) < 1e-10);

const sparseHours = {
  data: hourlyPayload(() => 100).data.filter((_, index) => index >= 49 && index % 2 === 1),
};
const coverageAdjustedBlend = stabilizeOpenRouterEndpointMetric({
  currentValue: 125,
  endpointId: ENDPOINT_ID,
  threeDayPayload: sparseHours,
  oneWeekPayload: dailyPayload(() => 200),
  now: NOW,
});
assert.equal(coverageAdjustedBlend.windows.threeDay.sampleCount, 18);
assert.ok(coverageAdjustedBlend.normalizedWeights.threeDay < 0.3);
assert.ok(coverageAdjustedBlend.normalizedWeights.oneWeek > 0.7);

const insufficientHours = {
  data: hourlyPayload(() => 100).data.slice(-10),
};
const weekOnly = stabilizeOpenRouterEndpointMetric({
  currentValue: 125,
  endpointId: ENDPOINT_ID,
  threeDayPayload: insufficientHours,
  oneWeekPayload: dailyPayload(() => 200),
  now: NOW,
});
assert.equal(weekOnly.source, 'one-week-history');
assert.equal(weekOnly.value, 200);
assert.equal(weekOnly.windows.threeDay.rejectionReason, 'insufficient-completed-bucket-samples');

const flexOnlyPayload = {
  data: hourlyPayload(() => 100).data.map((row) => ({
    x: row.x,
    y: { [`${ENDPOINT_ID}::flex`]: 100 },
  })),
};
const fallback = stabilizeOpenRouterEndpointMetric({
  currentValue: 125,
  endpointId: ENDPOINT_ID,
  threeDayPayload: flexOnlyPayload,
  oneWeekPayload: { data: [] },
  now: NOW,
});
assert.equal(fallback.source, 'current-window-fallback');
assert.equal(fallback.value, 125);
assert.deepEqual(fallback.normalizedWeights, { threeDay: 0, oneWeek: 0 });

const implausibleUnitShift = stabilizeOpenRouterEndpointMetric({
  currentValue: 1_000,
  endpointId: ENDPOINT_ID,
  threeDayPayload: hourlyPayload(() => 1),
  oneWeekPayload: dailyPayload(() => 1),
  now: NOW,
});
assert.equal(implausibleUnitShift.source, 'current-window-fallback');
assert.equal(
  implausibleUnitShift.windows.threeDay.rejectionReason,
  'implausible-relative-to-current-window',
);

console.log('OpenRouter 3d/1w speed stabilization: PASS');
