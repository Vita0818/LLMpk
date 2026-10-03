export type SourceType =
  | 'artificial_analysis'
  | 'arena'
  | 'openrouter'
  | 'scale_labs'
  | 'terminal_bench'
  | 'swe_rebench'
  | 'frontier_code'
  | 'design_arena';

/**
 * How a shipped configuration is reached. API and explicit subscription
 * configurations may carry an authored lower-profile or Chat-to-harness
 * fallback; a manually relabelled route never gains that authorization.
 */
export type ConfigurationAccess = 'api' | 'subscription' | 'managed-service' | 'inferred';

/**
 * Human-readable identity for one configuration. These fields describe the
 * way a model was run; source cards remain the only place observations and
 * scores can come from.
 */
export interface ConfigurationModelIdentity {
  /** Model name as selected by the operator, including a distinct product. */
  name?: string;
  /** Reasoning/effort tier, such as `high`, `max`, or `Pro`. */
  profile?: string;
  /** A named product or client preset, when one was selected. */
  preset?: string;
}

/** Harness or client context used to run the model. */
export interface ConfigurationHarnessIdentity {
  /** `正常对话` when no specialised harness was specified. */
  name?: string;
  /** Optional client, IDE, region, or runtime environment detail. */
  environment?: string;
}

/** Provider and upstream API route used to serve the configuration. */
export interface ConfigurationProviderIdentity {
  /** The actual serving party or API route, such as Anthropic or Google Vertex AI. */
  name?: string;
  /** Upstream API or routing detail, such as `Anthropic API`. */
  upstream?: string;
}

/** The three independently editable parts of a configuration identity. */
export interface ConfigurationIdentity {
  model?: ConfigurationModelIdentity;
  harness?: ConfigurationHarnessIdentity;
  provider?: ConfigurationProviderIdentity;
}

export interface ConfigurationBox {
  id: string;
  internalName: string; // Unique internal identifier
  displayName: string;  // Front-end display title
  note?: string;        // Optional notes
  /** Optional structured model / harness / provider description. */
  identity?: ConfigurationIdentity;
  /** Stable ID for a shipped preset; absent for user-created configurations. */
  builtInPresetId?: string;
  /** Operator state; data-insufficient configurations remain visible either way. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastCalculatedAt?: string;
}

export interface SourceModelCard {
  id: string;
  source: SourceType;
  exactSourceModelName: string; // Unmodified exact model name from source platform
  latestSnapshotDate: string;   // e.g. "2026-07-27"
  metadataJson?: Record<string, any>;
}

export interface SourceObservation {
  id: string;
  sourceModelCardId: string;
  metricId: string;           // Refers to a registered atomic metric or OpenRouter price/speed ID
  rawValue: number | null;
  unit: string;
  confidenceLow?: number;
  confidenceHigh?: number;
  snapshotDate: string;
  sourceUrl?: string;
  /** Published leaderboard or catalog that supplied the observation. */
  sourceLeaderboard?: string;
  metadataJson?: Record<string, any>;
}

/** A card is an exact match for the configuration's declared model profile. */
export interface ExactSourceCardProvenance {
  kind: 'exact';
}

/**
 * An explicit, one-way use of a lower model profile to fill a higher target
 * profile.  The numeric levels are authored evidence of the ordering; code
 * must never infer it from profile names such as "High" or "Max".
 */
export interface LowerProfileFallbackProvenance {
  kind: 'lower_profile_fallback';
  sourceProfile: string;
  sourceLevel: number;
  targetProfile: string;
  targetLevel: number;
}

/**
 * An explicit one-way use of the same model/profile from a lower execution
 * environment to fill a higher one. The authored ladder currently supports
 * Chat (0) -> Agent/harness and Arena Agent Mode (1) -> a named production
 * harness (2). This provenance never authorizes the reverse direction.
 */
export interface LowerHarnessFallbackProvenance {
  kind: 'lower_harness_fallback';
  sourceHarness: string;
  sourceLevel: number;
  targetHarness: string;
  targetLevel: number;
  sourceProfile: string;
  targetProfile: string;
}

/**
 * An explicit one-way fallback that rises on both independent axes at once:
 * from a lower model profile and lower execution environment to a higher
 * profile running in a higher harness. Neither axis may be reversed.
 */
export interface LowerProfileHarnessFallbackProvenance {
  kind: 'lower_profile_harness_fallback';
  sourceProfile: string;
  sourceProfileLevel: number;
  targetProfile: string;
  targetProfileLevel: number;
  sourceHarness: string;
  sourceHarnessLevel: number;
  targetHarness: string;
  targetHarnessLevel: number;
}

export type ConfigurationSourceLinkProvenance =
  | ExactSourceCardProvenance
  | LowerProfileFallbackProvenance
  | LowerHarnessFallbackProvenance
  | LowerProfileHarnessFallbackProvenance;

export interface ConfigurationSourceLink {
  id: string;
  configurationId: string;
  source: SourceType;
  sourceModelCardId: string;
  /**
   * Omitted legacy links are exact. A lower-profile or Chat-to-harness
   * fallback is accepted only when a bundled API preset explicitly
   * authorizes this exact card and declares the one-way ordering.
   */
  provenance?: ConfigurationSourceLinkProvenance;
  /**
   * Stack position inside a configuration. Lower values are visually higher
   * and take precedence for a duplicate metric (0 is the top card).
   */
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/** A verified source card together with its ordered configuration link. */
export interface LinkedCardStackEntry {
  link: ConfigurationSourceLink;
  card: SourceModelCard;
}

/**
 * The portable identity of a verified source card. Card IDs are intentionally
 * excluded: a catalog refresh can change them, whereas this tuple is enough
 * to reconcile an import without ever carrying observations or scores.
 */
export interface ConfigurationBackupCardScope {
  scopeId: string;
  scopeVersion: string;
  vendorId: string;
  productLineId: string;
  rankingClass: 'formal_text_agent' | 'specialized_catalog_only';
}

export interface ConfigurationBackupCardReference {
  source: SourceType;
  exactSourceModelName: string;
  /** Present when the upstream card exposes a stable verified record ID. */
  sourceRecordId?: string;
  scope: ConfigurationBackupCardScope;
}

/** One ordered source-card entry in a portable configuration backup. */
export interface ConfigurationBackupLink {
  /** 0 is the top card and wins a duplicate metric. */
  priority: number;
  card: ConfigurationBackupCardReference;
  /** Preserves an auditable one-way fallback when one is authorized. */
  provenance?: ConfigurationSourceLinkProvenance;
}

/**
 * Deliberately excludes local IDs, timestamps, observations, and scores.
 * Imported copies receive fresh local IDs/timestamps and are always disabled.
 */
export interface ConfigurationBackupBox {
  internalName: string;
  displayName: string;
  note?: string;
  /** Optional portable identity metadata; never contains observations. */
  identity?: ConfigurationIdentity;
  /** Preserved so a restored shipped preset can be installed idempotently. */
  builtInPresetId?: string;
  enabled: boolean;
  links: ConfigurationBackupLink[];
}

export interface ConfigurationBackup {
  format: 'llmpk.configuration-backup';
  schemaVersion: 1;
  exportedAt: string;
  boxes: ConfigurationBackupBox[];
}

/** Outcome of a non-destructive configuration backup import. */
export interface ConfigurationBackupImportReport {
  accepted: boolean;
  /** Valid backup boxes copied into this browser as disabled drafts. */
  importedBoxCount: number;
  /** Resolved card links copied into those draft boxes. */
  importedLinkCount: number;
  /** Valid card identities that did not resolve uniquely in this catalog. */
  unresolvedLinkCount: number;
  /** Invalid box records (or a wholly invalid backup document). */
  rejectedBoxCount: number;
  /** Invalid card-link records; no local link is created for these. */
  rejectedLinkCount: number;
}

/**
 * Outcome of adding the versioned configuration inventory to this browser.
 * Existing boxes keep their identity, enabled state, and manual stack edits.
 * A later inventory may append a previously missing explicit source card
 * below that stack, but never remove, alter, or reorder user links.
 */
export interface BuiltInConfigurationPresetInstallReport {
  /** Number of records considered from the bundled inventory. */
  presetCount: number;
  /** Obsolete/replaced built-in boxes removed during a versioned inventory sync. */
  removedBuiltInBoxCount: number;
  /**
   * Confirmed legacy boxes removed because their exact model was retired from
   * the compact leaderboard and none of their linked cards had capability
   * observations. Partially populated or unrelated user boxes are preserved.
   */
  removedRetiredLegacyBoxCount: number;
  /** Newly-created, enabled and visible configuration boxes. */
  installedBoxCount: number;
  /** Preset IDs already represented by an existing box and left unchanged. */
  existingPresetCount: number;
  /** Explicit source-card IDs that resolved and passed the product-line guard. */
  linkedCardCount: number;
  /** Of linked cards, the count explicitly marked as lower-profile fallbacks. */
  linkedLowerProfileFallbackCardCount: number;
  /** Of linked cards, the count explicitly marked as Chat-to-harness fallbacks. */
  linkedLowerHarnessFallbackCardCount: number;
  /** Of linked cards, the count rising across both profile and harness axes. */
  linkedLowerProfileHarnessFallbackCardCount: number;
  /** Explicit source-card IDs that are absent from the verified current catalog. */
  unresolvedSourceCardCount: number;
  /** Explicit source-card IDs rejected because they do not match the preset product line. */
  mismatchedSourceCardCount: number;
  /** Malformed inventory records skipped without changing user data. */
  invalidPresetCount: number;
}

export interface DraggedItemPayload {
  cardId: string;
  source: SourceType;
  exactSourceModelName: string;
}
