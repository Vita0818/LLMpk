import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteFile,
  atomicWriteJson,
  decodeNextFlightPayload,
  extractJsonArraysAfterMarker,
  fetchSource,
  sha256,
  uniqueBy,
} from './sourceSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = path.resolve(
  process.env.AA_SOURCE_SNAPSHOT_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'artificialAnalysisSourceSnapshot.json'),
);
const RAW_DIRECTORY = path.resolve(
  process.env.AA_RAW_SNAPSHOT_DIR
    ?? path.join(ROOT, '.cache', 'oagxm-source-snapshots', 'artificial-analysis'),
);

const PAGE_DEFINITIONS = [
  {
    id: 'model-leaderboard',
    url: 'https://artificialanalysis.ai/leaderboards/models',
    filename: 'model-leaderboard.html',
    kind: 'models',
  },
  {
    id: 'aa-briefcase',
    url: 'https://artificialanalysis.ai/evaluations/aa-briefcase',
    filename: 'evaluation-aa-briefcase.html',
    kind: 'evaluation',
  },
  {
    id: 'automationbench-aa',
    url: 'https://artificialanalysis.ai/evaluations/automationbench-aa',
    filename: 'evaluation-automationbench-aa.html',
    kind: 'evaluation',
  },
  {
    id: 'harvey-lab-aa',
    url: 'https://artificialanalysis.ai/evaluations/harvey-lab-aa',
    filename: 'evaluation-harvey-lab-aa.html',
    kind: 'evaluation',
  },
  {
    id: 'enterprise-ops-gym-aa',
    url: 'https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa',
    filename: 'evaluation-enterprise-ops-gym-aa.html',
    kind: 'evaluation',
  },
  {
    id: 'coding-agents',
    url: 'https://artificialanalysis.ai/agents/coding-agents',
    filename: 'coding-agents.html',
    kind: 'coding-agents',
  },
  {
    id: 'coding-agents-comparison',
    url: 'https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-cursor-cli',
    filename: 'coding-agents-comparison.html',
    kind: 'coding-agents',
  },
];

const CORE_MODEL_FIELDS = [
  'hle',
  'gpqa',
  'critpt',
  'scicode',
  'lcr',
  'omniscienceAccuracy',
  'omniscienceNonHallucination',
  'gdpvalNormalized',
  'tauBanking',
  'terminalbenchV21',
  'ifbench',
  'apexAgents',
  'itbenchSre',
  'mmmuPro',
];

function detailedModelRecords(payload) {
  const candidates = extractJsonArraysAfterMarker(payload, '"models":')
    .map((records) => records.filter((record) => (
      record
      && typeof record === 'object'
      && !Array.isArray(record)
      && typeof record.id === 'string'
      && typeof record.slug === 'string'
      && typeof record.name === 'string'
      && Object.hasOwn(record, 'intelligenceIndex')
    )))
    .sort((left, right) => right.length - left.length);
  if ((candidates[0]?.length ?? 0) < 100) {
    throw new Error('AA model leaderboard did not expose a complete detailed model array.');
  }
  return uniqueBy(candidates[0], (record) => record.id, 'AA model leaderboard');
}

function evaluationRecords(payload, evaluationId, modelById) {
  // Artificial Analysis migrated its evaluation pages from `defaultData` to
  // `initialModels` in August 2026. AA-Briefcase additionally exposes the
  // complete public leaderboard under `models`, while `initialModels` is only
  // a smaller initial chart subset. Accept every first-party transport key
  // and retain the largest validated evaluation-shaped record set.
  const markers = evaluationId === 'aa-briefcase'
    ? ['"defaultData":', '"initialModels":', '"models":']
    : ['"defaultData":', '"initialModels":'];
  const candidates = markers
    .flatMap((marker) => extractJsonArraysAfterMarker(payload, marker))
    .map((records) => records.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      const model = typeof record.id === 'string' ? modelById.get(record.id) : undefined;
      return {
        ...model,
        ...record,
        slug: record.slug ?? model?.slug,
        name: record.name ?? model?.name,
        // AA-Briefcase's public leaderboard emits `elo`, while its smaller
        // chart subset emits `briefcaseElo`. Keep a stable source field for
        // the catalog without discarding the source-native value.
        briefcaseElo: record.briefcaseElo ?? record.elo ?? model?.briefcaseElo,
      };
    }).filter((record) => (
      record
      && typeof record.id === 'string'
      && typeof record.slug === 'string'
      && typeof record.name === 'string'
    )))
    .sort((left, right) => right.length - left.length);
  if ((candidates[0]?.length ?? 0) < 5) {
    throw new Error(
      `AA ${evaluationId} page did not expose a usable evaluation model array.`,
    );
  }
  return uniqueBy(candidates[0], (record) => record.id, `AA ${evaluationId}`);
}

function codingAgentRecords(payload, sourceId) {
  const candidates = extractJsonArraysAfterMarker(payload, '"benchmarkRows":')
    .map((records) => records.filter((record) => (
      record
      && typeof record === 'object'
      && !Array.isArray(record)
      && typeof record.id === 'string'
      && typeof record.agentName === 'string'
      && typeof record.displayLabel === 'string'
      && Array.isArray(record.evals)
      && Number.isFinite(record.indexScore)
    )))
    .sort((left, right) => right.length - left.length);
  if ((candidates[0]?.length ?? 0) < 5) {
    throw new Error(`AA ${sourceId} page did not expose usable benchmarkRows.`);
  }
  return candidates[0];
}

function metricCoverage(models) {
  return Object.fromEntries(CORE_MODEL_FIELDS.map((field) => [
    field,
    models.filter((model) => Number.isFinite(model[field])).length,
  ]));
}

function evaluationCoverage(recordsByEvaluation) {
  const valueSelectors = {
    'aa-briefcase': (record) => (
      record.briefcaseElo
      ?? record.briefcaseBreakdown?.elo
      ?? record.briefcase?.elo
      ?? record.briefcase_breakdown?.elo
    ),
    'automationbench-aa': (record) => (
      record.automationBenchBreakdown?.strictScore
      ?? record.automationBenchBreakdown?.summary?.strictScore
      ?? record.automation_bench_breakdown?.summary?.strict_score
    ),
    'harvey-lab-aa': (record) => (
      record.harveyLabCriteriaPass
      ?? record.harveyLabBreakdown?.criteriaPass
      ?? record.harvey_lab_breakdown?.criteria_pass
    ),
    'enterprise-ops-gym-aa': (record) => (
      record.enterpriseOpsGym
      ?? record.enterpriseOpsGymBreakdown?.summary?.successRate
      ?? record.enterprise_ops_gym_breakdown?.summary?.success_rate
    ),
  };
  return Object.fromEntries(Object.entries(recordsByEvaluation).map(([evaluationId, records]) => [
    evaluationId,
    {
      records: records.length,
      recordsWithPrimaryScore: records.filter((record) => (
        Number.isFinite(valueSelectors[evaluationId]?.(record))
      )).length,
    },
  ]));
}

async function main() {
  mkdirSync(RAW_DIRECTORY, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const fetchedPages = await Promise.all(PAGE_DEFINITIONS.map(async (definition) => {
    const response = await fetchSource(definition.url, {
      accept: 'text/html,application/xhtml+xml',
    });
    if (response.body.length < 50_000) {
      throw new Error(`${definition.id} response is suspiciously small (${response.body.length} bytes).`);
    }
    const decoded = decodeNextFlightPayload(response.body, `AA ${definition.id}`);
    const rawPath = path.join(RAW_DIRECTORY, definition.filename);
    atomicWriteFile(rawPath, response.body);
    return {
      definition,
      response,
      decoded,
      rawPath,
    };
  }));

  const pageById = new Map(fetchedPages.map((page) => [page.definition.id, page]));
  const models = detailedModelRecords(pageById.get('model-leaderboard').decoded.payload);
  const modelById = new Map(models.map((model) => [model.id, model]));
  const evaluationRecordsById = Object.fromEntries(
    fetchedPages
      .filter((page) => page.definition.kind === 'evaluation')
      .map((page) => [
        page.definition.id,
        evaluationRecords(page.decoded.payload, page.definition.id, modelById),
      ]),
  );

  const codingRowsByPage = fetchedPages
    .filter((page) => page.definition.kind === 'coding-agents')
    .flatMap((page) => codingAgentRecords(page.decoded.payload, page.definition.id));
  const codingAgentRows = uniqueBy(
    codingRowsByPage,
    (record) => record.id,
    'AA Coding Agent pages',
  ).sort((left, right) => (
    left.agentName.localeCompare(right.agentName, 'en-US')
    || left.displayLabel.localeCompare(right.displayLabel, 'en-US')
    || left.id.localeCompare(right.id, 'en-US')
  ));

  const modelIds = new Set(models.map((model) => model.id));
  for (const [evaluationId, records] of Object.entries(evaluationRecordsById)) {
    const unknown = records.filter((record) => !modelIds.has(record.id));
    if (unknown.length > 0) {
      throw new Error(
        `${evaluationId} contains ${unknown.length} model IDs absent from the model leaderboard.`,
      );
    }
  }

  const snapshot = {
    schemaVersion: 'artificial-analysis-source-snapshot/v1',
    fetchedAt,
    source: {
      name: 'Artificial Analysis',
      collectionMethod: 'Official public Next.js Flight payloads; no score inference or aggregation.',
      pages: Object.fromEntries(fetchedPages.map((page) => [
        page.definition.id,
        {
          url: page.definition.url,
          finalUrl: page.response.finalUrl,
          rawSnapshotFile: path.relative(ROOT, page.rawPath),
          sha256: sha256(page.response.body),
          bytes: Buffer.byteLength(page.response.body),
          contentType: page.response.contentType,
          etag: page.response.etag,
          lastModified: page.response.lastModified,
          nextFlightChunks: page.decoded.chunkCount,
        },
      ])),
    },
    counts: {
      modelRecords: models.length,
      codingAgentRecords: codingAgentRows.length,
      codingAgentHarnesses: new Set(codingAgentRows.map((record) => record.agentName)).size,
      evaluationRecords: Object.fromEntries(
        Object.entries(evaluationRecordsById)
          .map(([evaluationId, records]) => [evaluationId, records.length]),
      ),
    },
    metricCoverage: metricCoverage(models),
    evaluationCoverage: evaluationCoverage(evaluationRecordsById),
    modelRecords: models,
    evaluationRecords: evaluationRecordsById,
    codingAgentRecords: codingAgentRows,
  };

  atomicWriteJson(OUTPUT_PATH, snapshot);
  console.log(JSON.stringify({
    status: 'VALIDATED_ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT',
    output: path.relative(ROOT, OUTPUT_PATH),
    ...snapshot.counts,
    metricCoverage: snapshot.metricCoverage,
    evaluationCoverage: snapshot.evaluationCoverage,
  }, null, 2));
}

await main();
