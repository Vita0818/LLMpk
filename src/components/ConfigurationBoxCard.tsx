import React, { useState } from 'react';
import {
  Box,
  Trash2,
  Edit3,
  RefreshCw,
  Unlink,
  Copy,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import {
  ConfigurationBox,
  ConfigurationSourceLink,
  SourceModelCard,
  SourceType,
} from '../types/admin_mapping';
import { adminMappingStore } from '../store/adminMappingStore';
import { ALL_METRIC_DEFINITIONS } from '../engine/scoringEngine';
import { ConfigNameDisplay } from './ConfigNameDisplay';

interface ConfigurationBoxCardProps {
  box: ConfigurationBox;
  onEdit: (box: ConfigurationBox) => void;
  onDelete: (id: string) => void;
  onDuplicate: (box: ConfigurationBox) => void;
  onRecalculate: (box: ConfigurationBox) => void;
}

const sourceLabels: Record<SourceType, string> = {
  artificial_analysis: 'Artificial Analysis',
  arena: 'Arena.ai',
  openrouter: 'OpenRouter',
  scale_labs: 'Scale Labs',
  terminal_bench: 'Terminal-Bench',
  swe_rebench: 'SWE-rebench',
  frontier_code: 'FrontierCode',
};

export const ConfigurationBoxCard: React.FC<ConfigurationBoxCardProps> = React.memo(({
  box,
  onEdit,
  onDelete,
  onDuplicate,
  onRecalculate,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const linkedStack = adminMappingStore.getLinkedCardStack(box.id);

  const llmConfig = adminMappingStore.buildLLMConfiguration(box);
  const metricCount = ALL_METRIC_DEFINITIONS.length;
  const scoringObservationCount = ALL_METRIC_DEFINITIONS.filter(
    (definition) => llmConfig.observations[definition.id],
  ).length;
  const coveragePercent = Math.min(
    100,
    Math.round((scoringObservationCount / metricCount) * 100),
  );

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const rawData = event.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const payload = JSON.parse(rawData) as { cardId?: string };
      if (!payload.cardId) return;

      // The store inserts at priority 0, i.e. above all existing cards.
      // Re-dropping an existing card simply brings it to the top; incompatible
      // model scopes are the only reason a drop is rejected.
      const link = adminMappingStore.linkCardToBox(box.id, payload.cardId);
      if (!link) {
        window.alert('无法加入此 Configuration：卡片不属于同一模型产品线。');
        return;
      }
      onRecalculate(box);
    } catch (error) {
      console.error('Drop handling error:', error);
    }
  };

  const handleMove = (linkId: string, targetPriority: number) => {
    if (adminMappingStore.moveLink(linkId, targetPriority)) {
      onRecalculate(box);
    }
  };

  const handleUnlink = (linkId: string) => {
    if (adminMappingStore.unlinkLink(linkId)) {
      onRecalculate(box);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3">
      {/* Line 1: Internal Identifier & Action Buttons */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold font-mono text-slate-900 tracking-tight truncate">
          {box.internalName}
        </h3>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDuplicate(box)}
            aria-label={`复制 ${box.displayName}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition-colors"
            title="复制"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRecalculate(box)}
            aria-label={`重新计算 ${box.displayName}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="重新计算"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(box)}
            aria-label={`编辑 ${box.displayName}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="编辑"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(box.id)}
            aria-label={`删除 ${box.displayName}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Line 2: Three Core Configuration Elements */}
      <div className="text-xs border-b border-slate-100 pb-3">
        <ConfigNameDisplay name={box.displayName} />
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border transition-all p-2.5 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/80 shadow-xs'
            : linkedStack.length > 0
              ? 'border-slate-200 bg-slate-50/60'
              : 'border-dashed border-slate-300 bg-white'
        }`}
      >

        {linkedStack.length > 0 ? (
          <ol className="space-y-2" aria-label={`${box.displayName} 的数据卡片优先级`}>
            {linkedStack.map(({ link, card }, index) => (
              <StackedSourceCard
                key={link.id}
                link={link}
                card={card}
                index={index}
                total={linkedStack.length}
                onMoveUp={() => handleMove(link.id, index - 1)}
                onMoveDown={() => handleMove(link.id, index + 1)}
                onUnlink={() => handleUnlink(link.id)}
              />
            ))}
          </ol>
        ) : (
          <div className="py-6 px-4 text-center text-xs text-slate-400">
            {isDragOver ? (
              <span className="font-semibold text-blue-600">松开放置</span>
            ) : (
              '拖入模型卡片'
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
        <div>
          覆盖率 <span className="font-semibold text-slate-700">{coveragePercent}%</span> ({scoringObservationCount}/{metricCount})
        </div>
        <div>{box.lastCalculatedAt ? `更新于 ${box.lastCalculatedAt}` : ''}</div>
      </div>
    </div>
  );
});

interface StackedSourceCardProps {
  link: ConfigurationSourceLink;
  card: SourceModelCard;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUnlink: () => void;
}

const StackedSourceCard: React.FC<StackedSourceCardProps> = ({
  link,
  card,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onUnlink,
}) => {
  const obsCount = adminMappingStore.getCardObservations(card.id).length;
  const isTop = index === 0;
  const fallbackLabel = (() => {
    const provenance = link.provenance;
    if (!provenance || provenance.kind === 'exact') return null;
    if (provenance.kind === 'lower_profile_fallback') {
      return `兜底 · ${provenance.sourceProfile} → ${provenance.targetProfile}`;
    }
    if (provenance.kind === 'lower_harness_fallback') {
      return `兜底 · ${provenance.sourceHarness} → ${provenance.targetHarness}`;
    }
    return `兜底 · ${provenance.sourceProfile} ${provenance.sourceHarness} → ${provenance.targetProfile} ${provenance.targetHarness}`;
  })();

  return (
    <li className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
      isTop ? 'border-violet-200 bg-violet-50/60' : 'border-slate-200 bg-white'
    }`}>
      <GripVertical className="w-3.5 h-3.5 flex-none text-slate-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
            isTop ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {isTop ? '#1 优先' : `#${index + 1}`}
          </span>
          <span className="truncate text-xs font-semibold text-slate-900" title={card.exactSourceModelName}>
            {card.exactSourceModelName}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span>{sourceLabels[card.source]}</span>
          <span aria-hidden="true">·</span>
          <span>{obsCount} 项</span>
          <span
            className={`rounded px-1 py-px font-semibold ${
              fallbackLabel
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {fallbackLabel || '精确'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isTop}
          aria-label={`将 ${card.exactSourceModelName} 上移一层`}
          title="上移一层（提高优先级）"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`将 ${card.exactSourceModelName} 下移一层`}
          title="下移一层（降低优先级）"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onUnlink}
          aria-label={`从 Configuration 中移除 ${card.exactSourceModelName}`}
          title="从此 Configuration 移除"
          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Unlink className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};
