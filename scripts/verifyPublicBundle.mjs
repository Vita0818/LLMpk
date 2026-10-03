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
]);
const allowedSubscriptionKeys = new Set([
  'planName',
  'monthlyPriceUSD',
  'apiEquivalentCostUSD',
  'usableQuotaFraction',
]);

if (
  publicSnapshot.schemaVersion !== 2
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
