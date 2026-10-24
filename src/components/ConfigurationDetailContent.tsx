import React from 'react';
import { getCompactMetricName } from '../data/compactMetricNames';
import { getSubscriptionPricingEvidence } from '../data/subscriptionPricing';
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
  sourceUrl?: string;
  weightInDomain?: number;
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
    const domainMetrics = ALL_METRIC_DEFINITIONS.filter(
      (metric) => metric.domain === domainId
    );
    return domainMetrics.map((metric) => {
      const observation = scoreItem.config.observations[metric.id];
      const rawValue = observation?.rawValue;
      const formattedValue = formatConfigurationRawMetricValue(rawValue, metric.unit);
      const valsEvidence = scoreItem.config.valsData?.find(item => item.metricId === metric.id);
      const sourceConditions = valsEvidence
        ? ` · ${[
          `Vals v${valsEvidence.benchmarkVersion ?? '未披露'}`,
          `来源更新 ${valsEvidence.sourceUpdated}`,
          `${valsEvidence.sourceProfile} / ${valsEvidence.sourceHarness ?? '评测环境未披露'}`,
          valsEvidence.profileFallback ? '使用已审核的较低档位来源' : '',
          valsEvidence.rawValue !== null ? `来源成绩 ${(valsEvidence.rawValue * 100).toFixed(2)}%` : '',
          valsEvidence.standardError !== null ? `SE ${(valsEvidence.standardError * 100).toFixed(2)}（标准误）` : '',
          valsEvidence.scoreBasis === 'no-fallback'
            ? `原模型口径：备用任务计失败${valsEvidence.publishedRawValue !== null ? `；公布分 ${(valsEvidence.publishedRawValue * 100).toFixed(2)}%` : ''}`
            : '来源公布分',
          valsEvidence.fallbackCount === null ? '备用信息未披露' : `备用任务 ${valsEvidence.fallbackCount}`,
        ].filter(Boolean).join(' · ')}`
        : '';

      return {
        id: metric.id,
        label: getCompactMetricName(metric.id, metric.name),
        value: formattedValue,
        color: domainDefinition.color,
        domainId,
        sourceUrl: valsEvidence?.sourceUrl ?? metric.officialUrl,
        weightInDomain: metric.internalWeightInDomain,
        title: `${metric.name} (${domainDefinition.nameEn}) · 计分权重 ${(metric.internalWeightInDomain * 100).toFixed(0)}% · ${metric.source} · Raw Value: ${formattedValue}${observation?.sourceSnapshotDate ? ` · 来源快照 ${observation.sourceSnapshotDate}` : ''}${sourceConditions}`,
      };
    });
  });

  const throughput = scoreItem.config.openRouterData?.throughputP50TokensPerSec;
  const ttft = scoreItem.config.openRouterData?.ttftP50Seconds;
  const subscription = scoreItem.config.subscriptionData;
  const pricingEvidence = getSubscriptionPricingEvidence(subscription?.pricingEvidenceId);
  const usableSubscriptionAllowance = subscription && subscription.apiEquivalentCostUSD !== null && subscription.usableQuotaFraction !== null
    ? subscription.apiEquivalentCostUSD * subscription.usableQuotaFraction : null;
  const subscriptionCostTitle = subscription && usableSubscriptionAllowance === null
    ? '官方月费已公布，API 等效额度尚未公布；成本调整和实用分保持缺测。'
    : subscription
    ? [
        '可用月度 API 等效额度（USD）；已计入模型额度限制。',
        pricingEvidence?.kind === 'measured'
          ? `SemiAnalysis ${pricingEvidence.publishedOn}，agentic 工作负载；${pricingEvidence.checkedOn} 核对。`
          : '旧估算；暂无对应模型的 SemiAnalysis 公开实测。',
        subscription.usableQuotaFraction !== null && subscription.apiEquivalentCostUSD !== null && subscription.usableQuotaFraction < 1
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
        ? usableSubscriptionAllowance === null ? '--'
          : `${pricingEvidence?.kind === 'measured' ? '' : '≈ '}${formatCostValue(usableSubscriptionAllowance)}`
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
              className={`flex min-w-0 items-center gap-1.5 text-xs sm:text-sm ${
                isMatchedDomain ? 'font-black' : 'font-bold'
              }`}
              style={{ color: row.color }}
            >
              {row.sourceUrl ? (
                <a href={row.sourceUrl} target="_blank" rel="noreferrer"
                  className="min-w-0 truncate rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
                  {row.label}
                </a>
              ) : <span className="truncate">{row.label}</span>}
              {row.weightInDomain !== undefined && <span className="shrink-0 text-[9px] font-normal text-neutral-500" title="领域内配置权重">{Math.round(row.weightInDomain * 100)}%</span>}
            </span>
            <span className="shrink-0 font-brand-mono text-xs font-black text-neutral-950 sm:text-sm">
              {row.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};
