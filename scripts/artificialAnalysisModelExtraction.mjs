import { extractJsonArraysAfterMarker, uniqueBy } from './sourceSnapshotUtils.mjs';

/** Join only publisher-provided model/release identities; never infer dates. */
export function detailedModelRecords(payload) {
  const arrays = extractJsonArraysAfterMarker(payload, '"models":');
  const candidates = arrays
    .map((records) => records.filter((record) => (
      record
      && typeof record === 'object'
      && !Array.isArray(record)
      && typeof record.slug === 'string'
      && typeof record.name === 'string'
      && Object.hasOwn(record, 'intelligenceIndex')
    )))
    .sort((left, right) => right.length - left.length);
  if ((candidates[0]?.length ?? 0) < 100) {
    throw new Error('AA model leaderboard did not expose a complete detailed model array.');
  }
  const identities = arrays.find((records) => (
    records.length >= candidates[0].length
    && records.every((record) => (
      typeof record?.slug === 'string'
      && typeof record?.name === 'string'
      && (typeof record?.creator?.name === 'string' || typeof record?.releaseSlug === 'string')
    ))
  )) || [];
  const identityBySlug = new Map(identities.map((record) => [record.slug, record]));
  // Since October 2026, model options carry releaseSlug and the separate
  // releases table owns releaseDate/creator. The relation is explicit even
  // when an effort-specific model slug differs from its release slug.
  const releases = extractJsonArraysAfterMarker(payload, '"releases":')
    .filter((records) => records.length > 0 && records.every((record) => (
      typeof record?.slug === 'string'
      && typeof record?.name === 'string'
      && typeof record?.creator?.name === 'string'
    )))
    .sort((left, right) => right.length - left.length)[0] || [];
  const releaseBySlug = new Map(
    uniqueBy(releases, (record) => record.slug, 'AA model releases')
      .map((record) => [record.slug, record]),
  );
  return uniqueBy(candidates[0].map((record) => {
    const identity = identityBySlug.get(record.slug);
    const releaseSlug = record.releaseSlug ?? identity?.releaseSlug;
    const release = releaseBySlug.get(releaseSlug);
    const creator = identity?.creator ?? release?.creator;
    const creatorName = record.modelCreatorName || creator?.name;
    if (!creatorName) throw new Error('AA model has no publisher identity.');
    return {
      ...record,
      id: record.slug,
      releaseDate: record.releaseDate ?? identity?.releaseDate ?? release?.releaseDate ?? null,
      ...(releaseSlug ? { releaseSlug } : {}),
      modelCreatorId: record.modelCreatorId ?? creator?.id ?? null,
      modelCreatorName: creatorName,
      modelCreatorSlug: record.modelCreatorSlug ?? creator?.slug
        ?? creatorName.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ''),
      terminalbenchV21: record.terminalbenchV21 ?? record.terminalBench21 ?? null,
    };
  }), (record) => record.id, 'AA model leaderboard');
}
