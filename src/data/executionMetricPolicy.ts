import type { ConfigurationSourceLinkProvenance } from '../types/admin_mapping';

/**
 * Metrics tied to a distinct, user-selectable production Agent/CLI mode rather
 * than to the model's ordinary API execution. Benchmark-internal scaffolding
 * (for example Stirrup, τ-Bench, or Terminus) is test methodology, so its
 * model-level observations remain valid for the base Chat/API configuration.
 * Arena Search and Grounding rows are model-level capability evidence too;
 * their route suffix stays in source provenance and never creates a harness.
 * A Chat configuration must never consume the production-mode metrics below.
 * A named production harness may additionally consume a projected Arena
 * Agent Mode card through an explicit one-way lower-execution fallback.
 */
export const HARNESS_ONLY_CAPABILITY_METRIC_IDS: ReadonlySet<string> = new Set([
  'aa_coding_agent_index',
  'aa_coding_agent_deepswe',
  'aa_coding_agent_swe_atlas_qna',
  'aa_coding_agent_terminalbench_v2',
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]);

const CODING_AGENT_METRIC_IDS: ReadonlySet<string> = new Set([
  'aa_coding_agent_index',
  'aa_coding_agent_deepswe',
  'aa_coding_agent_swe_atlas_qna',
  'aa_coding_agent_terminalbench_v2',
]);

const ARENA_AGENT_MODE_METRIC_IDS: ReadonlySet<string> = new Set([
  'arena_agent_success',
  'arena_agent_steerability',
  'arena_agent_praise',
  'arena_agent_bash_recovery',
  'arena_agent_tool_hallucination',
]);

const CODING_AGENT_HARNESS_NAMES: ReadonlySet<string> = new Set([
  'claude code',
  'codex cli',
  'gemini cli',
  'grok build',
  'kimi code cli',
  'opencode',
]);

function normalizedHarnessName(value: string | undefined): string {
  return (value || '')
    .split('·', 1)[0]
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US');
}

export function isHarnessOnlyCapabilityMetric(metricId: string): boolean {
  return HARNESS_ONLY_CAPABILITY_METRIC_IDS.has(metricId);
}

/**
 * Exact mode-specific observations still need the correct production
 * execution identity. This prevents an exact Arena Agent source card from
 * turning into Kimi Code/Codex evidence. Arena WebDev is benchmark-internal
 * methodology rather than a user-selectable production mode, so it is not
 * filtered here.
 */
export function isCapabilityMetricCompatibleWithHarness(
  metricId: string,
  harnessName: string | undefined,
): boolean {
  if (!isHarnessOnlyCapabilityMetric(metricId)) return true;
  if (isPlainChatHarness(harnessName)) return false;

  const normalizedHarness = normalizedHarnessName(harnessName);
  if (CODING_AGENT_METRIC_IDS.has(metricId)) {
    return CODING_AGENT_HARNESS_NAMES.has(normalizedHarness);
  }
  if (ARENA_AGENT_MODE_METRIC_IDS.has(metricId)) {
    return normalizedHarness === 'arena agent mode'
      || normalizedHarness === 'aa agent harness'
      || normalizedHarness === 'aa harness';
  }
  return false;
}

/**
 * Scoring reliability uses the number of configurations to which a metric
 * could legally apply, not the whole catalog. A named production harness may
 * receive lower Arena Agent evidence through the authored one-way fallback,
 * so it is eligible for those metrics even though such evidence is not exact.
 */
export function isCapabilityMetricApplicableToConfiguration(
  metricId: string,
  harnessName: string | undefined,
): boolean {
  if (!isHarnessOnlyCapabilityMetric(metricId)) return true;
  if (isPlainChatHarness(harnessName)) return false;

  const normalizedHarness = normalizedHarnessName(harnessName);
  if (CODING_AGENT_METRIC_IDS.has(metricId)) {
    return CODING_AGENT_HARNESS_NAMES.has(normalizedHarness);
  }
  if (ARENA_AGENT_MODE_METRIC_IDS.has(metricId)) {
    return normalizedHarness === 'arena agent mode'
      || normalizedHarness === 'aa agent harness'
      || normalizedHarness === 'aa harness'
      || CODING_AGENT_HARNESS_NAMES.has(normalizedHarness);
  }
  return false;
}

/**
 * The authored execution ladder is:
 * Chat (0) < Arena Agent Mode (1) < a named production harness (2).
 * Data may move only upward. Arena Agent Mode remains explicit source
 * provenance; it is never relabelled as an exact Claude Code/Codex run.
 */
export function isValidExecutionHarnessFallback(
  sourceHarness: string,
  sourceLevel: number,
  targetHarness: string,
  targetLevel: number,
): boolean {
  if (sourceLevel >= targetLevel || isPlainChatHarness(targetHarness)) return false;
  if (isPlainChatHarness(sourceHarness)) return sourceLevel === 0;

  return normalizedHarnessName(sourceHarness) === 'arena agent mode'
    && sourceLevel === 1
    && CODING_AGENT_HARNESS_NAMES.has(normalizedHarnessName(targetHarness))
    && targetLevel >= 2;
}

/**
 * A fallback link's capability observations retain the source execution
 * environment for metric compatibility. This lets a projected generic Agent
 * card fill a higher named harness while keeping Chat cards unable to carry
 * Agent-only metrics upward.
 */
export function isCapabilityMetricCompatibleWithSourceLink(
  metricId: string,
  targetHarness: string | undefined,
  provenance: ConfigurationSourceLinkProvenance | undefined,
): boolean {
  const sourceHarness = provenance?.kind === 'lower_harness_fallback'
    || provenance?.kind === 'lower_profile_harness_fallback'
    ? provenance.sourceHarness
    : targetHarness;
  return isCapabilityMetricCompatibleWithHarness(metricId, sourceHarness);
}

export function isPlainChatHarness(value: string | undefined): boolean {
  const harnessName = (value || '').split('·', 1)[0].trim();
  return !harnessName
    || /^(?:---|chat|no aa harness|无 aa harness|正常对话|来源已发布配置)$/iu.test(harnessName);
}
