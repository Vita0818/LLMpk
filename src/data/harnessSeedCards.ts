import type { SourceModelCard, SourceObservation } from '../types/admin_mapping';
import {
  codingAgentRecords,
  fetchedAt as artificialAnalysisFetchedAt,
} from './artificialAnalysisSourceSnapshot.json';

const SOURCE_URL = 'https://artificialanalysis.ai/agents/coding-agents';
const SOURCE_LEADERBOARD = 'Artificial Analysis Coding Agent Index v1.3';
const SNAPSHOT_DATE = artificialAnalysisFetchedAt.slice(0, 10) || '2026-07-27';
const SCOPE_ID = 'oagxm-current-product-lines';
const SCOPE_VERSION = 'oagxm-current-product-lines/v5-2026-08-13-releases';

interface HarnessCodingAgentRow {
  key: string;
  sourceRecordId: string;
  /** Exact upstream AA label; differs only when LLMpk normalizes display copy. */
  sourceDisplayLabel?: string;
  displayLabel: string;
  harness: string;
  sourceHarnessLabel: string;
  provider: string;
  hostModelSlug: string;
  productLineId: string;
  productLineName: string;
  canonicalProfileKey: string;
  vendorId: string;
  vendorName: string;
  tier: 'official' | 'preview' | 'historical';
  indexScore: number;
  deepSwe?: number;
  sweAtlasQna?: number;
  terminalBenchV2?: number;
  meanCostUsd: number;
  meanAgentWallTimeSec: number;
  meanSteps: number;
  harnessVersion: string;
}

/**
 * Exact model+harness rows extracted from the official AA Coding Agent Index
 * snapshot. These are deliberately separate from the ordinary model cards:
 * their canonical profile key includes the harness and cannot be grouped with
 * Chat by the source-catalog matcher.
 */
const BASE_HARNESS_CODING_AGENT_ROWS: readonly HarnessCodingAgentRow[] = [
  {
    key: 'codex-gpt-5-6-sol-max',
    sourceRecordId: '345f8adb212fc6a898b2efc99650420f',
    displayLabel: 'Codex - GPT-5.6 Sol (max)',
    harness: 'Codex CLI',
    sourceHarnessLabel: 'Codex',
    provider: 'openai',
    hostModelSlug: 'openai_kindle-alpha-api',
    productLineId: 'gpt_56_sol',
    productLineName: 'GPT-5.6 Sol',
    canonicalProfileKey: 'gpt-5-6-sol-max-codex',
    vendorId: 'openai',
    vendorName: 'OpenAI',
    tier: 'official',
    indexScore: 0.6656984867090491,
    deepSwe: 0.687315634218289,
    sweAtlasQna: 0.432795698924731,
    terminalBenchV2: 0.876984126984127,
    meanCostUsd: 7.0835100321910645,
    meanAgentWallTimeSec: 610.0822637590861,
    meanSteps: 114.16303219106958,
    harnessVersion: '0.139.0',
  },
  {
    key: 'codex-gpt-5-6-terra-max',
    sourceRecordId: '99fc7a41674acd861df20610d8a84d04',
    displayLabel: 'Codex - GPT-5.6 Terra (max)',
    harness: 'Codex CLI',
    sourceHarnessLabel: 'Codex',
    provider: 'openai',
    hostModelSlug: 'openai_nova-alpha',
    productLineId: 'gpt_56_terra',
    productLineName: 'GPT-5.6 Terra',
    canonicalProfileKey: 'gpt-5-6-terra-max-codex',
    vendorId: 'openai',
    vendorName: 'OpenAI',
    tier: 'official',
    indexScore: 0.6228044140547706,
    deepSwe: 0.669616519174041,
    sweAtlasQna: 0.35752688172043,
    terminalBenchV2: 0.841269841269841,
    meanCostUsd: 2.7572348411214995,
    meanAgentWallTimeSec: 502.37997507788185,
    meanSteps: 96.90654205607477,
    harnessVersion: '0.140.0–0.141.0',
  },
  {
    key: 'codex-gpt-5-6-luna-max',
    sourceRecordId: '3a30362dcf759090896f412187029f11',
    displayLabel: 'Codex - GPT-5.6 Luna (max)',
    harness: 'Codex CLI',
    sourceHarnessLabel: 'Codex',
    provider: 'openai',
    hostModelSlug: 'openai_opal-alpha',
    productLineId: 'gpt_56_luna',
    productLineName: 'GPT-5.6 Luna',
    canonicalProfileKey: 'gpt-5-6-luna-max-codex',
    vendorId: 'openai',
    vendorName: 'OpenAI',
    tier: 'official',
    indexScore: 0.5865981086506351,
    deepSwe: 0.634218289085546,
    sweAtlasQna: 0.327956989247312,
    terminalBenchV2: 0.797619047619047,
    meanCostUsd: 1.5669569975077882,
    meanAgentWallTimeSec: 479.7352201453791,
    meanSteps: 114.99273104880581,
    harnessVersion: '0.141.0',
  },
  {
    key: 'claude-code-glm-5-2-max',
    sourceRecordId: '8b6eea9ec9aca082aed5713b4ffc5abb',
    displayLabel: 'Claude Code - GLM-5.2',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'novita',
    hostModelSlug: 'novita_glm-5-2_fp8',
    productLineId: 'glm_52',
    productLineName: 'GLM-5.2',
    canonicalProfileKey: 'glm-5-2-max-claude-code',
    vendorId: 'zai',
    vendorName: 'Z.ai',
    tier: 'official',
    indexScore: 0.4317779252895107,
    deepSwe: 0.286135693215339,
    sweAtlasQna: 0.290322580645161,
    terminalBenchV2: 0.718875502008032,
    meanCostUsd: 6.5111001416041745,
    meanAgentWallTimeSec: 1505.0868187500016,
    meanSteps: 126.75097179878048,
    harnessVersion: '2.1.153',
  },
  {
    key: 'claude-code-deepseek-v4-pro-high',
    sourceRecordId: 'e1d299b2461811a5e3922910872e21ac',
    sourceDisplayLabel: 'Claude Code - DeepSeek V4 Pro (high)',
    displayLabel: 'Claude Code - DeepSeek-v4-Pro (high)',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'deepseek',
    hostModelSlug: 'deepseek_deepseek-v4-pro-1m',
    productLineId: 'deepseek_v4_pro',
    productLineName: 'DeepSeek-v4-Pro',
    canonicalProfileKey: 'deepseek-v4-pro-high-claude-code',
    vendorId: 'deepseek',
    vendorName: 'DeepSeek',
    tier: 'official',
    indexScore: 0.31440020420893977,
    deepSwe: 0.0855457227138643,
    sweAtlasQna: 0.198924731182796,
    terminalBenchV2: 0.658730158730159,
    meanCostUsd: 0.2719346130986499,
    meanAgentWallTimeSec: 1072.4858556593977,
    meanSteps: 127.21495327102804,
    harnessVersion: '2.1.123–2.1.153',
  },
  {
    key: 'claude-code-claude-opus-4-8-max',
    sourceRecordId: 'd5768a9c2a80806a3eac3765b9550f4b',
    displayLabel: 'Claude Code - Opus 4.8 (max)',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'anthropic',
    hostModelSlug: 'anthropic_claude-opus-4-8',
    productLineId: 'claude_opus_48',
    productLineName: 'Claude Opus 4.8',
    canonicalProfileKey: 'claude-opus-4-8-max-claude-code',
    vendorId: 'anthropic',
    vendorName: 'Anthropic',
    tier: 'historical',
    indexScore: 0.6054088936618194,
    deepSwe: 0.557522123893805,
    sweAtlasQna: 0.46505376344086,
    terminalBenchV2: 0.793650793650793,
    meanCostUsd: 7.697531218302191,
    meanAgentWallTimeSec: 1387.705426272068,
    meanSteps: 165.77475115872653,
    harnessVersion: '2.1.154–2.1.160',
  },
  {
    key: 'claude-code-claude-opus-5-max',
    sourceRecordId: 'b4e3bfe152628dcb2a79bba1258dc84e',
    displayLabel: 'Claude Code - Opus 5 (max)',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'anthropic',
    hostModelSlug: 'anthropic_claude-hotteok-eap-rerun-2',
    productLineId: 'claude_opus_5',
    productLineName: 'Claude Opus 5',
    canonicalProfileKey: 'claude-opus-5-max-claude-code',
    vendorId: 'anthropic',
    vendorName: 'Anthropic',
    tier: 'official',
    indexScore: 0.655251281214741,
    deepSwe: 0.631268436578171,
    sweAtlasQna: 0.489247311827957,
    terminalBenchV2: 0.845238095238095,
    meanCostUsd: 8.949660113613344,
    meanAgentWallTimeSec: 1423.9871225337483,
    meanSteps: 166.05192107995848,
    harnessVersion: '2.1.218',
  },
  {
    key: 'claude-code-claude-fable-5-max',
    sourceRecordId: '1d6603e65afa69261ec25dd3db0ae990',
    displayLabel: 'Claude Code - Fable 5 (max) (with fallback)',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'anthropic',
    hostModelSlug: 'anthropic_claude-fable-5',
    productLineId: 'claude_fable_5',
    productLineName: 'Claude Fable 5',
    canonicalProfileKey: 'claude-fable-5-max-claude-code',
    vendorId: 'anthropic',
    vendorName: 'Anthropic',
    tier: 'official',
    indexScore: 0.658470366292233,
    deepSwe: 0.660766961651917,
    sweAtlasQna: 0.489247311827957,
    terminalBenchV2: 0.825396825396825,
    meanCostUsd: 11.710527040238846,
    meanAgentWallTimeSec: 1403.4044693665628,
    meanSteps: 137.83333333333334,
    harnessVersion: '2.1.170–2.1.216',
  },
  {
    key: 'claude-code-qwen3-7-plus-max',
    sourceRecordId: '5a84753fc015b73cd84a26c73977b4da',
    displayLabel: 'Claude Code - Qwen3.7 Plus (thinking)',
    harness: 'Claude Code',
    sourceHarnessLabel: 'Claude Code',
    provider: 'alibaba_cloud',
    hostModelSlug: 'alibaba_cloud_qwen3-7-plus',
    productLineId: 'qwen_37_plus',
    productLineName: 'Qwen 3.7 Plus',
    canonicalProfileKey: 'qwen3-7-plus-max-claude-code',
    vendorId: 'alibaba',
    vendorName: 'Alibaba / Qwen',
    tier: 'official',
    indexScore: 0.359697734519316,
    deepSwe: 0.191740412979351,
    sweAtlasQna: 0.236559139784946,
    terminalBenchV2: 0.650793650793651,
    meanCostUsd: 6.226261819189548,
    meanAgentWallTimeSec: 633.8206448598129,
    meanSteps: 145.85306334371754,
    harnessVersion: '2.1.163–2.1.167',
  },
  {
    key: 'grok-build-grok-4-5-high',
    sourceRecordId: '826cff5ab69aa8b11bf5ce37dd0c619c',
    displayLabel: 'Grok Build - Grok 4.5 (high)',
    harness: 'Grok Build',
    sourceHarnessLabel: 'Grok Build',
    provider: 'xai',
    hostModelSlug: 'xai_grok-4-5',
    productLineId: 'grok_45',
    productLineName: 'Grok 4.5',
    canonicalProfileKey: 'grok-4-5-high-grok-build',
    vendorId: 'xai',
    vendorName: 'xAI',
    tier: 'official',
    indexScore: 0.6443924859568593,
    deepSwe: 0.59882005899705,
    sweAtlasQna: 0.481182795698925,
    terminalBenchV2: 0.853174603174603,
    meanCostUsd: 2.594053333333331,
    meanAgentWallTimeSec: 991.6222637590873,
    meanSteps: 60.9055036344756,
    harnessVersion: '0.2.91',
  },
  {
    key: 'kimi-code-cli-kimi-k3-max',
    sourceRecordId: '6a3f4427a0ee251db8ba6e3e21bb7afe',
    displayLabel: 'Kimi Code CLI - Kimi K3',
    harness: 'Kimi Code CLI',
    sourceHarnessLabel: 'Kimi Code CLI',
    provider: 'moonshotai',
    hostModelSlug: 'moonshot_kimi-k3',
    productLineId: 'kimi_k3',
    productLineName: 'Kimi K3',
    canonicalProfileKey: 'kimi-k3-max-kimi-code-cli',
    vendorId: 'moonshot',
    vendorName: 'Moonshot AI',
    tier: 'official',
    indexScore: 0.6133537089146563,
    deepSwe: 0.63716814159292,
    sweAtlasQna: 0.365591397849462,
    terminalBenchV2: 0.837301587301587,
    meanCostUsd: 3.1751868971339587,
    meanAgentWallTimeSec: 1427.7253894081002,
    meanSteps: 124.60903426791278,
    harnessVersion: '0.26.0',
  },
  {
    key: 'opencode-muse-spark-1-1-xhigh',
    sourceRecordId: 'c8eeed9aed54ca291e444ff7b972d2de',
    displayLabel: 'Opencode - Muse Spark 1.1 (xhigh)',
    harness: 'OpenCode',
    sourceHarnessLabel: 'Opencode',
    provider: 'meta',
    hostModelSlug: 'meta_super-nova',
    productLineId: 'muse_spark_11',
    productLineName: 'Muse Spark 1.1',
    canonicalProfileKey: 'muse-spark-1-1-xhigh-opencode',
    vendorId: 'meta',
    vendorName: 'Meta',
    tier: 'preview',
    indexScore: 0.5354216416163317,
    deepSwe: 0.542772861356932,
    sweAtlasQna: 0.333333333333333,
    terminalBenchV2: 0.73015873015873,
    meanCostUsd: 1.4282406838058175,
    meanAgentWallTimeSec: 755.2098182762192,
    meanSteps: 55.43094496365525,
    harnessVersion: '1.17.13–1.17.14',
  },
];

interface StructuredHarnessBinding {
  key: string;
  /**
   * AA regenerates opaque row IDs on refresh. The upstream display label is
   * the stable published execution identity and is therefore the lookup key;
   * the current row ID is copied into provenance at generation time.
   */
  expectedDisplayLabel: string;
  /** Reader-facing label, when it intentionally differs from the AA label. */
  displayLabel?: string;
  harness: string;
  productLineId: string;
  productLineName: string;
  canonicalProfileKey: string;
  vendorId: string;
  vendorName: string;
  tier: HarnessCodingAgentRow['tier'];
}

/**
 * These current production-harness rows were previously present in the
 * structured AA snapshot but never projected into source cards. Keep only
 * stable identity metadata here; every numeric value is read directly from
 * the checked-in official snapshot.
 */
const STRUCTURED_HARNESS_BINDINGS: readonly StructuredHarnessBinding[] = [
  {
    key: 'antigravity-sdk-gemini-3-7-flash-high',
    expectedDisplayLabel: 'Antigravity SDK - Gemini 3.7 Flash (high)',
    harness: 'Antigravity SDK',
    productLineId: 'gemini_37_flash',
    productLineName: 'Gemini 3.7 Flash',
    canonicalProfileKey: 'gemini-3-7-flash-high-antigravity-sdk',
    vendorId: 'google',
    vendorName: 'Google',
    tier: 'official',
  },
  {
    key: 'opencode-gemini-3-7-flash-high',
    expectedDisplayLabel: 'Opencode - Gemini 3.7 Flash (high)',
    harness: 'OpenCode',
    productLineId: 'gemini_37_flash',
    productLineName: 'Gemini 3.7 Flash',
    canonicalProfileKey: 'gemini-3-7-flash-high-opencode',
    vendorId: 'google',
    vendorName: 'Google',
    tier: 'official',
  },
  {
    key: 'opencode-muse-spark-1-2-xhigh',
    expectedDisplayLabel: 'Opencode - Muse Spark 1.2 (xhigh)',
    harness: 'OpenCode',
    productLineId: 'muse_spark_12',
    productLineName: 'Muse Spark 1.2',
    canonicalProfileKey: 'muse-spark-1-2-xhigh-opencode',
    vendorId: 'meta',
    vendorName: 'Meta',
    tier: 'official',
  },
  {
    key: 'muse-code-muse-spark-1-2-xhigh',
    expectedDisplayLabel: 'Muse Code - Muse Spark 1.2 (xhigh)',
    harness: 'Muse Code',
    productLineId: 'muse_spark_12',
    productLineName: 'Muse Spark 1.2',
    canonicalProfileKey: 'muse-spark-1-2-xhigh-muse-code',
    vendorId: 'meta',
    vendorName: 'Meta',
    tier: 'official',
  },
  {
    key: 'codex-deepseek-v4-flash-0731-max',
    expectedDisplayLabel: 'Codex - DeepSeek V4 Flash 0731 (max)',
    displayLabel: 'Codex - DeepSeek-v4-Flash 0731 (max)',
    harness: 'Codex CLI',
    productLineId: 'deepseek_v4_flash_0731',
    productLineName: 'DeepSeek-v4-Flash 0731',
    canonicalProfileKey: 'deepseek-v4-flash-0731-max-codex',
    vendorId: 'deepseek',
    vendorName: 'DeepSeek',
    tier: 'official',
  },
  {
    key: 'opencode-gemini-3-6-flash-high',
    expectedDisplayLabel: 'Opencode - Gemini 3.6 Flash (high)',
    harness: 'OpenCode',
    productLineId: 'gemini_36_flash',
    productLineName: 'Gemini 3.6 Flash',
    canonicalProfileKey: 'gemini-3-6-flash-high-opencode',
    vendorId: 'google',
    vendorName: 'Google',
    tier: 'official',
  },
  {
    key: 'claude-code-qwen3-8-max',
    expectedDisplayLabel: 'Claude Code - Qwen3.8 Max',
    harness: 'Claude Code',
    productLineId: 'qwen_38_max',
    productLineName: 'Qwen3.8 Max',
    canonicalProfileKey: 'qwen3-8-max-xhigh-claude-code',
    vendorId: 'alibaba',
    vendorName: 'Alibaba / Qwen',
    tier: 'official',
  },
  {
    key: 'claude-code-claude-sonnet-4-6-medium',
    expectedDisplayLabel: 'Claude Code - Sonnet 4.6 (medium)',
    harness: 'Claude Code',
    productLineId: 'source-profile-claude-sonnet-4-6',
    productLineName: 'Claude Sonnet 4.6',
    canonicalProfileKey: 'claude-sonnet-4-6-medium-claude-code',
    vendorId: 'anthropic',
    vendorName: 'Anthropic',
    tier: 'historical',
  },
  {
    key: 'claude-code-claude-opus-4-7-max',
    expectedDisplayLabel: 'Claude Code - Opus 4.7 (max)',
    harness: 'Claude Code',
    productLineId: 'claude_opus_47',
    productLineName: 'Claude Opus 4.7',
    canonicalProfileKey: 'claude-opus-4-7-max-claude-code',
    vendorId: 'anthropic',
    vendorName: 'Anthropic',
    tier: 'historical',
  },
  {
    key: 'codex-gpt-5-5-xhigh',
    expectedDisplayLabel: 'Codex - GPT-5.5 (xhigh)',
    harness: 'Codex CLI',
    productLineId: 'gpt_55',
    productLineName: 'GPT-5.5',
    canonicalProfileKey: 'gpt-5-5-xhigh-codex',
    vendorId: 'openai',
    vendorName: 'OpenAI',
    tier: 'historical',
  },
  {
    key: 'gemini-cli-gemini-3-1-pro-high',
    expectedDisplayLabel: 'Gemini CLI - Gemini 3.1 Pro (high)',
    harness: 'Gemini CLI',
    productLineId: 'gemini_31_pro',
    productLineName: 'Gemini 3.1 Pro',
    canonicalProfileKey: 'gemini-3-1-pro-high-gemini-cli',
    vendorId: 'google',
    vendorName: 'Google',
    tier: 'historical',
  },
  {
    key: 'claude-code-kimi-k2-6-default',
    expectedDisplayLabel: 'Claude Code - Kimi K2.6',
    harness: 'Claude Code',
    productLineId: 'kimi_k26',
    productLineName: 'Kimi K2.6',
    canonicalProfileKey: 'kimi-k2-6-default-claude-code',
    vendorId: 'moonshot',
    vendorName: 'Moonshot AI',
    tier: 'historical',
  },
] as const;

interface StructuredCodingAgentRecord {
  id?: string;
  agentName?: string;
  provider?: string;
  hostModelSlug?: string;
  displayLabel?: string;
  indexScore?: number;
  evals?: Array<{
    datasetIndexName?: string;
    mean?: { reward?: number };
  }>;
  mean?: {
    costUsd?: number;
    agentWallTimeSec?: number;
    steps?: number;
  };
  versions?: Record<string, {
    min?: { version?: string };
    max?: { version?: string };
  }>;
}

const STRUCTURED_CODING_AGENT_RECORDS =
  codingAgentRecords as unknown as StructuredCodingAgentRecord[];

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function harnessVersionRange(record: StructuredCodingAgentRecord): string {
  const versions = Object.values(record.versions || {})
    .flatMap((range) => [range.min?.version, range.max?.version])
    .filter((value): value is string => Boolean(value));
  const unique = [...new Set(versions)].sort((left, right) => (
    left.localeCompare(right, 'en-US', { numeric: true })
  ));
  if (unique.length === 0) return 'not disclosed';
  return unique.length === 1 ? unique[0] : `${unique[0]}–${unique[unique.length - 1]}`;
}

function projectStructuredHarnessRow(
  binding: StructuredHarnessBinding,
): HarnessCodingAgentRow {
  const matches = STRUCTURED_CODING_AGENT_RECORDS.filter(
    (candidate) => candidate.displayLabel === binding.expectedDisplayLabel,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one current AA coding-agent row for ${binding.expectedDisplayLabel}; `
      + `found ${matches.length}.`,
    );
  }
  const record = matches[0];
  const sourceRecordId = record.id;
  const indexScore = finiteNumber(record.indexScore);
  const meanCostUsd = finiteNumber(record.mean?.costUsd);
  const meanAgentWallTimeSec = finiteNumber(record.mean?.agentWallTimeSec);
  const meanSteps = finiteNumber(record.mean?.steps);
  if (
    !sourceRecordId
    || indexScore === undefined
    || meanCostUsd === undefined
    || meanAgentWallTimeSec === undefined
    || meanSteps === undefined
  ) {
    throw new Error(`AA coding-agent record ${binding.expectedDisplayLabel} is missing required summary fields.`);
  }
  const rewardFor = (...datasetIndexNames: string[]): number | undefined => finiteNumber(
    record.evals?.find((evaluation) => (
      datasetIndexNames.includes(evaluation.datasetIndexName || '')
    ))?.mean?.reward,
  );

  return {
    ...binding,
    sourceDisplayLabel: binding.expectedDisplayLabel,
    displayLabel: binding.displayLabel || binding.expectedDisplayLabel,
    sourceRecordId,
    sourceHarnessLabel: record.agentName || binding.harness,
    provider: record.provider || binding.vendorId,
    hostModelSlug: record.hostModelSlug || '',
    indexScore,
    deepSwe: rewardFor('deep-swe'),
    sweAtlasQna: rewardFor('swe-atlas-qna'),
    terminalBenchV2: rewardFor('terminal-bench-v2', 'terminal-bench-v2.1'),
    meanCostUsd,
    meanAgentWallTimeSec,
    meanSteps,
    harnessVersion: harnessVersionRange(record),
  };
}

/**
 * The Coding Agent API may republish the same named execution under a new
 * internal row ID. Resolve the exact current display identity and copy every
 * numeric value from the checked-in snapshot so the hand-authored product
 * scope never leaves stale benchmark values behind after a source refresh.
 */
function projectCurrentBaseHarnessRow(row: HarnessCodingAgentRow): HarnessCodingAgentRow {
  const sourceDisplayLabel = row.sourceDisplayLabel || row.displayLabel;
  const matches = STRUCTURED_CODING_AGENT_RECORDS.filter(
    (candidate) => candidate.displayLabel === sourceDisplayLabel,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one current AA coding-agent row for ${sourceDisplayLabel}; found ${matches.length}.`,
    );
  }
  const record = matches[0];
  const sourceRecordId = record.id;
  const indexScore = finiteNumber(record.indexScore);
  const meanCostUsd = finiteNumber(record.mean?.costUsd);
  const meanAgentWallTimeSec = finiteNumber(record.mean?.agentWallTimeSec);
  const meanSteps = finiteNumber(record.mean?.steps);
  if (
    !sourceRecordId
    || indexScore === undefined
    || meanCostUsd === undefined
    || meanAgentWallTimeSec === undefined
    || meanSteps === undefined
  ) {
    throw new Error(`Current AA coding-agent row ${sourceDisplayLabel} is missing required fields.`);
  }
  const rewardFor = (...datasetIndexNames: string[]): number | undefined => finiteNumber(
    record.evals?.find((evaluation) => (
      datasetIndexNames.includes(evaluation.datasetIndexName || '')
    ))?.mean?.reward,
  );
  return {
    ...row,
    sourceRecordId,
    sourceHarnessLabel: record.agentName || row.sourceHarnessLabel,
    provider: record.provider || row.provider,
    hostModelSlug: record.hostModelSlug || row.hostModelSlug,
    indexScore,
    deepSwe: rewardFor('deep-swe'),
    sweAtlasQna: rewardFor('swe-atlas-qna'),
    terminalBenchV2: rewardFor('terminal-bench-v2', 'terminal-bench-v2.1'),
    meanCostUsd,
    meanAgentWallTimeSec,
    meanSteps,
    harnessVersion: harnessVersionRange(record),
  };
}

const HARNESS_CODING_AGENT_ROWS: readonly HarnessCodingAgentRow[] = [
  ...BASE_HARNESS_CODING_AGENT_ROWS.map(projectCurrentBaseHarnessRow),
  ...STRUCTURED_HARNESS_BINDINGS.map(projectStructuredHarnessRow),
];

function scopeFor(row: HarnessCodingAgentRow) {
  const sourceCatalogProductLine = row.productLineId.startsWith('source-profile-');
  return {
    scopeId: sourceCatalogProductLine ? 'llmpk-source-catalog' : SCOPE_ID,
    scopeVersion: sourceCatalogProductLine ? 'v1' : SCOPE_VERSION,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    productLineId: row.productLineId,
    productLineName: row.productLineName,
    tier: row.tier,
    rankingClass: 'formal_text_agent',
    canonicalProfileKey: row.canonicalProfileKey,
  };
}

export const VERIFIED_HARNESS_SOURCE_MODEL_CARDS: readonly SourceModelCard[] =
  HARNESS_CODING_AGENT_ROWS.map((row) => ({
    id: `card-aa-coding-agent-${row.key}`,
    source: 'artificial_analysis',
    exactSourceModelName: row.sourceDisplayLabel || row.displayLabel,
    latestSnapshotDate: SNAPSHOT_DATE,
    metadataJson: {
      sourceUrl: SOURCE_URL,
      sourceLeaderboard: SOURCE_LEADERBOARD,
      profileUrl: SOURCE_URL,
      scope: scopeFor(row),
      sourceIdentity: {
        source: 'artificial_analysis',
        sourceRecordId: row.sourceRecordId,
        exactSourceModelName: row.sourceDisplayLabel || row.displayLabel,
        selectionMethod: 'official-aa-coding-agent-local-snapshot',
        canonicalProfileKey: row.canonicalProfileKey,
        harnessName: row.harness,
        sourceHarnessLabel: row.sourceHarnessLabel,
      },
      execution: {
        harness: row.harness,
        sourceHarnessLabel: row.sourceHarnessLabel,
        provider: row.provider,
        hostModelSlug: row.hostModelSlug,
        harnessVersion: row.harnessVersion,
      },
    },
  }));

export const VERIFIED_HARNESS_SOURCE_OBSERVATIONS: readonly SourceObservation[] =
  HARNESS_CODING_AGENT_ROWS.flatMap((row) => {
    const metrics: Array<{
      metricId: string;
      rawValue: number | undefined;
      unit: string;
      sourceField: string;
    }> = [
      {
        metricId: 'aa_coding_agent_index',
        rawValue: row.indexScore,
        unit: 'pass@1 composite',
        sourceField: 'indexScore',
      },
      {
        metricId: 'aa_coding_agent_deepswe',
        rawValue: row.deepSwe,
        unit: 'pass@1',
        sourceField: 'evals.deep-swe.mean.reward',
      },
      {
        metricId: 'aa_coding_agent_swe_atlas_qna',
        rawValue: row.sweAtlasQna,
        unit: 'pass@1',
        sourceField: 'evals.swe-atlas-qna.mean.reward',
      },
      {
        metricId: 'aa_coding_agent_terminalbench_v2',
        rawValue: row.terminalBenchV2,
        unit: 'pass@1',
        sourceField: 'evals.terminal-bench-v2.1.mean.reward',
      },
    ];

    return metrics.flatMap(({ metricId, rawValue, unit, sourceField }) => {
      if (rawValue === undefined || !Number.isFinite(rawValue)) return [];
      const observation: SourceObservation = {
        id: `obs-card-aa-coding-agent-${row.key}-${metricId}`,
        sourceModelCardId: `card-aa-coding-agent-${row.key}`,
        metricId,
        rawValue,
        unit,
        snapshotDate: SNAPSHOT_DATE,
        sourceUrl: SOURCE_URL,
        sourceLeaderboard: SOURCE_LEADERBOARD,
        metadataJson: {
          sourceRecordId: row.sourceRecordId,
          sourceField,
          scope: scopeFor(row),
          harness: row.harness,
          sourceHarnessLabel: row.sourceHarnessLabel,
          hostModelSlug: row.hostModelSlug,
          componentScores: {
            deepSwe: row.deepSwe,
            sweAtlasQna: row.sweAtlasQna,
            terminalBenchV2: row.terminalBenchV2,
          },
          componentWeights: {
            deepSwe: 1 / 3,
            sweAtlasQna: 1 / 3,
            terminalBenchV2: 1 / 3,
          },
          meanCostUsd: row.meanCostUsd,
          meanAgentWallTimeSec: row.meanAgentWallTimeSec,
          meanSteps: row.meanSteps,
          harnessVersion: row.harnessVersion,
        },
      };
      return [observation];
    });
  });

export const VERIFIED_HARNESS_CONFIGURATION_COUNT = HARNESS_CODING_AGENT_ROWS.length;
