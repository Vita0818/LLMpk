import {
  LLMConfiguration,
  MetricDefinition,
  DomainId,
  CoverageStatus,
  DomainDefinition,
  ProcessedConfigurationScore,
  DomainScoreDetail,
  AtomicScoreDetail,
  PracticalScoreBreakdown,
  MetricObservation,
  MetricUncertaintyStatus,
} from '../types/llm_pk';
import { DOMAIN_IDS, getCoverageStatus, SCORING_CONFIG } from './scoringConfig';
import {
  isCapabilityMetricApplicableToConfiguration,
} from '../data/executionMetricPolicy';

// Six capability domains. Scoring v1.2 keeps each observed domain equally
// weighted. A wholly unobserved domain is unavailable and is excluded from the
// final geometric mean rather than being replaced by a synthetic score.
export const DOMAIN_DEFINITIONS: Record<DomainId, DomainDefinition> = {
  chatting: {
    id: 'chatting',
    name: 'Chatting 闲聊与指令对话',
    nameEn: 'Chatting & Dialogue',
    weight: 1 / 6,
    color: '#3B82F6', // Blue
    description: '衡量自然语言交互、多轮对话保持、指令遵循与创意表达能力。',
  },
  math_science: {
    id: 'math_science',
    name: 'Math & Science 数学与科学',
    nameEn: 'Math & Science Reasoning',
    weight: 1 / 6,
    color: '#8B5CF6', // Purple
    description: '衡量高难度学术推理、研究生级科学问答、数学推导与批判性思维。',
  },
  coding: {
    id: 'coding',
    name: 'Coding 编程能力',
    nameEn: 'Coding',
    weight: 1 / 6,
    color: '#047857', // Emerald
    description: '衡量代码生成、算法实现、科学计算与文本式编程解题能力。',
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering 工程与专业工作',
    nameEn: 'Engineering',
    weight: 1 / 6,
    color: '#B45309', // Amber
    description: '衡量端到端软件工程、终端任务、专业工作交付与代码库执行能力。',
  },
  agentic_work: {
    id: 'agentic_work',
    name: 'Agentic Work 智能体工作',
    nameEn: 'Agentic Work',
    weight: 1 / 6,
    color: '#1D4ED8', // Blue
    description: '衡量生产 Agent 的多步任务成功、工具控制、错误恢复与用户干预修正能力。',
  },
  search_knowledge: {
    id: 'search_knowledge',
    name: 'Search & Knowledge 搜索与知识',
    nameEn: 'Search & Knowledge',
    weight: 1 / 6,
    color: '#06B6D4', // Cyan
    description: '衡量开放域事实知识准确性、外部联网搜索整合与长文本阅读检索。',
  },
};

// 26 scored atomic metrics according to Data Source Registry v1.2 & Domain Weighting v2.2.
// The AA Coding Agent Index remains source-visible for audit but is not scored.
// Superseded HLE, GPQA Diamond, SciCode, Terminal-Bench v2.1, and AA Coding
// Agent Terminal-Bench v2 observations remain in raw source snapshots for
// audit, but no longer participate in scoring.
export const ALL_METRIC_DEFINITIONS: MetricDefinition[] = [
  // --- 1. Chatting (Arena Text 100%) ---
  {
    id: 'arena_text_instruction',
    name: 'Instruction Following',
    source: 'Arena.ai',
    domain: 'chatting',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：指令遵循能力 Bradley–Terry 点估计',
    officialUrl: 'https://arena.ai/leaderboard/text/instruction-following',
  },
  {
    id: 'arena_text_multiturn',
    name: 'Multi-Turn',
    source: 'Arena.ai',
    domain: 'chatting',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：多轮对话上下文保持',
    officialUrl: 'https://arena.ai/leaderboard/text/multi-turn',
  },
  {
    id: 'arena_text_creative',
    name: 'Creative Writing',
    source: 'Arena.ai',
    domain: 'chatting',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.20,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：创意写作与文风控制',
    officialUrl: 'https://arena.ai/leaderboard/text/creative-writing',
  },
  {
    id: 'arena_text_hard',
    name: 'Hard Prompts',
    source: 'Arena.ai',
    domain: 'chatting',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.20,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：高难度复杂 Prompt 综合表现',
    officialUrl: 'https://arena.ai/leaderboard/text/hard-prompts',
  },

  // --- 2. Math & Science (fresh reasoning/science evals 60%, AA 20%, Arena 20%) ---
  {
    id: 'scale_enigmaeval',
    name: 'EnigmaEval',
    source: 'Scale Labs',
    domain: 'math_science',
    metricType: 'accuracy',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: 'pass@1',
    description: '复杂、多模态 puzzle 中的数学、逻辑、语言与跨领域推理准确率。',
    officialUrl: 'https://labs.scale.com/leaderboard/enigma_eval',
  },
  {
    id: 'tbench_science_v01',
    name: 'Terminal-Bench-Science 0.1',
    source: 'Terminal-Bench',
    domain: 'math_science',
    metricType: 'accuracy',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: 'Resolution Rate',
    description: '在真实科学研究工作流中交付可复核分析、模拟、证明、代码与数据产物。',
    officialUrl: 'https://www.terminal-bench-science.ai/',
  },
  {
    id: 'aa_critpt',
    name: 'CritPt',
    source: 'Artificial Analysis',
    domain: 'math_science',
    metricType: 'accuracy',
    internalWeightInDomain: 0.20,
    higherIsBetter: true,
    unit: 'pass@1',
    description: '高难度专业物理与理论科学推理评测',
    officialUrl: 'https://artificialanalysis.ai/evaluations/critpt',
  },
  {
    id: 'arena_text_math',
    name: 'Arena Math',
    source: 'Arena.ai',
    domain: 'math_science',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.20,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：真实用户数学任务表现',
    officialUrl: 'https://arena.ai/leaderboard/text/math',
  },

  // --- 3. Coding (high-coverage code reasoning and implementation) ---
  {
    id: 'swe_rebench_v2',
    name: 'SWE-rebench v2 · Current Window',
    source: 'SWE-rebench',
    domain: 'coding',
    metricType: 'accuracy',
    internalWeightInDomain: 0.55,
    higherIsBetter: true,
    unit: 'Resolved Rate',
    description: '在按时间滚动的新 GitHub issue/PR 任务中实现并验证真实代码修复。',
    officialUrl: 'https://swe-rebench.com/',
  },
  {
    id: 'arena_text_coding',
    name: 'Arena Text Coding',
    source: 'Arena.ai',
    domain: 'coding',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.45,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Arena Text 类别：文本式编程问答与代码解题',
    officialUrl: 'https://arena.ai/leaderboard/text/coding',
  },

  // --- 4. Engineering (professional work + end-to-end engineering) ---
  // The v2.2 registry preserves every v2.1 weight slot: Terminal-Bench 4.0
  // inherits 30% from v2.1, while FrontierCode 1.1 Main Pass Rate inherits one
  // 13.33% coding-agent slot. WebDev remains a benchmark-level 10% signal and
  // is not treated as a user-selectable production harness.
  {
    id: 'aa_gdpval_v2',
    name: 'GDPval-AA v2',
    source: 'Artificial Analysis',
    domain: 'engineering',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.20,
    higherIsBetter: true,
    unit: 'Elo',
    description: 'GDPval-AA v2 复杂经济与专业岗位真实工作评测',
    officialUrl: 'https://artificialanalysis.ai/evaluations/gdpval-aa',
  },
  {
    id: 'tbench_v4',
    name: 'Terminal-Bench 4.0',
    source: 'Terminal-Bench',
    domain: 'engineering',
    metricType: 'accuracy',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: 'Resolution Rate',
    description: '在当前 4.0 任务与资源配置下完成终端工程、系统管理与数据处理任务。',
    officialUrl: 'https://www.tbench.ai/',
  },
  {
    id: 'aa_coding_agent_deepswe',
    name: 'AA Coding Agent · DeepSWE',
    source: 'Artificial Analysis',
    domain: 'engineering',
    metricType: 'accuracy',
    internalWeightInDomain: 2 / 15,
    higherIsBetter: true,
    unit: 'pass@1',
    description: '在来源明确的 coding harness 中完成端到端软件工程任务。',
    officialUrl: 'https://artificialanalysis.ai/agents/coding-agents',
  },
  {
    id: 'aa_coding_agent_swe_atlas_qna',
    name: 'AA Coding Agent · SWE-Atlas-QnA',
    source: 'Artificial Analysis',
    domain: 'engineering',
    metricType: 'accuracy',
    internalWeightInDomain: 2 / 15,
    higherIsBetter: true,
    unit: 'pass@1',
    description: '在来源明确的 coding harness 中完成大型代码库理解与问答任务。',
    officialUrl: 'https://artificialanalysis.ai/agents/coding-agents',
  },
  {
    id: 'frontiercode_v11_main_pass_rate',
    name: 'FrontierCode 1.1 Main · Pass Rate',
    source: 'FrontierCode',
    domain: 'engineering',
    metricType: 'accuracy',
    internalWeightInDomain: 2 / 15,
    higherIsBetter: true,
    unit: 'Pass Rate',
    description: '在 Main 集上产出满足全部 blocker、达到代码库可合并标准的修改。',
    officialUrl: 'https://cognition.com/frontiercode',
  },
  {
    id: 'arena_code_webdev',
    name: 'Code Arena WebDev Overall',
    source: 'Arena.ai',
    domain: 'engineering',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.10,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Code Arena WebDev：端到端 Web 应用构建与 UI 生成体验',
    officialUrl: 'https://arena.ai/leaderboard/code/webdev',
  },

  // --- 5. Agentic Work (multi-step tool use + production-agent behavior) ---
  {
    id: 'aa_tau3_banking',
    name: 'τ³-Banking',
    source: 'Artificial Analysis',
    domain: 'agentic_work',
    metricType: 'accuracy',
    internalWeightInDomain: 0.40,
    higherIsBetter: true,
    unit: 'pass@1',
    description: 'τ³-Banking 银行业务中的多轮任务执行与 API 工具调用能力',
    officialUrl: 'https://artificialanalysis.ai/evaluations/tau3-banking',
  },
  {
    id: 'arena_agent_success',
    name: 'Confirmed Success',
    source: 'Arena.ai',
    domain: 'agentic_work',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.21,
    higherIsBetter: true,
    unit: 'Score Point',
    description: 'Agent Arena：Confirmed Success 真实 Agent 任务确认成功率改善',
    officialUrl: 'https://arena.ai/leaderboard/agent',
  },
  {
    id: 'arena_agent_steerability',
    name: 'Steerability',
    source: 'Arena.ai',
    domain: 'agentic_work',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.12,
    higherIsBetter: true,
    unit: 'Score Point',
    description: 'Agent Arena：Steerability 用户干预方向修正能力',
    officialUrl: 'https://arena.ai/leaderboard/agent',
  },
  {
    id: 'arena_agent_praise',
    name: 'Praise vs Complaint',
    source: 'Arena.ai',
    domain: 'agentic_work',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.06,
    higherIsBetter: true,
    unit: 'Score Point',
    description: 'Agent Arena：Praise vs Complaint 用户好评/投诉净差',
    officialUrl: 'https://arena.ai/leaderboard/agent',
  },
  {
    id: 'arena_agent_bash_recovery',
    name: 'Bash Recovery',
    source: 'Arena.ai',
    domain: 'agentic_work',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.12,
    higherIsBetter: true,
    unit: 'Score Point',
    description: 'Agent Arena：终端报错后的自我纠错修复能力',
    officialUrl: 'https://arena.ai/leaderboard/agent',
  },
  {
    id: 'arena_agent_tool_hallucination',
    name: 'Tool Hallucination',
    source: 'Arena.ai',
    domain: 'agentic_work',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.09,
    higherIsBetter: true,
    unit: 'Score Point',
    description: 'Agent Arena：工具幻觉抑制效果',
    officialUrl: 'https://arena.ai/leaderboard/agent',
  },

  // --- 6. Search & Knowledge (high-coverage knowledge core) ---
  {
    id: 'aa_omniscience_accuracy',
    name: 'AA-Omniscience Accuracy',
    source: 'Artificial Analysis',
    domain: 'search_knowledge',
    metricType: 'accuracy',
    internalWeightInDomain: 0.35,
    higherIsBetter: true,
    unit: 'Accuracy',
    description: 'AA-Omniscience 开放域知识准确率分项',
    officialUrl: 'https://artificialanalysis.ai/evaluations/omniscience',
  },
  {
    id: 'aa_omniscience_nonhallucination',
    name: 'AA-Omniscience Non-Hallucination',
    source: 'Artificial Analysis',
    domain: 'search_knowledge',
    // The source field is already the positive non-hallucination ratio.
    metricType: 'accuracy',
    internalWeightInDomain: 0.30,
    higherIsBetter: true,
    unit: '1 - Hallucination Rate',
    description: 'AA-Omniscience 开放域事实回答的非幻觉正向比例',
    officialUrl: 'https://artificialanalysis.ai/evaluations/omniscience',
  },
  {
    id: 'aa_lcr',
    name: 'AA-LCR',
    source: 'Artificial Analysis',
    domain: 'search_knowledge',
    metricType: 'accuracy',
    internalWeightInDomain: 0.25,
    higherIsBetter: true,
    unit: 'pass@1',
    description: 'AA Long Context Reasoning 超长文本理解与精确定位推理',
    officialUrl: 'https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning',
  },
  {
    id: 'arena_search',
    name: 'Search Arena',
    source: 'Arena.ai',
    domain: 'search_knowledge',
    metricType: 'continuous_relative',
    internalWeightInDomain: 0.10,
    higherIsBetter: true,
    unit: 'Score',
    description: 'Search Arena 真实网络搜索与 Grounding 效果量',
    officialUrl: 'https://arena.ai/leaderboard/search',
  },
];

// Helper: Math Median
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// 1. Metric raw value transformation y
export function transformRawMetric(value: number, metricType: string): number {
  const eps = 1e-4;
  if (metricType === 'accuracy') {
    const p = Math.max(eps, Math.min(1 - eps, value));
    return Math.log(p / (1 - p));
  }
  if (metricType === 'error_rate') {
    const p = Math.max(eps, Math.min(1 - eps, 1 - value));
    return Math.log(p / (1 - p));
  }
  if (metricType === 'continuous_relative') {
    return value;
  }
  if (metricType === 'positive_higher_better') {
    return Math.log(Math.max(eps, value));
  }
  if (metricType === 'positive_lower_better') {
    return -Math.log(Math.max(eps, value));
  }
  return value;
}

// 2. Normalize single metric s_i: max=100, median=50
export function normalizeMax100Median50(values: number[]): number[] {
  if (values.length === 0) return [];
  return normalizeMax100Median50AgainstReference(values, values);
}

/**
 * Score comparison-only access routes without letting duplicate capability
 * evidence move the calibration anchors for every other configuration.
 */
export function normalizeMax100Median50AgainstReference(
  values: number[],
  referenceValues: number[],
): number[] {
  if (values.length === 0) return [];
  const calibrationValues = referenceValues.length > 0 ? referenceValues : values;
  const maxValue = Math.max(...calibrationValues);
  const medianValue = calculateMedian(calibrationValues);

  // If all values are identical, return neutral score 50
  if (
    Math.abs(maxValue - medianValue)
    < SCORING_CONFIG.reliability.discriminationTolerance
  ) {
    return values.map(() => 50);
  }

  return values.map((val) => {
    const exponent = -(maxValue - val) / (maxValue - medianValue);
    const score = 100 * Math.pow(2, exponent);
    return Math.max(0, Math.min(100, score));
  });
}

export interface MetricReliabilitySummary {
  observedConfigCount: number;
  eligibleConfigCount: number;
  referenceConfigCount: number;
  participationReliability: number;
  discriminationReliability: number;
  reliability: number;
  typicalUncertaintyRadius: number | null;
  uncertaintyStatus: MetricUncertaintyStatus;
}

function calculateReferenceConfigCount(eligibleConfigCount: number): number {
  if (eligibleConfigCount <= 0) return 0;
  return Math.min(
    eligibleConfigCount,
    Math.max(
      SCORING_CONFIG.reliability.participationMinimumAbsolute,
      Math.ceil(
        SCORING_CONFIG.reliability.participationReferenceFraction
        * eligibleConfigCount,
      ),
    ),
  );
}

export function calculateParticipationReliability(
  observedConfigCount: number,
  eligibleConfigCount: number,
): { reliability: number; referenceConfigCount: number } {
  const referenceConfigCount = calculateReferenceConfigCount(eligibleConfigCount);
  if (referenceConfigCount <= 0) {
    return { reliability: 0, referenceConfigCount };
  }
  return {
    reliability: Math.max(
      0,
      Math.min(1, observedConfigCount / referenceConfigCount),
    ),
    referenceConfigCount,
  };
}

export function calculateObservationUncertaintyRadius(
  observation: MetricObservation,
  metricType: string,
): number | null {
  const { confidenceLow, confidenceHigh } = observation;
  if (
    typeof confidenceLow === 'number'
    && Number.isFinite(confidenceLow)
    && typeof confidenceHigh === 'number'
    && Number.isFinite(confidenceHigh)
  ) {
    const lowY = transformRawMetric(
      Math.min(confidenceLow, confidenceHigh),
      metricType,
    );
    const highY = transformRawMetric(
      Math.max(confidenceLow, confidenceHigh),
      metricType,
    );
    const radius = Math.abs(highY - lowY) / 2;
    return Number.isFinite(radius) && radius > 0 ? radius : null;
  }

  if (
    typeof observation.confidenceRadius === 'number'
    && Number.isFinite(observation.confidenceRadius)
    && observation.confidenceRadius > 0
    && typeof observation.rawValue === 'number'
    && Number.isFinite(observation.rawValue)
  ) {
    const lowY = transformRawMetric(
      observation.rawValue - observation.confidenceRadius,
      metricType,
    );
    const highY = transformRawMetric(
      observation.rawValue + observation.confidenceRadius,
      metricType,
    );
    const radius = Math.abs(highY - lowY) / 2;
    return Number.isFinite(radius) && radius > 0 ? radius : null;
  }

  if (
    typeof observation.sampleSize === 'number'
    && Number.isFinite(observation.sampleSize)
    && observation.sampleSize > 0
    && typeof observation.rawValue === 'number'
    && Number.isFinite(observation.rawValue)
    && (metricType === 'accuracy' || metricType === 'error_rate')
  ) {
    const eps = 1e-4;
    const p = Math.max(eps, Math.min(1 - eps, observation.rawValue));
    const rawRadius = 1.96 * Math.sqrt(
      (p * (1 - p)) / observation.sampleSize,
    );
    const lowY = transformRawMetric(
      Math.max(eps, p - rawRadius),
      metricType,
    );
    const highY = transformRawMetric(
      Math.min(1 - eps, p + rawRadius),
      metricType,
    );
    const radius = Math.abs(highY - lowY) / 2;
    return Number.isFinite(radius) && radius > 0 ? radius : null;
  }

  return null;
}

export function calculateMetricReliability(
  transformedValues: number[],
  uncertaintyRadii: Array<number | null>,
  eligibleConfigCount: number,
): MetricReliabilitySummary {
  const observedConfigCount = transformedValues.length;
  const {
    reliability: participationReliability,
    referenceConfigCount,
  } = calculateParticipationReliability(
    observedConfigCount,
    eligibleConfigCount,
  );

  if (observedConfigCount === 0) {
    return {
      observedConfigCount,
      eligibleConfigCount,
      referenceConfigCount,
      participationReliability,
      discriminationReliability: 0,
      reliability: 0,
      typicalUncertaintyRadius: null,
      uncertaintyStatus: 'no_observed_data',
    };
  }

  const maxValue = Math.max(...transformedValues);
  const medianValue = calculateMedian(transformedValues);
  const spread = maxValue - medianValue;

  if (
    !Number.isFinite(spread)
    || spread < SCORING_CONFIG.reliability.discriminationTolerance
  ) {
    return {
      observedConfigCount,
      eligibleConfigCount,
      referenceConfigCount,
      participationReliability,
      discriminationReliability: 0,
      reliability: 0,
      typicalUncertaintyRadius: null,
      uncertaintyStatus: 'insufficient_discrimination',
    };
  }

  const validRadii = uncertaintyRadii.filter(
    (radius): radius is number => (
      typeof radius === 'number'
      && Number.isFinite(radius)
      && radius > 0
    ),
  );
  const typicalUncertaintyRadius = validRadii.length > 0
    ? calculateMedian(validRadii)
    : null;
  const discriminationReliability = typicalUncertaintyRadius === null
    ? 1
    : Math.max(
      0,
      Math.min(
        1,
        (
          spread
          / typicalUncertaintyRadius
          / SCORING_CONFIG.reliability.fullSignalRatio
        ),
      ),
    );
  const uncertaintyStatus: MetricUncertaintyStatus = typicalUncertaintyRadius === null
    ? 'uncertainty_unknown'
    : 'estimated';

  return {
    observedConfigCount,
    eligibleConfigCount,
    referenceConfigCount,
    participationReliability,
    discriminationReliability,
    reliability: Math.min(
      participationReliability,
      discriminationReliability,
    ),
    typicalUncertaintyRadius,
    uncertaintyStatus,
  };
}

export function shrinkScoreTowardNeutral(
  baseScore: number,
  reliability: number,
): number {
  return Math.max(
    0,
    Math.min(100, 50 + reliability * (baseScore - 50)),
  );
}

// 3. Saturated Utility function u(r)
export function calculateUtilityRatio(r: number): number {
  if (r <= 0) return -0.99;
  if (r >= 1) {
    return 1 - 1 / r;
  }
  return r - 1;
}

/** Main LLMpk Scoring Pipeline Processor — Scoring v1.2. */
export function processLLMpkBatchScoring(
  configs: LLMConfiguration[],
  customMetrics: MetricDefinition[] = ALL_METRIC_DEFINITIONS
): ProcessedConfigurationScore[] {
  if (configs.length === 0) return [];

  // Step A: transform each observed metric, calculate its base relative score,
  // estimate metric-level reliability, and shrink every observed score toward
  // neutral 50. Missing observations enter aggregation at exactly 50.
  const atomicScoreMap: Record<
    string,
    Record<string, {
      raw: number | null;
      y: number | null;
      baseS: number | null;
      s: number;
      uncertaintyRadius: number | null;
    }>
  > = {};
  const metricReliabilityMap: Record<string, MetricReliabilitySummary> = {};

  configs.forEach((c) => {
    atomicScoreMap[c.id] = {};
  });

  customMetrics.forEach((metricDef) => {
    const eligibleConfigs = configs.filter((c) => (
      isCapabilityMetricApplicableToConfiguration(
        metricDef.id,
        c.execution.harness,
      )
    ));
    const referenceEligibleConfigs = eligibleConfigs.filter(
      (c) => c.capabilityReferenceIncluded !== false,
    );
    const referenceConfigIds = new Set(
      referenceEligibleConfigs.map((configuration) => configuration.id),
    );
    const validRows = eligibleConfigs.flatMap((c) => {
      const obs = c.observations[metricDef.id];
      if (obs && obs.rawValue !== null && Number.isFinite(obs.rawValue)) {
        const y = transformRawMetric(obs.rawValue, metricDef.metricType);
        return [{
          configId: c.id,
          observation: obs,
          y,
          uncertaintyRadius: calculateObservationUncertaintyRadius(
            obs,
            metricDef.metricType,
          ),
        }];
      }
      return [];
    });

    const referenceRows = validRows.filter((row) => referenceConfigIds.has(row.configId));
    const calibrationRows = referenceRows.length > 0 ? referenceRows : validRows;
    const transformedYList = validRows.map((row) => row.y);
    const calibrationYList = calibrationRows.map((row) => row.y);
    const baseScores = normalizeMax100Median50AgainstReference(
      transformedYList,
      calibrationYList,
    );
    const reliability = calculateMetricReliability(
      calibrationYList,
      calibrationRows.map((row) => row.uncertaintyRadius),
      referenceRows.length > 0
        ? referenceEligibleConfigs.length
        : eligibleConfigs.length,
    );
    metricReliabilityMap[metricDef.id] = reliability;

    validRows.forEach((row, index) => {
      const baseS = baseScores[index] ?? 50;
      atomicScoreMap[row.configId][metricDef.id] = {
        raw: row.observation.rawValue,
        y: row.y,
        baseS,
        s: shrinkScoreTowardNeutral(baseS, reliability.reliability),
        uncertaintyRadius: row.uncertaintyRadius,
      };
    });

    configs.forEach((c) => {
      if (!atomicScoreMap[c.id][metricDef.id]) {
        atomicScoreMap[c.id][metricDef.id] = {
          raw: null,
          y: null,
          baseS: null,
          s: 50,
          uncertaintyRadius: null,
        };
      }
    });
  });

  // Step B: aggregate each domain with the full configured weight vector.
  // Missing metrics contribute ln(50 / 50) = 0; their weights are retained
  // and must never be redistributed to observed metrics.
  const domainIds = DOMAIN_IDS;

  const configDomainQMap: Record<string, Record<DomainId, number | null>> = {};
  const configDomainCoverageMap: Record<string, Record<DomainId, number>> = {};
  const configDomainCoverageStatusMap: Record<string, Record<DomainId, CoverageStatus>> = {};
  const configDomainDetailsMap: Record<string, Record<DomainId, AtomicScoreDetail[]>> = {};

  configs.forEach((c) => {
    configDomainQMap[c.id] = {
      chatting: null,
      math_science: null,
      coding: null,
      engineering: null,
      agentic_work: null,
      search_knowledge: null,
    };
    configDomainCoverageMap[c.id] = {
      chatting: 0,
      math_science: 0,
      coding: 0,
      engineering: 0,
      agentic_work: 0,
      search_knowledge: 0,
    };
    configDomainCoverageStatusMap[c.id] = {
      chatting: 'no_observed_data',
      math_science: 'no_observed_data',
      coding: 'no_observed_data',
      engineering: 'no_observed_data',
      agentic_work: 'no_observed_data',
      search_knowledge: 'no_observed_data',
    };
    configDomainDetailsMap[c.id] = {
      chatting: [],
      math_science: [],
      coding: [],
      engineering: [],
      agentic_work: [],
      search_knowledge: [],
    };
  });

  domainIds.forEach((dId) => {
    const domainMetrics = customMetrics.filter((m) => m.domain === dId);
    const totalWeight = domainMetrics.reduce((sum, m) => sum + m.internalWeightInDomain, 0);

    configs.forEach((c) => {
      const availableWeight = domainMetrics.reduce((sum, mDef) => {
        const scoreData = atomicScoreMap[c.id][mDef.id];
        return scoreData.raw !== null && scoreData.s !== null
          ? sum + mDef.internalWeightInDomain
          : sum;
      }, 0);
      const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
      let weightedLogScoreSum = 0;

      const details = domainMetrics.map((mDef): AtomicScoreDetail => {
        const scoreData = atomicScoreMap[c.id][mDef.id];
        const reliability = metricReliabilityMap[mDef.id];
        const isMissing = scoreData.raw === null;
        const configuredWeightInDomain = mDef.internalWeightInDomain / (totalWeight || 1);
        weightedLogScoreSum += configuredWeightInDomain * Math.log(
          Math.max(Number.EPSILON, scoreData.s) / 50
        );

        return {
          metricId: mDef.id,
          metricName: mDef.name,
          source: mDef.source,
          domain: dId,
          rawValue: scoreData.raw,
          transformedValue: scoreData.y,
          baseNormalizedScore: scoreData.baseS,
          normalizedScore: scoreData.s,
          configuredWeightInDomain,
          weightInDomain: configuredWeightInDomain,
          observedConfigCount: reliability.observedConfigCount,
          eligibleConfigCount: reliability.eligibleConfigCount,
          referenceConfigCount: reliability.referenceConfigCount,
          participationReliability: reliability.participationReliability,
          discriminationReliability: reliability.discriminationReliability,
          reliability: reliability.reliability,
          uncertaintyRadius: scoreData.uncertaintyRadius,
          uncertaintyStatus: reliability.uncertaintyStatus,
          isMissing,
        };
      });

      configDomainQMap[c.id][dId] = totalWeight > 0
        ? weightedLogScoreSum
        : 0;
      configDomainCoverageMap[c.id][dId] = coverage;
      configDomainCoverageStatusMap[c.id][dId] = getCoverageStatus(coverage);
      configDomainDetailsMap[c.id][dId] = details;
    });
  });

  // Step C: calibrate every domain using configs with at least one real
  // observation. A zero-observation domain stays unavailable and does not
  // influence either the calibration parameters or the final capability mean.
  const finalDomainScoresMap: Record<string, Record<DomainId, number | null>> = {};
  configs.forEach((c) => {
    finalDomainScoresMap[c.id] = {
      chatting: null,
      math_science: null,
      coding: null,
      engineering: null,
      agentic_work: null,
      search_knowledge: null,
    };
  });

  domainIds.forEach((dId) => {
    const scoreableConfigs = configs.filter((c) => {
      const q = configDomainQMap[c.id][dId];
      return q !== null && configDomainCoverageMap[c.id][dId] > 0;
    });
    const referenceScoreableConfigs = scoreableConfigs.filter(
      (c) => c.capabilityReferenceIncluded !== false,
    );
    const calibrationConfigs = referenceScoreableConfigs.length > 0
      ? referenceScoreableConfigs
      : scoreableConfigs;
    const normalizedD = normalizeMax100Median50AgainstReference(
      scoreableConfigs.map((c) => configDomainQMap[c.id][dId]!),
      calibrationConfigs.map((c) => configDomainQMap[c.id][dId]!),
    );
    scoreableConfigs.forEach((c, idx) => {
      finalDomainScoresMap[c.id][dId] = normalizedD[idx];
    });
  });

  // Step D: directly take the equal-weight geometric mean of the observed
  // domain scores. A wholly unobserved domain is excluded instead of receiving
  // a synthetic 50. There is deliberately no second cohort normalization.
  const capabilityScoreMap: Record<string, number | null> = {};
  const availableDomainCountMap: Record<string, number> = {};
  configs.forEach((c) => {
    const availableDomains = domainIds.flatMap((dId) => {
      const score = finalDomainScoresMap[c.id][dId];
      return configDomainCoverageMap[c.id][dId] > 0 && score !== null
        ? [{ dId, score }]
        : [];
    });
    availableDomainCountMap[c.id] = availableDomains.length;
    const availableWeight = availableDomains.reduce(
      (sum, { dId }) => sum + DOMAIN_DEFINITIONS[dId].weight,
      0,
    );
    capabilityScoreMap[c.id] = availableDomains.length === 0 || availableWeight <= 0
      ? null
      : availableDomains.some(({ score }) => score <= 0)
      ? 0
      : 50 * Math.exp(availableDomains.reduce((sum, { dId, score }) => (
        sum
        + (DOMAIN_DEFINITIONS[dId].weight / availableWeight) * Math.log(score / 50)
      ), 0));
  });

  // Step E: Calculate Practical Score adjustments (Speed Delta & Cost Delta)
  // 1. Calculate Scenario Effective Cost for each config (USD)
  // Scenario: 1M Input tokens + 0.25M Output tokens
  const scenarioCosts = configs.map((c) => {
    if (!c.openRouterData) return null;
    const input = c.openRouterData.inputPricePerMToken;
    const output = c.openRouterData.outputPricePerMToken;
    if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) {
      return null;
    }
    const apiScenarioCost = input + 0.25 * output;
    if (!c.subscriptionData) return apiScenarioCost;

    const {
      monthlyPriceUSD,
      apiEquivalentCostUSD,
      usableQuotaFraction,
    } = c.subscriptionData;
    if (
      !Number.isFinite(monthlyPriceUSD)
      || monthlyPriceUSD <= 0
      || !Number.isFinite(apiEquivalentCostUSD)
      || apiEquivalentCostUSD <= 0
      || !Number.isFinite(usableQuotaFraction)
      || usableQuotaFraction <= 0
      || usableQuotaFraction > 1
    ) return null;

    // Convert a fixed monthly plan back to the same standard-workload scale
    // used by API rows. Example: if $200 buys $2,000 of API-equivalent work,
    // the subscription's effective scenario cost is 10% of the API route.
    const usableApiEquivalentCostUSD =
      apiEquivalentCostUSD * usableQuotaFraction;
    return apiScenarioCost
      * monthlyPriceUSD
      / usableApiEquivalentCostUSD;
  });

  const validCosts = scenarioCosts.filter(
    (v): v is number => v !== null && Number.isFinite(v) && v >= 0
  );
  const medianCostUSD = validCosts.length > 0 ? calculateMedian(validCosts) : null;

  // 2. Speed reference values (p50 Throughput & TTFT)
  const throughputs = configs
    .map((c) => c.openRouterData?.throughputP50TokensPerSec)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0);
  const medianThroughput = throughputs.length > 0 ? calculateMedian(throughputs) : null;

  const ttfts = configs
    .map((c) => c.openRouterData?.ttftP50Seconds)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0);
  const medianTtft = ttfts.length > 0 ? calculateMedian(ttfts) : null;

  // Assembly of results
  const results: ProcessedConfigurationScore[] = configs.map((c, idx) => {
    // Legacy field name retained for API compatibility; this is the direct
    // geometric mean of available domains without a second normalization.
    const rawCapabilityScore = capabilityScoreMap[c.id];

    // Compute DomainScoreDetail map
    const domainDetailsResult = {} as Record<DomainId, DomainScoreDetail>;
    let weightedCoverageSum = 0;
    let totalDomainWeight = 0;

    domainIds.forEach((dId) => {
      const coverage = configDomainCoverageMap[c.id][dId];
      const coverageStatus = configDomainCoverageStatusMap[c.id][dId];
      const domainWeight = DOMAIN_DEFINITIONS[dId].weight;
      weightedCoverageSum += domainWeight * coverage;
      totalDomainWeight += domainWeight;

      domainDetailsResult[dId] = {
        domainId: dId,
        domainName: DOMAIN_DEFINITIONS[dId].name,
        rawGeometricIndex: configDomainQMap[c.id][dId],
        score: finalDomainScoresMap[c.id][dId],
        coverage,
        coverageStatus,
        insufficientCoverage: (
          coverageStatus === 'insufficient'
          || coverageStatus === 'no_observed_data'
        ),
        metricDetails: configDomainDetailsMap[c.id][dId],
      };
    });

    const overallCoverage = totalDomainWeight > 0
      ? weightedCoverageSum / totalDomainWeight
      : 0;
    const coverageStatuses = domainIds.map((dId) => domainDetailsResult[dId].coverageStatus);
    const availableDomainCount = availableDomainCountMap[c.id];
    const allDomainsOfficial = coverageStatuses.every((status) => status === 'official');
    const coverageStatus: CoverageStatus = rawCapabilityScore === null
      ? 'insufficient'
      : allDomainsOfficial
        ? 'official'
        : overallCoverage <= Number.EPSILON
          ? 'no_observed_data'
          : 'provisional';
    // Coverage quality remains visible, but Scoring v1.2 does not remove a
    // configuration from the ranking merely because observations are sparse.
    const eligibleForGlobalLeaderboard = (
      rawCapabilityScore !== null
      && availableDomainCount >= SCORING_CONFIG.capabilityAggregate.minimumAvailableDomains
    );

    // Speed adjustment
    let speedDelta: number | null = null;
    let speedUtility: number | null = null;
    let throughputRatio: number | null = null;
    let latencyRatio: number | null = null;

    if (
      c.openRouterData
      && medianThroughput !== null
      && medianTtft !== null
      && Number.isFinite(c.openRouterData.throughputP50TokensPerSec)
      && c.openRouterData.throughputP50TokensPerSec > 0
      && Number.isFinite(c.openRouterData.ttftP50Seconds)
      && c.openRouterData.ttftP50Seconds > 0
    ) {
      throughputRatio = c.openRouterData.throughputP50TokensPerSec / medianThroughput;
      latencyRatio = medianTtft / c.openRouterData.ttftP50Seconds;

      const uThroughput = calculateUtilityRatio(throughputRatio);
      const uTtft = calculateUtilityRatio(latencyRatio);

      speedUtility = 0.5 * uThroughput + 0.5 * uTtft;
      if (speedUtility >= 0) {
        speedDelta = SCORING_CONFIG.practicalAdjustment.speed.rewardScale * speedUtility;
      } else {
        speedDelta = SCORING_CONFIG.practicalAdjustment.speed.penaltyScale * speedUtility;
      }
    }

    // Cost adjustment
    let costDelta: number | null = null;
    let costUtility: number | null = null;
    const effectiveCost = scenarioCosts[idx];

    if (effectiveCost !== null && medianCostUSD !== null) {
      const r_c = medianCostUSD === 0 && effectiveCost === 0
        ? 1
        : medianCostUSD / Math.max(0.001, effectiveCost);
      costUtility = calculateUtilityRatio(r_c);

      if (costUtility >= 0) {
        costDelta = SCORING_CONFIG.practicalAdjustment.cost.rewardScale * costUtility;
      } else {
        costDelta = SCORING_CONFIG.practicalAdjustment.cost.penaltyScale * costUtility;
      }
    }

    // A practical score also requires an actual capability score. Do not turn
    // missing capability coverage into a zero or neutral practical score.
    const practicalScore = rawCapabilityScore === null || speedDelta === null || costDelta === null
      ? null
      : Math.max(0, rawCapabilityScore + speedDelta + costDelta);

    const practicalBreakdown: PracticalScoreBreakdown = {
      rawCapabilityScore,
      speedDelta,
      costDelta,
      practicalScore,
      speedUtility,
      costUtility,
      effectiveScenarioCostUSD: effectiveCost,
      referenceCostUSD: medianCostUSD,
      throughputRatio,
      latencyRatio,
    };

    return {
      config: c,
      domainScores: domainDetailsResult,
      rawCapabilityScore,
      practicalBreakdown,
      overallCoverage,
      availableDomainCount,
      coverageStatus,
      eligibleForGlobalLeaderboard,
    };
  });

  return results;
}
