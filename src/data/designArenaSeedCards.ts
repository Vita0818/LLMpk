import snapshot from './designArenaSourceSnapshot.json';
import { VERIFIED_SOURCE_MODEL_CARDS } from './seedCards';
import type { SourceModelCard, SourceObservation } from '../types/admin_mapping';

interface DesignArenaSnapshot {
  fetchedAt?: string;
  lastUpdated?: string;
  source?: { apiUrl: string; leaderboardUrl: string; sha256: string };
  rows: { displayName: string; provider: string; openRouterId: string | null; elo: number }[];
}

/** Strict model-ID join. Ambiguous names and rows without an exact route stay unlinked. */
export function buildDesignArenaSourceCards(data: DesignArenaSnapshot, baseCards: readonly SourceModelCard[]) {
  const cards: SourceModelCard[] = [];
  const observations: SourceObservation[] = [];
  if (!data.source || !data.fetchedAt || !data.lastUpdated) return { cards, observations };
  for (const row of data.rows) {
    if (!row.openRouterId || !Number.isFinite(row.elo)) continue;
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
  return { cards, observations };
}
const projected = buildDesignArenaSourceCards(snapshot as DesignArenaSnapshot, JSON.parse(VERIFIED_SOURCE_MODEL_CARDS));
export const VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS = projected.cards;
export const VERIFIED_DESIGN_ARENA_SOURCE_OBSERVATIONS = projected.observations;
