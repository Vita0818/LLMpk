export const DESIGN_ARENA_FRONTEND_API_URL =
  'https://www.designarena.ai/api/v1/leaderboard/models/codecategories';
export const DESIGN_ARENA_FRONTEND_PAGE_URL =
  'https://www.designarena.ai/leaderboard/code';

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function validateDesignArenaFrontendPayload(payload, {
  minimumRows = 10,
  now = new Date(),
} = {}) {
  if (payload?.success !== true || !Array.isArray(payload.data)) {
    throw new Error('Design Arena did not return a successful leaderboard array.');
  }
  const arena = String(payload.meta?.arena || '').toLocaleLowerCase('en-US');
  const category = String(payload.meta?.category || '').toLocaleLowerCase('en-US');
  if (arena !== 'models' && arena !== 'models arena') {
    throw new Error('Design Arena response is not from Models Arena.');
  }
  if (category !== 'codecategories' && category !== 'code categories') {
    throw new Error('Design Arena response is not the Overall Frontend category.');
  }
  if (!validTimestamp(payload.meta?.lastUpdated)) {
    throw new Error('Design Arena response has no valid leaderboard update time.');
  }
  const updatedAt = Date.parse(payload.meta.lastUpdated);
  const nowTime = new Date(now).getTime();
  if (
    !Number.isFinite(nowTime)
    || updatedAt > nowTime + 5 * 60_000
    || nowTime - updatedAt > 14 * 24 * 60 * 60_000
  ) {
    throw new Error('Design Arena leaderboard update time is outside the accepted window.');
  }
  if (payload.data.length < minimumRows) {
    throw new Error('Design Arena returned too few Overall Frontend model rows.');
  }

  const seen = new Set();
  const seenOpenRouterIds = new Set();
  const rows = payload.data.map((entry) => {
    const displayName = String(entry?.displayName || '').trim();
    const provider = String(entry?.provider || '').trim();
    const openRouterId = entry?.openRouterId === null
      ? null
      : String(entry?.openRouterId || '').trim();
    if (
      !displayName
      || !provider
      || (openRouterId !== null && !openRouterId)
      || !Number.isInteger(entry?.elo)
      || entry.elo < 500
      || entry.elo > 2500
      || typeof entry?.winRate !== 'number'
      || !Number.isFinite(entry.winRate)
      || entry.winRate < 0
      || entry.winRate > 100
      || (entry.avgGenerationTimeMs !== null
        && (!Number.isFinite(entry.avgGenerationTimeMs)
          || entry.avgGenerationTimeMs < 0))
    ) {
      throw new Error('Design Arena returned a malformed model ranking row.');
    }
    const identity = [provider.toLocaleLowerCase('en-US'), displayName.toLocaleLowerCase('en-US'), openRouterId].join(':');
    if (seen.has(identity)) {
      throw new Error('Design Arena returned duplicate model ranking rows.');
    }
    seen.add(identity);
    if (openRouterId !== null) {
      if (seenOpenRouterIds.has(openRouterId)) {
        throw new Error('Design Arena returned duplicate OpenRouter model IDs.');
      }
      seenOpenRouterIds.add(openRouterId);
    }
    return {
      displayName,
      provider,
      openRouterId,
      elo: entry.elo,
      winRate: entry.winRate,
      avgGenerationTimeMs: entry.avgGenerationTimeMs,
    };
  });

  return {
    rows,
    lastUpdated: payload.meta.lastUpdated,
    responseTimestamp: validTimestamp(payload.timestamp) ? payload.timestamp : null,
  };
}
