import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Builds the versioned, lossless Arena extraction manifest used by the catalog
 * builder and the Arena self-audit.  The manifest deliberately retains source
 * duplicate rows; only the catalog builder may apply the documented dedupe
 * policy when creating production observations.
 *
 * Usage:
 *   ARENA_SNAPSHOT_DIR=/path/to/official-arena-html node scripts/build-arena-raw-extraction.mjs
 *
 * The input snapshots must be direct captures of the official Arena.ai
 * leaderboard pages listed below.  This script does not synthesize scores or
 * infer values from a model name.
 */

const repositoryRoot = resolve(new URL('..', import.meta.url).pathname);
const snapshotDirectory = process.env.ARENA_SNAPSHOT_DIR
  ? resolve(process.env.ARENA_SNAPSHOT_DIR)
  : resolve(repositoryRoot, 'scratch', 'arena');
const outputPath = resolve(
  process.env.ARENA_RAW_EXTRACTION_OUTPUT
    ?? resolve(repositoryRoot, 'src', 'data', 'arenaRawExtraction.json'),
);
const extractedAt = new Date().toISOString();
const snapshotDate = extractedAt.slice(0, 10);

const leaderboardDefinitions = [
  {
    metricId: 'arena_text_instruction',
    sourceLeaderboard: 'Arena Text — Instruction Following',
    sourceUrl: 'https://arena.ai/leaderboard/text/instruction-following',
    snapshotFile: 'arena_subpage_arena_text_instruction.html',
  },
  {
    metricId: 'arena_text_multiturn',
    sourceLeaderboard: 'Arena Text — Multi-Turn',
    sourceUrl: 'https://arena.ai/leaderboard/text/multi-turn',
    snapshotFile: 'arena_subpage_arena_text_multiturn.html',
  },
  {
    metricId: 'arena_text_creative',
    sourceLeaderboard: 'Arena Text — Creative Writing',
    sourceUrl: 'https://arena.ai/leaderboard/text/creative-writing',
    snapshotFile: 'arena_subpage_arena_text_creative.html',
  },
  {
    metricId: 'arena_text_hard',
    sourceLeaderboard: 'Arena Text — Hard Prompts',
    sourceUrl: 'https://arena.ai/leaderboard/text/hard-prompts',
    snapshotFile: 'arena_subpage_arena_text_hard.html',
  },
  {
    metricId: 'arena_text_math',
    sourceLeaderboard: 'Arena Text — Math',
    sourceUrl: 'https://arena.ai/leaderboard/text/math',
    snapshotFile: 'arena_subpage_arena_text_math.html',
  },
  {
    metricId: 'arena_text_coding',
    sourceLeaderboard: 'Arena Text — Coding',
    sourceUrl: 'https://arena.ai/leaderboard/text/coding',
    snapshotFile: 'arena_subpage_arena_text_coding.html',
  },
  {
    metricId: 'arena_code_webdev',
    sourceLeaderboard: 'Code Arena — WebDev Overall',
    sourceUrl: 'https://arena.ai/leaderboard/code/webdev',
    snapshotFile: 'arena_subpage_arena_code_webdev.html',
  },
  {
    metricId: 'arena_search',
    sourceLeaderboard: 'Arena Search — Overall',
    sourceUrl: 'https://arena.ai/leaderboard/search',
    snapshotFile: 'arena_subpage_arena_search.html',
  },
];

const agentDefinition = {
  sourceLeaderboard: 'Arena Agent',
  sourceUrl: 'https://arena.ai/leaderboard/agent',
  snapshotFile: 'arena_subpage_arena_agent.html',
  metrics: [
    {
      metricId: 'arena_agent_success',
      sourceSignal: 'task_outcome_explicit',
      sourceLeaderboard: 'Arena Agent — Confirmed Success',
    },
    {
      metricId: 'arena_agent_praise',
      sourceSignal: 'praise_complaint',
      sourceLeaderboard: 'Arena Agent — Praise vs Complaint',
    },
    {
      metricId: 'arena_agent_steerability',
      sourceSignal: 'steerability',
      sourceSignalAliases: ['steering_burden'],
      sourceLeaderboard: 'Arena Agent — Steerability',
    },
    {
      metricId: 'arena_agent_bash_recovery',
      sourceSignal: 'bash_recovery_steps',
      sourceLeaderboard: 'Arena Agent — Bash Recovery',
    },
    {
      metricId: 'arena_agent_tool_hallucination',
      sourceSignal: 'tool_hallucination',
      sourceLeaderboard: 'Arena Agent — Tool Hallucination',
    },
  ],
};

function fail(message) {
  throw new Error(message);
}

function decodeNextFlightPayload(html) {
  const chunks = [];
  const expression = /<script[^>]*>\s*self\.__next_f\.push\((.*?)\)\s*<\/script>/gsu;
  for (const match of html.matchAll(expression)) {
    let tuple;
    try {
      tuple = JSON.parse(match[1]);
    } catch (error) {
      fail(`Malformed Next.js Flight script: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (tuple?.[0] === 1 && typeof tuple?.[1] === 'string') {
      chunks.push(tuple[1]);
    }
  }

  if (chunks.length === 0) {
    fail('No Next.js Flight payload found in official source snapshot.');
  }

  return chunks.join('');
}

function extractJsonArrayAfter(payload, marker) {
  const markerIndex = payload.indexOf(marker);
  if (markerIndex === -1) {
    fail(`Could not find ${marker} in official source payload.`);
  }

  const openingIndex = payload.indexOf('[', markerIndex + marker.length);
  if (openingIndex === -1) {
    fail(`Could not find array after ${marker} in official source payload.`);
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = openingIndex; index < payload.length; index += 1) {
    const character = payload[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === '\\') {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(payload.slice(openingIndex, index + 1));
      }
    }
  }

  fail(`Unterminated JSON array after ${marker} in official source payload.`);
}

function canonicalModelName(name) {
  return name.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function buildDuplicateSummary(rows) {
  const groupedRows = new Map();
  rows.forEach((row, sourceOrder) => {
    const dedupeKey = canonicalModelName(row.exactSourceModelName);
    const group = groupedRows.get(dedupeKey) ?? [];
    group.push({ row, sourceOrder });
    groupedRows.set(dedupeKey, group);
  });

  const duplicateGroups = [];
  for (const [dedupeKey, group] of groupedRows.entries()) {
    if (group.length < 2) continue;

    const ordered = [...group].sort((left, right) => {
      const leftRank = Number.isFinite(left.row.sourceRecord?.rank) ? left.row.sourceRecord.rank : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(right.row.sourceRecord?.rank) ? right.row.sourceRecord.rank : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;

      const leftVotes = Number.isFinite(left.row.votes) ? left.row.votes : -1;
      const rightVotes = Number.isFinite(right.row.votes) ? right.row.votes : -1;
      if (leftVotes !== rightVotes) return rightVotes - leftVotes;

      return left.sourceOrder - right.sourceOrder;
    });

    duplicateGroups.push({
      dedupeKey,
      exactSourceModelName: ordered[0].row.exactSourceModelName,
      sourceRecordIds: ordered.map(({ row }) => row.sourceRecordId),
      selectedSourceRecordId: ordered[0].row.sourceRecordId,
      discardedSourceRecordIds: ordered.slice(1).map(({ row }) => row.sourceRecordId),
    });
  }

  return {
    dedupeKey: 'NFKC-trimmed, whitespace-collapsed, case-folded exactSourceModelName',
    selectionRule: 'Lowest official rank; then highest official vote count; then original source order.',
    duplicateRowCount: duplicateGroups.reduce((count, group) => count + group.discardedSourceRecordIds.length, 0),
    uniqueModelCount: groupedRows.size,
    duplicateGroups,
  };
}

function createRatingRow(entry, definition, sourceOrder) {
  // Search and Grounding are domain evaluations of the underlying model, not
  // separately selectable production harnesses in this leaderboard. Arena
  // inconsistently hides their suffix in modelDisplayName, so normalize both
  // forms to the base model identity while retaining modelKey in sourceRecord.
  const displayedModelName = entry.modelDisplayName ?? entry.modelKey;
  const exactSourceModelName = definition.metricId === 'arena_search'
    ? displayedModelName?.replace(/[-_\s]+(?:search|grounding)$/iu, '')
    : displayedModelName;
  if (typeof exactSourceModelName !== 'string' || !Number.isFinite(entry.rating)) {
    fail(`${definition.metricId} source row ${sourceOrder + 1} has no real model name or rating.`);
  }

  return {
    sourceRecordId: `${definition.metricId}:${entry.modelKey ?? exactSourceModelName}:${entry.rank ?? sourceOrder + 1}`,
    exactSourceModelName,
    rawValue: entry.rating,
    unit: 'Elo',
    confidenceLow: Number.isFinite(entry.ratingLower) ? entry.ratingLower : null,
    confidenceHigh: Number.isFinite(entry.ratingUpper) ? entry.ratingUpper : null,
    votes: Number.isFinite(entry.votes) ? entry.votes : null,
    snapshotDate,
    sourceUrl: definition.sourceUrl,
    sourceRecord: entry,
  };
}

function createAgentRow(entry, metric, sourceOrder) {
  const exactSourceModelName = entry.model ?? entry.contenderName;
  // The September 30 payload renamed the field while the official table
  // continues to display these values under Steerability.
  const sourceSignal = [metric.sourceSignal, ...(metric.sourceSignalAliases ?? [])]
    .find((signal) => Number.isFinite(entry.signalScores?.[signal]));
  const rawValue = entry.signalScores?.[sourceSignal];
  if (typeof exactSourceModelName !== 'string' || !Number.isFinite(rawValue)) {
    fail(`${metric.metricId} source row ${sourceOrder + 1} has no real model name or source signal.`);
  }

  return {
    sourceRecordId: `${metric.metricId}:${entry.contenderName ?? exactSourceModelName}:${entry.rank ?? sourceOrder + 1}`,
    exactSourceModelName,
    rawValue,
    unit: 'relative signal score',
    // Arena publishes a CI radius for the raw signal. Preserve it in sourceRecord
    // rather than manufacturing lower/upper values in the application dataset.
    confidenceLow: null,
    confidenceHigh: null,
    votes: Number.isFinite(entry.sessions) ? entry.sessions : null,
    snapshotDate,
    sourceUrl: agentDefinition.sourceUrl,
    sourceRecord: entry,
  };
}

function readOfficialSnapshot(filename) {
  const filepath = resolve(snapshotDirectory, filename);
  if (!existsSync(filepath)) {
    fail(`Missing official Arena source snapshot: ${filepath}. Set ARENA_SNAPSHOT_DIR to a directory containing the nine captured leaderboard pages.`);
  }
  return readFileSync(filepath, 'utf8');
}

function buildMetricFromLeaderboard(definition) {
  const payload = decodeNextFlightPayload(readOfficialSnapshot(definition.snapshotFile));
  const leaderboardIndex = payload.indexOf('"leaderboard":');
  if (leaderboardIndex === -1) {
    fail(`${definition.metricId} source snapshot does not contain a leaderboard object.`);
  }

  const entries = extractJsonArrayAfter(payload.slice(leaderboardIndex), '"entries":');
  const rows = entries.map((entry, sourceOrder) => createRatingRow(entry, definition, sourceOrder));

  return {
    sourceUrl: definition.sourceUrl,
    sourceLeaderboard: definition.sourceLeaderboard,
    sourceType: 'Arena.ai official leaderboard Next.js payload',
    sourceSnapshotFile: definition.snapshotFile,
    sourceSnapshotSha256: createHash('sha256').update(readOfficialSnapshot(definition.snapshotFile)).digest('hex'),
    snapshotDate,
    rows,
    deduplication: buildDuplicateSummary(rows),
  };
}

function buildAgentMetrics() {
  const html = readOfficialSnapshot(agentDefinition.snapshotFile);
  const payload = decodeNextFlightPayload(html);
  const snapshotIndex = payload.indexOf('"snapshot":');
  if (snapshotIndex === -1) {
    fail('Arena Agent source snapshot does not contain a snapshot object.');
  }

  const sourceRows = extractJsonArrayAfter(payload.slice(snapshotIndex), '"rows":');
  const sourceSnapshotSha256 = createHash('sha256').update(html).digest('hex');
  const metrics = {};

  for (const metric of agentDefinition.metrics) {
    const rows = sourceRows.map((entry, sourceOrder) => createAgentRow(entry, metric, sourceOrder));
    metrics[metric.metricId] = {
      sourceUrl: agentDefinition.sourceUrl,
      sourceLeaderboard: metric.sourceLeaderboard,
      sourceType: 'Arena.ai official leaderboard Next.js payload',
      sourceSnapshotFile: agentDefinition.snapshotFile,
      sourceSnapshotSha256,
      snapshotDate,
      rows,
      deduplication: buildDuplicateSummary(rows),
    };
  }

  return metrics;
}

const metrics = Object.fromEntries(
  leaderboardDefinitions.map((definition) => [definition.metricId, buildMetricFromLeaderboard(definition)]),
);
Object.assign(metrics, buildAgentMetrics());

const manifest = {
  schemaVersion: 'arena-raw-extraction/v1',
  extractedAt,
  source: {
    name: 'Arena.ai',
    collectionMethod: 'Official Arena.ai leaderboard Next.js payload captured from each canonical source URL.',
  },
  metrics,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Wrote ${outputPath}`);
for (const [metricId, metric] of Object.entries(metrics)) {
  console.log(`${metricId}: extracted=${metric.rows.length}, duplicates=${metric.deduplication.duplicateRowCount}, unique=${metric.deduplication.uniqueModelCount}`);
}
