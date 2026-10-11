export const DESIGN_ARENA_FRONTEND_API_URL =
  'https://www.designarena.ai/api/v1/leaderboard/models/codecategories';
export const DESIGN_ARENA_FRONTEND_PAGE_URL =
  'https://www.designarena.ai/leaderboard/code';
export const DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL =
  'https://openrouter.ai/api/v1/benchmarks?source=design-arena&arena=models&category=codecategories';

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

export function designArenaSourceRecordKey(row) {
  return JSON.stringify([row?.arena, row?.category, row?.model_permaslug, row?.display_name]);
}

/** A model permaslug may have multiple efforts. Only the complete source identity is unique. */
export function validateOpenRouterDesignArenaPayload(payload, {
  minimumRows = 10,
  now = new Date(),
} = {}) {
  if (!Array.isArray(payload?.data) || payload.data.length < minimumRows
    || payload.meta?.source !== 'design-arena' || payload.meta.version !== 'v1'
    || !validTimestamp(payload.meta.as_of)
    || typeof payload.meta.citation !== 'string' || !payload.meta.citation.trim()) {
    throw new Error('OpenRouter did not return a source-backed Design Arena leaderboard.');
  }
  const age = new Date(now).getTime() - Date.parse(payload.meta.as_of);
  if (!Number.isFinite(age) || age < -5 * 60_000 || age > 14 * 24 * 60 * 60_000) {
    throw new Error('Design Arena source as-of time is outside the accepted window.');
  }
  const seen = new Set();
  for (const row of payload.data) {
    if (row?.source !== 'design-arena' || row.arena !== 'models' || row.category !== 'codecategories') {
      throw new Error('OpenRouter Design Arena response is not Models Arena / Overall Frontend.');
    }
    if (typeof row.model_permaslug !== 'string' || !row.model_permaslug.includes('/')
      || typeof row.display_name !== 'string' || !row.display_name.trim()
      || !Number.isInteger(row.elo) || row.elo < 500 || row.elo > 2500
      || typeof row.win_rate !== 'number' || !Number.isFinite(row.win_rate)
      || row.win_rate < 0 || row.win_rate > 100
      || (row.avg_generation_time_ms !== null
        && (typeof row.avg_generation_time_ms !== 'number'
          || !Number.isFinite(row.avg_generation_time_ms) || row.avg_generation_time_ms < 0))) {
      throw new Error('OpenRouter Design Arena returned a malformed frontend row.');
    }
    const key = designArenaSourceRecordKey(row);
    if (seen.has(key)) throw new Error('Design Arena returned a duplicate complete source identity.');
    seen.add(key);
  }
  if (payload.meta.model_count !== new Set(payload.data.map(row => row.model_permaslug)).size) {
    throw new Error('Design Arena model count does not match its source records.');
  }
  return { rows: payload.data, sourceAsOf: payload.meta.as_of, responseMeta: payload.meta };
}

/** Refuse refreshes which invalidate an authored mapping; do not replace it with a guessed row. */
export function validateReviewedDesignArenaSourceRows(rows, manifest) {
  if (manifest?.schemaVersion !== 'design-arena-reviewed-mappings/v1' || !Array.isArray(manifest.entries)) {
    throw new Error('Design Arena has no valid reviewed mapping manifest.');
  }
  const cards = new Set();
  const targets = new Set();
  for (const entry of manifest.entries) {
    const selector = { arena: entry.source?.arena, category: entry.source?.category,
      model_permaslug: entry.source?.modelPermaslug, display_name: entry.source?.displayName };
    const matches = rows.filter(row => designArenaSourceRecordKey(row) === designArenaSourceRecordKey(selector));
    if (matches.length !== 1 || entry.canonicalModelVersion !== entry.source?.modelPermaslug
      || cards.has(entry.cardId)) {
      throw new Error(`Design Arena reviewed source identity needs review: ${entry.cardId}.`);
    }
    cards.add(entry.cardId);
    for (const target of entry.targets) {
      const provenance = target.provenance;
      const exact = provenance?.kind === 'exact' && target.profile === entry.sourceProfile.label;
      const upward = provenance?.kind === 'lower_profile_fallback'
        && provenance.sourceLevel === entry.sourceProfile.level
        && provenance.sourceLevel < provenance.targetLevel
        && provenance.targetProfile === target.profile;
      if ((!exact && !upward) || targets.has(target.presetId)) {
        throw new Error(`Design Arena has an ambiguous or downward reviewed target: ${target.presetId}.`);
      }
      targets.add(target.presetId);
    }
  }
  return { reviewedSourceRows: cards.size, reviewedTargetPresets: targets.size };
}
