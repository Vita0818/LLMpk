import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { atomicWriteFile, atomicWriteJson, fetchSource, sha256, timestampForPath } from './sourceSnapshotUtils.mjs';
import {
  OPENROUTER_BENCHMARK_API_URL,
  OPENROUTER_BENCHMARK_KEY_NAME,
  OPENROUTER_BENCHMARK_DATASETS,
  OPENROUTER_EXPORT_BASE_URL,
  summarizeOpenRouterBenchmarkExport,
  validateOpenRouterBenchmarkApiPayload,
  validateOpenRouterExportManifest,
  verifyOpenRouterBenchmarkExport,
} from './openRouterBenchmarkSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CACHE = path.join(ROOT, '.cache', 'oagxm-source-snapshots', 'openrouter-benchmarks');

/** Read only the dedicated key; do not modify the environment or load other apps' keys. */
export function readBenchmarkApiKey({
  environment = process.env,
  localEnvPath = path.join(ROOT, '.env.benchmarks.local'),
} = {}) {
  const value = environment[OPENROUTER_BENCHMARK_KEY_NAME]
    ?? (existsSync(localEnvPath) ? parseEnv(readFileSync(localEnvPath, 'utf8'))[OPENROUTER_BENCHMARK_KEY_NAME] : undefined);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function fetchPublicBenchmarkDataset(dataset, {
  fetcher = fetchSource,
  now = new Date(),
} = {}) {
  const manifestUrl = `${OPENROUTER_EXPORT_BASE_URL}/${dataset}/latest.manifest.json`;
  const manifestResponse = await fetcher(manifestUrl, { accept: 'application/json', maxAttempts: 2 });
  const manifest = validateOpenRouterExportManifest(JSON.parse(manifestResponse.body), dataset, { now });
  let requestedUrl = manifest.files.json.url;
  let response;
  let usedLatestAlias = false;
  try {
    response = await fetcher(requestedUrl, {
      accept: 'application/json', maxAttempts: 1, timeoutMilliseconds: 15_000,
    });
  } catch {
    // A public alias is safe only when its bytes match the dated manifest exactly.
    requestedUrl = `${OPENROUTER_EXPORT_BASE_URL}/${dataset}/latest.json`;
    usedLatestAlias = true;
    response = await fetcher(requestedUrl, { accept: 'application/json', maxAttempts: 2 });
  }
  const payload = verifyOpenRouterBenchmarkExport(response.body, manifest, { now });
  return {
    manifest, payload, body: response.body,
    source: { manifestUrl, datedUrl: manifest.files.json.url, requestedUrl,
      finalUrl: response.finalUrl, usedLatestAlias,
      sha256: manifest.files.json.sha256, bytes: manifest.files.json.bytes },
    summary: summarizeOpenRouterBenchmarkExport(payload),
  };
}

export async function fetchBenchmarkApi(apiKey, { fetcher = fetchSource } = {}) {
  if (!apiKey) throw new Error(`${OPENROUTER_BENCHMARK_KEY_NAME} is required for --api-only.`);
  const response = await fetcher(OPENROUTER_BENCHMARK_API_URL, {
    accept: 'application/json', headers: { Authorization: 'Bearer ' + apiKey }, maxAttempts: 2,
  });
  const payload = validateOpenRouterBenchmarkApiPayload(JSON.parse(response.body));
  return { payload, body: response.body,
    source: { url: OPENROUTER_BENCHMARK_API_URL, finalUrl: response.finalUrl,
      sha256: sha256(response.body), bytes: Buffer.byteLength(response.body) },
    completeness: 'Not assumed complete; public exports retain all published provider and search configurations.' };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--api-only', '--public-only'].includes(arg))
    || (args.includes('--api-only') && args.includes('--public-only'))) {
    throw new Error('Usage: npm run refresh:openrouter-benchmarks -- [--api-only | --public-only]');
  }
  const apiKey = args.includes('--public-only') ? null : readBenchmarkApiKey();
  if (args.includes('--api-only') && !apiKey) {
    throw new Error(`Set ${OPENROUTER_BENCHMARK_KEY_NAME} in .env.benchmarks.local or the process environment.`);
  }
  const fetchedAt = new Date().toISOString();
  const rawDirectory = path.join(DEFAULT_CACHE, timestampForPath(new Date(fetchedAt)));
  const outputPath = path.resolve(process.env.LLMPK_OPENROUTER_BENCHMARK_SNAPSHOT_OUTPUT
    ?? path.join(DEFAULT_CACHE, 'latest.snapshot.json'));
  const datasets = [];
  let api = null;
  if (apiKey) {
    console.log('Fetching OpenRouter Benchmark API (source=openrouter).');
    const result = await fetchBenchmarkApi(apiKey);
    const rawPath = path.join(rawDirectory, 'api.json');
    atomicWriteFile(rawPath, result.body);
    api = { source: { ...result.source, rawSnapshotFile: path.relative(ROOT, rawPath) },
      completeness: result.completeness, payload: result.payload };
  }
  if (!args.includes('--api-only')) {
    for (const dataset of OPENROUTER_BENCHMARK_DATASETS) {
      console.log(`Fetching and verifying OpenRouter ${dataset}.`);
      const result = await fetchPublicBenchmarkDataset(dataset, { now: fetchedAt });
      const rawPath = path.join(rawDirectory, dataset + '.json');
      atomicWriteFile(rawPath, result.body);
      atomicWriteJson(path.join(rawDirectory, dataset + '.manifest.json'), result.manifest);
      datasets.push({ source: { ...result.source, rawSnapshotFile: path.relative(ROOT, rawPath) },
        manifest: result.manifest, summary: result.summary, payload: result.payload });
    }
  }
  const snapshot = { schemaVersion: 'openrouter-benchmark-source-snapshot/v1', fetchedAt,
    scoringPolicy: 'diagnostic-only', apiState: api ? 'validated' : 'not-requested', api, datasets };
  atomicWriteJson(outputPath, snapshot);
  console.log(JSON.stringify({ status: 'VALIDATED_OPENROUTER_BENCHMARK_SNAPSHOT',
    output: path.relative(ROOT, outputPath), scoringPolicy: snapshot.scoringPolicy,
    apiState: snapshot.apiState, apiRows: api?.payload.data.length ?? null,
    datasets: datasets.map(dataset => ({ dataset: dataset.manifest.dataset,
      snapshotDate: dataset.manifest.snapshot_date, rowCount: dataset.summary.rowCount,
      uniqueModelVersions: dataset.summary.uniqueModelVersions,
      providerLabelsRequiringReview: dataset.summary.providerLabelsRequiringReview,
      benchmarks: Object.fromEntries(Object.entries(dataset.summary.benchmarks).map(([name, summary]) => [name, {
        rowCount: summary.rowCount, uniqueModelVersions: summary.uniqueModelVersions,
        newestRun: summary.newestRun, primaryScoreField: summary.primaryScoreField,
      }])) })) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
