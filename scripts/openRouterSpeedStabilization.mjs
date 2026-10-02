/**
 * Stabilize OpenRouter endpoint speed measurements with the history curves
 * exposed by the model performance page.
 *
 * The page's `3d` response contains hourly buckets and its `1w` response
 * contains daily buckets. Both responses can include Standard, Flex, and
 * Priority series. We only retain `endpointUuid::default`, discard the
 * current incomplete hour/day, and then retain exactly the latest 72/7
 * completed buckets.
 */

export const OPENROUTER_SPEED_STABILIZATION_VERSION =
  'openrouter-endpoint-history-median-geomean/v1';

export const OPENROUTER_SPEED_STABILIZATION_POLICY = Object.freeze({
  serviceTier: 'default',
  combination: 'coverage-adjusted weighted geometric mean',
  plausibilityRatioLimit: 100,
  windows: Object.freeze({
    threeDay: Object.freeze({
      apiTimeRange: '3d',
      bucketMilliseconds: 60 * 60 * 1_000,
      completedBucketCount: 72,
      minimumSampleCount: 18,
      baseWeight: 0.6,
    }),
    oneWeek: Object.freeze({
      apiTimeRange: '1w',
      bucketMilliseconds: 24 * 60 * 60 * 1_000,
      completedBucketCount: 7,
      minimumSampleCount: 3,
      baseWeight: 0.4,
    }),
  }),
});

function asPositiveFiniteNumber(value) {
  const numeric = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) && numeric > 0
    ? numeric
    : null;
}

function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = index - lowerIndex;
  return sortedValues[lowerIndex]
    + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction;
}

function parseUtcBucketTimestamp(value) {
  if (typeof value !== 'string') return null;
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/u.test(value.trim())
    ? value.trim() + ' 00:00:00'
    : value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/u.exec(
    normalizedValue,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
    || parsed.getUTCHours() !== hour
    || parsed.getUTCMinutes() !== minute
    || parsed.getUTCSeconds() !== second
  ) {
    return null;
  }
  return timestamp;
}

function asTimestamp(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('A valid current time is required for history stabilization.');
  }
  return timestamp;
}

function historyWindowBounds(windowPolicy, now) {
  const nowTimestamp = asTimestamp(now);
  const completedBucketCutoff = Math.floor(
    nowTimestamp / windowPolicy.bucketMilliseconds,
  ) * windowPolicy.bucketMilliseconds;
  return {
    startTimestamp: completedBucketCutoff
      - windowPolicy.completedBucketCount * windowPolicy.bucketMilliseconds,
    endTimestampExclusive: completedBucketCutoff,
  };
}

/**
 * Summarize one endpoint's default-tier series within completed buckets.
 * Missing buckets reduce confidence; they are never zero-filled.
 */
export function summarizeOpenRouterHistoryWindow({
  payload,
  endpointId,
  windowName,
  currentValue,
  now = new Date(),
}) {
  const windowPolicy = OPENROUTER_SPEED_STABILIZATION_POLICY.windows[windowName];
  if (!windowPolicy) throw new TypeError(`Unknown OpenRouter history window: ${windowName}`);
  const positiveCurrentValue = asPositiveFiniteNumber(currentValue);
  if (positiveCurrentValue === null) {
    throw new TypeError('A positive current endpoint value is required for stabilization.');
  }

  const { startTimestamp, endTimestampExclusive } = historyWindowBounds(
    windowPolicy,
    now,
  );
  const seriesKey = `${endpointId}::${OPENROUTER_SPEED_STABILIZATION_POLICY.serviceTier}`;
  const valuesByTimestamp = new Map();
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  for (const row of rows) {
    const timestamp = parseUtcBucketTimestamp(row?.x);
    if (
      timestamp === null
      || timestamp < startTimestamp
      || timestamp >= endTimestampExclusive
      || timestamp % windowPolicy.bucketMilliseconds !== 0
    ) {
      continue;
    }
    // The Standard-only history endpoint now returns bare endpoint UUID
    // keys; older captures used "UUID::default". Both identify the same
    // Standard series because the request itself sets variant=standard.
    const value = asPositiveFiniteNumber(
      row?.y?.[seriesKey] ?? row?.y?.[endpointId],
    );
    if (value !== null) valuesByTimestamp.set(timestamp, value);
  }

  const samples = [...valuesByTimestamp.entries()]
    .sort(([left], [right]) => left - right);
  const sortedValues = samples
    .map(([, value]) => value)
    .sort((left, right) => left - right);
  const median = quantile(sortedValues, 0.5);
  const sampleCount = sortedValues.length;
  const coverageRatio = Math.min(
    sampleCount / windowPolicy.completedBucketCount,
    1,
  );
  const relativeRatio = median === null ? null : median / positiveCurrentValue;
  const withinPlausibilityRange = relativeRatio !== null
    && relativeRatio >= 1 / OPENROUTER_SPEED_STABILIZATION_POLICY.plausibilityRatioLimit
    && relativeRatio <= OPENROUTER_SPEED_STABILIZATION_POLICY.plausibilityRatioLimit;
  const sufficientSamples = sampleCount >= windowPolicy.minimumSampleCount;
  const usable = sufficientSamples && withinPlausibilityRange;

  let rejectionReason = null;
  if (!sufficientSamples) rejectionReason = 'insufficient-completed-bucket-samples';
  else if (!withinPlausibilityRange) rejectionReason = 'implausible-relative-to-current-window';

  return {
    apiTimeRange: windowPolicy.apiTimeRange,
    bucketUnit: windowName === 'threeDay' ? 'hour' : 'day',
    expectedCompletedBucketCount: windowPolicy.completedBucketCount,
    minimumSampleCount: windowPolicy.minimumSampleCount,
    sampleCount,
    coverageRatio,
    median,
    relativeToCurrentWindow: relativeRatio,
    firstBucketAt: samples.length > 0
      ? new Date(samples[0][0]).toISOString()
      : null,
    lastBucketAt: samples.length > 0
      ? new Date(samples.at(-1)[0]).toISOString()
      : null,
    usable,
    rejectionReason,
  };
}

/**
 * Return the primary endpoint value used downstream. Window medians absorb
 * bucket-level spikes; a geometric blend treats equal relative movements
 * symmetrically. Coverage scales each horizon's 60/40 base weight. The
 * current short-window p50 is used only when neither history horizon is
 * sufficiently populated and plausible.
 */
export function stabilizeOpenRouterEndpointMetric({
  currentValue,
  endpointId,
  threeDayPayload,
  oneWeekPayload,
  now = new Date(),
}) {
  const positiveCurrentValue = asPositiveFiniteNumber(currentValue);
  if (positiveCurrentValue === null) {
    throw new TypeError('A positive current endpoint value is required for stabilization.');
  }
  if (typeof endpointId !== 'string' || endpointId.length === 0) {
    throw new TypeError('A non-empty endpoint ID is required for stabilization.');
  }

  const threeDay = summarizeOpenRouterHistoryWindow({
    payload: threeDayPayload,
    endpointId,
    windowName: 'threeDay',
    currentValue: positiveCurrentValue,
    now,
  });
  const oneWeek = summarizeOpenRouterHistoryWindow({
    payload: oneWeekPayload,
    endpointId,
    windowName: 'oneWeek',
    currentValue: positiveCurrentValue,
    now,
  });

  const threeDayEffectiveWeight = threeDay.usable
    ? OPENROUTER_SPEED_STABILIZATION_POLICY.windows.threeDay.baseWeight
      * threeDay.coverageRatio
    : 0;
  const oneWeekEffectiveWeight = oneWeek.usable
    ? OPENROUTER_SPEED_STABILIZATION_POLICY.windows.oneWeek.baseWeight
      * oneWeek.coverageRatio
    : 0;
  const totalEffectiveWeight = threeDayEffectiveWeight + oneWeekEffectiveWeight;

  if (totalEffectiveWeight === 0) {
    return {
      algorithmVersion: OPENROUTER_SPEED_STABILIZATION_VERSION,
      value: positiveCurrentValue,
      source: 'current-window-fallback',
      currentWindowValue: positiveCurrentValue,
      normalizedWeights: { threeDay: 0, oneWeek: 0 },
      windows: { threeDay, oneWeek },
    };
  }

  if (threeDay.usable !== oneWeek.usable) {
    return {
      algorithmVersion: OPENROUTER_SPEED_STABILIZATION_VERSION,
      value: threeDay.usable ? threeDay.median : oneWeek.median,
      source: threeDay.usable ? 'three-day-history' : 'one-week-history',
      currentWindowValue: positiveCurrentValue,
      normalizedWeights: {
        threeDay: threeDay.usable ? 1 : 0,
        oneWeek: oneWeek.usable ? 1 : 0,
      },
      windows: { threeDay, oneWeek },
    };
  }

  const normalizedThreeDayWeight = threeDayEffectiveWeight / totalEffectiveWeight;
  const normalizedOneWeekWeight = oneWeekEffectiveWeight / totalEffectiveWeight;
  const value = Math.exp(
    normalizedThreeDayWeight * Math.log(threeDay.median ?? 1)
    + normalizedOneWeekWeight * Math.log(oneWeek.median ?? 1),
  );

  return {
    algorithmVersion: OPENROUTER_SPEED_STABILIZATION_VERSION,
    value,
    source: 'three-day-plus-one-week-history',
    currentWindowValue: positiveCurrentValue,
    normalizedWeights: {
      threeDay: normalizedThreeDayWeight,
      oneWeek: normalizedOneWeekWeight,
    },
    windows: { threeDay, oneWeek },
  };
}
