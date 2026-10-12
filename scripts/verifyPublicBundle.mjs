import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const snapshotPath = fileURLToPath(
  new URL('../src/data/publicLeaderboardSnapshot.json', import.meta.url),
);
const forbiddenMarkers = [
  '后台配置',
  '后台数据映射',
  'AdminMappingView',
  'builtInPresetId',
  'sourceModelCardId',
  'llmpk_admin_mapping',
  'exportConfigurationBackup',
  'importConfigurationBackup',
  ...(process.env.VITE_ENABLE_PLAY_MODE === 'false'
    ? ['播放模式']
    : []),
];

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

const files = collectFiles(distDirectory);
const scriptFiles = files.filter((path) => path.endsWith('.js'));
const scriptBytes = scriptFiles.reduce((sum, path) => sum + statSync(path).size, 0);
const exposedMarkers = [];
const publicSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const allowedConfigurationKeys = new Set([
  'id',
  'name',
  'provider',
  'execution',
  'observations',
  'openRouterData',
  'subscriptionData',
  'valsData',
]);
const allowedSubscriptionKeys = new Set([
  'planName',
  'monthlyPriceUSD',
  'apiEquivalentCostUSD',
  'usableQuotaFraction',
  'pricingEvidenceId',
]);
const allowedValsKeys = new Set([
  'metricId', 'rawValue', 'standardError', 'benchmarkVersion', 'sourceUrl', 'sourceUpdated',
  'sourceProfile', 'sourceHarness', 'profileFallback', 'hasRefusalFallbackNotice',
  'publishedRawValue', 'scoreBasis', 'fallbackCount', 'refusalCount',
]);

if (
  publicSnapshot.schemaVersion !== 2
  || typeof publicSnapshot.scoringVersion !== 'string'
  || !/^\d+\.\d+$/u.test(publicSnapshot.scoringVersion)
  || !Array.isArray(publicSnapshot.scores)
  || publicSnapshot.scores.length === 0
) {
  throw new Error('Public leaderboard snapshot is empty or has an unsupported schema.');
}

for (const score of publicSnapshot.scores) {
  const unexpectedKeys = Object.keys(score.config ?? {})
    .filter((key) => !allowedConfigurationKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(
      `Public configuration ${score.config?.id ?? 'unknown'} exposes: ${unexpectedKeys.join(', ')}`,
    );
  }

  if (score.config?.subscriptionData) {
    const subscriptionData = score.config.subscriptionData;
    const unexpectedSubscriptionKeys = Object.keys(subscriptionData)
      .filter((key) => !allowedSubscriptionKeys.has(key));
    if (
      unexpectedSubscriptionKeys.length > 0
      || typeof subscriptionData.planName !== 'string'
      || !Number.isFinite(subscriptionData.monthlyPriceUSD)
      || !Number.isFinite(subscriptionData.apiEquivalentCostUSD)
      || !Number.isFinite(subscriptionData.usableQuotaFraction)
      || (subscriptionData.pricingEvidenceId !== undefined
        && typeof subscriptionData.pricingEvidenceId !== 'string')
    ) {
      throw new Error(
        `Public subscription ${score.config?.id ?? 'unknown'} has invalid display data.`,
      );
    }
  }

  for (const observation of Object.values(score.config?.observations ?? {})) {
    const observationKeys = Object.keys(observation);
    if (
      observationKeys.length !== 2
      || !observationKeys.includes('metricId')
      || !observationKeys.includes('rawValue')
    ) {
      throw new Error('Public metric observation contains non-display metadata.');
    }
  }

  if (score.config?.valsData !== undefined) {
    const evidence = score.config.valsData;
    if (!Array.isArray(evidence) || evidence.length > 9
      || new Set(evidence.map(item => item.metricId)).size !== evidence.length) {
      throw new Error('Public Vals evidence must contain unique registered results.');
    }
    for (const row of evidence) {
      const source = new URL(row.sourceUrl);
      if (Object.keys(row).length !== allowedValsKeys.size
        || Object.keys(row).some(key => !allowedValsKeys.has(key))
        || typeof row.metricId !== 'string' || !/^vals_[a-z0-9_]+$/u.test(row.metricId)
        || (row.rawValue !== null && (!Number.isFinite(row.rawValue) || row.rawValue < 0 || row.rawValue > 1))
        || (row.publishedRawValue !== null && (!Number.isFinite(row.publishedRawValue) || row.publishedRawValue < 0 || row.publishedRawValue > 1))
        || !['published', 'no-fallback'].includes(row.scoreBasis)
        || [row.fallbackCount, row.refusalCount].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))
        || (row.standardError !== null && (!Number.isFinite(row.standardError) || row.standardError < 0 || row.standardError > 1))
        || source.origin !== 'https://www.vals.ai' || !/^\/benchmarks\/[\w-]+$/u.test(source.pathname)
        || !/^\d{4}-\d{2}-\d{2}$/u.test(row.sourceUpdated)
        || typeof row.sourceProfile !== 'string'
        || (row.sourceHarness !== null && typeof row.sourceHarness !== 'string')
        || (row.benchmarkVersion !== null && typeof row.benchmarkVersion !== 'string')
        || typeof row.profileFallback !== 'boolean' || typeof row.hasRefusalFallbackNotice !== 'boolean') {
        throw new Error('Public Vals evidence exposes unsupported or invalid display data.');
      }
    }
  }
}

for (const path of files.filter((file) => /\.(?:html|js|css|json)$/u.test(file))) {
  const contents = readFileSync(path, 'utf8');
  for (const marker of forbiddenMarkers) {
    if (contents.includes(marker)) {
      exposedMarkers.push(`${marker} in ${path}`);
    }
  }
}

if (exposedMarkers.length > 0) {
  throw new Error(`Public bundle exposes private administration markers:\n${exposedMarkers.join('\n')}`);
}

if (scriptBytes > 5_000_000) {
  throw new Error(
    `Public JavaScript is ${scriptBytes} bytes; expected a sanitized bundle below 5 MB.`,
  );
}

console.log(
  `Public bundle exposure check passed `
  + `(${publicSnapshot.scores.length} configurations, ${scriptBytes} JavaScript bytes).`,
);
