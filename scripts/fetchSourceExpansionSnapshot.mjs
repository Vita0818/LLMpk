import path from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { atomicWriteJson, fetchSource, sha256, timestampForPath } from './sourceSnapshotUtils.mjs';
import { readBenchmarkApiKey } from './fetchOpenRouterBenchmarkSnapshot.mjs';
import { EXPANSION_METRICS, normalizeExpansionDataset, readEpochTables, validateExpansionSnapshot, extractLivebenchModelSettings } from './sourceExpansionSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const datasetIds = [...new Set(EXPANSION_METRICS.map(metric => metric.datasetId))];
const epochUrl = 'https://epoch.ai/data/benchmark_data.zip';
const livebenchUrl = 'https://livebench.ai/data/20261014/table.csv';
const compassUrl = 'https://cdn.opencompass.org.cn/assets/lm/data-lm-ability_official.json?benchmark=text';
const routerUrl = 'https://openrouter.ai/api/v1/benchmarks?include_run_config=true';

export async function buildExpansionSnapshotFromPack(folder) {
  const pack = JSON.parse(readFileSync(path.join(folder, 'pack.json'), 'utf8'));
  const datasets = []; const records = [];
  for (const id of datasetIds) {
    const entry = pack.datasets.find(dataset => dataset.id === id);
    if (!entry || !entry.filename || path.basename(entry.filename) !== entry.filename) throw new Error(`Missing raw dataset ${id}.`);
    const bytes = readFileSync(path.join(folder, entry.filename));
    if (sha256(bytes) !== entry.sha256) throw new Error(`Raw hash mismatch ${id}.`);
    if (id === 'livebench2') {
      const proof = entry.methodology;
      if (!proof || proof.filename !== 'livebench2-notes.json') throw new Error('Missing LiveBench methodology evidence.');
      const notes = readFileSync(path.join(folder, proof.filename));
      const parsed = JSON.parse(notes);
      if (sha256(notes) !== proof.sha256 || !Array.isArray(parsed)
        || !parsed.some(note => /highest supported effort setting/u.test(note))
        || !parsed.some(note => /could not measure.*scores 0/u.test(note))) throw new Error('LiveBench effort/zero policy changed; review before publishing.');
      const settings = entry.modelSettingsSource;
      if (!settings || settings.filename !== 'livebench-main.js') throw new Error('Missing per-model LiveBench execution settings.');
      const javascript = readFileSync(path.join(folder, settings.filename));
      if (sha256(javascript) !== settings.sha256) throw new Error('LiveBench model settings hash changed.');
      entry.modelSettings = extractLivebenchModelSettings(javascript.toString('utf8'));
    }
    if (id === 'opencompass-v3') {
      const proof = entry.methodology;
      if (!proof || proof.filename !== 'opencompass-rule-version.json') throw new Error('Missing OpenCompass rule-version evidence.');
      const layout = readFileSync(path.join(folder, proof.filename));
      const capture = JSON.parse(layout);
      if (sha256(layout) !== proof.sha256 || capture.url !== 'https://rank.opencompass.org.cn/leaderboard/llm'
        || !/榜单 V3\.0\b/u.test(capture.text)) throw new Error('OpenCompass rule version changed.');
    }
    const input = id.startsWith('epoch-')
      ? readEpochTables(path.join(folder, entry.filename))[id.slice(6) + '.csv'] : bytes.toString('utf8');
    const normalized = normalizeExpansionDataset(entry, input);
    records.push(...normalized);
    const { modelSettings, ...provenance } = entry;
    datasets.push({ ...provenance, rawSnapshotFile: path.relative(ROOT, path.join(folder, entry.filename)), records: normalized.length });
  }
  return { schemaVersion: 'source-expansion-snapshot/v1', state: 'validated', fetchedAt: pack.fetchedAt,
    datasets, records, admissionNotes: pack.admissionNotes ?? [] };
}

async function acquire(folder, arenaFolder, compassCapture) {
  mkdirSync(folder, { recursive: true });
  const requests = new Map(); const datasets = [];
  const fetchText = async (url, auth) => {
    if (!requests.has(url)) requests.set(url, fetchSource(url, auth ? { headers: { Authorization: 'Bearer ' + readBenchmarkApiKey() } } : {}));
    return requests.get(url);
  };
  for (const id of datasetIds) {
    const metric = EXPANSION_METRICS.find(metric => metric.datasetId === id);
    let url = metric.officialUrl; let filename = id + '.txt'; let body; let fetchedAt = new Date().toISOString(); let methodology; let modelSettingsSource;
    if (id.startsWith('arena-')) {
      if (!arenaFolder) throw new Error('Arena rendered captures are required: pass --arena-dom-dir with current official table captures (no guessed or stale fallback).');
      filename = id + '-dom.json';
      body = readFileSync(path.join(arenaFolder, filename));
      const capture = JSON.parse(body); fetchedAt = capture.fetchedAt;
      if (capture.url !== url) throw new Error('Arena capture URL mismatch.');
    } else if (id.startsWith('epoch-')) {
      url = epochUrl; filename = 'epoch-benchmark-data.zip';
      if (!existsSync(path.join(folder, filename))) {
        const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
        if (!response.ok || new URL(response.url).hostname !== 'epoch.ai') throw new Error('Epoch ZIP download failed.');
        body = Buffer.from(await response.arrayBuffer());
        if (body.length < 10_000 || body.length > 30_000_000) throw new Error('Unexpected Epoch ZIP size.');
        writeFileSync(path.join(folder, filename), body);
      } else body = readFileSync(path.join(folder, filename));
    } else {
      if (id.startsWith('design-')) url = `${routerUrl}&source=design-arena&arena=${id.slice(7)}`;
      if (id === 'openrouter-native') url = routerUrl;
      if (id === 'livebench2') url = livebenchUrl;
      if (id === 'opencompass-v3') url = compassUrl;
      if (id === 'livebench2') {
        const proofUrl = 'https://livebench.ai/data/20261014/notes.json';
        const proof = await fetchText(proofUrl, false);
        const proofFile = 'livebench2-notes.json';
        writeFileSync(path.join(folder, proofFile), proof.body);
        methodology = { url: proofUrl, filename: proofFile, sha256: sha256(proof.body) };
        const home = await fetchText('https://livebench.ai/', false);
        const scripts = [...home.body.matchAll(/<script[^>]*src=["']([^"']*\/static\/js\/main\.[a-f\d]+\.js)["']/gu)];
        if (scripts.length !== 1) throw new Error('LiveBench public metadata bundle reference changed.');
        const scriptUrl = new URL(scripts[0][1], 'https://livebench.ai/').href;
        if (new URL(scriptUrl).origin !== 'https://livebench.ai') throw new Error('Untrusted LiveBench metadata origin.');
        const script = await fetchText(scriptUrl, false);
        extractLivebenchModelSettings(script.body);
        writeFileSync(path.join(folder, 'livebench-main.js'), script.body);
        modelSettingsSource = { url: scriptUrl, filename: 'livebench-main.js', sha256: sha256(script.body) };
      }
      if (id === 'opencompass-v3') {
        if (!compassCapture) throw new Error('OpenCompass separates its rule version from its data JSON; pass --opencompass-rule-dom with the current rendered version caption.');
        const proof = readFileSync(compassCapture); const proofFile = 'opencompass-rule-version.json';
        writeFileSync(path.join(folder, proofFile), proof);
        methodology = { url: metric.officialUrl, filename: proofFile, sha256: sha256(proof) };
      }
      if ((id.startsWith('design-') || id === 'openrouter-native') && !readBenchmarkApiKey()) throw new Error('The existing dedicated benchmark API key is required.');
      const response = await fetchText(url, id.startsWith('design-') || id === 'openrouter-native');
      if (new URL(response.finalUrl).hostname !== new URL(url).hostname) throw new Error('Expansion source redirected to an unexpected host.');
      body = response.body;
    }
    writeFileSync(path.join(folder, filename), body);
    datasets.push({ id, url, filename, fetchedAt, sha256: sha256(body), ...(methodology ? { methodology } : {}),
      ...(modelSettingsSource ? { modelSettingsSource } : {}), collectionMethod: id.startsWith('arena-') ? 'official-rendered-dom' : 'official-public-data' });
    console.log(`Acquired ${id}`);
  }
  atomicWriteJson(path.join(folder, 'pack.json'), { schemaVersion: 'source-expansion-raw-pack/v1', fetchedAt: new Date().toISOString(), datasets });
}

export async function main(args = process.argv.slice(2)) {
  const argument = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const existingPack = argument('--from-dir');
  const folder = existingPack ? path.resolve(existingPack) : path.join(ROOT, '.cache/oagxm-source-snapshots/expansion', timestampForPath());
  if (!existingPack) await acquire(folder, argument('--arena-dom-dir'), argument('--opencompass-rule-dom'));
  const snapshot = await buildExpansionSnapshotFromPack(folder);
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'src/data/sourceExpansionReviewedMappings.json')));
  const result = validateExpansionSnapshot(snapshot, manifest);
  atomicWriteJson(path.join(ROOT, 'src/data/sourceExpansionSnapshot.json'), snapshot);
  console.log(JSON.stringify({ status: 'VALIDATED_SOURCE_EXPANSION', ...result }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
