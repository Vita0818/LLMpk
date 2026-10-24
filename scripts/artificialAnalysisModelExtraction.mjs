import { extractJsonArraysAfterMarker, uniqueBy } from './sourceSnapshotUtils.mjs';

/** AA now publishes public display/creator identities instead of host aliases. */
export function hasPublishedCodingAgentModelIdentity(record) {
  return (typeof record?.hostModelSlug === 'string' && record.hostModelSlug.trim().length > 0)
    || (typeof record?.display?.agent === 'string' && record.display.agent.trim().length > 0
      && typeof record?.display?.model === 'string' && record.display.model.trim().length > 0
      && Array.isArray(record?.modelCreators) && record.modelCreators.length > 0
      && record.modelCreators.every(creator => typeof creator?.slug === 'string'
        && creator.slug.trim().length > 0 && typeof creator?.name === 'string' && creator.name.trim().length > 0));
}

function profileModelRecords(payload) {
  const roots = [];
  try { roots.push(JSON.parse(payload)); } catch { /* Flight uses framed JSON. */ }
  for (const line of payload.split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 0 || !/^[0-9a-f]+$/iu.test(line.slice(0, separator))) continue;
    const value = line.slice(separator + 1);
    if (!['[', '{'].includes(value[0])) continue;
    try { roots.push(JSON.parse(value)); } catch { /* Ignore non-JSON transport records. */ }
  }
  const records = [];
  const stack = [...roots];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    const model = value.currentModel;
    if (model && typeof model === 'object' && typeof model.slug === 'string'
      && typeof model.name === 'string' && Object.hasOwn(model, 'intelligenceIndex')) {
      records.push(model);
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return records;
}

/** Join only publisher-provided model/release identities; never infer dates. */
export function detailedModelRecords(payload) {
  // The October leaderboard sends the complete detailed table as
  // `initialModels`; `models` still carries the separate release identities.
  // Keep both published transports for current and archived captures.
  const arrays = ['"models":', '"initialModels":']
    .flatMap((marker) => extractJsonArraysAfterMarker(payload, marker));
  const candidates = arrays
    .map((records) => records.filter((record) => (
      record
      && typeof record === 'object'
      && !Array.isArray(record)
      && typeof record.slug === 'string'
      && typeof record.name === 'string'
      && Object.hasOwn(record, 'intelligenceIndex')
    )))
    .sort((left, right) => right.length - left.length);
  const records = [...(candidates[0] ?? [])];
  // Profile comparisons refer to the page's own model with a Flight string.
  // Read the separately published object instead of resolving/evaluating it.
  for (const record of profileModelRecords(payload)) {
    if (!records.some(candidate => candidate.slug === record.slug)) records.push(record);
  }
  if (records.length < 100) {
    throw new Error('AA model leaderboard did not expose a complete detailed model array.');
  }
  const identities = arrays.find((records) => (
    records.length >= (candidates[0]?.length ?? 0)
    && records.every((record) => (
      typeof record?.slug === 'string'
      && typeof record?.name === 'string'
      && (typeof record?.creator?.name === 'string' || typeof record?.releaseSlug === 'string')
    ))
  )) || [];
  const identityBySlug = new Map(identities.map((record) => [record.slug, record]));
  // Since October 2026, model options carry releaseSlug and the separate
  // releases table owns releaseDate/creator. The relation is explicit even
  // when an effort-specific model slug differs from its release slug.
  const releases = extractJsonArraysAfterMarker(payload, '"releases":')
    .filter((records) => records.length > 0 && records.every((record) => (
      typeof record?.slug === 'string'
      && typeof record?.name === 'string'
      && typeof record?.creator?.name === 'string'
    )))
    .sort((left, right) => right.length - left.length)[0] || [];
  const releaseBySlug = new Map(
    uniqueBy(releases, (record) => record.slug, 'AA model releases')
      .map((record) => [record.slug, record]),
  );
  return uniqueBy(records.map((record) => {
    const identity = identityBySlug.get(record.slug);
    const releaseSlug = record.releaseSlug ?? record.release?.slug ?? identity?.releaseSlug;
    const release = releaseBySlug.get(releaseSlug);
    const creator = record.creator ?? identity?.creator ?? release?.creator;
    const creatorName = record.modelCreatorName || creator?.name;
    if (!creatorName) throw new Error('AA model has no publisher identity.');
    const performanceFields = {
      medianOutputTokensPerSecond: ['timescaleData.medianOutputSpeed', record.timescaleData?.medianOutputSpeed],
      medianTimeToFirstTokenSeconds: ['timescaleData.medianTimeToFirstChunk', record.timescaleData?.medianTimeToFirstChunk],
      medianTimeToFirstAnswerTokenSeconds: ['timeToFirstAnswerToken.total', record.timeToFirstAnswerToken?.total],
      medianEndToEndResponseTimeSeconds: ['endToEndResponseTime.total', record.endToEndResponseTime?.total],
      itbenchSre: ['itBenchSre', record.itBenchSre],
    };
    const normalized = {};
    const sourceFieldPaths = {};
    for (const [field, [sourceField, value]] of Object.entries(performanceFields)) {
      if (!Object.hasOwn(record, field) && value !== undefined) {
        normalized[field] = value;
        sourceFieldPaths[field] = sourceField;
      }
    }
    return {
      ...record,
      ...normalized,
      ...(Object.keys(sourceFieldPaths).length ? { sourceFieldPaths } : {}),
      id: record.slug,
      releaseDate: record.releaseDate ?? identity?.releaseDate ?? release?.releaseDate ?? null,
      ...(releaseSlug ? { releaseSlug } : {}),
      modelCreatorId: record.modelCreatorId ?? creator?.id ?? null,
      modelCreatorName: creatorName,
      modelCreatorSlug: record.modelCreatorSlug ?? creator?.slug
        ?? creatorName.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ''),
      terminalbenchV21: record.terminalbenchV21 ?? record.terminalBench21 ?? null,
    };
  }), (record) => record.id, 'AA model leaderboard');
}

const ATOMIC_BENCHMARK_FIELDS = [
  'hle', 'gpqa', 'critpt', 'scicode', 'lcr', 'ifbench', 'tauBanking',
  'terminalBench40', 'apexAgents', 'mmmuPro',
];

/** Supplement the current-only transport with the official full comparison.
 * Current nulls remain null; every field keeps its actual public page. */
export function mergePublishedModelRecords(primary, comparison, { primaryPage, comparisonPage }) {
  const byId = new Map(comparison.map(record => [record.id, {
    ...record, sourcePageId: comparisonPage.id, sourcePageUrl: comparisonPage.url,
  }]));
  for (const record of primary) {
    const existing = byId.get(record.id);
    if (existing?.releaseDate && record.releaseDate && existing.releaseDate !== record.releaseDate) {
      throw new Error(`AA comparison model release changed: ${record.slug}`);
    }
    for (const field of ATOMIC_BENCHMARK_FIELDS) {
      if (typeof existing?.[field] === 'number' && typeof record[field] === 'number'
        && Math.abs(existing[field] - record[field]) > 1e-12) {
        throw new Error(`Conflicting official AA ${field} scores: ${record.slug}`);
      }
    }
    const supplementalProvenance = {};
    for (const field of [...ATOMIC_BENCHMARK_FIELDS, 'medianOutputTokensPerSecond',
      'medianTimeToFirstTokenSeconds', 'price1mInputTokens', 'price1mOutputTokens', 'itbenchSre']) {
      if (existing && Object.hasOwn(existing, field) && !Object.hasOwn(record, field)) {
        supplementalProvenance[field] = { sourcePageId: comparisonPage.id,
          sourcePageUrl: comparisonPage.url,
          sourceField: existing.sourceFieldPaths?.[field] ?? field };
      }
    }
    byId.set(record.id, {
      ...existing, ...record,
      sourcePageId: primaryPage.id, sourcePageUrl: primaryPage.url,
      sourceFieldPaths: { ...existing?.sourceFieldPaths, ...record.sourceFieldPaths },
      sourceFieldProvenance: supplementalProvenance,
    });
  }
  return [...byId.values()];
}
