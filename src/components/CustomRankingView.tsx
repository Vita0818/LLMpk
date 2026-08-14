import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import type { DomainId } from '../types/llm_pk';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import {
  CAPABILITY_PREFERENCE_DIMENSIONS,
  DEFAULT_PREFERENCE_WEIGHTS,
  OVERALL_PREFERENCE_DIMENSIONS,
  rankScoresByPreferences,
  type PreferenceDimensionId,
  type PreferenceWeights,
} from '../utils/customRanking';
import { parseConfigurationName } from './ConfigurationDetailContent';
import { PreferenceRadar } from './PreferenceRadar';

interface CustomRankingViewProps {
  scoreItems: PublicLeaderboardScore[];
  onSelectConfigForDetail: (item: PublicLeaderboardScore) => void;
}

const DOMAIN_ORDER: readonly DomainId[] = [
  'chatting',
  'math_science',
  'coding',
  'engineering',
  'agentic_work',
  'search_knowledge',
];

const DOMAIN_TABLE_LABELS: Record<DomainId, string> = {
  chatting: 'Chatting',
  math_science: 'Math & Sci',
  coding: 'Coding',
  engineering: 'Engineering',
  agentic_work: 'Agentic',
  search_knowledge: 'Search',
};

const formatScore = (score: number | null | undefined) => (
  score === null || score === undefined || !Number.isFinite(score)
    ? '--'
    : score.toFixed(1)
);

const formatPreferenceMultiplier = (value: number) => (
  `${Number((value / 50).toFixed(2))}×`
);

const getScoreDepthStyle = (score: number | null | undefined) => {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { opacity: 0.35, fontWeight: 500 };
  }
  const normalized = Math.max(0, Math.min(100, score));
  return {
    opacity: 0.45 + (normalized / 100) * 0.55,
    fontWeight: normalized >= 80 ? 900 : normalized >= 50 ? 800 : 700,
  };
};

export const CustomRankingView: React.FC<CustomRankingViewProps> = ({
  scoreItems,
  onSelectConfigForDetail,
}) => {
  const [weights, setWeights] = useState<PreferenceWeights>({
    ...DEFAULT_PREFERENCE_WEIGHTS,
  });
  const rankedScores = useMemo(
    () => rankScoresByPreferences(scoreItems, weights),
    [scoreItems, weights],
  );
  const totalOverallWeight = OVERALL_PREFERENCE_DIMENSIONS.reduce(
    (sum, dimension) => sum + weights[dimension.id],
    0,
  );

  const handleWeightChange = (
    dimensionId: PreferenceDimensionId,
    value: number,
  ) => {
    setWeights((current) => ({
      ...current,
      [dimensionId]: Math.max(0, Math.min(100, Math.round(value))),
    }));
  };

  return (
    <div
      className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[400px_minmax(0,1fr)]"
      data-testid="custom-ranking-view"
    >
      <aside className="px-1 py-2">
        <div className="flex items-center justify-between gap-4 px-1">
          <h1 className="text-lg font-black tracking-tight text-neutral-950">
            偏好权重
          </h1>
          <button
            type="button"
            onClick={() => setWeights({ ...DEFAULT_PREFERENCE_WEIGHTS })}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-neutral-400 transition-colors hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
            aria-label="恢复均衡偏好"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </button>
        </div>

        <div className="mt-7 flex flex-col gap-12">
          <section
            className="min-w-0"
            aria-labelledby="capability-preference-heading"
          >
            <h2
              id="capability-preference-heading"
              className="px-1 text-xs font-black text-neutral-500"
            >
              理论能力
            </h2>
            <div className="mx-auto max-w-[340px]">
              <PreferenceRadar
                dimensions={CAPABILITY_PREFERENCE_DIMENSIONS}
                weights={weights}
                onChange={handleWeightChange}
                ariaLabel="可拖动的六项理论能力权重六边形"
                testId="capability-preference-radar"
                size={360}
              />
            </div>
          </section>

          <section
            className="min-w-0"
            aria-labelledby="overall-preference-heading"
          >
            <h2
              id="overall-preference-heading"
              className="px-1 text-xs font-black text-neutral-500"
            >
              Intelligence · Cost · Speed
            </h2>
            <div className="mx-auto max-w-[300px]">
              <PreferenceRadar
                dimensions={OVERALL_PREFERENCE_DIMENSIONS}
                weights={weights}
                onChange={handleWeightChange}
                ariaLabel="可拖动的 Intelligence、Cost 和 Speed 权重三角形"
                testId="overall-preference-radar"
                size={320}
                valueFormatter={formatPreferenceMultiplier}
              />
            </div>
          </section>
        </div>
      </aside>

      <section className="min-w-0">
        <div className="w-full overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full table-fixed border-collapse text-left text-xs lg:table-auto">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70 font-brand-mono text-[10px] uppercase tracking-wider text-neutral-600 sm:text-[11px]">
                <th className="w-10 px-2 py-3 text-center font-bold sm:w-12 sm:px-4">#</th>
                <th className="px-2 py-3 text-left font-bold sm:px-5 lg:w-full">Model Configuration</th>
                <th className="w-20 shrink-0 whitespace-nowrap px-2 py-3 text-center font-bold text-black sm:w-28 sm:px-5">
                  偏好得分 ↓
                </th>
                {DOMAIN_ORDER.map((domainId, index) => (
                  <th
                    key={domainId}
                    className={`hidden px-2.5 py-3 text-center font-bold lg:table-cell ${
                      index === 0 ? 'border-l border-neutral-200' : ''
                    }`}
                    style={{ color: DOMAIN_DEFINITIONS[domainId].color }}
                  >
                    {DOMAIN_TABLE_LABELS[domainId]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-sans text-neutral-900">
              {rankedScores.map((result, index) => {
                const rank = result.personalizedScore !== null
                  && result.item.eligibleForGlobalLeaderboard
                  && totalOverallWeight > 0
                  ? rankedScores
                      .slice(0, index + 1)
                      .filter((entry) => (
                        entry.personalizedScore !== null
                        && entry.item.eligibleForGlobalLeaderboard
                      )).length
                  : null;
                const parsed = parseConfigurationName(result.item.config.name);

                return (
                  <tr
                    key={result.item.config.id}
                    onClick={() => onSelectConfigForDetail(result.item)}
                    className="group cursor-pointer transition-colors duration-100 hover:bg-neutral-50/90"
                    data-testid={`custom-ranking-row-${result.item.config.id}`}
                    data-custom-rank={rank ?? undefined}
                  >
                    <td className="shrink-0 px-2 py-3 text-center font-brand-mono font-bold text-neutral-500 sm:px-4 sm:py-3.5">
                      {rank === 1 ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-900 text-xs font-black text-white shadow-2xs">1</span>
                      ) : rank === 2 ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-900">2</span>
                      ) : rank === 3 ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-bold text-neutral-800">3</span>
                      ) : rank !== null ? rank : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>

                    <td className="min-w-0 px-2 py-3 text-left font-brand-mono sm:px-5 sm:py-3.5 lg:w-full">
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="text-sm font-extrabold leading-tight text-neutral-950 transition-colors group-hover:text-purple-900 sm:text-base">
                          {parsed.model}
                        </div>
                        <div className="flex items-center gap-1 truncate text-[13px] font-bold text-neutral-600 sm:text-[15px]">
                          <span className="truncate">{parsed.harness}</span>
                          <span className="shrink-0 font-normal text-neutral-300">|</span>
                          <span className="truncate">{parsed.provider}</span>
                        </div>
                      </div>
                    </td>

                    <td className="shrink-0 whitespace-nowrap px-2 py-3 text-center font-brand-mono sm:px-5 sm:py-3.5">
                      <div className="text-base font-black leading-none text-black sm:text-xl">
                        {formatScore(result.personalizedScore)}
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-neutral-400 sm:text-[11px]">
                        官方 {formatScore(result.item.practicalBreakdown.practicalScore)}
                      </div>
                    </td>

                    {DOMAIN_ORDER.map((domainId, domainIndex) => {
                      const score = result.item.domainScores[domainId].score;
                      const depthStyle = getScoreDepthStyle(score);
                      return (
                        <td
                          key={domainId}
                          className={`hidden px-2.5 py-4 text-center font-brand-mono text-sm lg:table-cell ${
                            domainIndex === 0 ? 'border-l border-neutral-100' : ''
                          }`}
                          style={{
                            color: DOMAIN_DEFINITIONS[domainId].color,
                            opacity: depthStyle.opacity,
                            fontWeight: depthStyle.fontWeight,
                          }}
                        >
                          {formatScore(score)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
