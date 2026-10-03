import React from 'react';
import { DETAIL_ONLY_METRIC_DEFINITIONS } from '../data/detailMetricDefinitions';
import { getCompactMetricName } from '../data/compactMetricNames';
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
    const detailOnlyMetrics = DETAIL_ONLY_METRIC_DEFINITIONS.filter(
      (metric) => metric.domain === domainId
    );

    return [...scoredMetrics, ...detailOnlyMetrics].map((metric) => {
      const rawValue = scoreItem.config.observations[metric.id]?.rawValue;
      const formattedValue = formatConfigurationRawMetricValue(rawValue, metric.unit);

      return {
        id: metric.id,
        label: getCompactMetricName(metric.id, metric.name),
        value: formattedValue,
        color: domainDefinition.color,
        domainId,
        title: `${metric.name} (${domainDefinition.nameEn}) · ${'internalWeightInDomain' in metric
          ? `计分权重 ${(metric.internalWeightInDomain * 100).toFixed(0)}%`
          : '仅展示，不计分'} · Raw Value: ${formattedValue}`,
      };
    });
  });

  const throughput = scoreItem.config.openRouterData?.throughputP50TokensPerSec;
  const ttft = scoreItem.config.openRouterData?.ttftP50Seconds;
  const subscription = scoreItem.config.subscriptionData;
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
        ? `${formatCostValue(subscription.apiEquivalentCostUSD)}${
            subscription.usableQuotaFraction < 1
              ? ` × ${(subscription.usableQuotaFraction * 100).toFixed(0)}%`
              : ''
          }`
        : outputPrice === null || outputPrice === undefined
          ? '--'
          : outputPrice.toFixed(2),
      color: '#6366F1',
      domainId: null,
      title: subscription
        ? 'API-equivalent monthly allowance and model-usable share'
        : 'Output Price - Price Metric (Raw Value)',
    },
  ];
};

export const ConfigurationCoverageSummary: React.FC<{ scoreItem: PublicLeaderboardScore }> = ({ scoreItem }) => (
  <div className="space-y-2 text-xs text-neutral-600" data-coverage-summary>
    <div className="font-semibold">
      Coverage {(scoreItem.overallCoverage * 100).toFixed(0)}% · {scoreItem.availableDomainCount}/6 domains
      {!scoreItem.eligibleForGlobalLeaderboard && <span className="ml-2 text-amber-800">证据不足，暂不综合排名</span>}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-brand-mono">
      {CONFIGURATION_DETAIL_DOMAIN_ORDER.map(id => (
        <span key={id} style={{ color: DOMAIN_DEFINITIONS[id].color }}>
          {DOMAIN_DEFINITIONS[id].nameEn} {(scoreItem.domainScores[id].coverage * 100).toFixed(0)}%
        </span>
      ))}
    </div>
    <p>每域至少 60%、六域均达标、总覆盖率至少 75% 才有综合分。缺测保留为 --。</p>
  </div>
);

interface ConfigurationRadarProps {
  scoreItem: PublicLeaderboardScore;
  size: number;
  hoveredDomain?: DomainId | null;
  onHoverDomain?: (domain: DomainId | null) => void;
  showDomainNames?: boolean;
  animate?: boolean;
}

export const ConfigurationRadar: React.FC<ConfigurationRadarProps> = ({
  scoreItem,
  size,
  hoveredDomain,
  onHoverDomain,
  showDomainNames = true,
  animate = false,
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
      className={`grid gap-x-6 gap-y-1.5 font-brand-mono text-xs sm:text-sm ${
        columns === 2 ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      {rows.map((row) => {
        const isMatchedDomain = row.domainId !== null && hoveredDomain === row.domainId;
        const isDimmed = hasHoveredDomain && !isMatchedDomain;

        return (
          <div
            key={row.id}
            className={`flex min-h-7 min-w-0 items-center justify-between gap-2 rounded px-1.5 py-1 transition-all duration-200 ${
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
  );
};
