import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteFile,
  atomicWriteJson,
  decodeNextFlightPayload,
  fetchSource,
  sha256,
} from './sourceSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SNAPSHOT_DIRECTORY = path.resolve(
  process.env.ARENA_SOURCE_SNAPSHOT_DIR
    ?? path.join(ROOT, '.cache', 'oagxm-source-snapshots', 'arena'),
);
const OUTPUT_PATH = path.resolve(
  process.env.ARENA_RAW_EXTRACTION_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json'),
);

const PAGES = [
  ['arena_text_instruction', 'https://arena.ai/leaderboard/chat/text/instruction-following'],
  ['arena_text_multiturn', 'https://arena.ai/leaderboard/chat/text/multi-turn'],
  ['arena_text_creative', 'https://arena.ai/leaderboard/chat/text/creative-writing'],
  ['arena_text_hard', 'https://arena.ai/leaderboard/chat/text/hard-prompts'],
  ['arena_text_math', 'https://arena.ai/leaderboard/chat/text/math'],
  ['arena_text_coding', 'https://arena.ai/leaderboard/chat/text/coding'],
  ['arena_code_webdev', 'https://arena.ai/leaderboard/code/webdev'],
  ['arena_search', 'https://arena.ai/leaderboard/chat/search'],
  ['arena_agent', 'https://arena.ai/leaderboard/agent'],
].map(([id, url]) => ({
  id,
  url,
  filename: `arena_subpage_${id}.html`,
}));

function runExtractor() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, 'scripts', 'build-arena-raw-extraction.mjs')],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          ARENA_SNAPSHOT_DIR: SNAPSHOT_DIRECTORY,
          ARENA_RAW_EXTRACTION_OUTPUT: OUTPUT_PATH,
          ARENA_PREVIOUS_EXTRACTION_PATH: process.env.ARENA_PREVIOUS_EXTRACTION_PATH
            ?? path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json'),
        },
        stdio: 'inherit',
      },
    );
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Arena extractor exited with ${signal ?? `code ${code}`}.`));
    });
  });
}

async function main() {
  mkdirSync(SNAPSHOT_DIRECTORY, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const pages = await Promise.all(PAGES.map(async (definition) => {
    const response = await fetchSource(definition.url, {
      accept: 'text/html,application/xhtml+xml',
    });
    if (response.body.length < 50_000) {
      throw new Error(`${definition.id} response is suspiciously small (${response.body.length} bytes).`);
    }
    const decoded = decodeNextFlightPayload(response.body, `Arena ${definition.id}`);
    const filepath = path.join(SNAPSHOT_DIRECTORY, definition.filename);
    atomicWriteFile(filepath, response.body);
    return {
      id: definition.id,
      url: definition.url,
      finalUrl: response.finalUrl,
      filename: definition.filename,
      sha256: sha256(response.body),
      bytes: Buffer.byteLength(response.body),
      contentType: response.contentType,
      etag: response.etag,
      lastModified: response.lastModified,
      nextFlightChunks: decoded.chunkCount,
    };
  }));

  atomicWriteJson(path.join(SNAPSHOT_DIRECTORY, 'manifest.json'), {
    schemaVersion: 'arena-html-snapshot-manifest/v1',
    fetchedAt,
    pages,
  });
  await runExtractor();
}

await main();
