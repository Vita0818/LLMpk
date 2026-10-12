import snapshot from './valsSourceSnapshot.json';
import reviewedMappings from './valsReviewedMappings.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from './seedCards';
import { VALS_METRIC_DEFINITIONS, type ValsBenchmarkEvidence } from './valsMetricDefinitions';
import type { ConfigurationSourceLinkProvenance, SourceModelCard, SourceObservation } from '../types/admin_mapping';

interface ValsResult {
  accuracy: number | null;
  stderr?: number | null;
  [key: string]: unknown;
}

interface ValsBenchmark {
  metadata: { slug: string; benchmark: string; version?: string; updated: string };
  tasks: Record<string, Record<string, ValsResult>>;
  source: { pageUrl: string; dataUrl: string; sha256: string; rawSnapshotFile: string };
  fallbackNotices: readonly string[];
  refusalFallback?: Record<string, {
    status: string; publishedScorePct: number; noFallbackScorePct: number;
    fallbacks: number; refusals: number; totalTasks: number;
    [key: string]: unknown;
  } | null>;
}

export interface ValsSnapshot {
  schemaVersion: string;
  state: string;
  fetchedAt: string;
  benchmarks: readonly ValsBenchmark[];
  refusalMetadataSource?: { url: string; sha256: string; rawSnapshotFile: string };
}

export interface ValsReviewedTarget {
  presetId: string;
  modelName: string;
  profile: string;
  profileLevel: number;
  harness: string;
}

export interface ValsReviewedMapping {
  key: string;
  modelId: string;
  displayName: string;
  productLineId: string;
  baseCardId: string;
  canonicalModelVersion: string;
  targets: readonly ValsReviewedTarget[];
  executions: readonly {
    benchmarkSlug: string;
    benchmarkVersion: string | null;
    task: string;
    settings: Record<string, unknown>;
    profile: { label: string; level: number | null; disclosed: boolean };
  }[];
}

export interface ValsReviewedManifest {
  schemaVersion: string;
  reviewedAt: string;
  entries: readonly ValsReviewedMapping[];
}

/** Settings are pinned by review; a refresh never turns another effort into this one. */
function matchesSettings(row: ValsResult, settings: Record<string, unknown>) {
  return Object.keys(settings).length === 9
    && Object.entries(settings).every(([key, value]) => JSON.stringify(row[key] ?? null) === JSON.stringify(value));
}

function matchesProfile(row: ValsResult, profile: ValsReviewedMapping['executions'][number]['profile']) {
  const value = row.compute_effort ?? row.reasoning_effort;
  const profiles: Record<string, [string, number]> = { default: ['Default', 0], none: ['None', 0],
    minimal: ['Minimal', 1], low: ['Low', 2], medium: ['Medium', 3], high: ['High', 4], xhigh: ['XHigh', 5], max: ['Max', 6] };
  if (value === null || value === undefined) return profile.label === 'Default' && profile.level === 0 && !profile.disclosed;
  const match = profiles[String(value).toLowerCase()];
  return profile.label === (match?.[0] ?? String(value)) && profile.level === (match?.[1] ?? null) && profile.disclosed;
}

export function buildValsSourceCards(
  data: ValsSnapshot,
  bases: readonly SourceModelCard[],
  manifest: ValsReviewedManifest,
) {
  const cards: SourceModelCard[] = [];
  const observations: SourceObservation[] = [];
  const unmatchedReviewedMappings: string[] = [];
  if (data.schemaVersion !== 'vals-source-snapshot/v1' || data.state !== 'validated'
    || manifest.schemaVersion !== 'vals-reviewed-mappings/v1') {
    return { cards, observations, unmatchedReviewedMappings: ['unsupported-vals-snapshot'] };
  }
  for (const review of manifest.entries) {
    const baseMatches = bases.filter(card => card.id === review.baseCardId
      && card.source === 'openrouter'
      && card.metadataJson?.sourceIdentity?.canonicalSlug === review.canonicalModelVersion
      && card.metadataJson?.scope?.productLineId === review.productLineId);
    for (const execution of review.executions) {
      const id = `card-vals-${review.key}-${execution.benchmarkSlug}`;
      const benchmarks = data.benchmarks.filter(item => item.metadata.slug === execution.benchmarkSlug);
      const benchmark = benchmarks[0];
      const row = benchmark?.tasks[execution.task]?.[review.modelId];
      const refusal = benchmark?.refusalFallback?.[review.modelId];
      const metric = VALS_METRIC_DEFINITIONS.find(item => item.slug === execution.benchmarkSlug);
      if (baseMatches.length !== 1 || benchmarks.length !== 1 || !metric || !row
        || (benchmark.metadata.version ?? null) !== execution.benchmarkVersion
        || !matchesSettings(row, execution.settings)
        || !matchesProfile(row, execution.profile)
        || (row.stderr !== null && row.stderr !== undefined && (typeof row.stderr !== 'number'
          || !Number.isFinite(row.stderr) || row.stderr < 0 || row.stderr > 100))
        || (row.accuracy !== null && (!Number.isFinite(row.accuracy) || row.accuracy < 0 || row.accuracy > 100))) {
        unmatchedReviewedMappings.push(id);
        continue;
      }
      if (refusal?.status === 'available' && (typeof refusal.noFallbackScorePct !== 'number'
        || !Number.isFinite(refusal.noFallbackScorePct) || refusal.noFallbackScorePct < 0
        || refusal.noFallbackScorePct > 100 || row.accuracy === null
        || Math.abs(refusal.publishedScorePct - row.accuracy) > 0.0011)) {
        unmatchedReviewedMappings.push(id);
        continue;
      }
      const hasFallback = refusal?.status === 'available' && refusal.fallbacks > 0;
      const selectedAccuracy = hasFallback ? refusal.noFallbackScorePct : row.accuracy;
      const targets = review.targets.flatMap(target => {
        const level = execution.profile.level;
        if (level === null || level > target.profileLevel) return [];
        const provenance: ConfigurationSourceLinkProvenance = level === target.profileLevel
          ? { kind: 'exact' }
          : { kind: 'lower_profile_fallback', sourceProfile: execution.profile.label,
              sourceLevel: level, targetProfile: target.profile, targetLevel: target.profileLevel };
        return [{ ...target, provenance }];
      });
      const sourceRecordId = JSON.stringify([
        execution.benchmarkSlug, execution.benchmarkVersion, execution.task, review.modelId, execution.settings,
      ]);
      const scope = { ...baseMatches[0].metadataJson?.scope,
        canonicalProfileKey: `${review.canonicalModelVersion}::vals-${review.key}-${execution.benchmarkSlug}` };
      const evidence = {
        benchmarkVersion: execution.benchmarkVersion, sourceUrl: benchmark.source.pageUrl,
        sourceUpdated: benchmark.metadata.updated, sourceProfile: execution.profile.disclosed
          ? execution.profile.label : 'Default（effort 未披露）',
        sourceHarness: typeof row.harness === 'string' ? row.harness : null,
        hasRefusalFallbackNotice: hasFallback,
        publishedRawValue: row.accuracy === null ? null : row.accuracy / 100,
        scoreBasis: hasFallback ? 'no-fallback' : 'published',
        fallbackCount: refusal?.status === 'available' ? refusal.fallbacks : null,
        refusalCount: refusal?.status === 'available' ? refusal.refusals : null,
      };
      cards.push({
        id, source: 'vals', exactSourceModelName: review.displayName,
        latestSnapshotDate: data.fetchedAt.slice(0, 10),
        metadataJson: {
          sourceUrl: benchmark.source.pageUrl, sourceLeaderboard: `Vals AI · ${benchmark.metadata.benchmark}`,
          scope, sourceIdentity: { sourceRecordId, modelId: review.modelId,
            canonicalModelVersion: review.canonicalModelVersion, baseCardId: review.baseCardId,
            benchmarkSlug: execution.benchmarkSlug, benchmarkName: benchmark.metadata.benchmark,
            benchmarkVersion: execution.benchmarkVersion, task: execution.task,
            effort: execution.profile.label, effortDisclosed: execution.profile.disclosed,
            executionHarness: row.harness ?? null, settings: execution.settings,
            sha256: benchmark.source.sha256, rawSnapshotFile: benchmark.source.rawSnapshotFile },
          refusalMetadataSource: data.refusalMetadataSource,
          reviewedMapping: { reviewedAt: manifest.reviewedAt, targets },
        },
      });
      observations.push({
        id: `obs-${id}`, sourceModelCardId: id, metricId: metric.id,
        rawValue: selectedAccuracy === null ? null : selectedAccuracy / 100,
        unit: '%', snapshotDate: data.fetchedAt.slice(0, 10),
        sourceUrl: benchmark.source.pageUrl, sourceLeaderboard: `Vals AI · ${benchmark.metadata.benchmark}`,
        metadataJson: { scope, sourceRecordId, sourceField: hasFallback
            ? 'refusalFallback[modelId].noFallbackScorePct' : `tasks.${execution.task}[modelId].accuracy`,
          sourceRecord: row, sourceSettings: execution.settings, sourceDataUrl: benchmark.source.dataUrl,
          standardError: !hasFallback && typeof row.stderr === 'number' ? row.stderr / 100 : null,
          publishedStandardError: typeof row.stderr === 'number' ? row.stderr / 100 : null,
          uncertaintyStatus: !hasFallback && typeof row.stderr === 'number' ? 'standard-error-only' : 'unknown',
          refusalFallback: refusal ?? null,
          scoringRole: metric.scoringWeightInDomain > 0 ? 'capability' : 'detail-only',
          fallbackNotices: benchmark.fallbackNotices, valsEvidence: evidence },
      });
    }
  }
  return { cards, observations, unmatchedReviewedMappings };
}

export function getValsDisplayEvidence(
  card: SourceModelCard,
  observation: SourceObservation,
  provenance: ConfigurationSourceLinkProvenance,
): ValsBenchmarkEvidence | null {
  const evidence = observation.metadataJson?.valsEvidence;
  if (card.source !== 'vals' || !evidence
    || !VALS_METRIC_DEFINITIONS.some(metric => metric.id === observation.metricId)) return null;
  return {
    metricId: observation.metricId, rawValue: observation.rawValue,
    publishedRawValue: evidence.publishedRawValue, scoreBasis: evidence.scoreBasis,
    fallbackCount: evidence.fallbackCount, refusalCount: evidence.refusalCount,
    standardError: observation.metadataJson?.standardError ?? null,
    benchmarkVersion: evidence.benchmarkVersion, sourceUrl: evidence.sourceUrl,
    sourceUpdated: evidence.sourceUpdated, sourceProfile: evidence.sourceProfile,
    sourceHarness: evidence.sourceHarness, profileFallback: provenance.kind !== 'exact',
    hasRefusalFallbackNotice: evidence.hasRefusalFallbackNotice,
  };
}

const projected = buildValsSourceCards(snapshot as unknown as ValsSnapshot,
  JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[], reviewedMappings as ValsReviewedManifest);
export const VERIFIED_VALS_SOURCE_MODEL_CARDS = projected.cards;
export const VERIFIED_VALS_SOURCE_OBSERVATIONS = projected.observations;
export const UNMATCHED_REVIEWED_VALS_MAPPINGS = projected.unmatchedReviewedMappings;
