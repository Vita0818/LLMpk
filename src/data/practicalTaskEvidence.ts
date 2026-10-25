import snapshot from './artificialAnalysisSourceSnapshot.json';
import type { ConfigurationSourceLinkProvenance, SourceModelCard, SourceObservation } from '../types/admin_mapping';
import type { PracticalTaskMeasurement } from '../types/llm_pk';

interface ReviewedPracticalCard {
  card: SourceModelCard;
  provenance: ConfigurationSourceLinkProvenance;
  observations: SourceObservation[];
}

type Row = Record<string, any>;
const modelRows = new Map<string, Row>((snapshot.modelRecords as Row[]).flatMap(row =>
  [row.id, row.slug].filter((id): id is string => typeof id === 'string').map(id => [id, row])));
const agentRows = new Map<string, Row>((snapshot.codingAgentRecords as Row[]).map(row => [row.id, row]));
const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const nonnegative = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** A lower-effort capability result cannot establish a higher-effort runtime. */
function sameMeasuredProfile(provenance: ConfigurationSourceLinkProvenance) {
  if (provenance.kind === 'exact') return true;
  if (!('sourceProfile' in provenance) || !('targetProfile' in provenance)) return false;
  const normalize = (profile: string) => profile.toLowerCase().replace(/[-_\s]/gu, '');
  return normalize(provenance.sourceProfile) === normalize(provenance.targetProfile);
}

/** Consume only already-reviewed card links, never fuzzy model-name matches. */
export function buildPracticalTaskMeasurements(
  linkedCards: readonly ReviewedPracticalCard[],
  targetHarness: string | undefined,
): PracticalTaskMeasurement[] {
  const measurements = new Map<string, PracticalTaskMeasurement>();
  for (const { card, provenance, observations } of linkedCards) {
    if (!sameMeasuredProfile(provenance)) continue;
    const identity = card.metadataJson?.sourceIdentity;
    if (card.source === 'artificial_analysis'
      && identity?.selectionMethod === 'official-aa-coding-agent-local-snapshot') {
      const row = agentRows.get(identity.sourceRecordId);
      if (!row || card.metadataJson?.execution?.harness !== targetHarness
        || row.displayLabel !== card.exactSourceModelName
        || (row.safety?.fallbackAttemptCount ?? 0) > 0) continue;
      const suite = (row.evals as Row[] ?? []).map(e => String(e.datasetIndexName)).sort();
      if (suite.length === 0 || new Set(suite).size !== suite.length) continue;
      const timeSeconds = positive(row.mean?.agentWallTimeSec);
      const apiCostUSD = nonnegative(row.mean?.costUsd);
      if (timeSeconds === null && apiCostUSD === null) continue;
      if (!measurements.has('aa-agent')) measurements.set('aa-agent', {
        id: 'aa-agent', family: 'aa-agent', benchmark: 'AA Coding Agents',
        comparisonKey: `aa-agent:${suite.join('+')}`,
        referenceKey: `aa-agent:${row.id}`,
        timeSeconds, apiCostUSD, quality: nonnegative(row.indexScore),
        measurement: 'agent-wall-clock', sourceUrl: 'https://artificialanalysis.ai/agents/coding-agents',
        sourceUpdated: row.sourceSnapshotDate ?? snapshot.fetchedAt.slice(0, 10),
        sourceProfile: card.exactSourceModelName,
        sourceHarness: `${card.metadataJson?.execution?.harness} ${card.metadataJson?.execution?.harnessVersion ?? ''} · ${card.metadataJson?.execution?.provider ?? 'provider undisclosed'}`.trim(),
        notes: '实测代理阶段墙钟时间，包含失败/超时尝试；不是成功任务专属均值。按相同评测套件比较，备用模型混合运行不接入。',
      });
    } else if (card.source === 'artificial_analysis'
      && identity?.selectionMethod === 'official-aa-structured-snapshot') {
      const row = modelRows.get(identity.sourceRecordId);
      if (!row || row.name !== card.exactSourceModelName) continue;
      const timeSeconds = positive(row.intelligenceIndexTimePerTask);
      const apiCostUSD = nonnegative(row.intelligenceIndexCostPerTask);
      if (timeSeconds === null && apiCostUSD === null) continue;
      if (!measurements.has('aa-index')) measurements.set('aa-index', {
        id: 'aa-index', family: 'aa-index', benchmark: 'AA Intelligence Index',
        comparisonKey: `aa-index:${snapshot.fetchedAt.slice(0, 10)}`,
        referenceKey: `aa-index:${row.slug}`,
        timeSeconds, apiCostUSD, quality: nonnegative(row.intelligenceIndex),
        measurement: 'token-speed-estimate', sourceUrl: 'https://artificialanalysis.ai/leaderboards/models',
        sourceUpdated: snapshot.fetchedAt.slice(0, 10), sourceProfile: row.name,
        sourceHarness: 'AA Intelligence Index evaluation',
        notes: '用评测实际答案及推理 token 与实测 API 速度折算的任务时间；费用按评测 token 和 API 价格计算。不是逐任务直接计时。',
      });
    } else if (card.source === 'vals' && identity?.benchmarkSlug !== 'vals_index') {
      const observation = observations[0];
      const row = observation?.metadataJson?.sourceRecord;
      const evidence = observation?.metadataJson?.valsEvidence;
      if (!row || !evidence || evidence.hasRefusalFallbackNotice) continue;
      const timeSeconds = positive(row.latency);
      const apiCostUSD = nonnegative(row.cost_per_test);
      if (timeSeconds === null && apiCostUSD === null) continue;
      const id = `vals-${identity.benchmarkSlug}`;
      if (!measurements.has(id)) measurements.set(id, {
        id, family: 'vals', benchmark: `Vals ${identity.benchmarkName}`,
        comparisonKey: `vals:${identity.benchmarkSlug}:${identity.benchmarkVersion}:${identity.task}`,
        referenceKey: `${id}:${identity.sourceRecordId}`,
        timeSeconds, apiCostUSD, quality: observation.rawValue,
        measurement: 'task-latency', sourceUrl: evidence.sourceUrl,
        sourceUpdated: evidence.sourceUpdated,
        sourceProfile: evidence.sourceProfile,
        sourceHarness: `${evidence.sourceHarness ?? 'Vals benchmark scaffold (harness undisclosed)'} · ${row.provider ?? 'provider undisclosed'}`,
        notes: '来源公布的任务 latency 与 cost_per_test；按同一评测版本和任务口径比较，备用模型混合运行不接入。',
      });
    }
  }
  return [...measurements.values()];
}
