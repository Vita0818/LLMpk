import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import {
  CAPABILITY_PREFERENCE_DIMENSIONS,
  DEFAULT_PREFERENCE_WEIGHTS,
  OVERALL_PREFERENCE_DIMENSIONS,
  rankTopScoresByPreferences,
  type PreferenceDimensionId,
  type PreferenceWeights,
} from '../utils/customRanking';
import { parseConfigurationName } from './ConfigurationDetailContent';
import { PreferenceRadar } from './PreferenceRadar';

interface CustomRankingViewProps {
  representativeScoreItems: readonly PublicLeaderboardScore[];
  onSelectConfigForDetail: (item: PublicLeaderboardScore) => void;
}

const formatScore = (score: number | null | undefined) => (
  score === null || score === undefined || !Number.isFinite(score)
    ? '--'
    : score.toFixed(1)
);

const formatPreferenceMultiplier = (value: number) => (
  `${Number((value / 50).toFixed(2))}×`
);

export const CustomRankingView: React.FC<CustomRankingViewProps> = ({
  representativeScoreItems,
  onSelectConfigForDetail,
}) => {
  const [weights, setWeights] = useState<PreferenceWeights>({
    ...DEFAULT_PREFERENCE_WEIGHTS,
  });
  const topRankedScores = useMemo(
    () => rankTopScoresByPreferences(representativeScoreItems, weights),
    [representativeScoreItems, weights],
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
      className="mx-auto w-full max-w-[1360px]"
      data-testid="custom-ranking-view"
    >
      <section
        className="w-full min-w-0 px-1 py-2"
        aria-labelledby="custom-ranking-results-heading"
      >
        <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-2.5">
          <h2
            id="custom-ranking-results-heading"
            className="text-base font-black tracking-tight text-neutral-950"
          >
            当前推荐
          </h2>
          <span className="flex items-center gap-2 font-brand-mono text-[10px] font-black text-neutral-400">
            <span className="tracking-widest">TOP 5</span>
            <span className="font-normal text-neutral-300" aria-hidden="true">|</span>
            <span>加权分</span>
          </span>
        </div>

        <ol
          className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2"
          data-testid="custom-ranking-top-five"
        >
          {topRankedScores.map((result, index) => {
            const rank = index + 1;
            const parsed = parseConfigurationName(result.item.config.name);
            const weightedScore = formatScore(result.personalizedScore);
            const isWinner = rank === 1;
            const placementClass = [
              'border-b border-neutral-100 md:col-start-1 md:row-span-2 md:row-start-1 md:border-b-0 md:border-r',
              'border-b border-neutral-100 md:col-start-2 md:row-start-1 md:border-r',
              'border-b border-neutral-100 md:col-start-2 md:row-start-2 md:border-b-0 md:border-r',
              'border-b border-neutral-100 md:col-start-3 md:row-start-1',
              'md:col-start-3 md:row-start-2',
            ][index];

            return (
              <li
                key={result.item.config.id}
                className={placementClass}
              >
                <button
                  type="button"
                  onClick={() => onSelectConfigForDetail(result.item)}
                  className={`group grid h-full w-full items-center text-left transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 ${
                    isWinner
                      ? 'min-h-[168px] grid-cols-[3rem_minmax(0,1fr)_5rem] gap-4 px-5 py-5'
                      : 'min-h-[84px] grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] gap-3 px-4 py-3'
                  }`}
                  data-testid={`custom-ranking-row-${result.item.config.id}`}
                  data-custom-rank={rank}
                  aria-label={`第 ${rank} 名，${result.item.config.name}，加权分 ${weightedScore}`}
                >
                  <span
                    className={`font-brand-mono font-black ${
                      isWinner
                        ? 'text-3xl text-purple-900'
                        : 'text-xl text-neutral-300'
                    }`}
                    aria-hidden="true"
                  >
                    {String(rank).padStart(2, '0')}
                  </span>

                  <span className="min-w-0 font-brand-mono">
                    <span className={`block truncate font-extrabold leading-tight text-neutral-950 transition-colors group-hover:text-purple-900 ${
                      isWinner ? 'text-lg' : 'text-sm'
                    }`}
                    >
                      {parsed.model}
                    </span>
                    <span className={`mt-1 flex items-center gap-1 truncate font-bold text-neutral-500 ${
                      isWinner ? 'text-xs' : 'text-[11px]'
                    }`}
                    >
                      <span className="truncate">{parsed.harness}</span>
                      <span className="shrink-0 font-normal text-neutral-300">|</span>
                      <span className="truncate">{parsed.provider}</span>
                    </span>
                  </span>

                  <span className="text-right font-brand-mono">
                    <span className={`block font-black leading-none text-neutral-950 ${
                      isWinner ? 'text-3xl' : 'text-xl'
                    }`}
                    >
                      {weightedScore}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="mt-10 min-w-0 px-1 py-2">
        <div className="mx-auto flex max-w-[1180px] items-center justify-start gap-4 px-1">
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

        <div className="mx-auto mt-6 grid max-w-[1180px] grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8">
          <section
            className="min-w-0"
            aria-labelledby="capability-preference-heading"
          >
            <h2
              id="capability-preference-heading"
              className="px-1 text-center text-xs font-black text-neutral-500"
            >
              理论能力
            </h2>
            <div className="mx-auto w-full max-w-[460px]">
              <PreferenceRadar
                dimensions={CAPABILITY_PREFERENCE_DIMENSIONS}
                weights={weights}
                onChange={handleWeightChange}
                ariaLabel="可拖动的六项理论能力权重六边形"
                testId="capability-preference-radar"
                size={460}
                radiusRatio={0.37}
                labelGapRatio={0.075}
              />
            </div>
          </section>

          <section
            className="min-w-0"
            aria-labelledby="overall-preference-heading"
          >
            <h2
              id="overall-preference-heading"
              className="px-1 text-center text-xs font-black text-neutral-500"
            >
              Intelligence · Cost · Speed
            </h2>
            <div className="mx-auto w-full max-w-[460px]">
              <PreferenceRadar
                dimensions={OVERALL_PREFERENCE_DIMENSIONS}
                weights={weights}
                onChange={handleWeightChange}
                ariaLabel="可拖动的 Intelligence、Cost 和 Speed 权重三角形"
                testId="overall-preference-radar"
                size={460}
                radiusRatio={0.39}
                labelGapRatio={0.07}
                valueFormatter={formatPreferenceMultiplier}
              />
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};
