import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteFile,
  atomicWriteJson,
  fetchSource,
  sha256,
  timestampForPath,
} from './sourceSnapshotUtils.mjs';
import {
  DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL,
  DESIGN_ARENA_FRONTEND_PAGE_URL,
  validateOpenRouterDesignArenaPayload,
  validateReviewedDesignArenaSourceRows,
} from './designArenaSnapshotUtils.mjs';
import { readBenchmarkApiKey } from './fetchOpenRouterBenchmarkSnapshot.mjs';
import { OPENROUTER_BENCHMARK_KEY_NAME } from './openRouterBenchmarkSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = path.resolve(
  process.env.DESIGNARENA_SNAPSHOT_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'designArenaSourceSnapshot.json'),
);
const RAW_DIR = path.resolve(
  process.env.DESIGNARENA_RAW_SNAPSHOT_DIR
    ?? path.join(ROOT, '.cache', 'oagxm-source-snapshots', 'design-arena'),
);

async function main() {
  const apiKey = readBenchmarkApiKey();
  if (!apiKey) {
    throw new Error(
      `${OPENROUTER_BENCHMARK_KEY_NAME} is required. Set the dedicated key in .env.benchmarks.local.`,
    );
  }
  const response = await fetchSource(DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL, {
    accept: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error('Design Arena returned a non-JSON leaderboard response.');
  }
  const fetchedAt = new Date().toISOString();
  const parsed = validateOpenRouterDesignArenaPayload(payload, { now: fetchedAt });
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'designArenaReviewedMappings.json'), 'utf8'));
  const reviewed = validateReviewedDesignArenaSourceRows(parsed.rows, manifest);
  const rawPath = path.join(
    RAW_DIR,
    timestampForPath(new Date(fetchedAt)) + '-overall-frontend.json',
  );
  atomicWriteFile(rawPath, response.body);
  const snapshot = {
    schemaVersion: 'design-arena-source-snapshot/v2',
    state: 'validated',
    fetchedAt,
    source: {
      apiUrl: DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL,
      leaderboardUrl: DESIGN_ARENA_FRONTEND_PAGE_URL,
      transport: 'openrouter-benchmarks',
      citation: payload.meta.citation,
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      finalUrl: response.finalUrl,
      rawSnapshotFile: path.relative(ROOT, rawPath),
      sha256: sha256(response.body),
      bytes: Buffer.byteLength(response.body),
      contentType: response.contentType,
    },
    arena: 'models',
    category: 'codecategories',
    metric: 'elo',
    sourceAsOf: parsed.sourceAsOf,
    lastUpdated: null,
    responseMeta: parsed.responseMeta,
    reviewedMappingVersion: manifest.schemaVersion,
    rows: parsed.rows,
  };
  atomicWriteJson(OUTPUT_PATH, snapshot);
  console.log(JSON.stringify({
    status: 'VALIDATED_DESIGN_ARENA_FRONTEND_SNAPSHOT',
    output: path.relative(ROOT, OUTPUT_PATH),
    rowCount: snapshot.rows.length,
    sourceAsOf: snapshot.sourceAsOf,
    leaderboardUpdateTime: 'not-published',
    ...reviewed,
  }, null, 2));
}

await main();
