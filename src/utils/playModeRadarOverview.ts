export const PLAY_MODE_RADAR_OVERVIEW_SCROLL_PX_PER_SECOND = 90;
export const PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS = 1500;
export const PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS = 1500;
export const PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS = 5000;

const clampNonNegative = (value: number) => (
  Number.isFinite(value) ? Math.max(0, value) : 0
);

/**
 * Makes the gallery phase scale with its rendered height. This keeps the
 * scrolling speed consistent when the number of cards or viewport size changes.
 */
export const getPlayModeRadarOverviewDurationMs = (
  scrollDistancePx: number,
) => {
  const distance = clampNonNegative(scrollDistancePx);
  const scrollingMs = (
    distance / PLAY_MODE_RADAR_OVERVIEW_SCROLL_PX_PER_SECOND
  ) * 1000;

  return Math.max(
    PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS,
    PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS
      + scrollingMs
      + PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS,
  );
};

/** Maps playback elapsed time to the page's vertical scroll position. */
export const getPlayModeRadarOverviewScrollTop = (
  elapsedMs: number,
  scrollDistancePx: number,
) => {
  const distance = clampNonNegative(scrollDistancePx);
  if (distance === 0) return 0;

  const durationMs = getPlayModeRadarOverviewDurationMs(distance);
  const scrollingDurationMs = Math.max(
    1,
    durationMs
      - PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS
      - PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS,
  );
  const scrollingElapsedMs = clampNonNegative(elapsedMs)
    - PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS;
  const progress = Math.min(
    1,
    Math.max(0, scrollingElapsedMs / scrollingDurationMs),
  );

  return distance * progress;
};
