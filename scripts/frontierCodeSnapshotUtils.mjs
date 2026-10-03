export const FRONTIER_CODE_API_URL = 'https://cognition.com/data/frontiercode-leaderboard/data.json';
export function validateFrontierCodePayload(payload) {
  const revision = payload?.v1_1;
  if (!revision || revision.subsets?.main !== 100 || !Array.isArray(revision.models)
    || typeof revision.harness !== 'object' || typeof revision.data !== 'object') {
    throw new Error('FrontierCode 1.1 Main source structure changed.');
  }
  const rows = [];
  for (const name of revision.models) {
    const harness = revision.harness[name];
    const efforts = revision.efforts?.[name];
    if (typeof harness !== 'string' || !Array.isArray(efforts)) throw new Error('Missing FrontierCode execution identity.');
    for (const effort of efforts) {
      const record = revision.data[name]?.[effort]?.main;
      if (!record) continue;
      if (![record.correct, record.new_score, record.flagged_rate].every(v=>Number.isFinite(v) && v>=0 && v<=1)) {
        throw new Error('Malformed FrontierCode Main result.');
      }
      rows.push({ name, harness, effort, passRate: record.correct, mergeabilityScore: record.new_score, flaggedRate: record.flagged_rate });
    }
  }
  if (rows.length < 30) throw new Error('Incomplete FrontierCode snapshot.');
  return rows;
}
