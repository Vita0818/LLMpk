import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomicWriteJson,
  fetchSource,
  sha256,
} from './sourceSnapshotUtils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = path.resolve(
  process.env.OPENROUTER_CATALOG_SNAPSHOT_OUTPUT
    ?? path.join(ROOT, 'src', 'data', 'openRouterCatalogSnapshot.json'),
);
const SOURCE_URL = 'https://openrouter.ai/api/v1/models';

function isCanonicalModelRecordId(value) {
  const id = String(value || '').trim().toLocaleLowerCase('en-US');
  return id.length > 0
    && !id.startsWith('~')
    && !/(?:^|[-/])latest$/u.test(id);
}

function isGeneralTextModel(model) {
  const inputModalities = model?.architecture?.input_modalities;
  const outputModalities = model?.architecture?.output_modalities;
  const identity = `${model?.id || ''}\n${model?.name || ''}`.toLocaleLowerCase('en-US');
  if (/\b(?:image|video|vision|speech|audio|tts|transcri(?:be|ption)|embedding|moderation|safeguard|guard|music|lyria|router)\b/iu.test(identity)) {
    return false;
  }
  if (!Array.isArray(inputModalities) || !Array.isArray(outputModalities)) return true;
  return inputModalities.includes('text')
    && outputModalities.length > 0
    && outputModalities.every((modality) => modality === 'text');
}

async function main() {
  const response = await fetchSource(SOURCE_URL, { accept: 'application/json' });
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch (error) {
    throw new Error(
      `OpenRouter catalog is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const records = Array.isArray(payload?.data) ? payload.data : [];
  if (records.length < 200) {
    throw new Error(`OpenRouter catalog returned only ${records.length} model records.`);
  }
  const ids = records.map((record) => record?.id).filter((id) => typeof id === 'string');
  if (new Set(ids).size !== ids.length) {
    throw new Error('OpenRouter catalog contains duplicate model IDs.');
  }
  const canonicalTextRecords = records.filter((record) => (
    isCanonicalModelRecordId(record?.id) && isGeneralTextModel(record)
  ));
  if (canonicalTextRecords.length < 150) {
    throw new Error(
      `OpenRouter catalog contains only ${canonicalTextRecords.length} canonical text models.`,
    );
  }

  const pricingFields = [...new Set(
    records.flatMap((record) => Object.keys(record?.pricing ?? {})),
  )].sort();
  const snapshot = {
    schemaVersion: 'openrouter-catalog-snapshot/v1',
    fetchedAt: new Date().toISOString(),
    source: {
      url: SOURCE_URL,
      finalUrl: response.finalUrl,
      sha256: sha256(response.body),
      bytes: Buffer.byteLength(response.body),
      contentType: response.contentType,
      etag: response.etag,
      lastModified: response.lastModified,
    },
    counts: {
      modelRecords: records.length,
      canonicalTextModelRecords: canonicalTextRecords.length,
      recordsWithPromptPrice: records.filter((record) => record?.pricing?.prompt != null).length,
      recordsWithCompletionPrice: records.filter((record) => record?.pricing?.completion != null).length,
      recordsWithCacheReadPrice: records.filter((record) => record?.pricing?.input_cache_read != null).length,
      recordsWithCacheWritePrice: records.filter((record) => record?.pricing?.input_cache_write != null).length,
      recordsWithReasoningPrice: records.filter((record) => record?.pricing?.internal_reasoning != null).length,
      recordsWithRequestPrice: records.filter((record) => record?.pricing?.request != null).length,
    },
    pricingFields,
    data: records,
  };
  atomicWriteJson(OUTPUT_PATH, snapshot);
  console.log(JSON.stringify({
    status: 'VALIDATED_OPENROUTER_CATALOG_SNAPSHOT',
    output: path.relative(ROOT, OUTPUT_PATH),
    ...snapshot.counts,
    pricingFields,
  }, null, 2));
}

await main();
