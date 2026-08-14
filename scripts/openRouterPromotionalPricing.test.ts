import assert from 'node:assert/strict';
import {
  getOpenRouterPromotionalPricing,
  OPENROUTER_PROMOTIONAL_PRICING,
} from '../src/data/openRouterPromotionalPricing';

assert.equal(OPENROUTER_PROMOTIONAL_PRICING.length, 2);

const terraPricing = getOpenRouterPromotionalPricing('gpt_56_terra');
assert.ok(terraPricing);
assert.equal(terraPricing.officialInputPricePerMToken, 2);
assert.equal(terraPricing.officialOutputPricePerMToken, 12);
assert.equal(terraPricing.openRouterDiscountMultiplier, 0.5);
assert.equal(terraPricing.effectiveInputPricePerMToken, 1);
assert.equal(terraPricing.effectiveOutputPricePerMToken, 6);

const lunaPricing = getOpenRouterPromotionalPricing('gpt_56_luna');
assert.ok(lunaPricing);
assert.equal(lunaPricing.officialInputPricePerMToken, 0.2);
assert.equal(lunaPricing.officialOutputPricePerMToken, 1.2);
assert.equal(lunaPricing.openRouterDiscountMultiplier, 0.5);
assert.equal(lunaPricing.effectiveInputPricePerMToken, 0.1);
assert.equal(lunaPricing.effectiveOutputPricePerMToken, 0.6);

assert.equal(
  getOpenRouterPromotionalPricing('gpt_56_sol'),
  undefined,
  'GPT-5.6 Sol must not receive the Terra/Luna promotion.',
);

Reflect.deleteProperty(globalThis, 'localStorage');
const { adminMappingStore } = await import('../src/store/adminMappingStore');

adminMappingStore.resetToLatestVerifiedCatalog();
adminMappingStore.synchronizeBuiltInConfigurationPresets(true);

const scoresByName = new Map(
  adminMappingStore.computeLeaderboardScores().map((score) => [
    score.config.name,
    score,
  ]),
);

const requireScore = (name: string) => {
  const score = scoresByName.get(name);
  assert.ok(score, `Missing configuration: ${name}`);
  return score;
};

const solPlusSubscription = requireScore(
  'GPT-5.6 Sol Max | Codex CLI | ChatGPT Plus',
);
const solProSubscription = requireScore(
  'GPT-5.6 Sol Max | Codex CLI | ChatGPT Pro 20×',
);
assert.equal(solPlusSubscription.config.subscriptionData?.apiEquivalentCostUSD, 100);
assert.equal(solProSubscription.config.subscriptionData?.apiEquivalentCostUSD, 2000);
assert.ok(
  Math.abs(
    solPlusSubscription.practicalBreakdown.effectiveScenarioCostUSD!
      - solProSubscription.practicalBreakdown.effectiveScenarioCostUSD! * 2,
  ) < 1e-12,
  'At the published monthly prices, Plus must have twice the effective scenario cost of Pro 20×.',
);

const terraApi = requireScore('GPT-5.6 Terra Max | Codex CLI | OpenAI API');
const terraSubscription = requireScore(
  'GPT-5.6 Terra Max | Codex CLI | ChatGPT Plus',
);
assert.equal(terraApi.config.openRouterData?.inputPricePerMToken, 1);
assert.equal(terraApi.config.openRouterData?.outputPricePerMToken, 6);
assert.equal(terraApi.practicalBreakdown.effectiveScenarioCostUSD, 2.5);
assert.equal(
  terraSubscription.config.subscriptionData?.apiEquivalentCostUSD,
  100,
);
assert.equal(terraSubscription.config.openRouterData?.inputPricePerMToken, 1);
assert.equal(terraSubscription.config.openRouterData?.outputPricePerMToken, 6);
assert.equal(
  terraSubscription.practicalBreakdown.effectiveScenarioCostUSD,
  1 / 2,
);

const lunaApi = requireScore('GPT-5.6 Luna Max | Codex CLI | OpenAI API');
const lunaSubscription = requireScore(
  'GPT-5.6 Luna Max | Codex CLI | ChatGPT Plus',
);
assert.equal(lunaApi.config.openRouterData?.inputPricePerMToken, 0.1);
assert.equal(lunaApi.config.openRouterData?.outputPricePerMToken, 0.6);
assert.equal(lunaApi.practicalBreakdown.effectiveScenarioCostUSD, 0.25);
assert.equal(
  lunaSubscription.config.subscriptionData?.apiEquivalentCostUSD,
  100,
);
assert.equal(lunaSubscription.config.openRouterData?.inputPricePerMToken, 0.1);
assert.equal(lunaSubscription.config.openRouterData?.outputPricePerMToken, 0.6);
assert.equal(
  lunaSubscription.practicalBreakdown.effectiveScenarioCostUSD,
  1 / 20,
);

console.log(
  'OpenRouter Terra/Luna promotional pricing and ChatGPT subscription value: PASS',
);
