import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standardEndpointExclusionReason } from './openRouterEndpointPolicy.mjs';

// The upstream response declares all these model variants "standard".
const ordinary = { variant: 'standard', provider_slug: 'google-vertex/global', derived_service_tier: null };
assert.equal(standardEndpointExclusionReason(ordinary), null);
assert.equal(standardEndpointExclusionReason({ ...ordinary, service_tier: 'flex' }), 'non-standard-service-tier');
assert.equal(standardEndpointExclusionReason({ ...ordinary, service_tier: 'priority' }), 'non-standard-service-tier');
assert.equal(standardEndpointExclusionReason({ ...ordinary, derived_service_tier: 'priority' }), 'non-standard-service-tier');
assert.equal(standardEndpointExclusionReason({ variant: 'standard', provider_slug: 'moonshotai/highspeed' }), 'specialized-provider-route');
assert.equal(standardEndpointExclusionReason({ variant: 'standard', providerSlug: 'google-ai-studio/flex' }), 'specialized-provider-route');
assert.equal(standardEndpointExclusionReason({ variant: 'standard', providerSlug: 'provider/fp4' }), null,
  'A serving quantization is not a Flex/Priority service tier.');
assert.equal(standardEndpointExclusionReason({ variant: 'standard', providerSlug: 'highspeed-ai' }), null,
  'A provider name must not be confused with a separately named service route.');
assert.equal(standardEndpointExclusionReason({ ...ordinary, is_byok_only: true }), 'unavailable-public-standard-endpoint');
assert.equal(standardEndpointExclusionReason({ ...ordinary, availabilityFlags: { disabled: true } }), 'unavailable-public-standard-endpoint');
assert.equal(standardEndpointExclusionReason({ ...ordinary, service_tier: 'unreviewed-tier' }), 'non-standard-service-tier');
assert.equal(standardEndpointExclusionReason({ ...ordinary, variant: 'priority' }), 'non-standard-model-variant');
const published = JSON.parse(readFileSync(new URL('../src/data/openRouterPerformanceSnapshot.json', import.meta.url), 'utf8'));
assert.ok(published.records.every(endpoint => standardEndpointExclusionReason(endpoint) === null),
  'The shipped endpoint sample must obey the same Standard serving policy as the fetcher.');
const kimi = published.modelAggregates.find(model => model.modelId === 'moonshotai/kimi-k3.1-pro');
assert.ok(kimi);
assert.ok(kimi.providerSlugs.every(slug => !slug.includes('/highspeed')));
assert.equal(kimi.measures.inputPricePerToken.arithmeticMean, 0.000002);
assert.equal(kimi.measures.outputPricePerToken.arithmeticMean, 0.00001);
console.log('OpenRouter model variants, service tiers and exact provider-route boundaries: PASS');
