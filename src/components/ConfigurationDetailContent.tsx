import React from 'react';
import { getCompactMetricName } from '../data/compactMetricNames';
import { getSubscriptionPricingEvidence } from '../data/subscriptionPricing';
import { VALS_METRIC_DEFINITIONS } from '../data/valsMetricDefinitions';
import { ALL_METRIC_DEFINITIONS, DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import { getProviderBrandTheme } from '../utils/providerColors';
import { RadarChart } from './RadarChart';

export const CONFIGURATION_DETAIL_DOMAIN_ORDER: readonly DomainId[] = [
  'chatting',
  'reasoning',
  'coding',
  'frontend',
  'agentic',
  'documents',
];

export interface ConfigurationMetricRow {
  id: string;
  label: string;
  value: string;
  color: string;
  domainId: DomainId | null;
  title: string;
}

export const formatConfigurationScore = (score: number | null | undefined) =>
  score === null || score === undefined ? '--' : score.toFixed(1);

export const formatConfigurationHarness = (harness: string) => {
  if (!harness) return 'Chat';

  return Array.from(
    new Set(
      harness
        .split('·')
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).join(' · ');
};

export const parseConfigurationName = (name: string) => {
  const [model, harness, provider] = name.split('|').map((part) => part.trim());

  return {
    model: model || name,
    harness: formatConfigurationHarness(harness || 'Chat'),
    provider: provider || 'API',
  };
};

export const formatConfigurationRawMetricValue = (
  value: number | null | undefined,
  unit?: string
) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';

  if (
    unit === '%'
    || unit === 'pass@1'
    || unit === 'Resolution Rate'
    || unit === 'Resolved Rate'
    || unit === 'Pass Rate'
  ) {
    const percentage = value <= 1 && value > 0 ? value * 100 : value;
    return `${percentage.toFixed(1)}%`;
  }

  if (unit === 'Score Point') {
    if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (unit === 'Score' || unit === 'Elo') {
    return Math.round(value).toLocaleString();
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const formatCostValue = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

/**
 * This is the single content definition for the metric list shown on both the
 * configuration detail page and the side-by-side comparison page.
 */
export const buildConfigurationMetricRows = (
  scoreItem: PublicLeaderboardScore
): ConfigurationMetricRow[] => {
  const benchmarkRows = CONFIGURATION_DETAIL_DOMAIN_ORDER.flatMap((domainId) => {
    const domainDefinition = DOMAIN_DEFINITIONS[domainId];
    const scoredMetrics = ALL_METRIC_DEFINITIONS.filter(
      (metric) => metric.domain === domainId
    );
    return scoredMetrics.map((metric) => {
      const rawValue = scoreItem.config.observations[metric.id]?.rawValue;
      const formattedValue = formatConfigurationRawMetricValue(rawValue, metric.unit);
      const valsEvidence = scoreItem.config.valsData?.find(item => item.metricId === metric.id);
      const sourceConditions = valsEvidence
        ? ` · Vals ${valsEvidence.sourceProfile} / ${valsEvidence.sourceHarness ?? '评测环境未披露'}${valsEvidence.scoreBasis === 'no-fallback'
          ? ` · 原模型口径：备用任务计失败；公布分 ${((valsEvidence.publishedRawValue ?? 0) * 100).toFixed(2)}%`
          : ' · 来源公布分'}`
        : '';

      return {
        id: metric.id,
        label: getCompactMetricName(metric.id, metric.name),
        value: formattedValue,
        color: domainDefinition.color,
        domainId,
        title: `${metric.name} (${domainDefinition.nameEn}) · ${'internalWeightInDomain' in metric
          ? `计分权重 ${(metric.internalWeightInDomain * 100).toFixed(0)}%`
          : '仅展示，不计分'} · Raw Value: ${formattedValue}${sourceConditions}`,
      };
    });
  });

  const throughput = scoreItem.config.openRouterData?.throughputP50TokensPerSec;
  const ttft = scoreItem.config.openRouterData?.ttftP50Seconds;
  const subscription = scoreItem.config.subscriptionData;
  const pricingEvidence = getSubscriptionPricingEvidence(subscription?.pricingEvidenceId);
  const subscriptionCostTitle = subscription
    ? [
        '可用月度 API 等效额度（USD）；已计入模型额度限制。',
        pricingEvidence?.kind === 'measured'
          ? `SemiAnalysis ${pricingEvidence.publishedOn}，agentic 工作负载；${pricingEvidence.checkedOn} 核对。`
          : '旧估算；暂无对应模型的 SemiAnalysis 公开实测。',
        subscription.usableQuotaFraction < 1
          ? `完整额度基准 $${formatCostValue(subscription.apiEquivalentCostUSD)} × ${(subscription.usableQuotaFraction * 100).toFixed(0)}%；不再次折半。`
          : '',
        '满额使用下的折算值，实际利用率及缓存比例会影响成本。',
      ].filter(Boolean).join(' ')
    : undefined;
  const inputPrice = scoreItem.config.openRouterData?.inputPricePerMToken;
  const outputPrice = scoreItem.config.openRouterData?.outputPricePerMToken;

  return [
    ...benchmarkRows,
    {
      id: 'speed_throughput',
      label: 'Throughput Speed',
      value:
        throughput === null || throughput === undefined
          ? '--'
          : throughput.toFixed(1),
      color: '#F97316',
      domainId: null,
      title: 'Throughput Speed - Speed Metric (Raw Value)',
    },
    {
      id: 'speed_ttft',
      label: 'TTFT Latency',
      value:
        ttft === null || ttft === undefined
          ? '--'
          : (ttft * 1000).toFixed(0),
      color: '#F97316',
      domainId: null,
      title: 'TTFT Latency - Speed Metric (Raw Value)',
    },
    {
      id: 'cost_input',
      label: subscription ? 'Monthly Price' : 'Input Price',
      value: subscription
        ? subscription.monthlyPriceUSD.toFixed(0)
        : inputPrice === null || inputPrice === undefined
          ? '--'
          : inputPrice.toFixed(2),
      color: '#6366F1',
      domainId: null,
      title: subscription
        ? 'Monthly subscription price'
        : 'Input Price - Price Metric (Raw Value)',
    },
    {
      id: 'cost_output',
      label: subscription ? 'API Equivalent' : 'Output Price',
      value: subscription
        ? `${pricingEvidence?.kind === 'measured' ? '' : '≈ '}${formatCostValue(
            subscription.apiEquivalentCostUSD * subscription.usableQuotaFraction,
          )}`
        : outputPrice === null || outputPrice === undefined
          ? '--'
          : outputPrice.toFixed(2),
      color: '#6366F1',
      domainId: null,
      title: subscriptionCostTitle ?? 'Output Price - Price Metric (Raw Value)',
    },
  ];
};

interface ConfigurationRadarProps {
  scoreItem: PublicLeaderboardScore;
  size: number;
  hoveredDomain?: DomainId | null;
  onHoverDomain?: (domain: DomainId | null) => void;
  showDomainNames?: boolean;
  animate?: boolean;
  fitHeight?: boolean;
}

export const ConfigurationRadar: React.FC<ConfigurationRadarProps> = ({
  scoreItem,
  size,
  hoveredDomain,
  onHoverDomain,
  showDomainNames = true,
  animate = false,
  fitHeight = false,
}) => {
  const brandTheme = getProviderBrandTheme(scoreItem.config.provider);

  return (
    <RadarChart
      seriesList={[
        {
          id: scoreItem.config.id,
          name: scoreItem.config.name,
          color: brandTheme.color,
          fillColor: brandTheme.fillColor,
          scores: {
            chatting: scoreItem.domainScores.chatting.score,
            reasoning: scoreItem.domainScores.reasoning.score,
            coding: scoreItem.domainScores.coding.score,
            frontend: scoreItem.domainScores.frontend.score,
            agentic: scoreItem.domainScores.agentic.score,
            documents: scoreItem.domainScores.documents.score,
          },
        },
      ]}
      size={size}
      showLegend={false}
      hoveredDomain={hoveredDomain}
      onHoverDomain={onHoverDomain}
      showDomainNames={showDomainNames}
      animateSeries={animate}
      fitHeight={fitHeight}
    />
  );
};

export const buildValsMetricRows = (scoreItem: PublicLeaderboardScore) => (
  VALS_METRIC_DEFINITIONS.map(metric => {
    const evidence = scoreItem.config.valsData?.find(item => item.metricId === metric.id);
    const value = evidence?.rawValue;
    return {
      id: metric.id, label: metric.name,
      scoringWeight: metric.scoringWeightInDomain,
      value: typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '--',
      evidence,
      conditions: evidence
        ? `${evidence.sourceProfile} · ${evidence.sourceHarness ?? (metric.slug === 'vals_index' ? '分项环境各异' : '环境未披露')}`
        : '暂无匹配来源',
    };
  })
);

const ValsSupplementaryMetrics: React.FC<{ scoreItem: PublicLeaderboardScore }> = ({ scoreItem }) => {
  const rows = buildValsMetricRows(scoreItem);
  const matchedCount = rows.filter(row => typeof row.evidence?.rawValue === 'number').length;
  return (
    <details className="border-t border-neutral-200 pt-2 text-xs">
      <summary className="cursor-pointer rounded px-1.5 py-1 font-semibold text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        Vals AI <span className="font-normal text-neutral-500">· 7 项计分，2 项参考 · {matchedCount}/{rows.length}</span>
      </summary>
      <div className="mt-2 px-1.5 pr-2">
        <p className="mb-3 leading-relaxed text-neutral-500">采用官方原模型口径，备用任务计失败；未披露备用信息时保留公布分。SE 为标准误。</p>
        <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
          {rows.map(row => (
            <div key={row.id} className="min-w-0" data-vals-metric-id={row.id}>
              <div className="flex items-baseline justify-between gap-2">
                {row.evidence ? (
                  <a href={row.evidence.sourceUrl} target="_blank" rel="noreferrer"
                    className="min-w-0 truncate font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:text-blue-600"
                    title={`Vals ${row.label} · v${row.evidence.benchmarkVersion ?? '未披露'} · 榜单更新 ${row.evidence.sourceUpdated}${row.evidence.profileFallback ? ' · 使用已审核的较低档位来源' : ''}`}>
                    {row.label}
                  </a>
                ) : <span className="min-w-0 truncate font-semibold text-neutral-500">{row.label}</span>}
                <span className="shrink-0 font-brand-mono font-bold text-neutral-950">{row.value}</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-neutral-500" title={row.conditions}>
                {row.scoringWeight > 0 ? `领域权重 ${Math.round(row.scoringWeight * 100)}%` : '仅参考'} · {row.conditions}
              </p>
              {row.evidence && (
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  {row.evidence.sourceUpdated}
                  {row.evidence.standardError !== null ? ` · SE ${(row.evidence.standardError * 100).toFixed(2)}` : ''}
                  {row.evidence.scoreBasis === 'no-fallback' && row.evidence.publishedRawValue !== null
                    ? ` · 公布 ${(row.evidence.publishedRawValue * 100).toFixed(2)}% · ${row.evidence.fallbackCount} 备用任务计失败`
                    : row.evidence.fallbackCount === null ? ' · 备用信息未披露' : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
};

interface ConfigurationMetricListProps {
  scoreItem: PublicLeaderboardScore;
  columns?: 1 | 2;
  hoveredDomain?: DomainId | null;
  onHoverDomain?: (domain: DomainId | null) => void;
}

export const ConfigurationMetricList: React.FC<ConfigurationMetricListProps> = ({
  scoreItem,
  columns = 2,
  hoveredDomain = null,
  onHoverDomain,
}) => {
  const rows = buildConfigurationMetricRows(scoreItem);
  const hasHoveredDomain = hoveredDomain !== null;

  return (
    <div className="space-y-2">
      <div
        className={`configuration-metric-list grid gap-x-6 gap-y-1.5 font-brand-mono text-xs sm:text-sm ${
        columns === 2 ? 'grid-cols-2' : 'grid-cols-1'
      }`}
      >
      {rows.map((row) => {
        const isMatchedDomain = row.domainId !== null && hoveredDomain === row.domainId;
        const isDimmed = hasHoveredDomain && !isMatchedDomain;

        return (
          <div
            key={row.id}
            className={`configuration-metric-row flex min-h-7 min-w-0 items-center justify-between gap-2 rounded px-1.5 py-1 transition-all duration-200 ${
              row.domainId !== null ? 'cursor-pointer' : ''
            } ${isDimmed ? 'opacity-25 hover:opacity-100' : 'opacity-100'}`}
            onMouseEnter={() => {
              if (row.domainId !== null) onHoverDomain?.(row.domainId);
            }}
            onMouseLeave={() => {
              if (row.domainId !== null) onHoverDomain?.(null);
            }}
            title={row.title}
            data-metric-id={row.id}
          >
            <span
              className={`min-w-0 truncate text-xs sm:text-sm ${
                isMatchedDomain ? 'font-black' : 'font-bold'
              }`}
              style={{ color: row.color }}
            >
              {row.label}
            </span>
            <span className="shrink-0 font-brand-mono text-xs font-black text-neutral-950 sm:text-sm">
              {row.value}
            </span>
          </div>
        );
      })}
      </div>
      <ValsSupplementaryMetrics scoreItem={scoreItem} />
    </div>
  );
};
