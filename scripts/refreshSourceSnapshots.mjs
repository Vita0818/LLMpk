import {
  mkdirSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteFile,
  atomicWriteJson,
  sha256,
  timestampForPath,
} from './sourceSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_ROOT = path.resolve(
  process.env.SOURCE_SNAPSHOT_CACHE_ROOT
    ?? path.join(ROOT, '.cache', 'oagxm-source-snapshots'),
);
const RUN_DIRECTORY = path.join(CACHE_ROOT, timestampForPath());
const STAGED = {
  artificialAnalysis: path.join(RUN_DIRECTORY, 'artificialAnalysisSourceSnapshot.json'),
  arena: path.join(RUN_DIRECTORY, 'arenaRawExtraction.json'),
  openRouterCatalog: path.join(RUN_DIRECTORY, 'openRouterCatalogSnapshot.json'),
  openRouterPerformance: path.join(RUN_DIRECTORY, 'openRouterPerformanceSnapshot.json'),
  frontierCode: path.join(RUN_DIRECTORY, 'frontierCodeSourceSnapshot.json'),
  validation: path.join(RUN_DIRECTORY, 'sourceSnapshotValidationReport.json'),
};
const PUBLISHED = {
  artificialAnalysis: path.join(ROOT, 'src', 'data', 'artificialAnalysisSourceSnapshot.json'),
  arena: path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json'),
  openRouterCatalog: path.join(ROOT, 'src', 'data', 'openRouterCatalogSnapshot.json'),
  openRouterPerformance: path.join(ROOT, 'src', 'data', 'openRouterPerformanceSnapshot.json'),
  frontierCode: path.join(ROOT, 'src', 'data', 'frontierCodeSourceSnapshot.json'),
  validation: path.join(ROOT, 'src', 'data', 'sourceSnapshotValidationReport.json'),
};

function run(label, script, environment = {}) {
  console.log(`\n[${label}]`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script)], {
      cwd: ROOT,
      env: {
        ...process.env,
        ...environment,
      },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${signal ?? `code ${code}`}.`));
    });
  });
}

function publish(sourcePath, destinationPath) {
  const content = readFileSync(sourcePath);
  atomicWriteFile(destinationPath, content);
  return {
    source: path.relative(ROOT, sourcePath),
    destination: path.relative(ROOT, destinationPath),
    bytes: content.length,
    sha256: sha256(content),
  };
}

async function main() {
  mkdirSync(RUN_DIRECTORY, { recursive: true });
  console.log(`Staging source refresh in ${path.relative(ROOT, RUN_DIRECTORY)}`);

  await run('Artificial Analysis', 'fetchArtificialAnalysisSnapshot.mjs', {
    AA_SOURCE_SNAPSHOT_OUTPUT: STAGED.artificialAnalysis,
    AA_RAW_SNAPSHOT_DIR: path.join(RUN_DIRECTORY, 'raw', 'artificial-analysis'),
  });
  await run('Arena', 'fetchArenaSnapshots.mjs', {
    ARENA_SOURCE_SNAPSHOT_DIR: path.join(RUN_DIRECTORY, 'raw', 'arena'),
    ARENA_RAW_EXTRACTION_OUTPUT: STAGED.arena,
  });
  await run('OpenRouter catalog', 'fetchOpenRouterCatalogSnapshot.mjs', {
    OPENROUTER_CATALOG_SNAPSHOT_OUTPUT: STAGED.openRouterCatalog,
  });
  await run('OpenRouter performance', 'fetchOpenRouterPerformanceSnapshot.mjs', {
    OPENROUTER_MODELS_SNAPSHOT_PATH: STAGED.openRouterCatalog,
    OPENROUTER_PERFORMANCE_OUTPUT: STAGED.openRouterPerformance,
  });
  await run('FrontierCode', 'fetchFrontierCodeSnapshot.mjs', {
    FRONTIERCODE_SNAPSHOT_OUTPUT: STAGED.frontierCode,
    FRONTIERCODE_RAW_SNAPSHOT_DIR: path.join(RUN_DIRECTORY, 'raw', 'frontiercode'),
  });
  await run('Cross-source validation', 'validateSourceSnapshots.mjs', {
    AA_SOURCE_SNAPSHOT_PATH: STAGED.artificialAnalysis,
    ARENA_RAW_EXTRACTION_PATH: STAGED.arena,
    OPENROUTER_CATALOG_SNAPSHOT_PATH: STAGED.openRouterCatalog,
    OPENROUTER_PERFORMANCE_SNAPSHOT_PATH: STAGED.openRouterPerformance,
    FRONTIERCODE_SNAPSHOT_PATH: STAGED.frontierCode,
    SOURCE_SNAPSHOT_VALIDATION_OUTPUT: STAGED.validation,
    AA_REFERENCE_SNAPSHOT_PATH: PUBLISHED.artificialAnalysis,
    ARENA_REFERENCE_SNAPSHOT_PATH: PUBLISHED.arena,
    OPENROUTER_PERFORMANCE_REFERENCE_PATH: PUBLISHED.openRouterPerformance,
  });

  const publishedFiles = Object.keys(PUBLISHED).map((key) => (
    publish(STAGED[key], PUBLISHED[key])
  ));
  const manifest = {
    schemaVersion: 'source-snapshot-refresh-run/v1',
    completedAt: new Date().toISOString(),
    status: 'PASS',
    runDirectory: path.relative(ROOT, RUN_DIRECTORY),
    publishedFiles,
  };
  atomicWriteJson(path.join(RUN_DIRECTORY, 'refresh-manifest.json'), manifest);
  atomicWriteJson(path.join(CACHE_ROOT, 'latest.json'), manifest);
  console.log(`\nPublished ${publishedFiles.length} validated snapshots atomically.`);
  console.log(JSON.stringify(manifest, null, 2));
}

await main();
