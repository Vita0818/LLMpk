import assert from 'node:assert/strict';
import snapshot from '../src/data/publicLeaderboardSnapshot.json';
import frontierSnapshot from '../src/data/frontierCodeSourceSnapshot.json';
import designSnapshot from '../src/data/designArenaSourceSnapshot.json';
import { ALL_METRIC_DEFINITIONS } from '../src/engine/scoringEngine';
import { DOMAIN_IDS, SCORING_CONFIG } from '../src/engine/scoringConfig';
import { buildDesignArenaSourceCards, VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS } from '../src/data/designArenaSeedCards';
import { VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_MODEL_CARDS, VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS } from '../src/data/replacementBenchmarkSeedCards';
import { RETIRED_READER_MODEL_GROUP_KEYS, READER_CURRENT_MODEL_GROUP_KEYS } from '../src/data/readerModelRetirementPolicy';
import { BUILT_IN_CONFIGURATION_PRESETS } from '../src/data/builtInConfigurationPresets';
import { validateFrontierCodePayload } from './frontierCodeSnapshotUtils.mjs';
import type { SourceModelCard } from '../src/types/admin_mapping';

assert.equal(snapshot.schemaVersion, 2);
for (const preset of BUILT_IN_CONFIGURATION_PRESETS) {
  assert.equal(RETIRED_READER_MODEL_GROUP_KEYS.has(preset.productLineId), false);
}
assert.equal(READER_CURRENT_MODEL_GROUP_KEYS.size, 30);
let ranked = 0;
for (const score of snapshot.scores) {
  assert.deepEqual(Object.keys(score.domainScores), [...DOMAIN_IDS]);
  const coverage = DOMAIN_IDS.map(domain => {
    const metrics = ALL_METRIC_DEFINITIONS.filter(m => m.domain === domain);
    const observedWeight = metrics.reduce((sum,m) => {
      const observation = (score.config.observations as Record<string,{rawValue:number|null}>)[m.id];
      return sum + (observation?.rawValue !== null && Number.isFinite(observation?.rawValue) ? m.internalWeightInDomain : 0);
    }, 0);
    const stored = score.domainScores[domain];
    assert.ok(Math.abs(stored.coverage - observedWeight) < 1e-12, `${score.config.name}: ${domain} coverage`);
    if (observedWeight + Number.EPSILON < .6) assert.equal(stored.score,null);
    return observedWeight;
  });
  const meanCoverage = coverage.reduce((a,b)=>a+b,0)/6;
  assert.ok(Math.abs(meanCoverage - score.overallCoverage)<1e-12);
  const expectedEligible = coverage.every(v=>v+Number.EPSILON>=.6)
    && meanCoverage+Number.EPSILON>=SCORING_CONFIG.coverage.overallMinimum;
  assert.equal(score.eligibleForGlobalLeaderboard, expectedEligible);
  if (!expectedEligible) {
    assert.equal(score.rawCapabilityScore,null);
    assert.equal(score.practicalBreakdown.practicalScore,null);
  } else {
    ranked++;
    const values=DOMAIN_IDS.map(d=>score.domainScores[d].score!);
    const expected = values.some(v=>v===0) ? 0 : Math.exp(values.reduce((s,v)=>s+Math.log(v)/6,0));
    assert.ok(Math.abs(expected-score.rawCapabilityScore!)<1e-9);
  }
}
assert.ok(ranked>5 && ranked<snapshot.scores.length,'Covered and insufficient configurations must both remain visible.');

const freshCards=VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_MODEL_CARDS.filter(c=>c.id.startsWith('card-frontiercode-current-'));
assert.equal(freshCards.length,37);
for (const card of freshCards) {
  const name = card.exactSourceModelName.split(' (')[0];
  const effort = card.metadataJson?.execution?.effort;
  const row = frontierSnapshot.rows.find(r=>r.name===name && r.effort===effort);
  assert.ok(row,'Every current capability card must have an exact source effort row.');
  const observation=VERIFIED_REPLACEMENT_BENCHMARK_SOURCE_OBSERVATIONS.find(o=>o.sourceModelCardId===card.id);
  assert.equal(observation?.rawValue,row.passRate);
  assert.equal(observation?.metadataJson?.benchmarkVersion,'1.1-main');
  assert.equal(card.latestSnapshotDate,frontierSnapshot.fetchedAt.slice(0,10));
}
assert.throws(()=>validateFrontierCodePayload({v1_1:{subsets:{main:150},models:[]}}));
assert.throws(()=>validateFrontierCodePayload({v1_1:{subsets:{main:100},models:['Unscoped model'],harness:{},data:{}}}));

const base:SourceModelCard={id:'card-openrouter-test-model',source:'openrouter',exactSourceModelName:'test/model',latestSnapshotDate:'2026-10-02',
  metadataJson:{scope:{productLineId:'test_model'},sourceIdentity:{sourceRecordId:'test/model'}}};
const design = {fetchedAt:'2026-10-02T00:00:00Z',lastUpdated:'2026-10-02T00:00:00Z',
  source:{apiUrl:'https://www.designarena.ai/api/v1/leaderboard/models/codecategories',leaderboardUrl:'https://www.designarena.ai/leaderboard/code',sha256:'test'},
  rows:[{displayName:'Test Model',provider:'Test',openRouterId:'test/model',elo:1450}]};
assert.equal(buildDesignArenaSourceCards(design,[base]).observations[0].rawValue,1450);
assert.equal(buildDesignArenaSourceCards({...design,rows:[{...design.rows[0],openRouterId:null}]},[base]).cards.length,0);
assert.equal(buildDesignArenaSourceCards(design,[base,{...base,id:'ambiguous-copy'}]).cards.length,0);
assert.equal(buildDesignArenaSourceCards({rows:[]},[base]).cards.length,0);
if ('state' in designSnapshot && designSnapshot.state === 'awaiting-api-key') {
  assert.equal(VERIFIED_DESIGN_ARENA_SOURCE_MODEL_CARDS.length,0,'An outstanding API key must not create frontend results.');
}
console.log(`v3 source identity, successor policy and independent coverage checks: PASS (${snapshot.scores.length} configurations, ${ranked} eligible).`);
