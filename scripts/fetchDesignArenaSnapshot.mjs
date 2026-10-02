import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteFile,
  atomicWriteJson,
  fetchSource,
  sha256,
  timestampForPath,
} from './sourceSnapshotUtils.mjs';
import {
  DESIGN_ARENA_FRONTEND_API_URL,
  DESIGN_ARENA_FRONTEND_PAGE_URL,
  validateDesignArenaFrontendPayload,
} from './designArenaSnapshotUtils.mjs';

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
  const apiKey = process.env.DESIGNARENA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'DESIGNARENA_API_KEY is required for the official Design Arena API. '
      + 'Apply at https://www.designarena.ai/developers/apply.',
    );
  }
  const response = await fetchSource(DESIGN_ARENA_FRONTEND_API_URL, {
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
  const parsed = validateDesignArenaFrontendPayload(payload, { now: fetchedAt });
  const rawPath = path.join(
    RAW_DIR,
    timestampForPath(new Date(fetchedAt)) + '-overall-frontend.json',
  );
  atomicWriteFile(rawPath, response.body);
  const snapshot = {
    schemaVersion: 'design-arena-source-snapshot/v1',
    fetchedAt,
    source: {
      apiUrl: DESIGN_ARENA_FRONTEND_API_URL,
      leaderboardUrl: DESIGN_ARENA_FRONTEND_PAGE_URL,
      finalUrl: response.finalUrl,
      rawSnapshotFile: path.relative(ROOT, rawPath),
      sha256: sha256(response.body),
      bytes: Buffer.byteLength(response.body),
      contentType: response.contentType,
    },
    arena: 'models',
    category: 'codecategories',
    metric: 'elo',
    lastUpdated: parsed.lastUpdated,
    responseTimestamp: parsed.responseTimestamp,
    rows: parsed.rows,
  };
  atomicWriteJson(OUTPUT_PATH, snapshot);
  console.log(JSON.stringify({
    status: 'VALIDATED_DESIGN_ARENA_FRONTEND_SNAPSHOT',
    output: path.relative(ROOT, OUTPUT_PATH),
    rowCount: snapshot.rows.length,
    lastUpdated: snapshot.lastUpdated,
    rowsWithOpenRouterId: snapshot.rows.filter((row) => row.openRouterId).length,
  }, null, 2));
}

await main();
