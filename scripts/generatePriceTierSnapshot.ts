import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_COHORT_SNAPSHOT } from '../src/data/cohortMetadata';
import { buildPriceTierDataset } from '../src/data/priceTierDataset';
import type { PublicLeaderboardSnapshot } from '../src/types/publicLeaderboard';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Usage: npm run generate:price-tiers -- [--check]');
const checkOnly = args.includes('--check');
const leaderboardPath = 'src/data/publicLeaderboardSnapshot.json';
const subscriptionEvidencePath = 'src/data/subscriptionPricing.ts';
const outputPath = resolve('src/data/priceTierSnapshot.json');
const leaderboardText = readFileSync(resolve(leaderboardPath), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const dataset = buildPriceTierDataset(JSON.parse(leaderboardText) as PublicLeaderboardSnapshot, {
  leaderboard: { path: leaderboardPath, sha256: sha256(leaderboardText) },
  subscriptionEvidence: {
    path: subscriptionEvidencePath,
    sha256: sha256(readFileSync(resolve(subscriptionEvidencePath), 'utf8')),
  },
  cohort: { id: CURRENT_COHORT_SNAPSHOT.id, snapshotDate: CURRENT_COHORT_SNAPSHOT.snapshotDate },
});
const serialized = `${JSON.stringify(dataset, null, 2)}\n`;
if (checkOnly) {
  if (readFileSync(outputPath, 'utf8') !== serialized) {
    throw new Error('Price tier snapshot is stale. Run npm run generate:price-tiers.');
  }
} else {
  writeFileSync(`${outputPath}.tmp`, serialized, 'utf8');
  renameSync(`${outputPath}.tmp`, outputPath);
}
console.log(`${checkOnly ? 'Checked' : 'Generated'} ${dataset.summary.configurationCount} configurations: ${dataset.summary.classifiedConfigurationCount} classified, ${dataset.summary.unknownConfigurationCount} unknown.`);
console.log(JSON.stringify(dataset.groups.map(group => ({
  tier: group.tierId ?? 'unknown', configurations: group.configurationCount,
  api: group.apiConfigurationCount, subscriptions: group.subscriptionConfigurationCount,
  reader: group.readerConfigurationCount,
}))));
