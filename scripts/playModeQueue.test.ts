import publicLeaderboardSnapshot from '../src/data/publicLeaderboardSnapshot.json';
import { CURRENT_COHORT_SNAPSHOT } from '../src/data/cohortMetadata';
import type {
  PublicLeaderboardScore,
  PublicLeaderboardSnapshot,
} from '../src/types/publicLeaderboard';
import {
  buildPlayModeQueue,
  getPlayModeRouteGroupKey,
  sortRadarOverviewScores,
} from '../src/utils/playModeQueue';
import {
  getPlayModeRadarOverviewDurationMs,
  getPlayModeRadarOverviewScrollTop,
  PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS,
  PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS,
  PLAY_MODE_RADAR_OVERVIEW_SCROLL_PX_PER_SECOND,
  PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS,
} from '../src/utils/playModeRadarOverview';

const snapshot = publicLeaderboardSnapshot as unknown as PublicLeaderboardSnapshot;
const queue = buildPlayModeQueue(snapshot.scores);
const radarOverviewScores = sortRadarOverviewScores(queue);

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(snapshot.scores.length === CURRENT_COHORT_SNAPSHOT.totalConfigs, 'Public snapshot must match the current cohort inventory.');
assert(queue.length > 5, `Expected multiple covered playback items, received ${queue.length}.`);
assert(queue.every(s=>s.eligibleForGlobalLeaderboard),
  "Playback must not give ordinal ranks to data-insufficient configurations.");
assert(
  new Set(queue.map(getPlayModeRouteGroupKey)).size === queue.length,
  'Playback queue must contain one representative per identical radar route group.',
);
assert(
  snapshot.scores.filter(s=>s.eligibleForGlobalLeaderboard).length - queue.length === 4,
  'Covered playback should collapse four equivalent Google subscription routes.',
);
assert(
  radarOverviewScores.length === queue.length,
  'Radar overview must contain every playback representative exactly once.',
);
assert(
  new Set(radarOverviewScores.map((item) => item.config.id)).size === queue.length,
  'Radar overview must not duplicate playback representatives.',
);
assert(
  radarOverviewScores.every((item) => queue.includes(item)),
  'Radar overview must not introduce configurations omitted by playback.',
);

snapshot.scores.filter(s=>s.eligibleForGlobalLeaderboard).forEach((candidate) => {
  const representative = queue.find(
    (item) => getPlayModeRouteGroupKey(item) === getPlayModeRouteGroupKey(candidate),
  );
  const candidateScore = candidate.practicalBreakdown.practicalScore
    ?? Number.NEGATIVE_INFINITY;
  const representativeScore = representative?.practicalBreakdown.practicalScore
    ?? Number.NEGATIVE_INFINITY;

  assert(
    representativeScore >= candidateScore,
    `Route group did not retain its highest practical score: ${candidate.config.name}`,
  );
});

const expectedRepresentatives = [
  "Kimi K3 Max | Kimi Code CLI | Moonshot AI API",
  "Claude Fable 5.1 Max | Claude Code | Anthropic API",
  "Claude Opus 5.5 Max | Claude Code | Anthropic API",
  "Claude Fable 5.1 Max | --- | Claude Max 20×",
  "GPT-6 Astra Max | Codex CLI | OpenAI API",
  "GPT-6 Luna Max | Codex CLI | OpenAI API",
  "MiMo-V2.6-Pro Default | --- | Xiaomi API",
  "GLM-5.3 Max | --- | Z.ai API",
  "MiniMax M3 Max | AA Agent Harness | MiniMax API",
  "Gemini 3.8 Flash High | AA Agent Harness | Google API"
];

const queueNames = new Set(queue.map((item) => item.config.name));
expectedRepresentatives.forEach((name) => {
  assert(queueNames.has(name), `Missing expected representative route: ${name}`);
});

for (let index = 1; index < queue.length; index += 1) {
  const previous = queue[index - 1] as PublicLeaderboardScore;
  const current = queue[index] as PublicLeaderboardScore;
  const previousScore = previous.practicalBreakdown.practicalScore
    ?? Number.NEGATIVE_INFINITY;
  const currentScore = current.practicalBreakdown.practicalScore
    ?? Number.NEGATIVE_INFINITY;

  assert(
    previousScore >= currentScore,
    `Playback queue is not sorted by practical score at index ${index}.`,
  );
}

for (let index = 1; index < radarOverviewScores.length; index += 1) {
  const previous = radarOverviewScores[index - 1] as PublicLeaderboardScore;
  const current = radarOverviewScores[index] as PublicLeaderboardScore;
  const previousScore = previous.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;
  const currentScore = current.rawCapabilityScore ?? Number.NEGATIVE_INFINITY;

  assert(
    previousScore >= currentScore,
    `Radar overview is not sorted by raw capability score at index ${index}.`,
  );
}

const testScrollDistance = PLAY_MODE_RADAR_OVERVIEW_SCROLL_PX_PER_SECOND * 10;
const testScrollDuration = getPlayModeRadarOverviewDurationMs(testScrollDistance);
const expectedScrollDuration = PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS
  + 10_000
  + PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS;
assert(
  testScrollDuration === expectedScrollDuration,
  'Radar overview duration must preserve the configured pixels-per-second speed.',
);
assert(
  getPlayModeRadarOverviewDurationMs(0) === PLAY_MODE_RADAR_OVERVIEW_MIN_DURATION_MS,
  'A short overview must still remain visible for the minimum duration.',
);
assert(
  getPlayModeRadarOverviewScrollTop(
    PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS - 1,
    testScrollDistance,
  ) === 0,
  'Radar overview must remain at the top during its opening hold.',
);
assert(
  Math.abs(
    getPlayModeRadarOverviewScrollTop(
      PLAY_MODE_RADAR_OVERVIEW_TOP_HOLD_MS + 5000,
      testScrollDistance,
    ) - testScrollDistance / 2,
  ) < Number.EPSILON,
  'Radar overview must scroll linearly through the gallery.',
);
assert(
  getPlayModeRadarOverviewScrollTop(
    testScrollDuration - PLAY_MODE_RADAR_OVERVIEW_BOTTOM_HOLD_MS,
    testScrollDistance,
  ) === testScrollDistance,
  'Radar overview must reach the bottom before its closing hold.',
);
assert(
  getPlayModeRadarOverviewScrollTop(testScrollDuration, testScrollDistance)
    === testScrollDistance,
  'Radar overview must remain at the bottom until the phase ends.',
);

console.log('Playback queue, radar overview ordering, and auto-scroll timing: PASS');
