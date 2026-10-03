import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Zap, 
  DollarSign, 
  Terminal, 
  Cpu, 
  Globe, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { ProcessedConfigurationScore, DomainId } from '../types/llm_pk';
import { ALL_METRIC_DEFINITIONS, DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { COVERAGE_STATUS_LABELS, SCORING_CONFIG } from '../engine/scoringConfig';
import { RadarChart, RadarSeries } from './RadarChart';
import { getProviderBrandTheme } from '../utils/providerColors';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

interface ConfigurationDetailModalProps {
  scoreItem: ProcessedConfigurationScore | null;
  onClose: () => void;
  onAddToPK: (configId: string) => void;
  isInPKList: boolean;
}

const formatScore = (score: number | null) => score === null ? '数据不足' : score.toFixed(1);
const formatOptionalNumber = (value: number | null, digits = 1) => value === null ? '--' : value.toFixed(digits);
const formatAdjustment = (value: number | null) => {
  if (value === null) return '--';
  return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
};

export const ConfigurationDetailModal: React.FC<ConfigurationDetailModalProps> = ({
  scoreItem,
  onClose,
  onAddToPK,
  isInPKList,
}) => {
  const [selectedDomainTab, setSelectedDomainTab] = useState<DomainId | 'all'>('all');

  if (!scoreItem) return null;

  const {
    config,
    domainScores,
    rawCapabilityScore,
    practicalBreakdown,
    overallCoverage,
    availableDomainCount,
    coverageStatus,
    eligibleForGlobalLeaderboard,
  } = scoreItem;
  const practicalAdjustment = getPracticalAdjustment(practicalBreakdown);

  // Radar Series setup
  const radarScoresMap: Record<DomainId, number | null> = {
    chatting: domainScores.chatting.score,
    reasoning: domainScores.reasoning.score,
    coding: domainScores.coding.score,
    frontend: domainScores.frontend.score,
    agentic: domainScores.agentic.score,
    documents: domainScores.documents.score,
  };

  const brandTheme = getProviderBrandTheme(config.provider);
  const radarSeries: RadarSeries[] = [
    {
      id: config.id,
      name: config.name,
      color: brandTheme.color,
      fillColor: brandTheme.fillColor,
      scores: radarScoresMap,
    },
  ];

  const domainList: DomainId[] = [
    'chatting',
    'reasoning',
    'coding',
    'frontend',
    'agentic',
    'documents',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                {config.provider}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                {config.access.entryPoint}
              </span>
              {config.tags?.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">
                  {t}
                </span>
              ))}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              {config.name}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onAddToPK(config.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isInPKList
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
              }`}
            >
              {isInPKList ? '已加入 PK 对决' : '+ 加入 PK 对决'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Configuration Spec & Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Identity & Harness Spec */}
            <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Configuration 三要素定义
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Identity: </span>
                  <span className="text-slate-200 font-semibold">{config.identity.modelName} ({config.identity.modelVersion})</span>
                  {config.identity.reasoningEffort !== 'None' && (
                    <span className="ml-1.5 text-cyan-400 font-mono text-[11px] bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      Effort: {config.identity.reasoningEffort}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400">Execution: </span>
                  <span className="text-slate-200 font-semibold">{config.execution.harness}</span>
                </div>

                <div>
                  <span className="text-slate-400">Access: </span>
                  <span className="text-slate-200 font-semibold">{config.access.entryPoint} ({config.access.routingPolicy || 'direct'})</span>
                </div>
              </div>
            </div>

            {/* Practical Score Calculation Breakdown Card */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Practical Adjustment 实用调整
                </h3>

                {eligibleForGlobalLeaderboard && coverageStatus === 'official' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> 已入榜 · 完整覆盖
                  </span>
                ) : eligibleForGlobalLeaderboard ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950 text-sky-300 border border-sky-800">
                    <Info className="w-3 h-3" /> 已入榜 · 覆盖 {availableDomainCount}/6
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950 text-amber-400 border border-amber-800">
                    <AlertTriangle className="w-3 h-3" /> 数据不足
                  </span>
                )}
              </div>

              {/* Equation Display */}
              <div className="grid grid-cols-4 gap-2 items-center my-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 text-center font-mono">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-sans">
                    能力分 A
                  </span>
                  <span className="text-lg font-bold text-white">{formatScore(rawCapabilityScore)}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-sans">速度 &Delta;v</span>
                  <span className={`text-lg font-bold ${
                    practicalBreakdown.speedDelta === null
                      ? 'text-slate-500'
                      : practicalBreakdown.speedDelta >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}>
                    {formatAdjustment(practicalBreakdown.speedDelta)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-sans">成本 &Delta;c</span>
                  <span className={`text-lg font-bold ${
                    practicalBreakdown.costDelta === null
                      ? 'text-slate-500'
                      : practicalBreakdown.costDelta >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}>
                    {formatAdjustment(practicalBreakdown.costDelta)}
                  </span>
                </div>

                <div className="flex flex-col bg-cyan-950/80 p-2 rounded-lg border border-cyan-800/60 shadow-inner">
                  <span className="text-[10px] text-cyan-300 font-sans font-semibold">实用分 &Delta;</span>
                  <span className={`text-xl font-extrabold ${
                    practicalAdjustmentTextClass(practicalAdjustment, true)
                  }`}>
                    {formatPracticalAdjustment(practicalAdjustment)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>总覆盖率: {(overallCoverage * 100).toFixed(0)}%（{COVERAGE_STATUS_LABELS[coverageStatus]}，{availableDomainCount}/6 维可用）</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>速度效用: Throughput {config.openRouterData?.throughputP50TokensPerSec ?? '--'} t/s, TTFT {config.openRouterData?.ttftP50Seconds ?? '--'}s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>标准成本: ${formatOptionalNumber(practicalBreakdown.effectiveScenarioCostUSD, 2)} / 1.25M tokens (中位数: ${formatOptionalNumber(practicalBreakdown.referenceCostUSD, 2)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 6-Domain Radar & Domain Breakdown Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
            <div className="lg:col-span-7 flex justify-center py-4">
              <RadarChart seriesList={radarSeries} size={620} showLegend={false} />
            </div>

            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-base font-bold text-slate-200 mb-3 border-b border-slate-800 pb-2">六维领域得分</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {domainList.map((dId) => {
                  const dDetail = domainScores[dId];
                  const def = DOMAIN_DEFINITIONS[dId];

                  return (
                    <div
                      key={dId}
                      className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{def.nameEn}</div>
                          <div className="text-[10px] text-slate-400">覆盖率: {(dDetail.coverage * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-white">{formatScore(dDetail.score)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Atomic Benchmark Observations Table */}
          <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  原子指标明细 ({ALL_METRIC_DEFINITIONS.length}项)
                </h3>
              </div>

              {/* Domain Filter Tabs */}
              <div className="flex items-center gap-1 mt-2 sm:mt-0 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setSelectedDomainTab('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                    selectedDomainTab === 'all'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  全部指标 ({ALL_METRIC_DEFINITIONS.length})
                </button>
                {domainList.map((dId) => (
                  <button
                    key={dId}
                    onClick={() => setSelectedDomainTab(dId)}
                    className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                      selectedDomainTab === dId
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {DOMAIN_DEFINITIONS[dId].nameEn.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">所属领域</th>
                    <th className="px-4 py-3 font-medium">指标名称</th>
                    <th className="px-4 py-3 font-medium">数据源</th>
                    <th className="px-4 py-3 font-medium">连续原始值</th>
                    <th className="px-4 py-3 font-medium">变换值 y</th>
                    <th className="px-4 py-3 font-medium">单项分 s_i</th>
                    <th className="px-4 py-3 font-medium">领域内权重</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300">
                  {domainList
                    .filter((dId) => selectedDomainTab === 'all' || selectedDomainTab === dId)
                    .flatMap((dId) => domainScores[dId].metricDetails)
                    .map((m) => {
                      const domainDef = DOMAIN_DEFINITIONS[m.domain];

                      return (
                        <tr key={m.metricId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: domainDef.color }} />
                              {domainDef.nameEn}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-semibold text-white">
                            {m.metricName}
                          </td>

                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                            {m.source}
                          </td>

                          <td className="px-4 py-3 font-mono font-medium text-slate-200">
                            {m.rawValue !== null ? (
                              <span>
                                {m.rawValue > 1 ? m.rawValue.toFixed(1) : (m.rawValue * 100).toFixed(1) + '%'}
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-400">
                            {m.transformedValue !== null ? m.transformedValue.toFixed(3) : '--'}
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-cyan-400">
                            {m.isMissing ? '--' : formatScore(m.normalizedScore)}
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-300">
                            {(m.weightInDomain * 100).toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
