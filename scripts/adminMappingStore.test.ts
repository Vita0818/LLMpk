import assert from 'node:assert/strict';
import { VERIFIED_SOURCE_MODEL_CARDS, VERIFIED_SOURCE_OBSERVATIONS } from '../src/data/seedCards';
import {
  VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
  VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
} from '../src/data/harnessSeedCards';
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

for (const metricId of [
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
  14,
  'LongCat 2.0 recovery must expose ten current capability and four AA practical-fallback observations.',
);
assert.ok(
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS.some((observation) => (
    observation.metricId === 'aa_tau3_banking'
  )),
  'LongCat 2.0 must retain the τ³-Banking value newly published by the refreshed source.',
);

for (const expectation of [
  {
    cardId: 'card-aa-coding-agent-codex-deepseek-v4-flash-0731-max',
    sourceRecordId: 'ba75b0f1ce2019c511374b7a7f850ce5',
    sourceHarnessLabel: 'Codex',
    harnessName: 'Codex CLI',
  },
  {
    cardId: 'card-aa-coding-agent-opencode-gemini-3-6-flash-high',
    sourceRecordId: '4fb40d5633b706eecb1da0a68cb4f1ed',
    sourceHarnessLabel: 'Opencode',
    harnessName: 'OpenCode',
  },
  {
    cardId: 'card-aa-coding-agent-claude-code-qwen3-8-max',
    sourceRecordId: 'f06493dca66d238f2252adb8092dd10f',
    sourceHarnessLabel: 'Claude Code',
    harnessName: 'Claude Code',
  },
] as const) {
  const card = VERIFIED_HARNESS_SOURCE_MODEL_CARDS.find(
    (candidate) => candidate.id === expectation.cardId,
  );
  assert.ok(card, `Corrected AA Agent Harness card ${expectation.cardId} must be projected.`);
  assert.equal(card.metadataJson?.sourceIdentity?.sourceRecordId, expectation.sourceRecordId);
  assert.equal(card.metadataJson?.sourceIdentity?.sourceHarnessLabel, expectation.sourceHarnessLabel);
  assert.equal(card.metadataJson?.sourceIdentity?.harnessName, expectation.harnessName);
  const metricIds = new Set(
    VERIFIED_HARNESS_SOURCE_OBSERVATIONS
      .filter((observation) => observation.sourceModelCardId === expectation.cardId)
      .map((observation) => observation.metricId),
  );
  for (const metricId of [
    'aa_coding_agent_index',
    'aa_coding_agent_deepswe',
    'aa_coding_agent_swe_atlas_qna',
    'aa_coding_agent_terminalbench_v2',
  ]) {
    assert.ok(metricIds.has(metricId), `${expectation.cardId} must expose ${metricId}.`);
  }
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
    'oagxm-current-product-lines/v5-2026-08-13-releases',
    'oagxm-current-product-lines/v5-2026-08-13-releases',
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
  && BUILT_IN_CONFIGURATION_PRESETS.length <= 80,
  'The post-V4 reader-facing inventory should stay focused without becoming skeletal.',
);
assert.equal(
  BUILT_IN_CONFIGURATION_MAX_PER_MODEL,
  6,
  'Two independently measured Harness routes may each expose API, Pro, and Ultra pricing configurations.',
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
  'builtin.harness.qwen3-8.max.claude-code',
  'builtin.harness.gpt-5-6-sol.max.codex-cli',
  'builtin.harness.gpt-5-6-luna.max.codex-cli',
  'builtin.harness.gpt-5-6-terra.max.codex-cli',
  'builtin.harness.claude-opus-4-8.max.claude-code',
  'builtin.agent.arena.claude-sonnet-5.max',
  'builtin.agent.arena.deepseek-v4-flash.max',
  'builtin.agent.arena.gemini-3-5-flash.high',
  'builtin.agent.arena.qwen-3-7-max.max',
  'builtin.agent.arena.nemotron-3-ultra.high',
  'builtin.data-md.step-3-7-flash.max',
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
  'builtin.agent.arena.grok-build-0-1.max',
  'builtin.source-catalog.source-profile-inkling-xhigh.inkling-xhigh',
  'builtin.data-md.longcat-2-0.max',
  'builtin.source-catalog.source-profile-north-mini-code.north-mini-code',
  'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
  'builtin.harness.gemini-3-7-flash.high.opencode',
  'builtin.harness.muse-spark-1-2.xhigh.opencode',
  'builtin.harness.muse-spark-1-2.xhigh.muse-code',
]) {
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
assert.equal(
  uniqueRouteCountForHarness('AA Agent Harness'),
  8,
  'The eight former Arena Agent Mode routes must display AA Agent Harness.',
);
assert.equal(
  uniqueRouteCountForHarness('---'),
  11,
  'Routes without an AA Coding Agent record must display ---.',
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
  'builtin.data-md.qwen-3-7-max.max',
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
    key: 'claude-fable-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-fable-5.max.claude-code',
    usableQuotaFraction: 0.5,
  },
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

const googleAiProTargets: readonly ExpectedSubscriptionTarget[] = [
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
    targets: claudeProTargets.slice(0, 2),
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
  expectedSubscriptionPlans.flatMap((plan) => plan.targets.map(
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
const deepSeek0731Box = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.deepseek-v4-flash-0731.max.codex-cli'
));
assert.ok(deepSeek0731Box, 'DeepSeek V4 Flash 0731 Max must use its exact Codex configuration.');
assert.deepEqual(
  reconciledV3Store.getLinkedCardStack(deepSeek0731Box.id).map(({ card }) => card.id),
  [
    'card-aa-coding-agent-codex-deepseek-v4-flash-0731-max',
    'card-arena-deepseek-v4-flash-high',
    'card-aa-deepseek-v4-flash',
    'card-openrouter-deepseek-deepseek-v4-flash-0731',
    'card-openrouter-standard-performance-deepseek-deepseek-v4-flash-0731',
  ],
  'The 0731 Codex configuration must use only independently versioned 0731 cards.',
);
const deepSeek0731Config = reconciledV3Store.buildLLMConfiguration(deepSeek0731Box);
assert.deepEqual(
  Object.keys(deepSeek0731Config.observations).filter((metricId) => metricId.startsWith('arena_')),
  ['arena_code_webdev'],
  'Only the independently versioned 0731 Arena WebDev row may be connected.',
);
assert.equal(
  deepSeek0731Config.observations.arena_code_webdev?.rawValue,
  1581.1689724767473,
);
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
assert.deepEqual(
  deepSeek0731Config.openRouterData,
  expectedOpenRouterDataFromVerifiedCards(
    'card-openrouter-deepseek-deepseek-v4-flash-0731',
    'card-openrouter-standard-performance-deepseek-deepseek-v4-flash-0731',
  ),
);
const deepSeek0731Score = scoreByConfigurationId.get(deepSeek0731Box.id);
assert.equal(deepSeek0731Score?.availableDomainCount, 5);
assert.equal(deepSeek0731Score?.eligibleForGlobalLeaderboard, true);
assert.notEqual(deepSeek0731Score?.practicalBreakdown.practicalScore, null);
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
      'card-openrouter-x-ai-grok-4-6',
      'card-openrouter-standard-performance-x-ai-grok-4-6',
      'card-aa-grok-4-6',
      'card-arena-grok-4-6-high',
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
    modelName: 'DeepSeek V4 Pro 0813',
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

const deepSeek0813Box = august2026ReleaseBoxes.get('deepseek_v4_pro_0813');
assert.ok(deepSeek0813Box);
const deepSeekPreviewBox = installedPresetBoxes.find((candidate) => (
  candidate.builtInPresetId === 'builtin.harness.deepseek-v4-pro.high.claude-code'
));
assert.ok(deepSeekPreviewBox, 'The independent DeepSeek-v4-Pro Preview configuration must remain installed.');
const deepSeek0813Stack = reconciledV3Store.getLinkedCardStack(deepSeek0813Box.id);
const deepSeekPreviewStack = reconciledV3Store.getLinkedCardStack(deepSeekPreviewBox.id);
const deepSeek0813ArenaHighCard = baseCards.find(
  ({ id }) => id === 'card-arena-deepseek-v4-pro-high-20260813',
);
assert.ok(
  deepSeek0813ArenaHighCard,
  'The refreshed Arena source must preserve the exact DeepSeek V4 Pro 0813 High row.',
);
assert.equal(
  (deepSeek0813ArenaHighCard.metadataJson?.scope as Record<string, unknown> | undefined)
    ?.productLineId,
  'deepseek_v4_pro_0813',
);
assert.deepEqual(
  deepSeek0813Stack.find(({ card }) => card.id === deepSeek0813ArenaHighCard.id)
    ?.link.provenance,
  {
    kind: 'lower_profile_fallback',
    sourceProfile: 'High',
    sourceLevel: 3,
    targetProfile: 'Max',
    targetLevel: 5,
  },
  'The High Arena row may fill Max only through the authored High-to-Max fallback.',
);
assert.ok(
  deepSeekPreviewStack.every(({ card }) => (
    (card.metadataJson?.scope as Record<string, unknown> | undefined)?.productLineId
    === 'deepseek_v4_pro'
  )),
  'The Preview configuration must use only the original DeepSeek V4 Pro product line.',
);
const deepSeek0813CardIds = new Set(deepSeek0813Stack.map(({ card }) => card.id));
assert.ok(
  deepSeekPreviewStack.every(({ card }) => !deepSeek0813CardIds.has(card.id)),
  'DeepSeek V4 Pro 0813 and Preview must share no source card.',
);

function assertSubscriptionRoutesPreserveCapability(
  apiPresetId: string,
  subscriptionPresetIds: readonly string[],
) {
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

const gemini37HarnessPriceMatrices = [
  {
    harness: 'Antigravity SDK',
    apiPresetId: 'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
    subscriptionPresetIds: [
      'builtin.subscription.google-ai-pro.gemini-3-7-flash.high.antigravity-sdk',
      'builtin.subscription.google-ai-ultra-20x.gemini-3-7-flash.high.antigravity-sdk',
    ],
  },
  {
    harness: 'OpenCode',
    apiPresetId: 'builtin.harness.gemini-3-7-flash.high.opencode',
    subscriptionPresetIds: [
      'builtin.subscription.google-ai-pro.gemini-3-7-flash.high.opencode',
      'builtin.subscription.google-ai-ultra-20x.gemini-3-7-flash.high.opencode',
    ],
  },
] as const;
const gemini37CodingAgentIndexByHarness = new Map<string, number>();
for (const matrix of gemini37HarnessPriceMatrices) {
  const subscriptionBoxes = matrix.subscriptionPresetIds.map((presetId) => {
    const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
    assert.ok(box, `Missing independent subscription route ${presetId}.`);
    assert.equal(box.identity?.harness.name, matrix.harness);
    return box;
  });
  const subscriptionConfigs = subscriptionBoxes.map((box) => (
    reconciledV3Store.buildLLMConfiguration(box)
  ));
  assert.deepEqual(
    subscriptionConfigs[1].observations,
    subscriptionConfigs[0].observations,
    `Google Pro and Ultra must preserve the same ${matrix.harness} capability data.`,
  );
  for (const config of subscriptionConfigs) {
    for (const metricId of [
      'aa_coding_agent_index',
      'aa_coding_agent_deepswe',
      'aa_coding_agent_swe_atlas_qna',
      'aa_coding_agent_terminalbench_v2',
    ]) {
      assert.ok(
        config.observations[metricId],
        `Gemini ${matrix.harness} subscription must retain ${metricId}.`,
      );
    }
    assert.equal(
      Object.keys(config.observations).some((metricId) => metricId.startsWith('arena_agent_')),
      false,
      `Gemini ${matrix.harness} subscriptions must not borrow a different Agent harness.`,
    );
  }
  gemini37CodingAgentIndexByHarness.set(
    matrix.harness,
    subscriptionConfigs[0].observations.aa_coding_agent_index.rawValue,
  );
  const subscriptionScores = subscriptionBoxes.map((box) => (
    scoreByConfigurationId.get(box.id)
  ));
  assert.equal(
    subscriptionScores[1]?.rawCapabilityScore,
    subscriptionScores[0]?.rawCapabilityScore,
  );
  assert.notEqual(
    subscriptionScores[1]?.practicalBreakdown.practicalScore,
    subscriptionScores[0]?.practicalBreakdown.practicalScore,
    `Google Pro and Ultra must retain independent ${matrix.harness} subscription economics.`,
  );
  assertSubscriptionRoutesPreserveCapability(
    matrix.apiPresetId,
    matrix.subscriptionPresetIds,
  );
}
assert.notEqual(
  gemini37CodingAgentIndexByHarness.get('Antigravity SDK'),
  gemini37CodingAgentIndexByHarness.get('OpenCode'),
  'Antigravity SDK and OpenCode price matrices must retain their independent AA Agent results.',
);

const museSpark12HarnessPriceMatrices = [
  {
    harness: 'OpenCode',
    standardPresetId: 'builtin.harness.muse-spark-1-2.xhigh.opencode',
    contributorPresetId:
      'builtin.api-tier.meta-contributor.muse-spark-1-2.xhigh.opencode',
  },
  {
    harness: 'Muse Code',
    standardPresetId: 'builtin.harness.muse-spark-1-2.xhigh.muse-code',
    contributorPresetId:
      'builtin.api-tier.meta-contributor.muse-spark-1-2.xhigh.muse-code',
  },
] as const;
const museSpark12CodingAgentIndexByHarness = new Map<string, number>();
for (const matrix of museSpark12HarnessPriceMatrices) {
  const standardBox = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === matrix.standardPresetId
  ));
  const contributorBox = installedPresetBoxes.find((candidate) => (
    candidate.builtInPresetId === matrix.contributorPresetId
  ));
  assert.ok(standardBox, `Missing Muse Spark 1.2 ${matrix.harness} Standard API route.`);
  assert.ok(contributorBox, `Missing Muse Spark 1.2 ${matrix.harness} Contributor API route.`);
  assert.equal(standardBox.identity?.harness.name, matrix.harness);
  assert.equal(contributorBox.identity?.harness.name, matrix.harness);
  assert.equal(
    contributorBox.displayName,
    `Muse Spark 1.2 XHigh | ${matrix.harness} | Meta API Contributor`,
  );

  const standardStack = reconciledV3Store.getLinkedCardStack(standardBox.id);
  const contributorStack = reconciledV3Store.getLinkedCardStack(contributorBox.id);
  assert.deepEqual(
    contributorStack.map(({ card }) => card.id),
    standardStack.map(({ card }) => card.id),
    `Contributor must retain the exact ${matrix.harness} capability and speed stack.`,
  );

  const standardConfig = reconciledV3Store.buildLLMConfiguration(standardBox);
  const contributorConfig = reconciledV3Store.buildLLMConfiguration(contributorBox);
  assert.deepEqual(
    contributorConfig.observations,
    standardConfig.observations,
    `Contributor must not replace ${matrix.harness} AA Harness measurements.`,
  );
  assert.equal(standardConfig.openRouterData?.inputPricePerMToken, 1.25);
  assert.equal(standardConfig.openRouterData?.outputPricePerMToken, 4.25);
  assert.equal(contributorConfig.openRouterData?.inputPricePerMToken, 0.1);
  assert.equal(contributorConfig.openRouterData?.outputPricePerMToken, 0.2);
  assert.equal(contributorConfig.openRouterData?.cacheReadPricePerMToken, 0.002);
  assert.equal(
    contributorConfig.openRouterData?.ttftP50Seconds,
    standardConfig.openRouterData?.ttftP50Seconds,
    `Contributor ${matrix.harness} must use the same-model measured TTFT.`,
  );
  assert.equal(
    contributorConfig.openRouterData?.throughputP50TokensPerSec,
    standardConfig.openRouterData?.throughputP50TokensPerSec,
    `Contributor ${matrix.harness} must use the same-model measured throughput.`,
  );
  assert.equal(contributorConfig.capabilityReferenceIncluded, false);

  const contributorPreset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => (
    candidate.id === matrix.contributorPresetId
  ));
  assert.ok(contributorPreset?.apiPricingData);
  assert.equal(contributorPreset.apiPricingData.tierName, 'Contributor');
  assert.equal(contributorPreset.apiPricingData.effectiveDate, '2026-08-05');
  assert.equal(
    contributorPreset.apiPricingData.officialSourceUrl,
    'https://developer.meta.com/ai/resources/blog/build-with-muse-code/',
  );

  const standardScore = scoreByConfigurationId.get(standardBox.id);
  const contributorScore = scoreByConfigurationId.get(contributorBox.id);
  assert.ok(standardScore);
  assert.ok(contributorScore);
  assert.deepEqual(contributorScore.domainScores, standardScore.domainScores);
  assert.equal(contributorScore.rawCapabilityScore, standardScore.rawCapabilityScore);
  assert.notEqual(
    contributorScore.practicalBreakdown.practicalScore,
    standardScore.practicalBreakdown.practicalScore,
    `Standard and Contributor must independently price ${matrix.harness}.`,
  );
  museSpark12CodingAgentIndexByHarness.set(
    matrix.harness,
    contributorConfig.observations.aa_coding_agent_index.rawValue,
  );
}
assert.equal(
  BUILT_IN_CONFIGURATION_PRESETS.filter((preset) => (
    preset.productLineId === 'muse_spark_12' && preset.access === 'api'
  )).length,
  4,
  'Muse Spark 1.2 must ship two Harnesses multiplied by two API price tiers.',
);
assert.notEqual(
  museSpark12CodingAgentIndexByHarness.get('OpenCode'),
  museSpark12CodingAgentIndexByHarness.get('Muse Code'),
  'Muse Spark 1.2 price matrices must retain the two independent AA Harness results.',
);

assertSubscriptionRoutesPreserveCapability(
  'builtin.grok-4-6.xhigh',
  ['builtin.subscription.supergrok.grok-4-6.xhigh.chat'],
);
assertSubscriptionRoutesPreserveCapability(
  'builtin.harness.gpt-5-5.xhigh.codex-cli',
  ['builtin.subscription.chatgpt-plus.gpt-5-5.xhigh.codex-cli'],
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
const fableClaudeCodeBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.harness.claude-fable-5.max.claude-code'
));
assert.ok(fableClaudeCodeBox);
const fableClaudeCodeConfig = reconciledV3Store.buildLLMConfiguration(fableClaudeCodeBox);
for (const metricId of [
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]) {
  assert.ok(
    fableClaudeCodeConfig.observations[metricId],
    `Fable 5 Claude Code must inherit ${metricId} from the lower generic Agent execution.`,
  );
  assert.ok(
    (fableClaudeCodeConfig.observations[metricId].confidenceRadius || 0) > 0,
    `Fable 5 Claude Code must pass ${metricId}'s published CI radius into scoring.`,
  );
}
const fableClaudeCodeScore = scoreByConfigurationId.get(fableClaudeCodeBox.id);
assert.equal(fableClaudeCodeScore?.domainScores.agentic_work.coverage, 1);
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
  Math.abs((kimiCodeScore?.domainScores.agentic_work.coverage || 0) - 1) < 1e-9,
  'Kimi K3 must combine the exact AA τ³ record with the lower Arena Agent behavior bundle.',
);
assert.equal(kimiCodeScore?.domainScores.math_science.score !== null, true);
assert.equal(kimiCodeScore?.domainScores.search_knowledge.score !== null, true);
for (const presetId of [
  'builtin.agent.arena.claude-sonnet-5.max',
  'builtin.agent.arena.deepseek-v4-flash.max',
  'builtin.agent.arena.qwen-3-7-max.max',
]) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  assert.ok(box, `Gap-repaired preset ${presetId} must be installed.`);
  const score = scoreByConfigurationId.get(box.id);
  assert.equal(
    score?.availableDomainCount,
    6,
    `Gap-repaired preset ${presetId} must expose all six domains.`,
  );
}
const sonnet5MaxAgentBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.agent.arena.claude-sonnet-5.max'
));
assert.ok(sonnet5MaxAgentBox);
assert.deepEqual(
  reconciledV3Store.getLinkedCardStack(sonnet5MaxAgentBox.id)
    .find(({ card }) => card.id === 'card-arena-agent-mode-claude-sonnet-5-high')
    ?.link.provenance,
  {
    kind: 'lower_profile_fallback',
    sourceProfile: 'High',
    sourceLevel: 4,
    targetProfile: 'Max',
    targetLevel: 5,
  },
  'Sonnet 5 High Agent evidence must move only upward into Max Agent.',
);
const qwen37MaxAgentBox = installedPresetBoxes.find((box) => (
  box.builtInPresetId === 'builtin.agent.arena.qwen-3-7-max.max'
));
assert.ok(qwen37MaxAgentBox);
assert.equal(
  reconciledV3Store.getLinkedCardStack(qwen37MaxAgentBox.id)
    .find(({ card }) => card.id === 'card-reviewed-family-qwen37max-arena-preview')
    ?.link.provenance?.kind,
  'lower_profile_harness_fallback',
  'Qwen3.7-Max Preview text evidence must remain an explicit lower-profile Chat→Agent fallback.',
);
for (const [presetId, expectedAuthorProvider] of [
  ['builtin.harness.claude-opus-4-8.max.claude-code', 'Anthropic'],
  ['builtin.agent.arena.claude-sonnet-5.max', 'Anthropic'],
  ['builtin.agent.arena.hy3.high', 'Tencent'],
  ['builtin.data-md.mistral-medium-3-5.max', 'Mistral'],
] as const) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
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
  'builtin.agent.arena.grok-build-0-1.max',
  'builtin.source-catalog.source-profile-inkling-xhigh.inkling-xhigh',
] as const) {
  const box = installedPresetBoxes.find((candidate) => candidate.builtInPresetId === presetId);
  assert.ok(box, `Practical-source repair preset ${presetId} must be installed.`);
  const configuration = reconciledV3Store.buildLLMConfiguration(box);
  assert.ok(configuration.openRouterData, `${presetId} must have complete practical data.`);
  assertOpenRouterDataIsBackedByLinkedCards(box, configuration.openRouterData);
}

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
  BUILT_IN_CONFIGURATION_PRESETS.length + 1,
);
assert.equal(compactSyncReport.removedRetiredLegacyBoxCount, 1);
assert.equal(compactSyncReport.installedBoxCount, BUILT_IN_CONFIGURATION_PRESETS.length);
assert.ok(reconciledV3Store.boxes.some((box) => box.id === preservedUserBox.id));
assert.ok(!reconciledV3Store.boxes.some((box) => box.id === obsoleteBuiltInBox.id));
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
