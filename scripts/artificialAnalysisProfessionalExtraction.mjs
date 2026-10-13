/** Model profile pages publish the complete comparison table, beyond the
 * GDP.pdf evaluation page's initially selected 32-model chart subset. */
export function gdpPdfComparisonRecords(payload, modelBySlug) {
  const roots = [];
  try { roots.push(JSON.parse(payload)); } catch { /* Flight has framed JSON records. */ }
  for (const line of payload.split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 0 || !/^[0-9a-f]+$/iu.test(line.slice(0, separator))) continue;
    const value = line.slice(separator + 1);
    if (!['[', '{'].includes(value[0])) continue;
    try { roots.push(JSON.parse(value)); } catch { /* Non-JSON Flight transport records are not source data. */ }
  }
  const stack = [...roots];
  const candidates = [];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (typeof value.slug === 'string' && typeof value.gdpPdfAllPass === 'number') candidates.push(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push(child);
  }
  const byId = new Map();
  for (const row of candidates) {
    if (!Number.isFinite(row.gdpPdfAllPass) || row.gdpPdfAllPass < 0 || row.gdpPdfAllPass > 1) {
      throw new Error('Invalid published GDP.pdf comparison score.');
    }
    const model = modelBySlug.get(row.slug);
    if (!model) continue;
    if (row.releaseDate && model.releaseDate && row.releaseDate !== model.releaseDate) {
      throw new Error(`GDP.pdf comparison model release changed: ${row.slug}`);
    }
    const previous = byId.get(model.id);
    if (previous && previous.gdpPdfAllPass !== row.gdpPdfAllPass) {
      throw new Error(`Conflicting GDP.pdf comparison rows: ${row.slug}`);
    }
    if (!previous) byId.set(model.id, { ...model, gdpPdfAllPass: row.gdpPdfAllPass,
      sourceNativeId: row.id ?? null, sourceNativeModelName: row.name ?? null });
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id, 'en-US'));
}

export function mergePublishedGdpPdfRecords(primary, comparison) {
  const byId = new Map(primary.map(row => [row.id, row]));
  for (const row of comparison) {
    const existing = byId.get(row.id);
    if (existing && Math.abs((existing.gdpPdfAllPass ?? existing.gdpPdfBreakdown?.allPass) - row.gdpPdfAllPass) > 1e-12) {
      throw new Error(`Conflicting official GDP.pdf scores: ${row.slug}`);
    }
    if (!existing) byId.set(row.id, row);
  }
  return [...byId.values()];
}
