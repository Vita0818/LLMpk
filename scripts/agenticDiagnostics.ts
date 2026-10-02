import type {
  LLMConfiguration,
  MetricDefinition,
} from '../src/types/llm_pk';
import type {
  ConfigurationSourceLinkProvenance,
  SourceModelCard,
  SourceObservation,
} from '../src/types/admin_mapping';
import {
  ALL_METRIC_DEFINITIONS,
  calculateMedian,
  normalizeMax100Median50,
  processLLMpkBatchScoring,
  transformRawMetric,
} from '../src/engine/scoringEngine';
import {
  isCapabilityMetricCompatibleWithSourceLink,
} from '../src/data/executionMetricPolicy';
import {
  ARENA_AGENT_SOURCE_SIGNAL_BY_METRIC_ID,
} from '../src/data/metricUncertainty';

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
const { BUILT_IN_CONFIGURATION_PRESETS } = await import(
  '../src/data/builtInConfigurationPresets'
);

const AGENTIC_METRIC_IDS = [
  'aa_tau3_banking',
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
] as const;
const ARENA_AGENT_METRIC_IDS = AGENTIC_METRIC_IDS.filter(
  (metricId) => metricId.startsWith('arena_agent_'),
);
const AGENTIC_DEFINITIONS = ALL_METRIC_DEFINITIONS.filter(
  (definition) => definition.domain === 'agentic_work',
);
const DEFINITIONS_BY_ID = new Map(
  AGENTIC_DEFINITIONS.map((definition) => [definition.id, definition]),
);

type EffectiveSource = {
  card: SourceModelCard;
  observation: SourceObservation;
  provenance: ConfigurationSourceLinkProvenance;
};

function round(value: number | null | undefined, digits = 4): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function rankDescending(
  rows: Array<{ key: string; value: number | null }>,
): Map<string, number> {
  const ranked = rows
    .filter((row): row is { key: string; value: number } => row.value !== null)
    .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));
  const result = new Map<string, number>();
  ranked.forEach((row, index) => result.set(row.key, index + 1));
  return result;
}

function pearson(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  left.forEach((value, index) => {
    const leftDelta = value - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquared += leftDelta ** 2;
    rightSquared += rightDelta ** 2;
  });
  const denominator = Math.sqrt(leftSquared * rightSquared);
  return denominator > 0 ? numerator / denominator : null;
}

function spearman(
  rows: Array<{ left: number | null; right: number | null }>,
): number | null {
  const paired = rows.filter(
    (row): row is { left: number; right: number } => (
      row.left !== null && row.right !== null
    ),
  );
  const leftRanks = rankDescending(paired.map((row, index) => ({
    key: String(index),
    value: row.left,
  })));
  const rightRanks = rankDescending(paired.map((row, index) => ({
    key: String(index),
    value: row.right,
  })));
  return pearson(
    paired.map((_, index) => leftRanks.get(String(index))!),
    paired.map((_, index) => rightRanks.get(String(index))!),
  );
}

function alternativeAgenticScores(
  configs: LLMConfiguration[],
  definitions: MetricDefinition[],
): Map<string, number | null> {
  return new Map(
    processLLMpkBatchScoring(configs, definitions).map((score) => [
      score.config.id,
      score.domainScores.agentic_work.score,
    ]),
  );
}

const store = new AdminMappingStore();
const install = store.installBuiltInConfigurationPresets();
const presetById = new Map(
  BUILT_IN_CONFIGURATION_PRESETS.map((preset) => [preset.id, preset]),
);
const installedBoxes = store.boxes.filter(
  (box) => typeof box.builtInPresetId === 'string' && box.builtInPresetId.startsWith('builtin.'),
);
const configs = installedBoxes.map((box) => store.buildLLMConfiguration(box));
const scores = store.computeLeaderboardScores();
const scoreByConfigId = new Map(scores.map((score) => [score.config.id, score]));
const configById = new Map(configs.map((config) => [config.id, config]));

function effectiveSourceForMetric(
  boxId: string,
  harnessName: string,
  metricId: string,
): EffectiveSource | null {
  for (const { card, link } of store.getLinkedCardStack(boxId)) {
    if (card.source === 'openrouter') continue;
    const observation = store.getCardObservations(card.id)
      .find((candidate) => candidate.metricId === metricId);
    if (!observation) continue;
    const provenance = link.provenance || { kind: 'exact' };
    if (
      !isCapabilityMetricCompatibleWithSourceLink(
        metricId,
        harnessName,
        provenance,
      )
    ) continue;
    return { card, observation, provenance };
  }
  return null;
}

const tauOnly = alternativeAgenticScores(
  configs,
  AGENTIC_DEFINITIONS.filter((definition) => definition.id === 'aa_tau3_banking'),
);
const arenaOnly = alternativeAgenticScores(
  configs,
  AGENTIC_DEFINITIONS.filter((definition) => definition.id.startsWith('arena_agent_')),
);

const rows = installedBoxes.map((box) => {
  const preset = presetById.get(box.builtInPresetId!);
  const config = configById.get(box.id)!;
  const score = scoreByConfigId.get(box.id)!;
  const domain = score.domainScores.agentic_work;
  const sources = Object.fromEntries(
    AGENTIC_METRIC_IDS.map((metricId) => {
      const effective = effectiveSourceForMetric(
        box.id,
        preset?.identity.harness.name || 'Chat',
        metricId,
      );
      const detail = domain.metricDetails.find((candidate) => candidate.metricId === metricId);
      const sourceRecord = effective?.observation.metadataJson?.sourceRecord;
      const sourceSignal = ARENA_AGENT_SOURCE_SIGNAL_BY_METRIC_ID[metricId];
      const confidenceRadius = sourceSignal
        && typeof sourceRecord?.signalCi?.[sourceSignal] === 'number'
        ? sourceRecord.signalCi[sourceSignal]
        : null;
      return [metricId, {
        raw: round(detail?.rawValue, 8),
        baseNormalized: round(detail?.baseNormalizedScore, 3),
        normalized: round(detail?.normalizedScore, 3),
        normalizedExact: (
          typeof detail?.normalizedScore === 'number'
          && Number.isFinite(detail.normalizedScore)
        ) ? detail.normalizedScore : null,
        configuredWeight: round(detail?.configuredWeightInDomain, 3),
        effectiveWeight: round(detail?.weightInDomain, 3),
        participationReliability: round(detail?.participationReliability, 4),
        discriminationReliability: round(detail?.discriminationReliability, 4),
        reliability: round(detail?.reliability, 4),
        uncertaintyRadius: round(detail?.uncertaintyRadius, 8),
        uncertaintyStatus: detail?.uncertaintyStatus || null,
        cardId: effective?.card.id || null,
        exactSourceModelName: effective?.card.exactSourceModelName || null,
        provenance: effective?.provenance || null,
        sourceRecordId: effective?.observation.metadataJson?.sourceRecordId || null,
        confidenceRadius: round(confidenceRadius, 8),
      }];
    }),
  );
  const arenaSource = effectiveSourceForMetric(
    box.id,
    preset?.identity.harness.name || 'Chat',
    'arena_agent_success',
  );
  const sourceRecord = arenaSource?.observation.metadataJson?.sourceRecord;
  const officialNetImprovement = typeof sourceRecord?.avgScore?.value === 'number'
    ? sourceRecord.avgScore.value
    : null;
  const officialNetImprovementCi = typeof sourceRecord?.avgScore?.ci === 'number'
    ? sourceRecord.avgScore.ci
    : null;
  const officialRank = typeof sourceRecord?.rank === 'number'
    ? sourceRecord.rank
    : null;
  const arenaSessions = typeof sourceRecord?.sessions === 'number'
    ? sourceRecord.sessions
    : null;

  return {
    presetId: box.builtInPresetId,
    configuration: config.name,
    model: preset?.identity.model.name || config.identity.modelName,
    profile: preset?.identity.model.profile || config.identity.modelVersion,
    harness: preset?.identity.harness.name || config.execution.harness,
    agenticScore: round(domain.score, 3),
    agenticCoverage: round(domain.coverage, 3),
    coverageStatus: domain.coverageStatus,
    currentRawIndex: round(domain.rawGeometricIndex, 6),
    tauOnlyScore: round(tauOnly.get(box.id), 3),
    arenaSignalsOnlyScore: round(arenaOnly.get(box.id), 3),
    officialArenaNetImprovement: round(officialNetImprovement, 8),
    officialArenaNetImprovementCi: round(officialNetImprovementCi, 8),
    officialArenaRank: officialRank,
    arenaSessions,
    metricCount: domain.metricDetails.filter((detail) => !detail.isMissing).length,
    sources,
  };
});

function missingNeutralScenario(
  excludedMetricIds: ReadonlySet<string> = new Set<string>(),
): Map<string, number | null> {
  const rawIndices = rows.map((row) => {
    let rawIndex = 0;
    for (const definition of AGENTIC_DEFINITIONS) {
      if (excludedMetricIds.has(definition.id)) continue;
      const normalizedScore = row.sources[definition.id]?.normalizedExact;
      if (typeof normalizedScore !== 'number' || !Number.isFinite(normalizedScore)) {
        // Missing observations contribute ln(50 / 50) = 0, retaining their weight.
        continue;
      }
      rawIndex += definition.internalWeightInDomain * Math.log(
        Math.max(normalizedScore, 1e-12) / 50,
      );
    }
    return { key: row.presetId!, rawIndex };
  });
  const normalized = normalizeMax100Median50(
    rawIndices.map((candidate) => candidate.rawIndex),
  );
  return new Map(
    rawIndices.map((candidate, index) => [
      candidate.key,
      normalized[index] ?? null,
    ]),
  );
}

const documentedMissingNeutral = missingNeutralScenario();
const documentedMissingNeutralWithoutTool = missingNeutralScenario(
  new Set(['arena_agent_tool_hallucination']),
);

const currentRank = rankDescending(rows.map((row) => ({
  key: row.presetId!,
  value: row.agenticScore,
})));
const tauRank = rankDescending(rows.map((row) => ({
  key: row.presetId!,
  value: row.tauOnlyScore,
})));
const arenaSignalsRank = rankDescending(rows.map((row) => ({
  key: row.presetId!,
  value: row.arenaSignalsOnlyScore,
})));
const documentedMissingNeutralRank = rankDescending(rows.map((row) => ({
  key: row.presetId!,
  value: round(documentedMissingNeutral.get(row.presetId!), 3),
})));
const documentedMissingNeutralWithoutToolRank = rankDescending(rows.map((row) => ({
  key: row.presetId!,
  value: round(documentedMissingNeutralWithoutTool.get(row.presetId!), 3),
})));
rows.forEach((row) => {
  Object.assign(row, {
    currentRank: currentRank.get(row.presetId!) || null,
    tauOnlyRank: tauRank.get(row.presetId!) || null,
    arenaSignalsOnlyRank: arenaSignalsRank.get(row.presetId!) || null,
    documentedMissingNeutralScore: round(
      documentedMissingNeutral.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralRank:
      documentedMissingNeutralRank.get(row.presetId!) || null,
    documentedMissingNeutralWithoutToolScore: round(
      documentedMissingNeutralWithoutTool.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralWithoutToolRank:
      documentedMissingNeutralWithoutToolRank.get(row.presetId!) || null,
  });
});

const signalDistribution = AGENTIC_DEFINITIONS.map((definition) => {
  const rawValues = configs
    .map((config) => config.observations[definition.id]?.rawValue)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const transformedValues = rawValues.map((value) => (
    transformRawMetric(value, definition.metricType)
  ));
  const max = transformedValues.length > 0 ? Math.max(...transformedValues) : null;
  const min = transformedValues.length > 0 ? Math.min(...transformedValues) : null;
  const median = transformedValues.length > 0 ? calculateMedian(transformedValues) : null;
  const normalizedValues = normalizeMax100Median50(transformedValues);
  const effectiveValues = rows
    .map((row) => row.sources[definition.id]?.normalizedExact)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const reliabilitySample = rows[0]?.sources[definition.id];
  const uniqueRawValues = new Set(rawValues.map((value) => value.toFixed(10))).size;
  const uniqueNormalizedValues = new Set(
    normalizedValues.map((value) => value.toFixed(6)),
  ).size;
  const confidenceRadii = rows
    .map((row) => row.sources[definition.id]?.confidenceRadius)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const medianConfidenceRadius = confidenceRadii.length > 0
    ? calculateMedian(confidenceRadii)
    : null;
  const maxMedianGap = max !== null && median !== null ? max - median : null;
  return {
    metricId: definition.id,
    configuredWeight: definition.internalWeightInDomain,
    observedConfigurations: rawValues.length,
    coverage: round(rawValues.length / configs.length, 3),
    uniqueRawValues,
    uniqueNormalizedValues,
    rawMin: round(Math.min(...rawValues), 10),
    rawMedian: round(calculateMedian(rawValues), 10),
    rawMax: round(Math.max(...rawValues), 10),
    transformedMin: round(min, 10),
    transformedMedian: round(median, 10),
    transformedMax: round(max, 10),
    maxMedianGap: round(maxMedianGap, 12),
    medianConfidenceRadius: round(medianConfidenceRadius, 10),
    maxMedianGapToMedianCiRatio: (
      maxMedianGap !== null
      && medianConfidenceRadius !== null
      && medianConfidenceRadius > 0
    ) ? round(maxMedianGap / medianConfidenceRadius, 3) : null,
    normalizerCollapsedToNeutral: (
      max !== null
      && median !== null
      && Math.abs(max - median) < 1e-7
    ),
    normalizedMin: round(Math.min(...normalizedValues), 4),
    normalizedMedian: round(calculateMedian(normalizedValues), 4),
    normalizedMax: round(Math.max(...normalizedValues), 4),
    effectiveMin: round(Math.min(...effectiveValues), 4),
    effectiveMedian: round(calculateMedian(effectiveValues), 4),
    effectiveMax: round(Math.max(...effectiveValues), 4),
    participationReliability: reliabilitySample?.participationReliability ?? null,
    discriminationReliability: reliabilitySample?.discriminationReliability ?? null,
    reliability: reliabilitySample?.reliability ?? null,
    uncertaintyStatus: reliabilitySample?.uncertaintyStatus ?? null,
  };
});

const sourceCardUsage = new Map<string, Set<string>>();
rows.forEach((row) => {
  ARENA_AGENT_METRIC_IDS.forEach((metricId) => {
    const source = row.sources[metricId];
    if (!source.cardId) return;
    const consumers = sourceCardUsage.get(source.cardId) || new Set<string>();
    consumers.add(row.presetId!);
    sourceCardUsage.set(source.cardId, consumers);
  });
});

const rowsWithArena = rows.filter((row) => row.officialArenaNetImprovement !== null);
const currentArenaIntersectionRank = rankDescending(rowsWithArena.map((row) => ({
  key: row.presetId!,
  value: row.agenticScore,
})));
const officialArenaIntersectionRank = rankDescending(rowsWithArena.map((row) => ({
  key: row.presetId!,
  value: row.officialArenaNetImprovement,
})));
const correlations = {
  currentVsOfficialArenaNetImprovement: round(spearman(rowsWithArena.map((row) => ({
    left: row.agenticScore,
    right: row.officialArenaNetImprovement,
  }))), 4),
  arenaSignalsOnlyVsOfficialArenaNetImprovement: round(spearman(rowsWithArena.map((row) => ({
    left: row.arenaSignalsOnlyScore,
    right: row.officialArenaNetImprovement,
  }))), 4),
  currentVsTau3: round(spearman(rows.map((row) => ({
    left: row.agenticScore,
    right: row.sources.aa_tau3_banking.raw,
  }))), 4),
  documentedMissingNeutralVsOfficialArenaNetImprovement: round(
    spearman(rowsWithArena.map((row) => ({
      left: documentedMissingNeutral.get(row.presetId!) ?? null,
      right: row.officialArenaNetImprovement,
    }))),
    4,
  ),
  documentedMissingNeutralWithoutToolVsOfficialArenaNetImprovement: round(
    spearman(rowsWithArena.map((row) => ({
      left: documentedMissingNeutralWithoutTool.get(row.presetId!) ?? null,
      right: row.officialArenaNetImprovement,
    }))),
    4,
  ),
};

const coverageBreakdown = rows.reduce<Record<string, number>>((result, row) => {
  const key = `${row.metricCount} metrics / ${row.coverageStatus}`;
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});
const topTenByCurrent = [...rows]
  .sort((left, right) => (right.agenticScore ?? -1) - (left.agenticScore ?? -1))
  .slice(0, 10);
const coverageCohorts = [
  {
    cohort: 'tau3_and_arena',
    rows: rows.filter((row) => row.metricCount === 6),
  },
  {
    cohort: 'tau3_only',
    rows: rows.filter((row) => (
      row.sources.aa_tau3_banking.raw !== null && row.metricCount === 1
    )),
  },
  {
    cohort: 'arena_only',
    rows: rows.filter((row) => (
      row.sources.aa_tau3_banking.raw === null && row.metricCount === 5
    )),
  },
].map(({ cohort, rows: cohortRows }) => ({
  cohort,
  configurations: cohortRows.length,
  medianAgenticScore: round(calculateMedian(
    cohortRows
      .map((row) => row.agenticScore)
      .filter((value): value is number => value !== null),
  ), 3),
  minAgenticScore: round(Math.min(...cohortRows
    .map((row) => row.agenticScore)
    .filter((value): value is number => value !== null)), 3),
  maxAgenticScore: round(Math.max(...cohortRows
    .map((row) => row.agenticScore)
    .filter((value): value is number => value !== null)), 3),
}));

const inversions = rowsWithArena
  .map((row) => ({
    presetId: row.presetId,
    configuration: row.configuration,
    currentRankAmongMatchedModels: currentArenaIntersectionRank.get(row.presetId!) || null,
    officialRankAmongMatchedModels: officialArenaIntersectionRank.get(row.presetId!) || null,
    publishedOfficialArenaRank: row.officialArenaRank,
    rankGap: (
      (currentArenaIntersectionRank.get(row.presetId!) || 0)
      - (officialArenaIntersectionRank.get(row.presetId!) || 0)
    ),
    agenticScore: row.agenticScore,
    tau3Raw: row.sources.aa_tau3_banking.raw,
    officialArenaNetImprovement: row.officialArenaNetImprovement,
    officialArenaNetImprovementCi: row.officialArenaNetImprovementCi,
    arenaSessions: row.arenaSessions,
    documentedMissingNeutralScore: round(
      documentedMissingNeutral.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralRank:
      documentedMissingNeutralRank.get(row.presetId!) || null,
    documentedMissingNeutralWithoutToolScore: round(
      documentedMissingNeutralWithoutTool.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralWithoutToolRank:
      documentedMissingNeutralWithoutToolRank.get(row.presetId!) || null,
  }))
  .sort((left, right) => Math.abs(right.rankGap || 0) - Math.abs(left.rankGap || 0))
  .slice(0, 12);

const duplicateArenaSourceCards = [...sourceCardUsage.entries()]
  .filter(([, consumers]) => consumers.size > 1)
  .map(([cardId, consumers]) => ({ cardId, consumers: [...consumers] }));

const output = {
  generatedAt: new Date().toISOString(),
  install,
  population: {
    configurations: rows.length,
    withTau3: rows.filter((row) => row.sources.aa_tau3_banking.raw !== null).length,
    withArenaAgentSignals: rows.filter((row) => (
      row.sources.arena_agent_success.raw !== null
    )).length,
    withBoth: rows.filter((row) => (
      row.sources.aa_tau3_banking.raw !== null
      && row.sources.arena_agent_success.raw !== null
    )).length,
    coverageBreakdown,
    coverageCohorts,
    sparseConfigurationsInCurrentTopTen: topTenByCurrent
      .filter((row) => row.metricCount < AGENTIC_METRIC_IDS.length)
      .map((row) => ({
        configuration: row.configuration,
        agenticScore: row.agenticScore,
        metricCount: row.metricCount,
        coverageStatus: row.coverageStatus,
      })),
  },
  configuredMetrics: AGENTIC_DEFINITIONS.map((definition) => ({
    metricId: definition.id,
    name: definition.name,
    source: definition.source,
    metricType: definition.metricType,
    weight: definition.internalWeightInDomain,
    higherIsBetter: definition.higherIsBetter,
  })),
  signalDistribution,
  correlations,
  duplicateArenaSourceCards,
  inversions,
  configurations: rows.sort((left, right) => (
    (right.agenticScore ?? -1) - (left.agenticScore ?? -1)
    || left.configuration.localeCompare(right.configuration)
  )),
} satisfies Record<string, unknown>;

if (process.argv.includes('--summary')) {
  const compactRows = rows.map((row) => ({
    configuration: row.configuration,
    harness: row.harness,
    agenticScore: row.agenticScore,
    agenticCoverage: row.agenticCoverage,
    metricCount: row.metricCount,
    tau3Raw: row.sources.aa_tau3_banking.raw,
    arenaSignalsOnlyScore: row.arenaSignalsOnlyScore,
    officialArenaNetImprovement: row.officialArenaNetImprovement,
    officialArenaNetImprovementCi: row.officialArenaNetImprovementCi,
    arenaSessions: row.arenaSessions,
    currentRank: currentRank.get(row.presetId!) || null,
    officialRankAmongMatchedModels:
      officialArenaIntersectionRank.get(row.presetId!) || null,
    documentedMissingNeutralScore: round(
      documentedMissingNeutral.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralRank:
      documentedMissingNeutralRank.get(row.presetId!) || null,
    documentedMissingNeutralWithoutToolScore: round(
      documentedMissingNeutralWithoutTool.get(row.presetId!),
      3,
    ),
    documentedMissingNeutralWithoutToolRank:
      documentedMissingNeutralWithoutToolRank.get(row.presetId!) || null,
  }));
  console.log(JSON.stringify({
    generatedAt: output.generatedAt,
    population: output.population,
    configuredMetrics: output.configuredMetrics,
    signalDistribution: output.signalDistribution,
    correlations: output.correlations,
    duplicateArenaSourceCards: output.duplicateArenaSourceCards,
    inversions: output.inversions,
    matchedModels: compactRows.filter(
      (row) => row.officialArenaNetImprovement !== null,
    ),
    topTen: compactRows.slice(0, 10),
    bottomTen: compactRows.slice(-10),
  }, null, 2));
} else {
  console.log(JSON.stringify(output, null, 2));
}
