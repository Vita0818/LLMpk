import React, { forwardRef, memo } from 'react';
import type { PublicLeaderboardScore } from '../types/publicLeaderboard';
import { getProviderBrandTheme } from '../utils/providerColors';
import {
  formatPracticalAdjustment,
  getPracticalAdjustment,
  practicalAdjustmentTextClass,
} from '../utils/practicalAdjustment';
import { parseConfigurationName } from './ConfigurationDetailContent';
import { RadarChart } from './RadarChart';

interface RadarOverviewGalleryProps {
  scoreItems: readonly PublicLeaderboardScore[];
  onSelectConfigForDetail?: (item: PublicLeaderboardScore) => void;
  testId?: string;
}

const formatScore = (score: number | null) => (
  score === null ? '--' : score.toFixed(1)
);

/**
 * The shared radar-overview surface used by both the main tab and play mode.
 * Keeping one renderer ensures that the recorded overview remains identical to
 * the page users can open from the navigation bar.
 */
const RadarOverviewGalleryComponent = forwardRef<
  HTMLDivElement,
  RadarOverviewGalleryProps
>(({ scoreItems, onSelectConfigForDetail, testId }, ref) => (
  <div
    ref={ref}
    className="space-y-6 font-brand-mono"
    data-testid={testId}
  >
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {scoreItems.map((item, index) => {
        const rank = item.eligibleForGlobalLeaderboard
          ? scoreItems
              .slice(0, index + 1)
              .filter((score) => score.eligibleForGlobalLeaderboard).length
          : null;
        const parsed = parseConfigurationName(item.config.name);
        const capabilityScore = item.rawCapabilityScore;
        const practicalAdjustment = getPracticalAdjustment(item.practicalBreakdown);
        const brandTheme = getProviderBrandTheme(parsed.provider);

        return (
          <div
            key={item.config.id}
            onClick={onSelectConfigForDetail
              ? () => onSelectConfigForDetail(item)
              : undefined}
            className={`group relative flex flex-col justify-between py-2 transition-opacity duration-150 ${
              onSelectConfigForDetail ? 'cursor-pointer hover:opacity-85' : ''
            }`}
            data-radar-overview-rank={rank ?? undefined}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-neutral-400">
                  {rank !== null ? `#${rank}` : '—'}
                </span>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-sm font-black text-neutral-950">
                    {formatScore(capabilityScore)}
                  </span>
                  <span className="text-[10px] font-medium text-neutral-500">
                    (
                    <span className={practicalAdjustmentTextClass(practicalAdjustment)}>
                      {formatPracticalAdjustment(practicalAdjustment)}
                    </span>
                    )
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-neutral-950 transition-colors group-hover:text-purple-900">
                  {parsed.model}
                </div>
                <div className="flex items-center gap-1 truncate text-[11px] font-medium text-neutral-500">
                  <span className="truncate">{parsed.harness}</span>
                  <span className="shrink-0 font-normal text-neutral-300">|</span>
                  <span className="truncate">{parsed.provider}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center py-2">
              <RadarChart
                seriesList={[
                  {
                    id: item.config.id,
                    name: item.config.name,
                    color: brandTheme.color,
                    fillColor: brandTheme.fillColor,
                    scores: {
                      chatting: item.domainScores?.chatting?.score ?? null,
                      math_science: item.domainScores?.math_science?.score ?? null,
                      coding: item.domainScores?.coding?.score ?? null,
                      engineering: item.domainScores?.engineering?.score ?? null,
                      agentic_work: item.domainScores?.agentic_work?.score ?? null,
                      search_knowledge: item.domainScores?.search_knowledge?.score ?? null,
                    },
                  },
                ]}
                size={270}
                showLegend={false}
                showDomainNames={false}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
));

RadarOverviewGalleryComponent.displayName = 'RadarOverviewGallery';

/** Playback updates its clock while this gallery is visible. Keep the 43 SVG
 * charts mounted and untouched unless the actual gallery inputs change. */
export const RadarOverviewGallery = memo(RadarOverviewGalleryComponent);
