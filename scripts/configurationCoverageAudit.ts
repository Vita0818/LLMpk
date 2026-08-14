import type { ProcessedConfigurationScore } from '../src/types/llm_pk';
import {
  isCapabilityMetricCompatibleWithSourceLink,
  isHarnessOnlyCapabilityMetric,
  isPlainChatHarness,
} from '../src/data/executionMetricPolicy';

/** Minimal browser Storage implementation for a deterministic catalog audit. */
class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.values.set(String(key), String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

const { AdminMappingStore } = await import('../src/store/adminMappingStore');
const { ALL_METRIC_DEFINITIONS } = await import('../src/engine/scoringEngine');
const {
  ALL_CONFIGURATION_PRESET_CANDIDATES,
  BUILT_IN_CONFIGURATION_PRESETS,
  BUILT_IN_CONFIGURATION_CURATION_ROWS,
  BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS,
  BUILT_IN_CONFIGURATION_MAX_PER_MODEL,
  BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT,
  BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS,
  BUILT_IN_CONFIGURATION_RELEASE_CUTOFF,
  REVIEWED_EQUIVALENT_CARD_ATTACHMENT_COUNT,
  SOURCE_CATALOG_CONFIGURATION_PRESET_COUNT,
  buildPresetCoverageProfiles,
} = await import('../src/data/builtInConfigurationPresets');

type Summary = {
  configurations: number;
  linkedConfigurations: number;
  zeroAvailableDomains: number;
  atLeastOneAvailableDomain: number;
  atLeastFourAvailableDomains: number;
  capabilityScoreAvailable: number;
  practicalScoreAvailable: number;
  leaderboardEligible: number;
  fullyOfficialCoverage: number;
};

const summarize = (items: ProcessedConfigurationScore[], linkedBoxIds: Set<string>): Summary => ({
  configurations: items.length,
  linkedConfigurations: items.filter((item) => linkedBoxIds.has(item.config.id)).length,
  zeroAvailableDomains: items.filter((item) => item.availableDomainCount === 0).length,
  atLeastOneAvailableDomain: items.filter((item) => item.availableDomainCount >= 1).length,
  atLeastFourAvailableDomains: items.filter((item) => item.availableDomainCount >= 4).length,
  capabilityScoreAvailable: items.filter((item) => item.rawCapabilityScore !== null).length,
  practicalScoreAvailable: items.filter((item) => item.practicalBreakdown.practicalScore !== null).length,
  leaderboardEligible: items.filter((item) => item.eligibleForGlobalLeaderboard).length,
  fullyOfficialCoverage: items.filter((item) => item.coverageStatus === 'official').length,
});

const store = new AdminMappingStore();
const install = store.installBuiltInConfigurationPresets();
const scores = store.computeLeaderboardScores();
const linkedBoxIds = new Set(store.links.map((link) => link.configurationId));
const linkedSourceCardIds = new Set(store.links.map((link) => link.sourceModelCardId));
const canonicalProfiles = new Set(store.cards.map((card) => {
  const scope = card.metadataJson?.scope;
  return `${scope?.scopeId || 'unknown'}:${scope?.vendorId || 'unknown'}:${scope?.productLineId || 'unknown'}:${scope?.canonicalProfileKey || card.id}`;
}));
const productLines = new Set(store.cards.map((card) => {
  const scope = card.metadataJson?.scope;
  return `${scope?.scopeId || 'unknown'}:${scope?.vendorId || 'unknown'}:${scope?.productLineId || card.id}`;
}));
const openRouterStandardPerformanceCards = store.cards.filter(
  (card) => card.metadataJson?.sourceIdentity?.kind === 'openrouter_standard_performance',
);
const metricIdsByCardId = store.observations.reduce<Map<string, Set<string>>>((result, observation) => {
  const metricIds = result.get(observation.sourceModelCardId) || new Set<string>();
  metricIds.add(observation.metricId);
  result.set(observation.sourceModelCardId, metricIds);
  return result;
}, new Map());
const boxesById = new Map(store.boxes.map((box) => [box.id, box]));
const presetsById = new Map(BUILT_IN_CONFIGURATION_PRESETS.map((preset) => [preset.id, preset]));
const availableCardIds = new Set(store.cards.map((card) => card.id));
const unresolvedPresetCards = BUILT_IN_CONFIGURATION_PRESETS.flatMap((preset) => ([
  ...(preset.sourceCardIds || []),
  ...(preset.sourceCardLinks || []).map((link) => link.cardId),
]).filter((cardId) => !availableCardIds.has(cardId)).map((cardId) => ({
  presetId: preset.id,
  cardId,
})));
const curationByPresetId = new Map(
  BUILT_IN_CONFIGURATION_CURATION_ROWS.map((row) => [row.presetId, row]),
);
const apiScores = scores.filter((score) => {
  const box = boxesById.get(score.config.id);
  return box?.builtInPresetId ? presetsById.get(box.builtInPresetId)?.access === 'api' : false;
});

const profileRows = scores
  .map((score) => {
    const box = boxesById.get(score.config.id);
    const preset = box?.builtInPresetId ? presetsById.get(box.builtInPresetId) : undefined;
    const curation = box?.builtInPresetId
      ? curationByPresetId.get(box.builtInPresetId)
      : undefined;
    const linkedStack = store.getLinkedCardStack(score.config.id);
    const openRouterCreatedDates = linkedStack.flatMap(({ card }) => {
      const created = card.metadataJson?.sourceIdentity?.createdUnixSeconds;
      return typeof created === 'number' && Number.isFinite(created)
        ? [new Date(created * 1000).toISOString().slice(0, 10)]
        : [];
    });
    const sourceRecordIds = linkedStack.flatMap(({ card }) => {
      const sourceRecordId = card.metadataJson?.sourceIdentity?.sourceRecordId;
      return typeof sourceRecordId === 'string' ? [sourceRecordId] : [];
    });
    const sourceVendors = linkedStack.flatMap(({ card }) => {
      const vendorName = card.metadataJson?.scope?.vendorName;
      return typeof vendorName === 'string' ? [vendorName] : [];
    });
    const linkedCardIds = new Set(linkedStack.map(({ card }) => card.id));
    const compatibleHarnessMetricIds = new Set(linkedStack.flatMap(({ link, card }) => (
      [...(metricIdsByCardId.get(card.id) || [])].filter((metricId) => (
        isHarnessOnlyCapabilityMetric(metricId)
        && isCapabilityMetricCompatibleWithSourceLink(
          metricId,
          preset?.identity.harness.name,
          link.provenance,
        )
      ))
    )));
    const unlinkedProductLineCards = preset
      ? store.cards
        .filter((card) => (
          card.metadataJson?.scope?.productLineId === preset.productLineId
          && !linkedCardIds.has(card.id)
        ))
        .map((card) => ({
          cardId: card.id,
          source: card.source,
          exactSourceModelName: card.exactSourceModelName,
          canonicalProfileKey: card.metadataJson?.scope?.canonicalProfileKey,
          metricIds: [...(metricIdsByCardId.get(card.id) || [])].sort(),
        }))
      : [];
    return {
      presetId: box?.builtInPresetId,
      origin: preset?.origin,
      access: preset?.access,
      productLineId: preset?.productLineId,
      modelGroupKey: curation?.modelGroupKey,
      vendorKey: curation?.vendorKey,
      releaseDate: curation?.releaseDate,
      releaseEvidence: curation?.releaseEvidence,
      keyVendor: curation?.keyVendor,
      explicitlyPinned: curation?.explicitlyPinned,
      effectiveDataSignature: curation?.effectiveDataSignature,
      modelName: preset?.identity.model.name,
      profile: preset?.identity.model.profile,
      harness: preset?.identity.harness.name,
      provider: preset?.identity.provider.name,
      configuration: score.config.name,
      availableDomains: score.availableDomainCount,
      missingDomains: Object.values(score.domainScores)
        .filter((domain) => domain.coverage <= Number.EPSILON)
        .map((domain) => domain.domainId),
      capabilityScoreAvailable: score.rawCapabilityScore !== null,
      practicalScoreAvailable: score.practicalBreakdown.practicalScore !== null,
      leaderboardEligible: score.eligibleForGlobalLeaderboard,
      coverageStatus: score.coverageStatus,
      harnessOnlyMetricIds: Object.keys(score.config.observations)
        .filter(isHarnessOnlyCapabilityMetric)
        .sort(),
      incompatibleHarnessMetricIds: Object.keys(score.config.observations)
        .filter(isHarnessOnlyCapabilityMetric)
        .filter((metricId) => !compatibleHarnessMetricIds.has(metricId))
        .sort(),
      domainCoverage: Object.values(score.domainScores).map((domain) => ({
        domainId: domain.domainId,
        scoreAvailable: domain.score !== null,
        observedDataAvailable: domain.coverage > Number.EPSILON,
        coverage: Number(domain.coverage.toFixed(3)),
        coverageStatus: domain.coverageStatus,
      })),
      linkedCards: linkedStack.length,
      linkedCardIds: linkedStack.map(({ card }) => card.id),
      unlinkedProductLineCards,
      sourceRecordIds: [...new Set(sourceRecordIds)],
      sourceVendors: [...new Set(sourceVendors)],
      openRouterCreatedDates: [...new Set(openRouterCreatedDates)].sort(),
    };
  })
  .sort((left, right) => (
    left.availableDomains - right.availableDomains
    || left.configuration.localeCompare(right.configuration, 'zh-CN')
  ));

const includeDetails = process.argv.includes('--details');
const onlyMissingPractical = process.argv.includes('--missing-practical');
const dataInsufficientRows = profileRows.filter((row) => !row.capabilityScoreAvailable);
const missingProductLineIds = new Set(
  profileRows
    .filter((row) => row.missingDomains.length > 0)
    .flatMap((row) => row.productLineId ? [row.productLineId] : []),
);
const candidateCoverageByPresetId = buildPresetCoverageProfiles(
  ALL_CONFIGURATION_PRESET_CANDIDATES,
);
const missingProductLineAlternatives = ALL_CONFIGURATION_PRESET_CANDIDATES
  .filter((preset) => missingProductLineIds.has(preset.productLineId))
  .map((preset) => {
    const coverage = candidateCoverageByPresetId.get(preset.id);
    return {
      presetId: preset.id,
      productLineId: preset.productLineId,
      profile: preset.identity.model.profile,
      harness: preset.identity.harness.name,
      availableDomainCount: coverage?.availableDomainCount ?? 0,
      availableDomainIds: coverage?.availableDomainIds ?? [],
      availableMetricIds: coverage?.availableMetricIds ?? [],
      compatibleHarnessMetricCount: coverage?.compatibleHarnessMetricCount ?? 0,
      exactHarnessMetricCount: coverage?.exactHarnessMetricCount ?? 0,
      scoringMetricCount: coverage?.scoringMetricCount ?? 0,
      sourceCardIds: preset.sourceCardIds || [],
      sourceCardLinks: preset.sourceCardLinks || [],
      linkedCardIds: [
        ...(preset.sourceCardIds || []),
        ...(preset.sourceCardLinks || []).map((link) => link.cardId),
      ],
      cardMetricIds: Object.fromEntries([
        ...(preset.sourceCardIds || []),
        ...(preset.sourceCardLinks || []).map((link) => link.cardId),
      ].map((cardId) => [
        cardId,
        [...(metricIdsByCardId.get(cardId) || [])].sort(),
      ])),
    };
  })
  .sort((left, right) => (
    left.productLineId.localeCompare(right.productLineId, 'en-US')
    || right.availableDomainCount - left.availableDomainCount
    || right.exactHarnessMetricCount - left.exactHarnessMetricCount
    || left.presetId.localeCompare(right.presetId, 'en-US')
  ));
const chatHarnessMetricLeaks = profileRows.filter((row) => (
  isPlainChatHarness(row.harness)
  && row.harnessOnlyMetricIds.length > 0
));
const incompatibleHarnessMetricLeaks = profileRows.filter(
  (row) => row.incompatibleHarnessMetricIds.length > 0,
);
const executionModeCounts = profileRows.reduce<Record<string, number>>((counts, row) => {
  const key = row.harness || 'Unknown';
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const modelSignatureCounts = profileRows.reduce<Map<string, number>>((counts, row) => {
  if (!row.modelGroupKey || !row.effectiveDataSignature) return counts;
  const key = `${row.modelGroupKey}\u0000${row.effectiveDataSignature}`;
  counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}, new Map());
const duplicateEffectiveDataRows = profileRows.filter((row) => (
  Boolean(row.modelGroupKey)
  && Boolean(row.effectiveDataSignature)
  && (modelSignatureCounts.get(
    `${row.modelGroupKey}\u0000${row.effectiveDataSignature}`,
  ) || 0) > 1
));
const nonKeyModelGroupsByVendor = BUILT_IN_CONFIGURATION_CURATION_ROWS
  .filter((row) => !row.keyVendor)
  .reduce<Map<string, Set<string>>>((groups, row) => {
    const vendorGroups = groups.get(row.vendorKey) || new Set<string>();
    vendorGroups.add(row.modelGroupKey);
    groups.set(row.vendorKey, vendorGroups);
    return groups;
  }, new Map());
const nonKeyVendorsWithMultipleModels = [...nonKeyModelGroupsByVendor.entries()]
  .filter(([, groups]) => groups.size > 1)
  .map(([vendorKey, groups]) => ({
    vendorKey,
    modelGroupCount: groups.size,
    modelGroupKeys: [...groups].sort(),
  }));
const domainCoverageDistribution = [4, 5, 6].reduce<Record<string, number>>((result, count) => {
  result[String(count)] = scores.filter((score) => score.availableDomainCount === count).length;
  return result;
}, {});
const metricCoverage = ALL_METRIC_DEFINITIONS.map((metric) => {
  const observedConfigurations = scores.filter((score) => {
    const observation = score.config.observations[metric.id];
    return observation?.rawValue !== null && Number.isFinite(observation?.rawValue);
  }).length;
  return {
    metricId: metric.id,
    domainId: metric.domain,
    observedConfigurations,
    configurationCount: scores.length,
    coverage: scores.length > 0
      ? Number((observedConfigurations / scores.length).toFixed(3))
      : 0,
  };
}).sort((left, right) => (
  left.domainId.localeCompare(right.domainId)
  || right.coverage - left.coverage
  || left.metricId.localeCompare(right.metricId)
));
const sourceCardCoverageBySource = (['artificial_analysis', 'arena', 'openrouter'] as const)
  .reduce<Record<string, { cards: number; linkedCards: number; unmatchedCards: number }>>((result, source) => {
    const cards = store.cards.filter((card) => card.source === source);
    const linkedCards = cards.filter((card) => linkedSourceCardIds.has(card.id));
    result[source] = {
      cards: cards.length,
      linkedCards: linkedCards.length,
      unmatchedCards: cards.length - linkedCards.length,
    };
    return result;
  }, {});

if (onlyMissingPractical) {
  console.log(JSON.stringify({
    practicalScoreAvailable: profileRows.filter((row) => row.practicalScoreAvailable).length,
    configurationCount: profileRows.length,
    missingPractical: profileRows
      .filter((row) => !row.practicalScoreAvailable)
      .map((row) => ({
        presetId: row.presetId,
        configuration: row.configuration,
        modelName: row.modelName,
        profile: row.profile,
        harness: row.harness,
        linkedCardIds: row.linkedCardIds,
        openRouterProductLineCards: row.unlinkedProductLineCards
          .filter((card) => card.source === 'openrouter'),
      })),
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  install,
  unresolvedPresetCards,
  cleanup: store.getLastDataCleanupReport(),
  sourceCatalog: {
    generatedConfigurationCount: SOURCE_CATALOG_CONFIGURATION_PRESET_COUNT,
    cards: store.cards.length,
    distinctProductLines: productLines.size,
    distinctCanonicalProfiles: canonicalProfiles.size,
    uniqueLinkedCards: linkedSourceCardIds.size,
    unmatchedCards: store.cards.length - linkedSourceCardIds.size,
    reviewedEquivalentCardsAttachedToHandPresets: REVIEWED_EQUIVALENT_CARD_ATTACHMENT_COUNT,
    openRouterStandardPerformanceCards: openRouterStandardPerformanceCards.length,
    readerFacingModelGroups: BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT,
    maxConfigurationsPerModel: BUILT_IN_CONFIGURATION_MAX_PER_MODEL,
    bySource: sourceCardCoverageBySource,
  },
  curationPolicy: {
    inclusiveReleaseCutoff: BUILT_IN_CONFIGURATION_RELEASE_CUTOFF,
    explicitlyPinnedModelGroupKeys: BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS,
    keyVendorKeys: BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS,
    releaseDateCoverage: `${BUILT_IN_CONFIGURATION_CURATION_ROWS.length}/${BUILT_IN_CONFIGURATION_PRESETS.length}`,
    preCutoffConfigurationCount: BUILT_IN_CONFIGURATION_CURATION_ROWS
      .filter((row) => row.releaseDate < BUILT_IN_CONFIGURATION_RELEASE_CUTOFF)
      .length,
    unapprovedPreCutoffConfigurationCount: BUILT_IN_CONFIGURATION_CURATION_ROWS
      .filter((row) => (
        row.releaseDate < BUILT_IN_CONFIGURATION_RELEASE_CUTOFF
        && !row.explicitlyPinned
      ))
      .length,
    duplicateEffectiveDataConfigurationCount: duplicateEffectiveDataRows.length,
    nonKeyVendorsWithMultipleModels,
  },
  executionModes: {
    counts: executionModeCounts,
    chatHarnessMetricLeakCount: chatHarnessMetricLeaks.length,
    incompatibleHarnessMetricLeakCount: incompatibleHarnessMetricLeaks.length,
    chatHarnessMetricLeaks: includeDetails
      ? chatHarnessMetricLeaks.map((row) => ({
        presetId: row.presetId,
        harnessOnlyMetricIds: row.harnessOnlyMetricIds,
      }))
      : undefined,
    incompatibleHarnessMetricLeaks: includeDetails
      ? incompatibleHarnessMetricLeaks.map((row) => ({
        presetId: row.presetId,
        harness: row.harness,
        metricIds: row.incompatibleHarnessMetricIds,
      }))
      : undefined,
  },
  capabilityDomainCoverage: {
    distribution: domainCoverageDistribution,
    missingDomainCells: scores.reduce(
      (total, score) => total + Math.max(0, 6 - score.availableDomainCount),
      0,
    ),
    metricCoverage,
  },
  allEnabledVisibleConfigurations: summarize(scores, linkedBoxIds),
  apiConfigurations: summarize(apiScores, linkedBoxIds),
  stillDataInsufficientCount: dataInsufficientRows.length,
  ...(includeDetails ? {
    stillDataInsufficient: dataInsufficientRows,
    duplicateEffectiveDataConfigurations: duplicateEffectiveDataRows,
    missingProductLineAlternatives,
    configurations: profileRows,
  } : {}),
}, null, 2));
