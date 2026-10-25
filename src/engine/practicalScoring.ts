import type { LLMConfiguration, PracticalComponentDetail, PracticalScoreBreakdown, PracticalTaskMeasurement } from '../types/llm_pk';
import { VALS_METRIC_DEFINITIONS } from '../data/valsMetricDefinitions';
import { getSubscriptionPricingEvidence } from '../data/subscriptionPricing';
import { SCORING_CONFIG } from './scoringConfig';

const weights = SCORING_CONFIG.practicalAdjustment.weights;
const valsTasks = VALS_METRIC_DEFINITIONS.filter(metric => metric.slug !== 'vals_index');
export const PRACTICAL_TASK_DEFINITIONS = [
  { id: 'aa-agent', label: 'AA Coding Agents', weight: weights.aaAgentTask },
  ...valsTasks.map(metric => ({ id: `vals-${metric.slug}`, label: `Vals ${metric.name}`, weight: weights.valsTasks / valsTasks.length })),
  { id: 'aa-index', label: 'AA Task Estimate', weight: weights.aaIndexTask },
] as const;

type Adjustment = Pick<PracticalScoreBreakdown, 'speedDelta' | 'costDelta' | 'speedUtility' | 'costUtility'
  | 'effectiveScenarioCostUSD' | 'referenceCostUSD' | 'throughputRatio' | 'latencyRatio'
  | 'speedCoverage' | 'costCoverage' | 'components'>;

/** Same subscription conversion as v1.4; absent quotas stay absent. */
export function subscriptionCostMultiplier(config: LLMConfiguration): number | null {
  if (!config.subscriptionData) return 1;
  const { monthlyPriceUSD, apiEquivalentCostUSD, usableQuotaFraction } = config.subscriptionData;
  if (!Number.isFinite(monthlyPriceUSD) || monthlyPriceUSD <= 0
    || apiEquivalentCostUSD === null || !Number.isFinite(apiEquivalentCostUSD) || apiEquivalentCostUSD <= 0
    || usableQuotaFraction === null || !Number.isFinite(usableQuotaFraction)
    || usableQuotaFraction <= 0 || usableQuotaFraction > 1) return null;
  return monthlyPriceUSD / (apiEquivalentCostUSD * usableQuotaFraction);
}

function taskCost(config: LLMConfiguration, measurement: PracticalTaskMeasurement): number | null {
  if (measurement.apiCostUSD === null) return null;
  if (!config.subscriptionData) return measurement.apiCostUSD;
  // The SA experiment is agentic, so it cannot price the AA reasoning mix.
  // Legacy estimates remain in the existing scenario component only.
  if (measurement.family === 'aa-index'
    || getSubscriptionPricingEvidence(config.subscriptionData.pricingEvidenceId)?.kind !== 'measured') return null;
  const multiplier = subscriptionCostMultiplier(config);
  return multiplier === null ? null : measurement.apiCostUSD * multiplier;
}

export function calculatePracticalAdjustments(
  configs: LLMConfiguration[],
  median: (values: number[]) => number,
  utility: (ratio: number) => number,
): Adjustment[] {
  const valid = (value: unknown, zero = false): value is number =>
    typeof value === 'number' && Number.isFinite(value) && (zero ? value >= 0 : value > 0);
  const referenceMedian = (entries: { key: string; value: number | null | undefined }[], zero = false) => {
    const unique = new Map(entries.filter(entry => valid(entry.value, zero)).map(entry => [entry.key, entry.value as number]));
    return unique.size ? median([...unique.values()]) : null;
  };
  const scenarioCosts = configs.map(config => {
    const data = config.openRouterData;
    if (!data || !valid(data.inputPricePerMToken, true) || !valid(data.outputPricePerMToken, true)) return null;
    const multiplier = subscriptionCostMultiplier(config);
    return multiplier === null ? null : (data.inputPricePerMToken + 0.25 * data.outputPricePerMToken) * multiplier;
  });
  const accessKey = (config: LLMConfiguration) => `${config.identity.modelName}:${config.identity.modelVersion}:${config.execution.harness}:${config.subscriptionData?.planName ?? config.access.providerEndpoint ?? config.access.entryPoint}`;
  const speedKey = (config: LLMConfiguration) => `${config.identity.modelName}:${config.identity.modelVersion}:${config.execution.harness}`;
  const medianCost = referenceMedian(configs.map((config, index) => ({ key: accessKey(config), value: scenarioCosts[index] })), true);
  const medianThroughput = referenceMedian(configs.map(config => ({ key: speedKey(config), value: config.openRouterData?.throughputP50TokensPerSec })));
  const medianTtft = referenceMedian(configs.map(config => ({ key: speedKey(config), value: config.openRouterData?.ttftP50Seconds })));
  const taskReferences = new Map<string, { times: { key: string; value: number | null }[]; costs: { key: string; value: number | null }[] }>();
  for (const config of configs) for (const measurement of config.practicalMeasurements ?? []) {
    if (measurement.quality === null || measurement.quality <= 0) continue;
    const group = taskReferences.get(measurement.comparisonKey) ?? { times: [], costs: [] };
    group.times.push({ key: measurement.referenceKey, value: measurement.timeSeconds });
    group.costs.push({ key: `${measurement.referenceKey}:${accessKey(config)}`, value: taskCost(config, measurement) });
    taskReferences.set(measurement.comparisonKey, group);
  }

  return configs.map((config, index) => {
    const components: PracticalComponentDetail[] = [];
    const add = (component: Omit<PracticalComponentDetail, 'ratio' | 'utility' | 'contribution'>, higherBetter = false) => {
      const { rawValue, referenceValue } = component;
      let ratio: number | null = null;
      if (valid(rawValue, component.domain === 'cost') && valid(referenceValue, component.domain === 'cost')) {
        ratio = higherBetter ? rawValue / referenceValue
          : rawValue === 0 && referenceValue === 0 ? 1
          : referenceValue / Math.max(component.id === 'cost-scenario' ? 0.001 : Number.EPSILON, rawValue);
      }
      const metricUtility = ratio === null ? null : utility(ratio);
      components.push({ ...component, ratio,
        utility: metricUtility, contribution: metricUtility === null ? null : component.weight * metricUtility });
    };
    for (const definition of PRACTICAL_TASK_DEFINITIONS) {
      const evidence = config.practicalMeasurements?.find(measurement => measurement.id === definition.id);
      const reference = evidence ? taskReferences.get(evidence.comparisonKey) : undefined;
      const admissible = evidence && evidence.quality !== null && evidence.quality > 0;
      const source = evidence ? { sourceUrl: evidence.sourceUrl, sourceUpdated: evidence.sourceUpdated,
        sourceProfile: evidence.sourceProfile, sourceHarness: evidence.sourceHarness } : {};
      add({ id: `speed-task-${definition.id}`, label: `${definition.label} Time`, domain: 'speed',
        weight: definition.weight, rawValue: admissible ? evidence.timeSeconds : null,
        referenceValue: reference ? referenceMedian(reference.times) : null, unit: 's', ...source,
        notes: evidence?.notes ?? '没有同模型、同实测档位的可核实任务计时。' });
      add({ id: `cost-task-${definition.id}`, label: `${definition.label} Cost`, domain: 'cost',
        weight: definition.weight, rawValue: admissible ? taskCost(config, evidence) : null,
        referenceValue: reference ? referenceMedian(reference.costs, true) : null, unit: 'USD/task', ...source,
        notes: `${evidence?.notes ?? '没有可核实任务成本。'}${config.subscriptionData
          ? evidence?.family === 'aa-index' ? ' SemiAnalysis 的 agentic 配比不用于 AA 推理任务成本，本项保持缺测。'
          : getSubscriptionPricingEvidence(config.subscriptionData.pricingEvidenceId)?.kind !== 'measured'
            ? ' 缺少该套餐与模型的 SemiAnalysis 实测，历史估算不用于任务成本。'
            : ' 按 SemiAnalysis 实测额度折算 agentic 任务，假设满额使用；非原始账单。'
          : ''}` });
    }
    add({ id: 'speed-throughput', label: 'Throughput Speed', domain: 'speed', weight: weights.throughput,
      rawValue: valid(config.openRouterData?.throughputP50TokensPerSec) ? config.openRouterData!.throughputP50TokensPerSec : null,
      referenceValue: medianThroughput, unit: 't/s', notes: '同模型 API 端点响应体验；订阅路线沿用 API 测速，非订阅客户端独立测速。' }, true);
    add({ id: 'speed-ttft', label: 'TTFT Latency', domain: 'speed', weight: weights.ttft,
      rawValue: valid(config.openRouterData?.ttftP50Seconds) ? config.openRouterData!.ttftP50Seconds : null,
      referenceValue: medianTtft, unit: 's', notes: '首 token 延迟，可能是首个推理 token；不等于首个答案时间。' });
    add({ id: 'cost-scenario', label: 'Scenario Cost', domain: 'cost', weight: weights.scenarioCost,
      rawValue: scenarioCosts[index], referenceValue: medianCost, unit: 'USD/1.25M',
      notes: '保留 1M 输入 + 0.25M 输出标准场景。订阅按满额使用的月费/API 等效额度近似折算；缓存、实际利用率及历史估算影响结果。' });
    const aggregate = (domain: 'speed' | 'cost') => {
      const observed = components.filter(component => component.domain === domain && component.contribution !== null);
      return { coverage: observed.reduce((sum, component) => sum + component.weight, 0),
        utility: observed.length ? observed.reduce((sum, component) => sum + component.contribution!, 0) : null };
    };
    const speed = aggregate('speed');
    const cost = aggregate('cost');
    const delta = (value: number | null, scales: { rewardScale: number; penaltyScale: number }) =>
      value === null ? null : value * (value >= 0 ? scales.rewardScale : scales.penaltyScale);
    return { speedDelta: delta(speed.utility, SCORING_CONFIG.practicalAdjustment.speed),
      costDelta: delta(cost.utility, SCORING_CONFIG.practicalAdjustment.cost),
      speedUtility: speed.utility, costUtility: cost.utility,
      effectiveScenarioCostUSD: scenarioCosts[index], referenceCostUSD: medianCost,
      throughputRatio: components.find(component => component.id === 'speed-throughput')!.ratio,
      latencyRatio: components.find(component => component.id === 'speed-ttft')!.ratio,
      speedCoverage: speed.coverage, costCoverage: cost.coverage, components };
  });
}
