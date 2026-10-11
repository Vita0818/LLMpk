import assert from 'node:assert/strict';
import {
  DESIGN_ARENA_FRONTEND_API_URL,
  DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL,
  validateDesignArenaFrontendPayload,
  validateOpenRouterDesignArenaPayload,
  validateReviewedDesignArenaSourceRows,
} from './designArenaSnapshotUtils.mjs';

const payload = {
  success: true,
  data: [
    {
      displayName: 'Claude Opus 4.6',
      provider: 'anthropic',
      openRouterId: 'anthropic/claude-opus-4.6',
      elo: 1390,
      winRate: 63,
      avgGenerationTimeMs: 122828,
    },
    {
      displayName: 'v0-1.5-lg',
      provider: 'vercel',
      openRouterId: null,
      elo: 1280,
      winRate: 60,
      avgGenerationTimeMs: null,
    },
  ],
  meta: {
    arena: 'models',
    category: 'codecategories',
    lastUpdated: '2026-09-25T00:00:00Z',
  },
  timestamp: '2026-09-25T00:01:00Z',
};
const options = { minimumRows: 2, now: '2026-09-25T02:00:00Z' };
const normalized = validateDesignArenaFrontendPayload(payload, options);
assert.equal(DESIGN_ARENA_FRONTEND_API_URL.endsWith('/models/codecategories'), true);
assert.equal(normalized.rows.length, 2);
assert.equal(normalized.rows[0].openRouterId, 'anthropic/claude-opus-4.6');
assert.equal(normalized.rows[1].openRouterId, null);
assert.equal(normalized.lastUpdated, payload.meta.lastUpdated);

assert.throws(
  () => validateDesignArenaFrontendPayload({
    ...payload,
    meta: { ...payload.meta, arena: 'builders' },
  }, options),
  /Models Arena/u,
);
assert.throws(
  () => validateDesignArenaFrontendPayload({
    ...payload,
    data: [payload.data[0], payload.data[0]],
  }, options),
  /duplicate/u,
);
assert.throws(
  () => validateDesignArenaFrontendPayload({
    ...payload,
    data: [
      payload.data[0],
      { ...payload.data[1], openRouterId: payload.data[0].openRouterId },
    ],
  }, options),
  /duplicate OpenRouter model IDs/u,
);
assert.throws(
  () => validateDesignArenaFrontendPayload({
    ...payload,
    meta: { ...payload.meta, lastUpdated: '2026-08-01T00:00:00Z' },
  }, options),
  /outside the accepted window/u,
);

const version = 'meta/muse-spark-1.3-20260902';
const openRouterPayload = {
  data: ['Muse Spark 1.3 (xhigh)', 'Muse Spark 1.3 Max'].map((display_name, index) => ({
    source: 'design-arena', model_permaslug: version, display_name,
    arena: 'models', category: 'codecategories', elo: 1358 - index,
    win_rate: 57.3, avg_generation_time_ms: null,
  })),
  meta: { source: 'design-arena', version: 'v1', as_of: '2026-10-08T00:01:00Z',
    citation: 'Source: Design Arena via OpenRouter.', model_count: 1 },
};
const openRouterOptions = { minimumRows: 2, now: '2026-10-08T03:00:00Z' };
assert.equal(DESIGN_ARENA_OPENROUTER_FRONTEND_API_URL.startsWith('https://openrouter.ai/'), true);
const parsed = validateOpenRouterDesignArenaPayload(openRouterPayload, openRouterOptions);
assert.equal(parsed.rows.length, 2, 'Same model ID with published different efforts is not a duplicate source row.');
assert.equal(parsed.sourceAsOf, openRouterPayload.meta.as_of);
assert.equal('lastUpdated' in parsed, false, 'API as-of must not become a fabricated leaderboard update time.');
assert.throws(() => validateOpenRouterDesignArenaPayload({ ...openRouterPayload,
  data: [openRouterPayload.data[0], openRouterPayload.data[0]],
}, openRouterOptions), /duplicate complete source identity/u);
assert.throws(() => validateOpenRouterDesignArenaPayload({ ...openRouterPayload,
  data: openRouterPayload.data.map(row => ({ ...row, arena: 'builders' })),
}, openRouterOptions), /Models Arena/u);
assert.throws(() => validateOpenRouterDesignArenaPayload({ ...openRouterPayload,
  meta: { ...openRouterPayload.meta, as_of: '2026-09-01T00:00:00Z' },
}, openRouterOptions), /accepted window/u);

const reviews = { schemaVersion: 'design-arena-reviewed-mappings/v1', entries: [
  { cardId: 'muse-xhigh', canonicalModelVersion: version,
    source: { arena: 'models', category: 'codecategories', modelPermaslug: version, displayName: 'Muse Spark 1.3 (xhigh)' },
    sourceProfile: { label: 'XHigh', level: 5, disclosed: true },
    targets: [{ presetId: 'muse-xhigh-preset', profile: 'XHigh', provenance: { kind: 'exact' } }] },
  { cardId: 'muse-max', canonicalModelVersion: version,
    source: { arena: 'models', category: 'codecategories', modelPermaslug: version, displayName: 'Muse Spark 1.3 Max' },
    sourceProfile: { label: 'Max', level: 6, disclosed: true }, targets: [] },
] };
assert.deepEqual(validateReviewedDesignArenaSourceRows(parsed.rows, reviews), {
  reviewedSourceRows: 2, reviewedTargetPresets: 1,
});
assert.throws(() => validateReviewedDesignArenaSourceRows(parsed.rows.slice(1), reviews), /needs review/u);
assert.throws(() => validateReviewedDesignArenaSourceRows(parsed.rows, { ...reviews,
  entries: [{ ...reviews.entries[1], targets: [{ presetId: 'muse-xhigh-preset', profile: 'XHigh',
    provenance: { kind: 'lower_profile_fallback', sourceLevel: 6, targetLevel: 5, targetProfile: 'XHigh' } }] }],
}), /downward reviewed target/u);

console.log('Design Arena direct/mirrored API, full configuration identities, timestamp provenance and reviewed refresh validation: PASS');
