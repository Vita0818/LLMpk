import snapshot from './sourceExpansionSnapshot.json';
import reviewedMappings from './sourceExpansionReviewedMappings.json';
import definitions from './sourceExpansionMetricDefinitions.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from './seedCards';
import type { ConfigurationSourceLinkProvenance, SourceModelCard, SourceObservation, SourceType } from '../types/admin_mapping';

export interface ExpansionTarget {
  presetId: string;
  modelName: string;
  profile: string;
  harness: string;
  provenance: ConfigurationSourceLinkProvenance;
}

export interface ExpansionRecord {
  id: string;
  datasetId: string;
  source: SourceType;
  sourceModelId: string;
  sourceModelName: string;
  identity: Record<string, unknown>;
  sourceUrl: string;
  dataUrl: string;
  sourceDate: string;
  fetchedAt: string;
  sha256: string;
  profile: string;
  harness: string;
  observations: { metricId: string; benchmarkVersion: string; rawValue: number | null;
    sourceField: string; confidenceLow?: number; confidenceHigh?: number;
    standardError?: number; sampleSize?: number; notes?: string }[];
}

export interface ExpansionReview {
  recordId: string;
  datasetId: string;
  source: SourceType;
  identity: Record<string, unknown>;
  baseCardId: string;
  sourceProfile: string;
  sourceHarness: string;
  baseSourceRecordId: string;
  baseReleaseDate: string | null;
  productLineId: string;
  reviewedReason: string;
  targets: ExpansionTarget[];
}

export function buildExpansionSourceCards(
  data: { schemaVersion: string; state: string; records: readonly ExpansionRecord[] },
  bases: readonly SourceModelCard[],
  manifest: { schemaVersion: string; reviewedAt: string; entries: readonly ExpansionReview[] },
) {
  const cards: SourceModelCard[] = [];
  const observations: SourceObservation[] = [];
  const unmatchedReviewedMappings: string[] = [];
  if (data.schemaVersion !== 'source-expansion-snapshot/v1' || data.state !== 'validated'
    || manifest.schemaVersion !== 'source-expansion-reviewed-mappings/v1') {
    return { cards, observations, unmatchedReviewedMappings: ['unsupported-source-expansion'] };
  }
  for (const review of manifest.entries) {
    const records = data.records.filter(record => record.id === review.recordId);
    const record = records[0];
    const baseMatches = bases.filter(base => base.id === review.baseCardId
      && base.metadataJson?.scope?.productLineId === review.productLineId
      && (base.metadataJson?.sourceIdentity?.canonicalSlug
        ?? base.metadataJson?.sourceIdentity?.sourceRecordId) === review.baseSourceRecordId
      && (review.baseReleaseDate === null
        || base.metadataJson?.sourceIdentity?.releaseDate === review.baseReleaseDate));
    const sameIdentity = record && JSON.stringify(record.identity) === JSON.stringify(review.identity);
    const ids = record?.observations.map(observation => observation.metricId) ?? [];
    if (records.length !== 1 || baseMatches.length !== 1 || !sameIdentity
      || record.datasetId !== review.datasetId || record.source !== review.source
      || record.profile !== review.sourceProfile || record.harness !== review.sourceHarness
      || new Set(ids).size !== ids.length || !/^\d{4}-\d{2}-\d{2}$/u.test(record.sourceDate)
      || !/^[a-f\d]{64}$/u.test(record.sha256)
      || record.observations.some(observation => {
        const metric = definitions.find(metric => metric.id === observation.metricId);
        return !metric || metric.datasetId !== record.datasetId || metric.sourceType !== record.source
          || metric.benchmarkVersion !== observation.benchmarkVersion
          || (observation.rawValue !== null && (!Number.isFinite(observation.rawValue)
            || (metric.metricType === 'accuracy' && (observation.rawValue < 0 || observation.rawValue > 1))));
      })) {
      unmatchedReviewedMappings.push(review.recordId);
      continue;
    }
    const id = `card-expansion-${record.id}`;
    const scope = { ...baseMatches[0].metadataJson?.scope,
      canonicalProfileKey: `${review.baseSourceRecordId}::${record.datasetId}::${record.sourceModelId}` };
    cards.push({ id, source: record.source, exactSourceModelName: record.sourceModelName,
      latestSnapshotDate: record.fetchedAt.slice(0, 10), metadataJson: {
        scope, sourceUrl: record.sourceUrl, sourceLeaderboard: record.sourceUrl,
        sourceIdentity: { sourceRecordId: record.sourceModelId, ...record.identity,
          datasetId: record.datasetId, effort: record.profile, executionHarness: record.harness,
          sha256: record.sha256, selectionMethod: 'reviewed-source-expansion' },
        reviewedMapping: { reviewedAt: manifest.reviewedAt, reason: review.reviewedReason, targets: review.targets },
      } });
    for (const observation of record.observations) {
      const metric = definitions.find(metric => metric.id === observation.metricId)!;
      observations.push({ id: `obs-${id}-${observation.metricId}`, sourceModelCardId: id,
        metricId: observation.metricId, rawValue: observation.rawValue, unit: metric.unit,
        snapshotDate: record.sourceDate, sourceUrl: record.sourceUrl, sourceLeaderboard: record.sourceUrl,
        ...(observation.confidenceLow !== undefined ? { confidenceLow: observation.confidenceLow } : {}),
        ...(observation.confidenceHigh !== undefined ? { confidenceHigh: observation.confidenceHigh } : {}),
        metadataJson: { scope, sourceRecordId: record.sourceModelId, sourceField: observation.sourceField,
          sourceDataUrl: record.dataUrl, sourceIdentity: record.identity, standardError: observation.standardError ?? null,
          productionHarness: record.identity.productionHarness ?? null,
          sourceSampleCount: observation.sampleSize ?? null, sha256: record.sha256, scoringRole: 'capability',
          benchmarkEvidence: { sourceUrl: record.sourceUrl, benchmarkVersion: observation.benchmarkVersion,
            sourceProfile: record.profile, sourceHarness: record.harness,
            sourceUpdated: record.sourceDate, notes: observation.notes ?? '',
            ...(observation.standardError !== undefined ? { standardError: observation.standardError } : {}) },
        } });
    }
  }
  return { cards, observations, unmatchedReviewedMappings };
}

const projected = buildExpansionSourceCards(snapshot as unknown as Parameters<typeof buildExpansionSourceCards>[0],
  JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[],
  reviewedMappings as unknown as Parameters<typeof buildExpansionSourceCards>[2]);
export const VERIFIED_EXPANSION_SOURCE_MODEL_CARDS = projected.cards;
export const VERIFIED_EXPANSION_SOURCE_OBSERVATIONS = projected.observations;
export const UNMATCHED_REVIEWED_EXPANSION_MAPPINGS = projected.unmatchedReviewedMappings;
