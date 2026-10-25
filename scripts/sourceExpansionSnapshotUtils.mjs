import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from '@babel/parser';
import { decodeNextFlightPayload, extractJsonArraysAfterMarker, sha256 } from './sourceSnapshotUtils.mjs';

export const EXPANSION_METRICS = JSON.parse(readFileSync(new URL('../src/data/sourceExpansionMetricDefinitions.json', import.meta.url)));

/** Read the public table tooltip metadata as static literals; never execute source JS. */
export function extractLivebenchModelSettings(source) {
  const tree = parse(source, { sourceType: 'unambiguous' });
  const stack = [tree]; const candidates = [];
  const key = node => node?.type === 'StringLiteral' ? node.value : node?.type === 'Identifier' ? node.name : null;
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'ObjectExpression') {
      const names = node.properties.map(property => key(property.key));
      if (names.includes('claude-opus-5.5') && names.includes('gemini-4-argon')) candidates.push(node);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value.filter(value => value && typeof value === 'object'));
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
  if (candidates.length !== 1) throw new Error('LiveBench model metadata object changed.');
  return Object.fromEntries(candidates[0].properties.map(property => {
    if (property.type !== 'ObjectProperty' || property.computed || property.value.type !== 'ObjectExpression') throw new Error('Unsupported LiveBench model settings.');
    const fields = Object.fromEntries(property.value.properties.filter(field => field.type === 'ObjectProperty' && !field.computed
      && field.value.type === 'StringLiteral').map(field => [key(field.key), field.value.value]));
    if (!fields.displayName || !fields.effort || !fields.url) throw new Error('Missing LiveBench model name/effort.');
    return [key(property.key), { displayName: fields.displayName, effort: fields.effort,
      version: fields.version ?? null, modelUrl: fields.url, weightsUrl: fields.huggingface ?? null }];
  }));
}

/** RFC 4180 quoting, including embedded commas and newlines. Empty cells stay null. */
export function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && !value) quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/u, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('Unterminated CSV field.');
  if (row.length || value) { row.push(value.replace(/\r$/u, '')); rows.push(row); }
  const header = rows.shift()?.map(value => value.replace(/^\uFEFF/u, ''));
  if (!header || new Set(header).size !== header.length) throw new Error('Missing or duplicate CSV columns.');
  return rows.filter(row => row.some(Boolean)).map(row => {
    if (row.length !== header.length) throw new Error('CSV row width changed.');
    return Object.fromEntries(header.map((key, i) => [key, row[i] === '' ? null : row[i]]));
  });
}

export function readEpochTables(zipPath) {
  const program = `import sys,zipfile,json,csv,io
names=['frontiermath_tiers_1_3_v2.csv','frontiermath_tier_4_v2.csv','mirrorcode.csv']
out={}
with zipfile.ZipFile(sys.argv[1]) as z:
 for name in names:
  found=[x for x in z.infolist() if x.filename==name or x.filename.endswith('/'+name)]
  if len(found)!=1 or found[0].file_size>5000000: raise ValueError('Unexpected Epoch table')
  out[name]=list(csv.DictReader(io.StringIO(z.read(found[0]).decode('utf-8-sig'))))
print(json.dumps(out))`;
  const process = spawnSync('python3', ['-c', program, zipPath], { encoding: 'utf8', maxBuffer: 10_000_000 });
  if (process.status !== 0) throw new Error(`Epoch ZIP reader failed: ${process.stderr}`);
  return JSON.parse(process.stdout);
}

function numeric(value) {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && /^n\/?a$/iu.test(value.trim()))) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Non-finite source result.');
  return number;
}

function percentage(value) {
  const number = numeric(value);
  return number === null ? null : number / 100;
}

function profileFromName(name) {
  // "Max" is also part of Qwen's product name; its trailing tier/date is separate.
  const effortText = name.replace(/^qwen3[.-]8[- ]?max\b(?:\s*\(0902\))?/iu, '');
  const match = effortText.match(/\b(max|x[- ]?high|high|medium|low|thinking)\b/iu);
  return match ? match[1].toLowerCase().replace(/[- ]/gu, '') : 'default';
}

export function normalizeExpansionDataset(dataset, input) {
  const metrics = EXPANSION_METRICS.filter(metric => metric.datasetId === dataset.id);
  if (!metrics.length) throw new Error(`Unknown dataset ${dataset.id}.`);
  const records = [];
  const add = (sourceModelId, sourceModelName, identity, profile, harness, values, sourceDate = dataset.fetchedAt.slice(0, 10)) => {
    if (!sourceModelId || !sourceModelName || !Object.keys(identity).length) throw new Error('Missing source model identity.');
    const date = Date.parse(sourceDate);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(sourceDate) || !Number.isFinite(date)
      || new Date(date).toISOString().slice(0, 10) !== sourceDate
      || date > Date.parse(dataset.fetchedAt) + 86_400_000) throw new Error('Invalid source date.');
    const observations = values.map(({ metric, value, ...evidence }) => ({ metricId: metric.id,
      benchmarkVersion: metric.benchmarkVersion, rawValue: numeric(value), sourceField: metric.field, ...evidence }));
    for (const observation of observations) {
      const metric = metrics.find(metric => metric.id === observation.metricId);
      if (observation.rawValue !== null && metric.metricType === 'accuracy'
        && (observation.rawValue < 0 || observation.rawValue > 1)) throw new Error(`Score scale changed: ${metric.id}.`);
      if (observation.standardError !== undefined && (!Number.isFinite(observation.standardError)
        || observation.standardError < 0 || observation.standardError > 1)) throw new Error('Invalid source standard error.');
    }
    records.push({ id: `${dataset.id}-${sha256(JSON.stringify(identity)).slice(0, 20)}`,
      datasetId: dataset.id, source: metrics[0].sourceType, sourceModelId, sourceModelName,
      identity, sourceUrl: metrics[0].officialUrl, dataUrl: dataset.url, sourceDate,
      fetchedAt: dataset.fetchedAt, sha256: dataset.sha256, profile, harness, observations });
  };
  if (dataset.id.startsWith('design-')) {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    if (!Array.isArray(payload.data) || !payload.meta?.as_of) throw new Error('Invalid DesignArena envelope.');
    const identityKey = row => JSON.stringify([row.model_permaslug, row.display_name, row.arena, row.category]);
    const identityCounts = new Map();
    for (const row of payload.data) identityCounts.set(identityKey(row), (identityCounts.get(identityKey(row)) ?? 0) + 1);
    const occurrence = new Map();
    for (const row of payload.data) {
      const metric = metrics.find(metric => metric.field === row.category);
      if (!metric) continue;
      if (row.source !== 'design-arena' || row.arena !== dataset.id.slice(7)) throw new Error('DesignArena source/arena changed.');
      const key = identityKey(row); const ordinal = occurrence.get(key) ?? 0;
      occurrence.set(key, ordinal + 1);
      add(row.model_permaslug, row.display_name,
        { modelPermaslug: row.model_permaslug, displayName: row.display_name, arena: row.arena, category: row.category,
          ...(identityCounts.get(key) > 1 ? { ambiguousIdentity: true, duplicateOrdinal: ordinal } : {}) },
        profileFromName(row.display_name), `DesignArena ${row.arena} / ${row.category}`,
        [{ metric, value: row.elo, notes: 'Elo；effort 未披露时保留 Default 来源；同义分类不重复导入。' }], payload.meta.as_of.slice(0, 10));
    }
  } else if (dataset.id === 'livebench2') {
    for (const row of parseCsv(input)) {
      if (metrics.some(metric => !Object.hasOwn(row, metric.field))) throw new Error('LiveBench suite columns changed.');
      const model = dataset.modelSettings?.[row.model];
      if (!model || !['max', 'xhigh', 'high', 'medium', 'low', 'none'].includes(model.effort)) throw new Error('LiveBench model effort needs review.');
      add(row.model, model.displayName, { model: row.model, release: '2026-10-14', ...model },
      model.effort, 'LiveBench 2.0 benchmark scaffold',
      metrics.map(metric => ({ metric, value: percentage(row[metric.field]),
        notes: '按该模型公开的 effort 连接；单次运行。来源明确的零分保留为零；Overall 不重复计分。' })));
    }
  } else if (dataset.id.startsWith('epoch-')) {
    const rows = typeof input === 'string' ? parseCsv(input) : input;
    for (const row of rows) {
      if (!row.id || !row['Started at'] || !row['Release date']) throw new Error('Missing Epoch run identity/date.');
      add(row['Model version'], row['Model version'],
        { runId: row.id, modelVersion: row['Model version'], releaseDate: row['Release date'], startedAt: row['Started at'], table: dataset.id.slice(6) },
        profileFromName(row['Model version'].replaceAll('_', ' ')), 'Epoch independent evaluation',
        [{ metric: metrics[0], value: row.mean_score,
          ...(row.stderr ? { standardError: numeric(row.stderr) } : {}), notes: '采用本次运行 mean_score；标准误保留为 SE；不选择 Best score。' }], row['Started at'].slice(0, 10));
    }
  } else if (dataset.id.startsWith('aa-')) {
    const payload = decodeNextFlightPayload(input).payload;
    const versionMarkers = { 'aa-gdpval21': 'GDPval-AA v2.1', 'aa-critpt2': 'CritPt v2',
      'aa-3d': 'AA-3D v1.0', 'aa-tbscience': '0.1' };
    if (versionMarkers[dataset.id] && !payload.includes(versionMarkers[dataset.id])) throw new Error('AA benchmark edition changed.');
    const arrays = extractJsonArraysAfterMarker(payload, '"initialModels":');
    if (arrays.length !== 1 || arrays[0].length < 10) throw new Error(`AA evaluation data changed: ${dataset.id}.`);
    for (const row of arrays[0]) {
      const metric = metrics[0];
      if (!Object.hasOwn(row, metric.field)) throw new Error(`Missing AA field ${metric.field}.`);
      const confidence = metric.id === 'aa_gdpval_v21' ? row.gdpvalBreakdown : null;
      add(row.slug, row.name, { slug: row.slug, name: row.name, releaseDate: row.releaseDate, creator: row.creator.slug },
        profileFromName(row.name), 'Artificial Analysis benchmark scaffold',
        [{ metric, value: row[metric.field],
          ...(typeof confidence?.lower95ci === 'number' && typeof confidence?.upper95ci === 'number'
            ? { confidenceLow: confidence.lower95ci, confidenceHigh: confidence.upper95ci } : {}),
          notes: row.name.includes('Fallback') ? '来源运行含 Default Fallback；保留发布者原始口径与运行名称。' : '' }]);
    }
  } else if (dataset.id.startsWith('scale-')) {
    const payload = decodeNextFlightPayload(input).payload;
    const arrays = extractJsonArraysAfterMarker(payload, '"entries":');
    const rows = arrays[dataset.id.endsWith('-hard') ? 1 : 0];
    if (!rows?.length) throw new Error(`Scale entries missing: ${dataset.id}.`);
    if (dataset.id.startsWith('scale-pro2-') && (!payload.includes('SWE-Bench Pro V2 Full') || !payload.includes('SWE-Bench Pro V2 HARD'))) throw new Error('Scale Pro V2 variant identity changed.');
    for (const row of rows) {
      const productionHarness = /\(Claude Code\)/iu.test(row.model) ? 'Claude Code'
        : /\(Codex\)/iu.test(row.model) ? 'Codex CLI' : null;
      const harness = productionHarness ?? (/mini-swe/iu.test(row.model) ? 'mini-swe-agent (benchmark internal)' : 'Scale benchmark scaffold');
      const ci = row.confidenceInterval_upper;
      if (ci !== null && ci !== undefined && (!Number.isFinite(ci) || ci < 0)) throw new Error('Invalid Scale uncertainty.');
      add(row.model, row.model, { model: row.model, version: row.version, company: row.company,
        deprecated: row.deprecated, variant: dataset.id, productionHarness }, profileFromName(row.model), harness,
        [{ metric: metrics[0], value: percentage(row.score),
          ...(typeof ci === 'number' && ci > 0 ? { confidenceLow: Math.max(0, (row.score - ci) / 100), confidenceHigh: Math.min(1, (row.score + ci) / 100) } : {}),
          notes: dataset.id.startsWith('scale-pro2') ? 'Full/HARD 独立保留；生产 CLI 名称与发布者回合预算说明保存在来源快照。'
            : dataset.id === 'scale-rli' ? 'Automation Rate；来源未提供置信区间。' : '' }], row.createdAt.slice(0, 10));
    }
  } else if (dataset.id.startsWith('arena-')) {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    const dates = payload.text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 2026\b/gu);
    if (!payload.url || payload.url !== dataset.url || !dates?.length || payload.rows.length < 10) throw new Error('Incomplete rendered Arena capture.');
    const sourceDate = new Date(dates[0] + ' UTC').toISOString().slice(0, 10);
    for (const row of payload.rows.slice(1)) {
      const name = row.links?.[0]?.text;
      const match = row.cells[3]?.match(/^([\d,]+)\s*(?:±\s*(\d+)|\+(\d+)\s*\/\s*-(\d+))/u);
      if (!name || !match) throw new Error('Arena score columns changed.');
      const value = Number(match[1].replaceAll(',', ''));
      const upperRadius = Number(match[2] ?? match[3]); const lowerRadius = Number(match[2] ?? match[4]);
      add(name, name, { modelName: name, modelUrl: row.links[0].href, styleControl: 'off' },
        profileFromName(name), 'Arena leaderboard benchmark methodology',
        [{ metric: metrics[0], value, confidenceLow: value - lowerRadius, confidenceHigh: value + upperRadius,
          sampleSize: Number(row.cells[4].replaceAll(',', '')), notes: `榜单更新 ${sourceDate}；样本量为投票数。` }], sourceDate);
    }
  } else if (dataset.id === 'openrouter-native') {
    const payload = typeof input === 'string' ? JSON.parse(input) : input;
    for (const row of payload.data ?? []) {
      const metric = metrics.find(metric => metric.field === row.benchmark_type);
      if (row.source !== 'openrouter' || !metric) continue;
      add(row.model_permaslug, row.display_name,
        { modelPermaslug: row.model_permaslug, displayName: row.display_name, benchmarkType: row.benchmark_type, runConfig: row.run_config ?? null },
        row.run_config?.reasoning_effort ?? 'default', 'OpenRouter benchmark scaffold',
        [{ metric, value: row.accuracy, sampleSize: row.total_tasks,
          notes: 'OpenRouter 原生独立运行；AA 与 DesignArena 镜像不在本数据集中重复导入。' }], row.last_run_timestamp.slice(0, 10));
    }
  }
  if (!records.length || new Set(records.map(record => record.id)).size !== records.length) throw new Error(`Empty or ambiguous source dataset: ${dataset.id}.`);
  return records;
}

export function validateExpansionSnapshot(snapshot, manifest) {
  if (snapshot?.schemaVersion !== 'source-expansion-snapshot/v1' || snapshot.state !== 'validated'
    || !Array.isArray(snapshot.records) || !Array.isArray(snapshot.datasets)
    || manifest?.schemaVersion !== 'source-expansion-reviewed-mappings/v1') throw new Error('Unsupported expansion snapshot/manifest.');
  if (new Set(snapshot.records.map(record => record.id)).size !== snapshot.records.length) throw new Error('Duplicate expansion source record.');
  const byId = new Map(snapshot.records.map(record => [record.id, record]));
  for (const entry of manifest.entries) {
    const record = byId.get(entry.recordId);
    if (!record || record.source !== entry.source || record.datasetId !== entry.datasetId
      || record.profile !== entry.sourceProfile || record.harness !== entry.sourceHarness
      || JSON.stringify(record.identity) !== JSON.stringify(entry.identity)) throw new Error(`Source identity needs review: ${entry.recordId}.`);
  }
  for (const record of snapshot.records) for (const observation of record.observations) {
    const metric = EXPANSION_METRICS.find(metric => metric.id === observation.metricId);
    if (!metric || metric.datasetId !== record.datasetId || metric.benchmarkVersion !== observation.benchmarkVersion
      || (observation.rawValue !== null && !Number.isFinite(observation.rawValue))) throw new Error('Unregistered version or invalid expansion score.');
  }
  return { datasets: snapshot.datasets.length, sourceRecords: snapshot.records.length,
    reviewedMappings: manifest.entries.length, reviewedTargets: manifest.entries.reduce((n, entry) => n + entry.targets.length, 0) };
}
