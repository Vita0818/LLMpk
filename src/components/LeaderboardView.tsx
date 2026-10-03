import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ChevronRight } from 'lucide-react';
import { ProcessedConfigurationScore, DomainId } from '../types/llm_pk';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

import { ConfigNameDisplay } from './ConfigNameDisplay';

interface LeaderboardViewProps {
  scoreItems: ProcessedConfigurationScore[];
  onSelectConfigForDetail: (scoreItem: ProcessedConfigurationScore) => void;
}

export type SortKey = 'rawCapabilityScore' | 'practicalScore' | DomainId;

interface LeaderboardRow {
  item: ProcessedConfigurationScore;
  /** Rank remains empty only when the minimum source-backed coverage is absent. */
  formalRank: number | null;
}

const formatScore = (score: number | null) => score === null ? '数据不足' : score.toFixed(1);
export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  scoreItems,
  onSelectConfigForDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('practicalScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorted items (ranked by final practical score from high to low by default)
  const processedItems = useMemo<LeaderboardRow[]>(() => {
    const sortedItems = scoreItems
      .filter((item) => {
        return (
          item.config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.config.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.config.execution.harness.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
      .sort((a, b) => {
        let valA: number | null;
        let valB: number | null;

        if (sortKey === 'rawCapabilityScore') {
          valA = a.rawCapabilityScore;
          valB = b.rawCapabilityScore;
        } else if (sortKey === 'practicalScore') {
          valA = a.practicalBreakdown.practicalScore;
          valB = b.practicalBreakdown.practicalScore;
        } else {
          valA = a.domainScores[sortKey].score;
          valB = b.domainScores[sortKey].score;
        }

        if (valA === null && valB === null) {
          return a.config.name.localeCompare(b.config.name);
        }
        if (valA === null) return 1;
        if (valB === null) return -1;

        const primaryDifference = sortOrder === 'desc'
          ? valB - valA
          : valA - valB;
        if (Math.abs(primaryDifference) > Number.EPSILON) {
          return primaryDifference;
        }

        const capabilityA = a.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;
        const capabilityB = b.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;
        return capabilityB - capabilityA
          || a.config.name.localeCompare(b.config.name);
      });

    let formalRank = 0;
    return sortedItems.map((item) => ({
      item,
      formalRank: item.eligibleForGlobalLeaderboard ? ++formalRank : null,
    }));
  }, [scoreItems, searchTerm, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-5 py-2">
      {/* Title & Search header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">能力榜单</h1>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索模型 / Provider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>

      {/* Frameless Leaderboard Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="text-slate-400 font-mono text-[11px] border-b-2 border-slate-200/80 tracking-wider">
              <th className="px-4 py-3.5 text-center w-16 font-semibold">排名</th>
              <th className="px-4 py-3.5 font-semibold">配置</th>

              {/* Primary available-domain mean capability score header */}
              <th 
                onClick={() => handleSort('rawCapabilityScore')}
                className="px-4 py-3.5 cursor-pointer text-blue-600 font-bold hover:text-blue-700 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  能力分
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('practicalScore')}
                className="px-4 py-3.5 cursor-pointer text-slate-500 font-semibold hover:text-slate-900 transition-colors"
                title="能力分叠加速度与成本奖惩后的最终分数"
              >
                实用分
              </th>

                {/* 6 Domain Headers */}
                <th 
                  onClick={() => handleSort('chatting')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Chatting
                </th>
                <th 
                  onClick={() => handleSort('reasoning')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Reasoning
                </th>
                <th 
                  onClick={() => handleSort('coding')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Coding
                </th>
                <th 
                  onClick={() => handleSort('frontend')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Frontend
                </th>
                <th 
                  onClick={() => handleSort('agentic')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Agentic
                </th>
                <th 
                  onClick={() => handleSort('documents')}
                  className="px-4 py-3.5 cursor-pointer text-center font-semibold hover:text-slate-900 transition-colors"
                >
                  Documents
                </th>

                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-sans text-slate-800">
              {processedItems.map(({ item, formalRank }) => {
                const rank = formalRank;
                const practicalAdjustment = getPracticalAdjustment(item.practicalBreakdown);

                return (
                  <tr 
                    key={item.config.id}
                    onClick={() => onSelectConfigForDetail(item)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500">
                      {rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shadow-xs">1</span>
                      ) : rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold shadow-xs">2</span>
                      ) : rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 text-xs font-bold shadow-xs">3</span>
                      ) : rank !== null ? (
                        rank
                      ) : (
                        <span
                          className="text-[10px] font-medium text-slate-400"
                          title="数据不足，暂不生成名次"
                        >
                          数据不足
                        </span>
                      )}
                    </td>

                    {/* Configuration Info */}
                    <td className="px-4 py-3.5 group-hover:text-blue-600 transition-colors text-xs sm:text-sm">
                      <ConfigNameDisplay name={item.config.name} />
                    </td>

                    {/* Six-domain mean capability score (primary highlight) */}
                    <td className="px-4 py-3.5 bg-blue-50/25 font-mono">
                      <span className="text-sm font-extrabold text-blue-700">
                        {formatScore(item.rawCapabilityScore)}
                      </span>
                    </td>

                    {/* Final practical score with its net adjustment */}
                    <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap">
                      <span className="text-slate-900">
                        {formatScore(item.practicalBreakdown.practicalScore)}
                      </span>
                      <span className={`ml-1.5 ${
                        practicalAdjustmentTextClass(practicalAdjustment)
                      }`}>
                        ({formatPracticalAdjustment(practicalAdjustment)})
                      </span>
                    </td>

                    {/* 6 Domains Score Columns */}
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.chatting.score)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.reasoning.score)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.coding.score)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.frontend.score)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.agentic.score)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                      {formatScore(item.domainScores.documents.score)}
                    </td>

                    {/* Detail Arrow */}
                    <td className="px-5 py-3.5 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </div>
  );
};
