import React, { useMemo, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import {
  ConfigurationMetricList,
  ConfigurationRadar,
  formatConfigurationScore,
  parseConfigurationName,
} from './ConfigurationDetailContent';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';

interface SideBySideCompareViewProps<T extends PublicLeaderboardScore> {
  scoreItems: T[];
  initialSelectedIds?: string[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onSelectConfigForDetail?: (item: T) => void;
}

interface ComparisonColumnProps<T extends PublicLeaderboardScore> {
  item: T;
  scoreItems: T[];
  selectedIds: string[];
  canRemove: boolean;
  onReplace: (nextId: string) => void;
  onRemove: () => void;
  onSelectConfigForDetail?: (item: T) => void;
}

const MAX_COMPARE_COLUMNS = 4;

const ComparisonColumn = <T extends PublicLeaderboardScore,>({
  item,
  scoreItems,
  selectedIds,
  canRemove,
  onReplace,
  onRemove,
  onSelectConfigForDetail,
}: ComparisonColumnProps<T>) => {
  const [hoveredDomain, setHoveredDomain] = useState<DomainId | null>(null);
  const parsedName = parseConfigurationName(item.config.name);
  const practicalAdjustment = getPracticalAdjustment(item.practicalBreakdown);

  return (
    <section className="min-w-0 px-4 first:pl-0 last:pr-0">
      <div className="flex min-h-[204px] flex-col border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`compare-model-${item.config.id}`}>
            更换对比模型
          </label>
          <select
            id={`compare-model-${item.config.id}`}
            value={item.config.id}
            onChange={(event) => onReplace(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-[11px] font-medium text-neutral-400 outline-none transition-colors hover:text-neutral-700 focus:text-neutral-700"
          >
            {scoreItems.map((candidate) => (
              <option
                key={candidate.config.id}
                value={candidate.config.id}
                disabled={
                  candidate.config.id !== item.config.id &&
                  selectedIds.includes(candidate.config.id)
                }
              >
                {candidate.config.name}
              </option>
            ))}
          </select>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
              title="移除这一列"
              aria-label={`移除 ${item.config.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 flex-1">
          {onSelectConfigForDetail ? (
            <button
              type="button"
              onClick={() => onSelectConfigForDetail(item)}
              className="group text-left"
              title="打开配置详情"
            >
              <span className="text-lg font-black leading-tight tracking-tight text-neutral-950 transition-colors group-hover:text-purple-900">
                {parsedName.model}
              </span>
            </button>
          ) : (
            <h2 className="text-lg font-black leading-tight tracking-tight text-neutral-950">
              {parsedName.model}
            </h2>
          )}
          <div className="mt-1 text-xs font-bold leading-snug text-neutral-600">
            {parsedName.harness}
            <span className="mx-1.5 font-normal text-neutral-300">|</span>
            {parsedName.provider}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 font-brand-mono">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Intelligence Index
            </div>
            <div className="mt-1 text-2xl font-black text-neutral-950">
              {formatConfigurationScore(item.rawCapabilityScore)}
            </div>
          </div>
          <div className="border-l border-neutral-200 pl-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Practical Delta
            </div>
            <div
              className={`mt-1 text-2xl font-black ${practicalAdjustmentTextClass(
                practicalAdjustment
              )}`}
            >
              {formatPracticalAdjustment(practicalAdjustment)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[340px] items-center justify-center border-b border-neutral-200 py-4">
        <ConfigurationRadar
          scoreItem={item}
          size={320}
          hoveredDomain={hoveredDomain}
          onHoverDomain={setHoveredDomain}
          showDomainNames={false}
        />
      </div>

      <div className="pt-4">
        <ConfigurationMetricList
          scoreItem={item}
          columns={1}
          hoveredDomain={hoveredDomain}
          onHoverDomain={setHoveredDomain}
        />
      </div>
    </section>
  );
};

export const SideBySideCompareView = <T extends PublicLeaderboardScore,>({
  scoreItems,
  initialSelectedIds,
  selectedIds: controlledSelectedIds,
  onSelectedIdsChange,
  onSelectConfigForDetail,
}: SideBySideCompareViewProps<T>) => {
  const defaultSelectedIds = useMemo(() => {
    const requestedIds = (initialSelectedIds ?? []).filter((id) =>
      scoreItems.some((item) => item.config.id === id)
    );
    if (requestedIds.length > 0) {
      return requestedIds.slice(0, MAX_COMPARE_COLUMNS);
    }

    const rankedItems = scoreItems.filter(
      (item) => item.eligibleForGlobalLeaderboard !== false
    );
    return (rankedItems.length > 0 ? rankedItems : scoreItems)
      .slice(0, 3)
      .map((item) => item.config.id);
  }, [initialSelectedIds, scoreItems]);

  const [internalSelectedIds, setInternalSelectedIds] =
    useState<string[]>(defaultSelectedIds);
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;

  const updateSelectedIds = (nextIds: string[]) => {
    if (controlledSelectedIds === undefined) {
      setInternalSelectedIds(nextIds);
    }
    onSelectedIdsChange?.(nextIds);
  };

  const selectedModels = selectedIds
    .map((id) => scoreItems.find((item) => item.config.id === id))
    .filter((item): item is T => item !== undefined);

  const availableModels = scoreItems.filter(
    (item) => !selectedIds.includes(item.config.id)
  );

  const addCandidate = (candidateId: string) => {
    if (!candidateId || selectedIds.length >= MAX_COMPARE_COLUMNS) return;
    updateSelectedIds([...selectedIds, candidateId]);
  };

  const resetSelection = () => {
    updateSelectedIds(defaultSelectedIds);
  };

  return (
    <div className="w-full pb-12 font-brand-mono text-neutral-900 antialiased">
      <div className="mb-4 flex flex-col gap-3 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black tracking-tight text-neutral-950 sm:text-2xl">
          模型并排对比
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {selectedModels.length < MAX_COMPARE_COLUMNS && availableModels.length > 0 && (
            <>
              <label className="sr-only" htmlFor="compare-add-model">
                添加对比模型
              </label>
              <select
                id="compare-add-model"
                value=""
                onChange={(event) => addCandidate(event.target.value)}
                className="max-w-[260px] rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 outline-none transition-colors hover:border-neutral-300 focus:border-neutral-400"
              >
                <option value="">＋ 添加对比模型</option>
                {availableModels.map((item) => (
                  <option key={item.config.id} value={item.config.id}>
                    {item.config.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={resetSelection}
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
            title="恢复默认对比"
            aria-label="恢复默认对比"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedModels.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">
          没有可用于对比的模型。
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div
            className="grid divide-x divide-neutral-200"
            style={{
              gridTemplateColumns: `repeat(${selectedModels.length}, minmax(340px, 1fr))`,
              minWidth: `max(100%, ${selectedModels.length * 340}px)`,
            }}
          >
            {selectedModels.map((item, index) => (
              <ComparisonColumn
                key={item.config.id}
                item={item}
                scoreItems={scoreItems}
                selectedIds={selectedIds}
                canRemove={selectedModels.length > 1}
                onReplace={(nextId) => {
                  const nextIds = [...selectedIds];
                  nextIds[index] = nextId;
                  updateSelectedIds(nextIds);
                }}
                onRemove={() =>
                  updateSelectedIds(
                    selectedIds.filter((selectedId) => selectedId !== item.config.id)
                  )
                }
                onSelectConfigForDetail={onSelectConfigForDetail}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
