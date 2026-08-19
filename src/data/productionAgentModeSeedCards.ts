import type { SourceModelCard, SourceObservation } from '../types/admin_mapping';
import {
  VERIFIED_SOURCE_MODEL_CARDS,
  VERIFIED_SOURCE_OBSERVATIONS,
} from './seedCards';

/**
 * Arena Agent Mode is a user-facing execution mode, unlike the internal
 * scaffolding used to run an ordinary model-level benchmark. These reviewed
 * cards are projected because several Arena source records also contain Text
 * or WebDev rows, which belong to different execution modes.
 */
const ARENA_AGENT_METRIC_IDS = new Set([
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]);

const REVIEWED_ARENA_AGENT_BASE_CARD_IDS = [
  // Arena's current Agent leaderboard publishes the 0731 release as this
  // dated High-effort identity. The undated Flash card now has Text rows only.
  'card-arena-deepseek-v4-flash-high-20260731',
  'card-arena-hy3',
  'card-arena-minimax-m3',
  'card-arena-claude-sonnet-5-high',
  'card-arena-gemini-3-5-flash-high',
  'card-arena-qwen3-7-max',
  'card-arena-nemotron-3-ultra',
  'card-arena-gpt-5-5-xhigh',
  // Explicitly retained historical families with genuine Arena Agent rows.
  'card-arena-gemini-3-1-pro-preview',
  'card-arena-claude-opus-4-7-high',
  'card-arena-claude-opus-4-6',
  'card-arena-claude-sonnet-4-6',
  'card-arena-kimi-k2-6',
  // Generic Agent observations that may fill a higher, named production
  // harness while retaining Arena Agent Mode as their source environment.
  'card-arena-deepseek-v4-pro',
  'card-arena-glm-5-2-max',
  'card-arena-qwen3-7-plus',
  'card-arena-gpt-5-6-sol-xhigh',
  'card-arena-gpt-5-6-terra-xhigh',
  'card-arena-gpt-5-6-luna-xhigh',
  'card-arena-claude-fable-5-high',
  'card-arena-claude-opus-4-8-high',
  'card-arena-grok-4-5',
  // Arena currently publishes this row as `kimi-k3-max`. Keep the exact
  // current card id here so its genuine Agent Mode observations are projected
  // instead of silently disappearing after a source refresh.
  'card-arena-kimi-k3-max',
  'card-arena-muse-spark-1-1',
] as const;

const BASE_CARDS = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];
const BASE_OBSERVATIONS = JSON.parse(VERIFIED_SOURCE_OBSERVATIONS) as SourceObservation[];
const BASE_CARDS_BY_ID = new Map(BASE_CARDS.map((card) => [card.id, card]));

export function productionAgentModeCardId(baseCardId: string): string {
  return `card-arena-agent-mode-${baseCardId.replace(/^card-arena-/u, '')}`;
}

const projectedCards: SourceModelCard[] = [];
const projectedObservations: SourceObservation[] = [];

for (const baseCardId of REVIEWED_ARENA_AGENT_BASE_CARD_IDS) {
  const baseCard = BASE_CARDS_BY_ID.get(baseCardId);
  if (!baseCard || baseCard.source !== 'arena') continue;
  const observations = BASE_OBSERVATIONS.filter((observation) => (
    observation.sourceModelCardId === baseCardId
    && ARENA_AGENT_METRIC_IDS.has(observation.metricId)
  ));
  if (observations.length === 0) continue;

  const cardId = productionAgentModeCardId(baseCardId);
  const baseScope = baseCard.metadataJson?.scope || {};
  const baseSourceIdentity = baseCard.metadataJson?.sourceIdentity || {};
  const canonicalProfileKey = String(
    baseScope.canonicalProfileKey
    || baseSourceIdentity.canonicalProfileKey
    || baseCardId,
  );
  projectedCards.push({
    id: cardId,
    source: 'arena',
    exactSourceModelName: `${baseCard.exactSourceModelName} · Arena Agent Mode`,
    latestSnapshotDate: baseCard.latestSnapshotDate,
    metadataJson: {
      ...baseCard.metadataJson,
      sourceLeaderboard: 'Arena Agent Mode',
      sourceRecordIds: observations.map((observation) => (
        String(observation.metadataJson?.sourceRecordId || observation.id)
      )),
      scope: {
        ...baseScope,
        canonicalProfileKey: `${canonicalProfileKey}::arena-agent-mode`,
      },
      sourceIdentity: {
        ...baseSourceIdentity,
        sourceRecordId: `${String(
          baseSourceIdentity.sourceRecordId || baseCardId
        )}::arena-agent-mode`,
        selectionMethod: 'reviewed-production-agent-mode-projection',
        canonicalProfileKey: `${canonicalProfileKey}::arena-agent-mode`,
        baseSourceCardId: baseCardId,
        executionHarness: 'Arena Agent Mode',
        executionEnvironment: 'Arena Agent Mode',
      },
    },
  });

  observations.forEach((observation) => {
    projectedObservations.push({
      ...observation,
      id: `obs-${cardId}-${observation.metricId}`,
      sourceModelCardId: cardId,
      metadataJson: {
        ...observation.metadataJson,
        baseSourceObservationId: observation.id,
        baseSourceModelCardId: baseCardId,
        executionHarness: 'Arena Agent Mode',
        executionEnvironment: 'Arena Agent Mode',
      },
    });
  });
}

export const VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS:
readonly SourceModelCard[] = projectedCards;

export const VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS:
readonly SourceObservation[] = projectedObservations;
