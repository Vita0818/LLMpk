import { VERIFIED_SOURCE_MODEL_CARDS } from '../src/data/seedCards';
import type { SourceModelCard, SourceType } from '../src/types/admin_mapping';

type MatchIdentity = {
  baseKey: string;
  effort: string;
  route: string;
  numericSignature: string;
};

const cards = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS) as SourceModelCard[];

function canonicalKey(card: SourceModelCard): string {
  const scopeKey = card.metadataJson?.scope?.canonicalProfileKey;
  return typeof scopeKey === 'string' && scopeKey.trim()
    ? scopeKey.trim().toLocaleLowerCase('en-US')
    : card.exactSourceModelName.toLocaleLowerCase('en-US');
}

function matchIdentity(card: SourceModelCard): MatchIdentity {
  let key = canonicalKey(card)
    .normalize('NFKC')
    .replace(/non[- ]?reasoning|no[- ]?thinking|non[- ]?thinking|thinking[- ]off/giu, ' none ')
    .replace(/x[- ]?high/giu, ' xhigh ')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '');

  let route = 'chat';
  if (/(?:^|-)(?:search|grounding|web-search)$/u.test(key)) route = 'search';
  if (/(?:^|-)codex(?:-harness)?$/u.test(key)) route = 'codex';
  if (/(?:^|-)fast$/u.test(key)) route = 'fast';
  if (/(?:^|-)custom-tools?$/u.test(key)) route = 'custom-tools';

  let effort = 'default';
  for (const candidate of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']) {
    if (new RegExp(`(?:^|-)${candidate}$`, 'u').test(key)) {
      effort = candidate;
      key = key.replace(new RegExp(`(?:^|-)${candidate}$`, 'u'), '');
      break;
    }
  }
  if (effort === 'default' && /(?:^|-)(?:reasoning|thinking)$/u.test(key)) {
    effort = 'reasoning';
    key = key.replace(/(?:^|-)(?:reasoning|thinking)$/u, '');
  }
  if (route !== 'chat') {
    key = key
      .replace(/(?:^|-)(?:search|grounding|web-search)$/u, '')
      .replace(/(?:^|-)codex(?:-harness)?$/u, '')
      .replace(/(?:^|-)fast$/u, '')
      .replace(/(?:^|-)custom-tools?$/u, '');
  }

  const tokens = key
    .split('-')
    .filter(Boolean)
    .filter((token) => !['instruct', 'chat', 'model'].includes(token))
    .sort((left, right) => left.localeCompare(right, 'en-US'));
  const numericSignature = tokens
    .filter((token) => /\d/u.test(token))
    .join('-');
  return {
    baseKey: tokens.join('-'),
    effort,
    route,
    numericSignature,
  };
}

const groups = new Map<string, SourceModelCard[]>();
cards.forEach((card) => {
  const identity = matchIdentity(card);
  if (!identity.baseKey || !identity.numericSignature) return;
  const matchKey = [
    identity.baseKey,
    identity.effort,
    identity.route,
    identity.numericSignature,
  ].join('\u0000');
  const group = groups.get(matchKey) || [];
  group.push(card);
  groups.set(matchKey, group);
});

const sourceOrder: Record<SourceType, number> = {
  artificial_analysis: 0,
  arena: 1,
  openrouter: 2,
  scale_labs: 3,
  terminal_bench: 4,
  swe_rebench: 5,
  frontier_code: 6,
};

const candidates = [...groups.entries()].flatMap(([matchKey, group]) => {
  const bySource = new Map<SourceType, SourceModelCard[]>();
  group.forEach((card) => {
    const sourceCards = bySource.get(card.source) || [];
    sourceCards.push(card);
    bySource.set(card.source, sourceCards);
  });
  if (bySource.size < 2 || [...bySource.values()].some((sourceCards) => sourceCards.length !== 1)) return [];
  const canonicalKeys = new Set(group.map(canonicalKey));
  if (canonicalKeys.size <= 1) return [];
  return [{
    matchKey,
    cards: [...group]
      .sort((left, right) => sourceOrder[left.source] - sourceOrder[right.source])
      .map((card) => ({
        id: card.id,
        source: card.source,
        name: card.exactSourceModelName,
        canonicalProfileKey: canonicalKey(card),
        productLineId: card.metadataJson?.scope?.productLineId,
      })),
  }];
});

console.log(JSON.stringify({
  candidateGroupCount: candidates.length,
  candidateCardCount: candidates.reduce((sum, candidate) => sum + candidate.cards.length, 0),
  candidates,
}, null, 2));
