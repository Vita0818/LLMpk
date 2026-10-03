import React, { useState, useMemo } from 'react';
import { Search, Filter, Layers, ChevronDown, ChevronUp, GripVertical, CheckCircle2 } from 'lucide-react';
import { SourceModelCard, SourceType } from '../types/admin_mapping';
import { adminMappingStore } from '../store/adminMappingStore';

interface SourceModelCardPoolProps {
  cards: SourceModelCard[];
}

export const SourceModelCardPool: React.FC<SourceModelCardPoolProps> = ({ cards }) => {
  const [activeSource, setActiveSource] = useState<SourceType>('artificial_analysis');
  const [searchTerm, setSearchTerm] = useState('');
  const [linkFilter, setLinkFilter] = useState<'all' | 'connected' | 'unconnected' | 'scorable' | 'no_data' | 'provider_endpoint' | 'pending_review'>('all');

  // Filter cards for the active source tab and sort alphabetically (A-Z) with useMemo
  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => c.source === activeSource)
      .filter((c) => c.exactSourceModelName.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((c) => {
        if (linkFilter === 'all') return true;
        const usage = adminMappingStore.getCardUsageCount(c.id);
        const obs = adminMappingStore.getCardObservations(c.id);
        const availableMetrics = obs.length;
        const isProviderEndpoint = c.exactSourceModelName.toLowerCase().includes(' via ') || c.exactSourceModelName.toLowerCase().includes(' (on ');

        if (linkFilter === 'connected') return usage > 0;
        if (linkFilter === 'unconnected') return usage === 0;
        if (linkFilter === 'scorable') return availableMetrics > 0;
        if (linkFilter === 'no_data') return availableMetrics === 0;
        if (linkFilter === 'provider_endpoint') return isProviderEndpoint;
        if (linkFilter === 'pending_review') return false;
        return true;
      })
      .sort((a, b) => a.exactSourceModelName.localeCompare(b.exactSourceModelName));
  }, [cards, activeSource, searchTerm, linkFilter]);

  const sourceTabs = useMemo(() => {
    const definitions: Array<{ id: SourceType; label: string }> = [
      { id: 'artificial_analysis', label: 'Artificial Analysis' },
      { id: 'arena', label: 'Arena.ai' },
      { id: 'openrouter', label: 'OpenRouter' },
      { id: 'scale_labs', label: 'Scale Labs' },
      { id: 'terminal_bench', label: 'Terminal-Bench' },
      { id: 'swe_rebench', label: 'SWE-rebench' },
      { id: 'frontier_code', label: 'FrontierCode' },
      { id: 'design_arena', label: 'DesignArena' },
    ];
    return definitions.map((definition) => ({
      ...definition,
      count: cards.filter((card) => card.source === definition.id).length,
    }));
  }, [cards]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-700" /> 平台模型卡片池
        </h3>
      </div>

      {/* Source Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80 text-xs">
        {sourceTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSource(tab.id)}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-center transition-all ${
              activeSource === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label.split(' ')[0]} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <select
          value={linkFilter}
          onChange={(e) => setLinkFilter(e.target.value as any)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
        >
          <option value="all">全量</option>
          <option value="connected">已连接</option>
          <option value="unconnected">未连接</option>
          <option value="scorable">可评分</option>
          <option value="no_data">无数据</option>
          <option value="provider_endpoint">Provider</option>
        </select>
      </div>

      {/* Cards List */}
      <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
        {filteredCards.length > 0 ? (
          filteredCards.map((card) => {
            const usageCount = adminMappingStore.getCardUsageCount(card.id);

            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      cardId: card.id,
                      source: card.source,
                      exactSourceModelName: card.exactSourceModelName,
                    })
                  );
                }}
                aria-label={`拖拽 ${card.exactSourceModelName} 到 Configuration 卡片堆叠`}
                className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl p-3 transition-all cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {card.exactSourceModelName}
                  </span>
                </div>

                {usageCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> 已连接 {usageCount}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            无匹配模型
          </div>
        )}
      </div>
    </div>
  );
};
