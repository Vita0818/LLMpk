/**
 * Fetch OpenRouter's public, model-page performance rows.
 *
 * The general `/api/v1/models` catalog publishes model identity and list
 * prices. The model page separately calls `/api/frontend/v1/stats/endpoint`
 * for provider-endpoint p50 latency/throughput and endpoint prices. Its
 * performance charts separately expose 3-day hourly and 1-week daily
 * histories. This script preserves every accepted current row, stabilizes
 * each endpoint with those two histories, then publishes provider-neutral
 * per-model summaries. Flex/Priority service tiers are never mixed into the
 * ordinary Standard route.
 *
 * Usage:
 *   OPENROUTER_MODELS_SNAPSHOT_PATH=/path/to/models.json \
 *     node scripts/fetchOpenRouterPerformanceSnapshot.mjs
 *
 * Optional diagnostic subset:
 *   OPENROUTER_MODEL_IDS=openai/gpt-5.4,anthropic/claude-opus-4.1 \
 *     node scripts/fetchOpenRouterPerformanceSnapshot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OPENROUTER_SPEED_STABILIZATION_POLICY,
  OPENROUTER_SPEED_STABILIZATION_VERSION,
  stabilizeOpenRouterEndpointMetric,
} from './openRouterSpeedStabilization.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = path.resolve(
  process.env.OPENROUTER_PERFORMANCE_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'openRouterPerformanceSnapshot.json'),
);
const MODEL_CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const STATS_ENDPOINT_URL = 'https://openrouter.ai/api/frontend/v1/stats/endpoint';
const LATENCY_HISTORY_URL = 'https://openrouter.ai/api/frontend/v1/stats/latency-comparison';
const THROUGHPUT_HISTORY_URL = 'https://openrouter.ai/api/frontend/v1/stats/throughput-comparison';
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.OPENROUTER_FETCH_CONCURRENCY) || 4));
const HISTORY_CONCURRENCY = Math.max(
  1,
  Math.min(12, Number(process.env.OPENROUTER_HISTORY_FETCH_CONCURRENCY) || 6),
);
const MAX_ATTEMPTS = 5;

const HISTORY_SERIES = [
  {
    metricName: 'latencyMilliseconds',
    windowName: 'threeDay',
    endpointUrl: LATENCY_HISTORY_URL,
    timeRange: '3d',
  },
  {
    metricName: 'latencyMilliseconds',
    windowName: 'oneWeek',
    endpointUrl: LATENCY_HISTORY_URL,
    timeRange: '1w',
  },
  {
    metricName: 'throughputTokensPerSecond',
    windowName: 'threeDay',
    endpointUrl: THROUGHPUT_HISTORY_URL,
    timeRange: '3d',
  },
  {
    metricName: 'throughputTokensPerSecond',
    windowName: 'oneWeek',
    endpointUrl: THROUGHPUT_HISTORY_URL,
    timeRange: '1w',
  },
];

function asFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isCanonicalModelRecordId(value) {
  const id = String(value || '').trim().toLocaleLowerCase('en-US');
  return id.length > 0
    && !id.startsWith('~')
    && !/(?:^|[-/])latest$/u.test(id);
}

function isGeneralTextModel(model) {
  const inputModalities = model?.architecture?.input_modalities;
  const outputModalities = model?.architecture?.output_modalities;
  const identity = `${model?.id || ''}\n${model?.name || ''}`.toLocaleLowerCase('en-US');
  if (/\b(?:image|video|vision|speech|audio|tts|transcri(?:be|ption)|embedding|moderation|safeguard|guard|music|lyria|router)\b/iu.test(identity)) {
    return false;
  }
  if (!Array.isArray(inputModalities) || !Array.isArray(outputModalities)) return true;
  return inputModalities.includes('text')
    && outputModalities.length > 0
    && outputModalities.every((modality) => modality === 'text');
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LLMpk verified-source-rebuild/1.0',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const requestError = new Error(`HTTP ${response.status}`);
        requestError.status = response.status;
        throw requestError;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error && typeof error === 'object' && error.status === 404) throw error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function loadModelCatalog() {
  const snapshotPath = process.env.OPENROUTER_MODELS_SNAPSHOT_PATH;
  if (snapshotPath) {
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`OPENROUTER_MODELS_SNAPSHOT_PATH does not exist: ${snapshotPath}`);
    }
    return {
      payload: JSON.parse(fs.readFileSync(snapshotPath, 'utf8')),
      inputMode: 'official-openrouter-local-snapshot',
      inputPath: snapshotPath,
    };
  }
  return {
    payload: await fetchJson(MODEL_CATALOG_URL),
    inputMode: 'official-openrouter-live',
    inputPath: null,
  };
}

function compactStatsRow(model, endpoint, sourceUrl, sourceOrder) {
  const stats = endpoint?.stats;
  const endpointId = typeof endpoint?.id === 'string' ? endpoint.id.trim() : '';
  const p50LatencyMilliseconds = asFiniteNumber(stats?.p50_latency);
  const p50ThroughputTokensPerSecond = asFiniteNumber(stats?.p50_throughput);
  const requestCount = asFiniteNumber(stats?.request_count);
  const windowMinutes = asFiniteNumber(stats?.window_minutes);
  if (
    endpointId.length === 0
    || p50LatencyMilliseconds === null
    || p50LatencyMilliseconds <= 0
    || p50ThroughputTokensPerSecond === null
    || p50ThroughputTokensPerSecond <= 0
    || requestCount === null
    || requestCount <= 0
  ) {
    return null;
  }

  return {
    modelId: model.id,
    canonicalSlug: model.canonical_slug,
    exactModelName: model.name || model.id,
    variant: endpoint.variant || 'standard',
    sourceOrder,
    endpointId,
    endpointName: endpoint.name || null,
    providerName: endpoint.provider_name || null,
    providerDisplayName: endpoint.provider_display_name || endpoint.provider_name || null,
    providerSlug: endpoint.provider_slug || endpoint.provider_info?.slug || null,
    providerRegion: endpoint.provider_region || null,
    stats: {
      p50LatencyMilliseconds,
      p50ThroughputTokensPerSecond,
      requestCount,
      windowMinutes,
      p75LatencyMilliseconds: asFiniteNumber(stats?.p75_latency),
      p90LatencyMilliseconds: asFiniteNumber(stats?.p90_latency),
      p95LatencyMilliseconds: asFiniteNumber(stats?.p95_latency),
      p99LatencyMilliseconds: asFiniteNumber(stats?.p99_latency),
      p75ThroughputTokensPerSecond: asFiniteNumber(stats?.p75_throughput),
      p90ThroughputTokensPerSecond: asFiniteNumber(stats?.p90_throughput),
      p95ThroughputTokensPerSecond: asFiniteNumber(stats?.p95_throughput),
      p99ThroughputTokensPerSecond: asFiniteNumber(stats?.p99_throughput),
    },
    pricing: {
      inputPricePerToken: asFiniteNumber(endpoint.pricing?.prompt),
      outputPricePerToken: asFiniteNumber(endpoint.pricing?.completion),
      cacheReadPricePerToken: asFiniteNumber(endpoint.pricing?.input_cache_read),
      cacheWritePricePerToken: asFiniteNumber(endpoint.pricing?.input_cache_write),
      cacheWriteOneHourPricePerToken: asFiniteNumber(endpoint.pricing?.input_cache_write_1h),
      reasoningPricePerToken: asFiniteNumber(endpoint.pricing?.internal_reasoning),
      requestPrice: asFiniteNumber(endpoint.pricing?.request),
      webSearchPrice: asFiniteNumber(endpoint.pricing?.web_search),
      imagePrice: asFiniteNumber(endpoint.pricing?.image),
      audioPrice: asFiniteNumber(endpoint.pricing?.audio),
      rawPublishedPricing: endpoint.pricing && typeof endpoint.pricing === 'object'
        ? endpoint.pricing
        : null,
    },
    sourceUrl,
    sourcePageUrl: `https://openrouter.ai/${model.id}`,
    sourceFields: {
      p50LatencyMilliseconds: 'data[].stats.p50_latency',
      p50ThroughputTokensPerSecond: 'data[].stats.p50_throughput',
      requestCount: 'data[].stats.request_count',
      windowMinutes: 'data[].stats.window_minutes',
      inputPricePerToken: 'data[].pricing.prompt',
      outputPricePerToken: 'data[].pricing.completion',
      cacheReadPricePerToken: 'data[].pricing.input_cache_read',
      cacheWritePricePerToken: 'data[].pricing.input_cache_write',
      cacheWriteOneHourPricePerToken: 'data[].pricing.input_cache_write_1h',
      reasoningPricePerToken: 'data[].pricing.internal_reasoning',
      requestPrice: 'data[].pricing.request',
      webSearchPrice: 'data[].pricing.web_search',
      imagePrice: 'data[].pricing.image',
      audioPrice: 'data[].pricing.audio',
    },
  };
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

function summarizeEndpointMeasure(records, selector) {
  const contributions = records
    .map((record) => ({
      value: asFiniteNumber(selector(record)),
      requestCount: asFiniteNumber(record.stats?.requestCount),
    }))
    .filter(({ value }) => value !== null);
  if (contributions.length === 0) return null;

  const sortedValues = contributions
    .map(({ value }) => value)
    .sort((left, right) => left - right);
  const requestWeightedContributions = contributions
    .filter(({ requestCount }) => requestCount !== null && requestCount > 0);
  const totalRequestCount = requestWeightedContributions
    .reduce((sum, { requestCount }) => sum + requestCount, 0);
  const requestWeightedMean = totalRequestCount > 0
    ? requestWeightedContributions.reduce(
      (sum, { value, requestCount }) => sum + value * requestCount,
      0,
    ) / totalRequestCount
    : null;

  return {
    contributingEndpointCount: contributions.length,
    arithmeticMean: sortedValues.reduce((sum, value) => sum + value, 0)
      / sortedValues.length,
    requestWeightedMean,
    median: quantile(sortedValues, 0.5),
    percentile25: quantile(sortedValues, 0.25),
    percentile75: quantile(sortedValues, 0.75),
    minimum: sortedValues[0],
    maximum: sortedValues[sortedValues.length - 1],
    totalRequestCount,
  };
}

function buildHistoryUrl(model, series) {
  const searchParams = new URLSearchParams({
    permaslug: model.canonical_slug,
    timeRange: series.timeRange,
    variant: 'standard',
  });
  return `${series.endpointUrl}?${searchParams.toString()}`;
}

function createModelHistoryState(model) {
  return {
    modelId: model.id,
    payloads: {
      latencyMilliseconds: { threeDay: null, oneWeek: null },
      throughputTokensPerSecond: { threeDay: null, oneWeek: null },
    },
    sourceUrls: [],
  };
}

function applyHistoryStabilization(records, historiesByModelId, now) {
  for (const record of records) {
    const history = historiesByModelId.get(record.modelId);
    const latency = stabilizeOpenRouterEndpointMetric({
      currentValue: record.stats.p50LatencyMilliseconds,
      endpointId: record.endpointId,
      threeDayPayload: history?.payloads?.latencyMilliseconds?.threeDay,
      oneWeekPayload: history?.payloads?.latencyMilliseconds?.oneWeek,
      now,
    });
    const throughput = stabilizeOpenRouterEndpointMetric({
      currentValue: record.stats.p50ThroughputTokensPerSecond,
      endpointId: record.endpointId,
      threeDayPayload: history?.payloads?.throughputTokensPerSecond?.threeDay,
      oneWeekPayload: history?.payloads?.throughputTokensPerSecond?.oneWeek,
      now,
    });
    record.stats.stabilizedP50LatencyMilliseconds = latency.value;
    record.stats.stabilizedP50ThroughputTokensPerSecond = throughput.value;
    record.stats.speedStabilization = {
      algorithmVersion: OPENROUTER_SPEED_STABILIZATION_VERSION,
      latencyMilliseconds: latency,
      throughputTokensPerSecond: throughput,
    };
    record.historySourceUrls = [...new Set(history?.sourceUrls || [])].sort();
    record.sourceFields.stabilizedP50LatencyMilliseconds =
      '3d/1w latency-comparison data[].y[endpointId::default], with current p50 fallback';
    record.sourceFields.stabilizedP50ThroughputTokensPerSecond =
      '3d/1w throughput-comparison data[].y[endpointId::default], with current p50 fallback';
  }
}

function summarizeStabilizationCounts(records) {
  const results = records.flatMap((record) => [
    record.stats?.speedStabilization?.latencyMilliseconds,
    record.stats?.speedStabilization?.throughputTokensPerSecond,
  ]).filter(Boolean);
  const sources = {
    threeDayPlusOneWeek: 0,
    threeDayOnly: 0,
    oneWeekOnly: 0,
    currentWindowFallback: 0,
  };
  for (const result of results) {
    if (result.source === 'three-day-plus-one-week-history') {
      sources.threeDayPlusOneWeek += 1;
    } else if (result.source === 'three-day-history') {
      sources.threeDayOnly += 1;
    } else if (result.source === 'one-week-history') {
      sources.oneWeekOnly += 1;
    } else if (result.source === 'current-window-fallback') {
      sources.currentWindowFallback += 1;
    }
  }
  const historyBackedMeasureValues = results.length - sources.currentWindowFallback;
  return {
    stabilizedMeasureValues: results.length,
    historyBackedMeasureValues,
    currentWindowFallbackMeasureValues: sources.currentWindowFallback,
    historyBackedMeasureCoverage: results.length > 0
      ? historyBackedMeasureValues / results.length
      : 0,
    endpointRecordsWithBothMeasuresHistoryBacked: records.filter((record) => (
      record.stats.speedStabilization.latencyMilliseconds.source !== 'current-window-fallback'
      && record.stats.speedStabilization.throughputTokensPerSecond.source
        !== 'current-window-fallback'
    )).length,
    stabilizationSources: sources,
  };
}

function buildModelAggregates(records) {
  const recordsByModelId = new Map();
  for (const record of records) {
    const modelRecords = recordsByModelId.get(record.modelId) || [];
    modelRecords.push(record);
    recordsByModelId.set(record.modelId, modelRecords);
  }

  return [...recordsByModelId.entries()].map(([modelId, modelRecords]) => {
    const first = modelRecords[0];
    const providers = new Set(modelRecords.map((record) => (
      record.providerSlug
      || record.providerName
      || record.providerDisplayName
      || `endpoint:${record.endpointId}`
    )));
    return {
      modelId,
      canonicalSlug: first.canonicalSlug,
      exactModelName: first.exactModelName,
      variant: 'standard',
      endpointCount: modelRecords.length,
      providerCount: providers.size,
      totalRequestCount: modelRecords.reduce(
        (sum, record) => sum + (asFiniteNumber(record.stats?.requestCount) || 0),
        0,
      ),
      measures: {
        inputPricePerToken: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.pricing?.inputPricePerToken,
        ),
        outputPricePerToken: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.pricing?.outputPricePerToken,
        ),
        timeToFirstTokenMilliseconds: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.stats?.stabilizedP50LatencyMilliseconds,
        ),
        outputSpeedTokensPerSecond: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.stats?.stabilizedP50ThroughputTokensPerSecond,
        ),
        instantaneousTimeToFirstTokenMilliseconds: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.stats?.p50LatencyMilliseconds,
        ),
        instantaneousOutputSpeedTokensPerSecond: summarizeEndpointMeasure(
          modelRecords,
          (record) => record.stats?.p50ThroughputTokensPerSecond,
        ),
      },
      endpointIds: modelRecords.map((record) => record.endpointId).sort(),
      providerSlugs: [...providers].sort(),
      sourcePageUrl: first.sourcePageUrl,
      sourceUrls: [...new Set(modelRecords.map((record) => record.sourceUrl))].sort(),
      historySourceUrls: [...new Set(
        modelRecords.flatMap((record) => record.historySourceUrls || []),
      )].sort(),
    };
  }).sort((left, right) => left.modelId.localeCompare(right.modelId, 'en-US'));
}

async function main() {
  const { payload, inputMode, inputPath } = await loadModelCatalog();
  const allModels = (Array.isArray(payload?.data) ? payload.data : [])
    .filter((model) => (
      typeof model?.id === 'string'
      && typeof model?.canonical_slug === 'string'
      && isCanonicalModelRecordId(model.id)
      && isGeneralTextModel(model)
    ))
    .sort((left, right) => left.id.localeCompare(right.id, 'en-US'));
  const requestedModelIds = new Set(
    String(process.env.OPENROUTER_MODEL_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const models = requestedModelIds.size > 0
    ? allModels.filter((model) => requestedModelIds.has(model.id))
    : allModels;
  const missingRequestedModelIds = [...requestedModelIds]
    .filter((modelId) => !allModels.some((model) => model.id === modelId));
  if (missingRequestedModelIds.length > 0) {
    throw new Error(
      `OPENROUTER_MODEL_IDS contains unavailable or ineligible IDs: ${missingRequestedModelIds.join(', ')}`,
    );
  }
  if (models.length === 0) {
    throw new Error('OpenRouter model catalog contained no eligible text-model records.');
  }

  const records = [];
  const failures = [];
  const historyFailures = [];
  const unavailableModels = [];
  const noStatisticsModels = [];
  const endpointDiagnostics = {
    returnedEndpointRows: 0,
    acceptedEndpointRows: 0,
    rejectedEndpointRows: 0,
    rejectedMissingLatency: 0,
    rejectedMissingThroughput: 0,
    rejectedMissingOrZeroRequestCount: 0,
  };
  let cursor = 0;

  async function worker() {
    while (cursor < models.length) {
      const model = models[cursor];
      cursor += 1;
      const searchParams = new URLSearchParams({
        permaslug: model.canonical_slug,
        variant: 'standard',
      });
      const sourceUrl = `${STATS_ENDPOINT_URL}?${searchParams.toString()}`;
      try {
        const response = await fetchJson(sourceUrl);
        let acceptedEndpointCount = 0;
        const endpoints = Array.isArray(response?.data) ? response.data : [];
        endpointDiagnostics.returnedEndpointRows += endpoints.length;
        for (const [sourceOrder, endpoint] of endpoints.entries()) {
          const compact = compactStatsRow(model, endpoint, sourceUrl, sourceOrder);
          if (compact) {
            records.push(compact);
            acceptedEndpointCount += 1;
            endpointDiagnostics.acceptedEndpointRows += 1;
          } else {
            endpointDiagnostics.rejectedEndpointRows += 1;
            const latency = asFiniteNumber(endpoint?.stats?.p50_latency);
            if (latency === null || latency <= 0) {
              endpointDiagnostics.rejectedMissingLatency += 1;
            }
            const throughput = asFiniteNumber(endpoint?.stats?.p50_throughput);
            if (throughput === null || throughput <= 0) {
              endpointDiagnostics.rejectedMissingThroughput += 1;
            }
            const requestCount = asFiniteNumber(endpoint?.stats?.request_count);
            if (requestCount === null || requestCount <= 0) {
              endpointDiagnostics.rejectedMissingOrZeroRequestCount += 1;
            }
          }
        }
        if (acceptedEndpointCount === 0) {
          noStatisticsModels.push({
            modelId: model.id,
            canonicalSlug: model.canonical_slug,
            sourceUrl,
            reason: 'official stats response had no endpoint with both p50 metrics and request_count > 0',
          });
        }
      } catch (error) {
        const unavailable = error && typeof error === 'object' && error.status === 404;
        const target = unavailable ? unavailableModels : failures;
        target.push({
          modelId: model.id,
          canonicalSlug: model.canonical_slug,
          sourceUrl,
          ...(unavailable
            ? { reason: 'official stats endpoint returned HTTP 404' }
            : { error: error instanceof Error ? error.message : String(error) }),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  records.sort((left, right) => (
    left.modelId.localeCompare(right.modelId, 'en-US')
    || String(left.providerSlug || '').localeCompare(String(right.providerSlug || ''), 'en-US')
    || left.endpointId.localeCompare(right.endpointId, 'en-US')
  ));
  failures.sort((left, right) => left.modelId.localeCompare(right.modelId, 'en-US'));
  unavailableModels.sort((left, right) => left.modelId.localeCompare(right.modelId, 'en-US'));
  noStatisticsModels.sort((left, right) => left.modelId.localeCompare(right.modelId, 'en-US'));

  const successfulModelIds = new Set(records.map((record) => record.modelId));
  const queriedModelIds = new Set(models.map((model) => model.id));
  if (failures.length > 0) {
    throw new Error(`OpenRouter performance refresh failed for ${failures.length}/${models.length} models; refusing to replace the verified snapshot.`);
  }

  const historiesByModelId = new Map();
  const historyTasks = [];
  for (const model of models) {
    if (!successfulModelIds.has(model.id)) continue;
    historiesByModelId.set(model.id, createModelHistoryState(model));
    for (const series of HISTORY_SERIES) {
      historyTasks.push({ model, series, sourceUrl: buildHistoryUrl(model, series) });
    }
  }

  let historyCursor = 0;
  let historyRequestsSucceeded = 0;
  async function historyWorker() {
    while (historyCursor < historyTasks.length) {
      const task = historyTasks[historyCursor];
      historyCursor += 1;
      try {
        const response = await fetchJson(task.sourceUrl);
        const state = historiesByModelId.get(task.model.id);
        state.payloads[task.series.metricName][task.series.windowName] = response;
        state.sourceUrls.push(task.sourceUrl);
        historyRequestsSucceeded += 1;
      } catch (error) {
        historyFailures.push({
          modelId: task.model.id,
          canonicalSlug: task.model.canonical_slug,
          metricName: task.series.metricName,
          windowName: task.series.windowName,
          sourceUrl: task.sourceUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  await Promise.all(
    Array.from({ length: HISTORY_CONCURRENCY }, () => historyWorker()),
  );
  historyFailures.sort((left, right) => (
    left.modelId.localeCompare(right.modelId, 'en-US')
    || left.metricName.localeCompare(right.metricName, 'en-US')
    || left.windowName.localeCompare(right.windowName, 'en-US')
  ));
  if (historyFailures.length > 0) {
    throw new Error(
      `OpenRouter history refresh failed for ${historyFailures.length}/${historyTasks.length} requests; refusing to replace the verified snapshot.`,
    );
  }

  const stabilizationReferenceTime = new Date();
  applyHistoryStabilization(records, historiesByModelId, stabilizationReferenceTime);
  const stabilizationCounts = summarizeStabilizationCounts(records);
  const modelAggregates = buildModelAggregates(records);
  const snapshot = {
    schemaVersion: 'openrouter-performance-snapshot/v2',
    fetchedAt: stabilizationReferenceTime.toISOString(),
    source: {
      modelCatalogUrl: MODEL_CATALOG_URL,
      statsEndpointUrl: STATS_ENDPOINT_URL,
      latencyHistoryUrl: LATENCY_HISTORY_URL,
      throughputHistoryUrl: THROUGHPUT_HISTORY_URL,
      statsVariant: 'standard',
      currentMetricWindow: 'endpoint response stats.window_minutes (normally 30 minutes)',
      historyMetricWindows: ['3d hourly curve', '1w daily curve'],
      inputMode,
      ...(inputPath ? { inputPath } : {}),
      ...(requestedModelIds.size > 0
        ? { requestedModelIds: [...requestedModelIds].sort() }
        : {}),
    },
    selectionPolicy: {
      modelRecords: 'canonical general text-output records from /api/v1/models',
      endpointRecords: 'every Standard-variant provider endpoint with positive finite p50 latency, positive finite p50 throughput, and request_count > 0',
      speedStabilization: {
        algorithmVersion: OPENROUTER_SPEED_STABILIZATION_VERSION,
        series: 'Only endpointUuid::default is retained; Flex and Priority series are excluded.',
        completedBuckets: 'Discard the current incomplete UTC hour/day, then retain the latest 72 hourly and 7 daily buckets.',
        windowStatistic: 'Median of positive observations in each endpoint/window; missing buckets are not zero-filled.',
        combination: OPENROUTER_SPEED_STABILIZATION_POLICY.combination,
        baseWeights: {
          threeDay: OPENROUTER_SPEED_STABILIZATION_POLICY.windows.threeDay.baseWeight,
          oneWeek: OPENROUTER_SPEED_STABILIZATION_POLICY.windows.oneWeek.baseWeight,
        },
        coverageAdjustment: 'Multiply each base weight by observed/expected completed-bucket coverage, then renormalize.',
        minimumSamples: {
          threeDayHourlyBuckets:
            OPENROUTER_SPEED_STABILIZATION_POLICY.windows.threeDay.minimumSampleCount,
          oneWeekDailyBuckets:
            OPENROUTER_SPEED_STABILIZATION_POLICY.windows.oneWeek.minimumSampleCount,
        },
        plausibilityGuard: `Reject a history window if its median differs from the current endpoint value by more than ${OPENROUTER_SPEED_STABILIZATION_POLICY.plausibilityRatioLimit}x in either direction.`,
        fallback: 'Use the current endpoint p50 only when neither history window is usable.',
      },
      aggregation: {
        rawRecords: 'Every accepted endpoint remains a separate exact provider-route record.',
        endpointLevel: 'TTFT and throughput are stabilized separately for each current Standard endpoint before model aggregation.',
        modelLevel: 'For each model, preserve arithmetic mean, current-request-count-weighted mean, median, p25, p75, minimum, and maximum across accepted Standard endpoints.',
        primaryMeanDefinition: 'Arithmetic mean gives every published Standard endpoint equal weight; requestWeightedMean is retained separately for traffic-weighted analysis.',
        instantaneousMeasures: 'The original current-window endpoint p50 aggregates remain under instantaneousTimeToFirstTokenMilliseconds and instantaneousOutputSpeedTokensPerSecond.',
        requestWeightCaveat: 'requestWeightedMean uses each endpoint current-window request_count as an auxiliary weight, even for stabilized historical values.',
        latencyCaveat: 'timeToFirstTokenMilliseconds summarizes stabilized provider endpoint p50 series; it is not a recomputed global request-level p50.',
      },
      excludedServiceTiers: ['flex', 'priority'],
    },
    counts: {
      queriedModels: queriedModelIds.size,
      modelsWithPerformance: successfulModelIds.size,
      endpointRecords: records.length,
      modelAggregates: modelAggregates.length,
      modelsWithSingleEndpoint: modelAggregates.filter((record) => record.endpointCount === 1).length,
      modelsWithMultipleEndpoints: modelAggregates.filter((record) => record.endpointCount > 1).length,
      unavailableModels: unavailableModels.length,
      noStatisticsModels: noStatisticsModels.length,
      failedModels: failures.length,
      historyRequestsAttempted: historyTasks.length,
      historyRequestsSucceeded,
      historyRequestsFailed: historyFailures.length,
      ...endpointDiagnostics,
      ...stabilizationCounts,
    },
    records,
    modelAggregates,
    unavailableModels,
    noStatisticsModels,
    failures,
    historyFailures,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: 'VALIDATED_OPENROUTER_PERFORMANCE_SNAPSHOT',
    output: path.relative(ROOT, OUTPUT_PATH),
    ...snapshot.counts,
  }, null, 2));
}

await main();
