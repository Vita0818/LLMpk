import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedCardsPath = resolve(repositoryRoot, 'src', 'data', 'seedCards.ts');
const oagxmScopePath = resolve(repositoryRoot, 'src', 'data', 'oagxmScope.json');
const rawExtractionPath = resolve(
  process.env.ARENA_RAW_EXTRACTION_PATH
    ?? resolve(repositoryRoot, 'src', 'data', 'arenaRawExtraction.json'),
);
const jsonReportPath = resolve(repositoryRoot, 'arena_data_self_audit.json');
const markdownReportPath = resolve(repositoryRoot, 'arena_data_self_audit.md');

const ARENA_METRICS = [
  'arena_text_instruction',
  'arena_text_multiturn',
  'arena_text_creative',
  'arena_text_hard',
  'arena_text_math',
  'arena_text_coding',
  'arena_code_webdev',
  'arena_search',
  'arena_agent_success',
  'arena_agent_praise',
  'arena_agent_steerability',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
];

const EXPECTED_SOURCE_BY_PREFIX = {
  arena_: 'arena',
  aa_: 'artificial_analysis',
  or_: 'openrouter',
};

const EXPECTED_HOST_BY_SOURCE = {
  arena: 'arena.ai',
  artificial_analysis: 'artificialanalysis.ai',
  openrouter: 'openrouter.ai',
};

const SOURCE_CATALOG_SCOPE_ID = 'llmpk-source-catalog';
const SOURCE_CATALOG_SCOPE_VERSION = 'v1';

const EXPECTED_SOURCE_VENDOR_PATTERNS = {
  openai: [/^openai$/i, /^openai\//i],
  anthropic: [/^anthropic$/i, /^anthropic\//i],
  google: [/^google(?: deepmind)?$/i, /^google\//i],
  cohere: [/^cohere(?: inc[.]?)?$/i, /^cohere\//i],
  thinking_machines: [/^thinking machines(?: lab)?$/i, /^thinkingmachines\//i],
  xai: [/^xai$/i, /^x-ai\//i],
  meta: [/^meta$/i, /^meta(?:-llama)?\//i],
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

const SYNTHETIC_RUNTIME_PATTERNS = [
  ['synthetic observation', /synthetic\s+observation/i],
  ['generated score', /generated\s+score/i],
  ['fallback score', /fallback\s+score/i],
  ['default benchmark score', /default\s+benchmark\s+score/i],
  ['fake seed observation', /fake\s+seed\s+observation/i],
  ['demo score', /demo\s+score/i],
  ['baseQuality generator', /\bbaseQuality\b/],
  ['fallbackScore generator', /\bfallbackScore\b/],
  ['defaultBenchmarkScore generator', /\bdefaultBenchmarkScore\b/],
  ['fakeSeedObservation generator', /\bfakeSeedObservation\b/],
  ['demoScore generator', /\bdemoScore\b/],
];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalModelName(value) {
  return String(value)
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function stableNumberEquals(left, right) {
  if (!isFiniteNumber(left) || !isFiniteNumber(right)) return false;
  return Math.abs(left - right) <= Math.max(1e-12, Math.abs(left) * 1e-12, Math.abs(right) * 1e-12);
}

function findClosingString(source, openingIndex) {
  let escaping = false;
  for (let index = openingIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaping) {
      escaping = false;
    } else if (character === '\\') {
      escaping = true;
    } else if (character === '"') {
      return index;
    }
  }
  throw new Error('Unterminated JSON string literal.');
}

function findClosingJsonContainer(source, openingIndex) {
  const opening = source[openingIndex];
  const closing = opening === '[' ? ']' : opening === '{' ? '}' : null;
  if (!closing) throw new Error(`Expected a JSON container at offset ${openingIndex}.`);

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === '\\') {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === opening) {
      depth += 1;
    } else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error('Unterminated JSON container.');
}

function parseExportedJson(source, exportName) {
  const declaration = source.indexOf(`export const ${exportName}`);
  if (declaration === -1) return null;

  const assignment = source.indexOf('=', declaration);
  if (assignment === -1) throw new Error(`No assignment for ${exportName}.`);

  let valueStart = assignment + 1;
  while (/\s/.test(source[valueStart])) valueStart += 1;

  if (source.startsWith('JSON.stringify(', valueStart)) {
    valueStart += 'JSON.stringify('.length;
    while (/\s/.test(source[valueStart])) valueStart += 1;
  }

  if (source[valueStart] === '"') {
    const closing = findClosingString(source, valueStart);
    return JSON.parse(JSON.parse(source.slice(valueStart, closing + 1)));
  }

  if (source[valueStart] === '[' || source[valueStart] === '{') {
    const closing = findClosingJsonContainer(source, valueStart);
    return JSON.parse(source.slice(valueStart, closing + 1));
  }

  throw new Error(`Unsupported ${exportName} representation in seedCards.ts.`);
}

function loadCatalog() {
  if (!existsSync(seedCardsPath)) throw new Error(`Missing catalog: ${seedCardsPath}`);
  const source = readFileSync(seedCardsPath, 'utf8');
  const cards = parseExportedJson(source, 'VERIFIED_SOURCE_MODEL_CARDS')
    ?? parseExportedJson(source, 'SEED_SOURCE_MODEL_CARDS');
  const observations = parseExportedJson(source, 'VERIFIED_SOURCE_OBSERVATIONS')
    ?? parseExportedJson(source, 'SEED_SOURCE_OBSERVATIONS');

  if (!Array.isArray(cards) || !Array.isArray(observations)) {
    throw new Error('seedCards.ts does not export a recognized verified card/observation catalog.');
  }
  return { cards, observations };
}

function expectedSourceForMetric(metricId) {
  const prefix = Object.keys(EXPECTED_SOURCE_BY_PREFIX).find((candidate) => metricId.startsWith(candidate));
  return prefix ? EXPECTED_SOURCE_BY_PREFIX[prefix] : null;
}

function metadataOf(observation) {
  return observation.metadataJson && typeof observation.metadataJson === 'object'
    ? observation.metadataJson
    : {};
}

function sourceLeaderboardOf(observation, card) {
  const metadata = metadataOf(observation);
  return observation.sourceLeaderboard
    ?? metadata.sourceLeaderboard
    ?? card?.metadataJson?.sourceLeaderboard
    ?? null;
}

function sourceRecordIdOf(observation) {
  const metadata = metadataOf(observation);
  return observation.sourceRecordId ?? metadata.sourceRecordId ?? null;
}

function sourceFieldOf(observation) {
  const metadata = metadataOf(observation);
  return observation.sourceField ?? metadata.sourceField ?? null;
}

function sourceRecordOf(observation) {
  const metadata = metadataOf(observation);
  return observation.sourceRecord ?? metadata.sourceRecord ?? null;
}

function loadOagxmScope() {
  if (!existsSync(oagxmScopePath)) throw new Error(`Missing OAGXM scope manifest: ${oagxmScopePath}`);
  const scope = JSON.parse(readFileSync(oagxmScopePath, 'utf8'));
  if (!scope || typeof scope.scopeId !== 'string' || typeof scope.schemaVersion !== 'string' || !Array.isArray(scope.vendors)) {
    throw new Error('OAGXM scope manifest is invalid.');
  }
  return scope;
}

function scopeMetadataOf(cardOrObservation) {
  const metadata = metadataOf(cardOrObservation);
  return metadata.scope && typeof metadata.scope === 'object' ? metadata.scope : null;
}

function isValidSourceCatalogScope(scope) {
  return scope?.scopeId === SOURCE_CATALOG_SCOPE_ID
    && scope.scopeVersion === SOURCE_CATALOG_SCOPE_VERSION
    && scope.vendorId === 'source-catalog'
    && scope.vendorName === 'Cross-source catalog'
    && isNonEmptyString(scope.productLineId)
    && scope.productLineId.startsWith('source-profile-')
    && isNonEmptyString(scope.canonicalProfileKey)
    && scope.rankingClass === 'formal_text_agent';
}

function scopeLineIndex(scope) {
  const index = new Map();
  scope.vendors.forEach((vendor) => {
    (vendor.productLines || []).forEach((productLine) => {
      index.set(`${vendor.id}:${productLine.id}`, { vendor, productLine });
    });
  });
  return index;
}

function sourceIdentityOfCard(card) {
  const metadata = metadataOf(card);
  const sourceIdentity = metadata.sourceIdentity && typeof metadata.sourceIdentity === 'object'
    ? metadata.sourceIdentity
    : {};
  return sourceIdentity;
}

function classifyOagxmScopeIdentity(scope, ...sourceIdentities) {
  const identity = sourceIdentities
    .filter(isNonEmptyString)
    .map((value) => String(value).normalize('NFKC').trim().replace(/\s+/g, ' '))
    .join('\n');
  if (!identity) return null;

  for (const vendor of scope.vendors) {
    for (const productLine of vendor.productLines || []) {
      if (productLine.allowPreviewSourceRecords === false && /\bpreview\b/iu.test(identity)) continue;
      if ((productLine.patterns || []).some((pattern) => new RegExp(pattern, 'iu').test(identity))) {
        return { vendorId: vendor.id, productLineId: productLine.id };
      }
    }
  }
  return null;
}

function productLineMatchesSourceIdentity(productLine, identityText) {
  if (productLine.allowPreviewSourceRecords === false && /\bpreview\b/iu.test(identityText)) return false;
  return (productLine.patterns || []).some((pattern) => new RegExp(pattern, 'iu').test(identityText));
}

function arenaRowScope(scope, row) {
  return classifyOagxmScopeIdentity(
    scope,
    row?.exactSourceModelName,
    row?.sourceRecordId,
    row?.modelId,
    row?.modelDisplayName,
  );
}

function auditOagxmScope(scope, cards, observations, failures, warnings) {
  const lineIndex = scopeLineIndex(scope);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const cardCounts = {};
  const observationCounts = {};
  const findings = [];
  let sourceCatalogCardCount = 0;
  let sourceCatalogObservationCount = 0;

  cards.forEach((card) => {
    const cardScope = scopeMetadataOf(card);
    if (isValidSourceCatalogScope(cardScope)) {
      sourceCatalogCardCount += 1;
      return;
    }
    if (
      !cardScope
      || cardScope.scopeId !== scope.scopeId
      || cardScope.scopeVersion !== scope.schemaVersion
      || typeof cardScope.vendorId !== 'string'
      || typeof cardScope.productLineId !== 'string'
      || !lineIndex.has(`${cardScope.vendorId}:${cardScope.productLineId}`)
    ) {
      findings.push({ cardId: card.id, issue: 'Card has no valid versioned OAGXM scope provenance.' });
      return;
    }

    const { vendor, productLine } = lineIndex.get(`${cardScope.vendorId}:${cardScope.productLineId}`);
    if (cardScope.rankingClass !== productLine.rankingClass) {
      findings.push({ cardId: card.id, issue: 'Card ranking class does not match the scope manifest.' });
      return;
    }

    const identity = sourceIdentityOfCard(card);
    const identityText = [
      card.exactSourceModelName,
      identity.exactSourceModelName,
      identity.sourceRecordId,
      identity.modelKey,
      identity.modelUrl,
    ]
      .filter(isNonEmptyString)
      .join('\n');
    const matchesProductLine = productLineMatchesSourceIdentity(productLine, identityText);
    if (!matchesProductLine) {
      findings.push({ cardId: card.id, issue: 'Card source identity does not match its explicit product-line selector.' });
      return;
    }

    const classifiedProductLine = classifyOagxmScopeIdentity(scope, identityText);
    if (
      classifiedProductLine?.vendorId !== vendor.id
      || classifiedProductLine?.productLineId !== productLine.id
    ) {
      findings.push({
        cardId: card.id,
        issue: 'Card source identity resolves to a different prioritized OAGXM product-line selector.',
        classifiedProductLine,
      });
      return;
    }

    if (card.source === 'artificial_analysis' || card.source === 'openrouter') {
      const sourceVendorIdentities = card.source === 'artificial_analysis'
        ? [identity.modelCreatorName, identity.modelCreatorSlug]
        : [identity.sourceRecordId];
      const validVendor = sourceVendorIdentities
        .some((sourceVendorIdentity) => (EXPECTED_SOURCE_VENDOR_PATTERNS[vendor.id] || [])
          .some((pattern) => pattern.test(String(sourceVendorIdentity ?? ''))));
      // The network-independent rebuild path deliberately copies an already
      // validated AA source record without fabricating a creator field.  Its
      // exact product-line selector and source URL are still audited below;
      // live AA extraction continues to require the upstream creator field.
      const verifiedSnapshotAa = card.source === 'artificial_analysis'
        && identity.selectionMethod === 'verified-source-catalog snapshot; explicit OAGXM product-line selector';
      if (!validVendor && !verifiedSnapshotAa) {
        findings.push({ cardId: card.id, issue: 'Card source vendor identity does not match scoped vendor.' });
        return;
      }
    }

    const key = `${vendor.id}:${productLine.id}`;
    cardCounts[key] = (cardCounts[key] || 0) + 1;
  });

  observations.forEach((observation) => {
    const card = cardsById.get(observation.sourceModelCardId);
    const cardScope = card ? scopeMetadataOf(card) : null;
    const observationScope = scopeMetadataOf(observation);
    if (
      !cardScope
      || !observationScope
      || cardScope.scopeId !== observationScope.scopeId
      || cardScope.scopeVersion !== observationScope.scopeVersion
      || cardScope.vendorId !== observationScope.vendorId
      || cardScope.productLineId !== observationScope.productLineId
      || cardScope.rankingClass !== observationScope.rankingClass
    ) {
      findings.push({ observationId: observation.id, issue: 'Observation scope provenance does not exactly match its source card.' });
      return;
    }
    if (isValidSourceCatalogScope(cardScope)) {
      sourceCatalogObservationCount += 1;
      return;
    }
    const key = `${cardScope.vendorId}:${cardScope.productLineId}`;
    observationCounts[key] = (observationCounts[key] || 0) + 1;
  });

  if (findings.length) {
    failures.push({
      scope: 'oagxm',
      issue: 'OAGXM scope validation failed.',
      findings: findings.slice(0, 100),
      totalFindingCount: findings.length,
    });
  }

  const unobservedProductLines = [...lineIndex.entries()]
    .filter(([, { productLine }]) => productLine.tier !== 'restricted')
    .filter(([key]) => !cardCounts[key])
    .map(([key, { vendor, productLine }]) => ({
      key,
      vendorId: vendor.id,
      productLineId: productLine.id,
      name: productLine.name,
      tier: productLine.tier,
      rankingClass: productLine.rankingClass,
    }));
  if (unobservedProductLines.length) {
    warnings.push({
      scope: 'oagxm',
      issue: 'A configured scope product line had no record in any of the three sources for this snapshot.',
      productLines: unobservedProductLines,
    });
  }

  const productLines = [...lineIndex.values()].map(({ productLine }) => productLine);

  return {
    scopeId: scope.scopeId,
    scopeVersion: scope.schemaVersion,
    benchmarkBoundary: scope.benchmarkBoundary,
    sourceCardCountsByProductLine: cardCounts,
    observationCountsByProductLine: observationCounts,
    unobservedProductLines,
    formalTextAgentProductLineCount: productLines.filter((line) => line.rankingClass === 'formal_text_agent').length,
    specializedCatalogOnlyProductLineCount: productLines.filter((line) => line.rankingClass === 'specialized_catalog_only').length,
    sourceCatalogCardCount,
    sourceCatalogObservationCount,
    findingCount: findings.length,
  };
}

function hasExpectedSourceHost(url, source) {
  if (!isNonEmptyString(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === EXPECTED_HOST_BY_SOURCE[source] || parsed.hostname.endsWith(`.${EXPECTED_HOST_BY_SOURCE[source]}`));
  } catch {
    return false;
  }
}

function selectCanonicalSourceRow(rows, selectionByRecordId) {
  const sorted = [...rows].sort((left, right) => {
    const leftRank = Number.isFinite(left.sourceRecord?.rank) ? left.sourceRecord.rank : Number.MAX_SAFE_INTEGER;
    const rightRank = Number.isFinite(right.sourceRecord?.rank) ? right.sourceRecord.rank : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftVotes = Number.isFinite(left.votes) ? left.votes : -1;
    const rightVotes = Number.isFinite(right.votes) ? right.votes : -1;
    if (leftVotes !== rightVotes) return rightVotes - leftVotes;

    return rows.indexOf(left) - rows.indexOf(right);
  });

  const explicitlySelected = sorted.find((row) => selectionByRecordId.has(row.sourceRecordId));
  return explicitlySelected ?? sorted[0];
}

function auditArena(rawManifest, scope, cards, observations, failures, warnings) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const arenaCards = cards.filter((card) => card.source === 'arena');
  const arenaObservationRows = observations
    .map((observation) => ({ observation, card: cardsById.get(observation.sourceModelCardId) }))
    .filter(({ card }) => card?.source === 'arena');
  const metrics = {};
  let sourceUniqueSum = 0;
  let databaseUniqueSum = 0;
  let databaseAvailableRowCount = 0;

  for (const metricId of ARENA_METRICS) {
    const rawMetric = rawManifest.metrics?.[metricId];
    if (!rawMetric || !Array.isArray(rawMetric.rows)) {
      failures.push({ scope: 'arena', metricId, issue: 'Missing raw source manifest metric.' });
      metrics[metricId] = {
        extractedRowCount: 0,
        duplicateRowCount: 0,
        uniqueModelCount: 0,
        databaseAvailableCount: 0,
        status: 'INVALID',
      };
      continue;
    }

    const invalidSourceRows = rawMetric.rows.filter((row) => (
      !isNonEmptyString(row.exactSourceModelName)
      || !isFiniteNumber(row.rawValue)
      || !isNonEmptyString(row.sourceUrl)
      || !isNonEmptyString(row.sourceRecordId)
    ));
    if (invalidSourceRows.length > 0) {
      failures.push({ scope: 'arena', metricId, issue: 'Raw manifest contains unavailable or unproven source rows.', count: invalidSourceRows.length });
    }

    // Validate the raw extraction's own global deduplication facts first.  The
    // source manifest intentionally retains the whole public leaderboard;
    // the catalog below is the explicitly scoped OAGXM subset.
    const sourceGroups = new Map();
    rawMetric.rows.forEach((row) => {
      if (!isNonEmptyString(row.exactSourceModelName)) return;
      const key = canonicalModelName(row.exactSourceModelName);
      const group = sourceGroups.get(key) ?? [];
      group.push(row);
      sourceGroups.set(key, group);
    });

    const selectionByRecordId = new Set(
      (rawMetric.deduplication?.duplicateGroups ?? [])
        .map((group) => group.selectedSourceRecordId)
        .filter(isNonEmptyString),
    );
    const selectedSourceRows = new Map();
    sourceGroups.forEach((rows) => {
      const selectedRow = selectCanonicalSourceRow(rows, selectionByRecordId);
      selectedSourceRows.set(selectedRow.sourceRecordId, selectedRow);
    });

    const calculatedDuplicateRowCount = rawMetric.rows.length - sourceGroups.size;
    const manifestDuplicateRowCount = rawMetric.deduplication?.duplicateRowCount;
    const manifestUniqueModelCount = rawMetric.deduplication?.uniqueModelCount;
    if (manifestDuplicateRowCount !== calculatedDuplicateRowCount || manifestUniqueModelCount !== sourceGroups.size) {
      failures.push({
        scope: 'arena',
        metricId,
        issue: 'Raw manifest deduplication summary does not match its retained source rows.',
        expected: { duplicateRowCount: calculatedDuplicateRowCount, uniqueModelCount: sourceGroups.size },
        actual: { duplicateRowCount: manifestDuplicateRowCount, uniqueModelCount: manifestUniqueModelCount },
      });
    }

    // Reconciliation uses the canonical subset selected from the full source
    // manifest, just as the catalog builder does.  This avoids a positional
    // join and keeps duplicate handling stable even when the source contains
    // multiple rows with the same display name.
    const scopedSourceRows = rawMetric.rows.filter((row) => arenaRowScope(scope, row));
    const selectedScopedSourceRows = new Map(
      [...selectedSourceRows.entries()].filter(([, row]) => arenaRowScope(scope, row)),
    );
    const scopedDuplicateRowCount = scopedSourceRows.length - selectedScopedSourceRows.size;

    const databaseRows = arenaObservationRows
      .filter(({ observation, card }) => (
        observation.metricId === metricId
        && isFiniteNumber(observation.rawValue)
        && scopeMetadataOf(card)?.scopeId === scope.scopeId
        && scopeMetadataOf(card)?.scopeVersion === scope.schemaVersion
      ));
    const databaseGroups = new Map();
    databaseRows.forEach((entry) => {
      // The source record ID, not the catalog card label, is the authoritative
      // join key. Agent Arena uses display names while the unified catalog uses
      // a normalized card label; joining by array index or display label would
      // produce false mismatches and cannot prove the score's origin.
      const key = sourceRecordIdOf(entry.observation) ?? `missing-source-record:${entry.observation.id}`;
      const group = databaseGroups.get(key) ?? [];
      group.push(entry);
      databaseGroups.set(key, group);
    });
    const databaseDuplicateRows = databaseRows.length - databaseGroups.size;
    if (databaseDuplicateRows !== 0) {
      failures.push({ scope: 'arena', metricId, issue: 'Database retains duplicate available observations after source dedupe.', duplicateRowCount: databaseDuplicateRows });
    }

    const missingInDatabase = [];
    const extraInDatabase = [];
    const valueMismatches = [];
    const provenanceMismatches = [];

    selectedScopedSourceRows.forEach((sourceRow, sourceRecordId) => {
      const databaseGroup = databaseGroups.get(sourceRecordId);
      if (!databaseGroup?.length) {
        missingInDatabase.push(sourceRow.exactSourceModelName);
        return;
      }

      const databaseRow = databaseGroup[0].observation;
      if (!stableNumberEquals(databaseRow.rawValue, sourceRow.rawValue)) {
        valueMismatches.push({
          exactSourceModelName: sourceRow.exactSourceModelName,
          sourceRawValue: sourceRow.rawValue,
          databaseRawValue: databaseRow.rawValue,
        });
      }
      if (
        databaseRow.sourceUrl !== sourceRow.sourceUrl
        || sourceLeaderboardOf(databaseRow, databaseGroup[0].card) !== rawMetric.sourceLeaderboard
        || sourceRecordIdOf(databaseRow) !== sourceRow.sourceRecordId
      ) {
        provenanceMismatches.push({
          exactSourceModelName: sourceRow.exactSourceModelName,
          expectedSourceRecordId: sourceRow.sourceRecordId,
          actualSourceRecordId: sourceRecordIdOf(databaseRow),
        });
      }
    });

    databaseGroups.forEach((entries, sourceRecordId) => {
      if (!selectedScopedSourceRows.has(sourceRecordId)) extraInDatabase.push(entries[0].card.exactSourceModelName);
    });

    if (missingInDatabase.length || extraInDatabase.length || valueMismatches.length || provenanceMismatches.length) {
      failures.push({
        scope: 'arena',
        metricId,
        issue: 'Source-to-database reconciliation failed; this also detects positional array mismatch.',
        missingInDatabase: missingInDatabase.slice(0, 20),
        extraInDatabase: extraInDatabase.slice(0, 20),
        valueMismatches: valueMismatches.slice(0, 20),
        provenanceMismatches: provenanceMismatches.slice(0, 20),
      });
    }

    const metricStatus = invalidSourceRows.length === 0
      && databaseDuplicateRows === 0
      && missingInDatabase.length === 0
      && extraInDatabase.length === 0
      && valueMismatches.length === 0
      && provenanceMismatches.length === 0
      ? 'VALID'
      : 'INVALID';
    metrics[metricId] = {
      sourceUrl: rawMetric.sourceUrl,
      sourceLeaderboard: rawMetric.sourceLeaderboard,
      // These four fields are the scope-reconciled facts used for the
      // database comparison.  They deliberately do not compare a full
      // leaderboard's row count to a scoped catalog.
      extractedRowCount: scopedSourceRows.length,
      duplicateRowCount: scopedDuplicateRowCount,
      uniqueModelCount: selectedScopedSourceRows.size,
      databaseAvailableCount: databaseGroups.size,
      databaseAvailableRowCount: databaseRows.length,
      // Preserve the full raw-source facts for traceability.  For example,
      // the current WebDev snapshot has 118 extracted / 1 duplicate / 117
      // unique rows even when only its OAGXM rows are admitted to this catalog.
      sourceExtractedRowCount: rawMetric.rows.length,
      sourceDuplicateRowCount: calculatedDuplicateRowCount,
      sourceUniqueModelCount: sourceGroups.size,
      outOfScopeRowCount: rawMetric.rows.length - scopedSourceRows.length,
      sourceToDatabaseMatch: metricStatus === 'VALID',
      status: metricStatus,
    };

    sourceUniqueSum += selectedScopedSourceRows.size;
    databaseUniqueSum += databaseGroups.size;
    databaseAvailableRowCount += databaseRows.length;
  }

  const conservation = {
    expectedMetricCount: ARENA_METRICS.length,
    auditedMetricCount: Object.keys(metrics).length,
    sourceUniqueAvailableSum: sourceUniqueSum,
    databaseUniqueAvailableSum: databaseUniqueSum,
    databaseAvailableRowCount,
    valid: sourceUniqueSum === databaseUniqueSum && databaseUniqueSum === databaseAvailableRowCount,
  };
  if (!conservation.valid) {
    failures.push({
      scope: 'arena',
      issue: 'Total effective observations must equal the sum of the 13 per-metric unique available counts.',
      ...conservation,
    });
  }

  const webdev = metrics.arena_code_webdev;
  if (webdev?.sourceExtractedRowCount !== 118 || webdev?.sourceDuplicateRowCount !== 1 || webdev?.sourceUniqueModelCount !== 117) {
    warnings.push({
      scope: 'arena',
      issue: 'WebDev source changes may be legitimate, but the recorded full-source snapshot does not have the expected 118 / 1 / 117 audit facts.',
      actual: webdev,
    });
  }

  return {
    expectedMetricIds: ARENA_METRICS,
    arenaCardCount: arenaCards.length,
    metrics,
    conservation,
  };
}

function catalogInputModeForCard(card) {
  const selectionMethod = sourceIdentityOfCard(card).selectionMethod;
  return isNonEmptyString(selectionMethod) ? selectionMethod.trim() : 'not-recorded';
}

function inputFreshnessClass(inputMode) {
  const normalized = inputMode.toLocaleLowerCase('en-US');
  if (normalized.includes('verified-source-catalog snapshot')) return 'verified_catalog_snapshot';
  if (normalized.includes('snapshot')) return 'official_source_snapshot';
  if (normalized.includes('raw-extraction') || normalized.includes('live')) return 'direct_source_extraction';
  return 'unclassified';
}

function summarizeCatalogInputs(cards, observations) {
  const cardModes = new Map();
  const modeCounts = new Map();

  cards.forEach((card) => {
    const inputMode = catalogInputModeForCard(card);
    const key = `${card.source}\u0000${inputMode}`;
    const entry = modeCounts.get(key) ?? {
      source: card.source,
      inputMode,
      freshnessClass: inputFreshnessClass(inputMode),
      cardCount: 0,
      availableObservationCount: 0,
    };
    entry.cardCount += 1;
    modeCounts.set(key, entry);
    cardModes.set(card.id, key);
  });

  observations.forEach((observation) => {
    if (!isFiniteNumber(observation.rawValue)) return;
    const key = cardModes.get(observation.sourceModelCardId);
    const entry = key ? modeCounts.get(key) : null;
    if (entry) entry.availableObservationCount += 1;
  });

  const modes = [...modeCounts.values()].sort((left, right) => (
    left.source.localeCompare(right.source) || left.inputMode.localeCompare(right.inputMode)
  ));
  const snapshotCardCount = modes
    .filter((entry) => entry.freshnessClass.endsWith('_snapshot'))
    .reduce((sum, entry) => sum + entry.cardCount, 0);
  const unknownCardCount = modes
    .filter((entry) => entry.freshnessClass === 'unclassified')
    .reduce((sum, entry) => sum + entry.cardCount, 0);
  const hasDirectSourceExtraction = modes.some((entry) => entry.freshnessClass === 'direct_source_extraction');
  const isFullLiveSourceRefresh = modes.length > 0 && snapshotCardCount === 0 && unknownCardCount === 0;

  let refreshStatus;
  let disclosure;
  if (unknownCardCount > 0) {
    refreshStatus = 'UNCLASSIFIED_INPUT';
    disclosure = 'One or more catalog cards have no classified input mode; provenance is audited, but source freshness cannot be certified.';
  } else if (snapshotCardCount > 0 && hasDirectSourceExtraction) {
    refreshStatus = 'MIXED_SNAPSHOT_REBUILD';
    disclosure = 'The catalog mixes direct raw extraction with official-source and/or verified-catalog snapshots. This audit validates provenance and reconciliation, not a fully live three-source refresh.';
  } else if (snapshotCardCount > 0) {
    refreshStatus = 'SNAPSHOT_REBUILD';
    disclosure = 'The catalog was rebuilt from source snapshots. This audit validates provenance and reconciliation, not a fully live three-source refresh.';
  } else {
    refreshStatus = 'DIRECT_SOURCE_EXTRACTION';
    disclosure = 'All catalog cards record direct source extraction input modes.';
  }

  return {
    refreshStatus,
    isFullLiveSourceRefresh,
    disclosure,
    snapshotCardCount,
    unknownInputModeCardCount: unknownCardCount,
    modes,
  };
}

function auditCatalog(cards, observations, failures, warnings) {
  const cardsById = new Map();
  const duplicateCardIds = [];
  cards.forEach((card) => {
    if (cardsById.has(card.id)) duplicateCardIds.push(card.id);
    cardsById.set(card.id, card);
  });
  if (duplicateCardIds.length) failures.push({ scope: 'catalog', issue: 'Duplicate card IDs.', cardIds: duplicateCardIds.slice(0, 20) });

  const platformCardCounts = { artificial_analysis: 0, arena: 0, openrouter: 0 };
  const availableObservationCounts = { artificial_analysis: 0, arena: 0, openrouter: 0 };
  const validationFailures = [];
  const factualZeroOrFifty = [];
  const inputs = summarizeCatalogInputs(cards, observations);

  observations.forEach((observation) => {
    const card = cardsById.get(observation.sourceModelCardId);
    if (!card) {
      validationFailures.push({ observationId: observation.id, issue: 'Observation references no source card.' });
      return;
    }
    if (Object.hasOwn(platformCardCounts, card.source)) platformCardCounts[card.source] += 0;
    if (!isFiniteNumber(observation.rawValue)) return;

    if (Object.hasOwn(availableObservationCounts, card.source)) availableObservationCounts[card.source] += 1;
    const expectedSource = expectedSourceForMetric(observation.metricId);
    const sourceLeaderboard = sourceLeaderboardOf(observation, card);
    const sourceRecordId = sourceRecordIdOf(observation);
    const sourceField = sourceFieldOf(observation);
    const sourceRecord = sourceRecordOf(observation);
    const metadata = metadataOf(observation);
    const sourceMetadataText = JSON.stringify(metadata).toLocaleLowerCase('en-US');

    if (!expectedSource || expectedSource !== card.source) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Metric ownership does not match source card.', expectedSource, actualSource: card.source });
    }
    if (!hasExpectedSourceHost(observation.sourceUrl, card.source)) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Missing or non-official source URL.', sourceUrl: observation.sourceUrl });
    }
    if (!isNonEmptyString(sourceLeaderboard)) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Missing source leaderboard / evaluation locator.' });
    }
    if (!isNonEmptyString(sourceRecordId) || !isNonEmptyString(sourceField)) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Missing source record ID or source field.' });
    }
    if (isFiniteNumber(metadata.reportedRawValue) && !stableNumberEquals(observation.rawValue, metadata.reportedRawValue)) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Stored raw value differs from the reported source value.', rawValue: observation.rawValue, reportedRawValue: metadata.reportedRawValue });
    }
    if (/synthetic.{0,30}(?:observation|score)|fallback.{0,30}score|default.{0,30}score|generated.{0,30}score|demo.{0,30}score/i.test(sourceMetadataText)) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Observation provenance contains a prohibited placeholder marker.' });
    }
    if ((observation.rawValue === 0 || observation.rawValue === 50) && (!isNonEmptyString(sourceRecordId) || !isNonEmptyString(sourceField))) {
      validationFailures.push({ observationId: observation.id, metricId: observation.metricId, issue: 'Unproven 0 or 50 value could be a default placeholder.' });
    } else if (observation.rawValue === 0 || observation.rawValue === 50) {
      factualZeroOrFifty.push({ observationId: observation.id, metricId: observation.metricId, rawValue: observation.rawValue, sourceRecordId, sourceField, hasSourceRecord: Boolean(sourceRecord) });
    }
  });

  cards.forEach((card) => {
    if (Object.hasOwn(platformCardCounts, card.source)) platformCardCounts[card.source] += 1;
  });
  if (validationFailures.length) failures.push({ scope: 'catalog', issue: 'Available observation provenance or source ownership validation failed.', findings: validationFailures.slice(0, 100), totalFindingCount: validationFailures.length });

  if (!inputs.isFullLiveSourceRefresh) {
    warnings.push({
      scope: 'catalog',
      issue: 'Catalog input freshness is not a fully live three-source refresh; see catalog input modes and disclosure.',
      refreshStatus: inputs.refreshStatus,
      disclosure: inputs.disclosure,
      modes: inputs.modes,
    });
  }

  return {
    sourceModelCardCount: cards.length,
    observationCount: observations.length,
    platformCardCounts,
    availableObservationCounts,
    availableObservationProvenanceFindingCount: validationFailures.length,
    unprovenDefaultZeroOrFiftyCount: validationFailures.filter((finding) => finding.issue.includes('0 or 50')).length,
    sourceProvenFactualZeroOrFiftyCount: factualZeroOrFifty.length,
    inputs,
  };
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFilesIn(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const fullPath = resolve(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist'].includes(entry)) visit(fullPath);
      } else if (['.ts', '.tsx'].includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  };
  visit(directory);
  return files;
}

function runtimeReachableFiles(sourceRoot) {
  const candidates = sourceFilesIn(sourceRoot);
  const byStem = new Map();
  candidates.forEach((filename) => byStem.set(filename.replace(/\.(tsx?|ts)$/, ''), filename));
  const seen = new Set();
  const visit = (filename) => {
    if (seen.has(filename) || !existsSync(filename)) return;
    seen.add(filename);
    const source = readFileSync(filename, 'utf8');
    const expression = /(?:from\s*|import\s*)["'](\.[^"']+)["']/g;
    let match;
    while ((match = expression.exec(source)) !== null) {
      const target = resolve(dirname(filename), match[1]);
      const resolved = byStem.get(target)
        ?? byStem.get(resolve(target, 'index'));
      if (resolved) visit(resolved);
    }
  };
  visit(resolve(sourceRoot, 'main.tsx'));
  return seen;
}

function auditRuntimePaths(failures) {
  const sourceRoot = resolve(repositoryRoot, 'src');
  const files = sourceFilesIn(sourceRoot);
  const reachable = runtimeReachableFiles(sourceRoot);
  const runtimeMatches = [];
  const unreachableMatches = [];

  files.forEach((filename) => {
    const executableSource = stripComments(readFileSync(filename, 'utf8'));
    SYNTHETIC_RUNTIME_PATTERNS.forEach(([label, pattern]) => {
      if (!pattern.test(executableSource)) return;
      const finding = { file: filename.replace(`${repositoryRoot}/`, ''), pattern: label };
      if (reachable.has(filename)) runtimeMatches.push(finding);
      else unreachableMatches.push(finding);
    });
  });

  const scoringEngine = existsSync(resolve(sourceRoot, 'engine', 'scoringEngine.ts'))
    ? stripComments(readFileSync(resolve(sourceRoot, 'engine', 'scoringEngine.ts'), 'utf8'))
    : '';
  const radarChart = existsSync(resolve(sourceRoot, 'components', 'RadarChart.tsx'))
    ? stripComments(readFileSync(resolve(sourceRoot, 'components', 'RadarChart.tsx'), 'utf8'))
    : '';
  const legacyMissingScoreFallback = (
    /rawCapabilityScore\s*:\s*[^,\n]*(?:\?\?|\|\|)\s*50/.test(scoringEngine)
    || /domainScore\s*:\s*[^,\n]*(?:\?\?|\|\|)\s*50/.test(scoringEngine)
  );
  const radarMissingScoreFallback = /domainScore\s*\?\?\s*50/.test(radarChart);

  if (runtimeMatches.length) failures.push({ scope: 'runtime', issue: 'Synthetic/default score code remains reachable in the production import graph.', findings: runtimeMatches });
  if (legacyMissingScoreFallback) failures.push({ scope: 'runtime', issue: 'scoringEngine still assigns 50 to missing metrics.' });
  if (radarMissingScoreFallback) failures.push({ scope: 'runtime', issue: 'RadarChart still renders a missing domain as 50.' });

  return {
    productionReachableFileCount: reachable.size,
    prohibitedRuntimePatternFindings: runtimeMatches,
    prohibitedUnreachablePatternFindings: unreachableMatches,
    missingMetricDefaultsTo50: legacyMissingScoreFallback,
    radarMissingDomainDefaultsTo50: radarMissingScoreFallback,
  };
}

function markdown(report) {
  const lines = [
    '# Arena data self-audit',
    '',
    `- Audit status: **${report.auditStatus}**`,
    '- Audit status validates provenance, score integrity, and Arena reconciliation; it is not by itself a claim that every upstream source was fetched live in this run.',
    `- Audit time: ${report.auditTimestamp}`,
    `- Raw extraction: \`${report.inputs.rawExtractionPath}\` (${report.inputs.rawExtractionSchemaVersion})`,
    `- Catalog: \`${report.inputs.seedCardsPath}\``,
    `- Scope: \`${report.scope.scopeId}\` (${report.scope.scopeVersion})`,
    `- Catalog refresh status: **${report.catalog.inputs.refreshStatus}**`,
    `- Catalog freshness disclosure: ${report.catalog.inputs.disclosure}`,
    '',
    '## OAGXM current-product scope',
    '',
    `- Scope provenance findings: ${report.scope.findingCount}`,
    `- Product lines with no source record in this snapshot: ${report.scope.unobservedProductLines.length}`,
    `- General source-catalog records outside this curated scope: ${report.scope.sourceCatalogCardCount} cards / ${report.scope.sourceCatalogObservationCount} observations; card and observation scopes still reconcile exactly.`,
    report.scope.specializedCatalogOnlyProductLineCount > 0
      ? `- ${report.scope.formalTextAgentProductLineCount} formal text/agent lines and ${report.scope.specializedCatalogOnlyProductLineCount} specialized catalog-only lines are kept distinct; specialized lines cannot acquire missing AA/Arena scores.`
      : `- All ${report.scope.formalTextAgentProductLineCount} configured product lines are formal text/agent models; no image/audio/safety-only line is admitted to this capability scope.`,
    '',
    '## Arena per-metric reconciliation',
    '',
    'The `source*` columns retain complete public-leaderboard extraction facts. The unprefixed columns are the explicit OAGXM scope admitted to the database and are the values compared for validation.',
    '',
    '| Metric | sourceExtractedRowCount | sourceDuplicateRowCount | sourceUniqueModelCount | extractedRowCount | duplicateRowCount | uniqueModelCount | databaseAvailableCount | Status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...ARENA_METRICS.map((metricId) => {
      const metric = report.arena.metrics[metricId];
      return `| ${metricId} | ${metric.sourceExtractedRowCount} | ${metric.sourceDuplicateRowCount} | ${metric.sourceUniqueModelCount} | ${metric.extractedRowCount} | ${metric.duplicateRowCount} | ${metric.uniqueModelCount} | ${metric.databaseAvailableCount} | ${metric.status} |`;
    }),
    '',
    `Total effective Arena observations: ${report.arena.conservation.databaseAvailableRowCount}; sum of 13 unique available counts: ${report.arena.conservation.sourceUniqueAvailableSum}; conservation: ${report.arena.conservation.valid ? 'PASS' : 'FAIL'}.`,
    '',
    '## Catalog provenance',
    '',
    `- Cards: ${report.catalog.sourceModelCardCount} (AA ${report.catalog.platformCardCounts.artificial_analysis}, Arena ${report.catalog.platformCardCounts.arena}, OpenRouter ${report.catalog.platformCardCounts.openrouter})`,
    `- Available observations: ${report.catalog.observationCount} (AA ${report.catalog.availableObservationCounts.artificial_analysis}, Arena ${report.catalog.availableObservationCounts.arena}, OpenRouter ${report.catalog.availableObservationCounts.openrouter})`,
    `- Provenance / source ownership findings: ${report.catalog.availableObservationProvenanceFindingCount}`,
    `- Unproven default 0 / 50 values: ${report.catalog.unprovenDefaultZeroOrFiftyCount}`,
    `- Full live three-source refresh: ${report.catalog.inputs.isFullLiveSourceRefresh ? 'yes' : 'no'}`,
    `- Source input modes:`,
    ...report.catalog.inputs.modes.map((mode) => `  - ${mode.source}: ${mode.inputMode} — ${mode.cardCount} cards, ${mode.availableObservationCount} available observations (${mode.freshnessClass})`),
    '',
    '## Integrity checks',
    '',
    `- Local generated score code in production paths: ${report.runtime.prohibitedRuntimePatternFindings.length === 0 ? 'none found' : 'FOUND'}`,
    `- Missing metric treated as 50: ${report.runtime.missingMetricDefaultsTo50 ? 'FOUND' : 'not found'}`,
    `- Radar missing domain rendered as 50: ${report.runtime.radarMissingDomainDefaultsTo50 ? 'FOUND' : 'not found'}`,
    `- Array-position mismatch: ${report.failures.some((failure) => failure.issue?.includes('positional array mismatch')) ? 'FOUND' : 'not found'}`,
    '',
    '## Verdict',
    '',
    report.auditStatus === 'VALIDATED'
      ? `VALIDATED — every available catalog observation has verified source provenance; all 13 Arena metrics reconcile from raw source rows to the deduplicated database; no default 0/50, generated numeric data, or positional mismatch was found. Catalog refresh status remains **${report.catalog.inputs.refreshStatus}**; consult the input-mode disclosure above before treating this as a fully live source refresh.`
      : 'INVALID — Arena data must not enter the official leaderboard until every failure below is resolved and this audit is rerun.',
    '',
  ];

  if (report.failures.length) {
    lines.push('### Failures', '');
    report.failures.forEach((failure) => lines.push(`- ${failure.scope ?? 'audit'}: ${failure.issue}`));
    lines.push('');
  }
  if (report.warnings.length) {
    lines.push('### Warnings', '');
    report.warnings.forEach((warning) => lines.push(`- ${warning.scope ?? 'audit'}: ${warning.issue}`));
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function run() {
  if (!existsSync(rawExtractionPath)) throw new Error(`Missing raw Arena extraction manifest: ${rawExtractionPath}`);
  const rawManifest = JSON.parse(readFileSync(rawExtractionPath, 'utf8'));
  const oagxmScope = loadOagxmScope();
  const { cards, observations } = loadCatalog();
  const failures = [];
  const warnings = [];

  if (rawManifest.schemaVersion !== 'arena-raw-extraction/v1') {
    failures.push({ scope: 'arena', issue: 'Unexpected Arena raw extraction schema version.', actual: rawManifest.schemaVersion });
  }
  const scope = auditOagxmScope(oagxmScope, cards, observations, failures, warnings);
  const catalog = auditCatalog(cards, observations, failures, warnings);
  const arena = auditArena(rawManifest, oagxmScope, cards, observations, failures, warnings);
  const runtime = auditRuntimePaths(failures);
  const report = {
    schemaVersion: 'arena-data-self-audit/v3',
    auditTimestamp: new Date().toISOString(),
    auditStatus: failures.length === 0 ? 'VALIDATED' : 'INVALID',
    inputs: {
      seedCardsPath: seedCardsPath.replace(`${repositoryRoot}/`, ''),
      oagxmScopePath: oagxmScopePath.replace(`${repositoryRoot}/`, ''),
      rawExtractionPath: rawExtractionPath.replace(`${repositoryRoot}/`, ''),
      rawExtractionSchemaVersion: rawManifest.schemaVersion,
      rawExtractionTimestamp: rawManifest.extractedAt,
    },
    scope,
    catalog,
    arena,
    runtime,
    failures,
    warnings,
  };

  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownReportPath, markdown(report), 'utf8');
  console.log(`Arena self-audit: ${report.auditStatus}`);
  console.log(`JSON: ${jsonReportPath}`);
  console.log(`Markdown: ${markdownReportPath}`);
  console.log(`Failures: ${failures.length}; warnings: ${warnings.length}`);
  if (report.auditStatus !== 'VALIDATED') process.exitCode = 1;
}

run();
