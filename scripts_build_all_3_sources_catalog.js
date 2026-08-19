/**
 * Rebuild the production source-card catalog from the three published sources.
 *
 * This script deliberately never calculates a benchmark value.  A value is
 * emitted only when the upstream payload contains that numeric field and the
 * emitted observation keeps both a record URL and a leaderboard provenance
 * URL.  Missing source fields remain missing.
 *
 * Usage: node scripts_build_all_3_sources_catalog.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(
  process.env.SOURCE_CATALOG_OUTPUT_PATH
    ?? path.join(ROOT, 'src', 'data', 'seedCards.ts'),
);
const ARENA_RAW_PATH = path.join(ROOT, 'src', 'data', 'arenaRawExtraction.json');
const OAGXM_SCOPE_PATH = path.join(ROOT, 'src', 'data', 'oagxmScope.json');
const SOURCE_PROFILE_ALIASES_PATH = path.join(ROOT, 'src', 'data', 'sourceProfileAliases.json');
const ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH = path.join(ROOT, 'src', 'data', 'artificialAnalysisSourceSnapshot.json');
const OPENROUTER_SUPPLEMENTAL_SNAPSHOT_PATH = path.join(ROOT, 'src', 'data', 'openRouterOfficialSupplementalSnapshot.json');
const OPENROUTER_PERFORMANCE_SNAPSHOT_PATH = path.resolve(
  process.env.OPENROUTER_PERFORMANCE_SNAPSHOT_PATH
    ?? path.join(ROOT, 'src', 'data', 'openRouterPerformanceSnapshot.json'),
);
const SNAPSHOT_DATE = new Date().toISOString().slice(0, 10);

const AA_LEADERBOARD_URL = 'https://artificialanalysis.ai/leaderboards/models';
const OPENROUTER_CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const SOURCE_CATALOG_SCOPE_ID = 'llmpk-source-catalog';
const SOURCE_CATALOG_SCOPE_VERSION = 'v1';

const AA_METRICS = [
  { id: 'aa_hle', field: (model) => model.hle, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/humanitys-last-exam', sourceField: 'hle' },
  { id: 'aa_gpqa_diamond', field: (model) => model.gpqa, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/gpqa-diamond', sourceField: 'gpqa' },
  { id: 'aa_critpt', field: (model) => model.critpt, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/critpt', sourceField: 'critpt' },
  { id: 'aa_scicode', field: (model) => model.scicode, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/scicode', sourceField: 'scicode' },
  { id: 'aa_gdpval_v2', field: (model) => model.gdpvalBreakdown?.elo, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/gdpval-aa', sourceField: 'gdpvalBreakdown.elo' },
  { id: 'aa_terminalbench_v21', field: (model) => model.terminalbenchV21, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/terminalbench-v2-1', sourceField: 'terminalbenchV21' },
  { id: 'aa_tau3_banking', field: (model) => model.tauBanking, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/tau3-banking', sourceField: 'tauBanking' },
  { id: 'aa_omniscience_accuracy', field: (model) => model.omniscienceAccuracy, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/omniscience', sourceField: 'omniscienceAccuracy' },
  { id: 'aa_lcr', field: (model) => model.lcr, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning', sourceField: 'lcr' },
  { id: 'aa_omniscience_nonhallucination', field: (model) => model.omniscienceNonHallucination, sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/omniscience', sourceField: 'omniscienceNonHallucination' },
];

const AA_DETAIL_ONLY_METRICS = [
  {
    id: 'aa_ifbench',
    pageId: 'model-leaderboard',
    field: (record) => record?.ifbench,
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/ifbench',
    sourceField: 'ifbench',
  },
  {
    id: 'aa_apex_agents',
    pageId: 'model-leaderboard',
    field: (record) => record?.apexAgents,
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/apex-agents',
    sourceField: 'apexAgents',
  },
  {
    id: 'aa_itbench_sre',
    pageId: 'model-leaderboard',
    field: (record) => record?.itbenchSre,
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/itbench',
    sourceField: 'itbenchSre',
  },
  {
    id: 'aa_mmmu_pro',
    pageId: 'model-leaderboard',
    field: (record) => record?.mmmuPro,
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/mmmu-pro',
    sourceField: 'mmmuPro',
  },
  {
    id: 'aa_briefcase',
    pageId: 'aa-briefcase',
    field: (record) => (
      record?.briefcaseElo
      ?? record?.briefcaseBreakdown?.elo
      ?? record?.briefcase?.elo
      ?? record?.briefcase_breakdown?.elo
    ),
    unit: 'Elo',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/aa-briefcase',
    sourceField: 'briefcaseElo | briefcaseBreakdown.elo | briefcase.elo | briefcase_breakdown.elo',
  },
  {
    id: 'aa_automationbench',
    pageId: 'automationbench-aa',
    field: (record) => (
      record?.automationBenchBreakdown?.strictScore
      ?? record?.automationBenchBreakdown?.summary?.strictScore
      ?? record?.automation_bench_breakdown?.summary?.strict_score
    ),
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/automationbench-aa',
    sourceField: 'automationBenchBreakdown.strictScore | automationBenchBreakdown.summary.strictScore | automation_bench_breakdown.summary.strict_score',
  },
  {
    id: 'aa_harvey_lab',
    pageId: 'harvey-lab-aa',
    field: (record) => (
      record?.harveyLabCriteriaPass
      ?? record?.harveyLabBreakdown?.criteriaPass
      ?? record?.harvey_lab_breakdown?.criteria_pass
    ),
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/harvey-lab-aa',
    sourceField: 'harveyLabCriteriaPass | harveyLabBreakdown.criteriaPass | harvey_lab_breakdown.criteria_pass',
  },
  {
    id: 'aa_enterprise_ops_gym',
    pageId: 'enterprise-ops-gym-aa',
    field: (record) => (
      record?.enterpriseOpsGym
      ?? record?.enterpriseOpsGymBreakdown?.summary?.successRate
      ?? record?.enterprise_ops_gym_breakdown?.summary?.success_rate
    ),
    unit: 'ratio',
    sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa',
    sourceField: 'enterpriseOpsGym | enterpriseOpsGymBreakdown.summary.successRate | enterprise_ops_gym_breakdown.summary.success_rate',
  },
];

const AA_PRACTICAL_FALLBACK_METRICS = [
  {
    id: 'aa_price_input',
    pageId: 'model-leaderboard',
    field: (record) => record?.price1mInputTokens,
    unit: '$/1M tokens',
    sourceLeaderboard: AA_LEADERBOARD_URL,
    sourceField: 'price1mInputTokens',
  },
  {
    id: 'aa_price_output',
    pageId: 'model-leaderboard',
    field: (record) => record?.price1mOutputTokens,
    unit: '$/1M tokens',
    sourceLeaderboard: AA_LEADERBOARD_URL,
    sourceField: 'price1mOutputTokens',
  },
  {
    id: 'aa_ttft_median',
    pageId: 'model-leaderboard',
    field: (record) => record?.medianTimeToFirstTokenSeconds,
    unit: 'seconds',
    sourceLeaderboard: AA_LEADERBOARD_URL,
    sourceField: 'medianTimeToFirstTokenSeconds',
  },
  {
    id: 'aa_throughput_median',
    pageId: 'model-leaderboard',
    field: (record) => record?.medianOutputTokensPerSecond,
    unit: 'tokens/second',
    sourceLeaderboard: AA_LEADERBOARD_URL,
    sourceField: 'medianOutputTokensPerSecond',
  },
];

function loadArtificialAnalysisSourceSnapshot() {
  if (!fs.existsSync(ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH)) {
    throw new Error(
      `Missing structured Artificial Analysis snapshot: ${path.relative(ROOT, ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH)}.`,
    );
  }
  const snapshot = JSON.parse(fs.readFileSync(ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH, 'utf8'));
  if (
    snapshot?.schemaVersion !== 'artificial-analysis-source-snapshot/v1'
    || !Array.isArray(snapshot.modelRecords)
    || !snapshot.evaluationRecords
    || typeof snapshot.evaluationRecords !== 'object'
  ) {
    throw new Error('Structured Artificial Analysis snapshot is invalid.');
  }

  const recordsByPageAndModelId = new Map();
  const pageRecords = {
    'model-leaderboard': snapshot.modelRecords,
    ...snapshot.evaluationRecords,
  };
  for (const metric of [
    ...AA_DETAIL_ONLY_METRICS,
    ...AA_PRACTICAL_FALLBACK_METRICS,
  ]) {
    const records = pageRecords[metric.pageId];
    if (!Array.isArray(records)) {
      throw new Error(`Structured Artificial Analysis snapshot is missing ${metric.pageId}.`);
    }
    if (recordsByPageAndModelId.has(metric.pageId)) continue;
    const recordsByModelId = new Map();
    for (const record of records) {
      if (typeof record?.id !== 'string' || !record.id) continue;
      if (recordsByModelId.has(record.id)) {
        throw new Error(`Structured Artificial Analysis snapshot has duplicate ${metric.pageId} model ID ${record.id}.`);
      }
      recordsByModelId.set(record.id, record);
    }
    recordsByPageAndModelId.set(metric.pageId, recordsByModelId);
  }

  return {
    snapshotDate: typeof snapshot.fetchedAt === 'string'
      ? snapshot.fetchedAt.slice(0, 10)
      : SNAPSHOT_DATE,
    modelRecords: snapshot.modelRecords,
    recordsByPageAndModelId,
  };
}

function loadOagxmScope() {
  if (!fs.existsSync(OAGXM_SCOPE_PATH)) {
    throw new Error(`Missing versioned OAGXM scope: ${path.relative(ROOT, OAGXM_SCOPE_PATH)}.`);
  }
  const scope = JSON.parse(fs.readFileSync(OAGXM_SCOPE_PATH, 'utf8'));
  if (!scope || typeof scope.scopeId !== 'string' || typeof scope.schemaVersion !== 'string' || !Array.isArray(scope.vendors)) {
    throw new Error('OAGXM scope is not a valid versioned selector manifest.');
  }
  return scope;
}

const OAGXM_SCOPE = loadOagxmScope();

function loadSourceProfileAliases() {
  if (!fs.existsSync(SOURCE_PROFILE_ALIASES_PATH)) {
    throw new Error(`Missing reviewed source-profile aliases: ${path.relative(ROOT, SOURCE_PROFILE_ALIASES_PATH)}.`);
  }
  const manifest = JSON.parse(fs.readFileSync(SOURCE_PROFILE_ALIASES_PATH, 'utf8'));
  if (
    !manifest
    || manifest.schemaVersion !== 'source-profile-aliases/v1'
    || manifest.matchPolicy !== 'explicit-card-id-only'
    || !Array.isArray(manifest.groups)
  ) {
    throw new Error('Source-profile aliases must use the explicit-card-id-only v1 schema.');
  }

  const byCardId = new Map();
  for (const group of manifest.groups) {
    const canonicalProfileKey = String(group?.canonicalProfileKey || '').trim();
    if (!canonicalProfileKey || slugify(canonicalProfileKey) !== canonicalProfileKey) {
      throw new Error(`Invalid canonical source-profile key: ${canonicalProfileKey || '(empty)'}.`);
    }
    if (!Array.isArray(group.cardIds) || group.cardIds.length < 2) {
      throw new Error(`Reviewed alias ${canonicalProfileKey} must contain at least two exact card IDs.`);
    }
    const sourcePrefixes = new Set();
    for (const rawCardId of group.cardIds) {
      const cardId = String(rawCardId || '').trim();
      if (!/^card-(?:aa|arena|openrouter)-/u.test(cardId)) {
        throw new Error(`Reviewed alias ${canonicalProfileKey} has an invalid card ID: ${cardId || '(empty)'}.`);
      }
      const sourcePrefix = cardId.startsWith('card-aa-')
        ? 'artificial_analysis'
        : cardId.startsWith('card-arena-')
          ? 'arena'
          : 'openrouter';
      if (sourcePrefixes.has(sourcePrefix)) {
        throw new Error(`Reviewed alias ${canonicalProfileKey} contains more than one ${sourcePrefix} card.`);
      }
      sourcePrefixes.add(sourcePrefix);
      const previous = byCardId.get(cardId);
      if (previous && previous.canonicalProfileKey !== canonicalProfileKey) {
        throw new Error(`Source card ${cardId} is assigned to two reviewed aliases.`);
      }
      byCardId.set(cardId, {
        canonicalProfileKey,
        evidence: String(group.evidence || '').trim(),
      });
    }
    if (sourcePrefixes.size < 2) {
      throw new Error(`Reviewed alias ${canonicalProfileKey} must connect at least two sources.`);
    }
  }
  return { manifest, byCardId };
}

const SOURCE_PROFILE_ALIASES = loadSourceProfileAliases();

function normalizeScopeIdentity(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function classifyOagxmScope(...sourceIdentities) {
  const identity = sourceIdentities
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeScopeIdentity)
    .join('\n');
  if (!identity) return null;

  for (const vendor of OAGXM_SCOPE.vendors) {
    for (const productLine of vendor.productLines || []) {
      if (productLine.allowPreviewSourceRecords === false && /\bpreview\b/iu.test(identity)) continue;
      if (!(productLine.patterns || []).some((pattern) => new RegExp(pattern, 'iu').test(identity))) continue;
      return {
        scopeId: OAGXM_SCOPE.scopeId,
        scopeVersion: OAGXM_SCOPE.schemaVersion,
        vendorId: vendor.id,
        vendorName: vendor.name,
        productLineId: productLine.id,
        productLineName: productLine.name,
        tier: productLine.tier,
        rankingClass: productLine.rankingClass,
      };
    }
  }
  return null;
}

/**
 * Data.md is a configuration inventory, not the global model boundary.  Keep
 * its hand-authored product-line IDs when present, then preserve every other
 * source-published text-model profile in a distinct catalog scope.  The
 * profile ID is intentionally derived from the exact published label: it
 * does not erase thinking, search, Fast, Pro, custom-tools, or harness terms.
 */
function sourceCatalogProfileIdentity(...sourceIdentities) {
  const raw = sourceIdentities.find((value) => typeof value === 'string' && value.trim().length > 0);
  if (!raw) return 'unknown-model';
  const withoutProviderPrefix = String(raw)
    .normalize('NFKC')
    .trim()
    // OpenRouter presents names as "Provider: Model".  The provider prefix
    // is not part of the model/profile identity and would block an otherwise
    // exact cross-source match.
    .replace(/^[^:]{1,80}:\s*/u, '')
    // A plus suffix is a published model distinction (Command A vs A+,
    // Command R vs R+), not disposable punctuation.
    .replace(/\+/gu, ' plus ');
  return slugify(withoutProviderPrefix);
}

function canonicalSourceProfileKey(cardId, ...sourceIdentities) {
  return SOURCE_PROFILE_ALIASES.byCardId.get(cardId)?.canonicalProfileKey
    || sourceCatalogProfileIdentity(...sourceIdentities);
}

function sourceCatalogScope(cardId, ...sourceIdentities) {
  const rawName = sourceIdentities.find((value) => typeof value === 'string' && value.trim().length > 0)
    || 'Unknown source model';
  const canonicalProfileKey = canonicalSourceProfileKey(cardId, ...sourceIdentities);
  return {
    scopeId: SOURCE_CATALOG_SCOPE_ID,
    scopeVersion: SOURCE_CATALOG_SCOPE_VERSION,
    // A source-published profile can be independently observed by more than
    // one site.  Its exact profile key, rather than a guessed vendor alias,
    // is the guard used when cards are stacked.
    vendorId: 'source-catalog',
    vendorName: 'Cross-source catalog',
    productLineId: `source-profile-${canonicalProfileKey}`,
    productLineName: String(rawName).trim(),
    canonicalProfileKey,
    tier: 'official',
    rankingClass: 'formal_text_agent',
  };
}

function classifySourceModelScope(cardId, ...sourceIdentities) {
  const canonicalProfileKey = canonicalSourceProfileKey(cardId, ...sourceIdentities);
  const scope = classifyOagxmScope(...sourceIdentities);
  return scope
    ? { ...scope, canonicalProfileKey }
    : sourceCatalogScope(cardId, ...sourceIdentities);
}

function isValidCatalogScope(scope) {
  if (!scope || typeof scope !== 'object') return false;
  const isCurated = scope.scopeId === OAGXM_SCOPE.scopeId
    && scope.scopeVersion === OAGXM_SCOPE.schemaVersion;
  const isSourceCatalog = scope.scopeId === SOURCE_CATALOG_SCOPE_ID
    && scope.scopeVersion === SOURCE_CATALOG_SCOPE_VERSION
    && typeof scope.productLineId === 'string'
    && scope.productLineId.startsWith('source-profile-');
  return (isCurated || isSourceCatalog)
    && typeof scope.vendorId === 'string'
    && scope.vendorId.length > 0
    && typeof scope.productLineId === 'string'
    && scope.productLineId.length > 0
    && typeof scope.canonicalProfileKey === 'string'
    && scope.canonicalProfileKey.length > 0;
}

function hasExpectedSourceVendor(scopeMatch, source, ...sourceIdentities) {
  if (scopeMatch?.scopeId === SOURCE_CATALOG_SCOPE_ID) return true;
  const expected = {
  openai: [/^openai$/, /^openai\//],
  anthropic: [/^anthropic$/, /^anthropic\//],
  google: [/^google(?: deepmind)?$/, /^google\//],
  cohere: [/^cohere(?: inc[.]?)?$/i, /^cohere\//i],
  thinking_machines: [/^thinking machines(?: lab)?$/i, /^thinkingmachines\//i],
  xai: [/^xai$/, /^x-ai\//],
  meta: [/^meta$/, /^meta(?:-llama)?\//],
  deepseek: [/^deepseek(?: ai)?$/i, /^deepseek\//i],
  zai: [/^(?:z[.]?ai|zhipu(?: ai)?)$/i, /^(?:z-ai|zhipu)\//i],
  tencent: [/^(?:tencent|tencent hunyuan|gmicloud)$/i, /^(?:tencent|hunyuan|gmicloud)\//i],
  moonshot: [/^(?:moonshot(?: ai)?|kimi)$/i, /^moonshot(?:ai)?\//i],
  minimax: [/^minimax$/i, /^minimax\//i],
  alibaba: [/^(?:alibaba(?: cloud)?|qwen)$/i, /^(?:alibaba|qwen)\//i],
  bytedance: [/^(?:bytedance|volcengine|seed)$/i, /^(?:bytedance|volcengine|seed)\//i],
  meituan: [/^(?:meituan|meituan longcat)$/i, /^meituan\//i],
  kwaipilot: [/^(?:kwaipilot|kwai)$/i, /^(?:kwaipilot|kwai)\//i],
  xiaomi: [/^xiaomi$/i, /^xiaomi\//i],
  stepfun: [/^(?:stepfun|step fun)$/i, /^stepfun\//i],
  mistral: [/^(?:mistral|mistral ai)$/i, /^mistral(?:ai)?\//i],
  nvidia: [/^(?:nvidia|nvidia corporation)$/i, /^nvidia\//i],
};
  const matchers = expected[scopeMatch.vendorId] || [];

  // Arena does not publish a reliable vendor field in every leaderboard row.
  // Its explicit, versioned product-line selectors remain the identity proof.
  if (source === 'arena') return true;
  return sourceIdentities
    .map(normalizeScopeIdentity)
    .some((normalized) => matchers.some((matcher) => matcher.test(normalized)));
}

// OpenRouter exposes route aliases alongside canonical published models.  They
// can have a different price but are not a distinct model or product line, so
// keeping them would double-count a model under the same source.  We retain
// named execution profiles such as `-pro`, `-fast`, `-custom-tools`, etc.
function isCanonicalOpenRouterModelRecordId(value) {
  const id = normalizeScopeIdentity(value);
  return id.length > 0
    && !id.startsWith('~')
    && !/(?:^|[-/])latest$/.test(id);
}

/** Keep only text-capable models in the general LLM catalog. */
function isGeneralTextOpenRouterModel(model) {
  const inputModalities = model?.architecture?.input_modalities;
  const outputModalities = model?.architecture?.output_modalities;
  const identity = `${model?.id || ''}\n${model?.name || ''}`.toLocaleLowerCase('en-US');
  // Keep general-purpose language / multimodal foundation models, but do not
  // turn image, video, speech, embedding, safety, or routing products into
  // capability-leaderboard entries merely because they accept text prompts.
  if (/\b(?:image|video|speech|audio|tts|transcri(?:be|ption)|embedding|moderation|safeguard|guard|music|lyria|router)\b/iu.test(identity)) {
    return false;
  }
  // Older official snapshots did not expose architecture. Retain those
  // records rather than fabricating an exclusion decision from their name.
  if (!Array.isArray(inputModalities) || !Array.isArray(outputModalities)) return true;
  return inputModalities.includes('text')
    && outputModalities.length > 0
    && outputModalities.every((modality) => modality === 'text');
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function asFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'LLMpk verified-source-rebuild/1.0' },
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status}): ${url}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'LLMpk verified-source-rebuild/1.0' },
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status}): ${url}`);
  return response.json();
}

function readOfficialSnapshotFromEnvironment(variableName, parser) {
  const filepath = process.env[variableName];
  if (!filepath) return null;
  if (!fs.existsSync(filepath)) {
    throw new Error(`${variableName} points to a missing official source snapshot: ${filepath}`);
  }
  return parser(fs.readFileSync(filepath, 'utf8'));
}

async function loadOfficialSourceInputs() {
  const aaSnapshot = readOfficialSnapshotFromEnvironment('AA_LEADERBOARD_SNAPSHOT_PATH', (value) => value);
  const openRouterSnapshot = readOfficialSnapshotFromEnvironment('OPENROUTER_MODELS_SNAPSHOT_PATH', JSON.parse);
  let aaHtml = aaSnapshot;
  let openRouterPayload = openRouterSnapshot;
  let aaError = null;
  let openRouterError = null;

  if (!aaHtml && !fs.existsSync(ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH)) {
    try {
      aaHtml = await fetchText(AA_LEADERBOARD_URL);
    } catch (error) {
      aaError = error instanceof Error ? error.message : String(error);
    }
  }
  if (!openRouterPayload) {
    try {
      openRouterPayload = await fetchJson(OPENROUTER_CATALOG_URL);
    } catch (error) {
      openRouterError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    aaHtml,
    openRouterPayload,
    aaError,
    openRouterError,
    aaInputMode: aaSnapshot
      ? 'official-aa-local-snapshot'
      : fs.existsSync(ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH)
        ? 'official-aa-structured-snapshot'
        : 'official-aa-live',
    openRouterInputMode: openRouterSnapshot ? 'official-openrouter-local-snapshot' : 'official-openrouter-live',
  };
}

function loadOpenRouterSupplementalSnapshot() {
  if (!fs.existsSync(OPENROUTER_SUPPLEMENTAL_SNAPSHOT_PATH)) return [];
  const snapshot = JSON.parse(fs.readFileSync(OPENROUTER_SUPPLEMENTAL_SNAPSHOT_PATH, 'utf8'));
  if (!Array.isArray(snapshot.data)) {
    throw new Error(`OpenRouter supplemental snapshot is invalid: ${path.relative(ROOT, OPENROUTER_SUPPLEMENTAL_SNAPSHOT_PATH)}.`);
  }
  return snapshot.data;
}

function loadOpenRouterPerformanceSnapshot() {
  if (!fs.existsSync(OPENROUTER_PERFORMANCE_SNAPSHOT_PATH)) return [];
  const snapshot = JSON.parse(fs.readFileSync(OPENROUTER_PERFORMANCE_SNAPSHOT_PATH, 'utf8'));
  const stabilizedSchema = snapshot?.schemaVersion === 'openrouter-performance-snapshot/v2';
  if (
    (
      snapshot?.schemaVersion !== 'openrouter-performance-snapshot/v1'
      && !stabilizedSchema
    )
    || !Array.isArray(snapshot.records)
    || !Array.isArray(snapshot.failures)
  ) {
    throw new Error(`OpenRouter performance snapshot is invalid: ${path.relative(ROOT, OPENROUTER_PERFORMANCE_SNAPSHOT_PATH)}.`);
  }
  if (snapshot.failures.length > 0) {
    throw new Error('OpenRouter performance snapshot contains transient fetch failures and cannot be treated as complete.');
  }

  const aggregates = Array.isArray(snapshot.modelAggregates)
    ? snapshot.modelAggregates
    : [];
  if (aggregates.length === 0) {
    throw new Error('OpenRouter performance snapshot has no provider-neutral model aggregates.');
  }

  const aggregatesByModelId = new Map();
  for (const aggregate of aggregates) {
    const inputPrice = asFiniteNumber(
      aggregate?.measures?.inputPricePerToken?.arithmeticMean,
    );
    const outputPrice = asFiniteNumber(
      aggregate?.measures?.outputPricePerToken?.arithmeticMean,
    );
    const latencyMilliseconds = asFiniteNumber(
      aggregate?.measures?.timeToFirstTokenMilliseconds?.arithmeticMean,
    );
    const throughputTokensPerSecond = asFiniteNumber(
      aggregate?.measures?.outputSpeedTokensPerSecond?.arithmeticMean,
    );
    if (
      typeof aggregate?.modelId !== 'string'
      || aggregate.variant !== 'standard'
      || !Number.isInteger(aggregate.endpointCount)
      || aggregate.endpointCount < 1
      || !Number.isInteger(aggregate.providerCount)
      || aggregate.providerCount < 1
      || inputPrice === null
      || outputPrice === null
      || latencyMilliseconds === null
      || throughputTokensPerSecond === null
      || typeof aggregate.sourcePageUrl !== 'string'
      || !Array.isArray(aggregate.sourceUrls)
      || aggregate.sourceUrls.length === 0
    ) {
      throw new Error(`OpenRouter Standard model aggregate is incomplete for ${aggregate?.modelId ?? 'unknown model'}.`);
    }
    if (aggregatesByModelId.has(aggregate.modelId)) {
      throw new Error(`OpenRouter performance snapshot has duplicate aggregate for ${aggregate.modelId}.`);
    }
    aggregatesByModelId.set(aggregate.modelId, {
      ...aggregate,
      snapshotDate: typeof snapshot.fetchedAt === 'string'
        ? snapshot.fetchedAt.slice(0, 10)
        : SNAPSHOT_DATE,
      inputPricePerToken: inputPrice,
      outputPricePerToken: outputPrice,
      latencyMilliseconds,
      throughputTokensPerSecond,
      speedMeasurementMethod: stabilizedSchema
        ? '3d/1w stabilized endpoint medians, followed by an equal-weight mean across current OpenRouter Standard endpoints'
        : 'equal-weight mean of current-window p50 values across OpenRouter Standard endpoints',
      speedStabilizationVersion: stabilizedSchema
        ? snapshot?.selectionPolicy?.speedStabilization?.algorithmVersion ?? null
        : null,
    });
  }
  return [...aggregatesByModelId.values()];
}

function getNextFlightPayload(html) {
  const chunks = [];
  const pushPattern = /self\.__next_f\.push\(\[1,\s*"(.*?)"\]\)/gs;
  let match;
  while ((match = pushPattern.exec(html)) !== null) chunks.push(match[1]);
  if (chunks.length === 0) throw new Error('Artificial Analysis page did not contain a readable Next payload.');
  return chunks.join('').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function findJsonObjectEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function extractArtificialAnalysisModels(html) {
  const payload = getNextFlightPayload(html);
  const modelsBySlug = new Map();
  let cursor = 0;
  while ((cursor = payload.indexOf('{"id":', cursor)) !== -1) {
    const end = findJsonObjectEnd(payload, cursor);
    if (end === -1) break;
    try {
      const candidate = JSON.parse(payload.slice(cursor, end));
      const hasBenchmarkField = ['hle', 'gpqa', 'critpt', 'scicode', 'lcr', 'omniscienceAccuracy']
        .some((field) => Object.hasOwn(candidate, field));
      if (
        typeof candidate.id === 'string' &&
        typeof candidate.slug === 'string' &&
        typeof candidate.name === 'string' &&
        typeof candidate.modelCreatorName === 'string' &&
        hasBenchmarkField
      ) {
        modelsBySlug.set(candidate.slug, candidate);
      }
    } catch {
      // The payload contains non-model JSON fragments too. They are not source records.
    }
    cursor = end;
  }
  if (modelsBySlug.size === 0) throw new Error('No Artificial Analysis model records could be extracted.');
  return [...modelsBySlug.values()];
}

function requireSourceEvidence(record, context) {
  if (!record.sourceUrl && !record.sourceLeaderboard) {
    throw new Error(`${context} has no sourceUrl or sourceLeaderboard.`);
  }
}

function betterArenaRow(candidate, incumbent) {
  const candidateRank = asFiniteNumber(candidate.rank ?? candidate.sourceRecord?.rank);
  const incumbentRank = asFiniteNumber(incumbent.rank ?? incumbent.sourceRecord?.rank);
  if (candidateRank !== null && incumbentRank !== null && candidateRank !== incumbentRank) {
    return candidateRank < incumbentRank;
  }
  if (candidateRank !== null && incumbentRank === null) return true;
  if (candidateRank === null && incumbentRank !== null) return false;

  const candidateVotes = asFiniteNumber(candidate.votes ?? candidate.voteCount ?? candidate.observationCount ?? candidate.sourceRecord?.votes);
  const incumbentVotes = asFiniteNumber(incumbent.votes ?? incumbent.voteCount ?? incumbent.observationCount ?? incumbent.sourceRecord?.votes);
  if (candidateVotes !== null && incumbentVotes !== null && candidateVotes !== incumbentVotes) {
    return candidateVotes > incumbentVotes;
  }
  return (candidate.__sourceOrder ?? Number.MAX_SAFE_INTEGER) < (incumbent.__sourceOrder ?? Number.MAX_SAFE_INTEGER);
}

function writeCatalog(cards, observations) {
  const output = `// Verified OAGXM source catalog. Rebuild with: node scripts_build_all_3_sources_catalog.js\n// Every observation is copied from an upstream source record; this module contains no calculated benchmark values.\n\nexport const VERIFIED_SOURCE_MODEL_CARDS: string = ${JSON.stringify(JSON.stringify(cards))};\n\nexport const VERIFIED_SOURCE_OBSERVATIONS: string = ${JSON.stringify(JSON.stringify(observations))};\n`;
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
}

function findJsonStringEnd(source, openingIndex) {
  let escaped = false;
  for (let index = openingIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '"') {
      return index;
    }
  }
  throw new Error('Unterminated verified catalog JSON string.');
}

function parseVerifiedCatalogExport(source, exportName) {
  const declaration = source.indexOf(`export const ${exportName}`);
  if (declaration === -1) throw new Error(`Missing ${exportName} in verified catalog snapshot.`);
  const assignment = source.indexOf('=', declaration);
  const opening = source.indexOf('"', assignment);
  if (opening === -1) throw new Error(`Missing JSON string for ${exportName}.`);
  const closing = findJsonStringEnd(source, opening);
  return JSON.parse(JSON.parse(source.slice(opening, closing + 1)));
}

function printCatalogSummary(cards, observations, inputMode) {
  const countFor = (source) => ({
    cards: cards.filter((card) => card.source === source).length,
    observations: observations.filter((observation) => observation.sourceModelCardId.startsWith(`card-${source === 'artificial_analysis' ? 'aa' : source}-`)).length,
  });
  const scopeCounts = {};
  for (const card of cards) {
    const scope = card.metadataJson?.scope;
    const scopeKey = `${scope.vendorId}:${scope.productLineId}`;
    scopeCounts[scopeKey] = (scopeCounts[scopeKey] || 0) + 1;
  }
  console.log(JSON.stringify({
    status: 'VALIDATED_SOURCE_CATALOG',
    inputMode,
    snapshotDate: SNAPSHOT_DATE,
    totalCards: cards.length,
    totalObservations: observations.length,
    scope: {
      scopeId: OAGXM_SCOPE.scopeId,
      scopeVersion: OAGXM_SCOPE.schemaVersion,
      sourceCardsByProductLine: scopeCounts,
    },
    artificialAnalysis: countFor('artificial_analysis'),
    arena: countFor('arena'),
    openRouter: countFor('openrouter'),
    output: path.relative(ROOT, OUTPUT_PATH),
  }, null, 2));
}

function rebuildFromVerifiedCatalogSnapshot() {
  const source = fs.readFileSync(OUTPUT_PATH, 'utf8');
  const rawCards = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_MODEL_CARDS');
  const rawObservations = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_OBSERVATIONS');
  if (!Array.isArray(rawCards) || !Array.isArray(rawObservations)) {
    throw new Error('The existing verified catalog snapshot is not an array catalog.');
  }

  const scopedCards = [];
  const scopeByCardId = new Map();
  for (const rawCard of rawCards) {
    const metadata = rawCard.metadataJson && typeof rawCard.metadataJson === 'object' ? rawCard.metadataJson : {};
    const sourceRecordId = Array.isArray(metadata.sourceRecordIds) ? metadata.sourceRecordIds[0] : metadata.sourceRecordId;
    if (rawCard.source === 'openrouter' && !isCanonicalOpenRouterModelRecordId(sourceRecordId)) continue;
    const scope = classifySourceModelScope(rawCard.id, rawCard.exactSourceModelName, sourceRecordId);
    if (!scope) continue;
    if (rawCard.source === 'openrouter' && !hasExpectedSourceVendor(scope, 'openrouter', sourceRecordId)) continue;

    const sourceIdentity = {
      source: rawCard.source,
      sourceRecordId: sourceRecordId || null,
      exactSourceModelName: rawCard.exactSourceModelName,
      canonicalProfileKey: scope.canonicalProfileKey,
      selectionMethod: 'verified-source-catalog snapshot; explicit OAGXM product-line selector',
    };
    scopedCards.push({
      ...rawCard,
      metadataJson: {
        ...metadata,
        scope,
        sourceIdentity,
      },
    });
    scopeByCardId.set(rawCard.id, scope);
  }

  const scopedCardIds = new Set(scopedCards.map((card) => card.id));
  const seenObservationSlots = new Set();
  const scopedObservations = [];
  for (const rawObservation of rawObservations) {
    const scope = scopeByCardId.get(rawObservation.sourceModelCardId);
    if (!scope || !scopedCardIds.has(rawObservation.sourceModelCardId)) continue;
    const slot = `${rawObservation.sourceModelCardId}:${rawObservation.metricId}`;
    if (seenObservationSlots.has(slot)) {
      throw new Error(`Verified snapshot has duplicate observation slot while rebuilding scope: ${slot}`);
    }
    seenObservationSlots.add(slot);
    const metadata = rawObservation.metadataJson && typeof rawObservation.metadataJson === 'object' ? rawObservation.metadataJson : {};
    scopedObservations.push({
      ...rawObservation,
      metadataJson: {
        ...metadata,
        scope,
      },
    });
  }

  if (scopedCards.length === 0 || scopedObservations.length === 0) {
    throw new Error('Verified snapshot fallback selected no OAGXM cards or observations.');
  }
  scopedCards.sort((left, right) => left.source.localeCompare(right.source) || left.id.localeCompare(right.id));
  scopedObservations.sort((left, right) => left.sourceModelCardId.localeCompare(right.sourceModelCardId) || left.metricId.localeCompare(right.metricId));
  writeCatalog(scopedCards, scopedObservations);
  printCatalogSummary(scopedCards, scopedObservations, 'verified-source-catalog-snapshot');
}

async function buildVerifiedCatalog() {
  if (!fs.existsSync(ARENA_RAW_PATH)) {
    throw new Error(`Missing ${path.relative(ROOT, ARENA_RAW_PATH)}. Run the Arena raw extraction before rebuilding the catalog.`);
  }

  const sourceInputs = await loadOfficialSourceInputs();
  const { aaHtml, openRouterPayload } = sourceInputs;
  const artificialAnalysisSourceSnapshot = loadArtificialAnalysisSourceSnapshot();
  const allowVerifiedCatalogFallback = process.env.OAGXM_ALLOW_VERIFIED_CATALOG_SNAPSHOT === '1';
  const hasStructuredAaSnapshot = artificialAnalysisSourceSnapshot.modelRecords.length > 0;
  const useVerifiedAaSnapshot = !hasStructuredAaSnapshot
    && !aaHtml
    && allowVerifiedCatalogFallback;
  if (!hasStructuredAaSnapshot && !aaHtml && !useVerifiedAaSnapshot) {
    throw new Error(`Artificial Analysis refresh failed: ${sourceInputs.aaError}`);
  }
  if (useVerifiedAaSnapshot) {
    console.warn(`Official AA refresh unavailable; retaining only already verified AA source records while rebuilding Arena and OpenRouter: ${sourceInputs.aaError}`);
  }
  const catalogInputModes = [
    hasStructuredAaSnapshot
      ? 'official-aa-structured-snapshot'
      : useVerifiedAaSnapshot
        ? 'verified-artificial-analysis-catalog-snapshot'
        : sourceInputs.aaInputMode,
  ];
  const arenaRaw = JSON.parse(fs.readFileSync(ARENA_RAW_PATH, 'utf8'));
  const cardsById = new Map();
  const observations = [];

  function upsertCard({ id, source, exactSourceModelName, latestSnapshotDate, sourceUrl, sourceLeaderboard, sourceRecordId, scope, sourceIdentity }) {
    if (!scope) throw new Error(`Refusing to write an out-of-scope source card: ${exactSourceModelName}.`);
    const existing = cardsById.get(id);
    if (existing) {
      const metadata = existing.metadataJson;
      if (metadata.scope?.productLineId !== scope.productLineId || metadata.scope?.vendorId !== scope.vendorId) {
        throw new Error(`A source card cannot span OAGXM product lines: ${id}.`);
      }
      metadata.sourceUrls = [...new Set([...metadata.sourceUrls, sourceUrl].filter(Boolean))];
      metadata.sourceLeaderboards = [...new Set([...metadata.sourceLeaderboards, sourceLeaderboard].filter(Boolean))];
      metadata.sourceRecordIds = [...new Set([...metadata.sourceRecordIds, sourceRecordId].filter(Boolean))];
      return existing;
    }
    const card = {
      id,
      source,
      exactSourceModelName,
      latestSnapshotDate: latestSnapshotDate || SNAPSHOT_DATE,
      metadataJson: {
        sourceUrl,
        sourceLeaderboard,
        sourceUrls: [sourceUrl].filter(Boolean),
        sourceLeaderboards: [sourceLeaderboard].filter(Boolean),
        sourceRecordIds: [sourceRecordId].filter(Boolean),
        scope,
        sourceIdentity: {
          ...sourceIdentity,
          canonicalProfileKey: scope.canonicalProfileKey,
        },
      },
    };
    cardsById.set(id, card);
    return card;
  }

  function addObservation({ sourceModelCardId, metricId, rawValue, unit, snapshotDate, sourceUrl, sourceLeaderboard, sourceRecordId, sourceField, confidenceLow, confidenceHigh, scope, metadataJson = {} }) {
    const verifiedRawValue = asFiniteNumber(rawValue);
    if (verifiedRawValue === null) return;
    requireSourceEvidence({ sourceUrl, sourceLeaderboard }, `Observation ${metricId}`);
    observations.push({
      id: `obs-${sourceModelCardId}-${metricId}`,
      sourceModelCardId,
      metricId,
      rawValue: verifiedRawValue,
      unit,
      snapshotDate: snapshotDate || SNAPSHOT_DATE,
      sourceUrl,
      sourceLeaderboard,
      metadataJson: {
        ...metadataJson,
        sourceRecordId,
        sourceField,
        reportedRawValue: verifiedRawValue,
        scope,
      },
      ...(asFiniteNumber(confidenceLow) !== null ? { confidenceLow: asFiniteNumber(confidenceLow) } : {}),
      ...(asFiniteNumber(confidenceHigh) !== null ? { confidenceHigh: asFiniteNumber(confidenceHigh) } : {}),
    });
  }

  // If the live OpenRouter endpoint is temporarily unavailable, retain only
  // previously verified OpenRouter observations. This is a source-record copy,
  // not a derived price or a substitute performance score. A subsequent live
  // fetch replaces this path wholesale.
  function restoreOpenRouterFromVerifiedCatalogSnapshot(sourceRecordIdsToReplace = new Set()) {
    const source = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const rawCards = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_MODEL_CARDS');
    const rawObservations = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_OBSERVATIONS');
    const rawCardsById = new Map(rawCards.map((card) => [card.id, card]));

    for (const rawCard of rawCards) {
      if (rawCard.source !== 'openrouter') continue;
      const metadata = rawCard.metadataJson && typeof rawCard.metadataJson === 'object' ? rawCard.metadataJson : {};
      const rawIdentity = metadata.sourceIdentity && typeof metadata.sourceIdentity === 'object'
        ? metadata.sourceIdentity
        : {};
      // Performance companions are rebuilt from their dedicated complete
      // snapshot below. Copying them here would reclassify the endpoint label
      // as a different model profile and could preserve stale 30-minute data.
      if (rawIdentity.kind === 'openrouter_standard_performance') continue;
      const sourceRecordId = Array.isArray(metadata.sourceRecordIds)
        ? metadata.sourceRecordIds[0]
        : metadata.sourceRecordId;
      if (!isCanonicalOpenRouterModelRecordId(sourceRecordId)) continue;
      // An official supplemental record is newer evidence for this exact
      // source record. Do not copy the same snapshot record first and then
      // hide the duplicate with an observation-level dedupe.
      if (sourceRecordIdsToReplace.has(sourceRecordId)) continue;
      const scope = classifySourceModelScope(rawCard.id, rawCard.exactSourceModelName, sourceRecordId);
      if (!scope || !hasExpectedSourceVendor(scope, 'openrouter', sourceRecordId)) continue;
      const sourceUrl = metadata.sourceUrl || `https://openrouter.ai/${sourceRecordId}`;
      const sourceLeaderboard = metadata.sourceLeaderboard || OPENROUTER_CATALOG_URL;
      upsertCard({
        id: rawCard.id,
        source: 'openrouter',
        exactSourceModelName: rawCard.exactSourceModelName,
        latestSnapshotDate: rawCard.latestSnapshotDate,
        sourceUrl,
        sourceLeaderboard,
        sourceRecordId,
        scope,
        sourceIdentity: {
          source: 'openrouter',
          sourceRecordId,
          exactSourceModelName: rawCard.exactSourceModelName,
          selectionMethod: 'verified-source-catalog snapshot; explicit OAGXM product-line selector',
        },
      });
    }

    for (const rawObservation of rawObservations) {
      if (!String(rawObservation.metricId || '').startsWith('or_')) continue;
      const rawCard = rawCardsById.get(rawObservation.sourceModelCardId);
      const targetCard = cardsById.get(rawObservation.sourceModelCardId);
      if (!rawCard || !targetCard) continue;
      const rawMetadata = rawObservation.metadataJson && typeof rawObservation.metadataJson === 'object'
        ? rawObservation.metadataJson
        : {};
      addObservation({
        sourceModelCardId: rawObservation.sourceModelCardId,
        metricId: rawObservation.metricId,
        rawValue: rawObservation.rawValue,
        unit: rawObservation.unit,
        snapshotDate: rawObservation.snapshotDate,
        sourceUrl: rawObservation.sourceUrl || rawMetadata.sourceUrl || targetCard.metadataJson.sourceUrl,
        sourceLeaderboard: rawObservation.sourceLeaderboard || rawMetadata.sourceLeaderboard || targetCard.metadataJson.sourceLeaderboard,
        sourceRecordId: rawObservation.sourceRecordId || rawMetadata.sourceRecordId,
        sourceField: rawObservation.sourceField || rawMetadata.sourceField,
        confidenceLow: rawObservation.confidenceLow,
        confidenceHigh: rawObservation.confidenceHigh,
        scope: targetCard.metadataJson.scope,
        metadataJson: rawMetadata,
      });
    }
  }

  // A network failure must never manufacture AA values or discard the other
  // two available official sources. This fallback copies only previously
  // verified AA records, reclassifies them against the current explicit
  // scope, and leaves newly-added lines without AA observations until a fresh
  // official AA snapshot is available.
  function restoreArtificialAnalysisFromVerifiedCatalogSnapshot() {
    const source = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const rawCards = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_MODEL_CARDS');
    const rawObservations = parseVerifiedCatalogExport(source, 'VERIFIED_SOURCE_OBSERVATIONS');
    const rawCardsById = new Map(rawCards.map((card) => [card.id, card]));

    for (const rawCard of rawCards) {
      if (rawCard.source !== 'artificial_analysis') continue;
      const metadata = rawCard.metadataJson && typeof rawCard.metadataJson === 'object' ? rawCard.metadataJson : {};
      const rawIdentity = metadata.sourceIdentity && typeof metadata.sourceIdentity === 'object'
        ? metadata.sourceIdentity
        : {};
      const sourceRecordId = Array.isArray(metadata.sourceRecordIds)
        ? metadata.sourceRecordIds[0]
        : rawIdentity.sourceRecordId ?? metadata.sourceRecordId;
      const scope = classifySourceModelScope(
        rawCard.id,
        rawCard.exactSourceModelName,
        sourceRecordId,
        rawIdentity.modelCreatorName,
        rawIdentity.modelCreatorSlug,
      );
      if (!scope || !hasExpectedSourceVendor(
        scope,
        'artificial_analysis',
        rawIdentity.modelCreatorName,
        rawIdentity.modelCreatorSlug,
      )) continue;

      const sourceUrl = metadata.sourceUrl || metadata.profileUrl || rawCard.profileUrl;
      const sourceLeaderboard = metadata.sourceLeaderboard || AA_LEADERBOARD_URL;
      upsertCard({
        id: rawCard.id,
        source: 'artificial_analysis',
        exactSourceModelName: rawCard.exactSourceModelName,
        latestSnapshotDate: rawCard.latestSnapshotDate,
        sourceUrl,
        sourceLeaderboard,
        sourceRecordId,
        scope,
        sourceIdentity: {
          ...rawIdentity,
          source: 'artificial_analysis',
          sourceRecordId: sourceRecordId || null,
          exactSourceModelName: rawCard.exactSourceModelName,
          selectionMethod: 'verified-source-catalog snapshot; explicit OAGXM product-line selector',
        },
      });
    }

    for (const rawObservation of rawObservations) {
      if (!String(rawObservation.metricId || '').startsWith('aa_')) continue;
      const rawCard = rawCardsById.get(rawObservation.sourceModelCardId);
      const targetCard = cardsById.get(rawObservation.sourceModelCardId);
      if (!rawCard || !targetCard) continue;
      const rawMetadata = rawObservation.metadataJson && typeof rawObservation.metadataJson === 'object'
        ? rawObservation.metadataJson
        : {};
      addObservation({
        sourceModelCardId: rawObservation.sourceModelCardId,
        metricId: rawObservation.metricId,
        rawValue: rawObservation.rawValue,
        unit: rawObservation.unit,
        snapshotDate: rawObservation.snapshotDate,
        sourceUrl: rawObservation.sourceUrl || rawMetadata.sourceUrl || targetCard.metadataJson.sourceUrl,
        sourceLeaderboard: rawObservation.sourceLeaderboard || rawMetadata.sourceLeaderboard || targetCard.metadataJson.sourceLeaderboard,
        sourceRecordId: rawObservation.sourceRecordId || rawMetadata.sourceRecordId || targetCard.metadataJson.sourceIdentity?.sourceRecordId,
        sourceField: rawObservation.sourceField || rawMetadata.sourceField,
        confidenceLow: rawObservation.confidenceLow,
        confidenceHigh: rawObservation.confidenceHigh,
        scope: targetCard.metadataJson.scope,
        metadataJson: rawMetadata,
      });
    }
  }

  // 1. Artificial Analysis: the model leaderboard payload is the source of
  // record for the specific atomic fields below.
  if (useVerifiedAaSnapshot) {
    restoreArtificialAnalysisFromVerifiedCatalogSnapshot();
  } else {
    const aaModels = hasStructuredAaSnapshot
      ? artificialAnalysisSourceSnapshot.modelRecords
      : extractArtificialAnalysisModels(aaHtml);
    for (const model of aaModels) {
      const profileUrl = `https://artificialanalysis.ai/models/${model.slug}`;
      const cardId = `card-aa-${slugify(model.slug)}`;
      const scope = classifySourceModelScope(
        cardId,
        model.name,
        model.slug,
        model.modelCreatorName,
        model.modelCreatorSlug,
      );
      if (!scope || !hasExpectedSourceVendor(scope, 'artificial_analysis', model.modelCreatorName, model.modelCreatorSlug)) continue;
      upsertCard({
        id: cardId,
        source: 'artificial_analysis',
        exactSourceModelName: model.name,
        latestSnapshotDate: hasStructuredAaSnapshot
          ? artificialAnalysisSourceSnapshot.snapshotDate
          : SNAPSHOT_DATE,
        sourceUrl: profileUrl,
        sourceLeaderboard: AA_LEADERBOARD_URL,
        sourceRecordId: model.id,
        scope,
        sourceIdentity: {
          source: 'artificial_analysis',
          modelCreatorName: model.modelCreatorName,
          modelCreatorSlug: model.modelCreatorSlug,
          releaseDate: typeof model.releaseDate === 'string' ? model.releaseDate : null,
          sourceRecordId: model.id,
          exactSourceModelName: model.name,
          selectionMethod: hasStructuredAaSnapshot
            ? 'official-aa-structured-snapshot'
            : sourceInputs.aaInputMode,
        },
      });
      for (const metric of AA_METRICS) {
        addObservation({
          sourceModelCardId: cardId,
          metricId: metric.id,
          rawValue: metric.field(model),
          unit: metric.id === 'aa_gdpval_v2' ? 'Elo' : 'ratio',
          snapshotDate: hasStructuredAaSnapshot
            ? artificialAnalysisSourceSnapshot.snapshotDate
            : SNAPSHOT_DATE,
          sourceUrl: profileUrl,
          sourceLeaderboard: metric.sourceLeaderboard,
          sourceRecordId: model.id,
          sourceField: metric.sourceField,
          scope,
        });
      }
      for (const metric of AA_DETAIL_ONLY_METRICS) {
        const sourceRecord = artificialAnalysisSourceSnapshot.recordsByPageAndModelId
          .get(metric.pageId)
          ?.get(model.id);
        addObservation({
          sourceModelCardId: cardId,
          metricId: metric.id,
          rawValue: metric.field(sourceRecord),
          unit: metric.unit,
          snapshotDate: artificialAnalysisSourceSnapshot.snapshotDate,
          sourceUrl: profileUrl,
          sourceLeaderboard: metric.sourceLeaderboard,
          sourceRecordId: model.id,
          sourceField: metric.sourceField,
          scope,
          metadataJson: {
            sourceSnapshot: path.relative(ROOT, ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH),
            sourcePageId: metric.pageId,
            scoringRole: 'detail-only',
          },
        });
      }
      for (const metric of AA_PRACTICAL_FALLBACK_METRICS) {
        const sourceRecord = artificialAnalysisSourceSnapshot.recordsByPageAndModelId
          .get(metric.pageId)
          ?.get(model.id);
        addObservation({
          sourceModelCardId: cardId,
          metricId: metric.id,
          rawValue: metric.field(sourceRecord),
          unit: metric.unit,
          snapshotDate: artificialAnalysisSourceSnapshot.snapshotDate,
          sourceUrl: profileUrl,
          sourceLeaderboard: metric.sourceLeaderboard,
          sourceRecordId: model.id,
          sourceField: metric.sourceField,
          scope,
          metadataJson: {
            sourceSnapshot: path.relative(ROOT, ARTIFICIAL_ANALYSIS_SOURCE_SNAPSHOT_PATH),
            sourcePageId: metric.pageId,
            scoringRole: 'practical-fallback',
          },
        });
      }
    }
  }

  // 2. Arena: the checked-in raw extraction preserves source rows (including
  // duplicates). We select a documented canonical row per metric/model; no
  // numeric field is derived by this selection.
  const arenaMetrics = arenaRaw.metrics || {};
  if (Object.keys(arenaMetrics).length !== 13) {
    throw new Error(`Arena extraction must contain exactly 13 metrics, received ${Object.keys(arenaMetrics).length}.`);
  }
  for (const [metricId, metric] of Object.entries(arenaMetrics)) {
    const sourceUrl = metric.sourceUrl;
    const sourceLeaderboard = metric.sourceLeaderboard;
    requireSourceEvidence({ sourceUrl, sourceLeaderboard }, `Arena metric ${metricId}`);
    const canonicalRows = new Map();
    (metric.rows || []).forEach((row, sourceOrder) => {
      // Search/Grounding is model-level domain evidence in LLMpk. Older raw
      // snapshots inconsistently preserved or hid the route suffix, so recover
      // the official display identity and normalize it to the base model.
      const searchDisplayName = (
        row.sourceRecord?.modelDisplayName
        || row.exactSourceModelName
        || row.modelDisplayName
        || row.model_name
        || row.modelName
      );
      const exactSourceModelName = metricId === 'arena_search'
        ? String(searchDisplayName || '').replace(
          /[-_\s]+(?:search|grounding)$/iu,
          '',
        )
        : (
          row.exactSourceModelName
          || row.modelDisplayName
          || row.model_name
          || row.modelName
        );
      const rawValue = row.rawValue ?? row.rating ?? row.score;
      if (typeof exactSourceModelName !== 'string' || asFiniteNumber(rawValue) === null) return;
      const candidate = { ...row, exactSourceModelName, rawValue, __sourceOrder: sourceOrder };
      const key = slugify(exactSourceModelName);
      const current = canonicalRows.get(key);
      if (!current || betterArenaRow(candidate, current)) canonicalRows.set(key, candidate);
    });

    for (const [modelKey, row] of canonicalRows) {
      const cardId = `card-arena-${modelKey}`;
      const modelUrl = row.sourceRecord?.modelUrl;
      const scope = classifySourceModelScope(
        cardId,
        row.exactSourceModelName,
        row.sourceRecordId,
        row.modelId,
        row.sourceRecord?.modelKey,
        modelUrl,
      );
      if (!scope) continue;
      upsertCard({
        id: cardId,
        source: 'arena',
        exactSourceModelName: row.exactSourceModelName,
        latestSnapshotDate: row.snapshotDate || arenaRaw.extractedAt?.slice(0, 10) || SNAPSHOT_DATE,
        sourceUrl,
        sourceLeaderboard,
        sourceRecordId: row.sourceRecordId || row.modelId || row.exactSourceModelName,
        scope,
        sourceIdentity: {
          source: 'arena',
          sourceRecordId: row.sourceRecordId || row.modelId || row.exactSourceModelName,
          exactSourceModelName: row.exactSourceModelName,
          modelKey: row.sourceRecord?.modelKey ?? null,
          modelUrl: modelUrl ?? null,
          releaseType: row.sourceRecord?.releaseType ?? null,
          selectionMethod: 'official-arena-raw-extraction',
        },
      });
      addObservation({
        sourceModelCardId: cardId,
        metricId,
        rawValue: row.rawValue,
        unit: row.unit || (metricId.startsWith('arena_agent_') ? 'IPS score' : 'Arena rating'),
        snapshotDate: row.snapshotDate || arenaRaw.extractedAt?.slice(0, 10) || SNAPSHOT_DATE,
        sourceUrl: row.sourceUrl || sourceUrl,
        sourceLeaderboard: row.sourceLeaderboard || sourceLeaderboard,
        sourceRecordId: row.sourceRecordId || row.modelId || row.exactSourceModelName,
        sourceField: row.sourceField || metric.sourceField || 'official leaderboard row',
        scope,
        confidenceLow: row.confidenceLow ?? row.ratingLower ?? row.scoreCiLower,
        confidenceHigh: row.confidenceHigh ?? row.ratingUpper ?? row.scoreCiUpper,
        metadataJson: {
          rank: row.rank ?? row.sourceRecord?.rank ?? null,
          votes: row.votes ?? row.voteCount ?? row.observationCount ?? row.sourceRecord?.votes ?? null,
          sourceRecord: row.sourceRecord ?? null,
          sourceLeaderboard: row.sourceLeaderboard || sourceLeaderboard,
          extractedRowCount: metric.rows?.length ?? 0,
          deduplicatedBy: 'metricId + normalized exactSourceModelName; lower rank, then higher vote count, then first source row',
        },
      });
    }
  }

  // 3. OpenRouter model catalog supplies identity. When Standard endpoint
  // statistics exist, prices use provider-neutral arithmetic means across
  // every eligible endpoint. Performance uses each endpoint's verified
  // 3d/1w stabilization when the v2 snapshot provides it, then preserves the
  // same provider-neutral endpoint weighting. Raw current values and summary
  // distributions remain in the snapshot.
  // Catalog list price is retained only as a fallback for models without a
  // complete Standard endpoint aggregate.
  const openRouterPerformanceAggregates = loadOpenRouterPerformanceSnapshot();
  const openRouterPerformanceByModelId = new Map(
    openRouterPerformanceAggregates.map((record) => [record.modelId, record]),
  );
  let openRouterModels = [];
  if (Array.isArray(openRouterPayload?.data) && openRouterPayload.data.length > 0) {
    openRouterModels = openRouterPayload.data.map((model) => ({
      model,
      selectionMethod: sourceInputs.openRouterInputMode,
    }));
    catalogInputModes.push(sourceInputs.openRouterInputMode);
  } else {
    if (!allowVerifiedCatalogFallback) {
      throw new Error(`OpenRouter refresh failed: ${sourceInputs.openRouterError}`);
    }
    console.warn(`Official OpenRouter refresh unavailable; retaining verified OpenRouter source records: ${sourceInputs.openRouterError}`);
    const supplementalModels = loadOpenRouterSupplementalSnapshot();
    const supplementalRecordIds = new Set(
      supplementalModels
        .map((model) => model?.id)
        .filter((id) => typeof id === 'string'),
    );
    restoreOpenRouterFromVerifiedCatalogSnapshot(supplementalRecordIds);
    catalogInputModes.push('verified-openrouter-catalog-snapshot');
    openRouterModels = supplementalModels.map((model) => ({
      model,
      selectionMethod: 'official-openrouter-supplemental-snapshot',
    }));
    if (supplementalModels.length > 0) {
      catalogInputModes.push('official-openrouter-supplemental-snapshot');
    }
  }
  for (const { model, selectionMethod } of openRouterModels) {
    if (typeof model.id !== 'string' || model.id.length === 0) continue;
    if (!isCanonicalOpenRouterModelRecordId(model.id)) continue;
    if (!isGeneralTextOpenRouterModel(model)) continue;
    const cardId = `card-openrouter-${slugify(model.id)}`;
    const scope = classifySourceModelScope(cardId, model.name, model.id);
    if (!scope || !hasExpectedSourceVendor(scope, 'openrouter', model.id)) continue;
    const sourceUrl = `https://openrouter.ai/${model.id}`;
    upsertCard({
      id: cardId,
      source: 'openrouter',
      exactSourceModelName: model.name || model.id,
      latestSnapshotDate: SNAPSHOT_DATE,
      sourceUrl,
      sourceLeaderboard: OPENROUTER_CATALOG_URL,
      sourceRecordId: model.id,
      scope,
      sourceIdentity: {
        source: 'openrouter',
        sourceRecordId: model.id,
        exactSourceModelName: model.name || model.id,
        createdUnixSeconds: asFiniteNumber(model.created),
        canonicalSlug: typeof model.canonical_slug === 'string' ? model.canonical_slug : null,
        selectionMethod,
      },
    });
    const performanceAggregate = openRouterPerformanceByModelId.get(model.id);
    const inputPricePerToken = performanceAggregate?.inputPricePerToken
      ?? asFiniteNumber(model.pricing?.prompt);
    const outputPricePerToken = performanceAggregate?.outputPricePerToken
      ?? asFiniteNumber(model.pricing?.completion);
    const priceSourceUrl = performanceAggregate?.sourceUrls?.[0] || sourceUrl;
    const priceSourceLeaderboard = performanceAggregate?.sourcePageUrl
      || OPENROUTER_CATALOG_URL;
    const priceSourceRecordId = performanceAggregate
      ? `${model.id}#standard-aggregate`
      : model.id;
    if (inputPricePerToken !== null) {
      addObservation({
        sourceModelCardId: cardId,
        metricId: 'or_price_input',
        rawValue: inputPricePerToken * 1e6,
        unit: '$/1M tokens',
        snapshotDate: SNAPSHOT_DATE,
        sourceUrl: priceSourceUrl,
        sourceLeaderboard: priceSourceLeaderboard,
        sourceRecordId: priceSourceRecordId,
        sourceField: performanceAggregate
          ? 'modelAggregates[].measures.inputPricePerToken.arithmeticMean'
          : 'pricing.prompt',
        scope,
        metadataJson: performanceAggregate ? {
          aggregation: 'arithmetic mean across every accepted OpenRouter Standard endpoint',
          endpointCount: performanceAggregate.endpointCount,
          providerCount: performanceAggregate.providerCount,
          totalRequestCount: performanceAggregate.totalRequestCount,
          measureSummary: performanceAggregate.measures.inputPricePerToken,
          catalogListPricePerToken: asFiniteNumber(model.pricing?.prompt),
        } : {
          aggregation: 'official catalog list price fallback; no complete Standard endpoint aggregate',
        },
      });
    }
    if (outputPricePerToken !== null) {
      addObservation({
        sourceModelCardId: cardId,
        metricId: 'or_price_output',
        rawValue: outputPricePerToken * 1e6,
        unit: '$/1M tokens',
        snapshotDate: SNAPSHOT_DATE,
        sourceUrl: priceSourceUrl,
        sourceLeaderboard: priceSourceLeaderboard,
        sourceRecordId: priceSourceRecordId,
        sourceField: performanceAggregate
          ? 'modelAggregates[].measures.outputPricePerToken.arithmeticMean'
          : 'pricing.completion',
        scope,
        metadataJson: performanceAggregate ? {
          aggregation: 'arithmetic mean across every accepted OpenRouter Standard endpoint',
          endpointCount: performanceAggregate.endpointCount,
          providerCount: performanceAggregate.providerCount,
          totalRequestCount: performanceAggregate.totalRequestCount,
          measureSummary: performanceAggregate.measures.outputPricePerToken,
          catalogListPricePerToken: asFiniteNumber(model.pricing?.completion),
        } : {
          aggregation: 'official catalog list price fallback; no complete Standard endpoint aggregate',
        },
      });
    }
    const latencySeconds = performanceAggregate
      ? null
      : asFiniteNumber(model.top_provider?.latency);
    const throughputTokensPerSecond = performanceAggregate
      ? null
      : asFiniteNumber(model.top_provider?.throughput);
    if (latencySeconds !== null) {
      addObservation({
        sourceModelCardId: cardId,
        metricId: 'or_ttft_p50',
        rawValue: latencySeconds,
        unit: 'seconds',
        snapshotDate: SNAPSHOT_DATE,
        sourceUrl,
        sourceLeaderboard: OPENROUTER_CATALOG_URL,
        sourceRecordId: model.id,
        sourceField: 'top_provider.latency',
        scope,
      });
    }
    if (throughputTokensPerSecond !== null) {
      addObservation({
        sourceModelCardId: cardId,
        metricId: 'or_throughput_p50',
        rawValue: throughputTokensPerSecond,
        unit: 'tokens/second',
        snapshotDate: SNAPSHOT_DATE,
        sourceUrl,
        sourceLeaderboard: OPENROUTER_CATALOG_URL,
        sourceRecordId: model.id,
        sourceField: 'top_provider.throughput',
        scope,
      });
    }
  }

  // Provider-neutral Standard-route aggregates remain companion cards so the
  // same practical serving measurements can be reused across explicit effort
  // configurations without leaking into capability matching.
  if (openRouterPerformanceAggregates.length > 0) {
    catalogInputModes.push('official-openrouter-standard-performance-snapshot');
  }
  for (const record of openRouterPerformanceAggregates) {
    const companionForCardId = `card-openrouter-${slugify(record.modelId)}`;
    const baseCard = cardsById.get(companionForCardId);
    if (!baseCard) continue;
    const baseScope = baseCard.metadataJson?.scope;
    if (!isValidCatalogScope(baseScope)) {
      throw new Error(`OpenRouter performance companion has no valid base scope: ${record.modelId}.`);
    }
    const cardId = `card-openrouter-standard-performance-${slugify(record.modelId)}`;
    const sourceUrl = record.sourceUrls[0];
    const sourceRecordId = `${record.modelId}#standard-aggregate`;
    const scope = { ...baseScope };
    upsertCard({
      id: cardId,
      source: 'openrouter',
      exactSourceModelName: `${record.exactModelName || record.modelId} · OpenRouter Standard Average`,
      latestSnapshotDate: record.snapshotDate,
      sourceUrl,
      sourceLeaderboard: record.sourcePageUrl,
      sourceRecordId,
      scope,
      sourceIdentity: {
        kind: 'openrouter_standard_performance',
        source: 'openrouter',
        sourceRecordId,
        modelSourceRecordId: record.modelId,
        exactSourceModelName: record.exactModelName || record.modelId,
        companionForCardId,
        variant: 'standard',
        endpointCount: record.endpointCount,
        providerCount: record.providerCount,
        endpointIds: record.endpointIds,
        providerSlugs: record.providerSlugs,
        totalRequestCount: record.totalRequestCount,
        speedStabilizationVersion: record.speedStabilizationVersion,
        selectionMethod: `${record.speedMeasurementMethod}; raw current rows, auxiliary traffic-weighted mean, median, quartiles, and range retained in the verified snapshot`,
      },
    });
    addObservation({
      sourceModelCardId: cardId,
      metricId: 'or_ttft_p50',
      rawValue: record.latencyMilliseconds / 1e3,
      unit: 'seconds',
      snapshotDate: record.snapshotDate,
      sourceUrl,
      sourceLeaderboard: record.sourcePageUrl,
      sourceRecordId,
      sourceField: 'modelAggregates[].measures.timeToFirstTokenMilliseconds.arithmeticMean',
      scope,
      metadataJson: {
        aggregation: record.speedMeasurementMethod,
        speedStabilizationVersion: record.speedStabilizationVersion,
        endpointCount: record.endpointCount,
        providerCount: record.providerCount,
        totalRequestCount: record.totalRequestCount,
        measureSummary: record.measures.timeToFirstTokenMilliseconds,
        sourceReportedRawValue: record.latencyMilliseconds,
        sourceReportedUnit: 'milliseconds',
        conversion: 'milliseconds / 1000 = seconds',
        routeVariant: 'standard',
        caveat: 'summary of provider endpoint p50 series; not a recomputed global request-level p50',
      },
    });
    addObservation({
      sourceModelCardId: cardId,
      metricId: 'or_throughput_p50',
      rawValue: record.throughputTokensPerSecond,
      unit: 'tokens/second',
      snapshotDate: record.snapshotDate,
      sourceUrl,
      sourceLeaderboard: record.sourcePageUrl,
      sourceRecordId,
      sourceField: 'modelAggregates[].measures.outputSpeedTokensPerSecond.arithmeticMean',
      scope,
      metadataJson: {
        aggregation: record.speedMeasurementMethod,
        speedStabilizationVersion: record.speedStabilizationVersion,
        endpointCount: record.endpointCount,
        providerCount: record.providerCount,
        totalRequestCount: record.totalRequestCount,
        measureSummary: record.measures.outputSpeedTokensPerSecond,
        routeVariant: 'standard',
        caveat: 'equal current-endpoint weighting is primary; current-window traffic-weighted mean is retained separately',
      },
    });
  }

  const cards = [...cardsById.values()]
    .sort((left, right) => left.source.localeCompare(right.source) || left.id.localeCompare(right.id));
  observations.sort((left, right) => left.sourceModelCardId.localeCompare(right.sourceModelCardId) || left.metricId.localeCompare(right.metricId));
  const duplicateObservationIds = observations.filter((observation, index, all) =>
    all.findIndex((candidate) => candidate.id === observation.id) !== index
  );
  if (duplicateObservationIds.length > 0) {
    throw new Error(`Catalog build produced ${duplicateObservationIds.length} duplicate observation ids.`);
  }
  for (const observation of observations) {
    const card = cardsById.get(observation.sourceModelCardId);
    if (!card) {
      throw new Error(`Observation ${observation.id} does not point to a source card.`);
    }
    const cardScope = card.metadataJson?.scope;
    const observationScope = observation.metadataJson?.scope;
    if (!cardScope || !observationScope || cardScope.scopeId !== observationScope.scopeId || cardScope.vendorId !== observationScope.vendorId || cardScope.productLineId !== observationScope.productLineId) {
      throw new Error(`Observation ${observation.id} has no matching catalog scope provenance.`);
    }
    requireSourceEvidence(observation, `Observation ${observation.id}`);
  }

  for (const card of cards) {
    const scope = card.metadataJson?.scope;
    if (!isValidCatalogScope(scope)) {
      throw new Error(`Card ${card.id} has invalid catalog scope metadata.`);
    }
    const reviewedAlias = SOURCE_PROFILE_ALIASES.byCardId.get(card.id);
    if (reviewedAlias && scope.canonicalProfileKey !== reviewedAlias.canonicalProfileKey) {
      throw new Error(`Card ${card.id} did not retain its reviewed canonical profile key.`);
    }
  }

  const cardsByExactId = new Map(cards.map((card) => [card.id, card]));
  for (const aliasGroup of SOURCE_PROFILE_ALIASES.manifest.groups) {
    const presentCards = aliasGroup.cardIds
      .map((cardId) => cardsByExactId.get(cardId))
      .filter(Boolean);
    if (presentCards.length < 2) continue;
    const productLineIds = new Set(presentCards.map((card) => card.metadataJson.scope.productLineId));
    if (productLineIds.size !== 1) {
      throw new Error(
        `Reviewed alias ${aliasGroup.canonicalProfileKey} spans incompatible product-line guards: ${[...productLineIds].join(', ')}.`,
      );
    }
  }

  writeCatalog(cards, observations);
  printCatalogSummary(cards, observations, [...new Set(catalogInputModes)].join('+'));
}

buildVerifiedCatalog().catch((error) => {
  console.error(`Source catalog rebuild failed: ${error.message}`);
  process.exitCode = 1;
});
