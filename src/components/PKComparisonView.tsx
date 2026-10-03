import React from 'react';
import { 
  Swords, 
  Trophy, 
  Zap, 
  DollarSign, 
  CheckCircle2, 
  X, 
  Plus, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { ProcessedConfigurationScore, DomainId } from '../types/llm_pk';
import { DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { COVERAGE_STATUS_LABELS } from '../engine/scoringConfig';
import { RadarChart, RadarSeries } from './RadarChart';
import { ConfigNameDisplay } from './ConfigNameDisplay';
import { getProviderBrandTheme } from '../utils/providerColors';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

interface PKComparisonViewProps {
  allScores: ProcessedConfigurationScore[];
  selectedIds: string[];
  onRemoveFromPK: (id: string) => void;
  onClearPK: () => void;
  onAddConfigToPK: (id: string) => void;
}

const SERIES_COLORS = ['#06B6D4', '#F59E0B', '#EC4899']; // Cyan, Amber, Pink
const formatScore = (score: number | null) => score === null ? '数据不足' : score.toFixed(1);

export const PKComparisonView: React.FC<PKComparisonViewProps> = ({
  allScores,
  selectedIds,
  onRemoveFromPK,
  onClearPK,
  onAddConfigToPK,
}) => {
  const selectedItems = selectedIds
    .map((id) => allScores.find((s) => s.config.id === id))
    .filter((item): item is ProcessedConfigurationScore => item !== undefined);

  // Prepare Radar Series list
  const radarSeriesList: RadarSeries[] = selectedItems.map((item, idx) => {
    const brandTheme = getProviderBrandTheme(item.config.provider);
    return {
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
    };
  });

  const domainList: DomainId[] = [
    'chatting',
    'reasoning',
    'coding',
    'frontend',
    'agentic',
    'documents',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-8 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-amber-400">
            <Swords className="w-4 h-4" /> Head-to-Head PK
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            对决 PK 模式
          </h1>
        </div>

        {selectedItems.length > 0 && (
          <button
            onClick={onClearPK}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shadow-xs"
          >
            清空对决
          </button>
        )}
      </div>

      {/* Model Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((slotIdx) => {
          const item = selectedItems[slotIdx];

          if (item) {
            const color = SERIES_COLORS[slotIdx];
            const practicalAdjustment = getPracticalAdjustment(item.practicalBreakdown);

            return (
              <div
                key={item.config.id}
                className="relative bg-slate-900/90 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between shadow-xl"
                style={{ borderTopColor: color, borderTopWidth: '4px' }}
              >
                <button
                  onClick={() => onRemoveFromPK(item.config.id)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>

                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">
                    #{slotIdx + 1}
                  </div>
                  <h3 className="text-lg font-bold pr-6">
                    <ConfigNameDisplay name={item.config.name} darkBg={true} />
                  </h3>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/60 grid grid-cols-2 gap-3 text-center font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="text-[10px] text-slate-400 font-sans">Practical &Delta;</div>
                    <div className={`text-xl font-extrabold ${
                      practicalAdjustmentTextClass(practicalAdjustment, true)
                    }`}>
                      {formatPracticalAdjustment(practicalAdjustment)}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="text-[10px] text-slate-400 font-sans">
                      能力分
                    </div>
                    <div className="text-lg font-bold text-slate-200">{formatScore(item.rawCapabilityScore)}</div>
                  </div>
                </div>
                {!item.eligibleForGlobalLeaderboard && (
                  <div className="mt-2.5 text-center text-[10px] font-semibold text-amber-400">
                    未入榜
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={`empty-slot-${slotIdx}`}
              className="bg-slate-900/40 border-2 border-dashed border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[160px]"
            >
              <p className="text-xs font-mono text-slate-400 mb-3">
                #{slotIdx + 1}
              </p>
              <select
                onChange={(e) => {
                  if (e.target.value) onAddConfigToPK(e.target.value);
                }}
                defaultValue=""
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[220px]"
              >
                <option value="" disabled>+ 选择配置</option>
                {allScores
                  .filter((s) => !selectedIds.includes(s.config.id))
                  .map((s) => (
                    <option key={s.config.id} value={s.config.id}>
                      {s.config.name}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>

      {selectedItems.length >= 2 ? (
        <div className="space-y-10">
          {/* Multi-Series Radar Overlay Chart (Frameless Massive Radar) */}
          <div className="flex flex-col items-center justify-center py-6">
            <h3 className="text-xl font-black text-slate-200 mb-6 tracking-tight">
              能力对比雷达图
            </h3>
            <RadarChart seriesList={radarSeriesList} size={780} showLegend={true} />
          </div>

          {/* 6-Domain Side-by-Side Comparison Matrix */}
          <div className="space-y-6 pt-6 border-t-2 border-slate-800">
            <h3 className="text-lg font-bold text-slate-200">
              领域胜负对比
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {domainList.map((dId) => {
                const def = DOMAIN_DEFINITIONS[dId];

                // Determine winner in this domain
                let maxScore = -1;
                let winnerId = '';
                selectedItems.forEach((item) => {
                  const s = item.domainScores[dId].score;
                  if (s !== null && s > maxScore) {
                    maxScore = s;
                    winnerId = item.config.id;
                  }
                });

                return (
                  <div
                    key={dId}
                    className="bg-slate-900/60 p-5 rounded-2xl flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: def.color }} />
                      <span className="text-xs font-bold text-slate-200">{def.nameEn}</span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedItems.map((item, idx) => {
                        const score = item.domainScores[dId].score;
                        const isWinner = score !== null && item.config.id === winnerId;
                        const color = SERIES_COLORS[idx];

                        return (
                          <div
                            key={item.config.id}
                            className="flex items-center justify-between text-xs font-mono p-2.5 rounded-xl bg-slate-950/80"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <div className="truncate flex-1 min-w-0" title={item.config.name}>
                                <ConfigNameDisplay name={item.config.name} darkBg={true} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <span className="font-black text-white text-base">{formatScore(score)}</span>
                              {isWinner && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-black bg-amber-500 text-slate-950">
                                  WIN
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Swords className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">请选择至少 2 个配置开始对比</h3>
        </div>
      )}
    </div>
  );
};
