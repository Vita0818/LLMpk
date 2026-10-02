import type { SourceModelCard, SourceObservation, SourceType } from '../types/admin_mapping';
import { OAGXM_SCOPE } from './oagxmScope';

const CURRENT_SCOPE_ID = 'oagxm-current-product-lines';
const CURRENT_SCOPE_VERSION = OAGXM_SCOPE.schemaVersion;

type BenchmarkSource = Extract<
  SourceType,
  'scale_labs' | 'terminal_bench' | 'swe_rebench' | 'frontier_code'
>;

interface ProductScopeSpec {
  vendorId: string;
  vendorName: string;
  productLineId: string;
  productLineName: string;
  tier: 'official' | 'preview' | 'historical';
}

interface BenchmarkObservationSpec {
  metricId: string;
  rawValue: number;
  unit: string;
  sourceUrl: string;
  sourceLeaderboard: string;
  sourceField: string;
  confidenceRadius?: number;
  taskCount?: number;
  trialsPerTask?: number;
  standardError?: number;
}

interface BenchmarkCardSpec {
  id: string;
  source: BenchmarkSource;
  exactSourceModelName: string;
  snapshotDate: string;
  scope: ProductScopeSpec;
  canonicalProfileKey: string;
  sourceRecordId: string;
  harness?: string;
  effort?: string;
  companionForCardId?: string;
  observations: readonly BenchmarkObservationSpec[];
}

const PRODUCTS = {
  gpt6Astra: {
    vendorId: 'openai', vendorName: 'OpenAI', productLineId: 'gpt_6_astra',
    productLineName: 'GPT-6 Astra', tier: 'official',
  },
  gpt56Sol: {
    vendorId: 'openai', vendorName: 'OpenAI', productLineId: 'gpt_56_sol',
    productLineName: 'GPT-5.6 Sol', tier: 'official',
  },
  gpt56Terra: {
    vendorId: 'openai', vendorName: 'OpenAI', productLineId: 'gpt_56_terra',
    productLineName: 'GPT-5.6 Terra', tier: 'official',
  },
  gpt56Luna: {
    vendorId: 'openai', vendorName: 'OpenAI', productLineId: 'gpt_56_luna',
    productLineName: 'GPT-5.6 Luna', tier: 'official',
  },
  gpt55: {
    vendorId: 'openai', vendorName: 'OpenAI', productLineId: 'gpt_55',
    productLineName: 'GPT-5.5', tier: 'historical',
  },
  fable51: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_fable_51',
    productLineName: 'Claude Fable 5.1', tier: 'official',
  },
  fable5: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_fable_5',
    productLineName: 'Claude Fable 5', tier: 'historical',
  },
  opus5: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_opus_5',
    productLineName: 'Claude Opus 5', tier: 'official',
  },
  opus48: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_opus_48',
    productLineName: 'Claude Opus 4.8', tier: 'historical',
  },
  opus47: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_opus_47',
    productLineName: 'Claude Opus 4.7', tier: 'historical',
  },
  sonnet5: {
    vendorId: 'anthropic', vendorName: 'Anthropic', productLineId: 'claude_sonnet_5',
    productLineName: 'Claude Sonnet 5', tier: 'official',
  },
  gemini31Pro: {
    vendorId: 'google', vendorName: 'Google', productLineId: 'gemini_31_pro',
    productLineName: 'Gemini 3.1 Pro', tier: 'preview',
  },
  gemini35Flash: {
    vendorId: 'google', vendorName: 'Google', productLineId: 'gemini_35_flash',
    productLineName: 'Gemini 3.5 Flash', tier: 'official',
  },
  gemini36Flash: {
    vendorId: 'google', vendorName: 'Google', productLineId: 'gemini_36_flash',
    productLineName: 'Gemini 3.6 Flash', tier: 'official',
  },
  gemini37Flash: {
    vendorId: 'google', vendorName: 'Google', productLineId: 'gemini_37_flash',
    productLineName: 'Gemini 3.7 Flash', tier: 'official',
  },
  gemini38Flash: {
    vendorId: 'google', vendorName: 'Google', productLineId: 'gemini_38_flash',
    productLineName: 'Gemini 3.8 Flash', tier: 'official',
  },
  grok45: {
    vendorId: 'xai', vendorName: 'xAI', productLineId: 'grok_45',
    productLineName: 'Grok 4.5', tier: 'official',
  },
  grok46: {
    vendorId: 'xai', vendorName: 'xAI', productLineId: 'grok_46',
    productLineName: 'Grok 4.6', tier: 'official',
  },
  glm52: {
    vendorId: 'zai', vendorName: 'Z.ai', productLineId: 'glm_52',
    productLineName: 'GLM-5.2', tier: 'official',
  },
  glm53: {
    vendorId: 'zai', vendorName: 'Z.ai', productLineId: 'glm_53',
    productLineName: 'GLM-5.3', tier: 'official',
  },
  glm53Flash: {
    vendorId: 'zai', vendorName: 'Z.ai', productLineId: 'glm_53_flash',
    productLineName: 'GLM-5.3-Flash', tier: 'official',
  },
  kimiK3: {
    vendorId: 'moonshot', vendorName: 'Moonshot AI', productLineId: 'kimi_k3',
    productLineName: 'Kimi K3', tier: 'official',
  },
  minimaxM3: {
    vendorId: 'minimax', vendorName: 'MiniMax', productLineId: 'minimax_m3',
    productLineName: 'MiniMax M3', tier: 'official',
  },
  deepseekV4Pro: {
    vendorId: 'deepseek', vendorName: 'DeepSeek', productLineId: 'deepseek_v4_pro',
    productLineName: 'DeepSeek-v4-Pro', tier: 'official',
  },
  deepseekV4Pro0813: {
    vendorId: 'deepseek', vendorName: 'DeepSeek', productLineId: 'deepseek_v4_pro_0813',
    productLineName: 'DeepSeek-v4-Pro 0813', tier: 'official',
  },
  deepseekV4Flash0731: {
    vendorId: 'deepseek', vendorName: 'DeepSeek', productLineId: 'deepseek_v4_flash_0731',
    productLineName: 'DeepSeek-v4-Flash 0731', tier: 'official',
  },
} as const satisfies Record<string, ProductScopeSpec>;

const ENIGMA_URL = 'https://labs.scale.com/leaderboard/enigma_eval';
const TBENCH_URL = 'https://www.tbench.ai/';
const TBENCH_SCIENCE_URL = 'https://www.terminal-bench-science.ai/';
const SWE_REBENCH_URL = 'https://swe-rebench.com/';
const FRONTIERCODE_URL = 'https://cognition.com/frontiercode';

const enigma = (
  id: string,
  name: string,
  scope: ProductScopeSpec,
  canonicalProfileKey: string,
  rawValue: number,
  confidenceRadius: number,
  companionForCardId?: string,
): BenchmarkCardSpec => ({
  id: `card-scale-enigmaeval-${id}`,
  source: 'scale_labs',
  exactSourceModelName: name,
  snapshotDate: '2026-07-23',
  scope,
  canonicalProfileKey,
  sourceRecordId: `enigmaeval:${id}`,
  companionForCardId,
  observations: [{
    metricId: 'scale_enigmaeval',
    rawValue,
    unit: 'pass@1',
    sourceUrl: ENIGMA_URL,
    sourceLeaderboard: 'Scale Labs · EnigmaEval',
    sourceField: 'leaderboard.accuracy',
    confidenceRadius,
    taskCount: 1161,
    trialsPerTask: 1,
  }],
});

const sweRebench = (
  id: string,
  name: string,
  scope: ProductScopeSpec,
  canonicalProfileKey: string,
  rawValue: number,
  standardError: number,
  companionForCardId?: string,
): BenchmarkCardSpec => ({
  id: `card-swe-rebench-v2-${id}`,
  source: 'swe_rebench',
  exactSourceModelName: name,
  snapshotDate: '2026-07-01',
  scope,
  canonicalProfileKey,
  sourceRecordId: `swe-rebench-v2:2026-05-15_2026-07-01:${id}`,
  companionForCardId,
  observations: [{
    metricId: 'swe_rebench_v2',
    rawValue,
    unit: 'Resolved Rate',
    sourceUrl: SWE_REBENCH_URL,
    sourceLeaderboard: 'SWE-rebench v2 · 2026-05-15 to 2026-07-01',
    sourceField: 'leaderboard.resolvedRate',
    standardError,
    taskCount: 111,
    trialsPerTask: 5,
  }],
});

const tbenchObservation = (
  metricId: 'tbench_v4' | 'tbench_science_v01',
  rawValue: number,
  confidenceRadius: number,
): BenchmarkObservationSpec => ({
  metricId,
  rawValue,
  unit: 'Resolution Rate',
  sourceUrl: metricId === 'tbench_v4' ? TBENCH_URL : TBENCH_SCIENCE_URL,
  sourceLeaderboard: metricId === 'tbench_v4'
    ? 'Terminal-Bench 4.0'
    : 'Terminal-Bench-Science 0.1',
  sourceField: 'leaderboard.resolutionRate',
  confidenceRadius,
  taskCount: metricId === 'tbench_v4' ? 66 : 70,
  trialsPerTask: metricId === 'tbench_v4' ? 5 : 3,
});

const tbench = (
  id: string,
  name: string,
  scope: ProductScopeSpec,
  canonicalProfileKey: string,
  harness: string,
  effort: string,
  observations: readonly BenchmarkObservationSpec[],
  companionForCardId?: string,
): BenchmarkCardSpec => ({
  id: `card-tbench-${id}`,
  source: 'terminal_bench',
  exactSourceModelName: `${name} (${effort}) · ${harness}`,
  snapshotDate: '2026-09-04',
  scope,
  canonicalProfileKey,
  sourceRecordId: `terminal-bench:${id}`,
  harness,
  effort,
  companionForCardId,
  observations,
});

const frontierCode = (
  id: string,
  name: string,
  scope: ProductScopeSpec,
  canonicalProfileKey: string,
  harness: string,
  effort: string,
  passRate: number,
  companionForCardId?: string,
): BenchmarkCardSpec => ({
  id: `card-frontiercode-v11-${id}`,
  source: 'frontier_code',
  exactSourceModelName: `${name}${effort ? ` (${effort})` : ''} · ${harness}`,
  snapshotDate: '2026-09-03',
  scope,
  canonicalProfileKey,
  sourceRecordId: `frontiercode-v1.1-main:${id}`,
  harness,
  effort,
  companionForCardId,
  observations: [{
    metricId: 'frontiercode_v11_main_pass_rate',
    rawValue: passRate,
    unit: 'Pass Rate',
    sourceUrl: FRONTIERCODE_URL,
    sourceLeaderboard: 'FrontierCode 1.1 Main · Best reasoning mode',
    sourceField: 'leaderboard.main.passRate',
    taskCount: 100,
    trialsPerTask: 5,
  }],
});

const CARD_SPECS: readonly BenchmarkCardSpec[] = [
  enigma('claude-fable-5-high', 'Claude Fable 5 (high)', PRODUCTS.fable5, 'claude-fable-5-high', 0.3928, 0.0280),
  enigma('gpt-5-6-sol-high', 'GPT-5.6 Sol (high)', PRODUCTS.gpt56Sol, 'gpt-5-6-sol-high', 0.3712, 0.0280, 'card-aa-gpt-5-6-sol-high'),
  enigma('gemini-3-1-pro-preview-high', 'Gemini 3.1 Pro Preview (high)', PRODUCTS.gemini31Pro, 'gemini-3-1-pro-preview-high', 0.3678, 0.0271, 'card-openrouter-google-gemini-3-1-pro-preview'),
  enigma('gemini-3-5-flash-high', 'Gemini 3.5 Flash (high)', PRODUCTS.gemini35Flash, 'gemini-3-5-flash-high', 0.2541, 0.0245, 'card-aa-gemini-3-5-flash'),
  enigma('claude-opus-4-8-xhigh', 'Claude Opus 4.8 (xhigh)', PRODUCTS.opus48, 'claude-opus-4-8-xhigh', 0.2351, 0.0241),

  sweRebench('claude-fable-5-high', 'Claude Fable 5 (high)', PRODUCTS.fable5, 'claude-fable-5-high', 0.645, 0.0141),
  sweRebench('grok-4-5-high', 'Grok 4.5 (high)', PRODUCTS.grok45, 'grok-4-5-default-high', 0.638, 0.0060, 'card-aa-grok-4-5'),
  sweRebench('claude-opus-5-high', 'Claude Opus 5 (high)', PRODUCTS.opus5, 'claude-opus-5-default-high', 0.634, 0.0135, 'card-aa-claude-opus-5-high'),
  sweRebench('glm-5-2-high', 'GLM-5.2 (high)', PRODUCTS.glm52, 'glm-5-2-high', 0.629, 0.0119),
  sweRebench('gpt-5-6-sol-medium', 'GPT-5.6 Sol (medium)', PRODUCTS.gpt56Sol, 'gpt-5-6-sol-medium', 0.623, 0.0183, 'card-aa-gpt-5-6-sol-medium'),
  sweRebench('claude-sonnet-5-high', 'Claude Sonnet 5 (high)', PRODUCTS.sonnet5, 'claude-sonnet-5-default-high', 0.568, 0.0094),
  sweRebench('minimax-m3', 'MiniMax M3', PRODUCTS.minimaxM3, 'minimax-m3', 0.472, 0.0113, 'card-aa-minimax-m3'),
  sweRebench('gpt-5-6-luna-medium', 'GPT-5.6 Luna (medium)', PRODUCTS.gpt56Luna, 'gpt-5-6-luna-medium', 0.436, 0.0147, 'card-aa-gpt-5-6-luna-medium'),
  sweRebench('deepseek-v4-pro-high', 'DeepSeek V4 Pro (high)', PRODUCTS.deepseekV4Pro, 'deepseek-v4-pro-reasoning-high-effort', 0.402, 0.0129, 'card-aa-deepseek-v4-pro-0424-high'),

  tbench('gpt-6-astra-max-codex', 'GPT-6 Astra', PRODUCTS.gpt6Astra, 'gpt-6-astra-max-codex', 'Codex CLI', 'max', [tbenchObservation('tbench_v4', 0.582, 0.028)]),
  tbench('claude-fable-5-1-max-claude-code', 'Claude Fable 5.1', PRODUCTS.fable51, 'claude-fable-5-1-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.579, 0.038)]),
  tbench('claude-opus-5-max-claude-code', 'Claude Opus 5', PRODUCTS.opus5, 'claude-opus-5-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.518, 0.034), tbenchObservation('tbench_science_v01', 0.300, 0.032)], 'card-aa-coding-agent-claude-code-claude-opus-5-max'),
  tbench('claude-fable-5-max-claude-code', 'Claude Fable 5', PRODUCTS.fable5, 'claude-fable-5-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.445, 0.038), tbenchObservation('tbench_science_v01', 0.214, 0.028)], 'card-aa-coding-agent-claude-code-claude-fable-5-max'),
  tbench('glm-5-3-max-claude-code', 'GLM-5.3', PRODUCTS.glm53, 'glm-5-3-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.418, 0.032), tbenchObservation('tbench_science_v01', 0.081, 0.019)]),
  tbench('gpt-5-6-sol-max-codex', 'GPT-5.6 Sol', PRODUCTS.gpt56Sol, 'gpt-5-6-sol-max-codex', 'Codex CLI', 'max', [tbenchObservation('tbench_v4', 0.373, 0.038), tbenchObservation('tbench_science_v01', 0.224, 0.029)], 'card-aa-coding-agent-codex-gpt-5-6-sol-max'),
  tbench('claude-opus-4-8-max-claude-code', 'Claude Opus 4.8', PRODUCTS.opus48, 'claude-opus-4-8-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.236, 0.036), tbenchObservation('tbench_science_v01', 0.105, 0.021)], 'card-aa-coding-agent-claude-code-claude-opus-4-8-max'),
  tbench('gpt-5-6-terra-max-codex', 'GPT-5.6 Terra', PRODUCTS.gpt56Terra, 'gpt-5-6-terra-max-codex', 'Codex CLI', 'max', [tbenchObservation('tbench_v4', 0.215, 0.033), tbenchObservation('tbench_science_v01', 0.086, 0.019)], 'card-aa-coding-agent-codex-gpt-5-6-terra-max'),
  tbench('grok-4-6-high-grok-build', 'Grok 4.6', PRODUCTS.grok46, 'grok-4-6-high-grok-build', 'Grok Build', 'high', [tbenchObservation('tbench_v4', 0.203, 0.031)]),
  tbench('grok-4-6-xhigh-grok-build', 'Grok 4.6', PRODUCTS.grok46, 'grok-4-6-xhigh-grok-build', 'Grok Build', 'xhigh', [tbenchObservation('tbench_science_v01', 0.071, 0.018)]),
  tbench('gemini-3-8-flash-high-mini-swe-agent', 'Gemini 3.8 Flash', PRODUCTS.gemini38Flash, 'gemini-3-8-flash-high-mini-swe-agent', 'mini-SWE-agent', 'high', [tbenchObservation('tbench_v4', 0.191, 0.034), tbenchObservation('tbench_science_v01', 0.124, 0.023)]),
  tbench('gpt-5-6-luna-max-codex', 'GPT-5.6 Luna', PRODUCTS.gpt56Luna, 'gpt-5-6-luna-max-codex', 'Codex CLI', 'max', [tbenchObservation('tbench_v4', 0.173, 0.028), tbenchObservation('tbench_science_v01', 0.033, 0.012)], 'card-aa-coding-agent-codex-gpt-5-6-luna-max'),
  tbench('grok-4-5-high-grok-build', 'Grok 4.5', PRODUCTS.grok45, 'grok-4-5-high-grok-build', 'Grok Build', 'high', [tbenchObservation('tbench_v4', 0.124, 0.026)], 'card-aa-coding-agent-grok-build-grok-4-5-high'),
  tbench('claude-sonnet-5-max-claude-code', 'Claude Sonnet 5', PRODUCTS.sonnet5, 'claude-sonnet-5-max-claude-code', 'Claude Code', 'max', [tbenchObservation('tbench_v4', 0.124, 0.031)]),
  tbench('gemini-3-7-flash-high-mini-swe-agent', 'Gemini 3.7 Flash', PRODUCTS.gemini37Flash, 'gemini-3-7-flash-high-mini-swe-agent', 'mini-SWE-agent', 'high', [tbenchObservation('tbench_v4', 0.112, 0.024), tbenchObservation('tbench_science_v01', 0.057, 0.016)]),

  frontierCode('claude-fable-5-xhigh-claude-code', 'Claude Fable 5', PRODUCTS.fable5, 'claude-fable-5-xhigh-claude-code', 'Claude Code', 'xhigh', 0.589),
  frontierCode('claude-opus-5-medium-claude-code', 'Claude Opus 5', PRODUCTS.opus5, 'claude-opus-5-medium-claude-code', 'Claude Code', 'medium', 0.589),
  frontierCode('gpt-6-astra-max-codex', 'GPT-6 Astra', PRODUCTS.gpt6Astra, 'gpt-6-astra-max-codex', 'Codex CLI', 'max', 0.588),
  frontierCode('claude-fable-5-1-medium-claude-code', 'Claude Fable 5.1', PRODUCTS.fable51, 'claude-fable-5-1-medium-claude-code', 'Claude Code', 'medium', 0.555),
  frontierCode('grok-4-6-high-grok-build', 'Grok 4.6', PRODUCTS.grok46, 'grok-4-6-high-grok-build', 'Grok Build', 'high', 0.531),
  frontierCode('gpt-5-6-sol-max-codex', 'GPT-5.6 Sol', PRODUCTS.gpt56Sol, 'gpt-5-6-sol-max-codex', 'Codex CLI', 'max', 0.529, 'card-aa-coding-agent-codex-gpt-5-6-sol-max'),
  frontierCode('claude-opus-4-8-max-claude-code', 'Claude Opus 4.8', PRODUCTS.opus48, 'claude-opus-4-8-max-claude-code', 'Claude Code', 'max', 0.516, 'card-aa-coding-agent-claude-code-claude-opus-4-8-max'),
  frontierCode('kimi-k3-mini-swe-agent', 'Kimi K3', PRODUCTS.kimiK3, 'kimi-k3-mini-swe-agent', 'mini-SWE-agent', '', 0.489),
  frontierCode('gemini-3-7-flash-medium-chisel', 'Gemini 3.7 Flash', PRODUCTS.gemini37Flash, 'gemini-3-7-flash-medium-chisel', 'Chisel', 'medium', 0.489),
  frontierCode('gpt-5-5-xhigh-codex', 'GPT-5.5', PRODUCTS.gpt55, 'gpt-5-5-xhigh-codex', 'Codex CLI', 'xhigh', 0.482, 'card-aa-coding-agent-codex-gpt-5-5-xhigh'),
  frontierCode('claude-sonnet-5-xhigh-claude-code', 'Claude Sonnet 5', PRODUCTS.sonnet5, 'claude-sonnet-5-xhigh-claude-code', 'Claude Code', 'xhigh', 0.476),
  frontierCode('grok-4-5-high-grok-build', 'Grok 4.5', PRODUCTS.grok45, 'grok-4-5-high-grok-build', 'Grok Build', 'high', 0.472, 'card-aa-coding-agent-grok-build-grok-4-5-high'),
  frontierCode('gpt-5-6-terra-max-codex', 'GPT-5.6 Terra', PRODUCTS.gpt56Terra, 'gpt-5-6-terra-max-codex', 'Codex CLI', 'max', 0.463, 'card-aa-coding-agent-codex-gpt-5-6-terra-max'),
  frontierCode('gemini-3-8-flash-medium-chisel', 'Gemini 3.8 Flash', PRODUCTS.gemini38Flash, 'gemini-3-8-flash-medium-chisel', 'Chisel', 'medium', 0.467),
  frontierCode('glm-5-3-max-chisel', 'GLM-5.3', PRODUCTS.glm53, 'glm-5-3-max-chisel', 'Chisel', 'max', 0.447),
  frontierCode('gpt-5-6-luna-max-codex', 'GPT-5.6 Luna', PRODUCTS.gpt56Luna, 'gpt-5-6-luna-max-codex', 'Codex CLI', 'max', 0.447, 'card-aa-coding-agent-codex-gpt-5-6-luna-max'),
  frontierCode('claude-opus-4-7-max-claude-code', 'Claude Opus 4.7', PRODUCTS.opus47, 'claude-opus-4-7-max-claude-code', 'Claude Code', 'max', 0.428, 'card-aa-coding-agent-claude-code-claude-opus-4-7-max'),
  frontierCode('gemini-3-6-flash-medium-chisel', 'Gemini 3.6 Flash', PRODUCTS.gemini36Flash, 'gemini-3-6-flash-medium-chisel', 'Chisel', 'medium', 0.389),
  frontierCode('glm-5-3-flash-max-chisel', 'GLM-5.3-Flash', PRODUCTS.glm53Flash, 'glm-5-3-flash-max-chisel', 'Chisel', 'max', 0.357),
  frontierCode('deepseek-v4-pro-0813-high-chisel', 'DeepSeek V4 Pro 0813', PRODUCTS.deepseekV4Pro0813, 'deepseek-v4-pro-0813-high-chisel', 'Chisel', 'high', 0.318),
  frontierCode('glm-5-2-mini-swe-agent', 'GLM-5.2', PRODUCTS.glm52, 'glm-5-2-mini-swe-agent', 'mini-SWE-agent', '', 0.274),
  frontierCode('deepseek-v4-flash-0731-high-chisel', 'DeepSeek V4 Flash 0731', PRODUCTS.deepseekV4Flash0731, 'deepseek-v4-flash-0731-high-chisel', 'Chisel', 'high', 0.211),
  frontierCode('deepseek-v4-pro-mini-swe-agent', 'DeepSeek V4 Pro', PRODUCTS.deepseekV4Pro, 'deepseek-v4-pro-mini-swe-agent', 'mini-SWE-agent', '', 0.200),
  frontierCode('minimax-m3-mini-swe-agent', 'MiniMax M3', PRODUCTS.minimaxM3, 'minimax-m3-mini-swe-agent', 'mini-SWE-agent', '', 0.166),
];

function sourceUrlsFor(spec: BenchmarkCardSpec): string[] {
  return [...new Set(spec.observations.map((observation) => observation.sourceUrl))];
}

function scopeFor(spec: BenchmarkCardSpec) {
  return {
    scopeId: CURRENT_SCOPE_ID,
    scopeVersion: CURRENT_SCOPE_VERSION,
    ...spec.scope,
    rankingClass: 'formal_text_agent' as const,
    canonicalProfileKey: spec.canonicalProfileKey,
  };
}

export const VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_MODEL_CARDS:
readonly SourceModelCard[] = CARD_SPECS.map((spec) => ({
  id: spec.id,
  source: spec.source,
  exactSourceModelName: spec.exactSourceModelName,
  latestSnapshotDate: spec.snapshotDate,
  metadataJson: {
    sourceUrl: spec.observations[0].sourceUrl,
    sourceLeaderboard: spec.observations[0].sourceLeaderboard,
    sourceUrls: sourceUrlsFor(spec),
    sourceLeaderboards: [...new Set(spec.observations.map((observation) => observation.sourceLeaderboard))],
    scope: scopeFor(spec),
    sourceIdentity: {
      source: spec.source,
      sourceRecordId: spec.sourceRecordId,
      exactSourceModelName: spec.exactSourceModelName,
      canonicalProfileKey: spec.canonicalProfileKey,
      selectionMethod: 'official-benchmark-leaderboard-snapshot',
      ...(spec.companionForCardId ? { companionForCardId: spec.companionForCardId } : {}),
    },
    ...(spec.harness ? {
      execution: {
        harness: spec.harness,
        effort: spec.effort,
      },
    } : {}),
  },
}));

export const VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS:
readonly SourceObservation[] = CARD_SPECS.flatMap((spec) => spec.observations.map((observation) => {
  const confidenceLow = observation.confidenceRadius === undefined
    ? undefined
    : Math.max(0, observation.rawValue - observation.confidenceRadius);
  const confidenceHigh = observation.confidenceRadius === undefined
    ? undefined
    : Math.min(1, observation.rawValue + observation.confidenceRadius);
  return {
    id: `obs-${spec.id}-${observation.metricId}`,
    sourceModelCardId: spec.id,
    metricId: observation.metricId,
    rawValue: observation.rawValue,
    unit: observation.unit,
    ...(confidenceLow === undefined ? {} : { confidenceLow }),
    ...(confidenceHigh === undefined ? {} : { confidenceHigh }),
    snapshotDate: spec.snapshotDate,
    sourceUrl: observation.sourceUrl,
    sourceLeaderboard: observation.sourceLeaderboard,
    metadataJson: {
      sourceRecordId: spec.sourceRecordId,
      sourceField: observation.sourceField,
      scope: scopeFor(spec),
      benchmarkVersion: observation.metricId === 'tbench_v4'
        ? '4.0.0'
        : observation.metricId === 'tbench_science_v01'
          ? '0.1.0'
          : observation.metricId === 'frontiercode_v11_main_pass_rate'
            ? '1.1-main'
            : observation.metricId === 'swe_rebench_v2'
              ? 'v2:2026-05-15_2026-07-01'
              : '2026-07-23',
      ...(spec.harness ? { harness: spec.harness } : {}),
      ...(spec.effort ? { effort: spec.effort } : {}),
      ...(observation.taskCount === undefined ? {} : { taskCount: observation.taskCount }),
      ...(observation.trialsPerTask === undefined ? {} : { trialsPerTask: observation.trialsPerTask }),
      ...(observation.confidenceRadius === undefined
        ? {}
        : { confidenceLevel: 0.95, confidenceRadius: observation.confidenceRadius }),
      ...(observation.standardError === undefined
        ? {}
        : { standardError: observation.standardError, uncertaintyKind: 'SEM' }),
    },
  };
}));

export const VERIFIED_REPLACEMENT_BENCHMARK_CARD_COUNT = CARD_SPECS.length;
