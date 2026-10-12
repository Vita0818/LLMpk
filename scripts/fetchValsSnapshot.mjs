import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile, atomicWriteJson, fetchSource, sha256, timestampForPath } from './sourceSnapshotUtils.mjs';
import {
  VALS_ORIGIN, VALS_BENCHMARK_SLUGS, extractValsBenchmarkReferences,
  validateValsBenchmarkPayload, validateReviewedValsRows, extractValsFallbackNotices,
} from './valsSnapshotUtils.mjs';
import { extractValsRefusalDatasets, extractValsRefusalModulePath, validateValsRefusalRecord } from './valsRefusalMetadata.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT = path.resolve(process.env.VALS_SNAPSHOT_OUTPUT ?? path.join(ROOT, 'src/data/valsSourceSnapshot.json'));
const RAW = path.resolve(process.env.VALS_RAW_SNAPSHOT_DIR ?? path.join(ROOT, '.cache/oagxm-source-snapshots/vals', timestampForPath()));

async function main() {
  const benchmarks = [];
  let refusalDatasets;
  let refusalMetadataSource;
  for (const slug of VALS_BENCHMARK_SLUGS) {
    const pageUrl = `${VALS_ORIGIN}/benchmarks/${slug}`;
    const page = await fetchSource(pageUrl);
    const { dataUrl, loaderUrl } = extractValsBenchmarkReferences(page.body);
    if (!refusalDatasets) {
      const loader = await fetchSource(loaderUrl, { accept: 'text/javascript' });
      const metadataUrl = new URL(extractValsRefusalModulePath(loader.body), loader.finalUrl).href;
      const metadata = await fetchSource(metadataUrl, { accept: 'text/javascript' });
      if ([loader.finalUrl, metadata.finalUrl].some(url => new URL(url).origin !== VALS_ORIGIN)) {
        throw new Error('Vals refusal metadata redirected outside the official origin.');
      }
      refusalDatasets = extractValsRefusalDatasets(metadata.body);
      const rawMetadataPath = path.join(RAW, 'refusal-fallback.js');
      atomicWriteFile(rawMetadataPath, metadata.body);
      refusalMetadataSource = { url: metadata.finalUrl, loaderUrl,
        sha256: sha256(metadata.body), rawSnapshotFile: path.relative(ROOT, rawMetadataPath) };
    }
    const data = await fetchSource(dataUrl, { accept: 'application/json' });
    if (new URL(page.finalUrl).origin !== VALS_ORIGIN || new URL(data.finalUrl).origin !== VALS_ORIGIN) {
      throw new Error('Vals public source redirected outside its reviewed official origin.');
    }
    const fetchedAt = new Date().toISOString();
    const parsed = validateValsBenchmarkPayload(JSON.parse(data.body), slug, { now: fetchedAt });
    const refusalDataset = refusalDatasets.get(parsed.metadata.benchmark_id);
    if (!refusalDataset) throw new Error(`Missing Vals refusal metadata dataset: ${slug}.`);
    const refusalFallback = Object.fromEntries(parsed.metadata.models.map(model => {
      const record = refusalDataset.models[model]?.benchmarks?.[parsed.metadata.benchmark_id] ?? null;
      validateValsRefusalRecord(record, parsed.tasks.overall[model]?.accuracy ?? null, `${slug}/${model}`);
      return [model, record];
    }));
    const rawPagePath = path.join(RAW, `${slug}.html`);
    const rawDataPath = path.join(RAW, `${slug}.json`);
    atomicWriteFile(rawPagePath, page.body);
    atomicWriteFile(rawDataPath, data.body);
    benchmarks.push({
      ...parsed, fetchedAt,
      source: {
        pageUrl, dataUrl, finalUrl: data.finalUrl, sha256: sha256(data.body),
        pageSha256: sha256(page.body), bytes: Buffer.byteLength(data.body),
        rawSnapshotFile: path.relative(ROOT, rawDataPath), rawPageFile: path.relative(ROOT, rawPagePath),
        license: 'not-published', citation: `Vals AI · ${parsed.metadata.benchmark} · ${pageUrl}`,
      },
      fallbackNotices: extractValsFallbackNotices(page.body),
      refusalFallback,
    });
    console.log(`${slug}: ${parsed.metadata.models.length} models, updated ${parsed.metadata.updated}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'src/data/valsReviewedMappings.json'), 'utf8'));
  const reviewed = validateReviewedValsRows(benchmarks, manifest);
  const snapshot = {
    schemaVersion: 'vals-source-snapshot/v1', state: 'validated', fetchedAt: new Date().toISOString(),
    source: { name: 'Vals AI', url: VALS_ORIGIN, collectionMethod: 'Official page-linked benchmark-view JSON; no API key required.' },
    reviewedMappingVersion: manifest.schemaVersion,
    refusalMetadataSource,
    counts: { benchmarks: benchmarks.length, modelIds: new Set(benchmarks.flatMap(item => item.metadata.models)).size,
      observedRows: benchmarks.reduce((sum, item) => sum + item.observedRows, 0), ...reviewed },
    benchmarks,
  };
  atomicWriteJson(OUTPUT, snapshot);
  console.log(JSON.stringify({ status: 'VALIDATED_VALS_SNAPSHOT', output: path.relative(ROOT, OUTPUT), ...snapshot.counts }));
}

await main();
