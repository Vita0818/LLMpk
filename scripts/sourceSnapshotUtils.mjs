import { createHash } from 'node:crypto';
import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export const SOURCE_USER_AGENT = 'LLMpk source-snapshot-pipeline/1.0';

export function asFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/u, 'Z');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchSource(
  url,
  {
    accept = 'text/html,application/xhtml+xml,application/json',
    maxAttempts = 4,
    timeoutMilliseconds = 45_000,
    headers = {},
  } = {},
) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: accept,
          'User-Agent': SOURCE_USER_AGENT,
          ...headers,
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} from ${url}`);
        error.status = response.status;
        error.retryAfter = response.headers.get('retry-after');
        throw error;
      }
      return {
        body,
        status: response.status,
        finalUrl: response.url,
        contentType: response.headers.get('content-type'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    } catch (error) {
      lastError = error;
      const status = error && typeof error === 'object' ? error.status : null;
      if (status !== null && status < 500 && status !== 408 && status !== 429) {
        throw error;
      }
      if (attempt < maxAttempts) {
        const retryAfterSeconds = Number(
          error && typeof error === 'object' ? error.retryAfter : null,
        );
        const backoffMilliseconds = Number.isFinite(retryAfterSeconds)
          ? Math.min(retryAfterSeconds * 1_000, 10_000)
          : Math.min(750 * (2 ** (attempt - 1)), 6_000);
        await wait(backoffMilliseconds);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export function atomicWriteFile(filepath, content) {
  mkdirSync(dirname(filepath), { recursive: true });
  const temporaryPath = `${filepath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporaryPath, content);
    renameSync(temporaryPath, filepath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function atomicWriteJson(filepath, value) {
  atomicWriteFile(filepath, `${JSON.stringify(value, null, 2)}\n`);
}

export function decodeNextFlightPayload(html, sourceLabel = 'source page') {
  const chunks = [];
  let parsedScriptCount = 0;
  const pattern = /<script[^>]*>\s*self\.__next_f\.push\((.*?)\)\s*<\/script>/gsu;

  for (const match of html.matchAll(pattern)) {
    let tuple;
    try {
      tuple = JSON.parse(match[1]);
    } catch (error) {
      throw new Error(
        `${sourceLabel} contains a malformed Next.js Flight script: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    parsedScriptCount += 1;
    if (tuple?.[0] === 1 && typeof tuple?.[1] === 'string') {
      chunks.push(tuple[1]);
    }
  }

  if (chunks.length === 0) {
    throw new Error(`${sourceLabel} contains no readable Next.js Flight payload.`);
  }

  return {
    payload: chunks.join(''),
    chunkCount: chunks.length,
    parsedScriptCount,
  };
}

export function extractJsonArrayAt(text, openingIndex, context = 'JSON array') {
  if (text[openingIndex] !== '[') {
    throw new Error(`${context} does not start with an array.`);
  }

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = openingIndex; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === '\\') {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        // React Flight represents JavaScript `undefined` inside otherwise
        // JSON-shaped props as the literal string "$undefined".  It is a
        // transport sentinel, not a published source value.
        return JSON.parse(
          text.slice(openingIndex, index + 1),
          (_key, value) => (value === '$undefined' ? null : value),
        );
      }
    }
  }

  throw new Error(`Unterminated ${context}.`);
}

export function extractJsonArraysAfterMarker(payload, marker) {
  const arrays = [];
  let cursor = 0;
  while ((cursor = payload.indexOf(marker, cursor)) !== -1) {
    const openingIndex = payload.indexOf('[', cursor + marker.length);
    if (openingIndex === -1) break;
    arrays.push(extractJsonArrayAt(payload, openingIndex, `${marker} payload`));
    cursor = openingIndex + 1;
  }
  return arrays;
}

export function uniqueBy(records, keyForRecord, context) {
  const byKey = new Map();
  for (const record of records) {
    const key = keyForRecord(record);
    if (!key) throw new Error(`${context} contains a record without a stable key.`);
    const existing = byKey.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
      throw new Error(`${context} contains conflicting records for ${key}.`);
    }
    byKey.set(key, record);
  }
  return [...byKey.values()];
}
