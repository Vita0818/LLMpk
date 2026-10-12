export const VALS_ORIGIN = 'https://www.vals.ai';

/** Current Vals Index and its standalone components; index subsets stay separate. */
export const VALS_BENCHMARK_SLUGS = [
  'vals_index', 'fabv2', 'emb', 'vibe-code', 'code-migration',
  'terminal-bench-4', 'legal_research', 'hlab', 'tax_agent_bench',
];

function decodeHtmlAttribute(value) {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/giu, entity => {
    const named = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
    if (named[entity]) return named[entity];
    const hexadecimal = entity.startsWith('&#x');
    const code = Number.parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
    return String.fromCodePoint(code);
  });
}

/** Read the JSON URL used by the page itself, without executing its scripts. */
export function extractValsBenchmarkReferences(html) {
  const urls = [];
  for (const match of html.matchAll(/<astro-island\b[^>]*>/gu)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/gu)]
      .map(([, name, value]) => [name, decodeHtmlAttribute(value)]));
    if (!/^\/_astro\/BenchmarkViewLoader[.\w-]*\.js$/u.test(attributes['component-url'] ?? '')) continue;
    const props = JSON.parse(attributes.props ?? '{}');
    const encoded = props.benchmarkViewUrl;
    if (!Array.isArray(encoded) || encoded[0] !== 0 || encoded.length !== 2
      || typeof encoded[1] !== 'string'
      || !/^\/_astro\/benchmark_view_[\w.-]+\.json$/u.test(encoded[1])) {
      throw new Error('Vals page has an unsupported benchmark JSON reference.');
    }
    urls.push({ dataUrl: new URL(encoded[1], VALS_ORIGIN).href,
      loaderUrl: new URL(attributes['component-url'], VALS_ORIGIN).href });
  }
  if (urls.length !== 1) throw new Error('Vals page must identify exactly one benchmark JSON file.');
  return urls[0];
}

export function extractValsBenchmarkViewUrl(html) {
  return extractValsBenchmarkReferences(html).dataUrl;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateValsBenchmarkPayload(payload, slug, { minimumRows = 10, now = new Date().toISOString() } = {}) {
  const metadata = payload?.metadata;
  if (!isRecord(metadata) || metadata.slug !== slug || !isRecord(payload.tasks)
    || !isRecord(metadata.tasks) || !isRecord(payload.tasks.overall)
    || typeof metadata.benchmark !== 'string' || !metadata.benchmark.trim()
    || !Array.isArray(metadata.models) || metadata.models.length < minimumRows
    || metadata.models.some(id => typeof id !== 'string' || !id.trim())
    || new Set(metadata.models).size !== metadata.models.length
    || metadata.total_models !== metadata.models.length) {
    throw new Error(`Incomplete or changed Vals benchmark identity: ${slug}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(metadata.updated ?? '')
    || !Number.isFinite(Date.parse(metadata.updated))
    || new Date(metadata.updated).toISOString().slice(0, 10) !== metadata.updated
    || Date.parse(metadata.updated) > Date.parse(now) + 86_400_000) {
    throw new Error(`Invalid Vals source update date: ${slug}.`);
  }
  const models = new Set(metadata.models);
  let observedRows = 0;
  for (const [task, rows] of Object.entries(payload.tasks)) {
    if (!Object.hasOwn(metadata.tasks, task) || !isRecord(rows)) {
      throw new Error(`Unidentified Vals task table: ${slug}/${task}.`);
    }
    for (const [model, row] of Object.entries(rows)) {
      if (!models.has(model) || !isRecord(row) || !Object.hasOwn(row, 'accuracy')) {
        throw new Error(`Invalid Vals model record: ${slug}/${task}/${model}.`);
      }
      if (row.accuracy !== null && typeof row.accuracy !== 'number') {
        throw new Error(`Invalid Vals accuracy: ${slug}/${task}/${model}.`);
      }
      for (const field of ['accuracy', 'stderr', 'latency', 'cost_per_test']) {
        const value = row[field];
        if (value === null || value === undefined) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
          || ((field === 'accuracy' || field === 'stderr') && value > 100)) {
          throw new Error(`Invalid Vals ${field}: ${slug}/${task}/${model}.`);
        }
      }
      if (typeof row.accuracy === 'number') observedRows += 1;
    }
  }
  if (Object.keys(payload.tasks.overall).length < minimumRows || observedRows < minimumRows) {
    throw new Error(`Empty Vals results: ${slug}.`);
  }
  return { metadata, tasks: payload.tasks, observedRows };
}

/** Settings define a source execution. Scores, cost and elapsed time may refresh. */
export function valsExecutionIdentity(row) {
  return Object.fromEntries([
    'temperature', 'top_p', 'max_output_tokens', 'reasoning', 'reasoning_effort',
    'verbosity', 'compute_effort', 'provider', 'harness',
  ].map(key => [key, row[key] ?? null]));
}

export function valsProfileIdentity(row) {
  const value = row.compute_effort ?? row.reasoning_effort;
  const profiles = { default: ['Default', 0], none: ['None', 0], minimal: ['Minimal', 1],
    low: ['Low', 2], medium: ['Medium', 3], high: ['High', 4], xhigh: ['XHigh', 5], max: ['Max', 6] };
  if (value === null || value === undefined) return { label: 'Default', level: 0, disclosed: false };
  const match = profiles[String(value).toLowerCase()];
  return { label: match?.[0] ?? String(value), level: match?.[1] ?? null, disclosed: true };
}

export function validateReviewedValsRows(benchmarks, manifest) {
  if (manifest?.schemaVersion !== 'vals-reviewed-mappings/v1' || !Array.isArray(manifest.entries)) {
    throw new Error('Unsupported Vals reviewed mapping manifest.');
  }
  let reviewedRows = 0;
  const identities = new Set();
  const modelIds = new Set();
  const keys = new Set();
  for (const entry of manifest.entries) {
    if (typeof entry.modelId !== 'string' || typeof entry.key !== 'string'
      || !Array.isArray(entry.executions) || !Array.isArray(entry.targets)
      || modelIds.has(entry.modelId) || keys.has(entry.key)) throw new Error('Duplicate or invalid reviewed Vals model identity.');
    modelIds.add(entry.modelId);
    keys.add(entry.key);
    for (const execution of entry.executions) {
      const identity = JSON.stringify([entry.modelId, execution.benchmarkSlug, execution.task]);
      if (identities.has(identity)) throw new Error('Duplicate reviewed Vals source identity.');
      identities.add(identity);
      const benchmark = benchmarks.find(item => item.metadata.slug === execution.benchmarkSlug);
      const row = benchmark?.tasks[execution.task]?.[entry.modelId];
      if (!row || (benchmark.metadata.version ?? null) !== execution.benchmarkVersion
        || JSON.stringify(valsExecutionIdentity(row)) !== JSON.stringify(execution.settings)
        || JSON.stringify(valsProfileIdentity(row)) !== JSON.stringify(execution.profile)) {
        throw new Error(`Vals execution needs review: ${identity}. Published data was not replaced.`);
      }
      reviewedRows += 1;
    }
  }
  return { reviewedModels: manifest.entries.length, reviewedRows };
}

/** Keep publisher notices alongside numbers; no counterfactual scores are inferred. */
export function extractValsFallbackNotices(html) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gu)]
    .map(([, paragraph]) => decodeHtmlAttribute(paragraph.replace(/<[^>]+>/gu, ' ')).replace(/\s+/gu, ' ').trim())
    .filter(paragraph => /fallback model|provider refusal|refusal fallback/iu.test(paragraph));
}
