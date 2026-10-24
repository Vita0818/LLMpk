/** `variant=standard` describes a model variant, not its serving tier.
 * OpenRouter still returns Flex/Priority and named Highspeed endpoints. */
export function standardEndpointExclusionReason(endpoint) {
  if (endpoint?.variant && endpoint.variant !== 'standard') return 'non-standard-model-variant';
  for (const tier of [endpoint?.service_tier ?? endpoint?.serviceTier,
    endpoint?.derived_service_tier ?? endpoint?.derivedServiceTier]) {
    if (tier !== undefined && tier !== null && !['standard', 'default'].includes(tier)) {
      return 'non-standard-service-tier';
    }
  }
  const providerSlug = endpoint?.provider_slug ?? endpoint?.providerSlug ?? endpoint?.provider_info?.slug ?? '';
  if (/(?:^|\/)(?:flex|priority|highspeed)(?:\/|$)/iu.test(providerSlug)) return 'specialized-provider-route';
  if ([endpoint?.is_private, endpoint?.is_hidden, endpoint?.is_disabled, endpoint?.is_byok_only,
    endpoint?.availabilityFlags?.private, endpoint?.availabilityFlags?.hidden,
    endpoint?.availabilityFlags?.disabled, endpoint?.availabilityFlags?.byokOnly].some(value => value === true)) {
    return 'unavailable-public-standard-endpoint';
  }
  return null;
}
