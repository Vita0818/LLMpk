import React, { useState } from 'react';
import { Sliders, RefreshCw } from 'lucide-react';
import { adminMappingStore } from '../store/adminMappingStore';
import { ProcessedConfigurationScore, DomainId } from '../types/llm_pk';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

export const PlaygroundView: React.FC = () => {
  const [customWeights, setCustomWeights] = useState<Record<DomainId, number>>({
    chatting: 1 / 6,
    reasoning: 1 / 6,
    coding: 1 / 6,
    frontend: 1 / 6,
    agentic: 1 / 6,
    documents: 1 / 6,
  });

  // This view deliberately uses the same verified source-card records as the
  // leaderboard. It never loads an illustrative benchmark dataset.
  const computedScores: ProcessedConfigurationScore[] = adminMappingStore.computeLeaderboardScores();
  const formatScore = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '数据不足';

  const resetWeights = () => {
    setCustomWeights({
      chatting: 1 / 6,
      reasoning: 1 / 6,
      coding: 1 / 6,
      frontend: 1 / 6,
      agentic: 1 / 6,
      documents: 1 / 6,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-purple-400">
            <Sliders className="w-4 h-4" /> Live Score Simulator
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            评分算法仿真器
          </h1>
        </div>

        <button
          onClick={resetWeights}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 重置标准权重 (1/6)
        </button>
      </div>

      {/* Formula Explainer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold text-cyan-400 font-mono">1. Logit 准确率预处理</h3>
          <p className="text-xs text-slate-300 font-mono">
            y = ln( p / (1 - p) )
          </p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold text-indigo-400 font-mono">2. 基础分与可靠度收缩</h3>
          <p className="text-xs text-slate-300 font-mono">
            s_eff = 50 + &rho; &bull; (s_base - 50)
          </p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold text-emerald-400 font-mono">3. 饱效用速度成本调整</h3>
          <p className="text-xs text-slate-300 font-mono">
            u(r) = 1 - 1/r (r &ge; 1) | r - 1 (r &lt; 1)
          </p>
        </div>
      </div>

      {/* Live Computed Ranking Output */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200">
          当前已验证来源的运算结果
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Configuration</th>
                <th className="px-4 py-3">六领域能力分 A</th>
                <th className="px-4 py-3">&Delta;v 速度</th>
                <th className="px-4 py-3">&Delta;c 成本</th>
                <th className="px-4 py-3">Practical &Delta;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans text-slate-300">
              {computedScores.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={5}>
                    尚无可用于正式计算的已验证来源映射。
                  </td>
                </tr>
              )}
              {computedScores.map((s) => {
                const practicalAdjustment = getPracticalAdjustment(s.practicalBreakdown);
                return (
                  <tr key={s.config.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-white">
                      <div>{s.config.name}</div>
                      {!s.eligibleForGlobalLeaderboard && (
                        <div className="mt-0.5 text-[10px] font-normal text-amber-400">
                          数据不足：尚不能生成榜单名次
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatScore(s.rawCapabilityScore)} <span className="text-slate-500">({s.availableDomainCount}/6)</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-400">{formatScore(s.practicalBreakdown.speedDelta)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{formatScore(s.practicalBreakdown.costDelta)}</td>
                    <td className={`px-4 py-3 font-mono font-bold text-sm ${
                      practicalAdjustmentTextClass(practicalAdjustment, true)
                    }`}>
                      {formatPracticalAdjustment(practicalAdjustment)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
