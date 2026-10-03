import assert from 'node:assert/strict';
import retiredReaderConfigurationIds from './fixtures/retiredReaderConfigurationIds.json';
import { getEmbeddedConfidenceRadius } from '../src/data/metricUncertainty';
import { OAGXM_SCOPE } from '../src/data/oagxmScope';
import { VERIFIED_SOURCE_MODEL_CARDS, VERIFIED_SOURCE_OBSERVATIONS } from '../src/data/seedCards';
import {
  VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
  VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
} from '../src/data/harnessSeedCards';
import {
  codingAgentRecords,
  evaluationRecords,
} from '../src/data/artificialAnalysisSourceSnapshot.json';
import {
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
} from '../src/data/productionAgentModeSeedCards';
import {
  VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
  VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
} from '../src/data/reviewedFamilySeedCards';
import {
  VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
} from '../src/data/recoveredSourceSeedCards';
import {
  VERIFIED_REPLACEMENT_BENCHMARK_CARD_COUNT,
  VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_MODEL_CARDS,
  VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS,
} from '../src/data/replacementBenchmarkSeedCards';
import {
  isCapabilityMetricApplicableToConfiguration,
  isCapabilityMetricCompatibleWithSourceLink,
  isHarnessOnlyCapabilityMetric,
  isPlainChatHarness,
  isValidExecutionHarnessFallback,
} from '../src/data/executionMetricPolicy';
import {
  ALL_CONFIGURATION_PRESET_CANDIDATES,
  BUILT_IN_CONFIGURATION_CURATION_ROWS,
  BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS,
  BUILT_IN_CONFIGURATION_MAX_PER_MODEL,
  BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS,
  BUILT_IN_CONFIGURATION_PRESETS,
  BUILT_IN_CONFIGURATION_RELEASE_CUTOFF,
  READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINE_IDS,
  buildPresetCoverageProfiles,
  type BuiltInConfigurationPreset,
} from '../src/data/builtInConfigurationPresets';
import type {
  ConfigurationBackupCardReference,
  ConfigurationBox,
  ConfigurationIdentity,
  ConfigurationSourceLink,
  ConfigurationSourceLinkProvenance,
  SourceModelCard,
  SourceObservation,
} from '../src/types/admin_mapping';

const retiredReaderPresetIds = new Set<string>(retiredReaderConfigurationIds);
function assertRetiredPresetIsNotShipped(presetId: string): boolean {
  if (!retiredReaderPresetIds.has(presetId)) return false;
  assert.ok(!BUILT_IN_CONFIGURATION_PRESETS.some((preset) => preset.id === presetId),
    `Retired route ${presetId} must remain outside the reader inventory.`);
  return true;
}
for (const presetId of retiredReaderPresetIds) assertRetiredPresetIsNotShipped(presetId);
assert.equal(BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS.length, 0,
  'Historical-comparator exceptions were cancelled by the reader.');

/** A minimal browser Storage implementation so this test exercises real migrations. */
class MemoryStorage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.entries.set(String(key), String(value));
  }
}

interface StackPair {
  lower: SourceModelCard;
  upper: SourceModelCard;
  supportingCard: SourceModelCard;
  sharedMetricId: string;
  lowerValue: number;
  upperValue: number;
}

const baseCards = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
const baseObservations = JSON.parse(VERIFIED_SOURCE_OBSERVATIONS) as SourceObservation[];
const cards = [
  ...baseCards,
  ...VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
  ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
  ...VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
  ...VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
];
const observations = [
  ...baseObservations,
  ...VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
  ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
  ...VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
  ...VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
];
const observationsByCard = new Map<string, SourceObservation[]>();
for (const observation of observations) {
  const cardObservations = observationsByCard.get(observation.sourceModelCardId) || [];
  cardObservations.push(observation);
  observationsByCard.set(observation.sourceModelCardId, cardObservations);
}

assert.ok(VERIFIED_REPLACEMENT_BENCHMARK_CARD_COUNT > 53, 'Current FrontierCode effort rows extend preserved historical source cards.');
assert.deepEqual(
  Object.fromEntries(
    ['scale_labs', 'terminal_bench', 'swe_rebench', 'frontier_code'].map((source) => [
      source,
      VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_MODEL_CARDS.filter((card) => card.source === source && !card.id.startsWith('card-frontiercode-current-')).length,
    ]),
  ),
  {
    scale_labs: 5,
    terminal_bench: 15,
    swe_rebench: 9,
    frontier_code: 24,
  },
  'The replacement snapshot must retain every manually verified official leaderboard row.',
);
const astraTerminalBenchObservation = VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS.find(
  (observation) => (
    observation.sourceModelCardId === 'card-tbench-gpt-6-astra-max-codex'
    && observation.metricId === 'tbench_v4'
  ),
);
assert.ok(astraTerminalBenchObservation);
assert.equal(astraTerminalBenchObservation.rawValue, 0.582);
assert.ok(Math.abs((astraTerminalBenchObservation.confidenceLow || 0) - 0.554) < 1e-12);
assert.ok(Math.abs((astraTerminalBenchObservation.confidenceHigh || 0) - 0.61) < 1e-12);
const sweRebenchSolObservation = VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS.find(
  (observation) => (
    observation.sourceModelCardId === 'card-swe-rebench-v2-gpt-5-6-sol-medium'
    && observation.metricId === 'swe_rebench_v2'
  ),
);
assert.ok(sweRebenchSolObservation);
assert.equal(sweRebenchSolObservation.rawValue, 0.623);
assert.equal(sweRebenchSolObservation.confidenceLow, undefined);
assert.equal(sweRebenchSolObservation.confidenceHigh, undefined);
assert.equal(sweRebenchSolObservation.metadataJson?.uncertaintyKind, 'SEM');

for (const metricId of [
  'aa_terminalbench_v4',
  'aa_gdp_pdf_all_pass',
  'aa_ifbench',
  'aa_apex_agents',
  'aa_itbench_sre',
  'aa_mmmu_pro',
  'aa_briefcase',
  'aa_automationbench',
  'aa_harvey_lab',
  'aa_enterprise_ops_gym',
]) {
  assert.ok(
    observations.some((observation) => (
      observation.metricId === metricId
      && typeof observation.rawValue === 'number'
      && Number.isFinite(observation.rawValue)
    )),
    `The verified catalog must expose ${metricId} to configuration detail pages.`,
  );
}
assert.deepEqual(
  VERIFIED_RECOVERED_SOURCE_MODEL_CARDS.map((card) => card.id),
  ['card-recovered-aa-longcat-2-0'],
  'The exact LongCat 2.0 AA record omitted by the general generator must be recovered once.',
);
assert.equal(
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS.length,
  11,
  'LongCat 2.0 recovery must retain every currently published numeric field without filling missing GDPval or speed values.',
);
assert.ok(
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS.some((observation) => (
    observation.metricId === 'aa_tau3_banking'
  )),
  'LongCat 2.0 must retain the τ³-Banking value newly published by the refreshed source.',
);
const aaBriefcaseRecords = evaluationRecords['aa-briefcase'] || [];
assert.ok(
  aaBriefcaseRecords.length > 19,
  'AA-Briefcase must use the complete public leaderboard rather than the 19-row initial chart subset.',
);
for (const expectedName of ['Grok 4.6 (xhigh)', 'Qwen3.8 Max']) {
  const record = aaBriefcaseRecords.find((candidate) => (
    candidate.name.toLocaleLowerCase('en-US') === expectedName.toLocaleLowerCase('en-US')
  ));
  assert.ok(record, `AA-Briefcase must retain the public ${expectedName} row.`);
  assert.equal(typeof record.briefcaseElo, 'number');
}

for (const expectation of [
  {
    cardId: 'card-aa-coding-agent-codex-deepseek-v4-flash-0731-max',
    sourceDisplayLabel: 'Codex - DeepSeek V4 Flash 0731 (max)',
    sourceHarnessLabel: 'Codex',
    harnessName: 'Codex CLI',
  },
  {
    cardId: 'card-aa-coding-agent-opencode-gemini-3-6-flash-high',
    sourceDisplayLabel: 'Opencode - Gemini 3.6 Flash (high)',
    sourceHarnessLabel: 'Opencode',
    harnessName: 'OpenCode',
  },
  {
    cardId: 'card-aa-coding-agent-claude-code-qwen3-8-max',
    sourceDisplayLabel: 'Claude Code - Qwen3.8 Max',
    sourceHarnessLabel: 'Claude Code',
    harnessName: 'Claude Code',
  },
] as const) {
  const card = VERIFIED_HARNESS_SOURCE_MODEL_CARDS.find(
    (candidate) => candidate.id === expectation.cardId,
  );
  assert.ok(card, `Corrected AA Agent Harness card ${expectation.cardId} must be projected.`);
  const currentSourceRow = codingAgentRecords.find((record) => (
    record.displayLabel === expectation.sourceDisplayLabel
  ));
  assert.ok(currentSourceRow, `${expectation.sourceDisplayLabel} must exist in the current AA snapshot.`);
  assert.equal(card.metadataJson?.sourceIdentity?.sourceRecordId, currentSourceRow.id);
  assert.equal(card.metadataJson?.sourceIdentity?.exactSourceModelName, expectation.sourceDisplayLabel);
  assert.equal(card.metadataJson?.sourceIdentity?.sourceHarnessLabel, expectation.sourceHarnessLabel);
  assert.equal(card.metadataJson?.sourceIdentity?.harnessName, expectation.harnessName);
  const metricIds = new Set(
    VERIFIED_HARNESS_SOURCE_OBSERVATIONS
      .filter((observation) => observation.sourceModelCardId === expectation.cardId)
      .map((observation) => observation.metricId),
  );
  for (const metricId of [
    'aa_coding_agent_index',
    'aa_coding_agent_swe_atlas_qna',
  ]) {
    assert.ok(metricIds.has(metricId), `${expectation.cardId} must expose ${metricId}.`);
  }
  const sourceDatasets = new Set(
    currentSourceRow.evals.map((evaluation) => evaluation.datasetIndexName),
  );
  assert.equal(
    metricIds.has('aa_coding_agent_deepswe'),
    sourceDatasets.has('deep-swe'),
    'DeepSWE v1.1 must not enter the older DeepSWE scoring slot.',
  );
  assert.equal(
    metricIds.has('aa_coding_agent_terminalbench_v2'),
    sourceDatasets.has('terminal-bench-v2') || sourceDatasets.has('terminal-bench-v2.1'),
    'Terminal-Bench 4.0 must not enter the older Terminal-Bench v2 scoring slot.',
  );
}

const scopeKey = (card: SourceModelCard): string => {
  const scope = card.metadataJson?.scope as Record<string, unknown> | undefined;
  return [scope?.vendorId, scope?.productLineId, scope?.rankingClass].join(':');
};

const numericObservations = (card: SourceModelCard): Map<string, number> => {
  const byMetric = new Map<string, number>();
  for (const observation of observationsByCard.get(card.id) || []) {
    if (typeof observation.rawValue === 'number' && Number.isFinite(observation.rawValue)) {
      byMetric.set(observation.metricId, observation.rawValue);
    }
  }
  return byMetric;
};

/**
 * Pick actual current catalog records rather than hand-made test cards. This
 * ensures the migration and provenance filters accept the very data shipped
 * to users, while finding a real same-source metric collision to test stack
 * precedence.
 */
const findStackPair = (): StackPair => {
  const capabilityCards = baseCards.filter((card) => (
    card.source === 'artificial_analysis' || card.source === 'arena'
  ));

  for (let lowerIndex = 0; lowerIndex < capabilityCards.length; lowerIndex += 1) {
    const lower = capabilityCards[lowerIndex];
    const lowerObservations = numericObservations(lower);
    for (let upperIndex = lowerIndex + 1; upperIndex < capabilityCards.length; upperIndex += 1) {
      const upper = capabilityCards[upperIndex];
      if (upper.source !== lower.source || scopeKey(upper) !== scopeKey(lower)) continue;

      const upperObservations = numericObservations(upper);
      const sharedMetric = [...lowerObservations.entries()].find(([metricId, lowerValue]) => {
        if (isHarnessOnlyCapabilityMetric(metricId)) return false;
        const upperValue = upperObservations.get(metricId);
        return typeof upperValue === 'number' && upperValue !== lowerValue;
      });
      if (!sharedMetric) continue;

      const supportingCard = baseCards.find((candidate) => (
        candidate.source !== lower.source && scopeKey(candidate) === scopeKey(lower)
      ));
      if (!supportingCard) continue;

      const [sharedMetricId, lowerValue] = sharedMetric;
      return {
        lower,
        upper,
        supportingCard,
        sharedMetricId,
        lowerValue,
        upperValue: upperObservations.get(sharedMetricId)!,
      };
    }
  }

  throw new Error('Current verified catalog has no same-source, same-scope cards with a real metric collision.');
};

const pair = findStackPair();

const backupReferenceFor = (card: SourceModelCard, includeSourceRecordId: boolean = true): ConfigurationBackupCardReference => {
  const scope = card.metadataJson?.scope as Record<string, unknown> | undefined;
  assert.ok(scope);
  const sourceRecordId = (card.metadataJson?.sourceIdentity as Record<string, unknown> | undefined)?.sourceRecordId
    ?? card.metadataJson?.sourceRecordId;
  return {
    source: card.source,
    exactSourceModelName: card.exactSourceModelName,
    ...(includeSourceRecordId && typeof sourceRecordId === 'string' ? { sourceRecordId } : {}),
    scope: {
      scopeId: String(scope.scopeId),
      scopeVersion: String(scope.scopeVersion),
      vendorId: String(scope.vendorId),
      productLineId: String(scope.productLineId),
      rankingClass: scope.rankingClass as 'formal_text_agent' | 'specialized_catalog_only',
    },
  };
};

const uniqueNameCard = cards.find((candidate) => cards.filter((other) => (
  other.source === candidate.source
  && scopeKey(other) === scopeKey(candidate)
  && other.exactSourceModelName === candidate.exactSourceModelName
)).length === 1);
assert.ok(uniqueNameCard, 'Expected a uniquely named verified card for backup fallback coverage.');
const differentScopeCard = cards.find((candidate) => scopeKey(candidate) !== scopeKey(uniqueNameCard));
assert.ok(differentScopeCard, 'Expected a second verified scope for mismatch coverage.');

const memoryStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: memoryStorage,
});

const legacyBox: ConfigurationBox = {
  id: 'legacy-stack-box',
  internalName: 'legacy_stack_model',
  displayName: 'Legacy Stack Model',
  note: 'Must survive v16 migration',
  enabled: true,
  createdAt: '2026-07-27',
  updatedAt: '2026-07-27',
};

// v16 link records intentionally have no priority. Their stored array order
// is the only reliable precedence evidence that a migration may preserve.
const legacyLinks = [
  {
    id: 'legacy-support-link',
    configurationId: legacyBox.id,
    source: pair.supportingCard.source,
    sourceModelCardId: pair.supportingCard.id,
    createdAt: '2026-07-27',
    updatedAt: '2026-07-27',
  },
  {
    id: 'legacy-lower-link',
    configurationId: legacyBox.id,
    source: pair.lower.source,
    sourceModelCardId: pair.lower.id,
    createdAt: '2026-07-27',
    updatedAt: '2026-07-27',
  },
] as unknown as ConfigurationSourceLink[];

memoryStorage.setItem('llmpk_admin_store_schema_version', '16');
memoryStorage.setItem('llmpk_admin_boxes_v16', JSON.stringify([legacyBox]));
memoryStorage.setItem('llmpk_admin_cards_v16', VERIFIED_SOURCE_MODEL_CARDS);
memoryStorage.setItem('llmpk_admin_links_v16', JSON.stringify(legacyLinks));
memoryStorage.setItem('llmpk_admin_obs_v16', VERIFIED_SOURCE_OBSERVATIONS);

// Import after seeding storage: the module-level store must execute the full
// v16-to-v17 migration exactly as it does in a browser refresh.
const {
  adminMappingStore: store,
  ADMIN_MAPPING_STORE_SCHEMA_VERSION,
  AdminMappingStore,
} = await import('../src/store/adminMappingStore');

assert.equal(ADMIN_MAPPING_STORE_SCHEMA_VERSION, 17);
assert.equal(memoryStorage.getItem('llmpk_admin_store_schema_version'), '17');
assert.equal(memoryStorage.getItem('llmpk_admin_boxes_v16'), null);
assert.equal(memoryStorage.getItem('llmpk_admin_links_v16'), null);
assert.equal(store.boxes.length, 1);
assert.deepEqual(store.boxes[0], legacyBox);
assert.equal(store.getLastDataCleanupReport().migrationApplied, true);

let stack = store.getLinkedCardStack(legacyBox.id);
assert.deepEqual(stack.map(({ link }) => link.id), ['legacy-support-link', 'legacy-lower-link']);
assert.deepEqual(stack.map(({ link }) => link.priority), [0, 1]);

// A second card from the same source is valid and starts at the top.
const upperLink = store.linkCardToBox(legacyBox.id, pair.upper.id);
assert.ok(upperLink);
stack = store.getLinkedCardStack(legacyBox.id);
assert.equal(stack.filter(({ card }) => card.source === pair.lower.source).length, 2);
assert.deepEqual(stack.map(({ link }) => link.priority), stack.map((_, index) => index));
assert.equal(stack[0].card.id, pair.upper.id);

let builtConfiguration = store.buildLLMConfiguration(legacyBox);
assert.equal(builtConfiguration.observations[pair.sharedMetricId]?.rawValue, pair.upperValue);

// Moving the upper card below the lower card reverses the winner for an
// overlapping metric. Other source cards may remain above both of them.
assert.equal(store.moveLink(upperLink.id, stack.length - 1), true);
stack = store.getLinkedCardStack(legacyBox.id);
assert.equal(stack[stack.length - 1].card.id, pair.upper.id);
builtConfiguration = store.buildLLMConfiguration(legacyBox);
assert.equal(builtConfiguration.observations[pair.sharedMetricId]?.rawValue, pair.lowerValue);

// Re-dropping an exact existing card is a bring-to-top action, not a duplicate.
const stackLengthBeforeRedrop = stack.length;
const redroppedLink = store.linkCardToBox(legacyBox.id, pair.upper.id);
assert.ok(redroppedLink);
assert.equal(redroppedLink.id, upperLink.id);
stack = store.getLinkedCardStack(legacyBox.id);
assert.equal(stack.length, stackLengthBeforeRedrop);
assert.equal(stack[0].card.id, pair.upper.id);
builtConfiguration = store.buildLLMConfiguration(legacyBox);
assert.equal(builtConfiguration.observations[pair.sharedMetricId]?.rawValue, pair.upperValue);

// A Configuration has three descriptive parts that travel with the box but
// never affect its source-card links or calculated observations.
const configurationIdentity: ConfigurationIdentity = {
  model: {
    name: 'Claude Opus 5',
    profile: 'Max',
    preset: 'API default',
  },
  harness: {
    name: 'OpenCode',
    environment: 'macOS',
  },
  provider: {
    name: 'OpenRouter',
    upstream: 'Anthropic API',
  },
};
const identifiedBox = store.updateBox(legacyBox.id, {
  identity: configurationIdentity,
  builtInPresetId: 'anthropic-claude-opus-5-max-opencode-openrouter',
});
assert.ok(identifiedBox);
assert.deepEqual(identifiedBox.identity, configurationIdentity);
assert.equal(identifiedBox.builtInPresetId, 'anthropic-claude-opus-5-max-opencode-openrouter');
const identifiedConfiguration = store.buildLLMConfiguration(identifiedBox);
assert.equal(identifiedConfiguration.identity.modelName, 'Claude Opus 5');
assert.equal(identifiedConfiguration.identity.modelVersion, 'Max · API default');
assert.equal(identifiedConfiguration.identity.reasoningEffort, 'Deep Think');
assert.equal(identifiedConfiguration.execution.harness, 'OpenCode · macOS');
assert.equal(identifiedConfiguration.provider, 'OpenRouter');
assert.equal(identifiedConfiguration.access.entryPoint, 'OpenRouter API');
assert.equal(identifiedConfiguration.access.providerEndpoint, 'Anthropic API');

// Copying a configuration carries the complete ordered stack but is disabled
// by default, so it cannot silently enter the reader-facing leaderboard.
const originalCardOrder = stack.map(({ card }) => card.id);
const duplicatedBox = store.duplicateBox(legacyBox.id);
assert.ok(duplicatedBox);
assert.notEqual(duplicatedBox.id, legacyBox.id);
assert.equal(duplicatedBox.enabled, false);
assert.equal(duplicatedBox.lastCalculatedAt, undefined);
assert.deepEqual(duplicatedBox.identity, configurationIdentity);
// A manual duplicate is no longer the shipped preset itself, so the installer
// may safely keep it while identifying the original by its stable preset ID.
assert.equal(duplicatedBox.builtInPresetId, undefined);
const duplicatedStack = store.getLinkedCardStack(duplicatedBox.id);
assert.deepEqual(duplicatedStack.map(({ card }) => card.id), originalCardOrder);
assert.deepEqual(duplicatedStack.map(({ link }) => link.priority), duplicatedStack.map((_, index) => index));
assert.notDeepEqual(duplicatedStack.map(({ link }) => link.id), stack.map(({ link }) => link.id));

// Backups contain configuration metadata and portable card identities only;
// they do not leak source observations, scores, local card IDs, or local box
// IDs that would go stale after the next verified-catalog refresh.
const exportedBackup = store.exportConfigurationBackup();
const exportedJson = JSON.stringify(exportedBackup);
assert.equal(exportedBackup.format, 'llmpk.configuration-backup');
assert.equal(exportedBackup.schemaVersion, 1);
assert.equal(exportedBackup.boxes.length, store.boxes.length);
assert.equal('id' in exportedBackup.boxes[0], false);
assert.deepEqual(exportedBackup.boxes[0].identity, configurationIdentity);
assert.equal(exportedBackup.boxes[0].builtInPresetId, 'anthropic-claude-opus-5-max-opencode-openrouter');
assert.equal(exportedJson.includes('sourceModelCardId'), false);
assert.equal(exportedJson.includes('"observations"'), false);
assert.equal(exportedJson.includes('"rawValue"'), false);
assert.deepEqual(JSON.parse(store.exportConfigurationBackupJson()).boxes, exportedBackup.boxes);

// A normal import must be additive, disabled by default, and preserve the
// resolved top-to-bottom stack order for every exported configuration.
const boxCountBeforeBackupImport = store.boxes.length;
const importedLinkCountExpected = exportedBackup.boxes.reduce((sum, box) => sum + box.links.length, 0);
const backupImportReport = store.importConfigurationBackup(exportedBackup);
assert.equal(backupImportReport.accepted, true);
assert.equal(backupImportReport.importedBoxCount, exportedBackup.boxes.length);
assert.equal(backupImportReport.importedLinkCount, importedLinkCountExpected);
assert.equal(backupImportReport.unresolvedLinkCount, 0);
assert.equal(backupImportReport.rejectedBoxCount, 0);
assert.equal(backupImportReport.rejectedLinkCount, 0);
const importedBoxes = store.boxes.slice(boxCountBeforeBackupImport);
assert.equal(importedBoxes.length, exportedBackup.boxes.length);
assert.equal(new Set(store.boxes.map((box) => box.internalName)).size, store.boxes.length);
assert.equal(new Set(store.boxes.map((box) => box.displayName)).size, store.boxes.length);
importedBoxes.forEach((importedBox, index) => {
  assert.equal(importedBox.enabled, false);
  assert.deepEqual(importedBox.identity, store.boxes[index].identity);
  assert.equal(importedBox.builtInPresetId, store.boxes[index].builtInPresetId);
  assert.deepEqual(
    store.getLinkedCardStack(importedBox.id).map(({ card }) => card.id),
    store.getLinkedCardStack(store.boxes[index].id).map(({ card }) => card.id),
  );
});

// If an upstream source record ID rotates, an import may safely fall back to
// one unique exact source-model name within the same source and OAGXM scope.
// A second unknown identity is left unresolved rather than guessed.
const fallbackReference = backupReferenceFor(uniqueNameCard, false);
const fallbackBackup = {
  format: 'llmpk.configuration-backup' as const,
  schemaVersion: 1 as const,
  exportedAt: '2026-07-27T00:00:00.000Z',
  boxes: [{
    internalName: 'name_only_recovery',
    displayName: 'Name Only Recovery',
    enabled: true,
    links: [
      { priority: 0, card: fallbackReference },
      {
        priority: 1,
        card: {
          ...fallbackReference,
          exactSourceModelName: `${fallbackReference.exactSourceModelName} definitely-not-a-current-card`,
        },
      },
      {
        priority: 2,
        card: {
          ...fallbackReference,
          // A real but different product-line scope must not rebind this
          // card to a similarly named model in the current catalog.
          scope: backupReferenceFor(differentScopeCard, false).scope,
        },
      },
    ],
  }],
};
const fallbackImportReport = store.importConfigurationBackup(JSON.stringify(fallbackBackup));
assert.equal(fallbackImportReport.accepted, true);
assert.equal(fallbackImportReport.importedBoxCount, 1);
assert.equal(fallbackImportReport.importedLinkCount, 1);
assert.equal(fallbackImportReport.unresolvedLinkCount, 2);
assert.equal(fallbackImportReport.rejectedBoxCount, 0);
const fallbackImportedBox = store.boxes.at(-1)!;
assert.equal(fallbackImportedBox.enabled, false);
assert.deepEqual(store.getLinkedCardStack(fallbackImportedBox.id).map(({ card }) => card.id), [uniqueNameCard.id]);

// A portable backup made under v2 must not force the operator to re-enter a
// mapping after the current catalog moves to v3. It is resolved only after
// its old tuple maps to the current whitelist and the exact source identity
// resolves in the current verified catalog.
const v2BackupReference: ConfigurationBackupCardReference = {
  ...backupReferenceFor(pair.lower),
  scope: {
    ...backupReferenceFor(pair.lower).scope,
    scopeVersion: 'oagxm-current-product-lines/v2',
  },
};
const v2Backup = {
  format: 'llmpk.configuration-backup' as const,
  schemaVersion: 1 as const,
  exportedAt: '2026-07-27T00:00:00.000Z',
  boxes: [{
    internalName: 'v2_scope_backup',
    displayName: 'v2 Scope Backup',
    enabled: true,
    links: [{ priority: 0, card: v2BackupReference }],
  }],
};
const v2BackupImportReport = store.importConfigurationBackup(v2Backup);
assert.equal(v2BackupImportReport.accepted, true);
assert.equal(v2BackupImportReport.importedBoxCount, 1);
assert.equal(v2BackupImportReport.importedLinkCount, 1);
assert.equal(v2BackupImportReport.unresolvedLinkCount, 0);
assert.equal(v2BackupImportReport.rejectedLinkCount, 0);

// Compatibility is deliberately narrow: a v2 version marker alone is never
// enough to bind a removed or unknown product line to a current card.
const invalidV2ScopeImportReport = store.importConfigurationBackup({
  ...v2Backup,
  boxes: [{
    ...v2Backup.boxes[0],
    internalName: 'invalid_v2_scope_backup',
    displayName: 'Invalid v2 Scope Backup',
    links: [{
      priority: 0,
      card: {
        ...v2BackupReference,
        scope: { ...v2BackupReference.scope, productLineId: 'not-in-current-scope' },
      },
    }],
  }],
});
assert.equal(invalidV2ScopeImportReport.accepted, true);
assert.equal(invalidV2ScopeImportReport.importedLinkCount, 0);
assert.equal(invalidV2ScopeImportReport.rejectedLinkCount, 1);

// Identity metadata is optional for old backups, but when supplied it must
// have the documented string-only structure rather than arbitrary payload.
const malformedIdentityImportReport = store.importConfigurationBackup({
  ...v2Backup,
  boxes: [{
    ...v2Backup.boxes[0],
    internalName: 'malformed_identity_backup',
    displayName: 'Malformed Identity Backup',
    identity: { model: { name: 42 } },
  }],
});
assert.equal(malformedIdentityImportReport.accepted, true);
assert.equal(malformedIdentityImportReport.importedBoxCount, 0);
assert.equal(malformedIdentityImportReport.rejectedBoxCount, 1);

const rejectedDocumentReport = store.importConfigurationBackup({
  format: 'llmpk.configuration-backup',
  schemaVersion: 2,
  exportedAt: '2026-07-27T00:00:00.000Z',
  boxes: [],
});
assert.equal(rejectedDocumentReport.accepted, false);
assert.equal(rejectedDocumentReport.rejectedBoxCount, 1);

// A real browser may already have v17 keys but v2 cards when only the source
// catalog scope changes. A stale fingerprint triggers reconciliation; the
// old cards never become active, but their verified source links survive when
// they map to the current product line and resolve exactly.
const v2PersistedBox: ConfigurationBox = {
  ...legacyBox,
  id: 'v2-persisted-box',
  internalName: 'v2_persisted_model',
  displayName: 'v2 Persisted Model',
};
const v2PersistedCards = [pair.supportingCard, pair.lower].map((card) => {
  const currentScope = card.metadataJson?.scope as Record<string, unknown> | undefined;
  assert.ok(currentScope);
  return {
    ...card,
    metadataJson: {
      ...card.metadataJson,
      scope: {
        ...currentScope,
        scopeVersion: 'oagxm-current-product-lines/v2',
      },
    },
  } as SourceModelCard;
});
const v2PersistedLinks: ConfigurationSourceLink[] = [
  {
    id: 'v2-persisted-support-link',
    configurationId: v2PersistedBox.id,
    source: pair.supportingCard.source,
    sourceModelCardId: pair.supportingCard.id,
    priority: 0,
    createdAt: '2026-07-27',
    updatedAt: '2026-07-27',
  },
  {
    id: 'v2-persisted-lower-link',
    configurationId: v2PersistedBox.id,
    source: pair.lower.source,
    sourceModelCardId: pair.lower.id,
    priority: 1,
    createdAt: '2026-07-27',
    updatedAt: '2026-07-27',
  },
];
memoryStorage.clear();
memoryStorage.setItem('llmpk_admin_store_schema_version', '17');
memoryStorage.setItem('llmpk_admin_catalog_fingerprint_v17', 'v2-catalog-fingerprint');
memoryStorage.setItem('llmpk_admin_boxes_v17', JSON.stringify([v2PersistedBox]));
memoryStorage.setItem('llmpk_admin_cards_v17', JSON.stringify(v2PersistedCards));
memoryStorage.setItem('llmpk_admin_links_v17', JSON.stringify(v2PersistedLinks));
memoryStorage.setItem('llmpk_admin_obs_v17', '[]');
const reconciledV3Store = new AdminMappingStore();
assert.equal(reconciledV3Store.getLastDataCleanupReport().catalogRebuilt, true);
assert.deepEqual(
  reconciledV3Store.getLinkedCardStack(v2PersistedBox.id).map(({ card }) => card.id),
  [pair.supportingCard.id, pair.lower.id],
);
assert.deepEqual(
  reconciledV3Store.getLinkedCardStack(v2PersistedBox.id).map(({ card }) => (
    card.metadataJson?.scope?.scopeVersion
  )),
  [
    OAGXM_SCOPE.schemaVersion,
    OAGXM_SCOPE.schemaVersion,
  ],
);

// The verified catalog is bundled and must not be duplicated into browser
// storage. A legacy partial write may nevertheless contain a current
// fingerprint plus truncated observations; loading it must still restore the
// complete bundled observations and preserve links by stable card identity.
const currentCatalogFingerprint = memoryStorage.getItem('llmpk_admin_catalog_fingerprint_v17');
assert.ok(currentCatalogFingerprint);
const expectedVerifiedCardCount = reconciledV3Store.cards.length;
const expectedVerifiedObservationCount = reconciledV3Store.observations.length;
memoryStorage.setItem('llmpk_admin_store_schema_version', '17');
memoryStorage.setItem('llmpk_admin_catalog_fingerprint_v17', currentCatalogFingerprint);
memoryStorage.setItem('llmpk_admin_boxes_v17', JSON.stringify([v2PersistedBox]));
memoryStorage.setItem('llmpk_admin_cards_v17', JSON.stringify(v2PersistedCards));
memoryStorage.setItem('llmpk_admin_links_v17', JSON.stringify(v2PersistedLinks));
memoryStorage.setItem('llmpk_admin_obs_v17', '[]');
const recoveredFromTruncatedCatalogStore = new AdminMappingStore();
assert.equal(recoveredFromTruncatedCatalogStore.cards.length, expectedVerifiedCardCount);
assert.equal(recoveredFromTruncatedCatalogStore.observations.length, expectedVerifiedObservationCount);
assert.deepEqual(
  recoveredFromTruncatedCatalogStore.getLinkedCardStack(v2PersistedBox.id).map(({ card }) => card.id),
  [pair.supportingCard.id, pair.lower.id],
);
assert.equal(memoryStorage.getItem('llmpk_admin_cards_v17'), null);
assert.equal(memoryStorage.getItem('llmpk_admin_obs_v17'), null);

// The shipped inventory creates enabled, visible configuration boxes without trying
// to guess cards from product names, profile labels, or environments. Every
// exact card or lower-to-higher fallback must be declared by stable card ID,
// match the preset's OAGXM product line, and preserve its provenance in the
// installed stack. A second pass recognises stable preset IDs and leaves
// operator edits untouched.
const expectedPresetLinks = new Map<string, Array<{
  cardId: string;
  provenance: ConfigurationSourceLinkProvenance;
}>>();
let expectedUnresolvedPresetCardCount = 0;
const expectedUnresolvedPresetCards: string[] = [];
let expectedMismatchedPresetCardCount = 0;
const expectedMismatchedPresetCards: string[] = [];
let expectedLowerProfileFallbackCount = 0;
let expectedLowerHarnessFallbackCount = 0;
let expectedLowerProfileHarnessFallbackCount = 0;
for (const preset of BUILT_IN_CONFIGURATION_PRESETS) {
  const matchingLinks: Array<{
    cardId: string;
    provenance: ConfigurationSourceLinkProvenance;
  }> = [];
  const seenCardIds = new Set<string>();
  const declaredLinks = [
    ...(preset.sourceCardIds || []).map((cardId) => ({
      cardId,
      provenance: { kind: 'exact' } as ConfigurationSourceLinkProvenance,
    })),
    ...(preset.sourceCardLinks || []),
  ];
  for (const declaration of declaredLinks) {
    if (seenCardIds.has(declaration.cardId)) continue;
    seenCardIds.add(declaration.cardId);
    const card = reconciledV3Store.cards.find((candidate) => candidate.id === declaration.cardId);
    if (!card) {
      expectedUnresolvedPresetCardCount += 1;
      expectedUnresolvedPresetCards.push(`${preset.id}:${declaration.cardId}`);
      continue;
    }
    const scope = card.metadataJson?.scope as Record<string, unknown> | undefined;
    if (scope?.productLineId !== preset.productLineId) {
      expectedMismatchedPresetCardCount += 1;
      expectedMismatchedPresetCards.push(
        `${preset.id}:${declaration.cardId}(${String(scope?.productLineId)}!=${preset.productLineId})`,
      );
      continue;
    }
    if (declaration.provenance.kind === 'lower_profile_fallback') {
      assert.ok(
        preset.access === 'api' || preset.access === 'subscription',
        `Only API/subscription preset ${preset.id} may declare a fallback.`,
      );
      assert.equal(
        preset.identity.model.profile,
        declaration.provenance.targetProfile,
        `Fallback ${preset.id} must name its target profile exactly.`,
      );
      assert.ok(
        declaration.provenance.sourceLevel < declaration.provenance.targetLevel,
        `Fallback ${preset.id} must run only from a lower level to a higher level.`,
      );
      expectedLowerProfileFallbackCount += 1;
    } else if (declaration.provenance.kind === 'lower_harness_fallback') {
      assert.ok(
        preset.access === 'api' || preset.access === 'subscription',
        `Only API/subscription preset ${preset.id} may declare a fallback.`,
      );
      assert.equal(preset.identity.harness.name, declaration.provenance.targetHarness);
      assert.equal(preset.identity.model.profile, declaration.provenance.targetProfile);
      assert.equal(declaration.provenance.sourceProfile, declaration.provenance.targetProfile);
      assert.ok(isValidExecutionHarnessFallback(
        declaration.provenance.sourceHarness,
        declaration.provenance.sourceLevel,
        declaration.provenance.targetHarness,
        declaration.provenance.targetLevel,
      ));
      if (!isPlainChatHarness(declaration.provenance.sourceHarness)) {
        assert.equal(
          card.metadataJson?.sourceIdentity?.executionHarness,
          declaration.provenance.sourceHarness,
        );
      }
      expectedLowerHarnessFallbackCount += 1;
    } else if (declaration.provenance.kind === 'lower_profile_harness_fallback') {
      assert.ok(
        preset.access === 'api' || preset.access === 'subscription',
        `Only API/subscription preset ${preset.id} may declare a fallback.`,
      );
      assert.equal(preset.identity.harness.name, declaration.provenance.targetHarness);
      assert.equal(preset.identity.model.profile, declaration.provenance.targetProfile);
      assert.ok(
        declaration.provenance.sourceProfileLevel
          < declaration.provenance.targetProfileLevel,
      );
      assert.ok(isValidExecutionHarnessFallback(
        declaration.provenance.sourceHarness,
        declaration.provenance.sourceHarnessLevel,
        declaration.provenance.targetHarness,
        declaration.provenance.targetHarnessLevel,
      ));
      if (!isPlainChatHarness(declaration.provenance.sourceHarness)) {
        assert.equal(
          card.metadataJson?.sourceIdentity?.executionHarness,
          declaration.provenance.sourceHarness,
        );
      }
      expectedLowerProfileHarnessFallbackCount += 1;
    }
    matchingLinks.push({ cardId: card.id, provenance: declaration.provenance });
  }
  expectedPresetLinks.set(preset.id, matchingLinks);
}
assert.equal(
  expectedUnresolvedPresetCardCount,
  0,
  `Every listed built-in card ID must exist in the verified catalog: ${expectedUnresolvedPresetCards.join(', ')}`,
);
assert.equal(
  expectedMismatchedPresetCardCount,
  0,
  `A built-in card ID must never cross product lines: ${expectedMismatchedPresetCards.join(', ')}`,
);
assert.ok(
  BUILT_IN_CONFIGURATION_PRESETS.length >= 20
  && BUILT_IN_CONFIGURATION_PRESETS.length <= 120,
  'The reader-facing inventory should stay focused after the September model additions.',
);
assert.equal(
  BUILT_IN_CONFIGURATION_MAX_PER_MODEL,
  7,
  'Gemini 3.8 may expose three measured Harness routes plus Pro and Ultra pricing for its two product Harnesses.',
);
assert.equal(
  BUILT_IN_CONFIGURATION_CURATION_ROWS.length,
  BUILT_IN_CONFIGURATION_PRESETS.length,
  'Every shipped configuration must expose auditable curation metadata.',
);
assert.equal(
  isHarnessOnlyCapabilityMetric('arena_code_webdev'),
  false,
  'Arena WebDev is benchmark methodology, not a user-selectable production harness.',
);
assert.equal(
  isCapabilityMetricCompatibleWithSourceLink(
    'arena_code_webdev',
    'Chat',
    { kind: 'exact' },
  ),
  true,
  'Arena WebDev must remain usable as ordinary model-level evidence.',
);
assert.equal(
  isCapabilityMetricApplicableToConfiguration(
    'arena_agent_success',
    'Claude Code',
  ),
  true,
  'A production harness must count as eligible for legal lower Agent-mode fallback evidence.',
);
assert.equal(
  isCapabilityMetricApplicableToConfiguration(
    'arena_agent_success',
    'Chat',
  ),
  false,
  'A Chat configuration must not inflate the eligible population for Agent-only evidence.',
);
const shippedSourceCatalogPresets = BUILT_IN_CONFIGURATION_PRESETS.filter(
  (preset) => preset.origin === 'source-catalog',
);
const sourceCatalogCoverageByPreset = buildPresetCoverageProfiles(shippedSourceCatalogPresets);
const readerApprovedSourceCatalogProductLines = new Set<string>(
  READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINE_IDS,
);
for (const productLineId of READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINE_IDS) {
  if (productLineId === 'source-profile-grok-build-0-1-0616') continue;
  assert.ok(
    shippedSourceCatalogPresets.some((preset) => preset.productLineId === productLineId),
    `Reader-approved source-catalog product line ${productLineId} must remain shipped.`,
  );
}
for (const preset of shippedSourceCatalogPresets) {
  if (readerApprovedSourceCatalogProductLines.has(preset.productLineId)) continue;
  const coverage = sourceCatalogCoverageByPreset.get(preset.id);
  assert.ok(
    coverage?.availableDomainIds.includes('chatting')
      || (coverage?.compatibleHarnessMetricCount || 0) > 0,
    `Unapproved source-catalog preset ${preset.id} needs direct Chatting or compatible production-harness evidence.`,
  );
}
assert.ok(
  BUILT_IN_CONFIGURATION_CURATION_ROWS.every(
    (row) => (
      row.releaseDate >= BUILT_IN_CONFIGURATION_RELEASE_CUTOFF
      || row.explicitlyPinned
    ),
  ),
  'Every pre-cutoff configuration must be an explicit user-requested historical comparator.',
);
const pinnedModelGroupKeys = new Set<string>(BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS);
assert.ok(
  BUILT_IN_CONFIGURATION_CURATION_ROWS.every((row) => (
    row.explicitlyPinned === pinnedModelGroupKeys.has(row.modelGroupKey)
  )),
  'Pinned curation metadata must exactly match the explicit historical-comparator list.',
);
for (const modelGroupKey of BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS) {
  assert.ok(
    BUILT_IN_CONFIGURATION_CURATION_ROWS.some((row) => row.modelGroupKey === modelGroupKey),
    `Explicitly requested model group ${modelGroupKey} must remain shipped.`,
  );
}
const curationSignatures = new Set<string>();
for (const row of BUILT_IN_CONFIGURATION_CURATION_ROWS) {
  const key = `${row.modelGroupKey}\u0000${row.effectiveDataSignature}`;
  assert.ok(
    !curationSignatures.has(key),
    `Model group ${row.modelGroupKey} must not ship two configurations with identical effective data.`,
  );
  curationSignatures.add(key);
}
const nonKeyVendorModelGroups = new Map<string, Set<string>>();
for (const row of BUILT_IN_CONFIGURATION_CURATION_ROWS) {
  if ((BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS as readonly string[]).includes(row.vendorKey)) continue;
  const groups = nonKeyVendorModelGroups.get(row.vendorKey) || new Set<string>();
  groups.add(row.modelGroupKey);
  nonKeyVendorModelGroups.set(row.vendorKey, groups);
}
for (const [vendorKey, modelGroups] of nonKeyVendorModelGroups) {
  assert.equal(
    modelGroups.size,
    1,
    `Non-key vendor ${vendorKey} may keep only its newest score-ready model.`,
  );
}
for (const presetId of [
  'builtin.harness.deepseek-v4-flash-0731.max.codex-cli',
  'builtin.harness.gemini-3-6-flash.high.opencode',
  'builtin.qwen3-8-max-0902.xhigh',
  'builtin.harness.gpt-6-astra.max.codex-cli',
  'builtin.harness.gpt-6-sol.max.codex-cli',
  'builtin.harness.gpt-6-luna.max.codex-cli',
  'builtin.harness.claude-opus-5-5.max.claude-code',
  'builtin.harness.grok-4-7.xhigh.grok-build',
  'builtin.harness.gpt-5-6-sol.max.codex-cli',
  'builtin.harness.gpt-5-6-luna.max.codex-cli',
  'builtin.harness.gpt-5-6-terra.max.codex-cli',
  'builtin.harness.claude-opus-4-8.max.claude-code',
  'builtin.agent.arena.claude-sonnet-5.max',
  'builtin.step-5-preview.high',
  'builtin.harness.deepseek-v4-pro.high.claude-code',
  'builtin.harness.claude-opus-5.max.claude-code',
  'builtin.harness.kimi-k3.max.kimi-code-cli',
  'builtin.harness.gemini-3-1-pro.high.gemini-cli',
  'builtin.harness.gpt-5-5.xhigh.codex-cli',
  'builtin.harness.gpt-5-4.xhigh.codex-cli',
  'builtin.harness.claude-opus-4-7.max.claude-code',
  'builtin.harness.claude-opus-4-6.max.claude-code',
  'builtin.harness.claude-sonnet-4-6.max.claude-code',
  'builtin.harness.kimi-k2-6.max.claude-code',
  'builtin.data-md.claude-haiku-4-5.max.vertex',
  'builtin.source-catalog.source-profile-grok-4-3-high.grok-4-3-high',
  'builtin.data-md.longcat-2-0.max',
  'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
  'builtin.harness.gemini-3-7-flash.high.opencode',
  'builtin.harness.muse-spark-1-2.xhigh.opencode',
  'builtin.harness.muse-spark-1-2.xhigh.muse-code',
]) {
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(
    BUILT_IN_CONFIGURATION_PRESETS.some((preset) => preset.id === presetId),
    `Strong or evidence-rich API profile ${presetId} must remain shipped.`,
  );
}

const previouslyVerifiedHarnessRoutes = [
  ['builtin.harness.claude-fable-5.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-opus-4-6.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-opus-4-7.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-opus-4-8.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-opus-5.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-sonnet-4-6.max.claude-code', 'Claude Code'],
  ['builtin.harness.deepseek-v4-pro.high.claude-code', 'Claude Code'],
  ['builtin.harness.glm-5-2.max.claude-code', 'Claude Code'],
  ['builtin.harness.kimi-k2-6.max.claude-code', 'Claude Code'],
  ['builtin.harness.qwen-3-7-plus.max.claude-code', 'Claude Code'],
  ['builtin.harness.gpt-5-4.xhigh.codex-cli', 'Codex CLI'],
  ['builtin.harness.gpt-5-5.xhigh.codex-cli', 'Codex CLI'],
  ['builtin.harness.gpt-5-6-luna.max.codex-cli', 'Codex CLI'],
  ['builtin.harness.gpt-5-6-sol.max.codex-cli', 'Codex CLI'],
  ['builtin.harness.gpt-5-6-terra.max.codex-cli', 'Codex CLI'],
  ['builtin.harness.gemini-3-1-pro.high.gemini-cli', 'Gemini CLI'],
  ['builtin.harness.grok-4-5.high.grok-build', 'Grok Build'],
  ['builtin.harness.kimi-k3.max.kimi-code-cli', 'Kimi Code CLI'],
  ['builtin.harness.muse-spark-1-1.xhigh.opencode', 'OpenCode'],
] as const;
assert.equal(previouslyVerifiedHarnessRoutes.length, 19);
for (const [presetId, expectedHarness] of previouslyVerifiedHarnessRoutes) {
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => candidate.id === presetId);
  assert.ok(preset, `Previously verified Harness route ${presetId} must remain shipped.`);
  assert.equal(
    preset.identity.harness.name,
    expectedHarness,
    `Previously verified Harness route ${presetId} must not be relabelled.`,
  );
}

const uniqueRouteCountForHarness = (harnessName: string): number => new Set(
  BUILT_IN_CONFIGURATION_PRESETS
    .filter((preset) => preset.identity.harness.name === harnessName)
    .map((preset) => [
      preset.identity.model.name,
      preset.identity.model.profile,
      preset.identity.model.preset || '',
    ].join('\u0000')),
).size;
assert.ok(
  uniqueRouteCountForHarness('AA Agent Harness') >= 2,
  'Current Arena Agent Mode routes must retain their execution identity.',
);
assert.ok(
  uniqueRouteCountForHarness('---') >= 10,
  'Model API routes without a published Coding Agent run must retain the plain Chat identity.',
);
const glm53FlashCandidates = ALL_CONFIGURATION_PRESET_CANDIDATES
  .filter((preset) => (
    preset.productLineId === 'glm_53_flash'
    && preset.origin !== 'source-catalog'
  ));
assert.deepEqual(
  glm53FlashCandidates.map((preset) => preset.id),
  ['builtin.glm-5-3-flash.max'],
  'GLM-5.3-Flash must ship only the score-backed Max configuration.',
);
const glm53FlashPresets = BUILT_IN_CONFIGURATION_PRESETS
  .filter((preset) => preset.productLineId === 'glm_53_flash');
assert.deepEqual(
  glm53FlashPresets.map((preset) => preset.id),
  ['builtin.glm-5-3-flash.max'],
  'Only GLM-5.3-Flash Max currently has a source-backed capability score and should enter the compact ranking.',
);
assert.ok(
  glm53FlashCandidates.every((preset) => preset.identity.harness.name === '---'),
  'GLM-5.3-Flash has no AA Coding Agent record and must not be labelled with a vendor or AA Agent Harness.',
);
const glm53Candidates = ALL_CONFIGURATION_PRESET_CANDIDATES
  .filter((preset) => preset.productLineId === 'glm_53' && preset.origin !== 'source-catalog');
assert.deepEqual(
  glm53Candidates.map((preset) => preset.id),
  ['builtin.data-md.glm-5-3.max'],
  'GLM-5.3 must ship only the score-backed Max configuration.',
);
const glm53Presets = BUILT_IN_CONFIGURATION_PRESETS
  .filter((preset) => preset.productLineId === 'glm_53');
assert.deepEqual(
  glm53Presets.map((preset) => preset.id),
  ['builtin.data-md.glm-5-3.max'],
  'Only GLM-5.3 Max currently has a source-backed capability score and should enter the compact ranking.',
);
assert.ok(
  glm53Candidates.every((preset) => preset.identity.harness.name === '---'),
  'GLM-5.3 has no AA Coding Agent record and must not be labelled with a vendor or AA Agent Harness.',
);
for (const [presetId, expectedModelLabel, expectedHarness] of [
  ['builtin.qwen3-8-max-0902.xhigh', 'Qwen3.8-Max XHigh', '---'],
  ['builtin.qwen3-8-27b.xhigh', 'Qwen3.8 27B XHigh', '---'],
  ['builtin.qwen3-8-flash-next.xhigh', 'Qwen3.8-Flash-Next XHigh', '---'],
  ['builtin.hy4-preview.high', 'Hy4 Preview High', '---'],
  ['builtin.command-a-plus.reasoning', 'Command A+ Thinking', '---'],
  ['builtin.nemotron-3-5-lightning.reasoning', 'Nemotron 3.5 Lightning Thinking', '---'],
  ['builtin.gpt-oss-20b.high', 'GPT-OSS 20B High', '---'],
  ['builtin.gpt-oss-120b.high', 'GPT-OSS 120B High', '---'],
  ['builtin.inkling.xhigh', 'Inkling XHigh', '---'],
  ['builtin.glm-5-3-flash.max', 'GLM-5.3-Flash Max', '---'],
  ['builtin.harness.claude-fable-5-1.max.claude-code', 'Claude Fable 5.1 Max', 'Claude Code'],
  ['builtin.harness.gemini-3-8-flash.high.antigravity-sdk', 'Gemini 3.8 Flash High', 'Antigravity SDK'],
  ['builtin.harness.gemini-3-8-flash.high.opencode', 'Gemini 3.8 Flash High', 'OpenCode'],
  ['builtin.agent.arena.gemini-3-8-flash.high', 'Gemini 3.8 Flash High', 'AA Agent Harness'],
  ['builtin.harness.muse-spark-1-3.xhigh.muse-code', 'Muse Spark 1.3 XHigh', 'Muse Code'],
] as const) {
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => candidate.id === presetId);
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(preset, `${presetId} must be shipped after its source-backed addition.`);
  assert.equal(
    preset.identity.harness.name,
    expectedHarness,
    `${presetId} must retain its source-backed harness identity.`,
  );
  assert.ok(
    preset.displayName.startsWith(expectedModelLabel),
    `${presetId} must expose the normalized reader-facing model and effort label.`,
  );
}
assert.equal(
  BUILT_IN_CONFIGURATION_PRESETS.some((preset) => preset.productLineId === 'qwen_37_max'),
  false,
  'Qwen3.7 Max must be removed from the reader-facing inventory.',
);
assert.equal(
  BUILT_IN_CONFIGURATION_PRESETS.some((preset) => (
    preset.id === 'builtin.harness.qwen3-8.max.claude-code'
      || preset.productLineId === 'qwen_38_max_preview'
  )),
  false,
  'Only the fixed 0902 Qwen3.8-Max configuration may be reader-facing.',
);
assert.equal(
  BUILT_IN_CONFIGURATION_PRESETS.some((preset) => (
    preset.id === 'builtin.agent.arena.deepseek-v4-flash.max'
  )),
  false,
  'DeepSeek-v4-Flash 0731 must retain only its exact Codex CLI configuration.',
);
assert.ok(
  BUILT_IN_CONFIGURATION_PRESETS.every(
    (preset) => preset.identity.harness.name !== 'Arena Agent Mode',
  ),
  'Arena Agent Mode must remain source provenance, not a reader-facing Harness label.',
);
for (const omittedPresetId of [
  'builtin.data-md.kimi-k3.max',
  'builtin.data-md.claude-sonnet-5.max.vertex',
  'builtin.agent.arena.claude-sonnet-5.high',
  'builtin.agent.arena.deepseek-v4-flash.none',
  'builtin.agent.arena.deepseek-v4-flash.max',
  'builtin.data-md.qwen-3-7-max.max',
  'builtin.agent.arena.qwen-3-7-max.max',
  'builtin.data-md.nemotron-3-ultra.max',
  'builtin.data-md.gpt-5-6-sol.xhigh',
  'builtin.data-md.gpt-5-6-luna.xhigh',
  'builtin.data-md.gpt-5-6-terra.xhigh',
  'builtin.source-catalog.claude_opus_48.claude-opus-4-8-default-non-reasoning-high',
  'builtin.opus-5.xhigh',
  'builtin.data-md.claude-sonnet-5.high.vertex',
  'builtin.data-md.deepseek-v4-flash.xhigh',
  'builtin.data-md.deepseek-v4-pro.xhigh',
  'builtin.data-md.gemini-3-5-flash.medium.ai-studio',
  'builtin.data-md.hy3.high',
  'builtin.data-md.mistral-medium-3-5.high',
  'builtin.data-md.gpt-5-6-terra.low',
  'builtin.data-md.gpt-5-6-terra.medium',
  'builtin.data-md.gpt-5-6-terra.high',
  'builtin.data-md.gpt-5-6-sol.pro.high',
  'builtin.data-md.gpt-oss-120b.high.dekallm',
  'builtin.data-md.step-3-7-flash.high',
  'builtin.data-md.nemotron-3-super.max',
  'builtin.harness.gpt-5-4.high.codex-cli',
  'builtin.harness.claude-opus-4-6.high.claude-code',
  'builtin.harness.claude-sonnet-4-6.high.claude-code',
  'builtin.source-catalog.source-profile-gemma-4-12b-reasoning.gemma-4-12b-reasoning',
  'builtin.source-catalog.source-profile-granite-4-1-8b.granite-4-1-8b',
  'builtin.source-catalog.source-profile-grok-4-3.grok-4-3',
  'builtin.source-catalog.source-profile-kimi-k2-7-code.kimi-k2-7-code',
  'builtin.source-catalog.source-profile-gemini-3-1-flash-lite-preview.gemini-3-1-flash-lite-preview',
  'builtin.source-catalog.source-profile-gpt-4-1-2025-04-14.gpt-4-1-2025-04-14',
  'builtin.source-catalog.source-profile-deepseek-r1-2025-01.deepseek-r1-2025-01',
  'builtin.source-catalog.source-profile-agnes-2-5-pro-alpha.agnes-2-5-pro-alpha',
  'builtin.source-catalog.source-profile-diffusiongemma-26b-a4b.diffusiongemma-26b-a4b',
  'builtin.source-catalog.source-profile-g9v3-3b.g9v3-3b',
  'builtin.source-catalog.source-profile-granite-4-1-30b.granite-4-1-30b',
  'builtin.source-catalog.source-profile-hypernova-60b-2605.hypernova-60b-2605',
  'builtin.source-catalog.source-profile-jt-4-1-flash-236b-a21b.jt-4-1-flash-236b-a21b',
  'builtin.source-catalog.source-profile-minicpm-v-4-6-1-3b.minicpm-v-4-6-1-3b',
  'builtin.source-catalog.source-profile-motif-3-beta.motif-3-beta',
  'builtin.source-catalog.source-profile-nex-n2-pro.nex-n2-pro',
  'builtin.source-catalog.source-profile-ring-2-6-1t.ring-2-6-1t',
  'builtin.gemini-3-7-flash.minimal',
  'builtin.gemini-3-7-flash.low',
  'builtin.gemini-3-7-flash.medium',
  'builtin.gemini-3-7-flash.high',
  'builtin.subscription.google-ai-pro.gemini-3-7-flash.high.chat',
  'builtin.subscription.google-ai-ultra-20x.gemini-3-7-flash.high.chat',
  'builtin.muse-spark-1-2.minimal',
  'builtin.muse-spark-1-2.low',
  'builtin.muse-spark-1-2.medium',
  'builtin.muse-spark-1-2.high',
  'builtin.muse-spark-1-2.xhigh',
]) {
  assert.ok(
    !BUILT_IN_CONFIGURATION_PRESETS.some((preset) => preset.id === omittedPresetId),
    `Redundant or sparse profile ${omittedPresetId} must not flood the reader-facing catalog.`,
  );
}
assert.ok(BUILT_IN_CONFIGURATION_PRESETS.every((preset) => (
  !/[\u3400-\u9fff]/u.test(preset.displayName)
  && !/未单列|来源精确|默认 effort|正常对话/iu.test(preset.displayName)
  && preset.displayName.length <= 80
)), 'Shipped configuration names must stay compact and free of explanatory prose.');
for (const preset of BUILT_IN_CONFIGURATION_PRESETS.filter(({ access }) => access === 'api')) {
  const providerLabel = preset.displayName.split(' | ')[2];
  if (preset.apiPricingData) {
    assert.equal(
      providerLabel,
      preset.providerDisplayLabel,
      `Tiered API preset ${preset.id} must expose its explicit vendor price tier.`,
    );
    assert.match(
      providerLabel || '',
      /\bAPI\b/u,
      `Tiered API preset ${preset.id} must remain visibly identified as an API route.`,
    );
    continue;
  }
  assert.ok(
    providerLabel?.endsWith(' API') && providerLabel !== 'API',
    `API preset ${preset.id} must name the model author's vendor without binding to one serving endpoint.`,
  );
}
interface ExpectedSubscriptionPreset {
  basePresetId: string;
  providerLabel: string;
  monthlyPriceUSD: number;
  apiEquivalentCostUSD: number;
  usableQuotaFraction: number;
}

interface ExpectedSubscriptionTarget {
  key: string;
  basePresetId: string;
  usableQuotaFraction: number;
}

const chatGptPlusTargets: readonly ExpectedSubscriptionTarget[] = [
  {
    key: 'gpt-5-6-sol.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-sol.max.codex-cli',
    usableQuotaFraction: 1,
  },
  {
    key: 'gpt-5-6-terra.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-terra.max.codex-cli',
    usableQuotaFraction: 1,
  },
  {
    key: 'gpt-5-6-luna.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-luna.max.codex-cli',
    usableQuotaFraction: 1,
  },
  {
    key: 'gpt-5-5.xhigh.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-5.xhigh.codex-cli',
    usableQuotaFraction: 1,
  },
];

const claudeProTargets: readonly ExpectedSubscriptionTarget[] = [
  {
    key: 'claude-opus-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-opus-5.max.claude-code',
    usableQuotaFraction: 1,
  },
  {
    key: 'claude-sonnet-5.max.arena-agent-mode',
    basePresetId: 'builtin.agent.arena.claude-sonnet-5.max',
    usableQuotaFraction: 1,
  },
  {
    key: 'claude-sonnet-4-6.max.claude-code',
    basePresetId: 'builtin.harness.claude-sonnet-4-6.max.claude-code',
    usableQuotaFraction: 1,
  },
  {
    key: 'claude-haiku-4-5.max.chat',
    basePresetId: 'builtin.data-md.claude-haiku-4-5.max.vertex',
    usableQuotaFraction: 1,
  },
];

const claudeMaxTargets: readonly ExpectedSubscriptionTarget[] = [
  {
    key: 'claude-fable-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-fable-5.max.claude-code',
    usableQuotaFraction: 0.5,
  },
  {
    key: 'claude-fable-5-1.max.chat',
    basePresetId: 'builtin.claude-fable-5-1.max',
    usableQuotaFraction: 0.5,
  },
  {
    key: 'claude-opus-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-opus-5.max.claude-code',
    usableQuotaFraction: 1,
  },
];

const googleAiProTargets: readonly ExpectedSubscriptionTarget[] = [
  {
    key: 'gemini-3-8-flash.high.antigravity-sdk',
    basePresetId: 'builtin.harness.gemini-3-8-flash.high.antigravity-sdk',
    usableQuotaFraction: 1,
  },
  {
    key: 'gemini-3-8-flash.high.opencode',
    basePresetId: 'builtin.harness.gemini-3-8-flash.high.opencode',
    usableQuotaFraction: 1,
  },
  {
    key: 'gemini-3-1-pro.high.gemini-cli',
    basePresetId: 'builtin.harness.gemini-3-1-pro.high.gemini-cli',
    usableQuotaFraction: 1,
  },
  {
    key: 'gemini-3-7-flash.high.antigravity-sdk',
    basePresetId: 'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
    usableQuotaFraction: 1,
  },
  {
    key: 'gemini-3-7-flash.high.opencode',
    basePresetId: 'builtin.harness.gemini-3-7-flash.high.opencode',
    usableQuotaFraction: 1,
  },
  {
    key: 'gemini-3-5-flash-lite.high.chat',
    basePresetId: 'builtin.data-md.gemini-3-5-flash-lite.high.ai-studio',
    usableQuotaFraction: 1,
  },
];

const googleAiUltraTargets: readonly ExpectedSubscriptionTarget[] =
  googleAiProTargets.filter(({ key }) => key !== 'gemini-3-5-flash-lite.high.chat');

const superGrokTargets: readonly ExpectedSubscriptionTarget[] = [
  {
    key: 'grok-4-6.xhigh.chat',
    basePresetId: 'builtin.grok-4-6.xhigh',
    usableQuotaFraction: 1,
  },
];

const expectedSubscriptionPlans = [
  {
    key: 'chatgpt-plus',
    providerLabel: 'ChatGPT Plus',
    monthlyPriceUSD: 20,
    apiEquivalentCostUSD: 100,
    targets: chatGptPlusTargets,
  },
  {
    key: 'chatgpt-pro-20x',
    providerLabel: 'ChatGPT Pro 20×',
    monthlyPriceUSD: 200,
    apiEquivalentCostUSD: 2000,
    targets: chatGptPlusTargets.slice(0, 1),
  },
  {
    key: 'claude-pro',
    providerLabel: 'Claude Pro',
    monthlyPriceUSD: 20,
    apiEquivalentCostUSD: 80,
    targets: claudeProTargets,
  },
  {
    key: 'claude-max-20x',
    providerLabel: 'Claude Max 20×',
    monthlyPriceUSD: 200,
    apiEquivalentCostUSD: 1600,
    targets: claudeMaxTargets,
  },
  {
    key: 'google-ai-pro',
    providerLabel: 'Google AI Pro',
    monthlyPriceUSD: 20,
    apiEquivalentCostUSD: 260,
    targets: googleAiProTargets,
  },
  {
    key: 'google-ai-ultra-20x',
    providerLabel: 'Google AI Ultra 20×',
    monthlyPriceUSD: 200,
    apiEquivalentCostUSD: 5200,
    targets: googleAiUltraTargets,
  },
  {
    key: 'supergrok',
    providerLabel: 'SuperGrok',
    monthlyPriceUSD: 30,
    apiEquivalentCostUSD: 150,
    targets: superGrokTargets,
  },
] as const;

const expectedSubscriptionPresets = new Map<string, ExpectedSubscriptionPreset>(
  expectedSubscriptionPlans.flatMap((plan) => plan.targets.filter((target) => !retiredReaderPresetIds.has(`builtin.subscription.${plan.key}.${target.key}`)).map(
    (target): [string, ExpectedSubscriptionPreset] => [
      `builtin.subscription.${plan.key}.${target.key}`,
      {
        basePresetId: target.basePresetId,
        providerLabel: plan.providerLabel,
        monthlyPriceUSD: plan.monthlyPriceUSD,
        apiEquivalentCostUSD: plan.apiEquivalentCostUSD,
        usableQuotaFraction: target.usableQuotaFraction,
      },
    ],
  )),
);
const subscriptionPresets = BUILT_IN_CONFIGURATION_PRESETS
  .filter(({ access }) => access === 'subscription');
assert.equal(subscriptionPresets.length, expectedSubscriptionPresets.size);
for (const preset of subscriptionPresets) {
  const expected = expectedSubscriptionPresets.get(preset.id);
  assert.ok(expected, `Unexpected subscription preset ${preset.id}.`);
  assert.equal(preset.displayName.split(' | ')[2], expected.providerLabel);
  assert.equal(
    preset.displayName.includes('Subscription'),
    false,
    `Reader-facing subscription source ${preset.id} must stay concise.`,
  );
  assert.deepEqual(preset.subscriptionData, {
    planName: expected.providerLabel,
    monthlyPriceUSD: expected.monthlyPriceUSD,
    apiEquivalentCostUSD: expected.apiEquivalentCostUSD,
    usableQuotaFraction: expected.usableQuotaFraction,
  });
  const basePreset = ALL_CONFIGURATION_PRESET_CANDIDATES.find(
    (candidate) => candidate.id === expected.basePresetId,
  );
  assert.ok(basePreset);
  assert.deepEqual(preset.sourceCardIds, basePreset.sourceCardIds);
  assert.deepEqual(preset.sourceCardLinks, basePreset.sourceCardLinks);
}
for (const [presetId, expectedProviderLabel] of [
  ['builtin.harness.claude-opus-4-8.max.claude-code', 'Anthropic API'],
  ['builtin.agent.arena.claude-sonnet-5.max', 'Anthropic API'],
  ['builtin.agent.arena.hy3.high', 'Tencent API'],
] as const) {
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => candidate.id === presetId);
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(preset);
  assert.equal(preset.displayName.split(' | ')[2], expectedProviderLabel);
}
for (const preset of BUILT_IN_CONFIGURATION_PRESETS) {
  const fallbackLevels = (preset.sourceCardLinks || [])
    .flatMap((link) => {
      if (link.provenance.kind === 'lower_profile_fallback') {
        return [link.provenance.sourceLevel];
      }
      if (link.provenance.kind === 'lower_profile_harness_fallback') {
        return [link.provenance.sourceProfileLevel];
      }
      return [];
    });
  assert.ok(
    fallbackLevels.every((level, index) => index === 0 || fallbackLevels[index - 1] >= level),
    `Fallback cards for ${preset.id} must be ordered nearest lower tier first.`,
  );
}
const presetInstallReport = reconciledV3Store.installBuiltInConfigurationPresets();
assert.equal(presetInstallReport.presetCount, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.equal(presetInstallReport.installedBoxCount, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.equal(presetInstallReport.existingPresetCount, 0);
assert.equal(
  presetInstallReport.linkedCardCount,
  [...expectedPresetLinks.values()].reduce((total, links) => total + links.length, 0),
);
assert.equal(presetInstallReport.linkedLowerProfileFallbackCardCount, expectedLowerProfileFallbackCount);
assert.equal(presetInstallReport.linkedLowerHarnessFallbackCardCount, expectedLowerHarnessFallbackCount);
assert.equal(
  presetInstallReport.linkedLowerProfileHarnessFallbackCardCount,
  expectedLowerProfileHarnessFallbackCount,
);
assert.equal(presetInstallReport.unresolvedSourceCardCount, expectedUnresolvedPresetCardCount);
assert.equal(presetInstallReport.mismatchedSourceCardCount, expectedMismatchedPresetCardCount);
assert.equal(presetInstallReport.invalidPresetCount, 0);
const installedPresetBoxes = reconciledV3Store.boxes.filter((box) => (
  typeof box.builtInPresetId === 'string' && box.builtInPresetId.startsWith('builtin.')
));
assert.equal(installedPresetBoxes.length, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.ok(installedPresetBoxes.every((box) => box.enabled === true));
for (const box of installedPresetBoxes) {
  const expectedLinks = expectedPresetLinks.get(box.builtInPresetId!) || [];
  const actualStack = reconciledV3Store.getLinkedCardStack(box.id);
  assert.deepEqual(
    actualStack.map(({ card }) => card.id),
    expectedLinks.map(({ cardId }) => cardId),
    `Built-in ${box.builtInPresetId} must receive only its explicitly listed cards.`,
  );
  expectedLinks.forEach((expectedLink, index) => {
    const actualProvenance = actualStack[index]?.link.provenance;
    if (expectedLink.provenance.kind !== 'exact') {
      assert.deepEqual(actualProvenance, expectedLink.provenance);
    } else {
      assert.equal(actualProvenance, undefined);
    }
  });
}
const scoreByConfigurationId = new Map(
  reconciledV3Store.computeLeaderboardScores().map((score) => [score.config.id, score]),
);
const terraMaxCodexBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.gpt-5-6-terra.max.codex-cli'
));
assert.ok(terraMaxCodexBox);
const terraMaxCodexConfig = reconciledV3Store.buildLLMConfiguration(terraMaxCodexBox);
for (const [metricId, rawValue] of [
  ['tbench_v4', 0.215],
  ['tbench_science_v01', 0.086],
  ['frontiercode_v11_main_pass_rate', 0.4632],
] as const) {
  assert.equal(terraMaxCodexConfig.observations[metricId]?.rawValue, rawValue,
    `Retained Terra Max must receive the exact replacement metric ${metricId}.`);
}
const gpt56TextFallbackExpectations = [
  {
    presetId: 'builtin.harness.gpt-5-6-terra.max.codex-cli',
    modelName: 'GPT-5.6 Terra',
    arenaTextCardId: 'card-arena-gpt-5-6-terra-xhigh',
  },
  {
    presetId: 'builtin.harness.gpt-5-6-luna.max.codex-cli',
    modelName: 'GPT-5.6 Luna',
    arenaTextCardId: 'card-arena-gpt-5-6-luna-xhigh',
  },
] as const;
const arenaTextMetricIds = [
  'arena_text_instruction',
  'arena_text_multiturn',
  'arena_text_creative',
  'arena_text_hard',
  'arena_text_math',
  'arena_text_coding',
] as const;
for (const expectation of gpt56TextFallbackExpectations) {
  if (assertRetiredPresetIsNotShipped(expectation.presetId)) continue;
  const box = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === expectation.presetId
  ));
  assert.ok(box, `${expectation.modelName} must retain its Codex CLI configuration.`);
  const stack = reconciledV3Store.getLinkedCardStack(box.id);
  const textFallback = stack.find(({ card }) => card.id === expectation.arenaTextCardId);
  assert.deepEqual(
    textFallback?.link.provenance,
    {
      kind: 'lower_profile_harness_fallback',
      sourceProfile: 'XHigh',
      sourceProfileLevel: 4,
      targetProfile: 'Max',
      targetProfileLevel: 5,
      sourceHarness: 'Chat',
      sourceHarnessLevel: 0,
      targetHarness: 'Codex CLI',
      targetHarnessLevel: 1,
    },
    `${expectation.modelName} must use its exact Arena Text XHigh card only as an XHigh-to-Max Chat fallback.`,
  );
  const config = reconciledV3Store.buildLLMConfiguration(box);
  assert.deepEqual(
    arenaTextMetricIds.filter((metricId) => config.observations[metricId]),
    arenaTextMetricIds,
    `${expectation.modelName} must retain all six exact Arena Text metrics.`,
  );
  assert.equal(
    typeof scoreByConfigurationId.get(box.id)?.domainScores.chatting.score,
    'number',
    `${expectation.modelName} must receive a Chatting score from its exact Arena Text row.`,
  );
}
const newlyConnectedArenaChatExpectations = [
  {
    presetId: 'builtin.data-md.glm-5-3.max',
    modelName: 'GLM-5.3',
    arenaCardId: 'card-arena-glm-5-3-max',
  },
  {
    presetId: 'builtin.deepseek-v4-pro-0813.max',
    modelName: 'DeepSeek-v4-Pro 0813',
    arenaCardId: 'card-arena-deepseek-v4-pro-high-20260813',
  },
  {
    presetId: 'builtin.qwen3-8-27b.xhigh',
    modelName: 'Qwen3.8 27B',
    arenaCardId: 'card-arena-qwen3-8-27b',
  },
] as const;
for (const expectation of newlyConnectedArenaChatExpectations) {
  if (assertRetiredPresetIsNotShipped(expectation.presetId)) continue;
  const box = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === expectation.presetId
  ));
  assert.ok(box, `${expectation.modelName} must retain its reader-facing configuration.`);
  const stack = reconciledV3Store.getLinkedCardStack(box.id);
  assert.ok(
    stack.some(({ card }) => card.id === expectation.arenaCardId),
    `${expectation.modelName} must consume its exact current Arena card.`,
  );
  assert.equal(
    typeof scoreByConfigurationId.get(box.id)?.domainScores.chatting.score,
    'number',
    `${expectation.modelName} must receive a Chatting score from current Arena Text evidence.`,
  );
}
const glm53FlashBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.glm-5-3-flash.max'
));
assert.ok(glm53FlashBox, 'GLM-5.3-Flash must retain its reader-facing configuration.');
assert.ok(
  reconciledV3Store
    .getLinkedCardStack(glm53FlashBox.id)
    .some(({ card }) => card.id === 'card-arena-glm-5-3-flash'),
  'GLM-5.3-Flash must consume its exact current Arena WebDev card.',
);
assert.equal(
  typeof scoreByConfigurationId.get(glm53FlashBox.id)?.domainScores.coding.score,
  'number',
  'GLM-5.3-Flash must receive a Coding score from its current Arena WebDev evidence.',
);
const qwen27bBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.qwen3-8-27b.xhigh'
));
assert.ok(qwen27bBox);
assert.deepEqual(
  reconciledV3Store.getLinkedCardStack(qwen27bBox.id)
    .find(({ card }) => card.id === 'card-arena-qwen3-8-27b')
    ?.link.provenance,
  {
    kind: 'lower_profile_fallback',
    sourceProfile: 'Default',
    sourceLevel: 0,
    targetProfile: 'XHigh',
    targetLevel: 4,
  },
  'An Arena row without a published effort must remain an authored Default-to-XHigh fallback.',
);
const qwenMax0902Box = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.qwen3-8-max-0902.xhigh'
));
assert.ok(qwenMax0902Box);
const qwenMax0902CardIds = new Set(
  reconciledV3Store.getLinkedCardStack(qwenMax0902Box.id).map(({ card }) => card.id),
);
for (const cardId of [
  'card-aa-qwen3-8-max',
  'card-arena-qwen3-8-max-0902',
  'card-openrouter-qwen-qwen3-8-max-0902',
]) {
  assert.ok(qwenMax0902CardIds.has(cardId));
}
assert.match(
  reconciledV3Store.cards.find((card) => card.id === 'card-aa-qwen3-8-max')
    ?.exactSourceModelName || '',
  /0902/u,
);
for (const cardId of [
  'card-arena-qwen3-8-max',
  'card-aa-coding-agent-claude-code-qwen3-8-max',
  'card-openrouter-qwen-qwen3-8-max-prime',
]) {
  assert.equal(qwenMax0902CardIds.has(cardId), false);
}
const qwenFlashNextBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.qwen3-8-flash-next.xhigh'
));
assert.ok(qwenFlashNextBox, 'Qwen3.8-Flash-Next XHigh must enter the reader-facing catalog.');
const qwenFlashNextStack = reconciledV3Store.getLinkedCardStack(qwenFlashNextBox.id);
assert.ok(qwenFlashNextStack.some(({ card }) => card.id === 'card-aa-qwen3-8-flash-next'));
assert.deepEqual(
  qwenFlashNextStack
    .find(({ card }) => card.id === 'card-arena-qwen3-8-flash-next')
    ?.link.provenance,
  {
    kind: 'lower_profile_fallback',
    sourceProfile: 'Default',
    sourceLevel: 0,
    targetProfile: 'XHigh',
    targetLevel: 4,
  },
  'Qwen3.8-Flash-Next Arena evidence must remain an explicit Default-to-XHigh fallback.',
);
const qwenFlashNextConfig = reconciledV3Store.buildLLMConfiguration(qwenFlashNextBox);
assert.equal(qwenFlashNextConfig.openRouterData?.inputPricePerMToken, 0.15);
assert.equal(qwenFlashNextConfig.openRouterData?.outputPricePerMToken, 0.47);
assert.ok((qwenFlashNextConfig.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((qwenFlashNextConfig.openRouterData?.throughputP50TokensPerSec || 0) > 0);
assert.equal(scoreByConfigurationId.get(qwenFlashNextBox.id)?.availableDomainCount, 2);
assert.equal(scoreByConfigurationId.get(qwenFlashNextBox.id)?.eligibleForGlobalLeaderboard, false);
const hy4Box = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.hy4-preview.high'
));
assert.ok(hy4Box, 'Hy4 Preview High must enter as the explicitly approved sparse release.');
const hy4Stack = reconciledV3Store.getLinkedCardStack(hy4Box.id);
assert.deepEqual(
  hy4Stack.map(({ card }) => card.id),
  [
    'card-openrouter-tencent-hy4-preview',
    'card-openrouter-standard-performance-tencent-hy4-preview',
    'card-arena-hy4-preview',
  ],
  'Hy4 Preview must use only its exact OpenRouter practical cards and current Arena WebDev row.',
);
assert.deepEqual(
  hy4Stack.find(({ card }) => card.id === 'card-arena-hy4-preview')?.link.provenance,
  {
    kind: 'lower_profile_fallback',
    sourceProfile: 'Default',
    sourceLevel: 0,
    targetProfile: 'High',
    targetLevel: 3,
  },
  'Hy4 Preview WebDev evidence must remain an explicit Default-to-High fallback.',
);
const hy4Config = reconciledV3Store.buildLLMConfiguration(hy4Box);
for (const [metricId, actual] of [
  ['or_price_input', hy4Config.openRouterData?.inputPricePerMToken],
  ['or_price_output', hy4Config.openRouterData?.outputPricePerMToken],
] as const) {
  const sourcePrice = (observationsByCard.get('card-openrouter-tencent-hy4-preview') || [])
    .find((observation) => observation.metricId === metricId)?.rawValue;
  assert.equal(typeof sourcePrice, 'number');
  assert.equal(actual, sourcePrice, 'Hy4 pricing must use the refreshed Standard endpoint aggregate.');
}
assert.ok((hy4Config.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((hy4Config.openRouterData?.throughputP50TokensPerSec || 0) > 0);
assert.equal(scoreByConfigurationId.get(hy4Box.id)?.availableDomainCount, 1);
assert.equal(scoreByConfigurationId.get(hy4Box.id)?.eligibleForGlobalLeaderboard, false);
assert.equal(typeof scoreByConfigurationId.get(hy4Box.id)?.domainScores.frontend.score, 'number');
assert.equal(scoreByConfigurationId.get(hy4Box.id)?.domainScores.coding.score, null);
assert.equal(scoreByConfigurationId.get(hy4Box.id)?.domainScores.chatting.score, null);
assert.equal(scoreByConfigurationId.get(hy4Box.id)?.domainScores.reasoning.score, null);
const fable51Candidates = ALL_CONFIGURATION_PRESET_CANDIDATES.filter((preset) => (
  preset.productLineId === 'claude_fable_51'
  && preset.origin === 'source-backed'
  && preset.access === 'api'
));
assert.deepEqual(
  fable51Candidates.map((preset) => preset.id),
  [
    'builtin.claude-fable-5-1.low',
    'builtin.claude-fable-5-1.medium',
    'builtin.claude-fable-5-1.high',
    'builtin.claude-fable-5-1.xhigh',
    'builtin.claude-fable-5-1.max',
  ],
  'Fable 5.1 must retain all five independently evaluated API effort profiles.',
);
assert.ok(
  fable51Candidates.every((preset) => preset.identity.harness.name === '---'),
  'The five Fable 5.1 API effort profiles must remain separate from Claude Code.',
);
const fable51Box = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.claude-fable-5-1.max.claude-code'
));
assert.ok(fable51Box, 'The newly published Fable 5.1 Claude Code run must be reader-facing.');
const fable51Stack = reconciledV3Store.getLinkedCardStack(fable51Box.id);
assert.ok(fable51Stack.some(({ card }) => (
  card.id === 'card-aa-coding-agent-claude-code-claude-fable-5-1-max'
)));
assert.ok(fable51Stack.some(({ card }) => card.id === 'card-aa-claude-fable-5-1'));
assert.ok(fable51Stack.some(({ card }) => card.id === 'card-arena-claude-fable-5-1-max'));
assert.ok(fable51Stack.every(({ card }) => (
  card.metadataJson?.scope?.productLineId === 'claude_fable_51'
)));
const fable51Config = reconciledV3Store.buildLLMConfiguration(fable51Box);
assert.equal(fable51Config.openRouterData?.inputPricePerMToken, 10);
assert.equal(fable51Config.openRouterData?.outputPricePerMToken, 50);
assert.ok((fable51Config.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((fable51Config.openRouterData?.throughputP50TokensPerSec || 0) > 0);
assert.ok(fable51Config.observations.aa_coding_agent_swe_atlas_qna);
assert.ok((scoreByConfigurationId.get(fable51Box.id)?.availableDomainCount || 0) >= 3);
assert.equal(scoreByConfigurationId.get(fable51Box.id)?.eligibleForGlobalLeaderboard, true);
const inklingBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.inkling.xhigh'
));
assert.ok(inklingBox);
const inklingStack = reconciledV3Store.getLinkedCardStack(inklingBox.id);
assert.ok(inklingStack.some(({ card }) => (
  card.id === 'card-openrouter-thinkingmachines-inkling-free'
)));
assert.ok(inklingStack.some(({ card }) => (
  card.id === 'card-openrouter-standard-performance-thinkingmachines-inkling'
)));
assert.equal(
  inklingStack.some(({ card }) => card.id === 'card-openrouter-thinkingmachines-inkling'),
  false,
  'Inkling must not regain the paid price card through automatic source aliases.',
);
const inklingConfig = reconciledV3Store.buildLLMConfiguration(inklingBox);
assert.equal(inklingConfig.openRouterData?.inputPricePerMToken, 0);
assert.equal(inklingConfig.openRouterData?.outputPricePerMToken, 0);
assert.ok((inklingConfig.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((inklingConfig.openRouterData?.throughputP50TokensPerSec || 0) > 0);
for (const box of installedPresetBoxes) {
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find(
    (candidate) => candidate.id === box.builtInPresetId,
  );
  assert.ok(preset);
  const config = reconciledV3Store.buildLLMConfiguration(box);
  if (preset.subscriptionData) {
    const expectedEntryPoint = preset.subscriptionData.planName.startsWith('ChatGPT')
      ? 'ChatGPT Subscription'
      : preset.subscriptionData.planName.startsWith('Claude')
        ? 'Claude Subscription'
        : preset.subscriptionData.planName.startsWith('Google')
          ? 'Google Subscription'
          : 'xAI Subscription';
    assert.equal(config.access.entryPoint, expectedEntryPoint);
    assert.equal(config.provider, preset.subscriptionData.planName);
    assert.deepEqual(config.subscriptionData, preset.subscriptionData);
  }
  if (isPlainChatHarness(preset.identity.harness.name)) {
    assert.ok(
      Object.keys(config.observations).every(
        (metricId) => !isHarnessOnlyCapabilityMetric(metricId),
      ),
      `Chat preset ${preset.id} must not consume harness-only observations.`,
    );
  }
  const authorizedHarnessMetricIds = new Set(
    reconciledV3Store.getLinkedCardStack(box.id)
      .flatMap(({ link, card }) => (
        reconciledV3Store.getCardObservations(card.id)
          .filter((observation) => (
            isHarnessOnlyCapabilityMetric(observation.metricId)
            && isCapabilityMetricCompatibleWithSourceLink(
              observation.metricId,
              preset.identity.harness.name,
              link.provenance,
            )
          ))
          .map((observation) => observation.metricId)
      )),
  );
  assert.ok(
    Object.keys(config.observations)
      .filter(isHarnessOnlyCapabilityMetric)
      .every((metricId) => authorizedHarnessMetricIds.has(metricId)),
    `Preset ${preset.id} must consume harness metrics only through an exact or authored upward execution link.`,
  );
}
function expectedOpenRouterDataFromVerifiedCards(
  ...cardIds: string[]
) {
  const observations = cardIds.flatMap((cardId) => (
    reconciledV3Store.getCardObservations(cardId)
  ));
  const requireRawValue = (metricId: string) => {
    const observation = observations.find((candidate) => candidate.metricId === metricId);
    assert.ok(observation, `Missing verified ${metricId} observation.`);
    return observation.rawValue;
  };
  return {
    inputPricePerMToken: requireRawValue('or_price_input'),
    outputPricePerMToken: requireRawValue('or_price_output'),
    ttftP50Seconds: requireRawValue('or_ttft_p50'),
    throughputP50TokensPerSec: requireRawValue('or_throughput_p50'),
  };
}

function assertOpenRouterDataIsBackedByLinkedCards(
  box: ConfigurationBox,
  openRouterData: NonNullable<ReturnType<typeof reconciledV3Store.buildLLMConfiguration>['openRouterData']>,
) {
  const observations = reconciledV3Store.getLinkedCardStack(box.id)
    .flatMap(({ card }) => reconciledV3Store.getCardObservations(card.id));
  for (const [metricId, value] of [
    ['or_price_input', openRouterData.inputPricePerMToken],
    ['or_price_output', openRouterData.outputPricePerMToken],
    ['or_ttft_p50', openRouterData.ttftP50Seconds],
    ['or_throughput_p50', openRouterData.throughputP50TokensPerSec],
  ] as const) {
    assert.ok(
      observations.some((observation) => (
        observation.metricId === metricId
        && Math.abs(observation.rawValue - value) < 1e-12
      )),
      `${box.builtInPresetId} ${metricId} must equal a linked verified observation.`,
    );
  }
}
const newAugustHarnessExpectations = [
  {
    presetId: 'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
    modelName: 'Gemini 3.7 Flash',
    productLineId: 'gemini_37_flash',
    harness: 'Antigravity SDK',
    exactHarnessCardId:
      'card-aa-coding-agent-antigravity-sdk-gemini-3-7-flash-high',
    chatCardIds: [
      'card-aa-gemini-3-7-flash',
      'card-arena-gemini-3-7-flash-high',
    ],
    openRouterCardIds: [
      'card-openrouter-google-gemini-3-7-flash',
      'card-openrouter-standard-performance-google-gemini-3-7-flash',
    ],
  },
  {
    presetId: 'builtin.harness.gemini-3-7-flash.high.opencode',
    modelName: 'Gemini 3.7 Flash',
    productLineId: 'gemini_37_flash',
    harness: 'OpenCode',
    exactHarnessCardId: 'card-aa-coding-agent-opencode-gemini-3-7-flash-high',
    chatCardIds: [
      'card-aa-gemini-3-7-flash',
      'card-arena-gemini-3-7-flash-high',
    ],
    openRouterCardIds: [
      'card-openrouter-google-gemini-3-7-flash',
      'card-openrouter-standard-performance-google-gemini-3-7-flash',
    ],
  },
  {
    presetId: 'builtin.harness.muse-spark-1-2.xhigh.opencode',
    modelName: 'Muse Spark 1.2',
    productLineId: 'muse_spark_12',
    harness: 'OpenCode',
    exactHarnessCardId: 'card-aa-coding-agent-opencode-muse-spark-1-2-xhigh',
    chatCardIds: [
      'card-aa-muse-spark-1-2',
      'card-arena-muse-spark-1-2-xhigh',
    ],
    openRouterCardIds: [
      'card-openrouter-meta-muse-spark-1-2',
      'card-openrouter-standard-performance-meta-muse-spark-1-2',
    ],
  },
  {
    presetId: 'builtin.harness.muse-spark-1-2.xhigh.muse-code',
    modelName: 'Muse Spark 1.2',
    productLineId: 'muse_spark_12',
    harness: 'Muse Code',
    exactHarnessCardId: 'card-aa-coding-agent-muse-code-muse-spark-1-2-xhigh',
    chatCardIds: [
      'card-aa-muse-spark-1-2',
      'card-arena-muse-spark-1-2-xhigh',
    ],
    openRouterCardIds: [
      'card-openrouter-meta-muse-spark-1-2',
      'card-openrouter-standard-performance-meta-muse-spark-1-2',
    ],
  },
] as const;

for (const expectation of newAugustHarnessExpectations) {
  if (assertRetiredPresetIsNotShipped(expectation.presetId)) continue;
  const box = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === expectation.presetId
  ));
  assert.ok(box, `${expectation.presetId} must ship as an independent Harness configuration.`);
  assert.equal(box.identity?.harness.name, expectation.harness);
  const stack = reconciledV3Store.getLinkedCardStack(box.id);
  assert.deepEqual(
    stack.map(({ card }) => card.id),
    [
      expectation.exactHarnessCardId,
      ...expectation.chatCardIds,
      ...expectation.openRouterCardIds,
    ],
    `${expectation.presetId} must use exact Harness data, one-way Chat fallback, and complete OpenRouter practical data.`,
  );
  assert.ok(
    stack.every(({ card }) => (
      (card.metadataJson?.scope as Record<string, unknown> | undefined)?.productLineId
      === expectation.productLineId
    )),
    `${expectation.presetId} must not consume another product line.`,
  );
  const config = reconciledV3Store.buildLLMConfiguration(box);
  for (const metricId of [
    'aa_coding_agent_index',
    'aa_coding_agent_deepswe',
    'aa_coding_agent_swe_atlas_qna',
    'aa_coding_agent_terminalbench_v2',
  ]) {
    assert.ok(
      config.observations[metricId],
      `${expectation.presetId} must retain exact ${metricId} evidence.`,
    );
  }
  assert.equal(
    Object.keys(config.observations).some((metricId) => metricId.startsWith('arena_agent_')),
    false,
    `${expectation.presetId} must not invent Arena Agent Mode evidence.`,
  );
  assert.deepEqual(
    config.openRouterData,
    expectedOpenRouterDataFromVerifiedCards(...expectation.openRouterCardIds),
    `${expectation.presetId} must have complete price, latency, and throughput data.`,
  );
  const score = scoreByConfigurationId.get(box.id);
  assert.equal(score?.availableDomainCount, 6);
  assert.notEqual(score?.rawCapabilityScore, null);
  assert.notEqual(score?.practicalBreakdown.practicalScore, null);
  assert.equal(score?.eligibleForGlobalLeaderboard, true);
}

for (const productLineId of ['gemini_37_flash', 'muse_spark_12']) {
  assert.ok(
    BUILT_IN_CONFIGURATION_PRESETS.every((preset) => !(
      preset.productLineId === productLineId
      && preset.access === 'api'
      && preset.identity.harness.name === '---'
    )),
    `${productLineId} must not retain a reader-facing plain API configuration.`,
  );
}

const august2026ReleaseExpectations = [
  {
    presetId: 'builtin.grok-4-6.xhigh',
    modelName: 'Grok 4.6',
    productLineId: 'grok_46',
    cardIds: [
      'card-aa-grok-4-6-xhigh',
      'card-openrouter-x-ai-grok-4-6',
      'card-openrouter-standard-performance-x-ai-grok-4-6',
      'card-aa-grok-4-6',
      'card-arena-grok-4-6-high',
      'card-aa-grok-4-6-medium',
      'card-aa-grok-4-6-low',
    ],
    openRouterCardIds: [
      'card-openrouter-x-ai-grok-4-6',
      'card-openrouter-standard-performance-x-ai-grok-4-6',
    ],
  },
  {
    presetId: 'builtin.muse-glimmer.xhigh',
    modelName: 'Muse Glimmer',
    productLineId: 'muse_glimmer',
    cardIds: [
      'card-openrouter-meta-muse-glimmer-30b',
      'card-openrouter-standard-performance-meta-muse-glimmer-30b',
      'card-aa-muse-glimmer',
      'card-arena-muse-glimmer',
    ],
    openRouterCardIds: [
      'card-openrouter-meta-muse-glimmer-30b',
      'card-openrouter-standard-performance-meta-muse-glimmer-30b',
    ],
  },
  {
    presetId: 'builtin.deepseek-v4-pro-0813.max',
    modelName: 'DeepSeek-v4-Pro 0813',
    productLineId: 'deepseek_v4_pro_0813',
    cardIds: [
      'card-aa-deepseek-v4-pro',
      'card-openrouter-deepseek-deepseek-v4-pro-0813',
      'card-openrouter-standard-performance-deepseek-deepseek-v4-pro-0813',
      'card-arena-deepseek-v4-pro-high-20260813',
    ],
    openRouterCardIds: [
      'card-openrouter-deepseek-deepseek-v4-pro-0813',
      'card-openrouter-standard-performance-deepseek-deepseek-v4-pro-0813',
    ],
  },
] as const;

const august2026ReleaseBoxes = new Map<string, ConfigurationBox>();
for (const expectation of august2026ReleaseExpectations) {
  if (assertRetiredPresetIsNotShipped(expectation.presetId)) continue;
  const box = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === expectation.presetId
  ));
  assert.ok(box, `${expectation.modelName} must ship as a score-ready configuration.`);
  august2026ReleaseBoxes.set(expectation.productLineId, box);

  const stack = reconciledV3Store.getLinkedCardStack(box.id);
  assert.deepEqual(
    stack.map(({ card }) => card.id),
    expectation.cardIds,
    `${expectation.modelName} must use only its explicitly scoped August 2026 cards.`,
  );
  assert.ok(
    stack.every(({ card }) => (
      (card.metadataJson?.scope as Record<string, unknown> | undefined)?.productLineId
      === expectation.productLineId
    )),
    `${expectation.modelName} must not consume a similarly named product line.`,
  );

  const config = reconciledV3Store.buildLLMConfiguration(box);
  assert.deepEqual(
    config.openRouterData,
    expectedOpenRouterDataFromVerifiedCards(...expectation.openRouterCardIds),
    `${expectation.modelName} practical data must be copied from its linked OpenRouter cards.`,
  );
  const score = scoreByConfigurationId.get(box.id);
  assert.ok(
    (score?.availableDomainCount || 0) >= 5,
    `${expectation.modelName} must have enough independent domains for the global ranking.`,
  );
  assert.notEqual(score?.rawCapabilityScore, null);
  assert.notEqual(score?.practicalBreakdown.practicalScore, null);
  assert.equal(score?.eligibleForGlobalLeaderboard, true);
}

const retainedDeepSeekHistoricalCard = baseCards.find(({ id }) => id === 'card-arena-deepseek-v4-pro-high-20260813');
assert.ok(retainedDeepSeekHistoricalCard, 'Pruning reader boxes must preserve historical source evidence.');
assert.equal(retainedDeepSeekHistoricalCard.metadataJson?.scope?.productLineId, 'deepseek_v4_pro_0813');
function assertSubscriptionRoutesPreserveCapability(
  apiPresetId: string,
  subscriptionPresetIds: readonly string[],
) {
  if (assertRetiredPresetIsNotShipped(apiPresetId)) {
    for (const presetId of subscriptionPresetIds) assertRetiredPresetIsNotShipped(presetId);
    return;
  }

  const apiBox = installedPresetBoxes.find((box) => box.builtInPresetId === apiPresetId);
  assert.ok(apiBox, `Missing API base route ${apiPresetId}.`);
  const apiConfig = reconciledV3Store.buildLLMConfiguration(apiBox);
  const apiScore = scoreByConfigurationId.get(apiBox.id);
  assert.ok(apiScore);

  for (const subscriptionPresetId of subscriptionPresetIds) {
    const subscriptionBox = installedPresetBoxes.find((box) => (
      box.builtInPresetId === subscriptionPresetId
    ));
    assert.ok(subscriptionBox, `Missing independent subscription route ${subscriptionPresetId}.`);
    const subscriptionConfig = reconciledV3Store.buildLLMConfiguration(subscriptionBox);
    const subscriptionScore = scoreByConfigurationId.get(subscriptionBox.id);
    assert.ok(subscriptionScore);
    assert.deepEqual(
      subscriptionConfig.observations,
      apiConfig.observations,
      `${subscriptionPresetId} must reuse the exact API route capability evidence.`,
    );
    assert.deepEqual(
      subscriptionScore.domainScores,
      apiScore.domainScores,
      `${subscriptionPresetId} must preserve every API radar score.`,
    );
    assert.equal(subscriptionScore.rawCapabilityScore, apiScore.rawCapabilityScore);
    assert.notEqual(
      subscriptionScore.practicalBreakdown.practicalScore,
      apiScore.practicalBreakdown.practicalScore,
      `${subscriptionPresetId} must independently price its subscription access route.`,
    );
  }
}

const gemini38HarnessPriceMatrices = [
  {
    harness: 'Antigravity SDK',
    apiPresetId: 'builtin.harness.gemini-3-8-flash.high.antigravity-sdk',
    subscriptionPresetIds: [
      'builtin.subscription.google-ai-pro.gemini-3-8-flash.high.antigravity-sdk',
      'builtin.subscription.google-ai-ultra-20x.gemini-3-8-flash.high.antigravity-sdk',
    ],
  },
  {
    harness: 'OpenCode',
    apiPresetId: 'builtin.harness.gemini-3-8-flash.high.opencode',
    subscriptionPresetIds: [
      'builtin.subscription.google-ai-pro.gemini-3-8-flash.high.opencode',
      'builtin.subscription.google-ai-ultra-20x.gemini-3-8-flash.high.opencode',
    ],
  },
] as const;
const gemini38CodingAgentIndexByHarness = new Map<string, number>();
for (const matrix of gemini38HarnessPriceMatrices) {
  const apiBox = installedPresetBoxes.find((box) => box.builtInPresetId === matrix.apiPresetId);
  assert.ok(apiBox, `Missing Gemini 3.8 ${matrix.harness} API route.`);
  const apiConfig = reconciledV3Store.buildLLMConfiguration(apiBox);
  assert.equal(apiConfig.openRouterData?.inputPricePerMToken, 0.75);
  assert.equal(apiConfig.openRouterData?.outputPricePerMToken, 3.75);
  assert.ok((apiConfig.openRouterData?.ttftP50Seconds || 0) > 0);
  assert.ok((apiConfig.openRouterData?.throughputP50TokensPerSec || 0) > 0);
  for (const metricId of [
    'aa_coding_agent_index',
    'aa_coding_agent_swe_atlas_qna',
  ]) {
    assert.ok(apiConfig.observations[metricId], `Gemini 3.8 ${matrix.harness} must retain ${metricId}.`);
  }
  assert.equal(
    Object.keys(apiConfig.observations).some((metricId) => metricId.startsWith('arena_agent_')),
    false,
    `Gemini 3.8 ${matrix.harness} must not borrow AA Agent Harness metrics.`,
  );
  gemini38CodingAgentIndexByHarness.set(
    matrix.harness,
    apiConfig.observations.aa_coding_agent_index.rawValue,
  );
  assertSubscriptionRoutesPreserveCapability(matrix.apiPresetId, matrix.subscriptionPresetIds);
}
assert.notEqual(
  gemini38CodingAgentIndexByHarness.get('Antigravity SDK'),
  gemini38CodingAgentIndexByHarness.get('OpenCode'),
  'Gemini 3.8 must retain independent Antigravity SDK and OpenCode results.',
);
const gemini38AgentBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.agent.arena.gemini-3-8-flash.high'
));
assert.ok(gemini38AgentBox, 'Gemini 3.8 High must retain its Arena Agent Mode route.');
const gemini38AgentConfig = reconciledV3Store.buildLLMConfiguration(gemini38AgentBox);
for (const metricId of [
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]) {
  assert.ok(gemini38AgentConfig.observations[metricId]);
}
assert.equal(
  Object.keys(gemini38AgentConfig.observations)
    .some((metricId) => metricId.startsWith('aa_coding_agent_')),
  false,
  'Gemini 3.8 AA Agent Harness must not borrow Antigravity SDK or OpenCode observations.',
);
assert.equal(gemini38AgentConfig.openRouterData?.inputPricePerMToken, 0.75);
assert.equal(gemini38AgentConfig.openRouterData?.outputPricePerMToken, 3.75);
assert.ok((gemini38AgentConfig.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((gemini38AgentConfig.openRouterData?.throughputP50TokensPerSec || 0) > 0);

const muse13StandardBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.muse-spark-1-3.xhigh.muse-code'
));
const muse13ContributorBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId
    === 'builtin.api-tier.meta-contributor.muse-spark-1-3.xhigh.muse-code'
));
assert.ok(muse13StandardBox);
assert.ok(muse13ContributorBox);
const muse13StandardConfig = reconciledV3Store.buildLLMConfiguration(muse13StandardBox);
const muse13ContributorConfig = reconciledV3Store.buildLLMConfiguration(muse13ContributorBox);
assert.equal(muse13StandardConfig.openRouterData?.inputPricePerMToken, 1.25);
assert.equal(muse13StandardConfig.openRouterData?.outputPricePerMToken, 4.25);
assert.ok((muse13StandardConfig.openRouterData?.ttftP50Seconds || 0) > 0);
assert.ok((muse13StandardConfig.openRouterData?.throughputP50TokensPerSec || 0) > 0);
assert.equal(muse13ContributorConfig.openRouterData?.inputPricePerMToken, 0.1);
assert.equal(muse13ContributorConfig.openRouterData?.outputPricePerMToken, 0.2);
assert.equal(muse13ContributorConfig.openRouterData?.cacheReadPricePerMToken, 0.002);
assert.equal(
  muse13ContributorConfig.openRouterData?.ttftP50Seconds,
  muse13StandardConfig.openRouterData?.ttftP50Seconds,
);
assert.equal(
  muse13ContributorConfig.openRouterData?.throughputP50TokensPerSec,
  muse13StandardConfig.openRouterData?.throughputP50TokensPerSec,
);
assert.deepEqual(muse13ContributorConfig.observations, muse13StandardConfig.observations);
const muse13StandardScore = scoreByConfigurationId.get(muse13StandardBox.id);
const muse13ContributorScore = scoreByConfigurationId.get(muse13ContributorBox.id);
assert.ok(muse13StandardScore);
assert.ok(muse13ContributorScore);
assert.deepEqual(muse13ContributorScore.domainScores, muse13StandardScore.domainScores);
assert.equal(muse13ContributorScore.rawCapabilityScore, muse13StandardScore.rawCapabilityScore);
assert.notEqual(
  muse13ContributorScore.practicalBreakdown.costDelta,
  muse13StandardScore.practicalBreakdown.costDelta,
);
assert.equal(muse13StandardScore.practicalBreakdown.practicalScore, null);
assert.equal(muse13ContributorScore.practicalBreakdown.practicalScore, null);
assert.deepEqual(
  BUILT_IN_CONFIGURATION_PRESETS
    .filter((preset) => preset.productLineId === 'muse_spark_13')
    .map((preset) => preset.identity.model.profile),
  ['XHigh', 'XHigh'],
  'Muse Spark 1.3 Max must stay out of reader-facing routes until Meta opens it publicly.',
);

assertSubscriptionRoutesPreserveCapability(
  'builtin.grok-4-6.xhigh',
  ['builtin.subscription.supergrok.grok-4-6.xhigh.chat'],
);
assertSubscriptionRoutesPreserveCapability(
  'builtin.harness.gpt-5-5.xhigh.codex-cli',
  ['builtin.subscription.chatgpt-plus.gpt-5-5.xhigh.codex-cli'],
);
assert.ok(installedPresetBoxes.some((box) => (
  box.builtInPresetId === 'builtin.subscription.claude-max-20x.claude-fable-5-1.max.chat'
)));
assert.equal(
  BUILT_IN_CONFIGURATION_PRESETS.some((preset) => (
    preset.id === 'builtin.subscription.claude-pro.claude-fable-5.max.claude-code'
    || preset.id === 'builtin.subscription.claude-pro.claude-fable-5-1.max.chat'
  )),
  false,
  'Fable 5 and 5.1 must not expose Claude Pro as included subscription quota after the promotion ended.',
);
for (const presetId of [
  'builtin.harness.claude-fable-5.max.claude-code',
  'builtin.harness.claude-opus-4-6.max.claude-code',
  'builtin.harness.claude-opus-4-7.max.claude-code',
  'builtin.harness.claude-opus-4-8.max.claude-code',
  'builtin.harness.claude-sonnet-4-6.max.claude-code',
  'builtin.agent.arena.claude-sonnet-5.max',
  'builtin.harness.gemini-3-1-pro.high.gemini-cli',
  'builtin.harness.gpt-5-4.xhigh.codex-cli',
  'builtin.harness.gpt-5-5.xhigh.codex-cli',
  'builtin.source-catalog.source-profile-grok-4-3-high.grok-4-3-high',
] as const) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(box, `Search-backed model ${presetId} must be installed.`);
  const config = reconciledV3Store.buildLLMConfiguration(box);
  assert.ok(
    config.observations.arena_search,
    `Search/Grounding evidence must attach directly to its base model for ${presetId}.`,
  );
}
for (const [presetId, expectedHarness] of [
  ['builtin.harness.gemini-3-1-pro.high.gemini-cli', 'Gemini CLI'],
  ['builtin.harness.gpt-5-5.xhigh.codex-cli', 'Codex CLI'],
  ['builtin.harness.gpt-5-4.xhigh.codex-cli', 'Codex CLI'],
  ['builtin.harness.claude-opus-4-7.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-opus-4-6.max.claude-code', 'Claude Code'],
  ['builtin.harness.claude-sonnet-4-6.max.claude-code', 'Claude Code'],
  ['builtin.harness.kimi-k2-6.max.claude-code', 'Claude Code'],
  ['builtin.data-md.claude-haiku-4-5.max.vertex', '---'],
] as const) {
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => candidate.id === presetId);
  assert.ok(preset, `Requested historical comparator ${presetId} must be curated.`);
  assert.equal(preset.identity.harness.name, expectedHarness);
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  assert.ok(box, `Requested historical comparator ${presetId} must be installed.`);
  const score = scoreByConfigurationId.get(box.id);
  assert.ok(score, `Requested historical comparator ${presetId} must be scored.`);
  assert.ok(
    score.availableDomainCount >= 4,
    `Requested historical comparator ${presetId} must retain at least four capability domains.`,
  );
  assert.notEqual(
    score.practicalBreakdown.practicalScore,
    null,
    `Requested historical comparator ${presetId} must retain provider-neutral practical data.`,
  );
  assert.equal(
    score.eligibleForGlobalLeaderboard,
    true,
    `Requested historical comparator ${presetId} must be leaderboard-eligible.`,
  );
}
const structuredKimiK26Card = reconciledV3Store.cards.find(
  (card) => card.id === 'card-aa-kimi-k2-6',
);
assert.ok(structuredKimiK26Card);
assert.equal(
  structuredKimiK26Card.metadataJson?.sourceIdentity?.selectionMethod,
  'official-aa-structured-snapshot',
);
const structuredKimiK26MetricIds = new Set(
  reconciledV3Store.observations
    .filter((observation) => observation.sourceModelCardId === structuredKimiK26Card.id)
    .map((observation) => observation.metricId),
);
for (const metricId of [
  'aa_hle',
  'aa_gpqa_diamond',
  'aa_scicode',
  'aa_tau3_banking',
  'aa_terminalbench_v21',
  'aa_lcr',
  'aa_omniscience_nonhallucination',
]) {
  assert.ok(
    structuredKimiK26MetricIds.has(metricId),
    `Structured Kimi K2.6 AA card must retain ${metricId}.`,
  );
}
const agentUncertaintyBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.kimi-k3.max.kimi-code-cli'
));
assert.ok(agentUncertaintyBox);
const agentUncertaintyConfig = reconciledV3Store.buildLLMConfiguration(agentUncertaintyBox);
const currentSteerabilityObservation = reconciledV3Store.observations.find((observation) => (
  observation.metricId === 'arena_agent_steerability'
));
assert.ok(currentSteerabilityObservation);
for (const signal of ['steerability', 'steering_burden']) {
  assert.equal(getEmbeddedConfidenceRadius({
    ...currentSteerabilityObservation,
    metadataJson: { sourceRecord: { signalCi: { [signal]: 0.025 } } },
  }), 0.025, 'Both Arena source schemas must preserve the published CI radius.');
}
for (const metricId of [
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]) {
  assert.ok(
    agentUncertaintyConfig.observations[metricId],
    `Kimi K3 CLI must inherit ${metricId} from the lower generic Agent execution.`,
  );
  assert.ok(
    (agentUncertaintyConfig.observations[metricId].confidenceRadius || 0) > 0,
    `Kimi K3 CLI must pass ${metricId}'s published CI radius into scoring.`,
  );
}
const agentUncertaintyScore = scoreByConfigurationId.get(agentUncertaintyBox.id);
assert.equal(agentUncertaintyScore?.domainScores.agentic.coverage, 1);
const kimiPresets = BUILT_IN_CONFIGURATION_PRESETS.filter(
  (preset) => preset.productLineId === 'kimi_k3',
);
assert.deepEqual(
  kimiPresets.map((preset) => preset.identity.harness.name),
  ['Kimi Code CLI'],
  'Kimi K3 must ship once its generic Agent evidence is allowed to fill the higher Kimi Code CLI configuration.',
);
const kimiCodeBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.kimi-k3.max.kimi-code-cli'
));
assert.ok(kimiCodeBox);
const kimiCodeConfig = reconciledV3Store.buildLLMConfiguration(kimiCodeBox);
for (const metricId of [
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]) {
  assert.ok(
    kimiCodeConfig.observations[metricId],
    `Kimi K3 Kimi Code CLI must inherit ${metricId} from the lower generic Agent execution.`,
  );
}
const kimiCodeScore = scoreByConfigurationId.get(kimiCodeBox.id);
assert.ok(
  Math.abs((kimiCodeScore?.domainScores.agentic.coverage || 0) - 1) < 1e-9,
  'Kimi K3 must combine the exact AA TB4 record with the lower Arena Agent behavior bundle.',
);
assert.equal(kimiCodeScore?.domainScores.reasoning.score !== null, true);
assert.equal(kimiCodeScore?.domainScores.documents.score !== null, true);
for (const [presetId, expectedAuthorProvider] of [
  ['builtin.harness.claude-opus-4-8.max.claude-code', 'Anthropic'],
  ['builtin.agent.arena.claude-sonnet-5.max', 'Anthropic'],
  ['builtin.agent.arena.hy3.high', 'Tencent'],
  ['builtin.data-md.mistral-medium-3-5.max', 'Mistral'],
] as const) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(box, `Provider-neutral practical preset ${presetId} must be installed.`);
  const score = scoreByConfigurationId.get(box.id);
  assert.ok(score, `Provider-neutral practical preset ${presetId} must be scored.`);
  assert.equal(score.config.provider, expectedAuthorProvider);
  assert.notEqual(
    score.practicalBreakdown.practicalScore,
    null,
    `Provider-neutral OpenRouter price/performance must complete ${presetId}.`,
  );
}

for (const presetId of [
  'builtin.source-catalog.source-profile-grok-4-3-high.grok-4-3-high',
] as const) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  if (assertRetiredPresetIsNotShipped(presetId)) continue;
  assert.ok(box, `Practical-source repair preset ${presetId} must be installed.`);
  const configuration = reconciledV3Store.buildLLMConfiguration(box);
  assert.ok(configuration.openRouterData, `${presetId} must have complete practical data.`);
  assertOpenRouterDataIsBackedByLinkedCards(box, configuration.openRouterData);
}

// The October releases keep API efforts separate from measured CLI runs.
// Their current DeepSWE v1.1/TB4 components must not fill legacy metric slots.
for (const release of [
  { line: 'gpt_61_sol', prefix: 'gpt-6-1-sol', harness: 'Codex CLI', cardPrefix: 'codex-gpt-6-1-sol', harnessKey: 'codex-cli' },
  { line: 'claude_sonnet_55', prefix: 'claude-sonnet-5-5', harness: 'Claude Code', cardPrefix: 'claude-code-claude-sonnet-5-5', harnessKey: 'claude-code' },
] as const) {
  for (const profile of ['low', 'medium', 'high', 'xhigh', 'max']) {
    const apiPreset = ALL_CONFIGURATION_PRESET_CANDIDATES.find((preset) => (
      preset.id === `builtin.${release.prefix}.${profile}`
    ));
    assert.ok(apiPreset, `Missing measured ${release.prefix}/${profile} API profile.`);
    assert.ok(apiPreset.sourceCardIds?.includes(
      profile === 'max' ? `card-aa-${release.prefix}` : `card-aa-${release.prefix}-${profile}`,
    ));
    const harnessCardId = `card-aa-coding-agent-${release.cardPrefix}-${profile}`;
    const harnessCard = VERIFIED_HARNESS_SOURCE_MODEL_CARDS.find((card) => card.id === harnessCardId);
    assert.ok(harnessCard, `Missing measured ${release.prefix}/${profile} CLI profile.`);
    assert.equal(harnessCard.metadataJson?.scope?.productLineId, release.line);
    assert.equal(harnessCard.metadataJson?.execution?.harness, release.harness);
    const sourceRow = codingAgentRecords.find((row) => row.id === harnessCard.metadataJson?.sourceIdentity?.sourceRecordId);
    assert.ok(sourceRow);
    const cardObservations = VERIFIED_HARNESS_SOURCE_OBSERVATIONS.filter((observation) => (
      observation.sourceModelCardId === harnessCardId
    ));
    assert.equal(cardObservations.find((observation) => observation.metricId === 'aa_coding_agent_index')?.rawValue, sourceRow.indexScore);
    assert.ok(!cardObservations.some((observation) => (
      ['aa_coding_agent_deepswe', 'aa_coding_agent_terminalbench_v2'].includes(observation.metricId)
    )));
  }
  const box = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === `builtin.harness.${release.prefix}.max.${release.harnessKey}`
  ));
  assert.ok(box, 'The highest independently measured CLI effort must enter the reader inventory.');
  const stack = reconciledV3Store.getLinkedCardStack(box.id);
  assert.equal(stack[0].card.id, `card-aa-coding-agent-${release.cardPrefix}-max`);
  assert.ok(stack.every(({ card }) => card.metadataJson?.scope?.productLineId === release.line));
  assert.equal(scoreByConfigurationId.get(box.id)?.eligibleForGlobalLeaderboard, false, 'Fresh CLI results must not override missing dialogue/reasoning coverage.');
  assert.equal(BUILT_IN_CONFIGURATION_PRESETS.filter((preset) => preset.productLineId === release.line).length, 1);
}
assert.ok(!BUILT_IN_CONFIGURATION_PRESETS.some((preset) => (
  ['gemini_4_argon', 'gpt_61_sol_pro'].includes(preset.productLineId)
)), 'Limited-access Argon and Pro without capability evidence remain source-pool records.');
assert.ok(baseCards.some((card) => card.id === 'card-aa-mimo-v2-6-flash'));

const firstInstalledPreset = installedPresetBoxes[0];
assert.ok(firstInstalledPreset);
assert.ok(reconciledV3Store.updateBox(firstInstalledPreset.id, { enabled: true, note: 'operator override' }));
const repeatPresetInstallReport = reconciledV3Store.installBuiltInConfigurationPresets();
assert.equal(repeatPresetInstallReport.installedBoxCount, 0);
assert.equal(repeatPresetInstallReport.existingPresetCount, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.equal(reconciledV3Store.boxes.find((box) => box.id === firstInstalledPreset.id)?.enabled, true);
assert.equal(reconciledV3Store.boxes.find((box) => box.id === firstInstalledPreset.id)?.note, 'operator override');

// A compact inventory revision replaces obsolete shipped boxes while keeping
// user-created drafts. This is the browser migration that removes the old
// thousand-entry catalog instead of merely ceasing to add to it.
const preservedUserBox = reconciledV3Store.createBox(
  'user_compact_inventory_draft',
  'User Compact Inventory Draft',
  undefined,
  false,
);
const obsoleteBuiltInBox: ConfigurationBox = {
  id: 'box-obsolete-built-in',
  internalName: 'builtin_obsolete_profile',
  displayName: 'Obsolete Built-in Profile',
  builtInPresetId: 'builtin.obsolete.profile',
  enabled: true,
  createdAt: '2026-07-28',
  updatedAt: '2026-07-28',
};
reconciledV3Store.boxes.push(obsoleteBuiltInBox);
// Simulate every route stored by the previous reader release, including its
// subscription and provider variants. The inventory migration must remove
// these real retired identities while preserving the user-authored draft.
for (const [index, presetId] of retiredReaderConfigurationIds.entries()) {
  reconciledV3Store.boxes.push({
    id: `box-retired-reader-${index}`,
    internalName: `retired_reader_${index}`,
    displayName: presetId,
    builtInPresetId: presetId,
    enabled: true,
    createdAt: '2026-09-25',
    updatedAt: '2026-09-25',
  });
}
const retiredEmptyLegacyBox: ConfigurationBox = {
  id: 'box-retired-empty-legacy',
  internalName: 'qwen_37_flash_legacy_empty',
  displayName: 'Qwen3.7 Flash Max | Chat | Alibaba API',
  identity: {
    model: { name: 'Qwen3.7 Flash', profile: 'Max' },
    harness: { name: 'Chat', environment: 'Chat' },
    provider: { name: 'Alibaba', upstream: 'Alibaba API' },
  },
  enabled: true,
  createdAt: '2026-07-28',
  updatedAt: '2026-07-28',
};
const repairedLegacyBox: ConfigurationBox = {
  id: 'box-repaired-legacy',
  internalName: 'qwen_36_flash_legacy_repaired',
  displayName: 'Qwen3.6 Flash Max | Chat | Alibaba API',
  identity: {
    model: { name: 'Qwen3.6 Flash', profile: 'Max' },
    harness: { name: 'Chat', environment: 'Chat' },
    provider: { name: 'Alibaba', upstream: 'Alibaba API' },
  },
  enabled: true,
  createdAt: '2026-07-28',
  updatedAt: '2026-07-28',
};
reconciledV3Store.boxes.push(retiredEmptyLegacyBox, repairedLegacyBox);
reconciledV3Store.links.push({
  id: 'link-repaired-legacy-capability',
  configurationId: repairedLegacyBox.id,
  source: pair.lower.source,
  sourceModelCardId: pair.lower.id,
  priority: 0,
  createdAt: '2026-07-28',
  updatedAt: '2026-07-28',
});
const compactSyncReport = reconciledV3Store.synchronizeBuiltInConfigurationPresets();
assert.equal(
  compactSyncReport.removedBuiltInBoxCount,
  BUILT_IN_CONFIGURATION_PRESETS.length + 1 + retiredReaderConfigurationIds.length,
);
assert.equal(compactSyncReport.removedRetiredLegacyBoxCount, 1);
assert.equal(compactSyncReport.installedBoxCount, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.ok(reconciledV3Store.boxes.some((box) => box.id === preservedUserBox.id));
assert.ok(!reconciledV3Store.boxes.some((box) => box.id === obsoleteBuiltInBox.id));
assert.ok(!reconciledV3Store.boxes.some((box) => (
  box.builtInPresetId && retiredReaderPresetIds.has(box.builtInPresetId)
)), 'No previous retired reader route may survive or be reinstalled after migration.');
assert.ok(!reconciledV3Store.boxes.some((box) => box.id === retiredEmptyLegacyBox.id));
assert.ok(reconciledV3Store.boxes.some((box) => box.id === repairedLegacyBox.id));
assert.ok(reconciledV3Store.links.some(
  (link) => link.configurationId === repairedLegacyBox.id,
));
assert.equal(
  reconciledV3Store.boxes.filter((box) => box.builtInPresetId).length,
  BUILT_IN_CONFIGURATION_PRESETS.length,
);
const repeatCompactSyncReport = reconciledV3Store.synchronizeBuiltInConfigurationPresets();
assert.equal(repeatCompactSyncReport.removedBuiltInBoxCount, 0);
assert.equal(repeatCompactSyncReport.removedRetiredLegacyBoxCount, 0);
assert.equal(repeatCompactSyncReport.installedBoxCount, 0);
assert.equal(repeatCompactSyncReport.existingPresetCount, BUILT_IN_CONFIGURATION_PRESETS.length);

// Future inventory rows may list stable source-card IDs. The installer must
// accept the exact matching record only, reject a different product line, and
// leave an unknown ID unresolved rather than attempting a name-based fallback.
const lowerScope = pair.lower.metadataJson?.scope as Record<string, unknown>;
const explicitCardPreset: BuiltInConfigurationPreset = {
  id: 'builtin.test.explicit-card-guard',
  internalName: 'builtin_test_explicit_card_guard',
  displayName: 'Explicit Card Guard',
  productLineId: String(lowerScope.productLineId),
  identity: {
    model: { name: 'Explicit Card Guard', profile: 'Test' },
    harness: { name: '正常对话', environment: 'test' },
    provider: { name: 'Test Provider', upstream: 'Test API' },
  },
  origin: 'data-md',
  access: 'api',
  sourceCardIds: [pair.lower.id, differentScopeCard.id, 'missing-explicit-card-id'],
};
const mutablePresets = BUILT_IN_CONFIGURATION_PRESETS as BuiltInConfigurationPreset[];
mutablePresets.push(explicitCardPreset);
try {
  const explicitCardReport = reconciledV3Store.installBuiltInConfigurationPresets();
  assert.equal(explicitCardReport.installedBoxCount, 1);
  assert.equal(explicitCardReport.linkedCardCount, 1);
  assert.equal(explicitCardReport.mismatchedSourceCardCount, 1);
  assert.equal(explicitCardReport.unresolvedSourceCardCount, 1);
  const explicitBox = reconciledV3Store.boxes.find((box) => box.builtInPresetId === explicitCardPreset.id);
  assert.ok(explicitBox);
  assert.equal(explicitBox.enabled, true);
  assert.deepEqual(
    reconciledV3Store.getLinkedCardStack(explicitBox.id).map(({ card }) => card.id),
    [pair.lower.id],
  );
} finally {
  mutablePresets.pop();
}

// A profile fallback is an explicit, auditable declaration—not a comparison
// of strings such as “High” and “Max”.  It may be installed only for the
// unchanged API preset that declares a strictly lower source level.  When a
// future inventory adds it to an already-installed preset, it is appended
// under every existing/manual card instead of changing their order.
const fallbackScope = pair.lower.metadataJson?.scope as Record<string, unknown>;
const reconciliationPreset: BuiltInConfigurationPreset = {
  id: 'builtin.test.lower-profile-reconciliation',
  internalName: 'builtin_test_lower_profile_reconciliation',
  displayName: 'Lower Profile Reconciliation',
  productLineId: String(fallbackScope.productLineId),
  identity: {
    model: { name: 'Lower Profile Test', profile: 'Max API' },
    harness: { name: '正常对话', environment: 'test API' },
    provider: { name: 'Test Provider', upstream: 'Test Provider API' },
  },
  origin: 'data-md',
  access: 'api',
  sourceCardIds: [pair.lower.id],
};
const reverseFallbackPreset: BuiltInConfigurationPreset = {
  id: 'builtin.test.reverse-profile-fallback',
  internalName: 'builtin_test_reverse_profile_fallback',
  displayName: 'Reverse Profile Fallback',
  productLineId: String(fallbackScope.productLineId),
  identity: {
    model: { name: 'Reverse Fallback Test', profile: 'High API' },
    harness: { name: '正常对话', environment: 'test API' },
    provider: { name: 'Test Provider', upstream: 'Test Provider API' },
  },
  origin: 'data-md',
  access: 'api',
  sourceCardLinks: [{
    cardId: pair.supportingCard.id,
    provenance: {
      kind: 'lower_profile_fallback',
      sourceProfile: 'Max API',
      sourceLevel: 2,
      targetProfile: 'High API',
      targetLevel: 1,
    },
  }],
};
const managedFallbackPreset: BuiltInConfigurationPreset = {
  id: 'builtin.test.managed-profile-fallback',
  internalName: 'builtin_test_managed_profile_fallback',
  displayName: 'Managed Profile Fallback',
  productLineId: String(fallbackScope.productLineId),
  identity: {
    model: { name: 'Managed Fallback Test', profile: 'Max managed' },
    harness: { name: 'Managed Client', environment: 'subscription' },
    provider: { name: 'Managed Provider', upstream: 'Subscription service' },
  },
  origin: 'data-md',
  access: 'managed-service',
  sourceCardLinks: [{
    cardId: pair.supportingCard.id,
    provenance: {
      kind: 'lower_profile_fallback',
      sourceProfile: 'High managed',
      sourceLevel: 1,
      targetProfile: 'Max managed',
      targetLevel: 2,
    },
  }],
};
const fallbackTestPresets = BUILT_IN_CONFIGURATION_PRESETS as BuiltInConfigurationPreset[];
fallbackTestPresets.push(reconciliationPreset, reverseFallbackPreset, managedFallbackPreset);
try {
  const firstFallbackInstall = reconciledV3Store.installBuiltInConfigurationPresets();
  assert.equal(firstFallbackInstall.installedBoxCount, 1);
  assert.equal(firstFallbackInstall.linkedCardCount, 1);
  assert.equal(firstFallbackInstall.linkedLowerProfileFallbackCardCount, 0);
  assert.equal(firstFallbackInstall.invalidPresetCount, 2);
  const reconciliationBox = reconciledV3Store.boxes.find((box) => (
    box.builtInPresetId === reconciliationPreset.id
  ));
  assert.ok(reconciliationBox);
  assert.deepEqual(
    reconciledV3Store.getLinkedCardStack(reconciliationBox.id).map(({ card }) => card.id),
    [pair.lower.id],
  );

  // Preserve an operator's ordering: a manually added card remains on top,
  // then the original exact built-in card, then the newly declared fallback.
  assert.ok(reconciledV3Store.linkCardToBox(reconciliationBox.id, pair.upper.id));
  reconciliationPreset.sourceCardLinks = [{
    cardId: pair.supportingCard.id,
    provenance: {
      kind: 'lower_profile_fallback',
      sourceProfile: 'High API',
      sourceLevel: 1,
      targetProfile: 'Max API',
      targetLevel: 2,
    },
  }];
  const reconciliationReport = reconciledV3Store.installBuiltInConfigurationPresets();
  assert.equal(reconciliationReport.installedBoxCount, 0);
  assert.equal(reconciliationReport.existingPresetCount >= 1, true);
  assert.equal(reconciliationReport.linkedCardCount, 1);
  assert.equal(reconciliationReport.linkedLowerProfileFallbackCardCount, 1);
  const reconciledStack = reconciledV3Store.getLinkedCardStack(reconciliationBox.id);
  assert.deepEqual(reconciledStack.map(({ card }) => card.id), [
    pair.upper.id,
    pair.lower.id,
    pair.supportingCard.id,
  ]);
  assert.equal(reconciledStack[2].link.provenance?.kind, 'lower_profile_fallback');
  if (reconciledStack[2].link.provenance?.kind === 'lower_profile_fallback') {
    assert.equal(reconciledStack[2].link.provenance.sourceProfile, 'High API');
    assert.equal(reconciledStack[2].link.provenance.targetProfile, 'Max API');
  }

  // An installed inventory is idempotent once every explicit card is present.
  const repeatFallbackReconciliation = reconciledV3Store.installBuiltInConfigurationPresets();
  assert.equal(repeatFallbackReconciliation.linkedCardCount, 0);

  // Backup data retains the fallback provenance, rather than making a
  // restored configuration look like an exact source mapping.
  const fallbackBackupBox = reconciledV3Store.exportConfigurationBackup().boxes.find((box) => (
    box.builtInPresetId === reconciliationPreset.id
  ));
  assert.ok(fallbackBackupBox);
  assert.equal(fallbackBackupBox.links[2]?.provenance?.kind, 'lower_profile_fallback');
  const fallbackImportStart = reconciledV3Store.boxes.length;
  const fallbackImportReport = reconciledV3Store.importConfigurationBackup({
    format: 'llmpk.configuration-backup',
    schemaVersion: 1,
    exportedAt: '2026-07-27T00:00:00.000Z',
    boxes: [fallbackBackupBox],
  });
  assert.equal(fallbackImportReport.accepted, true);
  assert.equal(fallbackImportReport.importedBoxCount, 1);
  assert.equal(fallbackImportReport.importedLinkCount, 3);
  assert.equal(fallbackImportReport.rejectedLinkCount, 0);
  const importedFallbackBox = reconciledV3Store.boxes[fallbackImportStart];
  assert.ok(importedFallbackBox);
  assert.equal(
    reconciledV3Store.getLinkedCardStack(importedFallbackBox.id)[2]?.link.provenance?.kind,
    'lower_profile_fallback',
  );

  // Changing the API route invalidates only the fallback. Exact/manual cards
  // remain, so a subscription or managed route can never inherit it.
  assert.ok(reconciledV3Store.updateBox(reconciliationBox.id, {
    identity: {
      ...reconciliationPreset.identity,
      provider: { name: 'Subscription Provider', upstream: 'Subscription service' },
    },
  }));
  assert.deepEqual(
    reconciledV3Store.getLinkedCardStack(reconciliationBox.id).map(({ card }) => card.id),
    [pair.upper.id, pair.lower.id],
  );
} finally {
  fallbackTestPresets.pop();
  fallbackTestPresets.pop();
  fallbackTestPresets.pop();
}

console.log('adminMappingStore ordered-stack migration, precedence, and backup import/export: PASS');
