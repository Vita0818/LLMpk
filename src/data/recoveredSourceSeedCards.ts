import type { SourceModelCard, SourceObservation } from '../types/admin_mapping';
import {
  fetchedAt as artificialAnalysisFetchedAt,
  modelRecords as artificialAnalysisModelRecords,
} from './artificialAnalysisSourceSnapshot.json';

/**
 * The general source-card generator skipped LongCat 2.0 even though the
 * current verified Artificial Analysis snapshot contains an exact, complete
 * record. Recover that one record directly from the bundled snapshot instead
 * of copying values by hand or borrowing another LongCat model's scores.
 */
const LONGCAT_20_SOURCE_RECORD_ID = '5c3bdc0d-abab-4526-8079-34de4089bb4a';
const LONGCAT_20_CARD_ID = 'card-recovered-aa-longcat-2-0';
const SNAPSHOT_DATE = artificialAnalysisFetchedAt.slice(0, 10);
const LONGCAT_20_SCOPE = {
  scopeId: 'oagxm-current-product-lines',
  scopeVersion: 'oagxm-current-product-lines/v5-2026-08-13-releases',
  vendorId: 'meituan',
  vendorName: 'Meituan LongCat',
  productLineId: 'longcat_20',
  productLineName: 'LongCat 2.0',
  canonicalProfileKey: 'longcat-2-0',
  tier: 'official',
  rankingClass: 'formal_text_agent',
} as const;

const longCat20Record = (
  artificialAnalysisModelRecords as Array<Record<string, unknown>>
).find((record) => record.id === LONGCAT_20_SOURCE_RECORD_ID);

const longCat20ModelUrl = 'https://artificialanalysis.ai/models/longcat-2-0';
const artificialAnalysisLeaderboardUrl =
  'https://artificialanalysis.ai/leaderboards/models';

interface RecoveredMetricSpec {
  metricId: string;
  sourceField: string;
  rawValue: unknown;
  unit: string;
  sourceLeaderboard: string;
  confidenceLow?: unknown;
  confidenceHigh?: unknown;
  practicalFallback?: boolean;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const longCat20GdpvalBreakdown = (
  longCat20Record?.gdpvalBreakdown
  && typeof longCat20Record.gdpvalBreakdown === 'object'
)
  ? longCat20Record.gdpvalBreakdown as Record<string, unknown>
  : {};

const longCat20MetricSpecs: readonly RecoveredMetricSpec[] = longCat20Record
  ? [
    {
      metricId: 'aa_critpt',
      sourceField: 'critpt',
      rawValue: longCat20Record.critpt,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/critpt',
    },
    {
      metricId: 'aa_gdpval_v2',
      sourceField: 'gdpvalBreakdown.elo',
      rawValue: longCat20GdpvalBreakdown.elo,
      unit: 'Elo',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/gdpval-aa',
      confidenceLow: longCat20GdpvalBreakdown.lower95ci,
      confidenceHigh: longCat20GdpvalBreakdown.upper95ci,
    },
    {
      metricId: 'aa_gpqa_diamond',
      sourceField: 'gpqa',
      rawValue: longCat20Record.gpqa,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/gpqa-diamond',
    },
    {
      metricId: 'aa_hle',
      sourceField: 'hle',
      rawValue: longCat20Record.hle,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/humanitys-last-exam',
    },
    {
      metricId: 'aa_lcr',
      sourceField: 'lcr',
      rawValue: longCat20Record.lcr,
      unit: 'ratio',
      sourceLeaderboard:
        'https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning',
    },
    {
      metricId: 'aa_omniscience_accuracy',
      sourceField: 'omniscienceAccuracy',
      rawValue: longCat20Record.omniscienceAccuracy,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/omniscience',
    },
    {
      metricId: 'aa_omniscience_nonhallucination',
      sourceField: 'omniscienceNonHallucination',
      rawValue: longCat20Record.omniscienceNonHallucination,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/omniscience',
    },
    {
      metricId: 'aa_scicode',
      sourceField: 'scicode',
      rawValue: longCat20Record.scicode,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/scicode',
    },
    {
      metricId: 'aa_tau3_banking',
      sourceField: 'tauBanking',
      rawValue: longCat20Record.tauBanking,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/tau3-banking',
    },
    {
      metricId: 'aa_terminalbench_v21',
      sourceField: 'terminalbenchV21',
      rawValue: longCat20Record.terminalbenchV21,
      unit: 'ratio',
      sourceLeaderboard: 'https://artificialanalysis.ai/evaluations/terminalbench-v2-1',
    },
    {
      metricId: 'aa_price_input',
      sourceField: 'price1mInputTokens',
      rawValue: longCat20Record.price1mInputTokens,
      unit: '$/1M tokens',
      sourceLeaderboard: artificialAnalysisLeaderboardUrl,
      practicalFallback: true,
    },
    {
      metricId: 'aa_price_output',
      sourceField: 'price1mOutputTokens',
      rawValue: longCat20Record.price1mOutputTokens,
      unit: '$/1M tokens',
      sourceLeaderboard: artificialAnalysisLeaderboardUrl,
      practicalFallback: true,
    },
    {
      metricId: 'aa_throughput_median',
      sourceField: 'medianOutputTokensPerSecond',
      rawValue: longCat20Record.medianOutputTokensPerSecond,
      unit: 'tokens/second',
      sourceLeaderboard: artificialAnalysisLeaderboardUrl,
      practicalFallback: true,
    },
    {
      metricId: 'aa_ttft_median',
      sourceField: 'medianTimeToFirstTokenSeconds',
      rawValue: longCat20Record.medianTimeToFirstTokenSeconds,
      unit: 'seconds',
      sourceLeaderboard: artificialAnalysisLeaderboardUrl,
      practicalFallback: true,
    },
  ]
  : [];

export const VERIFIED_RECOVERED_SOURCE_MODEL_CARDS:
readonly SourceModelCard[] = longCat20Record
  ? [{
    id: LONGCAT_20_CARD_ID,
    source: 'artificial_analysis',
    exactSourceModelName: String(longCat20Record.name || 'LongCat 2.0'),
    latestSnapshotDate: SNAPSHOT_DATE,
    metadataJson: {
      sourceUrl: longCat20ModelUrl,
      sourceLeaderboard: artificialAnalysisLeaderboardUrl,
      scope: LONGCAT_20_SCOPE,
      sourceIdentity: {
        source: 'artificial_analysis',
        modelCreatorName: longCat20Record.modelCreatorName,
        modelCreatorSlug: longCat20Record.modelCreatorSlug,
        releaseDate: longCat20Record.releaseDate,
        sourceRecordId: LONGCAT_20_SOURCE_RECORD_ID,
        exactSourceModelName: longCat20Record.name,
        selectionMethod: 'official-aa-structured-snapshot-recovery',
        canonicalProfileKey: LONGCAT_20_SCOPE.canonicalProfileKey,
      },
    },
  }]
  : [];

export const VERIFIED_RECOVERED_SOURCE_OBSERVATIONS:
readonly SourceObservation[] = longCat20MetricSpecs.flatMap((spec) => {
  const rawValue = finiteNumber(spec.rawValue);
  if (rawValue === null) return [];
  const confidenceLow = finiteNumber(spec.confidenceLow);
  const confidenceHigh = finiteNumber(spec.confidenceHigh);
  return [{
    id: `obs-${LONGCAT_20_CARD_ID}-${spec.metricId}`,
    sourceModelCardId: LONGCAT_20_CARD_ID,
    metricId: spec.metricId,
    rawValue,
    unit: spec.unit,
    ...(confidenceLow === null ? {} : { confidenceLow }),
    ...(confidenceHigh === null ? {} : { confidenceHigh }),
    snapshotDate: SNAPSHOT_DATE,
    sourceUrl: longCat20ModelUrl,
    sourceLeaderboard: spec.sourceLeaderboard,
    metadataJson: {
      sourceSnapshot: 'src/data/artificialAnalysisSourceSnapshot.json',
      sourcePageId: 'model-leaderboard',
      ...(spec.practicalFallback ? { scoringRole: 'practical-fallback' } : {}),
      sourceRecordId: LONGCAT_20_SOURCE_RECORD_ID,
      sourceField: spec.sourceField,
      reportedRawValue: rawValue,
      scope: LONGCAT_20_SCOPE,
    },
  }];
});
