import {
  ConfigurationBox,
  SourceModelCard,
  SourceObservation,
  ConfigurationSourceLink,
  ConfigurationBackup,
  ConfigurationBackupBox,
  ConfigurationBackupCardReference,
  ConfigurationBackupCardScope,
  ConfigurationBackupImportReport,
  BuiltInConfigurationPresetInstallReport,
  ConfigurationBackupLink,
  ConfigurationIdentity,
  ConfigurationSourceLinkProvenance,
  LowerHarnessFallbackProvenance,
  LowerProfileHarnessFallbackProvenance,
  LowerProfileFallbackProvenance,
  ConfigurationModelIdentity,
  ConfigurationHarnessIdentity,
  ConfigurationProviderIdentity,
  LinkedCardStackEntry,
  SourceType,
} from '../types/admin_mapping';
import {
  LLMConfiguration,
  ProcessedConfigurationScore,
  MetricObservation,
  SubscriptionCostData,
} from '../types/llm_pk';
import {
  ALL_METRIC_DEFINITIONS,
  processLLMpkBatchScoring,
} from '../engine/scoringEngine';
import { VERIFIED_SOURCE_MODEL_CARDS, VERIFIED_SOURCE_OBSERVATIONS } from '../data/seedCards';
import {
  VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
  VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
} from '../data/harnessSeedCards';
import {
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
} from '../data/productionAgentModeSeedCards';
import {
  VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
  VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
} from '../data/reviewedFamilySeedCards';
import {
  VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
} from '../data/recoveredSourceSeedCards';
import {
  isCapabilityMetricCompatibleWithSourceLink,
  isHarnessOnlyCapabilityMetric,
  isPlainChatHarness,
  isValidExecutionHarnessFallback,
} from '../data/executionMetricPolicy';
import {
  OAGXM_SCOPE,
  SOURCE_CATALOG_SCOPE_ID,
  SOURCE_CATALOG_SCOPE_VERSION,
} from '../data/oagxmScope';
import {
  BUILT_IN_CONFIGURATION_PRESETS,
  BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION,
  type BuiltInConfigurationPreset,
} from '../data/builtInConfigurationPresets';
import { getEmbeddedConfidenceRadius } from '../data/metricUncertainty';
import { getOpenRouterPromotionalPricing } from '../data/openRouterPromotionalPricing';

/**
 * A schema bump is intentionally paired with a source-catalog fingerprint.
 * Either change replaces stored cards and observations with the current
 * verified catalog instead of carrying forward data of unknown provenance.
 */
export const ADMIN_MAPPING_STORE_SCHEMA_VERSION = 17;

/** Portable configuration backup envelope. Its version is independent from
 * browser-store migrations, because a backup carries no stored catalog data. */
export const CONFIGURATION_BACKUP_FORMAT = 'llmpk.configuration-backup' as const;
export const CONFIGURATION_BACKUP_SCHEMA_VERSION = 1 as const;

const STORAGE_KEY_SCHEMA = 'llmpk_admin_store_schema_version';
const STORAGE_KEY_CATALOG_FINGERPRINT = 'llmpk_admin_catalog_fingerprint_v17';
const STORAGE_KEY_CLEANUP_REPORT = 'llmpk_admin_cleanup_report_v17';
const STORAGE_KEY_BOXES = 'llmpk_admin_boxes_v17';
const STORAGE_KEY_CARDS = 'llmpk_admin_cards_v17';
const STORAGE_KEY_LINKS = 'llmpk_admin_links_v17';
const STORAGE_KEY_OBS = 'llmpk_admin_obs_v17';
const STORAGE_KEY_BUILT_IN_INVENTORY_VERSION = 'llmpk_builtin_inventory_version_v17';

/**
 * v16 had a single card per source slot. Keep these explicit rather than
 * relying on a broad key scan: migrating a user's existing mappings must be
 * additive and must never start by deleting the only copy of them.
 */
const LEGACY_V16_STORAGE_KEYS = {
  catalogFingerprint: 'llmpk_admin_catalog_fingerprint_v16',
  cleanupReport: 'llmpk_admin_cleanup_report_v16',
  boxes: 'llmpk_admin_boxes_v16',
  cards: 'llmpk_admin_cards_v16',
  links: 'llmpk_admin_links_v16',
  observations: 'llmpk_admin_obs_v16',
} as const;

type SourceCardWithProvenance = SourceModelCard & {
  entrySlug?: unknown;
  profileUrl?: unknown;
};

type SourceObservationWithProvenance = SourceObservation & {
  sourceLeaderboard?: unknown;
};

interface SanitizedSourceData {
  cards: SourceModelCard[];
  observations: SourceObservation[];
  invalidCardsRemoved: number;
  unverifiableObservationsRemoved: number;
  knownPlaceholderObservationsRemoved: number;
  duplicateObservationsRemoved: number;
}

interface ScopeProvenance {
  scopeId?: unknown;
  scopeVersion?: unknown;
  vendorId?: unknown;
  productLineId?: unknown;
  rankingClass?: unknown;
}

export interface DataCleanupReport {
  schemaVersion: number;
  catalogFingerprint: string;
  migrationApplied: boolean;
  catalogRebuilt: boolean;
  legacyCardsRemoved: number;
  legacyLinksRemoved: number;
  legacyObservationRecordsRemoved: number;
  staleObservationRecordsReplaced: number;
  invalidCardsRemoved: number;
  unverifiableObservationsRemoved: number;
  knownPlaceholderObservationsRemoved: number;
  duplicateObservationsRemoved: number;
  activeCards: number;
  activeObservations: number;
  completedAt: string;
}

function emptyCleanupReport(catalogFingerprint = ''): DataCleanupReport {
  return {
    schemaVersion: ADMIN_MAPPING_STORE_SCHEMA_VERSION,
    catalogFingerprint,
    migrationApplied: false,
    catalogRebuilt: false,
    legacyCardsRemoved: 0,
    legacyLinksRemoved: 0,
    legacyObservationRecordsRemoved: 0,
    staleObservationRecordsReplaced: 0,
    invalidCardsRemoved: 0,
    unverifiableObservationsRemoved: 0,
    knownPlaceholderObservationsRemoved: 0,
    duplicateObservationsRemoved: 0,
    activeCards: 0,
    activeObservations: 0,
    completedAt: new Date().toISOString(),
  };
}

function parseArray<T>(value: unknown): T[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function isKnownSource(source: unknown): source is SourceType {
  return source === 'artificial_analysis' || source === 'arena' || source === 'openrouter';
}

/**
 * Configuration identity is descriptive metadata only. It is deliberately
 * separate from source-card matching, so changing a label such as `OpenCode`
 * can never manufacture or rebind an observation.
 */
function parseConfigurationIdentity(value: unknown): ConfigurationIdentity | null {
  if (!isPlainRecord(value)) return null;

  const parsePart = (part: unknown, fields: readonly string[]): Record<string, string> | null => {
    if (part === undefined) return {};
    if (!isPlainRecord(part)) return null;

    const parsed: Record<string, string> = {};
    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(part, field)) continue;
      const raw = part[field];
      // Optional identity fields may be emitted by a typed inventory as an
      // explicit `undefined` property (for example a model with no named
      // preset). Treat that exactly like an omitted optional field while
      // retaining the strict string-only guard for supplied values.
      if (raw === undefined) continue;
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (trimmed) parsed[field] = trimmed;
    }
    return parsed;
  };

  const model = parsePart(value.model, ['name', 'profile', 'preset']);
  const harness = parsePart(value.harness, ['name', 'environment']);
  const provider = parsePart(value.provider, ['name', 'upstream']);
  if (!model || !harness || !provider) return null;

  const identity: ConfigurationIdentity = {};
  if (Object.keys(model).length > 0) identity.model = model as ConfigurationModelIdentity;
  if (Object.keys(harness).length > 0) identity.harness = harness as ConfigurationHarnessIdentity;
  if (Object.keys(provider).length > 0) identity.provider = provider as ConfigurationProviderIdentity;
  return identity;
}

/** Store payloads may be from a pre-identity version. Preserve those boxes
 * and remove only malformed optional identity metadata. */
function sanitizeConfigurationIdentity(value: unknown): ConfigurationIdentity | undefined {
  const parsed = parseConfigurationIdentity(value);
  return parsed && Object.keys(parsed).length > 0 ? parsed : undefined;
}

function sanitizeBuiltInPresetId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Legacy links that predate this field are exact matches.  A fallback cannot
 * be inferred from profile strings: it must carry two explicit numeric
 * levels whose direction is checked here.
 */
function parseSourceLinkProvenance(value: unknown): ConfigurationSourceLinkProvenance | null {
  if (value === undefined) return { kind: 'exact' };
  if (!isPlainRecord(value) || typeof value.kind !== 'string') return null;
  if (value.kind === 'exact') return { kind: 'exact' };
  if (value.kind === 'lower_profile_fallback') {
    if (
      typeof value.sourceProfile !== 'string'
      || value.sourceProfile.trim().length === 0
      || typeof value.targetProfile !== 'string'
      || value.targetProfile.trim().length === 0
      || typeof value.sourceLevel !== 'number'
      || !Number.isInteger(value.sourceLevel)
      || value.sourceLevel < 0
      || typeof value.targetLevel !== 'number'
      || !Number.isInteger(value.targetLevel)
      || value.targetLevel < 0
      || value.sourceLevel >= value.targetLevel
    ) return null;

    return {
      kind: 'lower_profile_fallback',
      sourceProfile: value.sourceProfile.trim(),
      sourceLevel: value.sourceLevel,
      targetProfile: value.targetProfile.trim(),
      targetLevel: value.targetLevel,
    };
  }

  if (value.kind === 'lower_harness_fallback') {
    if (
      typeof value.sourceHarness !== 'string'
      || value.sourceHarness.trim().length === 0
      || typeof value.targetHarness !== 'string'
      || value.targetHarness.trim().length === 0
      || typeof value.sourceProfile !== 'string'
      || value.sourceProfile.trim().length === 0
      || typeof value.targetProfile !== 'string'
      || value.targetProfile.trim().length === 0
      || typeof value.sourceLevel !== 'number'
      || !Number.isInteger(value.sourceLevel)
      || value.sourceLevel < 0
      || typeof value.targetLevel !== 'number'
      || !Number.isInteger(value.targetLevel)
      || value.targetLevel < 0
      || value.sourceLevel >= value.targetLevel
    ) return null;

    return {
      kind: 'lower_harness_fallback',
      sourceHarness: value.sourceHarness.trim(),
      sourceLevel: value.sourceLevel,
      targetHarness: value.targetHarness.trim(),
      targetLevel: value.targetLevel,
      sourceProfile: value.sourceProfile.trim(),
      targetProfile: value.targetProfile.trim(),
    };
  }

  if (value.kind === 'lower_profile_harness_fallback') {
    if (
      typeof value.sourceProfile !== 'string'
      || value.sourceProfile.trim().length === 0
      || typeof value.targetProfile !== 'string'
      || value.targetProfile.trim().length === 0
      || typeof value.sourceHarness !== 'string'
      || value.sourceHarness.trim().length === 0
      || typeof value.targetHarness !== 'string'
      || value.targetHarness.trim().length === 0
      || typeof value.sourceProfileLevel !== 'number'
      || !Number.isInteger(value.sourceProfileLevel)
      || value.sourceProfileLevel < 0
      || typeof value.targetProfileLevel !== 'number'
      || !Number.isInteger(value.targetProfileLevel)
      || value.targetProfileLevel < 0
      || value.sourceProfileLevel >= value.targetProfileLevel
      || typeof value.sourceHarnessLevel !== 'number'
      || !Number.isInteger(value.sourceHarnessLevel)
      || value.sourceHarnessLevel < 0
      || typeof value.targetHarnessLevel !== 'number'
      || !Number.isInteger(value.targetHarnessLevel)
      || value.targetHarnessLevel < 0
      || value.sourceHarnessLevel >= value.targetHarnessLevel
    ) return null;

    return {
      kind: 'lower_profile_harness_fallback',
      sourceProfile: value.sourceProfile.trim(),
      sourceProfileLevel: value.sourceProfileLevel,
      targetProfile: value.targetProfile.trim(),
      targetProfileLevel: value.targetProfileLevel,
      sourceHarness: value.sourceHarness.trim(),
      sourceHarnessLevel: value.sourceHarnessLevel,
      targetHarness: value.targetHarness.trim(),
      targetHarnessLevel: value.targetHarnessLevel,
    };
  }

  return null;
}

function sameSourceLinkProvenance(
  left: ConfigurationSourceLinkProvenance,
  right: ConfigurationSourceLinkProvenance,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'exact' || right.kind === 'exact') return true;
  if (left.kind === 'lower_profile_fallback' && right.kind === 'lower_profile_fallback') {
    return left.sourceProfile === right.sourceProfile
      && left.sourceLevel === right.sourceLevel
      && left.targetProfile === right.targetProfile
      && left.targetLevel === right.targetLevel;
  }
  if (left.kind === 'lower_harness_fallback' && right.kind === 'lower_harness_fallback') {
    return left.sourceHarness === right.sourceHarness
      && left.sourceLevel === right.sourceLevel
      && left.targetHarness === right.targetHarness
      && left.targetLevel === right.targetLevel
      && left.sourceProfile === right.sourceProfile
      && left.targetProfile === right.targetProfile;
  }
  if (
    left.kind === 'lower_profile_harness_fallback'
    && right.kind === 'lower_profile_harness_fallback'
  ) {
    return left.sourceProfile === right.sourceProfile
      && left.sourceProfileLevel === right.sourceProfileLevel
      && left.targetProfile === right.targetProfile
      && left.targetProfileLevel === right.targetProfileLevel
      && left.sourceHarness === right.sourceHarness
      && left.sourceHarnessLevel === right.sourceHarnessLevel
      && left.targetHarness === right.targetHarness
      && left.targetHarnessLevel === right.targetHarnessLevel;
  }
  return false;
}

function sameConfigurationIdentity(
  left: ConfigurationIdentity | undefined,
  right: ConfigurationIdentity | undefined,
): boolean {
  const fields: Array<[keyof ConfigurationIdentity, string]> = [
    ['model', 'name'],
    ['model', 'profile'],
    ['model', 'preset'],
    ['harness', 'name'],
    ['harness', 'environment'],
    ['provider', 'name'],
    ['provider', 'upstream'],
  ];

  return fields.every(([part, field]) => {
    const leftPart = left?.[part] as Record<string, string | undefined> | undefined;
    const rightPart = right?.[part] as Record<string, string | undefined> | undefined;
    return leftPart?.[field] === rightPart?.[field];
  });
}

interface PresetSourceCardDeclaration {
  cardId: string;
  provenance: ConfigurationSourceLinkProvenance;
}

/**
 * `sourceCardIds` remains a compact backwards-compatible notation for exact
 * cards. Structured declarations are appended beneath them so an exact card
 * always wins over a lower-profile fallback for a duplicate metric.
 */
function presetSourceCardDeclarations(
  preset: BuiltInConfigurationPreset,
): PresetSourceCardDeclaration[] | null {
  if (preset.sourceCardIds !== undefined && !Array.isArray(preset.sourceCardIds)) return null;
  if (preset.sourceCardLinks !== undefined && !Array.isArray(preset.sourceCardLinks)) return null;

  const declarations: PresetSourceCardDeclaration[] = [];
  for (const rawCardId of preset.sourceCardIds || []) {
    if (typeof rawCardId !== 'string' || rawCardId.trim().length === 0) return null;
    declarations.push({ cardId: rawCardId.trim(), provenance: { kind: 'exact' } });
  }

  for (const rawLink of preset.sourceCardLinks || []) {
    if (!isPlainRecord(rawLink) || typeof rawLink.cardId !== 'string' || rawLink.cardId.trim().length === 0) {
      return null;
    }
    const provenance = parseSourceLinkProvenance(rawLink.provenance);
    if (!provenance) return null;
    declarations.push({ cardId: rawLink.cardId.trim(), provenance });
  }

  return declarations;
}

type FallbackProvenance =
  | LowerProfileFallbackProvenance
  | LowerHarnessFallbackProvenance
  | LowerProfileHarnessFallbackProvenance;

function fallbackIsValidForPreset(
  preset: BuiltInConfigurationPreset,
  provenance: FallbackProvenance,
): boolean {
  const identity = sanitizeConfigurationIdentity(preset.identity);
  if (
    (preset.access !== 'api' && preset.access !== 'subscription')
    || !identity?.model?.profile
    || identity.model.profile !== provenance.targetProfile
  ) return false;

  if (provenance.kind === 'lower_profile_fallback') {
    return provenance.sourceLevel < provenance.targetLevel;
  }

  if (provenance.kind === 'lower_harness_fallback') return Boolean(
    identity.harness?.name
    && identity.harness.name === provenance.targetHarness
    && isValidExecutionHarnessFallback(
      provenance.sourceHarness,
      provenance.sourceLevel,
      provenance.targetHarness,
      provenance.targetLevel,
    )
    && provenance.sourceProfile === provenance.targetProfile,
  );

  if (provenance.kind === 'lower_profile_harness_fallback') return Boolean(
    identity.harness?.name
    && identity.harness.name === provenance.targetHarness
    && isValidExecutionHarnessFallback(
      provenance.sourceHarness,
      provenance.sourceHarnessLevel,
      provenance.targetHarness,
      provenance.targetHarnessLevel,
    )
    && provenance.sourceProfileLevel < provenance.targetProfileLevel
  );

  return false;
}

/**
 * A fallback is a shipped, authored policy—not an operator drag/drop option.
 * It remains valid only if the box still has the unchanged API or subscription
 * identity of that exact preset, and if that preset lists this exact
 * source-card ID with the same explicit low-to-high declaration.
 */
function fallbackIsAuthorizedForBox(
  box: ConfigurationBox,
  card: SourceModelCard,
  provenance: FallbackProvenance,
): boolean {
  const presetId = sanitizeBuiltInPresetId(box.builtInPresetId);
  if (!presetId) return false;
  const preset = BUILT_IN_CONFIGURATION_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset || !fallbackIsValidForPreset(preset, provenance)) return false;

  const presetIdentity = sanitizeConfigurationIdentity(preset.identity);
  const boxIdentity = sanitizeConfigurationIdentity(box.identity);
  if (!sameConfigurationIdentity(boxIdentity, presetIdentity)) return false;

  const scope = cardScope(card as SourceCardWithProvenance);
  if (!isValidOagxmScope(scope) || scope.productLineId !== preset.productLineId) return false;
  if (
    (
      provenance.kind === 'lower_harness_fallback'
      || provenance.kind === 'lower_profile_harness_fallback'
    )
    && !isPlainChatHarness(provenance.sourceHarness)
    && card.metadataJson?.sourceIdentity?.executionHarness !== provenance.sourceHarness
  ) return false;

  const declarations = presetSourceCardDeclarations(preset);
  return Boolean(declarations?.some((declaration) => (
    declaration.cardId === card.id
    && declaration.provenance.kind === provenance.kind
    && sameSourceLinkProvenance(declaration.provenance, provenance)
  )));
}

/**
 * A scope-version bump must not make an operator re-enter an otherwise
 * verified mapping. v2 is deliberately compatibility-only: it is accepted
 * while reconciling persisted cards or importing a portable backup, never as
 * a valid current catalog scope. Its vendor/product-line/ranking tuple still
 * has to exist in the current whitelist.
 */
const LEGACY_COMPATIBLE_OAGXM_SCOPE_VERSIONS = new Set([
  'oagxm-current-product-lines/v2',
]);

function mapsToCurrentOagxmProductLine(
  scope: unknown,
  allowLegacyScopeVersion: boolean = false,
): scope is Required<ScopeProvenance> {
  if (!scope || typeof scope !== 'object') return false;
  const value = scope as ScopeProvenance;

  // Source records outside the hand-authored Data.md product manifest are
  // still first-class verified catalog entries.  Their profile-level scope is
  // generated by the ingestion pipeline and deliberately kept separate from
  // the curated family namespace.
  if (value.scopeId === SOURCE_CATALOG_SCOPE_ID) {
    return value.scopeVersion === SOURCE_CATALOG_SCOPE_VERSION
      && typeof value.vendorId === 'string'
      && value.vendorId.trim().length > 0
      && typeof value.productLineId === 'string'
      && value.productLineId.startsWith('source-profile-')
      && (value.rankingClass === 'formal_text_agent' || value.rankingClass === 'specialized_catalog_only');
  }

  const hasAcceptedScopeVersion = value.scopeVersion === OAGXM_SCOPE.schemaVersion
    || (
      allowLegacyScopeVersion
      && typeof value.scopeVersion === 'string'
      && LEGACY_COMPATIBLE_OAGXM_SCOPE_VERSIONS.has(value.scopeVersion)
    );
  if (
    value.scopeId !== OAGXM_SCOPE.scopeId
    || !hasAcceptedScopeVersion
    || typeof value.vendorId !== 'string'
    || typeof value.productLineId !== 'string'
    || (value.rankingClass !== 'formal_text_agent' && value.rankingClass !== 'specialized_catalog_only')
  ) return false;

  return OAGXM_SCOPE.vendors.some((vendor) => (
    vendor.id === value.vendorId
    && vendor.productLines.some((line) => (
      line.id === value.productLineId
      && line.rankingClass === value.rankingClass
    ))
  ));
}

/** Strict validation used by all current catalog and live UI paths. */
function isValidOagxmScope(scope: unknown): scope is Required<ScopeProvenance> {
  return mapsToCurrentOagxmProductLine(scope);
}

function cardScope(card: SourceCardWithProvenance): unknown {
  return card.metadataJson?.scope;
}

function scopesDescribeSameProduct(
  left: unknown,
  right: unknown,
  allowLegacyScopeVersion: boolean = false,
): boolean {
  return mapsToCurrentOagxmProductLine(left, allowLegacyScopeVersion)
    && mapsToCurrentOagxmProductLine(right, allowLegacyScopeVersion)
    && left.scopeId === right.scopeId
    && left.vendorId === right.vendorId
    && left.productLineId === right.productLineId
    && left.rankingClass === right.rankingClass;
}

function belongsToExpectedHost(source: SourceType, value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) return false;

  try {
    const host = new URL(value).hostname.toLowerCase();
    if (source === 'artificial_analysis') {
      return host === 'artificialanalysis.ai' || host.endsWith('.artificialanalysis.ai');
    }
    if (source === 'arena') {
      return host === 'arena.ai' || host.endsWith('.arena.ai') || host === 'lmarena.ai' || host.endsWith('.lmarena.ai');
    }
    return host === 'openrouter.ai' || host.endsWith('.openrouter.ai');
  } catch {
    return false;
  }
}

function cardSourceProofValues(card: SourceCardWithProvenance): unknown[] {
  return [
    card.profileUrl,
    card.metadataJson?.profileUrl,
    card.metadataJson?.sourceUrl,
    card.metadataJson?.sourceLeaderboard,
  ];
}

function hasVerifiedCardProof(
  card: SourceCardWithProvenance,
  allowLegacyScopeVersion: boolean = false,
): boolean {
  return isKnownSource(card.source)
    && mapsToCurrentOagxmProductLine(cardScope(card), allowLegacyScopeVersion)
    && cardSourceProofValues(card).some((value) => belongsToExpectedHost(card.source, value));
}

function isTrustedCard(
  card: SourceModelCard | null | undefined,
  allowLegacyScopeVersion: boolean = false,
): card is SourceCardWithProvenance {
  if (!card || !isKnownSource(card.source)) return false;
  if (typeof card.id !== 'string' || card.id.trim().length === 0) return false;
  if (typeof card.exactSourceModelName !== 'string' || card.exactSourceModelName.trim().length === 0) return false;
  if (typeof card.latestSnapshotDate !== 'string' || card.latestSnapshotDate.trim().length === 0) return false;
  return hasVerifiedCardProof(card as SourceCardWithProvenance, allowLegacyScopeVersion);
}

function sourceMetricIsAllowed(source: SourceType, metricId: unknown): boolean {
  if (typeof metricId !== 'string') return false;
  if (source === 'artificial_analysis') return metricId.startsWith('aa_');
  if (source === 'arena') return metricId.startsWith('arena_');
  return metricId.startsWith('or_');
}

function hasVerifiedObservationProof(
  observation: SourceObservation,
  card: SourceCardWithProvenance,
): boolean {
  const sourceObservation = observation as SourceObservationWithProvenance;
  const directEvidence = [
    observation.sourceUrl,
    sourceObservation.sourceLeaderboard,
    observation.metadataJson?.sourceUrl,
    observation.metadataJson?.sourceLeaderboard,
  ];

  if (directEvidence.some((value) => belongsToExpectedHost(card.source, value))) return true;

  // A source field plus a source-record identifier is enough only when the
  // parent card itself is already tied to the official source. This supports
  // compact source snapshots while rejecting unproven local inserts.
  return Boolean(
    observation.metadataJson?.sourceField &&
    observation.metadataJson?.sourceRecordId &&
    hasVerifiedCardProof(card),
  );
}

function isKnownOpenRouterPlaceholder(observation: SourceObservation, card: SourceCardWithProvenance): boolean {
  if (card.source !== 'openrouter') return false;

  // Rebuilt catalogs attach the source field/raw payload to the observation.
  // The legacy v13 catalog did not, and used these exact sentinel values when
  // the OpenRouter response lacked latency or throughput.
  if (observation.metadataJson?.sourceField || observation.metadataJson?.rawPayload) return false;

  const normalizedUnit = String(observation.unit || '').toLowerCase();
  return (
    (observation.metricId === 'or_ttft_p50' && observation.rawValue === 450 && normalizedUnit === 'ms') ||
    (observation.metricId === 'or_throughput_p50' && observation.rawValue === 45 && normalizedUnit === 'tok/s')
  );
}

function isVerifiedObservation(
  observation: SourceObservation | null | undefined,
  card: SourceModelCard | null | undefined,
): observation is SourceObservation {
  if (!observation || !isTrustedCard(card)) return false;
  if (typeof observation.id !== 'string' || observation.id.trim().length === 0) return false;
  if (typeof observation.sourceModelCardId !== 'string' || observation.sourceModelCardId !== card.id) return false;
  if (!sourceMetricIsAllowed(card.source, observation.metricId)) return false;
  if (typeof observation.rawValue !== 'number' || !Number.isFinite(observation.rawValue)) return false;
  if (typeof observation.unit !== 'string' || observation.unit.trim().length === 0) return false;
  if (typeof observation.snapshotDate !== 'string' || observation.snapshotDate.trim().length === 0) return false;
  const parentScope = cardScope(card);
  const observationScope = observation.metadataJson?.scope;
  if (
    !isValidOagxmScope(parentScope)
    || !isValidOagxmScope(observationScope)
    || parentScope.vendorId !== observationScope.vendorId
    || parentScope.productLineId !== observationScope.productLineId
    || parentScope.rankingClass !== observationScope.rankingClass
  ) return false;
  if (!hasVerifiedObservationProof(observation, card)) return false;
  return !isKnownOpenRouterPlaceholder(observation, card);
}

function sanitizeSourceData(rawCards: SourceModelCard[], rawObservations: SourceObservation[]): SanitizedSourceData {
  const cardIds = new Set<string>();
  let invalidCardsRemoved = 0;
  const cards = rawCards.filter((card) => {
    if (!isTrustedCard(card) || cardIds.has(card.id)) {
      invalidCardsRemoved += 1;
      return false;
    }
    cardIds.add(card.id);
    return true;
  });

  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const observationKeys = new Set<string>();
  let unverifiableObservationsRemoved = 0;
  let knownPlaceholderObservationsRemoved = 0;
  let duplicateObservationsRemoved = 0;

  const observations: SourceObservation[] = [];
  rawObservations.forEach((observation) => {
    const card = cardsById.get(observation?.sourceModelCardId);
    if (card && isKnownOpenRouterPlaceholder(observation, card as SourceCardWithProvenance)) {
      knownPlaceholderObservationsRemoved += 1;
      return;
    }
    if (!isVerifiedObservation(observation, card)) {
      unverifiableObservationsRemoved += 1;
      return;
    }

    const observationKey = `${observation.sourceModelCardId}:${observation.metricId}`;
    if (observationKeys.has(observationKey)) {
      duplicateObservationsRemoved += 1;
      return;
    }

    observationKeys.add(observationKey);
    observations.push(observation);
  });

  return {
    cards,
    observations,
    invalidCardsRemoved,
    unverifiableObservationsRemoved,
    knownPlaceholderObservationsRemoved,
    duplicateObservationsRemoved,
  };
}

function buildCatalogFingerprint(cards: SourceModelCard[], observations: SourceObservation[]): string {
  const canonical = [
    ...cards
      .map((card) => {
        const sourceCard = card as SourceCardWithProvenance;
        const scope = sourceCard.metadataJson?.scope as ScopeProvenance | undefined;
        return `${card.id}|${card.source}|${card.exactSourceModelName}|${card.latestSnapshotDate}|${sourceCard.profileUrl || sourceCard.metadataJson?.profileUrl || ''}|${scope?.scopeVersion || ''}|${scope?.vendorId || ''}|${scope?.productLineId || ''}|${scope?.rankingClass || ''}`;
      })
      .sort(),
    ...observations
      .map((observation) => `${observation.id}|${observation.sourceModelCardId}|${observation.metricId}|${observation.rawValue}|${observation.sourceUrl || ''}|${observation.metadataJson?.sourceField || observation.metadataJson?.sourceLeaderboard || ''}|${observation.metadataJson?.scope?.productLineId || ''}`)
      .sort(),
  ].join('\n');

  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v${ADMIN_MAPPING_STORE_SCHEMA_VERSION}-${cards.length}-${observations.length}-${(hash >>> 0).toString(16)}`;
}

function sanitizeBoxes(rawBoxes: ConfigurationBox[]): ConfigurationBox[] {
  const ids = new Set<string>();
  return rawBoxes.flatMap((box) => {
    if (!box || typeof box.id !== 'string' || box.id.trim().length === 0 || ids.has(box.id)) return [];
    if (typeof box.internalName !== 'string' || typeof box.displayName !== 'string') return [];
    ids.add(box.id);
    const {
      identity: _storedIdentity,
      builtInPresetId: _storedBuiltInPresetId,
      ...legacyBox
    } = box;
    const identity = sanitizeConfigurationIdentity(_storedIdentity);
    const builtInPresetId = sanitizeBuiltInPresetId(_storedBuiltInPresetId);
    return [
      {
        ...legacyBox,
        ...(identity ? { identity } : {}),
        ...(builtInPresetId ? { builtInPresetId } : {}),
      },
    ];
  });
}

function readLinkPriority(link: Partial<ConfigurationSourceLink>): number | null {
  return typeof link.priority === 'number'
    && Number.isInteger(link.priority)
    && link.priority >= 0
    ? link.priority
    : null;
}

/**
 * A stack is global to the configuration, not to a source. This lets an
 * operator stack several Arena (or AA/OpenRouter) profiles and gives a
 * deterministic, per-metric "top covers bottom" result.
 */
function normalizeLinkPriorities(links: ConfigurationSourceLink[]): ConfigurationSourceLink[] {
  const byConfiguration = new Map<string, Array<{ link: ConfigurationSourceLink; inputIndex: number }>>();
  links.forEach((link, inputIndex) => {
    const group = byConfiguration.get(link.configurationId) || [];
    group.push({ link, inputIndex });
    byConfiguration.set(link.configurationId, group);
  });

  const normalized: ConfigurationSourceLink[] = [];
  byConfiguration.forEach((group) => {
    group
      .sort((left, right) => {
        const leftPriority = readLinkPriority(left.link);
        const rightPriority = readLinkPriority(right.link);
        if (leftPriority !== null && rightPriority !== null && leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        if (leftPriority !== null && rightPriority === null) return -1;
        if (leftPriority === null && rightPriority !== null) return 1;
        // Input order is the migration-safe tie breaker for v16 records,
        // which had no priority field at all.
        return left.inputIndex - right.inputIndex;
      })
      .forEach(({ link }, priority) => {
        normalized.push({ ...link, priority });
      });
  });

  return normalized;
}

function sanitizeLinks(
  rawLinks: ConfigurationSourceLink[],
  boxes: ConfigurationBox[],
  cards: SourceModelCard[],
): ConfigurationSourceLink[] {
  const boxesById = new Map(boxes.map((box) => [box.id, box]));
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const linkIds = new Set<string>();
  const linkedCards = new Set<string>();
  const scopeByConfiguration = new Map<string, unknown>();

  const validLinks: ConfigurationSourceLink[] = [];
  rawLinks.forEach((link) => {
    if (
      !link
      || typeof link.id !== 'string'
      || link.id.trim().length === 0
      || linkIds.has(link.id)
      || !isKnownSource(link.source)
      || typeof link.sourceModelCardId !== 'string'
    ) return;
    const box = boxesById.get(link.configurationId);
    if (!box) return;
    const card = cardsById.get(link.sourceModelCardId);
    if (!isTrustedCard(card) || card.source !== link.source) return;
    const provenance = parseSourceLinkProvenance(link.provenance);
    if (!provenance) return;
    if (
      provenance.kind !== 'exact'
      && !fallbackIsAuthorizedForBox(box, card, provenance)
    ) return;
    const scope = cardScope(card);
    const existingScope = scopeByConfiguration.get(link.configurationId);
    if (existingScope && !scopesDescribeSameProduct(existingScope, scope)) return;
    const linkedCardKey = `${link.configurationId}:${link.sourceModelCardId}`;
    // Repeating the exact same source card cannot add coverage and makes the
    // precedence outcome ambiguous. Same-source *different* cards are valid.
    if (linkedCards.has(linkedCardKey)) return;
    linkIds.add(link.id);
    linkedCards.add(linkedCardKey);
    scopeByConfiguration.set(link.configurationId, scope);
    const { provenance: _storedProvenance, ...linkWithoutProvenance } = link;
    validLinks.push({
      ...linkWithoutProvenance,
      ...(provenance.kind !== 'exact' ? { provenance } : {}),
    });
    return true;
  });

  return normalizeLinkPriorities(validLinks);
}

function normalizedCardName(card: SourceModelCard): string {
  return card.exactSourceModelName.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

function sourceRecordIdentity(card: SourceModelCard): string | null {
  const sourceIdentity = card.metadataJson?.sourceIdentity;
  const sourceRecordId = sourceIdentity?.sourceRecordId ?? card.metadataJson?.sourceRecordId;
  return typeof sourceRecordId === 'string' && sourceRecordId.trim().length > 0
    ? sourceRecordId.trim()
    : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeSubscriptionCostData(value: unknown): SubscriptionCostData | undefined {
  if (!isPlainRecord(value)) return undefined;
  const planName = typeof value.planName === 'string' ? value.planName.trim() : '';
  const monthlyPriceUSD = value.monthlyPriceUSD;
  const apiEquivalentCostUSD = value.apiEquivalentCostUSD;
  const usableQuotaFraction = value.usableQuotaFraction;
  if (
    !planName
    || typeof monthlyPriceUSD !== 'number'
    || !Number.isFinite(monthlyPriceUSD)
    || monthlyPriceUSD <= 0
    || typeof apiEquivalentCostUSD !== 'number'
    || !Number.isFinite(apiEquivalentCostUSD)
    || apiEquivalentCostUSD <= 0
    || typeof usableQuotaFraction !== 'number'
    || !Number.isFinite(usableQuotaFraction)
    || usableQuotaFraction <= 0
    || usableQuotaFraction > 1
  ) return undefined;

  return {
    planName,
    monthlyPriceUSD,
    apiEquivalentCostUSD,
    usableQuotaFraction,
  };
}

function exactSourceModelName(value: string): string {
  // Whitespace that cannot be observed in a source UI should not make an
  // otherwise exact identity fail to reconcile. Case is intentionally kept:
  // the backup fallback is exact, not a fuzzy model-name heuristic.
  return value.trim().replace(/\s+/gu, ' ');
}

function backupScopeFromCard(card: SourceModelCard): ConfigurationBackupCardScope | null {
  const scope = cardScope(card as SourceCardWithProvenance);
  if (!isValidOagxmScope(scope)) return null;

  return {
    scopeId: scope.scopeId as string,
    scopeVersion: scope.scopeVersion as string,
    vendorId: scope.vendorId as string,
    productLineId: scope.productLineId as string,
    rankingClass: scope.rankingClass as ConfigurationBackupCardScope['rankingClass'],
  };
}

function scopeMatchesBackupReference(
  card: SourceModelCard,
  referenceScope: ConfigurationBackupCardScope,
): boolean {
  const cardBackupScope = backupScopeFromCard(card);
  // A v2 backup is accepted only after its tuple maps to a current product
  // line. The caller still resolves an exact source record (or an unambiguous
  // exact source-model name) against the current verified catalog below.
  return Boolean(
    cardBackupScope
    && mapsToCurrentOagxmProductLine(referenceScope, true)
    && scopesDescribeSameProduct(cardBackupScope, referenceScope, true),
  );
}

function cardReferenceFromVerifiedCard(card: SourceModelCard): ConfigurationBackupCardReference | null {
  if (!isTrustedCard(card)) return null;
  const scope = backupScopeFromCard(card);
  if (!scope) return null;

  const sourceRecordId = sourceRecordIdentity(card);
  return {
    source: card.source,
    exactSourceModelName: card.exactSourceModelName,
    ...(sourceRecordId ? { sourceRecordId } : {}),
    scope,
  };
}

interface ParsedBackupBox {
  box: Omit<ConfigurationBackupBox, 'links'>;
  links: Array<{ link: ConfigurationBackupLink; inputIndex: number }>;
}

interface ParsedBackupDocument {
  boxes: ParsedBackupBox[];
  rejectedBoxCount: number;
  rejectedLinkCount: number;
}

function parseBackupScope(value: unknown): ConfigurationBackupCardScope | null {
  // Portable backups are the only external input that may carry the prior
  // scope version. The compatibility guard still checks that the v2 tuple is
  // represented by the current versioned scope before any source lookup.
  if (!isPlainRecord(value) || !mapsToCurrentOagxmProductLine(value, true)) return null;

  return {
    scopeId: value.scopeId as string,
    scopeVersion: value.scopeVersion as string,
    vendorId: value.vendorId as string,
    productLineId: value.productLineId as string,
    rankingClass: value.rankingClass as ConfigurationBackupCardScope['rankingClass'],
  };
}

function parseBackupCardReference(value: unknown): ConfigurationBackupCardReference | null {
  if (!isPlainRecord(value) || !isKnownSource(value.source)) return null;
  if (typeof value.exactSourceModelName !== 'string' || exactSourceModelName(value.exactSourceModelName).length === 0) {
    return null;
  }
  const scope = parseBackupScope(value.scope);
  if (!scope) return null;

  const hasSourceRecordId = Object.prototype.hasOwnProperty.call(value, 'sourceRecordId');
  if (hasSourceRecordId && (typeof value.sourceRecordId !== 'string' || value.sourceRecordId.trim().length === 0)) {
    return null;
  }

  return {
    source: value.source,
    exactSourceModelName: exactSourceModelName(value.exactSourceModelName),
    ...(hasSourceRecordId ? { sourceRecordId: (value.sourceRecordId as string).trim() } : {}),
    scope,
  };
}

function parseBackupLink(value: unknown): ConfigurationBackupLink | null {
  if (!isPlainRecord(value) || typeof value.priority !== 'number' || !Number.isInteger(value.priority) || value.priority < 0) {
    return null;
  }
  const card = parseBackupCardReference(value.card);
  const provenance = parseSourceLinkProvenance(value.provenance);
  if (!card || !provenance) return null;
  return {
    priority: value.priority,
    card,
    ...(provenance.kind !== 'exact' ? { provenance } : {}),
  };
}

/**
 * Validates the portable envelope without retaining any fields that are not
 * part of the backup contract. In particular observations and score values
 * cannot enter the store through an import, even if a caller supplies them.
 */
function parseConfigurationBackup(input: unknown): ParsedBackupDocument | null {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }

  if (
    !isPlainRecord(value)
    || value.format !== CONFIGURATION_BACKUP_FORMAT
    || value.schemaVersion !== CONFIGURATION_BACKUP_SCHEMA_VERSION
    || typeof value.exportedAt !== 'string'
    || value.exportedAt.trim().length === 0
    || !Array.isArray(value.boxes)
  ) return null;

  const parsed: ParsedBackupDocument = {
    boxes: [],
    rejectedBoxCount: 0,
    rejectedLinkCount: 0,
  };

  value.boxes.forEach((rawBox) => {
    const hasIdentity = isPlainRecord(rawBox) && Object.prototype.hasOwnProperty.call(rawBox, 'identity');
    const identity = hasIdentity ? parseConfigurationIdentity(rawBox.identity) : undefined;
    const hasBuiltInPresetId = isPlainRecord(rawBox) && Object.prototype.hasOwnProperty.call(rawBox, 'builtInPresetId');
    const builtInPresetId = hasBuiltInPresetId ? sanitizeBuiltInPresetId(rawBox.builtInPresetId) : undefined;
    if (!isPlainRecord(rawBox)
      || typeof rawBox.internalName !== 'string'
      || rawBox.internalName.trim().length === 0
      || typeof rawBox.displayName !== 'string'
      || rawBox.displayName.trim().length === 0
      || typeof rawBox.enabled !== 'boolean'
      || (Object.prototype.hasOwnProperty.call(rawBox, 'note') && typeof rawBox.note !== 'string')
      || (hasIdentity && !identity)
      || (hasBuiltInPresetId && !builtInPresetId)
      || !Array.isArray(rawBox.links)) {
      parsed.rejectedBoxCount += 1;
      return;
    }

    const links: Array<{ link: ConfigurationBackupLink; inputIndex: number }> = [];
    rawBox.links.forEach((rawLink, inputIndex) => {
      const link = parseBackupLink(rawLink);
      if (!link) {
        parsed.rejectedLinkCount += 1;
        return;
      }
      links.push({ link, inputIndex });
    });

    parsed.boxes.push({
      box: {
        internalName: rawBox.internalName.trim(),
        displayName: rawBox.displayName.trim(),
        ...(typeof rawBox.note === 'string' ? { note: rawBox.note.trim() } : {}),
        ...(identity && Object.keys(identity).length > 0 ? { identity } : {}),
        ...(builtInPresetId ? { builtInPresetId } : {}),
        enabled: rawBox.enabled,
      },
      links,
    });
  });

  return parsed;
}

/**
 * Resolve only against the verified catalog included with this build. A
 * source-record ID is conclusive when unique; when a source rotates record
 * IDs, a single exact-name match within the same source and full scope is the
 * narrowly-scoped fallback. Ambiguous candidates are intentionally rejected.
 */
function resolveBackupCardReference(
  reference: ConfigurationBackupCardReference,
  verifiedCards: SourceModelCard[],
  activeCardsById: Map<string, SourceModelCard>,
): SourceModelCard | null {
  const scopedCandidates = verifiedCards.filter((card) => (
    isTrustedCard(card)
    && card.source === reference.source
    && scopeMatchesBackupReference(card, reference.scope)
  ));

  let resolved: SourceModelCard | null = null;
  if (reference.sourceRecordId) {
    const recordMatches = scopedCandidates.filter((card) => sourceRecordIdentity(card) === reference.sourceRecordId);
    if (recordMatches.length === 1) {
      resolved = recordMatches[0];
    } else if (recordMatches.length > 1) {
      return null;
    }
  }

  if (!resolved) {
    const nameMatches = scopedCandidates.filter((card) => (
      exactSourceModelName(card.exactSourceModelName) === reference.exactSourceModelName
    ));
    if (nameMatches.length !== 1) return null;
    resolved = nameMatches[0];
  }

  // `this.cards` is the active catalog used later for scoring. Ensure the
  // selected verified identity has that exact active counterpart before a
  // link can be created, rather than leaving a dangling import reference.
  const activeCard = activeCardsById.get(resolved.id);
  return activeCard && isTrustedCard(activeCard) && cardsRepresentSameSourceRecord(activeCard, resolved)
    ? activeCard
    : null;
}

function emptyConfigurationBackupImportReport(): ConfigurationBackupImportReport {
  return {
    accepted: false,
    importedBoxCount: 0,
    importedLinkCount: 0,
    unresolvedLinkCount: 0,
    rejectedBoxCount: 0,
    rejectedLinkCount: 0,
  };
}

function emptyBuiltInConfigurationPresetInstallReport(): BuiltInConfigurationPresetInstallReport {
  return {
    presetCount: 0,
    removedBuiltInBoxCount: 0,
    removedRetiredLegacyBoxCount: 0,
    installedBoxCount: 0,
    existingPresetCount: 0,
    linkedCardCount: 0,
    linkedLowerProfileFallbackCardCount: 0,
    linkedLowerHarnessFallbackCardCount: 0,
    linkedLowerProfileHarnessFallbackCardCount: 0,
    unresolvedSourceCardCount: 0,
    mismatchedSourceCardCount: 0,
    invalidPresetCount: 0,
  };
}

const RETIRED_EMPTY_LEGACY_MODEL_NAMES = new Set([
  'LongCat 2.0',
  'KAT-Coder-Pro V2.5',
  'Gemini 3.1 Flash Lite',
  'Aion-3.0',
  'Fugu Ultra',
  'Fusion',
  'Laguna S 2.1',
  'Ling-3.0-flash',
  'Nemotron 3.5 Content Safety',
  'Nex-N2-Mini',
  'North Mini Code',
  'Perceptron Mk1',
  'Qwen3.5 Plus 2026-04-20',
  'Qwen3.6 Flash',
  'Qwen3.7 Flash',
].map((name) => normalizeRetiredLegacyModelName(name)));

const CAPABILITY_METRIC_IDS = new Set(
  ALL_METRIC_DEFINITIONS.map((definition) => definition.id),
);

function normalizeRetiredLegacyModelName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[‐‑‒–—−]/gu, '-')
    .replace(/\s*\(\s*free\s*\)\s*$/iu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function retiredLegacyModelNameForBox(box: ConfigurationBox): string {
  const identityName = sanitizeConfigurationIdentity(box.identity)?.model?.name;
  if (identityName) return normalizeRetiredLegacyModelName(identityName);

  // Very old browser rows predate structured identity. Their display name
  // still begins with the model and profile before the first separator.
  const displayModel = box.displayName
    .split('|')[0]
    .replace(
      /\s+(?:none|minimal|low|medium|high|x[- ]?high|max|standard|reasoning|thinking)\s*$/iu,
      '',
    );
  return normalizeRetiredLegacyModelName(displayModel);
}

/**
 * The bundled inventory is authored TypeScript, but keep the installation
 * boundary defensive: an invalid future entry must not create a partial box
 * or weaken the source-card provenance checks below.
 */
function hasInstallablePresetIdentity(
  preset: BuiltInConfigurationPreset,
): preset is BuiltInConfigurationPreset & { identity: Required<ConfigurationIdentity> } {
  const identity = sanitizeConfigurationIdentity(preset.identity);
  const subscriptionData = sanitizeSubscriptionCostData(preset.subscriptionData);
  const hasValidAccessData = preset.access === 'subscription'
    ? Boolean(subscriptionData)
    : preset.subscriptionData === undefined;
  return Boolean(
    typeof preset.id === 'string' && preset.id.trim().length > 0
    && typeof preset.internalName === 'string' && preset.internalName.trim().length > 0
    && typeof preset.displayName === 'string' && preset.displayName.trim().length > 0
    && typeof preset.productLineId === 'string' && preset.productLineId.trim().length > 0
    && identity?.model?.name
    && identity?.model?.profile
    && identity?.harness?.name
    && identity?.harness?.environment
    && identity?.provider?.name
    && identity?.provider?.upstream
    && hasValidAccessData,
  );
}

/**
 * A link is carried across a catalog rebuild only if its old card and new
 * card describe the same verified source record (or an unambiguous exact
 * source-model name within the same OAGXM product line).
 */
function cardsRepresentSameSourceRecord(
  legacyCard: SourceModelCard,
  verifiedCard: SourceModelCard,
  allowLegacyScopeVersion: boolean = false,
): boolean {
  if (
    legacyCard.source !== verifiedCard.source
    || !scopesDescribeSameProduct(
      cardScope(legacyCard as SourceCardWithProvenance),
      cardScope(verifiedCard as SourceCardWithProvenance),
      allowLegacyScopeVersion,
    )
  ) return false;

  const legacyRecordId = sourceRecordIdentity(legacyCard);
  const verifiedRecordId = sourceRecordIdentity(verifiedCard);
  // Arena source-record IDs include extracted row positions and can change
  // across a fresh fetch. An equal record ID is conclusive; otherwise an
  // exact source-model name remains safe only when reconciliation finds one
  // unambiguous candidate in the same product line.
  if (legacyRecordId && verifiedRecordId && legacyRecordId === verifiedRecordId) return true;
  return normalizedCardName(legacyCard) === normalizedCardName(verifiedCard);
}

function reconcileLinksToVerifiedCatalog(
  rawLinks: ConfigurationSourceLink[],
  legacyCards: SourceModelCard[],
  boxes: ConfigurationBox[],
  verifiedCards: SourceModelCard[],
): ConfigurationSourceLink[] {
  const legacyCardsById = new Map(legacyCards
    .filter((card): card is SourceModelCard => Boolean(card && typeof card.id === 'string'))
    .map((card) => [card.id, card]));
  const verifiedCardsById = new Map(verifiedCards
    .filter((card): card is SourceModelCard => Boolean(card && typeof card.id === 'string'))
    .map((card) => [card.id, card]));

  const relinked = rawLinks.flatMap((link) => {
    const legacyCard = legacyCardsById.get(link?.sourceModelCardId);
    // Stored v2 cards are compatibility input only. Their scope must map to
    // the current whitelist and their link must still resolve to one verified
    // source record before it is carried forward.
    if (!isTrustedCard(legacyCard, true)) return [];

    const exactIdMatch = verifiedCardsById.get(legacyCard.id);
    if (
      exactIdMatch
      && isTrustedCard(exactIdMatch)
      && cardsRepresentSameSourceRecord(legacyCard, exactIdMatch, true)
    ) {
      return [{ ...link, source: exactIdMatch.source, sourceModelCardId: exactIdMatch.id }];
    }

    const candidates = verifiedCards.filter((verifiedCard) => (
      isTrustedCard(verifiedCard) && cardsRepresentSameSourceRecord(legacyCard, verifiedCard, true)
    ));
    if (candidates.length !== 1) return [];
    return [{ ...link, source: candidates[0].source, sourceModelCardId: candidates[0].id }];
  });

  return sanitizeLinks(relinked, boxes, verifiedCards);
}

function secondsFromLatencyObservation(observation: SourceObservation | undefined): number | null {
  if (!observation || typeof observation.rawValue !== 'number' || observation.rawValue <= 0) return null;
  const unit = observation.unit.trim().toLowerCase();
  if (unit === 'ms' || unit === 'millisecond' || unit === 'milliseconds') return observation.rawValue / 1000;
  if (unit === 's' || unit === 'sec' || unit === 'second' || unit === 'seconds') return observation.rawValue;
  return null;
}

/** Preserve the declared profile in the scoring identity instead of making
 * every configuration look like a non-reasoning run in the detail UI. */
function reasoningEffortForProfile(
  profile: string | undefined,
): LLMConfiguration['identity']['reasoningEffort'] {
  const normalized = profile?.trim().toLocaleLowerCase('en-US') || '';
  if (!normalized) return 'None';
  if (/\bnon[- ]?reasoning\b|\bnone\b|no[- ]?thinking|不思考|无思考/u.test(normalized)) return 'None';
  if (/\bx[- ]?high\b|\bxhigh\b/u.test(normalized)) return 'X-High';
  if (/\bmax\b|\bpro\b|\breasoning\b|\bthinking\b|\badaptive\b|最高档|深度思考/u.test(normalized)) return 'Deep Think';
  if (/\bhigh\b|高档|高思考/u.test(normalized)) return 'High';
  if (/\bmedium\b|中档|中等/u.test(normalized)) return 'Medium';
  if (/\bminimal\b|\blow\b|低档|低思考/u.test(normalized)) return 'Low';
  return 'None';
}

export class AdminMappingStore {
  boxes: ConfigurationBox[] = [];
  cards: SourceModelCard[] = [];
  observations: SourceObservation[] = [];
  links: ConfigurationSourceLink[] = [];
  lastDataCleanup: DataCleanupReport = emptyCleanupReport();

  private catalogFingerprint = '';

  constructor() {
    this.loadFromStorage();
  }

  getLastDataCleanupReport(): DataCleanupReport {
    return { ...this.lastDataCleanup };
  }

  /**
   * Add every shipped configuration identity as an enabled, visible local configuration.
   *
   * This deliberately never tries to find a card by a model name, provider,
   * or profile. A built-in preset may link a card only by an explicit stable
   * card ID in its own declaration, and the current card must still prove
   * that it belongs to the preset's exact OAGXM product line. This is
   * particularly important for IDE/client configurations: their environment
   * label is not evidence that a normal-chat source card ran in that harness.
   *
   * Existing built-ins retain every manual edit and link. When the bundled
   * inventory later declares an additional card, only the missing explicit
   * card is appended below the existing stack, never inserted, removed, or
   * reordered. A changed three-part identity opts out of such reconciliation.
   */
  installBuiltInConfigurationPresets(): BuiltInConfigurationPresetInstallReport {
    const report = emptyBuiltInConfigurationPresetInstallReport();
    report.presetCount = BUILT_IN_CONFIGURATION_PRESETS.length;

    const existingBoxesByPresetId = new Map<string, ConfigurationBox[]>();
    this.boxes.forEach((box) => {
      const presetId = sanitizeBuiltInPresetId(box.builtInPresetId);
      if (!presetId) return;
      const existing = existingBoxesByPresetId.get(presetId) || [];
      existing.push(box);
      existingBoxesByPresetId.set(presetId, existing);
    });
    const inventoryPresetIds = new Set<string>();
    const usedBoxIds = new Set(this.boxes.map((box) => box.id));
    const usedLinkIds = new Set(this.links.map((link) => link.id));
    const usedInternalNames = new Set(this.boxes.map((box) => box.internalName));
    const usedDisplayNames = new Set(this.boxes.map((box) => box.displayName));
    const verifiedCardsById = new Map(this.cards
      .filter((card): card is SourceCardWithProvenance => isTrustedCard(card))
      .map((card) => [card.id, card]));
    const today = new Date().toISOString().split('T')[0];
    let changed = false;

    const makeUniqueName = (
      base: string,
      usedNames: Set<string>,
      withSuffix: (name: string, suffix: number) => string,
    ): string => {
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(candidate)) {
        candidate = withSuffix(base, suffix);
        suffix += 1;
      }
      usedNames.add(candidate);
      return candidate;
    };

    const freshId = (prefix: 'box' | 'link', usedIds: Set<string>): string => {
      let id = '';
      do {
        id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      } while (usedIds.has(id));
      usedIds.add(id);
      return id;
    };

    const appendMissingPresetCards = (
      box: ConfigurationBox,
      preset: BuiltInConfigurationPreset,
      declarations: PresetSourceCardDeclaration[],
    ): boolean => {
      const presetIdentity = sanitizeConfigurationIdentity(preset.identity);
      const boxIdentity = sanitizeConfigurationIdentity(box.identity);
      // Preserve an operator's changed model/harness/provider route. A
      // source declaration authored for the original API configuration cannot
      // silently flow into a manually altered configuration.
      if (!sameConfigurationIdentity(boxIdentity, presetIdentity)) return false;

      const existingLinks = this.links.filter((link) => link.configurationId === box.id);
      const existingCardIds = new Set(existingLinks.map((link) => link.sourceModelCardId));
      const existingCards = existingLinks.map((link) => (
        this.cards.find((card) => card.id === link.sourceModelCardId)
      ));
      // Do not append an inventory card into a stack that has unresolved or
      // unverified local records. A later catalog reconciliation can repair
      // it, but installation must never turn an ambiguous stack into a mixed
      // provenance configuration.
      const trustedExistingCards = existingCards.filter(
        (card): card is SourceCardWithProvenance => isTrustedCard(card),
      );
      if (trustedExistingCards.length !== existingCards.length) return false;
      if (trustedExistingCards.some((card) => {
        const scope = cardScope(card);
        return !isValidOagxmScope(scope) || scope.productLineId !== preset.productLineId;
      })) return false;

      let priority = existingLinks.reduce((highest, link) => (
        Math.max(highest, readLinkPriority(link) ?? highest)
      ), -1) + 1;
      let appended = false;
      for (const declaration of declarations) {
        // The exact source card may already be a manually chosen link. Never
        // change its provenance or position; it is already the operator's
        // explicit decision for this configuration.
        if (existingCardIds.has(declaration.cardId)) continue;

        const card = verifiedCardsById.get(declaration.cardId);
        if (!card) {
          report.unresolvedSourceCardCount += 1;
          continue;
        }
        const scope = cardScope(card);
        if (!isValidOagxmScope(scope) || scope.productLineId !== preset.productLineId) {
          report.mismatchedSourceCardCount += 1;
          continue;
        }
        if (
          declaration.provenance.kind !== 'exact'
          && !fallbackIsAuthorizedForBox(box, card, declaration.provenance)
        ) {
          // This normally indicates a future inventory typo. It must not
          // become a partial, silently unaudited source mapping.
          report.invalidPresetCount += 1;
          continue;
        }

        this.links.push({
          id: freshId('link', usedLinkIds),
          configurationId: box.id,
          source: card.source,
          sourceModelCardId: card.id,
          ...(declaration.provenance.kind !== 'exact'
            ? { provenance: declaration.provenance }
            : {}),
          priority,
          createdAt: today,
          updatedAt: today,
        });
        existingCardIds.add(card.id);
        priority += 1;
        appended = true;
        report.linkedCardCount += 1;
        if (declaration.provenance.kind === 'lower_profile_fallback') {
          report.linkedLowerProfileFallbackCardCount += 1;
        } else if (declaration.provenance.kind === 'lower_harness_fallback') {
          report.linkedLowerHarnessFallbackCardCount += 1;
        } else if (declaration.provenance.kind === 'lower_profile_harness_fallback') {
          report.linkedLowerProfileHarnessFallbackCardCount += 1;
        }
      }
      return appended;
    };

    for (const preset of BUILT_IN_CONFIGURATION_PRESETS) {
      if (!hasInstallablePresetIdentity(preset)) {
        report.invalidPresetCount += 1;
        continue;
      }

      const presetId = preset.id.trim();
      if (inventoryPresetIds.has(presetId)) {
        // A future duplicate in the static inventory cannot overwrite or
        // produce a second competing copy of a shipped configuration.
        report.invalidPresetCount += 1;
        continue;
      }
      inventoryPresetIds.add(presetId);

      const identity = sanitizeConfigurationIdentity(preset.identity);
      const declarations = presetSourceCardDeclarations(preset);
      if (
        !identity
        || !declarations
        || declarations.some((declaration) => (
          declaration.provenance.kind !== 'exact'
          && !fallbackIsValidForPreset(preset, declaration.provenance)
        ))
      ) {
        report.invalidPresetCount += 1;
        continue;
      }

      const existingBoxes = existingBoxesByPresetId.get(presetId) || [];
      if (existingBoxes.length > 0) {
        report.existingPresetCount += 1;
        existingBoxes.forEach((box) => {
          if (appendMissingPresetCards(box, preset, declarations)) changed = true;
        });
        continue;
      }

      const box: ConfigurationBox = {
        id: freshId('box', usedBoxIds),
        internalName: makeUniqueName(
          preset.internalName.trim(),
          usedInternalNames,
          (name, suffix) => `${name}_${suffix}`,
        ),
        displayName: makeUniqueName(
          preset.displayName.trim(),
          usedDisplayNames,
          (name, suffix) => `${name} (${suffix})`,
        ),
        ...(typeof preset.note === 'string' && preset.note.trim().length > 0
          ? { note: preset.note.trim() }
          : {}),
        identity,
        builtInPresetId: presetId,
        enabled: true,
        createdAt: today,
        updatedAt: today,
      };
      this.boxes.push(box);
      existingBoxesByPresetId.set(presetId, [box]);
      report.installedBoxCount += 1;
      changed = true;
      if (appendMissingPresetCards(box, preset, declarations)) changed = true;
    }

    if (changed) {
      this.links = normalizeLinkPriorities(this.links);
      this.saveToStorage();
    }
    return report;
  }

  /**
   * Replace shipped built-in boxes when the compact inventory version changes.
   * A small, explicit retirement list also removes legacy pre-preset boxes
   * only when their linked cards contain no capability observation. Unrelated
   * drafts and any partially populated legacy row remain untouched.
   */
  synchronizeBuiltInConfigurationPresets(
    force: boolean = false,
  ): BuiltInConfigurationPresetInstallReport {
    const installedVersion = this.canUseStorage()
      ? localStorage.getItem(STORAGE_KEY_BUILT_IN_INVENTORY_VERSION)
      : null;
    if (!force && installedVersion === BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION) {
      return this.installBuiltInConfigurationPresets();
    }

    const builtInBoxIds = new Set(this.boxes
      .filter((box) => Boolean(sanitizeBuiltInPresetId(box.builtInPresetId)))
      .map((box) => box.id));
    this.boxes = this.boxes.filter((box) => !builtInBoxIds.has(box.id));
    this.links = this.links.filter((link) => !builtInBoxIds.has(link.configurationId));

    const cardsWithCapabilityData = new Set(this.observations
      .filter((observation) => (
        CAPABILITY_METRIC_IDS.has(observation.metricId)
        && typeof observation.rawValue === 'number'
        && Number.isFinite(observation.rawValue)
      ))
      .map((observation) => observation.sourceModelCardId));
    const linkedCapabilityBoxIds = new Set(this.links
      .filter((link) => cardsWithCapabilityData.has(link.sourceModelCardId))
      .map((link) => link.configurationId));
    const retiredLegacyBoxIds = new Set(this.boxes
      .filter((box) => (
        !sanitizeBuiltInPresetId(box.builtInPresetId)
        && RETIRED_EMPTY_LEGACY_MODEL_NAMES.has(retiredLegacyModelNameForBox(box))
        && !linkedCapabilityBoxIds.has(box.id)
      ))
      .map((box) => box.id));
    this.boxes = this.boxes.filter((box) => !retiredLegacyBoxIds.has(box.id));
    this.links = this.links.filter((link) => !retiredLegacyBoxIds.has(link.configurationId));
    this.saveToStorage();

    const report = this.installBuiltInConfigurationPresets();
    report.removedBuiltInBoxCount = builtInBoxIds.size;
    report.removedRetiredLegacyBoxCount = retiredLegacyBoxIds.size;
    if (this.canUseStorage()) {
      try {
        localStorage.setItem(
          STORAGE_KEY_BUILT_IN_INVENTORY_VERSION,
          BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION,
        );
      } catch (error) {
        console.warn('Built-in inventory version could not be persisted:', error);
      }
    }
    return report;
  }

  /**
   * Export every configuration and its top-to-bottom card stack as a portable
   * JSON-safe document. Source observations, calculated scores, local IDs,
   * and timestamps are intentionally never included.
   */
  exportConfigurationBackup(): ConfigurationBackup {
    return {
      format: CONFIGURATION_BACKUP_FORMAT,
      schemaVersion: CONFIGURATION_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      boxes: this.boxes.map((box) => {
        const identity = sanitizeConfigurationIdentity(box.identity);
        const builtInPresetId = sanitizeBuiltInPresetId(box.builtInPresetId);
        return {
          internalName: box.internalName,
          displayName: box.displayName,
          ...(typeof box.note === 'string' ? { note: box.note } : {}),
          ...(identity ? { identity } : {}),
          ...(builtInPresetId ? { builtInPresetId } : {}),
          enabled: box.enabled,
          links: this.getLinkedCardStack(box.id).flatMap(({ link, card }, priority) => {
            const cardReference = cardReferenceFromVerifiedCard(card);
            const provenance = parseSourceLinkProvenance(link.provenance);
            if (!cardReference || !provenance) return [];
            return [{
              priority,
              card: cardReference,
              ...(provenance.kind !== 'exact' ? { provenance } : {}),
            }];
          }),
        };
      }),
    };
  }

  /** Convenience form for downloading or copying a backup without callers
   * needing to know the envelope's serialization details. */
  exportConfigurationBackupJson(): string {
    return JSON.stringify(this.exportConfigurationBackup(), null, 2);
  }

  /**
   * Import a portable configuration backup without replacing any existing
   * configuration. Every accepted box becomes a disabled draft. A card is
   * linked only after it resolves uniquely against this build's verified
   * catalog; unresolved and malformed records are counted, never guessed.
   */
  importConfigurationBackup(input: unknown): ConfigurationBackupImportReport {
    const parsedBackup = parseConfigurationBackup(input);
    if (!parsedBackup) {
      const rejected = emptyConfigurationBackupImportReport();
      rejected.rejectedBoxCount = 1;
      return rejected;
    }

    const report = emptyConfigurationBackupImportReport();
    report.accepted = true;
    report.rejectedBoxCount = parsedBackup.rejectedBoxCount;
    report.rejectedLinkCount = parsedBackup.rejectedLinkCount;

    // Import resolution must not trust cards embedded in browser storage. The
    // source catalog bundled with the current build is the authority; active
    // cards are used only to ensure the resulting link can be scored now.
    const verifiedCards = this.loadVerifiedCatalog().cards;
    const activeCardsById = new Map(this.cards
      .filter((card): card is SourceCardWithProvenance => isTrustedCard(card))
      .map((card) => [card.id, card]));
    const usedBoxIds = new Set(this.boxes.map((box) => box.id));
    const usedLinkIds = new Set(this.links.map((link) => link.id));
    const usedInternalNames = new Set(this.boxes.map((box) => box.internalName));
    const usedDisplayNames = new Set(this.boxes.map((box) => box.displayName));
    const importedBoxes: ConfigurationBox[] = [];
    const importedLinks: ConfigurationSourceLink[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const freshId = (prefix: 'box' | 'link', usedIds: Set<string>): string => {
      let id = '';
      do {
        id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      } while (usedIds.has(id));
      usedIds.add(id);
      return id;
    };

    const uniqueName = (
      base: string,
      usedNames: Set<string>,
      withSuffix: (name: string, suffix: number) => string,
    ): string => {
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(candidate)) {
        candidate = withSuffix(base, suffix);
        suffix += 1;
      }
      usedNames.add(candidate);
      return candidate;
    };

    parsedBackup.boxes.forEach((parsedBox) => {
      const resolvedCards: Array<{
        card: SourceModelCard;
        provenance: ConfigurationSourceLinkProvenance;
      }> = [];
      const resolvedCardIds = new Set<string>();
      let stackScope: unknown = null;
      let scopeConflict = false;

      [...parsedBox.links]
        .sort((left, right) => left.link.priority - right.link.priority || left.inputIndex - right.inputIndex)
        .forEach(({ link }) => {
          const card = resolveBackupCardReference(link.card, verifiedCards, activeCardsById);
          if (!card) {
            report.unresolvedLinkCount += 1;
            return;
          }
          if (resolvedCardIds.has(card.id)) {
            report.rejectedLinkCount += 1;
            return;
          }

          const candidateScope = cardScope(card as SourceCardWithProvenance);
          if (stackScope && !scopesDescribeSameProduct(stackScope, candidateScope)) {
            // A configuration must describe one OAGXM product line. Reject the
            // whole malformed box instead of silently retaining a misleading
            // partial configuration with a different model's card removed.
            report.rejectedLinkCount += 1;
            scopeConflict = true;
            return;
          }

          stackScope = candidateScope;
          resolvedCardIds.add(card.id);
          resolvedCards.push({
            card,
            provenance: link.provenance || { kind: 'exact' },
          });
        });

      if (scopeConflict) {
        report.rejectedBoxCount += 1;
        return;
      }

      const boxId = freshId('box', usedBoxIds);
      const importedBox: ConfigurationBox = {
        id: boxId,
        internalName: uniqueName(
          parsedBox.box.internalName,
          usedInternalNames,
          (name, suffix) => `${name}_import_${suffix}`,
        ),
        displayName: uniqueName(
          parsedBox.box.displayName,
          usedDisplayNames,
          (name, suffix) => `${name}（导入 ${suffix}）`,
        ),
        ...(typeof parsedBox.box.note === 'string' ? { note: parsedBox.box.note } : {}),
        ...(parsedBox.box.identity ? { identity: parsedBox.box.identity } : {}),
        ...(parsedBox.box.builtInPresetId ? { builtInPresetId: parsedBox.box.builtInPresetId } : {}),
        // An import is always a draft, even when its source backup had an
        // enabled box. The operator must explicitly enable it after review.
        enabled: false,
        createdAt: today,
        updatedAt: today,
      };
      importedBoxes.push(importedBox);
      let acceptedLinkCount = 0;
      resolvedCards.forEach(({ card, provenance }) => {
        if (
          provenance.kind !== 'exact'
          && !fallbackIsAuthorizedForBox(importedBox, card, provenance)
        ) {
          // A backup may not introduce a fallback into a subscription,
          // managed, inferred, or manually-created configuration. The
          // current shipped preset remains the source of authorization.
          report.rejectedLinkCount += 1;
          return;
        }
        importedLinks.push({
          id: freshId('link', usedLinkIds),
          configurationId: boxId,
          source: card.source,
          sourceModelCardId: card.id,
          ...(provenance.kind !== 'exact' ? { provenance } : {}),
          priority: acceptedLinkCount,
          createdAt: today,
          updatedAt: today,
        });
        acceptedLinkCount += 1;
      });
      report.importedBoxCount += 1;
      report.importedLinkCount += acceptedLinkCount;
    });

    if (importedBoxes.length > 0) {
      this.boxes = [...this.boxes, ...importedBoxes];
      this.links = normalizeLinkPriorities([...this.links, ...importedLinks]);
      this.saveToStorage();
    }
    return report;
  }

  resetToLatestVerifiedCatalog() {
    const sourceData = this.loadVerifiedCatalog();
    const previousObservationCount = this.observations.length;
    const previousCards = this.cards;

    this.cards = sourceData.cards;
    this.observations = sourceData.observations;
    this.links = reconcileLinksToVerifiedCatalog(this.links, previousCards, this.boxes, this.cards);
    this.lastDataCleanup = this.createCleanupReport(sourceData, {
      catalogRebuilt: true,
      staleObservationRecordsReplaced: previousObservationCount,
    });
    this.saveToStorage();
  }

  private canUseStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private loadVerifiedCatalog(): SanitizedSourceData {
    const rawCards = [
      ...parseArray<SourceModelCard>(VERIFIED_SOURCE_MODEL_CARDS),
      ...VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
      ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
      ...VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
      ...VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
    ];
    const rawObservations = [
      ...parseArray<SourceObservation>(VERIFIED_SOURCE_OBSERVATIONS),
      ...VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
      ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
      ...VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
      ...VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
    ];
    const sourceData = sanitizeSourceData(rawCards, rawObservations);
    this.catalogFingerprint = buildCatalogFingerprint(sourceData.cards, sourceData.observations);
    return sourceData;
  }

  private createCleanupReport(
    sourceData: SanitizedSourceData,
    partial: Partial<DataCleanupReport> = {},
  ): DataCleanupReport {
    return {
      ...emptyCleanupReport(this.catalogFingerprint),
      invalidCardsRemoved: sourceData.invalidCardsRemoved,
      unverifiableObservationsRemoved: sourceData.unverifiableObservationsRemoved,
      knownPlaceholderObservationsRemoved: sourceData.knownPlaceholderObservationsRemoved,
      duplicateObservationsRemoved: sourceData.duplicateObservationsRemoved,
      activeCards: sourceData.cards.length,
      activeObservations: sourceData.observations.length,
      ...partial,
      schemaVersion: ADMIN_MAPPING_STORE_SCHEMA_VERSION,
      catalogFingerprint: this.catalogFingerprint,
      completedAt: new Date().toISOString(),
    };
  }

  private readStoredArray<T>(key: string): T[] {
    if (!this.canUseStorage()) return [];
    return parseArray<T>(localStorage.getItem(key));
  }

  private removeLegacyV16Payloads() {
    if (!this.canUseStorage()) return;
    try {
      Object.values(LEGACY_V16_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // v17 is already committed at this point. Leaving the old payload for a
      // later cleanup is safer than interrupting the live in-memory mapping.
      console.warn('Legacy v16 cleanup deferred:', error);
    }
  }

  /**
   * v16 stored exactly one link per source and had no `priority`. Rebuild the
   * source catalog from the verified export, then carry each user link over
   * only when it still resolves to the same source record. This avoids both
   * losing the user's five existing configurations and attaching an old link
   * to a different card after a source-catalog refresh.
   */
  private migrateV16ToV17(verifiedCatalog: SanitizedSourceData) {
    const legacyBoxes = sanitizeBoxes(this.readStoredArray<ConfigurationBox>(LEGACY_V16_STORAGE_KEYS.boxes));
    const legacyCards = this.readStoredArray<SourceModelCard>(LEGACY_V16_STORAGE_KEYS.cards);
    const legacyLinks = this.readStoredArray<ConfigurationSourceLink>(LEGACY_V16_STORAGE_KEYS.links);
    const legacyObservations = this.readStoredArray<SourceObservation>(LEGACY_V16_STORAGE_KEYS.observations);

    this.boxes = legacyBoxes;
    this.cards = verifiedCatalog.cards;
    this.observations = verifiedCatalog.observations;
    this.links = reconcileLinksToVerifiedCatalog(legacyLinks, legacyCards, this.boxes, this.cards);
    this.lastDataCleanup = this.createCleanupReport(verifiedCatalog, {
      migrationApplied: true,
      catalogRebuilt: true,
      legacyCardsRemoved: legacyCards.length,
      legacyLinksRemoved: Math.max(0, legacyLinks.length - this.links.length),
      legacyObservationRecordsRemoved: legacyObservations.length,
      staleObservationRecordsReplaced: legacyObservations.length,
    });

    // The schema marker is written last by saveToStorage. Only delete v16
    // payloads after that write succeeds, so an interrupted migration remains
    // retryable with the user's original mappings intact.
    if (this.saveToStorage()) this.removeLegacyV16Payloads();
  }

  private purgeLegacyStorePayloads(): {
    cards: number;
    links: number;
    observations: number;
  } {
    const removed = { cards: 0, links: 0, observations: 0 };
    if (!this.canUseStorage()) return removed;

    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && /^llmpk_admin_(boxes|cards|links|obs|catalog_fingerprint|cleanup_report)_v\d+$/.test(key)) keys.push(key);
    }

    keys.forEach((key) => {
      const records = parseArray<unknown>(localStorage.getItem(key));
      if (key.includes('_cards_')) removed.cards += records.length;
      if (key.includes('_links_')) removed.links += records.length;
      if (key.includes('_obs_')) removed.observations += records.length;
      localStorage.removeItem(key);
    });
    return removed;
  }

  private loadFromStorage() {
    const verifiedCatalog = this.loadVerifiedCatalog();

    if (!this.canUseStorage()) {
      this.cards = verifiedCatalog.cards;
      this.observations = verifiedCatalog.observations;
      this.lastDataCleanup = this.createCleanupReport(verifiedCatalog);
      return;
    }

    try {
      const storedSchemaVersion = localStorage.getItem(STORAGE_KEY_SCHEMA);
      if (storedSchemaVersion === '16') {
        this.migrateV16ToV17(verifiedCatalog);
        return;
      }

      const schemaMatches = storedSchemaVersion === String(ADMIN_MAPPING_STORE_SCHEMA_VERSION);
      if (!schemaMatches) {
        const removed = this.purgeLegacyStorePayloads();
        this.boxes = [];
        this.links = [];
        this.cards = verifiedCatalog.cards;
        this.observations = verifiedCatalog.observations;
        this.lastDataCleanup = this.createCleanupReport(verifiedCatalog, {
          migrationApplied: true,
          catalogRebuilt: true,
          legacyCardsRemoved: removed.cards,
          legacyLinksRemoved: removed.links,
          legacyObservationRecordsRemoved: removed.observations,
        });
        this.saveToStorage();
        return;
      }

      const storedBoxes = sanitizeBoxes(this.readStoredArray<ConfigurationBox>(STORAGE_KEY_BOXES));
      const storedCards = this.readStoredArray<SourceModelCard>(STORAGE_KEY_CARDS);
      const storedObservations = this.readStoredArray<SourceObservation>(STORAGE_KEY_OBS);
      const storedLinks = this.readStoredArray<ConfigurationSourceLink>(STORAGE_KEY_LINKS);
      const catalogChanged = localStorage.getItem(STORAGE_KEY_CATALOG_FINGERPRINT) !== this.catalogFingerprint;

      // Cards and observations are immutable verified build assets. Persisting
      // the full catalog exceeded browser storage quotas and could leave a
      // current fingerprint beside a truncated observation payload. Always
      // score from the bundled catalog; local storage owns only boxes, links,
      // and small migration metadata.
      this.boxes = storedBoxes;
      this.cards = verifiedCatalog.cards;
      this.observations = verifiedCatalog.observations;
      // Old stored cards remain useful only as reconciliation input when a
      // source record ID rotated. Current verified cards fill any records
      // omitted by a previously truncated local payload.
      this.links = reconcileLinksToVerifiedCatalog(
        storedLinks,
        [...this.cards, ...storedCards],
        this.boxes,
        this.cards,
      );
      this.lastDataCleanup = this.createCleanupReport(verifiedCatalog, {
        catalogRebuilt: catalogChanged || storedCards.length > 0 || storedObservations.length > 0,
        legacyLinksRemoved: Math.max(0, storedLinks.length - this.links.length),
        staleObservationRecordsReplaced: storedObservations.length,
      });
      this.saveToStorage();
    } catch {
      this.boxes = [];
      this.links = [];
      this.cards = verifiedCatalog.cards;
      this.observations = verifiedCatalog.observations;
      this.lastDataCleanup = this.createCleanupReport(verifiedCatalog, {
        migrationApplied: true,
        catalogRebuilt: true,
      });
      this.saveToStorage();
    }
  }

  private saveToStorage(): boolean {
    if (!this.canUseStorage()) return false;
    try {
      // The verified catalog already ships in the application bundle. Remove
      // legacy copies before writing the small operator-owned state so a large
      // observation payload cannot consume the quota or masquerade as a
      // successfully committed catalog.
      localStorage.removeItem(STORAGE_KEY_CATALOG_FINGERPRINT);
      localStorage.removeItem(STORAGE_KEY_CARDS);
      localStorage.removeItem(STORAGE_KEY_OBS);
      localStorage.setItem(STORAGE_KEY_BOXES, JSON.stringify(this.boxes));
      localStorage.setItem(STORAGE_KEY_LINKS, JSON.stringify(this.links));
      localStorage.setItem(STORAGE_KEY_CLEANUP_REPORT, JSON.stringify(this.lastDataCleanup));
      // Commit markers are written last. A partial write therefore forces the
      // next load back through verified-catalog reconciliation.
      localStorage.setItem(STORAGE_KEY_CATALOG_FINGERPRINT, this.catalogFingerprint);
      localStorage.setItem(STORAGE_KEY_SCHEMA, String(ADMIN_MAPPING_STORE_SCHEMA_VERSION));
      return true;
    } catch (error) {
      console.error('Storage save failed:', error);
      return false;
    }
  }

  // --- Configuration Box CRUD ---
  createBox(
    internalName: string,
    displayName: string,
    note?: string,
    enabled: boolean = true,
    identity?: ConfigurationIdentity,
    builtInPresetId?: string,
  ): ConfigurationBox {
    const sanitizedIdentity = sanitizeConfigurationIdentity(identity);
    const sanitizedBuiltInPresetId = sanitizeBuiltInPresetId(builtInPresetId);
    const newBox: ConfigurationBox = {
      id: `box-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      internalName: internalName.trim(),
      displayName: displayName.trim(),
      note: note?.trim(),
      ...(sanitizedIdentity ? { identity: sanitizedIdentity } : {}),
      ...(sanitizedBuiltInPresetId ? { builtInPresetId: sanitizedBuiltInPresetId } : {}),
      enabled,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    this.boxes.push(newBox);
    this.saveToStorage();
    return newBox;
  }

  updateBox(id: string, partial: Partial<ConfigurationBox>): ConfigurationBox | null {
    const index = this.boxes.findIndex((box) => box.id === id);
    if (index === -1) return null;

    const {
      identity: identityUpdate,
      builtInPresetId: builtInPresetIdUpdate,
      ...boxPartial
    } = partial;
    const identityWasProvided = Object.prototype.hasOwnProperty.call(partial, 'identity');
    const builtInPresetIdWasProvided = Object.prototype.hasOwnProperty.call(partial, 'builtInPresetId');
    const existing = this.boxes[index];
    const {
      identity: existingIdentity,
      builtInPresetId: existingBuiltInPresetId,
      ...boxWithoutIdentity
    } = existing;
    const nextIdentity = identityWasProvided
      ? sanitizeConfigurationIdentity(identityUpdate)
      : sanitizeConfigurationIdentity(existingIdentity);
    const nextBuiltInPresetId = builtInPresetIdWasProvided
      ? sanitizeBuiltInPresetId(builtInPresetIdUpdate)
      : sanitizeBuiltInPresetId(existingBuiltInPresetId);

    this.boxes[index] = {
      ...boxWithoutIdentity,
      ...boxPartial,
      ...(nextIdentity ? { identity: nextIdentity } : {}),
      ...(nextBuiltInPresetId ? { builtInPresetId: nextBuiltInPresetId } : {}),
      updatedAt: new Date().toISOString().split('T')[0],
    };

    // A fallback is authorized for one unchanged shipped API/subscription
    // identity only.
    // If an operator changes that identity (for example to a subscription or
    // another harness), remove just the now-invalid fallback from this box
    // rather than letting it continue to supply data under a new label.
    const otherLinks = this.links.filter((link) => link.configurationId !== id);
    const updatedBoxLinks = this.links.filter((link) => link.configurationId === id);
    this.links = normalizeLinkPriorities([
      ...otherLinks,
      ...sanitizeLinks(updatedBoxLinks, [this.boxes[index]], this.cards),
    ]);

    this.saveToStorage();
    return this.boxes[index];
  }

  deleteBox(id: string): boolean {
    this.boxes = this.boxes.filter((box) => box.id !== id);
    this.links = this.links.filter((link) => link.configurationId !== id);
    this.saveToStorage();
    return true;
  }

  /**
   * Duplicate a configuration's ordered card stack into a disabled draft.
   * A clone must be explicitly enabled before it can affect the formal board.
   */
  duplicateBox(id: string): ConfigurationBox | null {
    const original = this.boxes.find((box) => box.id === id);
    if (!original) return null;

    const existingInternalNames = new Set(this.boxes.map((box) => box.internalName));
    const existingDisplayNames = new Set(this.boxes.map((box) => box.displayName));
    const createUniqueName = (base: string, existing: Set<string>) => {
      let candidate = base;
      let suffix = 2;
      while (existing.has(candidate)) {
        candidate = `${base} ${suffix}`;
        suffix += 1;
      }
      return candidate;
    };

    const copiedInternalName = createUniqueName(`${original.internalName}_copy`, existingInternalNames);
    const copiedDisplayName = createUniqueName(`${original.displayName} 副本`, existingDisplayNames);
    const duplicate = this.createBox(
      copiedInternalName,
      copiedDisplayName,
      original.note,
      false,
      original.identity,
    );
    const today = new Date().toISOString().split('T')[0];
    const copiedLinks = this.getLinkedCardStack(original.id).map(({ link }) => ({
      ...link,
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      configurationId: duplicate.id,
      createdAt: today,
      updatedAt: today,
    }));

    this.links = normalizeLinkPriorities([...this.links, ...copiedLinks]);
    this.saveToStorage();
    return duplicate;
  }

  // --- Linking & Unlinking ---
  /**
   * Insert a verified card into a configuration stack. `insertAt = 0` means
   * the new card is visually on top and wins any metric collision.
   */
  linkCardToBox(configurationId: string, cardId: string, insertAt: number = 0): ConfigurationSourceLink | null {
    if (!this.boxes.some((box) => box.id === configurationId)) return null;
    const card = this.cards.find((item) => item.id === cardId);
    if (!isTrustedCard(card)) return null;
    const existingLink = this.links.find(
      (link) => link.configurationId === configurationId && link.sourceModelCardId === card.id,
    );
    if (existingLink) {
      // Re-dropping an existing card is an intentional "bring to top" action,
      // not a duplicate data source.
      this.moveLink(existingLink.id, insertAt);
      return this.links.find((link) => link.id === existingLink.id) || null;
    }
    const candidateScope = cardScope(card);
    const existingLinkedCards = this.links
      .filter((link) => link.configurationId === configurationId)
      .map((link) => this.cards.find((item) => item.id === link.sourceModelCardId))
      .filter((item): item is SourceCardWithProvenance => isTrustedCard(item));
    if (existingLinkedCards.some((existingCard) => !scopesDescribeSameProduct(cardScope(existingCard), candidateScope))) {
      return null;
    }

    const currentStackLength = this.getLinkedCardStack(configurationId).length;
    const requestedPosition = Number.isFinite(insertAt) ? Math.trunc(insertAt) : 0;
    const priority = Math.max(0, Math.min(requestedPosition, currentStackLength));
    const today = new Date().toISOString().split('T')[0];

    const newLink: ConfigurationSourceLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      configurationId,
      source: card.source,
      sourceModelCardId: card.id,
      priority,
      createdAt: today,
      updatedAt: today,
    };

    this.links = normalizeLinkPriorities([
      ...this.links.map((link) => (
        link.configurationId === configurationId && link.priority >= priority
          ? { ...link, priority: link.priority + 1, updatedAt: today }
          : link
      )),
      newLink,
    ]);
    this.saveToStorage();
    return newLink;
  }

  /** Move one card within its configuration stack (0 = top/highest priority). */
  moveLink(linkId: string, targetPriority: number): boolean {
    const link = this.links.find((item) => item.id === linkId);
    if (!link) return false;

    const stack = this.getLinkedCardStack(link.configurationId);
    const currentIndex = stack.findIndex((item) => item.link.id === linkId);
    if (currentIndex === -1) return false;
    const requestedPosition = Number.isFinite(targetPriority) ? Math.trunc(targetPriority) : currentIndex;
    const destinationIndex = Math.max(0, Math.min(requestedPosition, stack.length - 1));
    if (currentIndex === destinationIndex) return true;

    const reordered = [...stack];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(destinationIndex, 0, moved);
    const today = new Date().toISOString().split('T')[0];
    const priorityByLinkId = new Map(reordered.map(({ link: stackLink }, priority) => [stackLink.id, priority]));
    this.links = this.links.map((item) => {
      const priority = priorityByLinkId.get(item.id);
      return priority === undefined ? item : { ...item, priority, updatedAt: today };
    });
    this.saveToStorage();
    return true;
  }

  /** Remove a single card, then compact the remaining stack priorities. */
  unlinkLink(linkId: string): boolean {
    const link = this.links.find((item) => item.id === linkId);
    if (!link) return false;
    this.links = normalizeLinkPriorities(this.links.filter((item) => item.id !== linkId));
    this.saveToStorage();
    return true;
  }

  /**
   * Legacy source-slot removal remains available for callers that explicitly
   * intend to remove every card from a source. New UI uses unlinkLink.
   */
  unlinkCardFromBox(configurationId: string, source: SourceType): boolean {
    const initialLength = this.links.length;
    this.links = normalizeLinkPriorities(this.links.filter(
      (link) => !(link.configurationId === configurationId && link.source === source),
    ));
    this.saveToStorage();
    return this.links.length < initialLength;
  }

  /** Ordered top-to-bottom stack; lower priority values are returned first. */
  getLinkedCardStack(configurationId: string, source?: SourceType): LinkedCardStackEntry[] {
    const box = this.boxes.find((item) => item.id === configurationId);
    if (!box) return [];
    return this.links
      .filter((link) => link.configurationId === configurationId && (!source || link.source === source))
      .map((link) => {
        const card = this.cards.find((item) => item.id === link.sourceModelCardId);
        const provenance = parseSourceLinkProvenance(link.provenance);
        if (
          !isTrustedCard(card)
          || card.source !== link.source
          || !provenance
          || (
            provenance.kind !== 'exact'
            && !fallbackIsAuthorizedForBox(box, card, provenance)
          )
        ) return null;
        return { link, card };
      })
      .filter((entry): entry is LinkedCardStackEntry => entry !== null)
      .sort((left, right) => left.link.priority - right.link.priority || left.link.id.localeCompare(right.link.id));
  }

  getLinkedCards(configurationId: string, source?: SourceType): SourceModelCard[] {
    return this.getLinkedCardStack(configurationId, source).map(({ card }) => card);
  }

  /** Backward-compatible read of the top card for a source. */
  getLinkedCard(configurationId: string, source: SourceType): SourceModelCard | null {
    return this.getLinkedCardStack(configurationId, source)[0]?.card || null;
  }

  getCardUsageCount(cardId: string): number {
    return this.links.filter((link) => link.sourceModelCardId === cardId).length;
  }

  getCardObservations(cardId: string): SourceObservation[] {
    const card = this.cards.find((item) => item.id === cardId);
    if (!isTrustedCard(card)) return [];

    const metricIds = new Set<string>();
    return this.observations.filter((observation) => {
      if (!isVerifiedObservation(observation, card)) return false;
      if (metricIds.has(observation.metricId)) return false;
      metricIds.add(observation.metricId);
      return true;
    });
  }

  // --- Scoring & Aggregation Pipeline Integration ---
  buildLLMConfiguration(box: ConfigurationBox): LLMConfiguration {
    const aaCard = this.getLinkedCard(box.id, 'artificial_analysis');
    const arenaCard = this.getLinkedCard(box.id, 'arena');
    const openRouterCard = this.getLinkedCard(box.id, 'openrouter');
    const linkedStack = this.getLinkedCardStack(box.id);
    const configurationIdentity = sanitizeConfigurationIdentity(box.identity);
    const builtInPresetId = sanitizeBuiltInPresetId(box.builtInPresetId);
    const builtInPreset = builtInPresetId
      ? BUILT_IN_CONFIGURATION_PRESETS.find((preset) => preset.id === builtInPresetId)
      : undefined;
    const isUnchangedBuiltInPreset = Boolean(
      builtInPreset
      && sameConfigurationIdentity(
        configurationIdentity,
        sanitizeConfigurationIdentity(builtInPreset.identity),
      ),
    );
    const subscriptionData = (
      builtInPreset?.access === 'subscription'
      && isUnchangedBuiltInPreset
    )
      ? sanitizeSubscriptionCostData(builtInPreset.subscriptionData)
      : undefined;
    const apiPricingData = (
      builtInPreset?.access === 'api'
      && isUnchangedBuiltInPreset
      && builtInPreset.apiPricingData
      && Number.isFinite(builtInPreset.apiPricingData.inputPricePerMToken)
      && builtInPreset.apiPricingData.inputPricePerMToken >= 0
      && Number.isFinite(builtInPreset.apiPricingData.outputPricePerMToken)
      && builtInPreset.apiPricingData.outputPricePerMToken >= 0
    )
      ? builtInPreset.apiPricingData
      : undefined;
    const promotionalPricing = (
      builtInPreset
      && isUnchangedBuiltInPreset
      && (builtInPreset.access === 'api' || builtInPreset.access === 'subscription')
    )
      ? getOpenRouterPromotionalPricing(builtInPreset.productLineId)
      : undefined;
    const observationsMap: Record<string, MetricObservation> = {};

    // The stack is already top-to-bottom. The first verified observation for
    // a metric wins; lower cards can fill a missing metric but cannot silently
    // overwrite a card the operator intentionally placed above them.
    linkedStack
      .filter(({ card }) => card.source === 'artificial_analysis' || card.source === 'arena')
      .forEach(({ link, card }) => {
        const provenance = parseSourceLinkProvenance(link.provenance);
        if (!provenance) return;
        this.getCardObservations(card.id).forEach((observation) => {
          if (observationsMap[observation.metricId]) return;
          if (
            isHarnessOnlyCapabilityMetric(observation.metricId)
            && !isCapabilityMetricCompatibleWithSourceLink(
              observation.metricId,
              configurationIdentity?.harness?.name,
              provenance,
            )
          ) return;
          observationsMap[observation.metricId] = {
            metricId: observation.metricId,
            rawValue: observation.rawValue,
            confidenceLow: observation.confidenceLow,
            confidenceHigh: observation.confidenceHigh,
            confidenceRadius: getEmbeddedConfidenceRadius(observation),
            testDate: observation.snapshotDate,
            harness: configurationIdentity?.harness?.name,
          };
        });
      });

    // OpenRouter is preferred for provider-neutral price and performance.
    // An unchanged built-in route may replace only its price with either an
    // official direct-provider API tier or a current OpenRouter promotion;
    // same-model latency/throughput evidence remains independently sourced.
    // When the exact model is absent there, the same model's Artificial
    // Analysis price and median performance fill only the missing practical
    // slots. Capability observations remain unaffected.
    const openRouterByMetric = new Map<string, SourceObservation>();
    linkedStack
      .filter(({ card }) => card.source === 'openrouter')
      .forEach(({ card }) => {
        this.getCardObservations(card.id).forEach((observation) => {
          if (!openRouterByMetric.has(observation.metricId)) {
            openRouterByMetric.set(observation.metricId, observation);
          }
        });
      });
    const artificialAnalysisPracticalByMetric = new Map<string, SourceObservation>();
    linkedStack
      .filter(({ card }) => card.source === 'artificial_analysis')
      .forEach(({ card }) => {
        this.getCardObservations(card.id).forEach((observation) => {
          if (!artificialAnalysisPracticalByMetric.has(observation.metricId)) {
            artificialAnalysisPracticalByMetric.set(observation.metricId, observation);
          }
        });
      });
    const inputPriceObservation = openRouterByMetric.get('or_price_input')
      ?? artificialAnalysisPracticalByMetric.get('aa_price_input');
    const outputPriceObservation = openRouterByMetric.get('or_price_output')
      ?? artificialAnalysisPracticalByMetric.get('aa_price_output');
    const latencyObservation = openRouterByMetric.get('or_ttft_p50')
      ?? artificialAnalysisPracticalByMetric.get('aa_ttft_median');
    const throughputObservation = openRouterByMetric.get('or_throughput_p50')
      ?? artificialAnalysisPracticalByMetric.get('aa_throughput_median');
    const inputPrice = apiPricingData?.inputPricePerMToken
      ?? promotionalPricing?.effectiveInputPricePerMToken
      ?? inputPriceObservation?.rawValue;
    const outputPrice = apiPricingData?.outputPricePerMToken
      ?? promotionalPricing?.effectiveOutputPricePerMToken
      ?? outputPriceObservation?.rawValue;
    const latencySeconds = secondsFromLatencyObservation(latencyObservation);
    const throughput = throughputObservation?.rawValue;
    const hasVerifiedPracticalData =
      typeof inputPrice === 'number' && Number.isFinite(inputPrice) && inputPrice >= 0 &&
      typeof outputPrice === 'number' && Number.isFinite(outputPrice) && outputPrice >= 0 &&
      typeof latencySeconds === 'number' && Number.isFinite(latencySeconds) && latencySeconds > 0 &&
      typeof throughput === 'number' && Number.isFinite(throughput) && throughput > 0;

    const openRouterData = hasVerifiedPracticalData
      ? {
          inputPricePerMToken: inputPrice,
          outputPricePerMToken: outputPrice,
          ...(typeof apiPricingData?.cacheReadPricePerMToken === 'number'
            ? { cacheReadPricePerMToken: apiPricingData.cacheReadPricePerMToken }
            : {}),
          ttftP50Seconds: latencySeconds,
          throughputP50TokensPerSec: throughput,
        }
      : undefined;

    const derivedProviderName = aaCard
      ? aaCard.exactSourceModelName.split(' ')[0]
      : arenaCard
        ? arenaCard.exactSourceModelName.split('-')[0].toUpperCase()
        : 'Custom';
    const modelVersion = [
      configurationIdentity?.model?.profile,
      configurationIdentity?.model?.preset,
    ].filter((value): value is string => Boolean(value && value.trim())).join(' · ') || box.updatedAt;
    const configuredHarness = [
      configurationIdentity?.harness?.name,
      configurationIdentity?.harness?.environment,
    ].filter((value): value is string => Boolean(value && value.trim())).join(' · ');
    const configuredProviderName = configurationIdentity?.provider?.name || derivedProviderName;
    const providerEndpoint = configurationIdentity?.provider?.upstream
      || (openRouterCard ? openRouterCard.exactSourceModelName : undefined);
    const usesOpenRouter = [configuredProviderName, providerEndpoint]
      .some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes('openrouter'))
    const configName = box.displayName;
    const displayProviderLabel = configName.split(' | ')[2]?.trim();
    const readerFacingProvider = displayProviderLabel?.endsWith(' API')
      ? displayProviderLabel.replace(/\s+API$/u, '')
      : configuredProviderName;

    return {
      id: box.id,
      name: configName,
      provider: readerFacingProvider,
      ...(subscriptionData || apiPricingData
        ? { capabilityReferenceIncluded: false }
        : {}),
      tags: [box.internalName, box.enabled ? '已启用入榜' : '未启用'],
      identity: {
        modelName: configurationIdentity?.model?.name || box.displayName,
        modelVersion,
        reasoningEffort: reasoningEffortForProfile(configurationIdentity?.model?.profile),
        contextWindowTokens: 128000,
      },
      execution: {
        harness: configuredHarness || '正常对话',
        toolPermissions: ['Web Search', 'Code Execution'],
      },
      access: {
        entryPoint: subscriptionData
          ? subscriptionData.planName.startsWith('ChatGPT')
            ? 'ChatGPT Subscription'
            : subscriptionData.planName.startsWith('Claude')
              ? 'Claude Subscription'
              : subscriptionData.planName.startsWith('Google')
                ? 'Google Subscription'
                : 'xAI Subscription'
          : usesOpenRouter
            ? 'OpenRouter API'
            : 'Direct Provider API',
        providerEndpoint,
      },
      ...(openRouterData ? { openRouterData } : {}),
      ...(subscriptionData ? { subscriptionData } : {}),
      observations: observationsMap,
    };
  }

  computeLeaderboardScores(): ProcessedConfigurationScore[] {
    // The leaderboard view deliberately shows every configuration, including
    // disabled or data-insufficient ones, so absence of coverage is visible
    // as “数据不足” instead of becoming an invisible default exclusion.
    const configsToScore = this.boxes.map((box) => this.buildLLMConfiguration(box));
    return processLLMpkBatchScoring(configsToScore);
  }
}

export const adminMappingStore = new AdminMappingStore();
