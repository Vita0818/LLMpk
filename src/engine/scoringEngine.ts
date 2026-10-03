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

// Version 3 uses six equal domains. Coverage gates apply before scoring.
export const DOMAIN_DEFINITIONS: Record<DomainId, DomainDefinition> = {
  chatting: { id: "chatting", name: "Chatting", nameEn: "Chatting", weight: 1 / 6, color: "#3B82F6", description: "对话、指令遵循、多轮交流与创意表达。" },
  reasoning: { id: "reasoning", name: "Reasoning", nameEn: "Reasoning", weight: 1 / 6, color: "#8B5CF6", description: "高难度推理、科学知识、数学与检索整合。" },
  coding: { id: "coding", name: "Coding", nameEn: "Coding", weight: 1 / 6, color: "#047857", description: "编程解题与代码库修改的可合并质量。" },
  frontend: { id: "frontend", name: "Frontend", nameEn: "Frontend", weight: 1 / 6, color: "#B45309", description: "Web 应用、界面设计与前端交付体验。" },
  agentic: { id: "agentic", name: "Agentic", nameEn: "Agentic", weight: 1 / 6, color: "#1D4ED8", description: "终端任务、工具使用、恢复与生产 Agent 行为。" },
  documents: { id: "documents", name: "Documents", nameEn: "Documents", weight: 1 / 6, color: "#06B6D4", description: "基于专业文档完成有可验证交付要求的工作。" },
};

// AA capability evidence is restricted to HLE, CritPt, TB4 and GDP.pdf.
// Retired metrics remain in source snapshots and the detail-only registry.
export const ALL_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "arena_text_instruction", name: "Instruction Following", source: "Arena.ai", domain: "chatting",
    metricType: "continuous_relative", internalWeightInDomain: 0.3, higherIsBetter: true,
    unit: "Score", description: "指令遵循", officialUrl: "https://arena.ai/leaderboard/text/instruction-following",
  },
  {
    id: "arena_text_multiturn", name: "Multi-Turn", source: "Arena.ai", domain: "chatting",
    metricType: "continuous_relative", internalWeightInDomain: 0.3, higherIsBetter: true,
    unit: "Score", description: "多轮对话", officialUrl: "https://arena.ai/leaderboard/text/multi-turn",
  },
  {
    id: "arena_text_creative", name: "Creative Writing", source: "Arena.ai", domain: "chatting",
    metricType: "continuous_relative", internalWeightInDomain: 0.2, higherIsBetter: true,
    unit: "Score", description: "创意写作", officialUrl: "https://arena.ai/leaderboard/text/creative-writing",
  },
  {
    id: "arena_text_hard", name: "Hard Prompts", source: "Arena.ai", domain: "chatting",
    metricType: "continuous_relative", internalWeightInDomain: 0.2, higherIsBetter: true,
    unit: "Score", description: "复杂指令", officialUrl: "https://arena.ai/leaderboard/text/hard-prompts",
  },
  {
    id: "aa_hle", name: "Humanity’s Last Exam", source: "Artificial Analysis", domain: "reasoning",
    metricType: "accuracy", internalWeightInDomain: 0.3, higherIsBetter: true,
    unit: "pass@1", description: "AA 独立测量的高难度跨学科推理。", officialUrl: "https://artificialanalysis.ai/evaluations/humanitys-last-exam",
  },
  {
    id: "aa_critpt", name: "CritPt", source: "Artificial Analysis", domain: "reasoning",
    metricType: "accuracy", internalWeightInDomain: 0.25, higherIsBetter: true,
    unit: "pass@1", description: "专业物理与理论科学推理。", officialUrl: "https://artificialanalysis.ai/evaluations/critpt",
  },
  {
    id: "arena_text_math", name: "Arena Math", source: "Arena.ai", domain: "reasoning",
    metricType: "continuous_relative", internalWeightInDomain: 0.25, higherIsBetter: true,
    unit: "Score", description: "真实用户数学任务。", officialUrl: "https://arena.ai/leaderboard/text/math",
  },
  {
    id: "arena_search", name: "Search Arena", source: "Arena.ai", domain: "reasoning",
    metricType: "continuous_relative", internalWeightInDomain: 0.2, higherIsBetter: true,
    unit: "Score", description: "检索、知识与 Grounding 的用户评价。", officialUrl: "https://arena.ai/leaderboard/search",
  },
  {
    id: "arena_text_coding", name: "Arena Coding", source: "Arena.ai", domain: "coding",
    metricType: "continuous_relative", internalWeightInDomain: 0.6, higherIsBetter: true,
    unit: "Score", description: "文本式编程与代码解题。", officialUrl: "https://arena.ai/leaderboard/text/coding",
  },
  {
    id: "frontiercode_v11_main_pass_rate", name: "FrontierCode 1.1 Main · Pass Rate", source: "FrontierCode", domain: "coding",
    metricType: "accuracy", internalWeightInDomain: 0.4, higherIsBetter: true,
    unit: "Pass Rate", description: "官方当前 1.1 Main 记录；保留实际 effort 与 harness，衡量全部 blocker 通过率。", officialUrl: "https://cognition.com/frontiercode",
  },
  {
    id: "arena_code_webdev", name: "Arena WebDev", source: "Arena.ai", domain: "frontend",
    metricType: "continuous_relative", internalWeightInDomain: 0.6, higherIsBetter: true,
    unit: "Score", description: "端到端 Web 构建与 UI 体验。", officialUrl: "https://arena.ai/leaderboard/code/webdev",
  },
  {
    id: "designarena_frontend", name: "DesignArena Frontend", source: "DesignArena", domain: "frontend",
    metricType: "continuous_relative", internalWeightInDomain: 0.4, higherIsBetter: true,
    unit: "Elo", description: "官方 Overall Frontend Elo；API 未取得时保持缺测。", officialUrl: "https://www.designarena.ai/leaderboard/code",
  },
  {
    id: "aa_terminalbench_v4", name: "AA Terminal-Bench 4.0", source: "Artificial Analysis", domain: "agentic",
    metricType: "accuracy", internalWeightInDomain: 0.6, higherIsBetter: true,
    unit: "pass@1", description: "66 项终端任务，mini-swe-agent，每任务三次；模型级评测，不冒充生产 CLI。", officialUrl: "https://artificialanalysis.ai/evaluations/terminalbench-4-0",
  },
  {
    id: "arena_agent_success", name: "Confirmed Success", source: "Arena.ai", domain: "agentic",
    metricType: "continuous_relative", internalWeightInDomain: 0.14, higherIsBetter: true,
    unit: "Score Point", description: "生产 Agent 的确认成功效果量。", officialUrl: "https://arena.ai/leaderboard/agent",
  },
  {
    id: "arena_agent_steerability", name: "Steerability", source: "Arena.ai", domain: "agentic",
    metricType: "continuous_relative", internalWeightInDomain: 0.08, higherIsBetter: true,
    unit: "Score Point", description: "来源正向 steering_burden/steerability 效果量。", officialUrl: "https://arena.ai/leaderboard/agent",
  },
  {
    id: "arena_agent_praise", name: "Praise vs Complaint", source: "Arena.ai", domain: "agentic",
    metricType: "continuous_relative", internalWeightInDomain: 0.04, higherIsBetter: true,
    unit: "Score Point", description: "用户好评与投诉净差。", officialUrl: "https://arena.ai/leaderboard/agent",
  },
  {
    id: "arena_agent_bash_recovery", name: "Bash Recovery", source: "Arena.ai", domain: "agentic",
    metricType: "continuous_relative", internalWeightInDomain: 0.08, higherIsBetter: true,
    unit: "Score Point", description: "终端报错后的恢复。", officialUrl: "https://arena.ai/leaderboard/agent",
  },
  {
    id: "arena_agent_tool_hallucination", name: "Tool Hallucination", source: "Arena.ai", domain: "agentic",
    metricType: "continuous_relative", internalWeightInDomain: 0.06, higherIsBetter: true,
    unit: "Score Point", description: "工具幻觉抑制效果量。", officialUrl: "https://arena.ai/leaderboard/agent",
  },
  {
    id: "aa_gdp_pdf_all_pass", name: "GDP.pdf · All-pass", source: "Artificial Analysis", domain: "documents",
    metricType: "accuracy", internalWeightInDomain: 1.0, higherIsBetter: true,
    unit: "pass@1", description: "专业 PDF 文档任务的全部交付要求通过率。", officialUrl: "https://artificialanalysis.ai/evaluations/gdp-pdf",
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

/** Main LLMpk Scoring Pipeline Processor — Scoring v3.0. */
export function processLLMpkBatchScoring(
  configs: LLMConfiguration[],
  customMetrics: MetricDefinition[] = ALL_METRIC_DEFINITIONS
): ProcessedConfigurationScore[] {
  if (configs.length === 0) return [];

  // Step A: transform each observed metric, calculate its base relative score,
  // estimate metric-level reliability, and shrink every observed score toward
  // neutral 50. Missing observations are never assigned an atomic score.
  const atomicScoreMap: Record<
    string,
    Record<string, {
      raw: number | null;
      y: number | null;
      baseS: number | null;
      s: number | null;
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
          s: null,
          uncertaintyRadius: null,
        };
      }
    });
  });

  // Step B: aggregate observed metrics only. Keep the full configured weight
  // vector in the coverage denominator and gate the domain before publishing.
  const domainIds = DOMAIN_IDS;

  const configDomainQMap: Record<string, Record<DomainId, number | null>> = {};
  const configDomainCoverageMap: Record<string, Record<DomainId, number>> = {};
  const configDomainCoverageStatusMap: Record<string, Record<DomainId, CoverageStatus>> = {};
  const configDomainDetailsMap: Record<string, Record<DomainId, AtomicScoreDetail[]>> = {};

  configs.forEach((c) => {
    configDomainQMap[c.id] = {
      chatting: null,
      reasoning: null,
      coding: null,
      frontend: null,
      agentic: null,
      documents: null,
    };
    configDomainCoverageMap[c.id] = {
      chatting: 0,
      reasoning: 0,
      coding: 0,
      frontend: 0,
      agentic: 0,
      documents: 0,
    };
    configDomainCoverageStatusMap[c.id] = {
      chatting: 'no_observed_data',
      reasoning: 'no_observed_data',
      coding: 'no_observed_data',
      frontend: 'no_observed_data',
      agentic: 'no_observed_data',
      documents: 'no_observed_data',
    };
    configDomainDetailsMap[c.id] = {
      chatting: [],
      reasoning: [],
      coding: [],
      frontend: [],
      agentic: [],
      documents: [],
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
        const weightInDomain = isMissing ? 0 : mDef.internalWeightInDomain / availableWeight;
        if (scoreData.s !== null) {
          weightedLogScoreSum += weightInDomain * Math.log(
            Math.max(Number.EPSILON, scoreData.s) / 50
          );
        }

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
          weightInDomain,
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

      configDomainQMap[c.id][dId] = coverage + Number.EPSILON >= SCORING_CONFIG.coverage.officialMinimum
        ? weightedLogScoreSum
        : null;
      configDomainCoverageMap[c.id][dId] = coverage;
      configDomainCoverageStatusMap[c.id][dId] = getCoverageStatus(coverage);
      configDomainDetailsMap[c.id][dId] = details;
    });
  });

  // Step C: only domains passing the weighted coverage gate calibrate or
  // receive scores. Low-coverage observations remain visible in the details.
  const finalDomainScoresMap: Record<string, Record<DomainId, number | null>> = {};
  configs.forEach((c) => {
    finalDomainScoresMap[c.id] = {
      chatting: null,
      reasoning: null,
      coding: null,
      frontend: null,
      agentic: null,
      documents: null,
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

  // Step D: all six domains and overall coverage must qualify. Directly
  // combine their equal-weight geometric mean without another normalization.
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
    const totalCoverage = domainIds.reduce((sum, dId) => (
      sum + DOMAIN_DEFINITIONS[dId].weight * configDomainCoverageMap[c.id][dId]
    ), 0);
    capabilityScoreMap[c.id] = (
      availableDomains.length < SCORING_CONFIG.capabilityAggregate.minimumAvailableDomains
      || totalCoverage + Number.EPSILON < SCORING_CONFIG.coverage.overallMinimum
      || availableWeight <= 0
    )
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
          || coverageStatus === 'provisional'
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
    // Sparse records remain inspectable, but cannot receive a total or rank.
    const eligibleForGlobalLeaderboard = (
      rawCapabilityScore !== null
      && availableDomainCount >= SCORING_CONFIG.capabilityAggregate.minimumAvailableDomains
      && overallCoverage + Number.EPSILON >= SCORING_CONFIG.coverage.overallMinimum
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
