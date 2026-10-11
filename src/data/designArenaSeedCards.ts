import snapshot from './designArenaSourceSnapshot.json';
import reviewedMappings from './designArenaReviewedMappings.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from './seedCards';
import type { ConfigurationSourceLinkProvenance, SourceModelCard, SourceObservation } from '../types/admin_mapping';

export interface DesignArenaReviewedTarget {
  presetId: string;
  modelName: string;
  profile: string;
  harness: string;
  provenance: ConfigurationSourceLinkProvenance;
}

export interface DesignArenaReviewedMapping {
  cardId: string;
  productLineId: string;
  baseOpenRouterCardId: string;
  openRouterModelId: string;
  canonicalModelVersion: string;
  source: { arena: string; category: string; modelPermaslug: string; displayName: string };
  sourceProfile: { label: string; level: number; disclosed: boolean };
  reviewedReason: string;
  targets: readonly DesignArenaReviewedTarget[];
}

export interface DesignArenaReviewedManifest {
  schemaVersion: string;
  reviewedAt: string;
  entries: readonly DesignArenaReviewedMapping[];
}

interface LegacyDesignArenaRow {
  displayName: string;
  provider: string;
  openRouterId: string | null;
  elo: number;
}

interface OpenRouterDesignArenaRow {
  source: string;
  arena: string;
  category: string;
  model_permaslug: string;
  display_name: string;
  elo: number;
  win_rate: number;
  avg_generation_time_ms: number | null;
  tournament_stats?: Record<string, number>;
}

interface DesignArenaSnapshot {
  schemaVersion?: string;
  fetchedAt?: string;
  lastUpdated?: string | null;
  sourceAsOf?: string;
  source?: { apiUrl: string; leaderboardUrl: string; sha256: string; citation?: string;
    license?: string; rawSnapshotFile?: string; transport?: string };
  rows: readonly (LegacyDesignArenaRow | OpenRouterDesignArenaRow)[];
}

function buildReviewedDesignArenaSourceCards(
  data: DesignArenaSnapshot,
  baseCards: readonly SourceModelCard[],
  manifest: DesignArenaReviewedManifest,
) {
  const cards: SourceModelCard[] = [];
  const observations: SourceObservation[] = [];
  const unmatchedReviewedMappings: string[] = [];
  if (!data.source || !data.fetchedAt || !data.sourceAsOf
    || manifest.schemaVersion !== 'design-arena-reviewed-mappings/v1') {
    return { cards, observations, unmatchedReviewedMappings };
  }
  for (const review of manifest.entries) {
    const rows = data.rows.filter((row): row is OpenRouterDesignArenaRow => (
      'model_permaslug' in row && row.source === 'design-arena'
      && row.arena === review.source.arena && row.category === review.source.category
      && row.model_permaslug === review.source.modelPermaslug
      && row.display_name === review.source.displayName
    ));
    const bases = baseCards.filter(card => card.id === review.baseOpenRouterCardId
      && card.source === 'openrouter'
      && card.metadataJson?.sourceIdentity?.kind !== 'openrouter_standard_performance'
      && card.metadataJson?.sourceIdentity?.sourceRecordId === review.openRouterModelId
      && card.metadataJson?.sourceIdentity?.canonicalSlug === review.canonicalModelVersion
      && review.canonicalModelVersion === review.source.modelPermaslug
      && card.metadataJson?.scope?.productLineId === review.productLineId);
    if (rows.length !== 1 || bases.length !== 1 || !Number.isFinite(rows[0].elo)) {
      unmatchedReviewedMappings.push(review.cardId);
      continue;
    }
    const row = rows[0];
    const base = bases[0];
    const scope = { ...base.metadataJson?.scope,
      canonicalProfileKey: `${review.canonicalModelVersion}::designarena-${review.sourceProfile.label.toLowerCase()}` };
    const sourceRecordId = JSON.stringify([row.arena, row.category, row.model_permaslug, row.display_name]);
    cards.push({
      id: review.cardId, source: 'design_arena', exactSourceModelName: row.display_name,
      latestSnapshotDate: data.fetchedAt.slice(0, 10),
      metadataJson: {
        sourceUrl: data.source.apiUrl, sourceLeaderboard: data.source.leaderboardUrl,
        citation: data.source.citation, license: data.source.license, scope,
        sourceIdentity: {
          sourceRecordId, canonicalProfileKey: scope.canonicalProfileKey,
          openRouterId: review.openRouterModelId, modelPermaslug: row.model_permaslug,
          canonicalModelVersion: review.canonicalModelVersion, baseOpenRouterCardId: base.id,
          effort: review.sourceProfile.label, effortDisclosed: review.sourceProfile.disclosed,
          executionHarness: 'DesignArena Models Arena', benchmarkVersion: null,
          sha256: data.source.sha256, rawSnapshotFile: data.source.rawSnapshotFile,
          selectionMethod: 'reviewed-designarena-source-configuration',
        },
        reviewedMapping: { reviewedAt: manifest.reviewedAt, productLineId: review.productLineId,
          reason: review.reviewedReason, targets: review.targets },
      },
    });
    observations.push({
      id: `obs-${review.cardId}-frontend`, sourceModelCardId: review.cardId,
      metricId: 'designarena_frontend', rawValue: row.elo, unit: 'Elo',
      snapshotDate: data.fetchedAt.slice(0, 10), sourceUrl: data.source.apiUrl,
      sourceLeaderboard: data.source.leaderboardUrl,
      metadataJson: {
        scope, sourceRecordId, sourceField: 'data[].elo', sourceRecord: row,
        sourceAsOf: data.sourceAsOf, sourceLastUpdated: data.lastUpdated ?? null,
        sourceEffort: review.sourceProfile.label, sourceEffortDisclosed: review.sourceProfile.disclosed,
        sourceEnvironment: 'DesignArena Models Arena / codecategories',
        benchmarkVersion: null, sourceSampleCount: null, uncertaintyStatus: 'unknown',
        citation: data.source.citation, license: data.source.license,
        scoringRole: 'capability',
      },
    });
  }
  return { cards, observations, unmatchedReviewedMappings };
}

/** V2 uses authored full source identities and version-bound base cards. V1 remains readable for archives. */
export function buildDesignArenaSourceCards(
  data: DesignArenaSnapshot,
  baseCards: readonly SourceModelCard[],
  manifest: DesignArenaReviewedManifest = reviewedMappings as DesignArenaReviewedManifest,
) {
  if (data.schemaVersion === 'design-arena-source-snapshot/v2') {
    return buildReviewedDesignArenaSourceCards(data, baseCards, manifest);
  }
  const cards: SourceModelCard[] = [];
  const observations: SourceObservation[] = [];
  if (!data.source || !data.fetchedAt || !data.lastUpdated) return { cards, observations, unmatchedReviewedMappings: [] };
  const legacyRows = data.rows.filter((row): row is LegacyDesignArenaRow => 'openRouterId' in row);
  for (const row of legacyRows) {
    if (!row.openRouterId || !Number.isFinite(row.elo)
      || legacyRows.filter(candidate => candidate.openRouterId === row.openRouterId).length !== 1) continue;
    const candidates = baseCards.filter(card => card.source === 'openrouter'
      && card.metadataJson?.sourceIdentity?.sourceRecordId === row.openRouterId
      && card.metadataJson?.sourceIdentity?.kind !== 'openrouter_standard_performance');
    if (candidates.length !== 1) continue;
    const base = candidates[0];
    const id = `card-designarena-${base.id.replace(/^card-openrouter-/u, '')}`;
    const scope = { ...base.metadataJson?.scope, canonicalProfileKey: `${row.openRouterId}::designarena-default` };
    cards.push({id,source:'design_arena',exactSourceModelName:row.displayName,latestSnapshotDate:data.fetchedAt.slice(0,10),
      metadataJson:{sourceUrl:data.source.apiUrl,sourceLeaderboard:data.source.leaderboardUrl,scope,
        sourceIdentity:{sourceRecordId:row.openRouterId,canonicalProfileKey:scope.canonicalProfileKey,
          openRouterId:row.openRouterId,baseOpenRouterCardId:base.id,effort:'Default',sha256:data.source.sha256,
          selectionMethod:'exact-designarena-openrouter-id'}}});
    observations.push({id:`obs-${id}-frontend`,sourceModelCardId:id,metricId:'designarena_frontend',rawValue:row.elo,
      unit:'Elo',snapshotDate:data.fetchedAt.slice(0,10),sourceUrl:data.source.apiUrl,
      sourceLeaderboard:data.source.leaderboardUrl,metadataJson:{scope,sourceRecordId:row.openRouterId,
        sourceField:'data[].elo',sourceLastUpdated:data.lastUpdated,scoringRole:'capability'}});
  }
  return { cards, observations, unmatchedReviewedMappings: [] };
}
const projected = buildDesignArenaSourceCards(snapshot as DesignArenaSnapshot, JSON.parse(VERIFIED_SOURCE_MODEL_CARDS));
export const VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS = projected.cards;
export const VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS = projected.observations;
export const UNMATCHED_REVIEWED_DESIGN_ARENA_MAPPINGS = projected.unmatchedReviewedMappings;
