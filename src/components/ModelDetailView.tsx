import React, { useState } from 'react';
import { ProcessedConfigurationScore, DomainId } from '../types/llm_pk';
import { DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { COVERAGE_STATUS_LABELS } from '../engine/scoringConfig';
import { RadarChart, RadarSeries } from './RadarChart';
import { ConfigNameDisplay } from './ConfigNameDisplay';
import { getProviderBrandTheme } from '../utils/providerColors';
import { CheckCircle2, ChevronRight, Info } from 'lucide-react';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

interface ModelDetailViewProps {
  scoreItems: ProcessedConfigurationScore[];
  selectedConfigId?: string;
}

const formatScore = (score: number | null) => score === null ? '数据不足' : score.toFixed(1);

export const ModelDetailView: React.FC<ModelDetailViewProps> = ({
  scoreItems,
  selectedConfigId,
}) => {
  const [activeId, setActiveId] = useState<string>(
    selectedConfigId || scoreItems[0]?.config.id || ''
  );
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');

  const selectedItem = scoreItems.find((item) => item.config.id === activeId) || scoreItems[0];
  const practicalAdjustment = selectedItem
    ? getPracticalAdjustment(selectedItem.practicalBreakdown)
    : null;

  const domainList: DomainId[] = [
    'chatting',
    'reasoning',
    'coding',
    'frontend',
    'agentic',
    'documents',
  ];

  return (
    <div className="space-y-6 py-2">
      {/* Top Header & Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h1 className="text-base font-bold text-slate-900">
          配置详情
        </h1>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode('single')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            单配置
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            全配置 ({scoreItems.length})
          </button>
        </div>
      </div>

      {viewMode === 'single' && selectedItem && (
        <div className="w-full space-y-10">
          {/* Top Model Header & Radar Display */}
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-slate-200/80 pb-5">
              <div className="flex items-center gap-4 flex-wrap">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  <ConfigNameDisplay name={selectedItem.config.name} />
                </h2>

                {/* Model Selector Dropdown */}
                <select
                  value={selectedItem.config.id}
                  onChange={(e) => setActiveId(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 border-none rounded-xl text-xs font-bold text-slate-800 focus:outline-none transition-all"
                >
                  {scoreItems.map((item) => (
                    <option key={item.config.id} value={item.config.id}>
                      {item.config.name} ({formatScore(item.rawCapabilityScore)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
                <div>
                  <span className="text-xs text-slate-400 font-sans mr-2">
                    能力分 ({selectedItem.availableDomainCount}/6):
                  </span>
                  <span className="text-2xl font-black text-blue-600">
                    {formatScore(selectedItem.rawCapabilityScore)}
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <span className="text-xs text-slate-400 font-sans mr-2">实用分 &Delta;:</span>
                  <span className={`text-xl font-bold ${
                    practicalAdjustmentTextClass(practicalAdjustment)
                  }`}>
                    {formatPracticalAdjustment(practicalAdjustment)}
                  </span>
                </div>
                {!selectedItem.eligibleForGlobalLeaderboard && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 font-sans">
                    未入榜
                  </span>
                )}
              </div>
            </div>

            {/* Expanded Full-Width Massive Radar Chart & 6 Domain Scores */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
              <div className="lg:col-span-8 flex justify-center items-center py-6">
                {(() => {
                  const brandTheme = getProviderBrandTheme(selectedItem.config.provider);
                  return (
                    <RadarChart
                      seriesList={[
                        {
                          id: selectedItem.config.id,
                          name: selectedItem.config.name,
                          color: brandTheme.color,
                          fillColor: brandTheme.fillColor,
                          scores: {
                            chatting: selectedItem.domainScores.chatting.score,
                            reasoning: selectedItem.domainScores.reasoning.score,
                            coding: selectedItem.domainScores.coding.score,
                            frontend: selectedItem.domainScores.frontend.score,
                            agentic: selectedItem.domainScores.agentic.score,
                            documents: selectedItem.domainScores.documents.score,
                          },
                        },
                      ]}
                      size={760}
                      showLegend={false}
                    />
                  );
                })()}
              </div>

              <div className="lg:col-span-4 space-y-4">
                <div className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
                  领域得分
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {domainList.map((dId) => {
                    const dDetail = selectedItem.domainScores[dId];
                    const def = DOMAIN_DEFINITIONS[dId];

                    return (
                      <div
                        key={dId}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-3.5 h-3.5 rounded-full shadow-xs" style={{ backgroundColor: def.color }} />
                          <span className="font-bold text-slate-800 text-sm">{def.nameEn}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-lg font-black text-slate-900">
                            {formatScore(dDetail.score)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width Atomic Metrics Table */}
          <div className="space-y-3 pt-6 border-t-2 border-slate-200/80">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-900">
                测评明细
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 font-mono text-[11px] border-b-2 border-slate-200/80 uppercase tracking-wider">
                    <th className="px-4 py-3 font-bold">领域</th>
                    <th className="px-4 py-3 font-bold">指标</th>
                    <th className="px-4 py-3 font-bold">数据源</th>
                    <th className="px-4 py-3 font-bold">原始值</th>
                    <th className="px-4 py-3 font-bold">得分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                  {domainList.flatMap((dId) =>
                    selectedItem.domainScores[dId].metricDetails.map((m) => (
                      <tr key={m.metricId} className="hover:bg-slate-50/90 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-medium">
                          {DOMAIN_DEFINITIONS[m.domain].nameEn}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {m.metricName}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {m.source}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {m.rawValue !== null ? (
                            m.rawValue > 1 ? m.rawValue.toFixed(1) : (m.rawValue * 100).toFixed(1) + '%'
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-slate-900 text-sm">
                          {m.isMissing ? '--' : formatScore(m.normalizedScore)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Grid Overview View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {scoreItems.map((item) => (
            <div
              key={item.config.id}
              onClick={() => {
                setActiveId(item.config.id);
                setViewMode('single');
              }}
              className="p-6 space-y-4 cursor-pointer hover:bg-slate-50/80 rounded-2xl transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg"><ConfigNameDisplay name={item.config.name} /></h3>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xl font-black text-blue-600">
                    {formatScore(item.rawCapabilityScore)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    能力分 ({item.availableDomainCount}/6 有观测)
                  </div>
                  {!item.eligibleForGlobalLeaderboard && (
                    <div className="mt-1 text-[10px] font-sans font-bold text-amber-600">
                      未入榜
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center py-4">
                {(() => {
                  const brandTheme = getProviderBrandTheme(item.config.provider);
                  return (
                    <RadarChart
                      seriesList={[
                        {
                          id: item.config.id,
                          name: item.config.name,
                          color: brandTheme.color,
                          fillColor: brandTheme.fillColor,
                          scores: {
                            chatting: item.domainScores.chatting.score,
                            reasoning: item.domainScores.reasoning.score,
                            coding: item.domainScores.coding.score,
                            frontend: item.domainScores.frontend.score,
                            agentic: item.domainScores.agentic.score,
                            documents: item.domainScores.documents.score,
                          },
                        },
                      ]}
                      size={320}
                      showLegend={false}
                    />
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
