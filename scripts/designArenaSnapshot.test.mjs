import assert from 'node:assert/strict';
import {
  DESIGN_ARENA_FRONTEND_API_URL,
  validateDesignArenaFrontendPayload,
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

console.log('Design Arena official API snapshot validation: PASS');
