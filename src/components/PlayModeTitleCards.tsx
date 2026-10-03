import React from 'react';
import { ALL_METRIC_DEFINITIONS, DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { DOMAIN_IDS } from '../engine/scoringConfig';

/**
 * Play Mode title cards. Everything uses the site brand font
 * (font-brand-mono); CJK falls back to the system sans, matching the rest
 * of the play mode UI.
 */

const line = (delayMs: number): React.CSSProperties => ({
  animationDelay: `${delayMs}ms`,
});

const splitDomainName = (name: string) => {
  const match = name.match(/^([^\u4e00-\u9fff]+?)\s+([\u4e00-\u9fff].*)$/);
  return match ? { en: match[1], cn: match[2] } : { en: name, cn: '' };
};

const formatWeight = (weight: number) => {
  const percent = Math.round(weight * 1000) / 10;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="play-mode-scene-enter flex min-h-[80vh] w-full select-none flex-col items-center justify-center py-10 text-center font-brand-mono">
    {children}
  </div>
);

const SourceLine: React.FC<{
  items: readonly string[];
  delayMs: number;
  sizeClass?: string;
}> = ({ items, delayMs, sizeClass = 'text-base' }) => (
  <div
    className={`title-card-line-enter flex items-center justify-center gap-5 font-bold text-neutral-900 ${sizeClass}`}
    style={line(delayMs)}
  >
    {items.map((item, index) => (
      <React.Fragment key={item}>
        {index > 0 && <span className="h-1 w-1 rounded-full bg-neutral-300" />}
        <span>{item}</span>
      </React.Fragment>
    ))}
  </div>
);

/* ------------------------------- Intro Card ------------------------------- */

export interface PlayModeIntroCardProps {
  /** Defaults to true (play mode intro). The video cover turns it off. */
  showSources?: boolean;
  /** Tailwind size classes for the date line. */
  dateSizeClass?: string;
}

export const PlayModeIntroCard: React.FC<PlayModeIntroCardProps> = ({
  showSources = true,
  dateSizeClass = 'text-xl sm:text-2xl',
}) => {
  const now = new Date();
  const dateLabel = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return (
    <CardShell>
      <h1
        className="title-card-line-enter text-7xl font-black tracking-tight text-neutral-950 sm:text-8xl"
        style={line(120)}
      >
        LLMpk
      </h1>

      <div
        className={`title-card-line-enter mt-14 font-bold tracking-widest text-neutral-700 ${dateSizeClass}`}
        style={line(340)}
      >
        {dateLabel}
      </div>

      {showSources && (
        <div className="mt-16">
          <SourceLine
            items={['Artificial Analysis', 'Arena.ai', 'FrontierCode', 'OpenRouter']}
            delayMs={560}
          />
        </div>
      )}
    </CardShell>
  );
};

/* ------------------------------- Weights Card ------------------------------ */

export const PlayModeWeightsCard: React.FC = () => {
  const domains = DOMAIN_IDS.map((id) => {
    const definition = DOMAIN_DEFINITIONS[id];
    const metrics = ALL_METRIC_DEFINITIONS
      .filter((metric) => metric.domain === id)
      .sort((a, b) => b.internalWeightInDomain - a.internalWeightInDomain);
    return { id, definition, metrics };
  });

  return (
    <CardShell>
      <h2
        className="title-card-line-enter text-6xl font-black tracking-tight text-neutral-950 sm:text-7xl"
        style={line(120)}
      >
        评分权重
      </h2>

      <div className="mt-16 grid w-full max-w-6xl grid-cols-1 gap-x-14 gap-y-10 text-left sm:grid-cols-2 lg:grid-cols-3">
        {domains.map(({ id, definition, metrics }, index) => {
          const { en, cn } = splitDomainName(definition.name);
          return (
            <div
              key={id}
              className="title-card-line-enter"
              style={line(340 + index * 90)}
            >
              <div
                className="flex items-baseline justify-between gap-3 border-b-2 pb-2.5"
                style={{ borderColor: definition.color }}
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-base font-black text-neutral-900">{en}</span>
                  <span className="truncate text-sm font-semibold text-neutral-500">{cn}</span>
                </div>
                <span
                  className="shrink-0 text-base font-black"
                  style={{ color: definition.color }}
                >
                  {formatWeight(definition.weight)}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {metrics.map((metric) => (
                  <li key={metric.id} className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-sm font-medium text-neutral-700">
                      {metric.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-neutral-500">
                      {formatWeight(metric.internalWeightInDomain)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
};

/* ------------------------------- Credits Card ------------------------------ */

export const PlayModeCreditsCard: React.FC = () => (
  <CardShell>
    <h2
      className="title-card-line-enter text-6xl font-black tracking-tight text-neutral-950 sm:text-7xl"
      style={line(120)}
    >
      Thanks for Watching
    </h2>

    <div
      className="title-card-line-enter mt-24 text-base font-bold tracking-[0.35em] text-neutral-400"
      style={line(400)}
    >
      数据源致谢
    </div>

    <div className="mt-8">
      <SourceLine
        items={['artificialanalysis.ai', 'arena.ai', 'openrouter.ai', 'scale.com', 'tbench.ai', 'swe-rebench.com', 'cognition.com']}
        delayMs={540}
        sizeClass="text-lg"
      />
    </div>
  </CardShell>
);
