import type {
  ConfigurationAccess,
  ConfigurationIdentity,
  ConfigurationSourceLinkProvenance,
  SourceModelCard,
  SourceObservation,
  SourceType,
} from '../types/admin_mapping';
import type { SubscriptionCostData } from '../types/llm_pk';
import { ALL_METRIC_DEFINITIONS } from '../engine/scoringEngine';
import { SCORING_CONFIG } from '../engine/scoringConfig';
import {
  getApiProfileTier,
  planApiProfileCards,
} from './apiProfileCatalog';
import {
  VERIFIED_SOURCE_MODEL_CARDS,
  VERIFIED_SOURCE_OBSERVATIONS,
} from './seedCards';
import {
  VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
  VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
} from './harnessSeedCards';
import {
  productionAgentModeCardId,
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
  VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
} from './productionAgentModeSeedCards';
import {
  reviewedFamilyAgentModeCardId,
  reviewedFamilyCardId,
  VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
  VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
} from './reviewedFamilySeedCards';
import {
  VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
  VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
} from './recoveredSourceSeedCards';
import {
  isCapabilityMetricCompatibleWithSourceLink,
  isHarnessOnlyCapabilityMetric,
  isPlainChatHarness,
} from './executionMetricPolicy';

/**
 * A shipped configuration starts with a human-readable identity and never
 * with a score. `sourceCardIds` is an exact verified card identity;
 * `sourceCardLinks` can additionally declare an auditable lower-profile or
 * Chat-to-harness fallback, never a model-name or environment heuristic.
 */
export interface BuiltInConfigurationIdentity extends ConfigurationIdentity {
  model: {
    name: string;
    /** Reasoning effort, mode, or other model-side profile. */
    profile: string;
    /** A named product/client preset when the product exposes one. */
    preset?: string;
  };
  harness: {
    /** 正常对话 unless the original configuration named a specialised tool. */
    name: string;
    /** Client, region, IDE, desktop app, or runtime detail. */
    environment: string;
  };
  provider: {
    /** The serving party/API route. */
    name: string;
    /** The underlying API or managed-service route. */
    upstream: string;
  };
}

export type BuiltInConfigurationPresetOrigin =
  | 'data-md'
  | 'source-backed'
  | 'opus-5-source-backed'
  | 'source-catalog';

/** How this configuration is expected to be accessed; it does not imply a score. */
export type BuiltInConfigurationPresetAccess = ConfigurationAccess;

/**
 * An official direct-provider API price tier that changes access economics,
 * but not the model, reasoning profile, Harness, or measured serving speed.
 * The source URL and effective date keep the override auditable instead of
 * hiding it inside a derived score.
 */
export interface BuiltInApiPricingData {
  tierName: string;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cacheReadPricePerMToken?: number;
  effectiveDate: string;
  officialSourceUrl: string;
  speedBasis: 'same-model-standard-route';
}

/**
 * A source card declared by a shipped preset.  Unlike `sourceCardIds`, this
 * can explicitly record a lower-profile or Chat-to-harness fallback. The
 * installer validates the authored direction; it never guesses ordering from
 * a profile or harness name.
 */
export interface BuiltInConfigurationPresetSourceCardLink {
  cardId: string;
  provenance: ConfigurationSourceLinkProvenance;
}

export interface BuiltInConfigurationPreset {
  /** Stable built-in identity, suitable for idempotent installation. */
  id: string;
  /** Stable readable name for a local configuration box. */
  internalName: string;
  displayName: string;
  /** Scope product line used to block accidental cross-model source links. */
  productLineId: string;
  /** The three independently editable configuration components. */
  identity: BuiltInConfigurationIdentity;
  origin: BuiltInConfigurationPresetOrigin;
  access: BuiltInConfigurationPresetAccess;
  /** Optional reader-facing access label when the vendor exposes API tiers. */
  providerDisplayLabel?: string;
  /** Official price override for a distinct direct-provider API tier. */
  apiPricingData?: BuiltInApiPricingData;
  /** Fixed-price plan economics for an explicit subscription route. */
  subscriptionData?: SubscriptionCostData;
  /** Configuration caveats only; never contains a score or source observation. */
  note?: string;
  /**
   * The installer accepts only these exact verified card IDs after checking
   * the source card's current product-line provenance. It never matches by
   * model family or borrows data for a different harness/environment.
   */
  sourceCardIds?: readonly string[];
  /**
   * Additional explicit source-card declarations. Use this only for an exact
   * card or a documented one-way fallback. Legacy `sourceCardIds` stay exact
   * and are installed above these entries in the card stack.
   */
  sourceCardLinks?: readonly BuiltInConfigurationPresetSourceCardLink[];
}

type PresetInput = Omit<BuiltInConfigurationPreset, 'id' | 'internalName' | 'displayName'> & {
  key: string;
};

function modelAuthorProviderName(modelName: string): string | null {
  const normalized = modelName.normalize('NFKC').toLocaleLowerCase('en-US');
  if (/\b(?:gpt|o1|o3|o4)\b|gpt-/u.test(normalized)) return 'OpenAI';
  if (/\bclaude\b/u.test(normalized)) return 'Anthropic';
  if (/\b(?:gemini|gemma)\b/u.test(normalized)) return 'Google';
  if (/\bgrok\b/u.test(normalized)) return 'xAI';
  if (/\bdeepseek\b/u.test(normalized)) return 'DeepSeek';
  if (/\bqwen\b/u.test(normalized)) return 'Alibaba';
  if (/\bglm\b/u.test(normalized)) return 'Z.ai';
  if (/\bkimi\b/u.test(normalized)) return 'Moonshot AI';
  if (/\bminimax\b/u.test(normalized)) return 'MiniMax';
  if (/\b(?:llama|muse(?: spark| glimmer))\b/u.test(normalized)) return 'Meta';
  if (/\bmistral\b/u.test(normalized)) return 'Mistral';
  if (/\bnemotron\b/u.test(normalized)) return 'NVIDIA';
  if (/\b(?:hunyuan|hy3)\b/u.test(normalized)) return 'Tencent';
  if (/\bmimo\b/u.test(normalized)) return 'Xiaomi';
  if (/\bstep\b/u.test(normalized)) return 'StepFun';
  if (/\bgranite\b/u.test(normalized)) return 'IBM';
  return null;
}

function providerNameFromVendorText(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const trimmed = value.trim();
  const normalized = trimmed
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (
    !normalized
    || /^(?:source-catalog|cross-source-catalog|openrouter|benchmark|unknown-provider)$/u
      .test(normalized)
  ) return null;
  if (/(?:^|-)openai(?:-|$)/u.test(normalized)) return 'OpenAI';
  if (/(?:^|-)anthropic(?:-|$)/u.test(normalized)) return 'Anthropic';
  if (/(?:^|-)google(?:-|$)|deepmind/u.test(normalized)) return 'Google';
  if (/(?:^|-)x-ai(?:-|$)|(?:^|-)xai(?:-|$)|spacexai/u.test(normalized)) return 'xAI';
  if (/(?:^|-)deepseek(?:-|$)/u.test(normalized)) return 'DeepSeek';
  if (/(?:^|-)qwen(?:-|$)|(?:^|-)alibaba(?:-|$)/u.test(normalized)) return 'Alibaba';
  if (/(?:^|-)z-ai(?:-|$)|(?:^|-)zai(?:-|$)|zhipu/u.test(normalized)) return 'Z.ai';
  if (/(?:^|-)moonshot(?:ai)?(?:-|$)|(?:^|-)kimi(?:-|$)/u.test(normalized)) return 'Moonshot AI';
  if (/(?:^|-)minimax(?:-|$)/u.test(normalized)) return 'MiniMax';
  if (/(?:^|-)meta(?:-llama)?(?:-|$)/u.test(normalized)) return 'Meta';
  if (/(?:^|-)mistral(?:ai)?(?:-|$)/u.test(normalized)) return 'Mistral';
  if (/(?:^|-)nvidia(?:-|$)/u.test(normalized)) return 'NVIDIA';
  if (/(?:^|-)tencent(?:-|$)/u.test(normalized)) return 'Tencent';
  if (/(?:^|-)bytedance(?:-|$)|byte-dance|seed-team/u.test(normalized)) return 'ByteDance';
  if (/(?:^|-)xiaomi(?:-|$)/u.test(normalized)) return 'Xiaomi';
  if (/(?:^|-)stepfun(?:-|$)/u.test(normalized)) return 'StepFun';
  if (/(?:^|-)ibm(?:-granite)?(?:-|$)/u.test(normalized)) return 'IBM';
  return trimmed.replace(/\s+API\s*$/iu, '');
}

function explicitlyConfiguredProviderName(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const trimmed = value.trim().replace(/\s+API\s*$/iu, '');
  const normalized = trimmed
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return /^(?:source-catalog|cross-source-catalog|openrouter|benchmark|unknown-provider)$/u
    .test(normalized)
    ? null
    : trimmed;
}

function displayProviderLabel(
  identity: BuiltInConfigurationIdentity,
  access: BuiltInConfigurationPresetAccess,
  explicitLabel?: string,
): string {
  if (explicitLabel?.trim()) return explicitLabel.trim();

  // Reader-facing API configurations use the model author's vendor, not the
  // particular serving endpoint recorded by one benchmark run. The configured
  // route remains in structured metadata for provenance, while price and speed
  // may come from any same-model OpenRouter catalog/aggregate record.
  if (access === 'api') {
    const author = modelAuthorProviderName(identity.model.name)
      || explicitlyConfiguredProviderName(identity.provider?.name)
      || 'Model author';
    return `${author.replace(/\s+API\s*$/iu, '')} API`;
  }

  const explicitProvider = explicitlyConfiguredProviderName(identity.provider?.name);
  const provider = explicitProvider
    || modelAuthorProviderName(identity.model.name)
    || 'Model author';
  return provider;
}

function displayNameOf(
  identity: BuiltInConfigurationIdentity,
  access: BuiltInConfigurationPresetAccess,
  providerDisplayLabel?: string,
): string {
  let conciseProfile = identity.model.profile
    .replace(/^mode\s*=\s*standard,\s*effort\s*=\s*/iu, '')
    .replace(/^mode\s*=\s*pro,\s*effort\s*=\s*/iu, 'Pro ')
    .replace(/（[^）]*(?:默认|未拆档|未单列)[^）]*）/gu, '')
    .replace(/\bdefault\s+effort\b/giu, '')
    .replace(/^reasoning$/iu, 'Max')
    .replace(/\s+/gu, ' ')
    .trim();
  if (
    /^pro\s+/iu.test(conciseProfile)
    && /\bpro\b/iu.test(identity.model.name)
  ) {
    conciseProfile = conciseProfile.replace(/^pro\s+/iu, '');
  }
  if (
    conciseProfile
    && new RegExp(`(?:^|[\\s_-])${conciseProfile.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'iu')
      .test(identity.model.name)
  ) {
    conciseProfile = '';
  }
  if (conciseProfile === 'Max' && /\bmax\b/iu.test(identity.model.name)) {
    conciseProfile = '';
  }
  const modelLabel = [identity.model.name, conciseProfile, identity.model.preset]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ');
  const rawHarnessLabel = identity.harness?.name || 'Chat';
  const harnessLabel = /^(?:正常对话|来源已发布配置|fast 路线)$/iu.test(rawHarnessLabel)
    ? 'Chat'
    : rawHarnessLabel;
  const providerLabel = displayProviderLabel(identity, access, providerDisplayLabel);
  return `${modelLabel} | ${harnessLabel} | ${providerLabel}`;
}

function definePreset({ key, ...preset }: PresetInput): BuiltInConfigurationPreset {
  return {
    ...preset,
    id: `builtin.${key}`,
    internalName: `builtin_${key.replace(/[^a-z0-9]+/giu, '_')}`,
    displayName: displayNameOf(
      preset.identity,
      preset.access,
      preset.providerDisplayLabel,
    ),
  };
}

function normalChat(
  environment: string = 'OpenRouter Chatroom (ORC)',
): BuiltInConfigurationIdentity['harness'] {
  return { name: '---', environment };
}

function viaOpenRouter(providerName: string, upstreamApi: string): BuiltInConfigurationIdentity['provider'] {
  return {
    name: providerName,
    upstream: `${upstreamApi}（经由 OpenRouter 直连上游）`,
  };
}

function orcPreset(input: {
  key: string;
  productLineId: string;
  modelName: string;
  profile: string;
  providerName: string;
  upstreamApi: string;
  preset?: string;
  note?: string;
  /** Only exact, independently verified source-card identities belong here. */
  sourceCardIds?: readonly string[];
  /** Explicit exact or low-to-high fallback card declarations. */
  sourceCardLinks?: readonly BuiltInConfigurationPresetSourceCardLink[];
}): BuiltInConfigurationPreset {
  return definePreset({
    key: input.key,
    productLineId: input.productLineId,
    identity: {
      model: { name: input.modelName, profile: input.profile, preset: input.preset },
      harness: normalChat(),
      provider: viaOpenRouter(input.providerName, input.upstreamApi),
    },
    origin: 'data-md',
    access: 'api',
    note: input.note,
    sourceCardIds: input.sourceCardIds,
    sourceCardLinks: input.sourceCardLinks,
  });
}

function harnessPreset(input: {
  key: string;
  productLineId: string;
  modelName: string;
  profile: string;
  harness: string;
  providerName: string;
  upstreamApi: string;
  exactHarnessCardIds: readonly string[];
  chatFallbackCardIds: readonly string[];
  sameHarnessFallbackLinks?: readonly BuiltInConfigurationPresetSourceCardLink[];
  environment?: string;
  fallbackPolicyNote?: string;
  note?: string;
}): BuiltInConfigurationPreset {
  return definePreset({
    key: input.key,
    productLineId: input.productLineId,
    identity: {
      model: { name: input.modelName, profile: input.profile },
      harness: {
        name: input.harness,
        environment: input.environment
          || `${input.harness} · Artificial Analysis Coding Agent Index`,
      },
      provider: {
        name: input.providerName,
        upstream: input.upstreamApi,
      },
    },
    origin: 'data-md',
    access: 'api',
    note: [
      input.note,
      input.fallbackPolicyNote
        || 'Harness 专属 AA Coding Agent Index 数据优先；同模型 Chat 与通用 Arena Agent 数据只按执行层级单向向上补缺，禁止反向回填。',
    ].filter(Boolean).join(' '),
    sourceCardIds: input.exactHarnessCardIds,
    sourceCardLinks: [
      ...(input.sameHarnessFallbackLinks || []),
      ...input.chatFallbackCardIds.map((cardId) => (
        lowerHarnessFallback(cardId, input.profile, input.harness)
      )),
    ],
  });
}

function arenaAgentModePreset(input: {
  key: string;
  productLineId: string;
  modelName: string;
  profile: string;
  providerName: string;
  upstreamApi: string;
  arenaBaseCardId: string;
  chatFallbackCardIds: readonly string[];
  additionalFallbackLinks?: readonly BuiltInConfigurationPresetSourceCardLink[];
  note?: string;
}): BuiltInConfigurationPreset {
  return harnessPreset({
    key: input.key,
    productLineId: input.productLineId,
    modelName: input.modelName,
    profile: input.profile,
    harness: 'AA Agent Harness',
    providerName: input.providerName,
    upstreamApi: input.upstreamApi,
    exactHarnessCardIds: [productionAgentModeCardId(input.arenaBaseCardId)],
    chatFallbackCardIds: input.chatFallbackCardIds,
    sameHarnessFallbackLinks: input.additionalFallbackLinks,
    environment: 'Arena Agent Mode',
    fallbackPolicyNote: 'AA Agent Harness 展示项使用 Arena Agent Mode 的已发布 Agent 数据；同档无 Harness 数据仅可单向向上补缺，禁止反向回填或串入其他 Harness。',
    note: input.note,
  });
}

const DATA_MD_DEFAULT_REASONING = 'Max';

/**
 * Every fallback below is individually authored from a published source
 * profile. The numeric levels document the intended one-way order; they are
 * never derived at runtime from words such as “High” or “Max”.
 */
function lowerProfileFallback(
  cardId: string,
  sourceProfile: string,
  sourceLevel: number,
  targetProfile: string,
  targetLevel: number,
): BuiltInConfigurationPresetSourceCardLink {
  return {
    cardId,
    provenance: {
      kind: 'lower_profile_fallback',
      sourceProfile,
      sourceLevel,
      targetProfile,
      targetLevel,
    },
  };
}

function lowerHarnessFallback(
  cardId: string,
  profile: string,
  targetHarness: string,
): BuiltInConfigurationPresetSourceCardLink {
  return {
    cardId,
    provenance: {
      kind: 'lower_harness_fallback',
      sourceHarness: 'Chat',
      sourceLevel: 0,
      targetHarness,
      targetLevel: 1,
      sourceProfile: profile,
      targetProfile: profile,
    },
  };
}

function lowerProfileHarnessFallback(
  cardId: string,
  sourceProfile: string,
  sourceProfileLevel: number,
  targetProfile: string,
  targetProfileLevel: number,
  targetHarness: string,
): BuiltInConfigurationPresetSourceCardLink {
  return {
    cardId,
    provenance: {
      kind: 'lower_profile_harness_fallback',
      sourceProfile,
      sourceProfileLevel,
      targetProfile,
      targetProfileLevel,
      sourceHarness: 'Chat',
      sourceHarnessLevel: 0,
      targetHarness,
      targetHarnessLevel: 1,
    },
  };
}

function lowerAgentHarnessFallback(
  cardId: string,
  profile: string,
  targetHarness: string,
): BuiltInConfigurationPresetSourceCardLink {
  return {
    cardId,
    provenance: {
      kind: 'lower_harness_fallback',
      sourceHarness: 'Arena Agent Mode',
      sourceLevel: 1,
      targetHarness,
      targetLevel: 2,
      sourceProfile: profile,
      targetProfile: profile,
    },
  };
}

function lowerProfileAgentHarnessFallback(
  cardId: string,
  sourceProfile: string,
  sourceProfileLevel: number,
  targetProfile: string,
  targetProfileLevel: number,
  targetHarness: string,
): BuiltInConfigurationPresetSourceCardLink {
  return {
    cardId,
    provenance: {
      kind: 'lower_profile_harness_fallback',
      sourceProfile,
      sourceProfileLevel,
      targetProfile,
      targetProfileLevel,
      sourceHarness: 'Arena Agent Mode',
      sourceHarnessLevel: 1,
      targetHarness,
      targetHarnessLevel: 2,
    },
  };
}

function uniqueCardIds(...groups: Array<readonly string[] | undefined>): string[] {
  const seen = new Set<string>();
  return groups.flatMap((group) => group || []).filter((cardId) => {
    if (seen.has(cardId)) return false;
    seen.add(cardId);
    return true;
  });
}

function profileFallbackLinks(
  productLineId: string,
  profileKey: string,
  targetProfile: string,
): BuiltInConfigurationPresetSourceCardLink[] {
  const plan = planApiProfileCards(productLineId, profileKey, targetProfile);
  if (!plan) {
    throw new Error(`Missing explicit API profile evidence for ${productLineId}/${profileKey}.`);
  }
  return plan.lowerFallbackCards.map((fallback) => lowerProfileFallback(
    fallback.cardId,
    fallback.sourceProfile,
    fallback.sourceLevel,
    fallback.targetProfile,
    fallback.targetLevel,
  ));
}

function dedupeSourceLinks(
  links: readonly BuiltInConfigurationPresetSourceCardLink[],
): BuiltInConfigurationPresetSourceCardLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.cardId)) return false;
    seen.add(link.cardId);
    return true;
  });
}

/**
 * Creates every explicitly published effort tier for one existing API route.
 * The route/harness identity is supplied as a whole, so no standard-chat
 * source can silently become evidence for a Fast, IDE, search, or managed
 * configuration.
 */
function apiProfilePresets(input: {
  keyPrefix: string;
  keySuffix?: string;
  productLineId: string;
  modelName: string;
  profileKeys: readonly string[];
  providerName?: string;
  upstreamApi?: string;
  environment?: string;
  sharedExactCardIds?: readonly string[];
  note?: string;
  origin?: BuiltInConfigurationPresetOrigin;
  identityForProfile?: (profile: string) => BuiltInConfigurationIdentity;
}): BuiltInConfigurationPreset[] {
  return input.profileKeys.map((profileKey) => {
    const profile = getApiProfileTier(input.productLineId, profileKey);
    if (!profile) {
      throw new Error(`Missing explicit API profile tier for ${input.productLineId}/${profileKey}.`);
    }
    const plan = planApiProfileCards(input.productLineId, profileKey, profile.label);
    if (!plan) {
      throw new Error(`Missing explicit API profile card plan for ${input.productLineId}/${profileKey}.`);
    }

    const identity = input.identityForProfile
      ? input.identityForProfile(profile.label)
      : {
          model: { name: input.modelName, profile: profile.label },
          harness: normalChat(input.environment),
          provider: viaOpenRouter(input.providerName || 'Unknown provider', input.upstreamApi || 'Unknown API'),
        };
    const sourceAvailabilityNote = plan.exactCardIds.length === 0
      ? '该档位由 OpenRouter 官方模型目录的 reasoning.supported_efforts 确认；当前没有同档能力卡，只保留合法低档兜底或显示数据不足。'
      : undefined;
    const note = [input.note, sourceAvailabilityNote]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join('；');

    return definePreset({
      key: `${input.keyPrefix}.${profileKey}${input.keySuffix || ''}`,
      productLineId: input.productLineId,
      identity,
      origin: input.origin ?? 'data-md',
      access: 'api',
      ...(note ? { note } : {}),
      sourceCardIds: uniqueCardIds(plan.exactCardIds, input.sharedExactCardIds),
      sourceCardLinks: profileFallbackLinks(input.productLineId, profileKey, profile.label),
    });
  });
}

const ROUTE_EFFORT_LABELS: Readonly<Record<string, string>> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
};

/**
 * Some official API routes publish their available effort list before a
 * benchmark publishes route-specific capability measurements. Keep those
 * configurations visible, retain only that route's price/availability card,
 * and never borrow a standard-route capability card to make them look full.
 */
function apiRouteEffortPresets(input: {
  keyPrefix: string;
  productLineId: string;
  modelName: string;
  effortKeys: readonly string[];
  providerName: string;
  upstreamApi: string;
  routeName: string;
  sourceCardIds: readonly string[];
  note: string;
}): BuiltInConfigurationPreset[] {
  return input.effortKeys.map((effortKey) => {
    const effort = ROUTE_EFFORT_LABELS[effortKey];
    if (!effort) throw new Error(`Unknown published route effort: ${effortKey}.`);
    return orcPreset({
      key: `${input.keyPrefix}.${effortKey}`,
      productLineId: input.productLineId,
      modelName: input.modelName,
      profile: `mode = ${input.routeName}, effort = ${effort}`,
      providerName: input.providerName,
      upstreamApi: input.upstreamApi,
      sourceCardIds: input.sourceCardIds,
      note: input.note,
    });
  });
}

/**
 * Built-in configuration inventory for every Data.md row/configuration.
 *
 * The two slash-separated provider rows are expanded into independently
 * selectable provider routes, rather than treating three providers as one
 * fictional route.  That adds four presets beyond the 61 original rows.
 */
const DATA_MD_CONFIGURATION_PRESETS_RAW: readonly BuiltInConfigurationPreset[] = [
  // Domestic Models
  definePreset({
    key: 'data-md.deepseek-v4-flash-0731.max',
    productLineId: 'deepseek_v4_flash_0731',
    identity: {
      model: { name: 'DeepSeek V4 Flash 0731', profile: DATA_MD_DEFAULT_REASONING },
      harness: normalChat('DeepSeek API'),
      provider: { name: 'DeepSeek', upstream: 'DeepSeek API' },
    },
    origin: 'data-md',
    access: 'api',
    note: '正式版 0731 使用 Artificial Analysis 对 DeepSeek 官方 API 的 Max 能力、价格与性能实测；Arena WebDev 的 deepseek-v4-flash-high 链接 7 月 31 日官方 X 公告，以 High 低档兜底接入 Max。所有链接 4 月 24 日公告的文本榜数据仍归 Preview，不混入。',
    sourceCardIds: ['card-aa-deepseek-v4-flash'],
    sourceCardLinks: [lowerProfileFallback(
      'card-arena-deepseek-v4-flash-high',
      'High',
      3,
      'Max',
      5,
    )],
  }),
  orcPreset({ key: 'data-md.deepseek-v4-flash.max', productLineId: 'deepseek_v4_flash', modelName: 'DeepSeek-v4-Flash Preview', profile: DATA_MD_DEFAULT_REASONING, providerName: 'DeepSeek', upstreamApi: 'DeepSeek API', sourceCardIds: ['card-aa-deepseek-v4-flash-0420', 'card-openrouter-deepseek-deepseek-v4-flash'] }),
  orcPreset({ key: 'data-md.deepseek-v4-pro.max', productLineId: 'deepseek_v4_pro', modelName: 'DeepSeek-v4-Pro Preview', profile: DATA_MD_DEFAULT_REASONING, providerName: 'DeepSeek', upstreamApi: 'DeepSeek API', sourceCardIds: ['card-aa-deepseek-v4-pro-0424', 'card-openrouter-deepseek-deepseek-v4-pro'] }),
  orcPreset({ key: 'data-md.glm-5-2.max', productLineId: 'glm_52', modelName: 'GLM-5.2', profile: DATA_MD_DEFAULT_REASONING, providerName: 'Z.ai', upstreamApi: 'Z.ai API', sourceCardIds: ['card-aa-glm-5-2', 'card-arena-glm-5-2-max', 'card-openrouter-z-ai-glm-5-2'] }),
  orcPreset({ key: 'data-md.hy3.max', productLineId: 'hunyuan_hy3', modelName: 'Hy3', profile: DATA_MD_DEFAULT_REASONING, providerName: 'GMICloud', upstreamApi: 'GMICloud API' }),
  definePreset({
    key: 'data-md.kimi-k3.kimi-code',
    productLineId: 'kimi_k3',
    identity: {
      model: { name: 'Kimi K3', profile: 'Max', preset: 'Kimi Code' },
      harness: { name: 'Kimi Code', environment: 'Kimi Code CLI Agent' },
      provider: { name: 'Moonshot CN', upstream: 'Moonshot 国内站 API（Kimi Code CLI harness；实际 key/路由待确认）' },
    },
    origin: 'data-md',
    access: 'managed-service',
    note: '保留 Kimi Code 的 Agent 预设、审批与自主编译环境；不等同于普通聊天，也不把 Kimi Code 专用 API 与 Moonshot Open Platform 混为同一来源。',
  }),
  orcPreset({ key: 'data-md.kimi-k2-6.max', productLineId: 'kimi_k26', modelName: 'Kimi K2.6', profile: DATA_MD_DEFAULT_REASONING, providerName: 'Moonshot AI', upstreamApi: 'Moonshot API', sourceCardIds: ['card-openrouter-moonshotai-kimi-k2-6'] }),
  orcPreset({ key: 'data-md.minimax-m3.max', productLineId: 'minimax_m3', modelName: 'MiniMax M3', profile: DATA_MD_DEFAULT_REASONING, providerName: 'MiniMax', upstreamApi: 'MiniMax API', sourceCardIds: ['card-openrouter-minimax-minimax-m3'] }),
  definePreset({
    key: 'data-md.qwen-3-8-max-preview.qoder-cn',
    productLineId: 'qwen_38_max_preview',
    identity: {
      model: { name: 'Qwen3.8-Max-Preview', profile: 'Qoder 管理的思考（287s 上限）' },
      harness: { name: 'Qoder CN', environment: 'Qoder CN IDE Agent' },
      provider: { name: 'Qoder CN', upstream: 'Qoder CN 托管路由（Alibaba/Qwen 上游未由原始记录确认）' },
    },
    origin: 'data-md',
    access: 'managed-service',
    note: '原测试在思考超限后改为 Grok 模式；15 credits 不能证明是 QwenCloud/Model Studio 直连，因此不能与通用 Qwen API 混用。',
  }),
  orcPreset({ key: 'data-md.qwen-3-7-max.max', productLineId: 'qwen_37_max', modelName: 'Qwen3.7-Max', profile: DATA_MD_DEFAULT_REASONING, providerName: 'Alibaba', upstreamApi: 'Alibaba Qwen API', sourceCardIds: ['card-openrouter-qwen-qwen3-7-max'] }),
  orcPreset({ key: 'data-md.qwen-3-7-plus.max', productLineId: 'qwen_37_plus', modelName: 'Qwen3.7-Plus', profile: DATA_MD_DEFAULT_REASONING, providerName: 'Alibaba', upstreamApi: 'Alibaba Qwen API', sourceCardIds: ['card-openrouter-qwen-qwen3-7-plus'] }),
  definePreset({
    key: 'data-md.seed-2-1-turbo.trae-cn',
    productLineId: 'seed_21_turbo',
    identity: {
      model: { name: 'Seed-2.1-Turbo', profile: 'Max' },
      harness: { name: 'Trae CN', environment: 'Trae CN IDE Agent' },
      provider: { name: 'TRAE CN', upstream: 'TRAE CN 托管路由（Volcengine Ark API 路径未由原始记录确认）' },
    },
    origin: 'data-md',
    access: 'managed-service',
    note: '审批和自主编译属于 Trae 环境，不能回填成普通聊天。',
  }),
  definePreset({
    key: 'data-md.seed-2-1-turbo.doubao',
    productLineId: 'seed_21_turbo',
    identity: {
      model: { name: 'Seed-2.1-Turbo', profile: 'Max' },
      harness: { name: 'Doubao', environment: 'Doubao managed chat/service' },
      provider: { name: 'Doubao', upstream: 'ByteDance Doubao managed consumer service（非 Ark API 直连）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  orcPreset({ key: 'data-md.longcat-2-0.max', productLineId: 'longcat_20', modelName: 'LongCat 2.0', profile: DATA_MD_DEFAULT_REASONING, providerName: 'Meituan', upstreamApi: 'Meituan API' }),
  orcPreset({ key: 'data-md.kat-coder-pro-v2-5.max', productLineId: 'kat_coder_pro_v25', modelName: 'KAT-Coder-Pro V2.5', profile: DATA_MD_DEFAULT_REASONING, providerName: 'StreamLake', upstreamApi: 'StreamLake API' }),
  definePreset({
    key: 'data-md.mimo-v2-5-pro.normal-chat-inferred',
    productLineId: 'mimo_v25_pro',
    identity: {
      model: { name: 'Mimo V2.5 Pro', profile: 'Max' },
      harness: normalChat('Chat'),
      provider: { name: 'AtlasCloud', upstream: 'AtlasCloud API（Data.md Provider）' },
    },
    origin: 'data-md',
    access: 'inferred',
    note: '唯一未填写 Environment 的原表行；按“未特意标注即正常对话”的规则补全，待用户确认后可改。',
  }),
  orcPreset({ key: 'data-md.step-3-7-flash.max', productLineId: 'step_37_flash', modelName: 'Step 3.7 Flash', profile: DATA_MD_DEFAULT_REASONING, providerName: 'StepFun', upstreamApi: 'StepFun API', sourceCardIds: ['card-openrouter-stepfun-step-3-7-flash'] }),

  // Foreign Models — OpenAI
  orcPreset({ key: 'data-md.gpt-5-6-sol.pro-max', productLineId: 'gpt_56_sol', modelName: 'GPT-5.6 Sol', profile: 'mode = Pro, effort = Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', note: 'OpenRouter 仅明确发布 Pro 路由价格；AA 的 Max 卡未声明 Pro，故不借用其能力观测。', sourceCardIds: ['card-openrouter-openai-gpt-5-6-sol-pro'] }),
  definePreset({
    key: 'data-md.gpt-5-6-sol.codex-desktop-ultra-fast-on',
    productLineId: 'gpt_56_sol',
    identity: {
      model: { name: 'GPT-5.6 Sol', profile: 'mode = Standard, effort = Max', preset: 'Ultra · fast-mode on' },
      harness: { name: 'Codex Desktop', environment: 'Codex Desktop · Ultra · fast-mode on' },
      provider: { name: 'OpenAI Codex', upstream: 'OpenAI Codex Desktop managed service' },
    },
    origin: 'data-md',
    access: 'managed-service',
    note: 'Ultra 预设与 fast-mode 状态是模型配置的一部分。',
  }),
  definePreset({
    key: 'data-md.gpt-5-6-sol.codex-desktop-ultra-fast-off',
    productLineId: 'gpt_56_sol',
    identity: {
      model: { name: 'GPT-5.6 Sol', profile: 'mode = Standard, effort = Max', preset: 'Ultra · fast-mode off' },
      harness: { name: 'Codex Desktop', environment: 'Codex Desktop · Ultra · fast-mode off' },
      provider: { name: 'OpenAI Codex', upstream: 'OpenAI Codex Desktop managed service' },
    },
    origin: 'data-md',
    access: 'managed-service',
    note: '与 fast-mode on 分开建盒，禁止共享来源卡或分数。',
  }),
  orcPreset({ key: 'data-md.gpt-5-6-sol.max', productLineId: 'gpt_56_sol', modelName: 'GPT-5.6 Sol', profile: 'Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', sourceCardIds: ['card-aa-gpt-5-6-sol', 'card-openrouter-openai-gpt-5-6-sol'], sourceCardLinks: [lowerProfileFallback('card-arena-gpt-5-6-sol-xhigh', 'XHigh', 4, 'Max', 5)] }),
  orcPreset({ key: 'data-md.gpt-5-6-sol.none', productLineId: 'gpt_56_sol', modelName: 'GPT-5.6 Sol', profile: 'None', providerName: 'OpenAI', upstreamApi: 'OpenAI API', sourceCardIds: ['card-aa-gpt-5-6-sol-non-reasoning', 'card-openrouter-openai-gpt-5-6-sol'] }),
  orcPreset({ key: 'data-md.gpt-5-6-terra.pro-max', productLineId: 'gpt_56_terra', modelName: 'GPT-5.6 Terra', profile: 'mode = Pro, effort = Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', note: 'OpenRouter 仅明确发布 Pro 路由价格；AA 的 Max 卡未声明 Pro，故不借用其能力观测。', sourceCardIds: ['card-openrouter-openai-gpt-5-6-terra-pro'] }),
  orcPreset({ key: 'data-md.gpt-5-6-terra.max', productLineId: 'gpt_56_terra', modelName: 'GPT-5.6 Terra', profile: 'Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', sourceCardIds: ['card-aa-gpt-5-6-terra', 'card-openrouter-openai-gpt-5-6-terra'] }),
  orcPreset({ key: 'data-md.gpt-5-6-luna.pro-max', productLineId: 'gpt_56_luna', modelName: 'GPT-5.6 Luna', profile: 'mode = Pro, effort = Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', note: 'OpenRouter 仅明确发布 Pro 路由价格；AA 的 Max 卡未声明 Pro，故不借用其能力观测。', sourceCardIds: ['card-openrouter-openai-gpt-5-6-luna-pro'] }),
  orcPreset({ key: 'data-md.gpt-5-6-luna.max', productLineId: 'gpt_56_luna', modelName: 'GPT-5.6 Luna', profile: 'Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', sourceCardIds: ['card-aa-gpt-5-6-luna', 'card-openrouter-openai-gpt-5-6-luna'] }),
  orcPreset({ key: 'data-md.gpt-5-5.max', productLineId: 'gpt_55', modelName: 'GPT-5.5', profile: 'Max', providerName: 'OpenAI', upstreamApi: 'OpenAI API', note: 'Data.md 记录为 Max；当前公开 API 档位只明确到 XHigh，故能力观测均以 XHigh 低档兜底显示，绝不反向当作 Max。', sourceCardIds: ['card-openrouter-openai-gpt-5-5'], sourceCardLinks: [lowerProfileFallback('card-aa-gpt-5-5', 'XHigh', 4, 'Max', 5), lowerProfileFallback('card-arena-gpt-5-5-xhigh', 'XHigh', 4, 'Max', 5), lowerProfileFallback('card-arena-gpt-5-5-high', 'High', 3, 'Max', 5)] }),

  // Foreign Models — Anthropic models served through Vertex in Data.md
  orcPreset({ key: 'data-md.claude-fable-5.max.vertex', productLineId: 'claude_fable_5', modelName: 'Claude Fable 5', profile: 'Max', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', note: 'AA 的 Max 卡明确披露了 Opus 4.8 fallback；保留该来源披露，不把它静默伪装成纯 Fable 5 数据。', sourceCardIds: ['card-aa-claude-fable-5'], sourceCardLinks: [lowerProfileFallback('card-arena-claude-fable-5-high', 'High', 3, 'Max', 5)] }),
  orcPreset({ key: 'data-md.claude-fable-5.minimal.vertex', productLineId: 'claude_fable_5', modelName: 'Claude Fable 5', profile: 'Minimal', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）' }),
  orcPreset({ key: 'data-md.claude-opus-4-8.max.vertex', productLineId: 'claude_opus_48', modelName: 'Claude Opus 4.8', profile: 'Max', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', sourceCardIds: ['card-aa-claude-opus-4-8'] }),
  orcPreset({ key: 'data-md.claude-opus-4-8.none.vertex', productLineId: 'claude_opus_48', modelName: 'Claude Opus 4.8', profile: 'None', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）' }),
  orcPreset({ key: 'data-md.claude-opus-4-7.none.vertex', productLineId: 'claude_opus_47', modelName: 'Claude Opus 4.7', profile: 'None', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', sourceCardIds: ['card-aa-claude-opus-4-7-non-reasoning'] }),
  orcPreset({ key: 'data-md.claude-opus-4-6.none.vertex', productLineId: 'claude_opus_46', modelName: 'Claude Opus 4.6', profile: 'None', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', sourceCardIds: ['card-aa-claude-opus-4-6'] }),
  orcPreset({ key: 'data-md.claude-opus-4-5.none.vertex', productLineId: 'claude_opus_45', modelName: 'Claude Opus 4.5', profile: 'None', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', sourceCardIds: ['card-aa-claude-opus-4-5'] }),
  orcPreset({ key: 'data-md.claude-sonnet-5.max.vertex', productLineId: 'claude_sonnet_5', modelName: 'Claude Sonnet 5', profile: 'Max', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）', sourceCardIds: ['card-aa-claude-sonnet-5'], sourceCardLinks: [lowerProfileFallback('card-arena-claude-sonnet-5-high', 'High', 3, 'Max', 5)] }),
  orcPreset({
    key: 'data-md.claude-haiku-4-5.max.vertex',
    productLineId: 'claude_haiku_45',
    modelName: 'Claude Haiku 4.5',
    profile: 'Max',
    providerName: 'Google Vertex',
    upstreamApi: 'Vertex AI API（Claude on Vertex）',
    sourceCardIds: ['card-aa-claude-4-5-haiku-reasoning'],
    sourceCardLinks: [
      lowerProfileFallback('card-aa-claude-4-5-haiku', 'None', 0, 'Max', 5),
      lowerProfileFallback('card-arena-claude-haiku-4-5-20251001', 'None', 0, 'Max', 5),
    ],
  }),

  // Foreign Models — Google environments
  orcPreset({ key: 'data-md.gemini-3-1-pro-preview.high.ai-studio', productLineId: 'gemini_31_pro', modelName: 'Gemini 3.1 Pro Preview', profile: 'High', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-openrouter-google-gemini-3-1-pro-preview'] }),
  definePreset({
    key: 'data-md.gemini-3-1-pro.high.antigravity',
    productLineId: 'gemini_31_pro',
    identity: {
      model: { name: 'Gemini 3.1 Pro', profile: 'High' },
      harness: { name: 'Antigravity Desktop', environment: 'Antigravity Desktop' },
      provider: { name: 'Google Antigravity', upstream: 'Google Antigravity managed Gemini service（AI Studio key 未记录）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  definePreset({
    key: 'data-md.gemini-3-1-pro.low.antigravity',
    productLineId: 'gemini_31_pro',
    identity: {
      model: { name: 'Gemini 3.1 Pro', profile: 'Low' },
      harness: { name: 'Antigravity Desktop', environment: 'Antigravity Desktop' },
      provider: { name: 'Google Antigravity', upstream: 'Google Antigravity managed Gemini service（AI Studio key 未记录）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  definePreset({
    key: 'data-md.gemini-3-1-pro.extended.gemini-website',
    productLineId: 'gemini_31_pro',
    identity: {
      model: { name: 'Gemini 3.1 Pro', profile: 'Extended' },
      harness: { name: 'Gemini Website', environment: 'Gemini Website' },
      provider: { name: 'Google Gemini Apps', upstream: 'Gemini Website managed service（订阅/账户路线待补）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  definePreset({
    key: 'data-md.gemini-3-1-pro.default.notebooklm',
    productLineId: 'gemini_31_pro',
    identity: {
      model: { name: 'Gemini 3.1 Pro', profile: 'Default' },
      harness: { name: 'NotebookLM', environment: 'NotebookLM' },
      provider: { name: 'NotebookLM', upstream: 'Google NotebookLM source-grounded managed service（订阅/账户路线待补）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  orcPreset({ key: 'data-md.gemini-3-6-flash.high.ai-studio', productLineId: 'gemini_36_flash', modelName: 'Gemini 3.6 Flash', profile: 'High', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-openrouter-google-gemini-3-6-flash'] }),
  orcPreset({ key: 'data-md.gemini-3-5-flash.high.ai-studio', productLineId: 'gemini_35_flash', modelName: 'Gemini 3.5 Flash', profile: 'High', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-aa-gemini-3-5-flash', 'card-arena-gemini-3-5-flash-high', 'card-openrouter-google-gemini-3-5-flash'], sourceCardLinks: [lowerProfileFallback('card-arena-gemini-3-5-flash-medium', 'Medium', 2, 'High', 3)] }),
  definePreset({
    key: 'data-md.gemini-3-5-flash.extended.gemini-website',
    productLineId: 'gemini_35_flash',
    identity: {
      model: { name: 'Gemini 3.5 Flash', profile: 'Extended' },
      harness: { name: 'Gemini Website', environment: 'Gemini Website' },
      provider: { name: 'Google Gemini Apps', upstream: 'Gemini Website managed service（订阅/账户路线待补）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  orcPreset({ key: 'data-md.gemini-3-5-flash-lite.high.ai-studio', productLineId: 'gemini_35_flash_lite', modelName: 'Gemini 3.5 Flash-Lite', profile: 'High', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-openrouter-google-gemini-3-5-flash-lite'] }),
  orcPreset({ key: 'data-md.gemini-3-1-flash-lite.high.ai-studio', productLineId: 'gemini_31_flash_lite', modelName: 'Gemini 3.1 Flash Lite', profile: 'High', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-openrouter-google-gemini-3-1-flash-lite'] }),
  definePreset({
    key: 'data-md.gemini-3-1-flash-lite.standard.gemini-website',
    productLineId: 'gemini_31_flash_lite',
    identity: {
      model: { name: 'Gemini 3.1 Flash Lite', profile: 'Standard' },
      harness: { name: 'Gemini Website', environment: 'Gemini Website' },
      provider: { name: 'Google Gemini Apps', upstream: 'Gemini Website managed service（订阅/账户路线待补）' },
    },
    origin: 'data-md',
    access: 'managed-service',
  }),
  orcPreset({ key: 'data-md.gemini-2-5-flash-lite.none.ai-studio', productLineId: 'gemini_25_flash_lite', modelName: 'Gemini 2.5 Flash Lite', profile: 'None', providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio', sourceCardIds: ['card-aa-gemini-2-5-flash-lite', 'card-openrouter-google-gemini-2-5-flash-lite'] }),

  // Foreign Models — remaining providers
  orcPreset({ key: 'data-md.grok-4-5.high', productLineId: 'grok_45', modelName: 'Grok 4.5', profile: 'High', providerName: 'xAI', upstreamApi: 'xAI API', sourceCardIds: ['card-aa-grok-4-5', 'card-openrouter-x-ai-grok-4-5'] }),
  orcPreset({ key: 'data-md.muse-spark-1-1.high', productLineId: 'muse_spark_11', modelName: 'Muse Spark 1.1', profile: 'High', providerName: 'Meta', upstreamApi: 'Meta API', sourceCardIds: ['card-openrouter-meta-muse-spark-1-1'] }),
  orcPreset({ key: 'data-md.mistral-medium-3-5.max', productLineId: 'mistral_medium_35', modelName: 'Mistral Medium 3.5', profile: 'Max', providerName: 'Mistral', upstreamApi: 'Mistral API' }),

  // Open-source Models
  definePreset({
    key: 'data-md.gemma-4-31b.high.orc-byok',
    productLineId: 'gemma_4_31b',
    identity: {
      model: { name: 'Gemma 4 31B', profile: 'High' },
      harness: normalChat('OpenRouter Chatroom (ORC · BYOK)'),
      provider: { name: 'Google AI Studio', upstream: 'Gemini API / Google AI Studio（BYOK，经由 ORC）' },
    },
    origin: 'data-md',
    access: 'api',
    sourceCardIds: ['card-openrouter-google-gemma-4-31b-it'],
    sourceCardLinks: [lowerProfileFallback('card-aa-gemma-4-31b-non-reasoning', 'Non-reasoning / thinking off', 0, 'High', 3)],
  }),
  definePreset({
    key: 'data-md.gemma-4-26b-a4b.high.orc-byok',
    productLineId: 'gemma_4_26b_a4b',
    identity: {
      model: { name: 'Gemma 4 26B A4B', profile: 'High' },
      harness: normalChat('OpenRouter Chatroom (ORC · BYOK)'),
      provider: { name: 'Google AI Studio', upstream: 'Gemini API / Google AI Studio（BYOK，经由 ORC）' },
    },
    origin: 'data-md',
    access: 'api',
    sourceCardIds: ['card-openrouter-google-gemma-4-26b-a4b-it'],
    sourceCardLinks: [lowerProfileFallback('card-aa-gemma-4-26b-a4b-non-reasoning', 'Non-reasoning / thinking off', 0, 'High', 3)],
  }),
  orcPreset({ key: 'data-md.llama-4-maverick.none.deepinfra', productLineId: 'llama_4_maverick', modelName: 'Llama 4 Maverick', profile: 'None', providerName: 'DeepInfra', upstreamApi: 'DeepInfra API', note: 'Llama 4 在原始配置中为不支持思考的固定档位；此处使用无 effort 变体的同一固定模型来源卡，不作为跨档兜底。', sourceCardIds: ['card-aa-llama-4-maverick', 'card-arena-llama-4-maverick-17b-128e-instruct'] }),
  orcPreset({ key: 'data-md.llama-4-scout.none.deepinfra', productLineId: 'llama_4_scout', modelName: 'Llama 4 Scout', profile: 'None', providerName: 'DeepInfra', upstreamApi: 'DeepInfra API', note: 'Llama 4 在原始配置中为不支持思考的固定档位；此处使用无 effort 变体的同一固定模型来源卡，不作为跨档兜底。', sourceCardIds: ['card-aa-llama-4-scout', 'card-arena-llama-4-scout-17b-16e-instruct'] }),
  orcPreset({ key: 'data-md.llama-4-scout.none.vertex', productLineId: 'llama_4_scout', modelName: 'Llama 4 Scout', profile: 'None', providerName: 'Google Vertex', upstreamApi: 'Vertex AI API', note: 'Llama 4 在原始配置中为不支持思考的固定档位；此处使用无 effort 变体的同一固定模型来源卡，不作为跨档兜底。', sourceCardIds: ['card-aa-llama-4-scout', 'card-arena-llama-4-scout-17b-16e-instruct'] }),
  orcPreset({ key: 'data-md.llama-4-scout.none.novitaai', productLineId: 'llama_4_scout', modelName: 'Llama 4 Scout', profile: 'None', providerName: 'NovitaAI', upstreamApi: 'NovitaAI API', note: 'Llama 4 在原始配置中为不支持思考的固定档位；此处使用无 effort 变体的同一固定模型来源卡，不作为跨档兜底。', sourceCardIds: ['card-aa-llama-4-scout', 'card-arena-llama-4-scout-17b-16e-instruct'] }),
  orcPreset({ key: 'data-md.qwen-3-6-27b.max.alibaba', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B', profile: 'Max', providerName: 'Alibaba', upstreamApi: 'Alibaba Qwen API', sourceCardIds: ['card-openrouter-qwen-qwen3-6-27b'], sourceCardLinks: [lowerProfileFallback('card-aa-qwen3-6-27b-non-reasoning', 'Non-reasoning / thinking off', 0, 'Max', 5)] }),
  orcPreset({ key: 'data-md.qwen-3-6-27b.max.phala', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B', profile: 'Max', providerName: 'Phala', upstreamApi: 'Phala API', sourceCardLinks: [lowerProfileFallback('card-aa-qwen3-6-27b-non-reasoning', 'Non-reasoning / thinking off', 0, 'Max', 5)] }),
  orcPreset({ key: 'data-md.qwen-3-6-27b.max.chutes', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B', profile: 'Max', providerName: 'Chutes', upstreamApi: 'Chutes API', sourceCardLinks: [lowerProfileFallback('card-aa-qwen3-6-27b-non-reasoning', 'Non-reasoning / thinking off', 0, 'Max', 5)] }),
  orcPreset({ key: 'data-md.qwen-3-6-35b-a3b.max.atlascloud', productLineId: 'qwen_36_35b_a3b', modelName: 'Qwen3.6 35B A3B', profile: 'Max', providerName: 'AtlasCloud', upstreamApi: 'AtlasCloud API', sourceCardLinks: [lowerProfileFallback('card-aa-qwen3-6-35b-a3b-non-reasoning', 'Non-reasoning / thinking off', 0, 'Max', 5)] }),
  orcPreset({ key: 'data-md.gpt-oss-120b.medium.dekallm', productLineId: 'gpt_oss_120b', modelName: 'GPT-OSS-120B', profile: 'Medium', providerName: 'DekaLLM', upstreamApi: 'DekaLLM API', sourceCardLinks: [lowerProfileFallback('card-aa-gpt-oss-120b-low', 'Low', 1, 'Medium', 2)] }),
  orcPreset({ key: 'data-md.gpt-oss-20b.medium.darkbloom', productLineId: 'gpt_oss_20b', modelName: 'GPT-OSS-20B', profile: 'Medium', providerName: 'Darkbloom', upstreamApi: 'Darkbloom API', sourceCardLinks: [lowerProfileFallback('card-aa-gpt-oss-20b-low', 'Low', 1, 'Medium', 2)] }),
  orcPreset({ key: 'data-md.nemotron-3-ultra.max', productLineId: 'nemotron_3_ultra', modelName: 'Nemotron 3 Ultra', profile: 'Max', providerName: 'NVIDIA', upstreamApi: 'NVIDIA API', sourceCardIds: ['card-openrouter-nvidia-nemotron-3-ultra-550b-a55b'] }),
  orcPreset({ key: 'data-md.nemotron-3-super.max', productLineId: 'nemotron_3_super', modelName: 'Nemotron 3 Super', profile: 'Max', providerName: 'NVIDIA', upstreamApi: 'NVIDIA API', sourceCardIds: ['card-openrouter-nvidia-nemotron-3-super-120b-a12b'] }),
  orcPreset({ key: 'data-md.nemotron-3-nano.max', productLineId: 'nemotron_3_nano', modelName: 'Nemotron 3 Nano', profile: 'Max', providerName: 'NVIDIA', upstreamApi: 'NVIDIA API', sourceCardIds: ['card-openrouter-nvidia-nemotron-3-nano-30b-a3b'], sourceCardLinks: [lowerProfileFallback('card-aa-nvidia-nemotron-3-nano-30b-a3b', 'Non-reasoning / thinking off', 0, 'Max', 5)] }),
];

/** Existing Data.md rows whose written profile maps to an explicit source tier. */
const DATA_MD_PROFILE_BINDINGS: Readonly<Record<string, string>> = {
  'builtin.data-md.hy3.max': 'max',
  'builtin.data-md.deepseek-v4-flash.max': 'max',
  'builtin.data-md.deepseek-v4-pro.max': 'max',
  'builtin.data-md.glm-5-2.max': 'max',
  'builtin.data-md.gpt-5-6-sol.max': 'max',
  'builtin.data-md.gpt-5-6-sol.none': 'none',
  'builtin.data-md.gpt-5-6-terra.max': 'max',
  'builtin.data-md.gpt-5-6-luna.max': 'max',
  'builtin.data-md.gpt-5-5.max': 'max',
  'builtin.data-md.claude-fable-5.max.vertex': 'max',
  'builtin.data-md.claude-fable-5.minimal.vertex': 'minimal',
  'builtin.data-md.claude-opus-4-8.max.vertex': 'max',
  'builtin.data-md.claude-opus-4-8.none.vertex': 'none',
  'builtin.data-md.claude-opus-4-7.none.vertex': 'none',
  'builtin.data-md.claude-opus-4-6.none.vertex': 'none',
  'builtin.data-md.claude-opus-4-5.none.vertex': 'none',
  'builtin.data-md.claude-sonnet-5.max.vertex': 'max',
  'builtin.data-md.claude-haiku-4-5.max.vertex': 'max',
  'builtin.data-md.gemini-3-1-pro-preview.high.ai-studio': 'high',
  'builtin.data-md.gemini-3-6-flash.high.ai-studio': 'high',
  'builtin.data-md.gemini-3-5-flash.high.ai-studio': 'high',
  'builtin.data-md.gemini-3-5-flash-lite.high.ai-studio': 'high',
  'builtin.data-md.gemini-3-1-flash-lite.high.ai-studio': 'high',
  'builtin.data-md.gemini-2-5-flash-lite.none.ai-studio': 'none',
  'builtin.data-md.grok-4-5.high': 'high',
  'builtin.data-md.muse-spark-1-1.high': 'high',
  'builtin.data-md.mistral-medium-3-5.max': 'max',
  'builtin.data-md.gemma-4-31b.high.orc-byok': 'high',
  'builtin.data-md.gemma-4-26b-a4b.high.orc-byok': 'high',
  'builtin.data-md.qwen-3-6-27b.max.alibaba': 'max',
  'builtin.data-md.qwen-3-6-27b.max.phala': 'max',
  'builtin.data-md.qwen-3-6-27b.max.chutes': 'max',
  'builtin.data-md.qwen-3-6-35b-a3b.max.atlascloud': 'max',
  'builtin.data-md.gpt-oss-120b.medium.dekallm': 'medium',
  'builtin.data-md.gpt-oss-20b.medium.darkbloom': 'medium',
  'builtin.data-md.nemotron-3-ultra.max': 'max',
  'builtin.data-md.nemotron-3-super.max': 'max',
  'builtin.data-md.nemotron-3-nano.max': 'max',
  'builtin.data-md.step-3-7-flash.max': 'max',
};

/**
 * These cards describe the same fixed source model but do not expose an
 * effort label. They can enrich the original Data.md configuration only;
 * they never generate an invented tier or a lower-profile fallback.
 */
const DATA_MD_EXACT_CARD_ADDITIONS: Readonly<Record<string, readonly string[]>> = {
  'builtin.data-md.claude-fable-5.max.vertex': [
    'card-arena-claude-fable-5',
    'card-openrouter-anthropic-claude-fable-5',
  ],
  'builtin.data-md.kimi-k2-6.max': ['card-arena-kimi-k2-6'],
  'builtin.data-md.minimax-m3.max': ['card-aa-minimax-m3', 'card-arena-minimax-m3'],
  'builtin.data-md.qwen-3-7-max.max': ['card-aa-qwen3-7-max', 'card-arena-qwen3-7-max'],
  'builtin.data-md.qwen-3-7-plus.max': ['card-aa-qwen3-7-plus', 'card-arena-qwen3-7-plus'],
  'builtin.data-md.longcat-2-0.max': [
    'card-recovered-aa-longcat-2-0',
    'card-openrouter-meituan-longcat-2-0',
  ],
  'builtin.data-md.kat-coder-pro-v2-5.max': ['card-openrouter-kwaipilot-kat-coder-pro-v2-5'],
  'builtin.data-md.mimo-v2-5-pro.normal-chat-inferred': [
    'card-aa-mimo-v2-5-pro',
    'card-arena-mimo-v2-5-pro',
    'card-openrouter-xiaomi-mimo-v2-5-pro',
  ],
  'builtin.data-md.gpt-oss-120b.medium.dekallm': ['card-arena-gpt-oss-120b'],
  'builtin.data-md.gpt-oss-20b.medium.darkbloom': ['card-arena-gpt-oss-20b'],
};

/**
 * Keep existing Data.md identities and manually reviewed links, then append
 * only explicit source evidence. For a tiered model, source-profile fallbacks
 * are ordered nearest-lower-first before any legacy fallback declarations.
 */
function enrichDataMdPreset(preset: BuiltInConfigurationPreset): BuiltInConfigurationPreset {
  const profileKey = DATA_MD_PROFILE_BINDINGS[preset.id];
  const sourceCardAdditions = DATA_MD_EXACT_CARD_ADDITIONS[preset.id];
  if (!profileKey && !sourceCardAdditions) return preset;

  const targetProfile = preset.identity.model.profile;
  const profilePlan = profileKey
    ? planApiProfileCards(preset.productLineId, profileKey, targetProfile)
    : null;
  if (profileKey && !profilePlan) {
    throw new Error(`Missing profile plan for shipped preset ${preset.id}.`);
  }

  const sourceCardIds = uniqueCardIds(
    preset.sourceCardIds,
    profilePlan?.exactCardIds,
    sourceCardAdditions,
  );
  const fallbackLinks = profileKey
    ? profileFallbackLinks(preset.productLineId, profileKey, targetProfile)
    : [];
  const sourceCardLinks = dedupeSourceLinks([
    ...fallbackLinks,
    ...(preset.sourceCardLinks || []),
  ]).filter((link) => !sourceCardIds.includes(link.cardId));

  return {
    ...preset,
    ...(sourceCardIds.length > 0 ? { sourceCardIds } : {}),
    ...(sourceCardLinks.length > 0 ? { sourceCardLinks } : {}),
  };
}

/**
 * Source-backed middle tiers inferred from the product's published API
 * profiles, not from string similarity. All are ordinary API configurations;
 * managed, IDE, Fast, Pro, and custom-tool routes stay separate unless their
 * own source record is explicitly declared below. Arena Search/Grounding
 * benchmark rows are already normalized into their underlying model cards.
 */
const API_PROFILE_EXPANSION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-5-6-sol', productLineId: 'gpt_56_sol', modelName: 'GPT-5.6 Sol',
    profileKeys: ['low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sharedExactCardIds: ['card-openrouter-openai-gpt-5-6-sol'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-5-6-terra', productLineId: 'gpt_56_terra', modelName: 'GPT-5.6 Terra',
    profileKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sharedExactCardIds: ['card-openrouter-openai-gpt-5-6-terra'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-5-6-luna', productLineId: 'gpt_56_luna', modelName: 'GPT-5.6 Luna',
    profileKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sharedExactCardIds: ['card-openrouter-openai-gpt-5-6-luna'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-5-5', productLineId: 'gpt_55', modelName: 'GPT-5.5',
    profileKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sharedExactCardIds: ['card-openrouter-openai-gpt-5-5'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.deepseek-v4-flash', productLineId: 'deepseek_v4_flash', modelName: 'DeepSeek-v4-Flash Preview',
    profileKeys: ['none', 'high', 'xhigh'], providerName: 'DeepSeek', upstreamApi: 'DeepSeek API',
    sharedExactCardIds: ['card-openrouter-deepseek-deepseek-v4-flash'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.deepseek-v4-pro', productLineId: 'deepseek_v4_pro', modelName: 'DeepSeek-v4-Pro Preview',
    profileKeys: ['none', 'high', 'xhigh'], providerName: 'DeepSeek', upstreamApi: 'DeepSeek API',
    sharedExactCardIds: ['card-openrouter-deepseek-deepseek-v4-pro'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.glm-5-2', productLineId: 'glm_52', modelName: 'GLM-5.2',
    profileKeys: ['none', 'high', 'xhigh'], providerName: 'Z.ai', upstreamApi: 'Z.ai API',
    sharedExactCardIds: ['card-openrouter-z-ai-glm-5-2'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.hy3', productLineId: 'hunyuan_hy3', modelName: 'Hy3',
    profileKeys: ['none', 'low', 'high'], providerName: 'GMICloud', upstreamApi: 'GMICloud API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.kimi-k3', productLineId: 'kimi_k3', modelName: 'Kimi K3',
    profileKeys: ['low', 'high', 'max'], providerName: 'Moonshot AI', upstreamApi: 'Moonshot API',
    sharedExactCardIds: ['card-openrouter-moonshotai-kimi-k3'],
    note: '由 Data.md 的 Kimi K3 家族外推的普通 API 路线；与 Kimi Code CLI Agent 保持为独立配置。',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-fable-5', keySuffix: '.vertex', productLineId: 'claude_fable_5', modelName: 'Claude Fable 5',
    profileKeys: ['low', 'medium', 'high', 'xhigh'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-opus-4-5', keySuffix: '.vertex', productLineId: 'claude_opus_45', modelName: 'Claude Opus 4.5',
    profileKeys: ['reasoning'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-opus-4-6', keySuffix: '.vertex', productLineId: 'claude_opus_46', modelName: 'Claude Opus 4.6',
    profileKeys: ['low', 'medium', 'high', 'max'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-opus-4-7', keySuffix: '.vertex', productLineId: 'claude_opus_47', modelName: 'Claude Opus 4.7',
    profileKeys: ['low', 'medium', 'high', 'xhigh', 'max'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-opus-4-8', keySuffix: '.vertex', productLineId: 'claude_opus_48', modelName: 'Claude Opus 4.8',
    profileKeys: ['low', 'medium', 'high', 'xhigh'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-haiku-4-5', keySuffix: '.vertex', productLineId: 'claude_haiku_45', modelName: 'Claude Haiku 4.5',
    profileKeys: ['none', 'reasoning'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.claude-sonnet-5', keySuffix: '.vertex', productLineId: 'claude_sonnet_5', modelName: 'Claude Sonnet 5',
    profileKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'Google Vertex', upstreamApi: 'Vertex AI API（Claude on Vertex）',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-3-5-flash', keySuffix: '.ai-studio', productLineId: 'gemini_35_flash', modelName: 'Gemini 3.5 Flash',
    profileKeys: ['minimal', 'low', 'medium'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-5-flash'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-3-1-pro-preview', keySuffix: '.ai-studio', productLineId: 'gemini_31_pro', modelName: 'Gemini 3.1 Pro Preview',
    profileKeys: ['low', 'medium'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-1-pro-preview'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-3-5-flash-lite', keySuffix: '.ai-studio', productLineId: 'gemini_35_flash_lite', modelName: 'Gemini 3.5 Flash-Lite',
    profileKeys: ['minimal', 'low', 'medium'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-5-flash-lite'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-3-6-flash', keySuffix: '.ai-studio', productLineId: 'gemini_36_flash', modelName: 'Gemini 3.6 Flash',
    profileKeys: ['minimal', 'low', 'medium'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-6-flash'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-3-1-flash-lite', keySuffix: '.ai-studio', productLineId: 'gemini_31_flash_lite', modelName: 'Gemini 3.1 Flash Lite',
    profileKeys: ['minimal', 'low', 'medium'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-1-flash-lite'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemini-2-5-flash-lite', keySuffix: '.ai-studio', productLineId: 'gemini_25_flash_lite', modelName: 'Gemini 2.5 Flash Lite',
    profileKeys: ['reasoning'], providerName: 'Google AI Studio', upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-2-5-flash-lite'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemma-4-31b', keySuffix: '.orc-byok', productLineId: 'gemma_4_31b', modelName: 'Gemma 4 31B',
    profileKeys: ['none', 'reasoning'], sharedExactCardIds: ['card-openrouter-google-gemma-4-31b-it'],
    identityForProfile: (profile) => ({
      model: { name: 'Gemma 4 31B', profile },
      harness: normalChat('OpenRouter Chatroom (ORC · BYOK)'),
      provider: { name: 'Google AI Studio', upstream: 'Gemini API / Google AI Studio（BYOK，经由 ORC）' },
    }),
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gemma-4-26b-a4b', keySuffix: '.orc-byok', productLineId: 'gemma_4_26b_a4b', modelName: 'Gemma 4 26B A4B',
    profileKeys: ['none', 'reasoning'], sharedExactCardIds: ['card-openrouter-google-gemma-4-26b-a4b-it'],
    identityForProfile: (profile) => ({
      model: { name: 'Gemma 4 26B A4B', profile },
      harness: normalChat('OpenRouter Chatroom (ORC · BYOK)'),
      provider: { name: 'Google AI Studio', upstream: 'Gemini API / Google AI Studio（BYOK，经由 ORC）' },
    }),
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.qwen-3-6-27b', keySuffix: '.alibaba', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B',
    profileKeys: ['none', 'reasoning'], providerName: 'Alibaba', upstreamApi: 'Alibaba Qwen API',
    sharedExactCardIds: ['card-openrouter-qwen-qwen3-6-27b'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.qwen-3-6-27b', keySuffix: '.phala', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B',
    profileKeys: ['none', 'reasoning'], providerName: 'Phala', upstreamApi: 'Phala API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.qwen-3-6-27b', keySuffix: '.chutes', productLineId: 'qwen_36_27b', modelName: 'Qwen3.6 27B',
    profileKeys: ['none', 'reasoning'], providerName: 'Chutes', upstreamApi: 'Chutes API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.qwen-3-6-35b-a3b', keySuffix: '.atlascloud', productLineId: 'qwen_36_35b_a3b', modelName: 'Qwen3.6 35B A3B',
    profileKeys: ['none', 'reasoning'], providerName: 'AtlasCloud', upstreamApi: 'AtlasCloud API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-oss-120b', keySuffix: '.dekallm', productLineId: 'gpt_oss_120b', modelName: 'GPT-OSS-120B',
    profileKeys: ['low', 'high'], providerName: 'DekaLLM', upstreamApi: 'DekaLLM API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.gpt-oss-20b', keySuffix: '.darkbloom', productLineId: 'gpt_oss_20b', modelName: 'GPT-OSS-20B',
    profileKeys: ['low', 'high'], providerName: 'Darkbloom', upstreamApi: 'Darkbloom API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.grok-4-5', productLineId: 'grok_45', modelName: 'Grok 4.5',
    profileKeys: ['low', 'medium'], providerName: 'xAI', upstreamApi: 'xAI API',
    sharedExactCardIds: ['card-openrouter-x-ai-grok-4-5'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.muse-spark-1-1', productLineId: 'muse_spark_11', modelName: 'Muse Spark 1.1',
    profileKeys: ['minimal', 'low', 'medium', 'xhigh'], providerName: 'Meta', upstreamApi: 'Meta API',
    sharedExactCardIds: ['card-openrouter-meta-muse-spark-1-1'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.mistral-medium-3-5', productLineId: 'mistral_medium_35', modelName: 'Mistral Medium 3.5',
    profileKeys: ['none', 'high'], providerName: 'Mistral', upstreamApi: 'Mistral API',
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.step-3-7-flash', productLineId: 'step_37_flash', modelName: 'Step 3.7 Flash',
    profileKeys: ['low', 'medium', 'high'], providerName: 'StepFun', upstreamApi: 'StepFun API',
    sharedExactCardIds: ['card-openrouter-stepfun-step-3-7-flash'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.nemotron-3-ultra', productLineId: 'nemotron_3_ultra', modelName: 'Nemotron 3 Ultra',
    profileKeys: ['medium', 'high'], providerName: 'NVIDIA', upstreamApi: 'NVIDIA API',
    sharedExactCardIds: ['card-openrouter-nvidia-nemotron-3-ultra-550b-a55b'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.nemotron-3-super', productLineId: 'nemotron_3_super', modelName: 'Nemotron 3 Super',
    profileKeys: ['low', 'medium'], providerName: 'NVIDIA', upstreamApi: 'NVIDIA API',
    sharedExactCardIds: ['card-openrouter-nvidia-nemotron-3-super-120b-a12b'],
  }),
  ...apiProfilePresets({
    keyPrefix: 'data-md.nemotron-3-nano', productLineId: 'nemotron_3_nano', modelName: 'Nemotron 3 Nano',
    profileKeys: ['none', 'reasoning'], providerName: 'NVIDIA', upstreamApi: 'NVIDIA API',
    sharedExactCardIds: ['card-openrouter-nvidia-nemotron-3-nano-30b-a3b'],
  }),
];

/** Separate API routes with their own exact source records; no route borrows standard-route data. */
const API_ROUTE_EXPANSION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...apiRouteEffortPresets({
    keyPrefix: 'data-md.gpt-5-6-sol.pro', productLineId: 'gpt_56_sol', modelName: 'GPT-5.6 Sol',
    effortKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API（Pro route）',
    routeName: 'Pro', sourceCardIds: ['card-openrouter-openai-gpt-5-6-sol-pro'],
    note: 'Pro 路线的 API 可用档位由官方目录披露；来源卡只提供该路线价格，未借用标准路线能力结果。',
  }),
  ...apiRouteEffortPresets({
    keyPrefix: 'data-md.gpt-5-6-terra.pro', productLineId: 'gpt_56_terra', modelName: 'GPT-5.6 Terra',
    effortKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API（Pro route）',
    routeName: 'Pro', sourceCardIds: ['card-openrouter-openai-gpt-5-6-terra-pro'],
    note: 'Pro 路线的 API 可用档位由官方目录披露；来源卡只提供该路线价格，未借用标准路线能力结果。',
  }),
  ...apiRouteEffortPresets({
    keyPrefix: 'data-md.gpt-5-6-luna.pro', productLineId: 'gpt_56_luna', modelName: 'GPT-5.6 Luna',
    effortKeys: ['none', 'low', 'medium', 'high', 'xhigh'], providerName: 'OpenAI', upstreamApi: 'OpenAI API（Pro route）',
    routeName: 'Pro', sourceCardIds: ['card-openrouter-openai-gpt-5-6-luna-pro'],
    note: 'Pro 路线的 API 可用档位由官方目录披露；来源卡只提供该路线价格，未借用标准路线能力结果。',
  }),
  ...apiRouteEffortPresets({
    keyPrefix: 'data-md.gpt-5-5.pro', productLineId: 'gpt_55', modelName: 'GPT-5.5',
    effortKeys: ['medium', 'high'], providerName: 'OpenAI', upstreamApi: 'OpenAI API（Pro route）',
    routeName: 'Pro', sourceCardIds: ['card-openrouter-openai-gpt-5-5-pro'],
    note: 'Pro 路线只公布 Medium、High、XHigh；此处不以 XHigh 数据向下填充 Medium 或 High。',
  }),
  orcPreset({
    key: 'data-md.gpt-5-5.pro-xhigh', productLineId: 'gpt_55', modelName: 'GPT-5.5',
    profile: 'mode = Pro, effort = XHigh', providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sourceCardIds: ['card-aa-gpt-5-5-pro', 'card-openrouter-openai-gpt-5-5-pro'],
    note: 'Pro 是独立 API 路线；只使用其自身发布的 XHigh 能力/价格记录。',
  }),
  orcPreset({
    key: 'data-md.gpt-5-5.instant', productLineId: 'gpt_55', modelName: 'GPT-5.5',
    profile: 'Instant', providerName: 'OpenAI', upstreamApi: 'OpenAI API',
    sourceCardIds: ['card-aa-gpt-5-5-instant-06-26', 'card-arena-gpt-5-5-instant'],
    note: 'Instant 是独立低延迟路线；未借用标准 API 的价格或能力数据。',
  }),
];

const DATA_MD_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...DATA_MD_CONFIGURATION_PRESETS_RAW.map(enrichDataMdPreset),
  ...API_PROFILE_EXPANSION_PRESETS,
  ...API_ROUTE_EXPANSION_PRESETS,
];

/**
 * Muse Spark 1.2 is a newly source-backed Meta API model rather than a Data.md
 * row. OpenRouter publishes five supported reasoning efforts; Artificial
 * Analysis currently provides independent capability evidence for XHigh only.
 */
const MUSE_SPARK_1_2_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] =
  apiProfilePresets({
    keyPrefix: 'muse-spark-1-2',
    productLineId: 'muse_spark_12',
    modelName: 'Muse Spark 1.2',
    profileKeys: ['minimal', 'low', 'medium', 'high', 'xhigh'],
    providerName: 'Meta',
    upstreamApi: 'Meta API',
    sharedExactCardIds: ['card-openrouter-meta-muse-spark-1-2'],
    origin: 'source-backed',
    note: 'OpenRouter 官方目录确认 Minimal、Low、Medium、High、XHigh；当前只有 Artificial Analysis 的 XHigh 具备正式能力观测，其他档位不借用高档数据。',
  });

/**
 * Source-backed August 2026 releases. Each model keeps its published effort
 * profiles and exact source cards; price/speed cards are shared only inside
 * the same independently scoped product line.
 */
const AUGUST_2026_RELEASE_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...apiProfilePresets({
    keyPrefix: 'grok-4-6',
    productLineId: 'grok_46',
    modelName: 'Grok 4.6',
    profileKeys: ['low', 'medium', 'high', 'xhigh'],
    providerName: 'xAI',
    upstreamApi: 'xAI API',
    sharedExactCardIds: ['card-openrouter-x-ai-grok-4-6'],
    origin: 'source-backed',
    note: 'OpenRouter 发布 Low、Medium、High、XHigh；AA 与 Arena 当前只提供 High 能力观测，XHigh 仅按 High→XHigh 单向补缺。',
  }),
  ...apiProfilePresets({
    keyPrefix: 'muse-glimmer',
    productLineId: 'muse_glimmer',
    modelName: 'Muse Glimmer',
    profileKeys: ['low', 'medium', 'high', 'xhigh'],
    providerName: 'Meta',
    upstreamApi: 'Meta API',
    sharedExactCardIds: ['card-openrouter-meta-muse-glimmer-30b'],
    origin: 'source-backed',
    note: 'OpenRouter 发布 Low、Medium、High、XHigh 且默认 Medium；Arena 无后缀记录归默认 Medium，AA 的 High 保持独立，禁止向低档反向回填。',
  }),
  ...apiProfilePresets({
    keyPrefix: 'gemini-3-7-flash',
    productLineId: 'gemini_37_flash',
    modelName: 'Gemini 3.7 Flash',
    profileKeys: ['low', 'medium', 'high'],
    providerName: 'Google AI Studio',
    upstreamApi: 'Gemini API / Google AI Studio',
    sharedExactCardIds: ['card-openrouter-google-gemini-3-7-flash'],
    origin: 'source-backed',
    note: 'Low、Medium、High 均使用各自 AA 能力卡；Arena 的明确 High 行只连接 High，不跨档复制。',
  }),
  ...apiProfilePresets({
    keyPrefix: 'deepseek-v4-pro-0813',
    productLineId: 'deepseek_v4_pro_0813',
    modelName: 'DeepSeek V4 Pro 0813',
    profileKeys: ['low', 'high', 'max'],
    providerName: 'DeepSeek',
    upstreamApi: 'DeepSeek API',
    sharedExactCardIds: ['card-openrouter-deepseek-deepseek-v4-pro-0813'],
    origin: 'source-backed',
    note: '0813 是独立产品线；只使用带 0813/20260813 身份的 AA、Arena 与 OpenRouter 记录，绝不连接 0424 Preview 卡。',
  }),
];

/**
 * Claude Opus 5 is one API model with source-published effort profiles.
 * These are separate model-side configurations; High is the normal/standard
 * API profile, and Fast is a distinct low-latency route rather than a copied
 * benchmark result.
 */
const CLAUDE_OPUS_5_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...([
    ['Low', ['card-aa-claude-opus-5-low', 'card-openrouter-anthropic-claude-opus-5']],
    ['Medium', ['card-aa-claude-opus-5-medium', 'card-openrouter-anthropic-claude-opus-5']],
    ['High', ['card-aa-claude-opus-5-high', 'card-arena-claude-opus-5-high', 'card-openrouter-anthropic-claude-opus-5']],
    ['XHigh', ['card-aa-claude-opus-5-xhigh', 'card-openrouter-anthropic-claude-opus-5']],
    ['Max', ['card-aa-claude-opus-5', 'card-openrouter-anthropic-claude-opus-5']],
  ] as const).map(([profile, sourceCardIds]) => definePreset({
    key: `opus-5.${profile.toLowerCase()}`,
    productLineId: 'claude_opus_5',
    identity: {
      model: { name: 'Claude Opus 5', profile },
      harness: normalChat('API normal chat'),
      provider: { name: 'Anthropic', upstream: 'Anthropic Messages API' },
    },
    origin: 'opus-5-source-backed',
    access: 'api',
    sourceCardIds,
    sourceCardLinks: profile === 'XHigh'
      ? [lowerProfileFallback('card-arena-claude-opus-5-high', 'High', 3, 'XHigh', 4)]
      : profile === 'Max'
        ? [lowerProfileFallback('card-arena-claude-opus-5-high', 'High', 3, 'Max', 5)]
        : undefined,
  })),
  definePreset({
    key: 'opus-5.fast',
    productLineId: 'claude_opus_5',
    identity: {
      model: { name: 'Claude Opus 5', profile: 'High（默认 effort）', preset: 'Fast' },
      harness: normalChat('API normal chat · Fast route'),
      provider: { name: 'Anthropic', upstream: 'Anthropic Messages API（Fast route）' },
    },
    origin: 'opus-5-source-backed',
    access: 'api',
    note: 'Fast 是独立服务路由；未将任何标准路由能力数据复制给它。',
    sourceCardIds: ['card-openrouter-anthropic-claude-opus-5-fast'],
  }),
  ...(['Low', 'Medium', 'XHigh', 'Max'] as const).map((profile) => definePreset({
    key: `opus-5.fast-${profile.toLowerCase()}`,
    productLineId: 'claude_opus_5',
    identity: {
      model: { name: 'Claude Opus 5', profile, preset: 'Fast' },
      harness: normalChat('API normal chat · Fast route'),
      provider: { name: 'Anthropic', upstream: 'Anthropic Messages API（Fast route）' },
    },
    origin: 'opus-5-source-backed',
    access: 'api',
    note: 'Fast 路线已公布此 effort；来源卡只提供 Fast 路线价格，不复用标准路线能力结果。',
    sourceCardIds: ['card-openrouter-anthropic-claude-opus-5-fast'],
  })),
];

/**
 * Source-published coding-agent executions. Each row is a distinct
 * model+harness configuration. Exact harness cards stay above explicitly
 * declared Chat fallbacks in the stack.
 */
const HARNESS_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  harnessPreset({
    key: 'agent.arena.deepseek-v4-flash.max',
    productLineId: 'deepseek_v4_flash',
    modelName: 'DeepSeek-v4-Flash Preview',
    profile: 'Max',
    harness: 'AA Agent Harness',
    providerName: 'DeepSeek',
    upstreamApi: 'DeepSeek API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      'card-aa-deepseek-v4-flash-0420',
      'card-arena-deepseek-v4-flash-high-preview',
      'card-openrouter-deepseek-deepseek-v4-flash',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileFallback(
        productionAgentModeCardId('card-arena-deepseek-v4-flash'),
        'None',
        0,
        'Max',
        5,
      ),
    ],
    environment: 'Arena Agent Mode',
    fallbackPolicyNote: 'Arena 已发布的 None Agent 数据只向 Max Agent 单向补缺；Max 的 Chat/AA 数据再按 Chat→Agent 单向补齐其余领域。',
    note: '保留最高可用 Max 配置，不再让数据更少的 None Agent 代表整个模型。',
  }),
  arenaAgentModePreset({
    key: 'agent.arena.deepseek-v4-flash.none',
    productLineId: 'deepseek_v4_flash',
    modelName: 'DeepSeek-v4-Flash Preview',
    profile: 'None',
    providerName: 'DeepSeek',
    upstreamApi: 'DeepSeek API',
    arenaBaseCardId: 'card-arena-deepseek-v4-flash',
    chatFallbackCardIds: [
      'card-aa-deepseek-v4-flash-non-reasoning',
      'card-arena-deepseek-v4-flash',
      'card-openrouter-deepseek-deepseek-v4-flash',
    ],
    note: 'Arena 的 Agent 行对应无 thinking 标签的已发布配置，因此保留为 None，不冒充 Max。',
  }),
  arenaAgentModePreset({
    key: 'agent.arena.hy3.high',
    productLineId: 'hunyuan_hy3',
    modelName: 'Hy3',
    profile: 'High',
    providerName: 'Tencent',
    upstreamApi: 'Tencent API',
    arenaBaseCardId: 'card-arena-hy3',
    chatFallbackCardIds: [
      'card-aa-hy3',
      'card-arena-hy3',
      'card-openrouter-tencent-hy3',
    ],
  }),
  arenaAgentModePreset({
    key: 'agent.arena.minimax-m3.max',
    productLineId: 'minimax_m3',
    modelName: 'MiniMax M3',
    profile: 'Max',
    providerName: 'MiniMax',
    upstreamApi: 'MiniMax API',
    arenaBaseCardId: 'card-arena-minimax-m3',
    chatFallbackCardIds: [
      'card-aa-minimax-m3',
      'card-arena-minimax-m3',
      'card-openrouter-minimax-minimax-m3',
    ],
  }),
  arenaAgentModePreset({
    key: 'agent.arena.claude-sonnet-5.high',
    productLineId: 'claude_sonnet_5',
    modelName: 'Claude Sonnet 5',
    profile: 'High',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    arenaBaseCardId: 'card-arena-claude-sonnet-5-high',
    chatFallbackCardIds: [
      'card-aa-claude-sonnet-5-high',
      'card-arena-claude-sonnet-5-high',
      'card-openrouter-anthropic-claude-sonnet-5',
    ],
  }),
  harnessPreset({
    key: 'agent.arena.claude-sonnet-5.max',
    productLineId: 'claude_sonnet_5',
    modelName: 'Claude Sonnet 5',
    profile: 'Max',
    harness: 'AA Agent Harness',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      'card-aa-claude-sonnet-5',
      'card-openrouter-anthropic-claude-sonnet-5',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileFallback(
        productionAgentModeCardId('card-arena-claude-sonnet-5-high'),
        'High',
        4,
        'Max',
        5,
      ),
      lowerProfileHarnessFallback(
        'card-arena-claude-sonnet-5-high',
        'High',
        4,
        'Max',
        5,
        'AA Agent Harness',
      ),
      lowerProfileFallback(
        'card-arena-claude-sonnet-5',
        'Default',
        0,
        'Max',
        5,
      ),
    ],
    environment: 'Arena Agent Mode',
    fallbackPolicyNote: 'High 的 Arena Agent 与对话数据只向 Max Agent 单向补缺；Max 的 AA 数据保持最高档，不把 Agent 结果反灌给 Chat。',
    note: '合并同模型已发布的 Max 通用评测与 High Agent 评测，保留一个数据更完整的 Max Agent 配置。',
  }),
  arenaAgentModePreset({
    key: 'agent.arena.gemini-3-5-flash.high',
    productLineId: 'gemini_35_flash',
    modelName: 'Gemini 3.5 Flash',
    profile: 'High',
    providerName: 'Google',
    upstreamApi: 'Gemini API',
    arenaBaseCardId: 'card-arena-gemini-3-5-flash-high',
    chatFallbackCardIds: [
      'card-aa-gemini-3-5-flash',
      'card-arena-gemini-3-5-flash-high',
      'card-openrouter-google-gemini-3-5-flash',
    ],
  }),
  arenaAgentModePreset({
    key: 'agent.arena.qwen-3-7-max.max',
    productLineId: 'qwen_37_max',
    modelName: 'Qwen3.7-Max',
    profile: 'Max',
    providerName: 'Alibaba',
    upstreamApi: 'Alibaba Qwen API',
    arenaBaseCardId: 'card-arena-qwen3-7-max',
    chatFallbackCardIds: [
      'card-aa-qwen3-7-max',
      'card-arena-qwen3-7-max',
      'card-openrouter-qwen-qwen3-7-max',
    ],
    additionalFallbackLinks: [
      lowerProfileHarnessFallback(
        reviewedFamilyCardId('qwen37max-arena-preview'),
        'Preview',
        4,
        'Max',
        5,
        'AA Agent Harness',
      ),
    ],
    note: 'Arena 的文本榜仍保留同家族 Preview 名称；该较早版本只向正式 Max Agent 单向补齐 Chat 数据。',
  }),
  arenaAgentModePreset({
    key: 'agent.arena.nemotron-3-ultra.high',
    productLineId: 'nemotron_3_ultra',
    modelName: 'Nemotron 3 Ultra',
    profile: 'High',
    providerName: 'NVIDIA',
    upstreamApi: 'NVIDIA API',
    arenaBaseCardId: 'card-arena-nemotron-3-ultra',
    chatFallbackCardIds: [
      'card-aa-nvidia-nemotron-3-ultra-550b-a55b',
      'card-arena-nemotron-3-ultra',
      'card-arena-nvidia-nemotron-3-ultra-550b-a55b-nvfp4',
      'card-openrouter-nvidia-nemotron-3-ultra-550b-a55b',
    ],
    note: 'Arena 的 NVFP4 卡是同一 Nemotron 3 Ultra 550B A55B 检查点的量化服务记录；仅借用其普通 Chat 能力观测。',
  }),
  harnessPreset({
    key: 'agent.arena.grok-build-0-1.max',
    productLineId: 'source-profile-grok-build-0-1-0616',
    modelName: 'Grok Build 0.1',
    profile: 'Max',
    harness: 'AA Agent Harness',
    providerName: 'xAI',
    upstreamApi: 'xAI API',
    exactHarnessCardIds: [
      reviewedFamilyAgentModeCardId('grokbuild01-arena'),
    ],
    chatFallbackCardIds: [
      'card-aa-grok-build-0-1-06-16',
      'card-openrouter-x-ai-grok-build-0-1',
    ],
    environment: 'Arena Agent Mode',
    fallbackPolicyNote: 'Arena 只发布了该模型的 Agent 行，因此榜单第二项统一显示 AA Agent Harness；Arena 来源身份仍保留，AA 与 OpenRouter 的模型级数据只向该执行环境单向补缺。',
  }),
  harnessPreset({
    key: 'harness.deepseek-v4-flash-0731.max.codex-cli',
    productLineId: 'deepseek_v4_flash_0731',
    modelName: 'DeepSeek V4 Flash 0731',
    profile: 'Max',
    harness: 'Codex CLI',
    providerName: 'DeepSeek',
    upstreamApi: 'DeepSeek API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-codex-deepseek-v4-flash-0731-max',
    ],
    chatFallbackCardIds: [
      'card-aa-deepseek-v4-flash',
      'card-openrouter-deepseek-deepseek-v4-flash-0731',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileHarnessFallback(
        'card-arena-deepseek-v4-flash-high',
        'High',
        3,
        'Max',
        5,
        'Codex CLI',
      ),
    ],
    note: 'AA Coding Agent 原始行明确使用 Codex；0731 的普通模型数据仅作为 Codex CLI 配置的单向补充。',
  }),
  harnessPreset({
    key: 'harness.gemini-3-7-flash.high.antigravity-sdk',
    productLineId: 'gemini_37_flash',
    modelName: 'Gemini 3.7 Flash',
    profile: 'High',
    harness: 'Antigravity SDK',
    providerName: 'Google AI Studio',
    upstreamApi: 'Gemini API / Google AI Studio',
    exactHarnessCardIds: [
      'card-aa-coding-agent-antigravity-sdk-gemini-3-7-flash-high',
    ],
    chatFallbackCardIds: [
      'card-aa-gemini-3-7-flash',
      'card-arena-gemini-3-7-flash-high',
    ],
    note: 'AA Coding Agent 原始行明确使用 Antigravity SDK；普通 High 模型数据只向该 Harness 配置单向补充。',
  }),
  harnessPreset({
    key: 'harness.gemini-3-7-flash.high.opencode',
    productLineId: 'gemini_37_flash',
    modelName: 'Gemini 3.7 Flash',
    profile: 'High',
    harness: 'OpenCode',
    providerName: 'Google AI Studio',
    upstreamApi: 'Gemini API / Google AI Studio',
    exactHarnessCardIds: [
      'card-aa-coding-agent-opencode-gemini-3-7-flash-high',
    ],
    chatFallbackCardIds: [
      'card-aa-gemini-3-7-flash',
      'card-arena-gemini-3-7-flash-high',
    ],
    note: 'AA Coding Agent 原始行明确使用 Opencode；站内执行名称沿用 OpenCode，普通 High 模型数据只向该 Harness 配置单向补充。',
  }),
  harnessPreset({
    key: 'harness.gemini-3-6-flash.high.opencode',
    productLineId: 'gemini_36_flash',
    modelName: 'Gemini 3.6 Flash',
    profile: 'High',
    harness: 'OpenCode',
    providerName: 'Google',
    upstreamApi: 'Gemini API / Google AI Studio',
    exactHarnessCardIds: [
      'card-aa-coding-agent-opencode-gemini-3-6-flash-high',
    ],
    chatFallbackCardIds: [
      'card-arena-gemini-3-6-flash-high',
      'card-openrouter-google-gemini-3-6-flash',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileHarnessFallback(
        'card-aa-gemini-3-6-flash',
        'Medium',
        2,
        'High',
        3,
        'OpenCode',
      ),
    ],
    note: 'AA Coding Agent 原始行明确使用 Opencode；站内执行名称沿用 OpenCode，其余同产品线数据只向 High Harness 单向补充。',
  }),
  harnessPreset({
    key: 'harness.qwen3-8.max.claude-code',
    productLineId: 'source-profile-qwen3-8-max',
    modelName: 'Qwen3.8',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Alibaba',
    upstreamApi: 'Alibaba Qwen API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-claude-code-qwen3-8-max',
    ],
    chatFallbackCardIds: [
      'card-aa-qwen3-8-max',
      'card-arena-qwen3-8-max',
      'card-openrouter-qwen-qwen3-8-max',
    ],
    note: 'AA Coding Agent 原始行明确使用 Claude Code；普通 Qwen3.8 Max 数据仅向该 Harness 配置单向补充。',
  }),
  harnessPreset({
    key: 'harness.gpt-5-5.xhigh.codex-cli',
    productLineId: 'gpt_55',
    modelName: 'GPT-5.5',
    profile: 'XHigh',
    harness: 'Codex CLI',
    providerName: 'OpenAI',
    upstreamApi: 'OpenAI API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-codex-gpt-5-5-xhigh',
    ],
    chatFallbackCardIds: [
      'card-aa-gpt-5-5',
      'card-arena-gpt-5-5-xhigh',
      'card-openrouter-openai-gpt-5-5',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-gpt-5-5-xhigh'),
        'XHigh',
        'Codex CLI',
      ),
      lowerProfileHarnessFallback(
        'card-arena-gpt-5-5-high',
        'High',
        3,
        'XHigh',
        4,
        'Codex CLI',
      ),
      lowerProfileFallback(
        'card-arena-gpt-5-5',
        'Default',
        0,
        'XHigh',
        4,
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.gemini-3-1-pro.high.gemini-cli',
    productLineId: 'gemini_31_pro',
    modelName: 'Gemini 3.1 Pro',
    profile: 'High',
    harness: 'Gemini CLI',
    providerName: 'Google',
    upstreamApi: 'Gemini API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-gemini-cli-gemini-3-1-pro-high',
    ],
    chatFallbackCardIds: [
      'card-aa-gemini-3-1-pro-preview',
      'card-arena-gemini-3-1-pro-preview',
      'card-openrouter-google-gemini-3-1-pro-preview',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-gemini-3-1-pro-preview'),
        'High',
        'Gemini CLI',
      ),
      lowerProfileFallback(
        'card-arena-gemini-3-1-pro',
        'Default',
        0,
        'High',
        3,
      ),
    ],
    note: 'AA Coding Agent Index 已发布 Gemini CLI 的非 Preview 精确执行；较早的 Preview Chat/Arena 数据只向该生产配置单向补缺。',
  }),
  harnessPreset({
    key: 'harness.gpt-5-4.xhigh.codex-cli',
    productLineId: 'source-profile-gpt-5-4',
    modelName: 'GPT-5.4',
    profile: 'XHigh',
    harness: 'Codex CLI',
    providerName: 'OpenAI',
    upstreamApi: 'OpenAI API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      reviewedFamilyCardId('gpt54-aa-xhigh'),
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        reviewedFamilyAgentModeCardId('gpt54-arena-high'),
        'High',
        3,
        'XHigh',
        4,
        'Codex CLI',
      ),
      lowerProfileHarnessFallback(
        reviewedFamilyCardId('gpt54-arena-high'),
        'High',
        3,
        'XHigh',
        4,
        'Codex CLI',
      ),
      lowerProfileHarnessFallback(
        'card-openrouter-openai-gpt-5-4',
        'High',
        3,
        'XHigh',
        4,
        'Codex CLI',
      ),
      lowerProfileFallback(
        'card-aa-coding-agent-codex-gpt-5-4-medium',
        'Medium',
        2,
        'XHigh',
        4,
      ),
      lowerProfileFallback(
        'card-arena-gpt-5-4',
        'Default',
        0,
        'XHigh',
        4,
      ),
    ],
    fallbackPolicyNote: '榜单保留来源中更高的 XHigh，而不再保留残缺的 High。AA 只发布了 GPT-5.4 Medium 的 Codex 行，因此 Medium Codex 与 High Arena 数据仅按档位/执行层级单向补齐到 XHigh。',
  }),
  harnessPreset({
    key: 'harness.claude-opus-4-7.max.claude-code',
    productLineId: 'claude_opus_47',
    modelName: 'Claude Opus 4.7',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-claude-code-claude-opus-4-7-max',
    ],
    chatFallbackCardIds: [
      'card-aa-claude-opus-4-7',
      'card-openrouter-anthropic-claude-opus-4-7',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-claude-opus-4-7-high'),
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-arena-claude-opus-4-7-high',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileFallback(
        'card-arena-claude-opus-4-7',
        'Default',
        0,
        'Max',
        5,
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.claude-opus-4-6.max.claude-code',
    productLineId: 'claude_opus_46',
    modelName: 'Claude Opus 4.6',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      'card-aa-claude-opus-4-6-adaptive',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-claude-opus-4-6'),
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-arena-claude-opus-4-6',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-openrouter-anthropic-claude-opus-4-6',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileFallback(
        'card-aa-coding-agent-claude-code-claude-opus-4-6-medium',
        'Medium',
        2,
        'Max',
        5,
      ),
    ],
    fallbackPolicyNote: '榜单保留来源中更高的 Max，而不再保留残缺的 High。AA 只发布了 Opus 4.6 Medium 的 Claude Code 行；Medium Harness 与 High Arena/Chat 数据仅单向补齐到 Max。',
  }),
  harnessPreset({
    key: 'harness.claude-sonnet-4-6.max.claude-code',
    productLineId: 'source-profile-claude-sonnet-4-6',
    modelName: 'Claude Sonnet 4.6',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      reviewedFamilyCardId('sonnet46-aa-max'),
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-claude-sonnet-4-6'),
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-arena-claude-sonnet-4-6',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-openrouter-anthropic-claude-sonnet-4-6',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileFallback(
        'card-aa-coding-agent-claude-code-claude-sonnet-4-6-medium',
        'Medium',
        2,
        'Max',
        5,
      ),
    ],
    fallbackPolicyNote: '榜单保留来源中更高的 Max，而不再保留残缺的 High。AA 只发布了 Sonnet 4.6 Medium 的 Claude Code 行；Medium Harness 与 High Arena/Chat 数据仅单向补齐到 Max。',
  }),
  harnessPreset({
    key: 'harness.kimi-k2-6.max.claude-code',
    productLineId: 'kimi_k26',
    modelName: 'Kimi K2.6',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Moonshot AI',
    upstreamApi: 'Moonshot API',
    exactHarnessCardIds: [],
    chatFallbackCardIds: [
      'card-aa-kimi-k2-6',
      'card-arena-kimi-k2-6',
      'card-openrouter-moonshotai-kimi-k2-6',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileFallback(
        'card-aa-coding-agent-claude-code-kimi-k2-6-default',
        'Default',
        0,
        'Max',
        5,
      ),
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-kimi-k2-6'),
        'Max',
        'Claude Code',
      ),
    ],
    fallbackPolicyNote: 'AA 未给 Kimi K2.6 的 Claude Code 行单列 effort，因此只按默认档→Max 单向补齐，并保留原始来源标签。',
  }),
  harnessPreset({
    key: 'harness.gpt-5-6-sol.max.codex-cli',
    productLineId: 'gpt_56_sol',
    modelName: 'GPT-5.6 Sol',
    profile: 'Max',
    harness: 'Codex CLI',
    providerName: 'OpenAI',
    upstreamApi: 'OpenAI API',
    exactHarnessCardIds: ['card-aa-coding-agent-codex-gpt-5-6-sol-max'],
    chatFallbackCardIds: [
      'card-aa-gpt-5-6-sol',
      'card-openrouter-openai-gpt-5-6-sol',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-gpt-5-6-sol-xhigh'),
        'XHigh',
        4,
        'Max',
        5,
        'Codex CLI',
      ),
      lowerProfileHarnessFallback(
        'card-arena-gpt-5-6-sol-xhigh',
        'XHigh',
        4,
        'Max',
        5,
        'Codex CLI',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.gpt-5-6-terra.max.codex-cli',
    productLineId: 'gpt_56_terra',
    modelName: 'GPT-5.6 Terra',
    profile: 'Max',
    harness: 'Codex CLI',
    providerName: 'OpenAI',
    upstreamApi: 'OpenAI API',
    exactHarnessCardIds: ['card-aa-coding-agent-codex-gpt-5-6-terra-max'],
    chatFallbackCardIds: [
      'card-aa-gpt-5-6-terra',
      'card-openrouter-openai-gpt-5-6-terra',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-gpt-5-6-terra-xhigh'),
        'XHigh',
        4,
        'Max',
        5,
        'Codex CLI',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.gpt-5-6-luna.max.codex-cli',
    productLineId: 'gpt_56_luna',
    modelName: 'GPT-5.6 Luna',
    profile: 'Max',
    harness: 'Codex CLI',
    providerName: 'OpenAI',
    upstreamApi: 'OpenAI API',
    exactHarnessCardIds: ['card-aa-coding-agent-codex-gpt-5-6-luna-max'],
    chatFallbackCardIds: [
      'card-aa-gpt-5-6-luna',
      'card-openrouter-openai-gpt-5-6-luna',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-gpt-5-6-luna-xhigh'),
        'XHigh',
        4,
        'Max',
        5,
        'Codex CLI',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.glm-5-2.max.claude-code',
    productLineId: 'glm_52',
    modelName: 'GLM-5.2',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Z.ai',
    upstreamApi: 'Z.ai API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-glm-5-2-max'],
    chatFallbackCardIds: [
      'card-aa-glm-5-2',
      'card-arena-glm-5-2-max',
      'card-openrouter-z-ai-glm-5-2',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-glm-5-2-max'),
        'Max',
        'Claude Code',
      ),
    ],
    note: 'AA 的 harness 行未另列 GLM effort；按该产品当前默认最高档 Max 建盒，并保留原始标签。',
  }),
  harnessPreset({
    key: 'harness.deepseek-v4-pro.high.claude-code',
    productLineId: 'deepseek_v4_pro',
    modelName: 'DeepSeek-v4-Pro Preview',
    profile: 'High',
    harness: 'Claude Code',
    providerName: 'DeepSeek',
    upstreamApi: 'DeepSeek API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-deepseek-v4-pro-high'],
    chatFallbackCardIds: [
      'card-aa-deepseek-v4-pro-0424-high',
      'card-arena-deepseek-v4-pro-high-preview',
      'card-openrouter-deepseek-deepseek-v4-pro',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-deepseek-v4-pro'),
        'High',
        'Claude Code',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.claude-opus-4-8.max.claude-code',
    productLineId: 'claude_opus_48',
    modelName: 'Claude Opus 4.8',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-claude-opus-4-8-max'],
    chatFallbackCardIds: [
      'card-aa-claude-opus-4-8',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-claude-opus-4-8-high'),
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileHarnessFallback(
        'card-arena-claude-opus-4-8-high',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
      lowerProfileFallback(
        'card-arena-claude-opus-4-8',
        'Default',
        0,
        'Max',
        5,
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.claude-opus-5.max.claude-code',
    productLineId: 'claude_opus_5',
    modelName: 'Claude Opus 5',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-claude-opus-5-max'],
    chatFallbackCardIds: [
      'card-aa-claude-opus-5',
      'card-openrouter-anthropic-claude-opus-5',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileHarnessFallback(
        'card-arena-claude-opus-5-high',
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.claude-fable-5.max.claude-code',
    productLineId: 'claude_fable_5',
    modelName: 'Claude Fable 5',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Anthropic',
    upstreamApi: 'Anthropic API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-claude-fable-5-max'],
    chatFallbackCardIds: [
      'card-aa-claude-fable-5',
      'card-arena-claude-fable-5',
      'card-openrouter-anthropic-claude-fable-5',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-claude-fable-5-high'),
        'High',
        3,
        'Max',
        5,
        'Claude Code',
      ),
    ],
    note: '沿用 AA 对 Fable 5 Max 的 Opus 4.8 fallback 披露，不隐藏该条件。',
  }),
  harnessPreset({
    key: 'harness.qwen-3-7-plus.max.claude-code',
    productLineId: 'qwen_37_plus',
    modelName: 'Qwen3.7-Plus',
    profile: 'Max',
    harness: 'Claude Code',
    providerName: 'Alibaba',
    upstreamApi: 'Alibaba Qwen API',
    exactHarnessCardIds: ['card-aa-coding-agent-claude-code-qwen3-7-plus-max'],
    chatFallbackCardIds: [
      'card-aa-qwen3-7-plus',
      'card-arena-qwen3-7-plus',
      'card-openrouter-qwen-qwen3-7-plus',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-qwen3-7-plus'),
        'Max',
        'Claude Code',
      ),
    ],
    note: 'AA 原始 harness 标签为 thinking；与当前榜单该模型默认最高思考档 Max 对齐。',
  }),
  harnessPreset({
    key: 'harness.grok-4-5.high.grok-build',
    productLineId: 'grok_45',
    modelName: 'Grok 4.5',
    profile: 'High',
    harness: 'Grok Build',
    providerName: 'xAI',
    upstreamApi: 'xAI API',
    exactHarnessCardIds: ['card-aa-coding-agent-grok-build-grok-4-5-high'],
    chatFallbackCardIds: [
      'card-aa-grok-4-5',
      'card-arena-grok-4-5',
      'card-openrouter-x-ai-grok-4-5',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-grok-4-5'),
        'High',
        'Grok Build',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.kimi-k3.max.kimi-code-cli',
    productLineId: 'kimi_k3',
    modelName: 'Kimi K3',
    profile: 'Max',
    harness: 'Kimi Code CLI',
    providerName: 'Moonshot AI',
    upstreamApi: 'Moonshot API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-kimi-code-cli-kimi-k3-max',
    ],
    chatFallbackCardIds: [
      'card-aa-kimi-k3',
      'card-arena-kimi-k3-max',
      'card-openrouter-moonshotai-kimi-k3',
    ],
    sameHarnessFallbackLinks: [
      lowerAgentHarnessFallback(
        productionAgentModeCardId('card-arena-kimi-k3-max'),
        'Max',
        'Kimi Code CLI',
      ),
    ],
  }),
  harnessPreset({
    key: 'harness.muse-spark-1-2.xhigh.opencode',
    productLineId: 'muse_spark_12',
    modelName: 'Muse Spark 1.2',
    profile: 'XHigh',
    harness: 'OpenCode',
    providerName: 'Meta',
    upstreamApi: 'Meta API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-opencode-muse-spark-1-2-xhigh',
    ],
    chatFallbackCardIds: [
      'card-aa-muse-spark-1-2',
      'card-arena-muse-spark-1-2-xhigh',
    ],
    note: 'AA Coding Agent 原始行明确使用 Opencode；站内执行名称沿用 OpenCode，普通 XHigh 模型数据只向该 Harness 配置单向补充。',
  }),
  harnessPreset({
    key: 'harness.muse-spark-1-2.xhigh.muse-code',
    productLineId: 'muse_spark_12',
    modelName: 'Muse Spark 1.2',
    profile: 'XHigh',
    harness: 'Muse Code',
    providerName: 'Meta',
    upstreamApi: 'Meta API',
    exactHarnessCardIds: [
      'card-aa-coding-agent-muse-code-muse-spark-1-2-xhigh',
    ],
    chatFallbackCardIds: [
      'card-aa-muse-spark-1-2',
      'card-arena-muse-spark-1-2-xhigh',
    ],
    note: 'AA 可见 Harness 名为 Muse Code；内部 agentName=tbh 只保留为来源元数据，普通 XHigh 模型数据只向该 Harness 配置单向补充。',
  }),
  harnessPreset({
    key: 'harness.muse-spark-1-1.xhigh.opencode',
    productLineId: 'muse_spark_11',
    modelName: 'Muse Spark 1.1',
    profile: 'XHigh',
    harness: 'OpenCode',
    providerName: 'Meta',
    upstreamApi: 'Meta API',
    exactHarnessCardIds: ['card-aa-coding-agent-opencode-muse-spark-1-1-xhigh'],
    chatFallbackCardIds: [
      'card-aa-muse-spark-1-1',
      'card-openrouter-meta-muse-spark-1-1',
    ],
    sameHarnessFallbackLinks: [
      lowerProfileAgentHarnessFallback(
        productionAgentModeCardId('card-arena-muse-spark-1-1'),
        'Medium',
        2,
        'XHigh',
        4,
        'OpenCode',
      ),
      lowerProfileHarnessFallback(
        'card-arena-muse-spark-1-1',
        'Medium',
        2,
        'XHigh',
        4,
        'OpenCode',
      ),
    ],
  }),
];

interface SourceCatalogCardScope {
  productLineId: string;
  productLineName?: string;
  canonicalProfileKey?: string;
  vendorName?: string;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  artificial_analysis: 'Artificial Analysis',
  arena: 'Arena',
  openrouter: 'OpenRouter',
};

function parseVerifiedSourceCards(): SourceModelCard[] {
  let bundledCards: SourceModelCard[] = [];
  try {
    const parsed: unknown = JSON.parse(VERIFIED_SOURCE_MODEL_CARDS);
    if (Array.isArray(parsed)) {
      bundledCards = parsed.filter((value): value is SourceModelCard => (
        Boolean(value)
        && typeof value === 'object'
        && typeof (value as SourceModelCard).id === 'string'
        && typeof (value as SourceModelCard).exactSourceModelName === 'string'
        && ((value as SourceModelCard).source === 'artificial_analysis'
          || (value as SourceModelCard).source === 'arena'
          || (value as SourceModelCard).source === 'openrouter')
      ));
    }
  } catch {
    bundledCards = [];
  }
  return [
    ...bundledCards,
    ...VERIFIED_HARNESS_SOURCE_MODEL_CARDS,
    ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_MODEL_CARDS,
    ...VERIFIED_REVIEWED_FAMILY_SOURCE_MODEL_CARDS,
    ...VERIFIED_RECOVERED_SOURCE_MODEL_CARDS,
  ];
}

function parseVerifiedSourceObservations(): SourceObservation[] {
  let bundledObservations: SourceObservation[] = [];
  try {
    const parsed: unknown = JSON.parse(VERIFIED_SOURCE_OBSERVATIONS);
    if (Array.isArray(parsed)) {
      bundledObservations = parsed.filter((value): value is SourceObservation => (
        Boolean(value)
        && typeof value === 'object'
        && typeof (value as SourceObservation).sourceModelCardId === 'string'
        && typeof (value as SourceObservation).metricId === 'string'
        && typeof (value as SourceObservation).rawValue === 'number'
      ));
    }
  } catch {
    bundledObservations = [];
  }
  return [
    ...bundledObservations,
    ...VERIFIED_HARNESS_SOURCE_OBSERVATIONS,
    ...VERIFIED_PRODUCTION_AGENT_MODE_SOURCE_OBSERVATIONS,
    ...VERIFIED_REVIEWED_FAMILY_SOURCE_OBSERVATIONS,
    ...VERIFIED_RECOVERED_SOURCE_OBSERVATIONS,
  ];
}

function sourceCatalogCardScope(card: SourceModelCard): SourceCatalogCardScope | null {
  const scope = card.metadataJson?.scope;
  if (!scope || typeof scope !== 'object') return null;
  if (typeof scope.productLineId !== 'string' || scope.productLineId.trim().length === 0) return null;
  return {
    productLineId: scope.productLineId.trim(),
    ...(typeof scope.productLineName === 'string' && scope.productLineName.trim().length > 0
      ? { productLineName: scope.productLineName.trim() }
      : {}),
    ...(typeof scope.canonicalProfileKey === 'string' && scope.canonicalProfileKey.trim().length > 0
      ? { canonicalProfileKey: scope.canonicalProfileKey.trim() }
      : {}),
    ...(typeof scope.vendorName === 'string' && scope.vendorName.trim().length > 0
      ? { vendorName: scope.vendorName.trim() }
      : {}),
  };
}

/**
 * This is intentionally a conservative identity normalizer, not an effort
 * inference engine. It only removes a source UI's leading "Provider:" label
 * and punctuation differences, so Search/Thinking/Fast/Pro/harness terms
 * remain part of the source-profile key.
 */
function sourceCatalogProfileKey(card: SourceModelCard): string {
  const scopeCanonicalKey = card.metadataJson?.scope?.canonicalProfileKey;
  if (typeof scopeCanonicalKey === 'string' && scopeCanonicalKey.trim().length > 0) {
    return scopeCanonicalKey.trim();
  }
  const identityCanonicalKey = card.metadataJson?.sourceIdentity?.canonicalProfileKey;
  if (typeof identityCanonicalKey === 'string' && identityCanonicalKey.trim().length > 0) {
    return identityCanonicalKey.trim();
  }
  const withoutProviderPrefix = card.exactSourceModelName
    .normalize('NFKC')
    .trim()
    .replace(/^[^:]{1,80}:\s*/u, '')
    .replace(/\+/gu, ' plus ');
  return withoutProviderPrefix
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'unknown-profile';
}

function isOpenRouterStandardPerformanceCard(card: SourceModelCard): boolean {
  return card.source === 'openrouter'
    && card.metadataJson?.sourceIdentity?.kind === 'openrouter_standard_performance'
    && typeof card.metadataJson?.sourceIdentity?.companionForCardId === 'string';
}

const PRACTICAL_METRIC_IDS = new Set([
  'or_price_input',
  'or_price_output',
  'or_ttft_p50',
  'or_throughput_p50',
]);

/**
 * Reader-approved source-only API configurations. These rows were reviewed
 * after τ³-Banking made a wider set of AA-only rows five-domain capable.
 * Keeping the allowlist explicit prevents the domain reclassification from
 * silently promoting every otherwise sparse source-catalog record.
 */
export const READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINE_IDS = [
  'source-profile-grok-4-3-high',
  'source-profile-grok-build-0-1-0616',
  'source-profile-inkling-xhigh',
  'source-profile-north-mini-code',
] as const;

const READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINES = new Set<string>(
  READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINE_IDS,
);

function sourceCatalogModelName(
  card: SourceModelCard,
  scope?: SourceCatalogCardScope,
): string {
  const preferredName = (
    scope?.productLineName
    && scope.vendorName
    && scope.vendorName !== 'Cross-source catalog'
  )
    ? scope.productLineName
    : undefined;
  const exactModelName = card.metadataJson?.sourceIdentity?.exactSourceModelName;
  const rawName = preferredName || (
    isOpenRouterStandardPerformanceCard(card)
    && typeof exactModelName === 'string'
    && exactModelName.trim()
      ? exactModelName
      : card.exactSourceModelName
  )
    .normalize('NFKC')
    .trim()
    .replace(/^[^:]{1,80}:\s*/u, '');

  return rawName
    .replace(/\s*\((?=[^)]*(?:reasoning|thinking|effort|non[- ]?thinking|x[- ]?high|high|medium|low|max))[^)]*\)\s*$/iu, '')
    .replace(/\s*\((?:non[- ]?reasoning|reasoning|thinking|no[- ]?thinking|high|medium|low|x[- ]?high|max)\)\s*$/iu, '')
    .replace(/(?:[-–—_/ ]+)(?:non[- ]?reasoning|reasoning|thinking|no[- ]?thinking|x[- ]?high|xhigh|high|medium|low|max)\s*$/iu, '')
    .trim() || rawName;
}

function sourceCatalogHarness(cards: readonly SourceModelCard[]): BuiltInConfigurationIdentity['harness'] {
  if (cards.some(isOpenRouterStandardPerformanceCard)) {
    return {
      name: '---',
      environment: 'OpenRouter Standard',
    };
  }
  const profileText = cards.map((card) => card.exactSourceModelName).join(' | ').toLocaleLowerCase('en-US');
  if (/codex[- ]harness|codex harness/u.test(profileText)) {
    return { name: 'Codex', environment: 'Codex' };
  }
  if (/\bsearch\b|grounding/u.test(profileText)) {
    return { name: 'Search', environment: 'Search' };
  }
  return {
    name: '---',
    environment: /\bfast\b/u.test(profileText) ? 'Fast' : 'Chat',
  };
}

function sourceCatalogProfileLabel(
  scope: SourceCatalogCardScope,
  cards: readonly SourceModelCard[],
): string {
  const canonicalKey = (scope.canonicalProfileKey || '')
    .toLocaleLowerCase('en-US');
  const text = [
    canonicalKey,
    ...cards.map((card) => card.exactSourceModelName),
  ].filter(Boolean).join(' ').toLocaleLowerCase('en-US');

  if (/(?:^|-)codex(?:-harness)?$/u.test(canonicalKey)) return 'Codex';
  if (/(?:^|-)(?:search|grounding)$/u.test(canonicalKey)) return 'Search';
  if (/(?:^|-)instant$/u.test(canonicalKey)) return 'Instant';
  if (/(?:^|-)fast$/u.test(canonicalKey)) return 'Fast';
  if (/(?:^|-)pro(?:-(?:xhigh|x-high|high|medium|low|max))?$/u.test(canonicalKey)) {
    if (/(?:xhigh|x-high)$/u.test(canonicalKey)) return 'Pro XHigh';
    if (/-high$/u.test(canonicalKey)) return 'Pro High';
    if (/-medium$/u.test(canonicalKey)) return 'Pro Medium';
    if (/-low$/u.test(canonicalKey)) return 'Pro Low';
    return 'Pro Max';
  }
  if (/(?:^|-)(?:non-reasoning|no-thinking|thinking-off)$/u.test(canonicalKey)) return 'None';
  if (/(?:^|-)minimal$/u.test(canonicalKey)) return 'Minimal';
  if (/(?:^|-)(?:x-high|xhigh)$/u.test(canonicalKey)) return 'XHigh';
  if (/(?:^|-)medium$/u.test(canonicalKey)) return 'Medium';
  if (/(?:^|-)low$/u.test(canonicalKey)) return 'Low';
  if (/(?:^|-)high$/u.test(canonicalKey)) return 'High';
  if (/(?:^|-)(?:reasoning|thinking)$/u.test(canonicalKey)) return 'Max';
  // Some curated identities retain the effort only in the exact published
  // name. Keep this as a fallback after the canonical-key checks above.
  if (/\bnon[- ]?reasoning\b|\bno[- ]?thinking\b|\bthinking[- ]off\b/u.test(text)) return 'None';
  // An unlabelled/default reasoning profile is the model's normal highest
  // setting for this compact catalog. Do not expose a verbose
  // "未单列思考强度" pseudo-tier to the user.
  return 'Max';
}

function sourceCatalogCardGroupKey(card: SourceModelCard): string | null {
  const scope = sourceCatalogCardScope(card);
  if (!scope) return null;
  return `${scope.productLineId}\u0000${sourceCatalogProfileKey(card)}`;
}

function sourceCatalogProviderName(
  scope: SourceCatalogCardScope,
  cards: readonly SourceModelCard[],
  modelName: string,
  explicitRouteProvider?: unknown,
): string {
  const routeProvider = providerNameFromVendorText(explicitRouteProvider);
  if (routeProvider) return routeProvider;

  const scopeProvider = providerNameFromVendorText(scope.vendorName);
  if (scopeProvider) return scopeProvider;

  for (const card of cards) {
    const sourceIdentity = card.metadataJson?.sourceIdentity;
    const creatorProvider = providerNameFromVendorText(sourceIdentity?.modelCreatorName)
      || providerNameFromVendorText(sourceIdentity?.modelCreatorSlug);
    if (creatorProvider) return creatorProvider;

    if (card.source === 'openrouter') {
      const sourceRecordId = sourceIdentity?.sourceRecordId;
      if (typeof sourceRecordId === 'string') {
        const recordProvider = providerNameFromVendorText(
          sourceRecordId.split('/')[0]?.split('#')[0],
        );
        if (recordProvider) return recordProvider;
      }
    }
  }

  return modelAuthorProviderName(modelName) || 'Model author';
}

function sourceCatalogPreset(
  key: string,
  scope: SourceCatalogCardScope,
  cards: readonly SourceModelCard[],
): BuiltInConfigurationPreset {
  const sourceLabels = [...new Set(cards.map((card) => SOURCE_LABELS[card.source]))];
  const allOpenRouter = cards.every((card) => card.source === 'openrouter');
  const performanceCompanion = cards.find(isOpenRouterStandardPerformanceCard);
  const performanceIdentity = performanceCompanion?.metadataJson?.sourceIdentity;
  const routeProvider = performanceIdentity?.providerDisplayName
    || performanceIdentity?.providerName
    || performanceIdentity?.providerSlug;
  const sourceList = sourceLabels.join(' + ');
  const first = performanceCompanion || cards[0];
  const modelName = sourceCatalogModelName(first, scope);
  const providerName = sourceCatalogProviderName(
    scope,
    cards,
    modelName,
    performanceCompanion ? routeProvider : undefined,
  );
  const readerApprovedApi = READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINES
    .has(scope.productLineId);
  const access: BuiltInConfigurationPresetAccess =
    performanceCompanion || allOpenRouter || readerApprovedApi ? 'api' : 'inferred';
  return definePreset({
    key,
    productLineId: scope.productLineId,
    identity: {
      model: {
        name: modelName,
        profile: sourceCatalogProfileLabel(scope, cards),
      },
      harness: sourceCatalogHarness(cards),
      provider: performanceCompanion
        ? {
          name: providerName,
          upstream: 'OpenRouter Standard 路线；性能取官方统计响应中顺序为 0 的当前主端点',
        }
        : allOpenRouter
        ? { name: providerName, upstream: 'OpenRouter API（官方目录精确路由）' }
        : {
          name: providerName,
          upstream: `${sourceList} 官方来源记录；未把未披露的 API、客户端或工具路由推断为同一配置`,
        },
    },
    origin: 'source-catalog',
    access,
    note: performanceCompanion
      ? `OpenRouter Standard 路线性能来自官方模型页统计接口的当前主端点（${routeProvider || 'provider 未标注'}）；价格和速度可作为同模型产品线的 provider-neutral 实用数据，但绝不作为能力档位证据。能力卡仅在规范化配置键完全相同时复用。`
      : [
        `自动补入未被手工配置占用的精确来源记录（${sourceList}）。仅合并规范化后完全相同的来源配置；不跨 Thinking、Fast、Pro 或 harness 复制数据。Arena Search/Grounding 评测行直接归入基础模型。`,
        readerApprovedApi
          ? 'API 标签按模型作者归属显示；评测来源未披露具体服务路线，因此不绑定某个端点或聚合提供商。'
          : '',
      ].filter(Boolean).join(' '),
    sourceCardIds: cards.map((card) => card.id),
  });
}

/**
 * Every source card must have a destination. Data.md presets remain the
 * preferred, hand-authored API configurations; cards they do not explicitly
 * claim become source-catalog configurations rather than disappearing from
 * the data pool. This is deliberately additive and uses exact card IDs only.
 */
function buildSourceCatalogConfigurationPresets(
  alreadyDeclaredCardIds: ReadonlySet<string>,
): BuiltInConfigurationPreset[] {
  const allCards = parseVerifiedSourceCards();
  const allCardsById = new Map(allCards.map((card) => [card.id, card]));
  const allCardsByGroup = new Map<string, SourceModelCard[]>();
  for (const card of allCards) {
    const groupKey = sourceCatalogCardGroupKey(card);
    if (!groupKey) continue;
    const group = allCardsByGroup.get(groupKey) || [];
    group.push(card);
    allCardsByGroup.set(groupKey, group);
  }
  const groups = new Map<string, { scope: SourceCatalogCardScope; cards: SourceModelCard[] }>();
  for (const card of allCards) {
    if (alreadyDeclaredCardIds.has(card.id)) continue;
    const scope = sourceCatalogCardScope(card);
    if (!scope) continue;
    const groupKey = sourceCatalogCardGroupKey(card);
    if (!groupKey) continue;
    const group = groups.get(groupKey) || { scope, cards: [] };
    group.cards.push(card);
    groups.set(groupKey, group);
  }

  // A Standard-route performance card is a second official OpenRouter record
  // for the same exact model profile. Reuse the complete pair while building
  // source-catalog candidates. A later, explicit augmentation may also reuse
  // that pair as provider-neutral practical data for another profile in the
  // same model product line; it still never becomes capability evidence.
  for (const [groupKey, group] of groups) {
    const companions = group.cards.filter(isOpenRouterStandardPerformanceCard);
    if (companions.length === 0) continue;
    if (companions.length > 1) {
      throw new Error(`Source-profile group ${groupKey} contains more than one OpenRouter Standard performance companion.`);
    }
    const companionForCardId = companions[0].metadataJson?.sourceIdentity?.companionForCardId;
    const baseCard = typeof companionForCardId === 'string'
      ? allCardsById.get(companionForCardId)
      : undefined;
    if (!baseCard || sourceCatalogCardGroupKey(baseCard) !== groupKey) {
      throw new Error(`OpenRouter Standard performance companion in ${groupKey} has no matching catalog card.`);
    }
    const existingIds = new Set(group.cards.map((card) => card.id));
    for (const candidate of allCardsByGroup.get(groupKey) || []) {
      if (!existingIds.has(candidate.id)) {
        group.cards.push(candidate);
        existingIds.add(candidate.id);
      }
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
    .map(([groupKey, group]) => {
      const [, profileKey] = groupKey.split('\u0000');
      const sourceCards = [...group.cards].sort((left, right) => (
        left.source.localeCompare(right.source, 'en-US')
        || left.id.localeCompare(right.id, 'en-US')
      ));
      for (const source of ['artificial_analysis', 'arena', 'openrouter'] as const) {
        const sameSourceCards = sourceCards.filter((card) => card.source === source);
        if (sameSourceCards.length <= 1) continue;
        const companion = sameSourceCards.find(isOpenRouterStandardPerformanceCard);
        const companionForCardId = companion?.metadataJson?.sourceIdentity?.companionForCardId;
        const isValidOpenRouterPair = source === 'openrouter'
          && sameSourceCards.length === 2
          && typeof companionForCardId === 'string'
          && sameSourceCards.some((card) => card.id === companionForCardId);
        if (!isValidOpenRouterPair) {
          throw new Error(`Source-profile group ${profileKey} contains multiple ${source} cards.`);
        }
      }
      return sourceCatalogPreset(
        `source-catalog.${group.scope.productLineId}.${profileKey}`,
        group.scope,
        sourceCards,
      );
    });
}

function declaredSourceCardIds(
  presets: readonly BuiltInConfigurationPreset[],
): Set<string> {
  const cardIds = new Set<string>();
  presets.forEach((preset) => {
    preset.sourceCardIds?.forEach((cardId) => cardIds.add(cardId));
    preset.sourceCardLinks?.forEach((link) => cardIds.add(link.cardId));
  });
  return cardIds;
}

/**
 * If a hand-authored preset already claims one unique AA/Arena capability
 * card, attach unclaimed cards with the same reviewed canonical profile key.
 * OpenRouter-only price cards are never used to pull in capability profiles.
 * Their explicitly declared Standard-performance companion may still follow
 * the exact base card: it is the same OpenRouter model record, not a fuzzy
 * model-name match or a different provider route.
 */
function attachEquivalentCardsToHandAuthoredPresets(
  presets: readonly BuiltInConfigurationPreset[],
): { presets: BuiltInConfigurationPreset[]; attachedCardCount: number } {
  const cards = parseVerifiedSourceCards();
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const groups = new Map<string, SourceModelCard[]>();
  cards.forEach((card) => {
    const groupKey = sourceCatalogCardGroupKey(card);
    if (!groupKey) return;
    const group = groups.get(groupKey) || [];
    group.push(card);
    groups.set(groupKey, group);
  });
  const performanceCompanionsByBaseCardId = new Map<string, SourceModelCard[]>();
  cards.forEach((card) => {
    if (!isOpenRouterStandardPerformanceCard(card)) return;
    const companionForCardId = card.metadataJson?.sourceIdentity?.companionForCardId;
    if (typeof companionForCardId !== 'string') return;
    const companions = performanceCompanionsByBaseCardId.get(companionForCardId) || [];
    companions.push(card);
    performanceCompanionsByBaseCardId.set(companionForCardId, companions);
  });

  const directClaimCounts = new Map<string, number>();
  const allClaimCounts = new Map<string, number>();
  presets.forEach((preset) => {
    preset.sourceCardIds?.forEach((cardId) => {
      directClaimCounts.set(cardId, (directClaimCounts.get(cardId) || 0) + 1);
      allClaimCounts.set(cardId, (allClaimCounts.get(cardId) || 0) + 1);
    });
    preset.sourceCardLinks?.forEach((link) => {
      allClaimCounts.set(link.cardId, (allClaimCounts.get(link.cardId) || 0) + 1);
    });
  });

  let attachedCardCount = 0;
  const augmented = presets.map((preset) => {
    const existingIds = new Set([
      ...(preset.sourceCardIds || []),
      ...(preset.sourceCardLinks || []).map((link) => link.cardId),
    ]);
    const additions = new Set<string>();
    (preset.sourceCardIds || []).forEach((cardId) => {
      const seed = cardsById.get(cardId);
      if (!seed) return;
      (performanceCompanionsByBaseCardId.get(cardId) || []).forEach((companion) => {
        if (
          existingIds.has(companion.id)
          || companion.metadataJson?.scope?.productLineId !== preset.productLineId
        ) return;
        additions.add(companion.id);
      });
      if (seed.source === 'openrouter') return;
      if ((directClaimCounts.get(cardId) || 0) !== 1) return;
      const groupKey = sourceCatalogCardGroupKey(seed);
      if (!groupKey) return;
      (groups.get(groupKey) || []).forEach((candidate) => {
        if (isOpenRouterStandardPerformanceCard(candidate)) return;
        if (existingIds.has(candidate.id)) return;
        if ((allClaimCounts.get(candidate.id) || 0) > 0) return;
        additions.add(candidate.id);
      });
    });

    if (additions.size === 0) return preset;
    attachedCardCount += additions.size;
    const sourceCardIds = uniqueCardIds(
      preset.sourceCardIds,
      [...additions].sort((left, right) => left.localeCompare(right, 'en-US')),
    );
    return {
      ...preset,
      note: [
        preset.note,
        `已按审核过的同配置别名补连 ${additions.size} 张来源卡；未使用模糊相似度，也未跨 effort、Search、Fast、Pro 或 harness。`,
      ].filter(Boolean).join(' '),
      sourceCardIds,
    };
  });

  return { presets: augmented, attachedCardCount };
}

interface OpenRouterPracticalPair {
  baseCard: SourceModelCard;
  performanceCard: SourceModelCard;
}

/**
 * Price and speed describe how a model is served, not how its reasoning effort
 * scored on capability benchmarks. Reuse one complete OpenRouter
 * catalog/performance pair across API providers and explicit effort labels
 * inside the same reviewed product line. Only OpenRouter practical metrics are
 * added here; AA/Arena capability cards remain governed by exact profile or
 * lower-to-higher fallback rules.
 */
function attachProviderNeutralOpenRouterPracticalCards(
  presets: readonly BuiltInConfigurationPreset[],
): { presets: BuiltInConfigurationPreset[]; attachedCardCount: number } {
  const cards = parseVerifiedSourceCards();
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const metricIdsByCard = new Map<string, Set<string>>();
  parseVerifiedSourceObservations().forEach((observation) => {
    const metricIds = metricIdsByCard.get(observation.sourceModelCardId) || new Set<string>();
    metricIds.add(observation.metricId);
    metricIdsByCard.set(observation.sourceModelCardId, metricIds);
  });

  const pairsByProductLine = new Map<string, OpenRouterPracticalPair[]>();
  cards.forEach((performanceCard) => {
    if (!isOpenRouterStandardPerformanceCard(performanceCard)) return;
    const baseCardId = performanceCard.metadataJson?.sourceIdentity?.companionForCardId;
    const baseCard = typeof baseCardId === 'string' ? cardsById.get(baseCardId) : undefined;
    if (!baseCard || baseCard.source !== 'openrouter') return;

    const baseScope = sourceCatalogCardScope(baseCard);
    const performanceScope = sourceCatalogCardScope(performanceCard);
    if (
      !baseScope
      || !performanceScope
      || baseScope.productLineId !== performanceScope.productLineId
    ) return;

    const baseMetrics = metricIdsByCard.get(baseCard.id) || new Set<string>();
    const performanceMetrics = metricIdsByCard.get(performanceCard.id) || new Set<string>();
    if (
      !baseMetrics.has('or_price_input')
      || !baseMetrics.has('or_price_output')
      || !performanceMetrics.has('or_ttft_p50')
      || !performanceMetrics.has('or_throughput_p50')
    ) return;

    const pairs = pairsByProductLine.get(baseScope.productLineId) || [];
    pairs.push({ baseCard, performanceCard });
    pairsByProductLine.set(baseScope.productLineId, pairs);
  });

  let attachedCardCount = 0;
  const augmented = presets.map((preset) => {
    if (preset.access !== 'api') return preset;

    const existingIds = new Set(presetCardIds(preset));
    const existingPracticalMetrics = new Set(
      [...existingIds].flatMap((cardId) => (
        [...(metricIdsByCard.get(cardId) || [])]
          .filter((metricId) => PRACTICAL_METRIC_IDS.has(metricId))
      )),
    );
    if ([...PRACTICAL_METRIC_IDS].every((metricId) => existingPracticalMetrics.has(metricId))) {
      return preset;
    }

    const pairs = [...(pairsByProductLine.get(preset.productLineId) || [])];
    if (pairs.length === 0) return preset;
    pairs.sort((left, right) => {
      const leftAlreadyLinked = Number(existingIds.has(left.baseCard.id));
      const rightAlreadyLinked = Number(existingIds.has(right.baseCard.id));
      const leftProfile = sourceCatalogProfileKey(left.baseCard);
      const rightProfile = sourceCatalogProfileKey(right.baseCard);
      const variantPattern = /(?:^|-)(?:fast|free|preview|search|grounding|instant)(?:-|$)/u;
      return rightAlreadyLinked - leftAlreadyLinked
        || Number(variantPattern.test(leftProfile)) - Number(variantPattern.test(rightProfile))
        || leftProfile.length - rightProfile.length
        || left.baseCard.id.localeCompare(right.baseCard.id, 'en-US');
    });

    const selected = pairs[0];
    const additions = [selected.baseCard.id, selected.performanceCard.id]
      .filter((cardId) => !existingIds.has(cardId));
    if (additions.length === 0) return preset;

    attachedCardCount += additions.length;
    const practicalNote =
      '实用分价格与速度采用同模型产品线的 OpenRouter 目录和 Standard 聚合性能，不绑定配置提供商或 API 路线；这些数据不参与能力分。';
    if (!isPlainChatPreset(preset)) {
      return {
        ...preset,
        note: [preset.note, practicalNote].filter(Boolean).join(' '),
        sourceCardLinks: dedupeSourceLinks([
          ...(preset.sourceCardLinks || []),
          ...additions.map((cardId) => lowerHarnessFallback(
            cardId,
            preset.identity.model.profile,
            preset.identity.harness.name,
          )),
        ]),
      };
    }
    return {
      ...preset,
      note: [preset.note, practicalNote].filter(Boolean).join(' '),
      sourceCardIds: uniqueCardIds(preset.sourceCardIds, additions),
    };
  });

  return { presets: augmented, attachedCardCount };
}

const BASE_HAND_AUTHORED_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] = [
  ...DATA_MD_CONFIGURATION_PRESETS,
  ...MUSE_SPARK_1_2_CONFIGURATION_PRESETS,
  ...AUGUST_2026_RELEASE_CONFIGURATION_PRESETS,
  ...CLAUDE_OPUS_5_CONFIGURATION_PRESETS,
  ...HARNESS_CONFIGURATION_PRESETS,
];

const HAND_AUTHORED_EQUIVALENCE_AUGMENTATION =
  attachEquivalentCardsToHandAuthoredPresets(BASE_HAND_AUTHORED_CONFIGURATION_PRESETS);

const HAND_AUTHORED_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] =
  HAND_AUTHORED_EQUIVALENCE_AUGMENTATION.presets;

const SOURCE_CATALOG_REVIEWED_FALLBACKS = new Map<
string,
readonly BuiltInConfigurationPresetSourceCardLink[]
>([
  [
    'builtin.source-catalog.source-profile-grok-4-3-high.grok-4-3-high',
    [
      lowerProfileFallback(
        reviewedFamilyCardId('grok43-arena-default'),
        'Default',
        0,
        'High',
        3,
      ),
    ],
  ],
  [
    'builtin.source-catalog.source-profile-inkling-xhigh.inkling-xhigh',
    [
      lowerProfileFallback(
        reviewedFamilyCardId('inkling-arena-default'),
        'Default',
        0,
        'XHigh',
        4,
      ),
    ],
  ],
]);

const sourceCatalogDeclaredCardIds =
  declaredSourceCardIds(HAND_AUTHORED_CONFIGURATION_PRESETS);
for (const links of SOURCE_CATALOG_REVIEWED_FALLBACKS.values()) {
  links.forEach((link) => sourceCatalogDeclaredCardIds.add(link.cardId));
}

const SOURCE_CATALOG_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] =
  buildSourceCatalogConfigurationPresets(sourceCatalogDeclaredCardIds)
    .map((preset) => {
      const reviewedFallbacks = SOURCE_CATALOG_REVIEWED_FALLBACKS.get(preset.id);
      if (!reviewedFallbacks) return preset;
      return {
        ...preset,
        note: [
          preset.note,
          '经审核的同模型 Arena 默认档只按 Default→当前高档单向补缺，不反向覆盖较低档配置。',
        ].filter(Boolean).join(' '),
        sourceCardLinks: [
          ...(preset.sourceCardLinks || []),
          ...reviewedFallbacks,
        ],
      };
    });

const PROVIDER_NEUTRAL_PRACTICAL_AUGMENTATION =
  attachProviderNeutralOpenRouterPracticalCards([
    ...HAND_AUTHORED_CONFIGURATION_PRESETS,
    ...SOURCE_CATALOG_CONFIGURATION_PRESETS,
  ]);

interface ApiPricingVariantSpec {
  key: string;
  basePresetId: string;
  providerDisplayLabel: string;
  providerUpstream: string;
  pricing: BuiltInApiPricingData;
  note: string;
}

const MUSE_SPARK_1_2_CONTRIBUTOR_PRICING: BuiltInApiPricingData = {
  tierName: 'Contributor',
  inputPricePerMToken: 0.1,
  outputPricePerMToken: 0.2,
  cacheReadPricePerMToken: 0.002,
  effectiveDate: '2026-08-05',
  officialSourceUrl:
    'https://developer.meta.com/ai/resources/blog/build-with-muse-code/',
  speedBasis: 'same-model-standard-route',
};

const API_PRICING_VARIANT_SPECS: readonly ApiPricingVariantSpec[] = [
  {
    key: 'api-tier.meta-contributor.muse-spark-1-2.xhigh.opencode',
    basePresetId: 'builtin.harness.muse-spark-1-2.xhigh.opencode',
    providerDisplayLabel: 'Meta API Contributor',
    providerUpstream: 'Meta Model API（Contributor tier）',
    pricing: MUSE_SPARK_1_2_CONTRIBUTOR_PRICING,
    note: 'Contributor 档允许 Meta 使用输入与输出改进未来模型，以换取独立低价；能力、Harness 和速度证据保持与同一 Muse Spark 1.2 路线一致。',
  },
  {
    key: 'api-tier.meta-contributor.muse-spark-1-2.xhigh.muse-code',
    basePresetId: 'builtin.harness.muse-spark-1-2.xhigh.muse-code',
    providerDisplayLabel: 'Meta API Contributor',
    providerUpstream: 'Meta Model API（Contributor tier）',
    pricing: MUSE_SPARK_1_2_CONTRIBUTOR_PRICING,
    note: 'Contributor 档允许 Meta 使用输入与输出改进未来模型，以换取独立低价；能力、Harness 和速度证据保持与同一 Muse Spark 1.2 路线一致。',
  },
];

/**
 * Direct API price tiers are independent access configurations. They retain
 * the base route's exact capability stack and same-model performance card,
 * while the official vendor price replaces only input/output economics.
 */
function buildApiPricingVariantPresets(
  candidates: readonly BuiltInConfigurationPreset[],
): BuiltInConfigurationPreset[] {
  return API_PRICING_VARIANT_SPECS.map((spec) => {
    const base = candidates.find((preset) => preset.id === spec.basePresetId);
    if (!base) throw new Error(`Missing API pricing base preset ${spec.basePresetId}.`);

    return definePreset({
      key: spec.key,
      productLineId: base.productLineId,
      identity: {
        model: { ...base.identity.model },
        harness: { ...base.identity.harness },
        provider: {
          ...base.identity.provider,
          upstream: spec.providerUpstream,
        },
      },
      origin: base.origin,
      access: 'api',
      providerDisplayLabel: spec.providerDisplayLabel,
      apiPricingData: { ...spec.pricing },
      note: [base.note, spec.note].filter(Boolean).join(' '),
      ...(base.sourceCardIds
        ? { sourceCardIds: [...base.sourceCardIds] }
        : {}),
      ...(base.sourceCardLinks
        ? { sourceCardLinks: [...base.sourceCardLinks] }
        : {}),
    });
  });
}

const API_PRICING_VARIANT_PRESETS = buildApiPricingVariantPresets(
  PROVIDER_NEUTRAL_PRACTICAL_AUGMENTATION.presets,
);

interface SubscriptionConfigurationSpec {
  key: string;
  basePresetId: string;
  planName: string;
  monthlyPriceUSD: number;
  apiEquivalentCostUSD: number;
  usableQuotaFraction: number;
  note: string;
}

interface SubscriptionPlanDefinition {
  key: string;
  planName: string;
  monthlyPriceUSD: number;
  apiEquivalentCostUSD: number;
  note: string;
}

interface SubscriptionConfigurationTarget {
  key: string;
  basePresetId: string;
  plans: readonly SubscriptionPlanDefinition[];
  usableQuotaFraction?: number;
  note?: string;
}

const BASE_PLAN_TO_20X_QUOTA_DIVISOR = 20;
const CHATGPT_PRO_20X_API_EQUIVALENT_USD = 2000;
const CLAUDE_MAX_20X_API_EQUIVALENT_USD = 1600;
const GOOGLE_AI_ULTRA_20X_API_EQUIVALENT_USD = 5200;

const CHATGPT_PLUS_PLAN: SubscriptionPlanDefinition = {
  key: 'chatgpt-plus',
  planName: 'ChatGPT Plus',
  monthlyPriceUSD: 20,
  apiEquivalentCostUSD:
    CHATGPT_PRO_20X_API_EQUIVALENT_USD / BASE_PLAN_TO_20X_QUOTA_DIVISOR,
  note: '20 美元档按同一订阅族的 20× 比例折合 100 美元 API 用量；100 美元 5× 档成本效率相同，因此不重复建盒。',
};

const CHATGPT_PRO_20X_PLAN: SubscriptionPlanDefinition = {
  key: 'chatgpt-pro-20x',
  planName: 'ChatGPT Pro 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: CHATGPT_PRO_20X_API_EQUIVALENT_USD,
  note: '200 美元档按已确认口径取 2000 美元 API 等价值。',
};

const CLAUDE_PRO_PLAN: SubscriptionPlanDefinition = {
  key: 'claude-pro',
  planName: 'Claude Pro',
  monthlyPriceUSD: 20,
  apiEquivalentCostUSD:
    CLAUDE_MAX_20X_API_EQUIVALENT_USD / BASE_PLAN_TO_20X_QUOTA_DIVISOR,
  note: '20 美元档按同一订阅族的 20× 比例折合 80 美元 API 用量；100 美元 5× 档成本效率相同，因此不重复建盒。',
};

const CLAUDE_MAX_20X_PLAN: SubscriptionPlanDefinition = {
  key: 'claude-max-20x',
  planName: 'Claude Max 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: CLAUDE_MAX_20X_API_EQUIVALENT_USD,
  note: '200 美元档按社区实测的近似量级取整为 1600 美元 API 等价值。',
};

const GOOGLE_AI_PRO_PLAN: SubscriptionPlanDefinition = {
  key: 'google-ai-pro',
  planName: 'Google AI Pro',
  monthlyPriceUSD: 20,
  apiEquivalentCostUSD:
    GOOGLE_AI_ULTRA_20X_API_EQUIVALENT_USD / BASE_PLAN_TO_20X_QUOTA_DIVISOR,
  note: '20 美元档结合社区实测用量与推理 token 换算，折合约 260 美元 Gemini API 用量。',
};

const GOOGLE_AI_ULTRA_20X_PLAN: SubscriptionPlanDefinition = {
  key: 'google-ai-ultra-20x',
  planName: 'Google AI Ultra 20×',
  monthlyPriceUSD: 200,
  apiEquivalentCostUSD: GOOGLE_AI_ULTRA_20X_API_EQUIVALENT_USD,
  note: '200 美元 20× 档按与 Pro 相同的额度比例折合约 5200 美元 Gemini API 用量。',
};

const SUPERGROK_PLAN: SubscriptionPlanDefinition = {
  key: 'supergrok',
  planName: 'SuperGrok',
  monthlyPriceUSD: 30,
  apiEquivalentCostUSD: 150,
  note: '社区实测的基础订阅额度折合约 150 美元 xAI API 用量；更高档位沿用相同成本效率，因此只保留这一档。',
};

const SUBSCRIPTION_CONFIGURATION_TARGETS:
  readonly SubscriptionConfigurationTarget[] = [
  {
    key: 'gpt-5-6-sol.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-sol.max.codex-cli',
    plans: [CHATGPT_PLUS_PLAN, CHATGPT_PRO_20X_PLAN],
  },
  {
    key: 'gpt-5-6-terra.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-terra.max.codex-cli',
    plans: [CHATGPT_PLUS_PLAN],
  },
  {
    key: 'gpt-5-6-luna.max.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-6-luna.max.codex-cli',
    plans: [CHATGPT_PLUS_PLAN],
  },
  {
    key: 'gpt-5-5.xhigh.codex-cli',
    basePresetId: 'builtin.harness.gpt-5-5.xhigh.codex-cli',
    plans: [CHATGPT_PLUS_PLAN],
  },
  {
    key: 'claude-fable-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-fable-5.max.claude-code',
    plans: [CLAUDE_PRO_PLAN, CLAUDE_MAX_20X_PLAN],
    usableQuotaFraction: 0.5,
    note: 'Fable 5 仅可使用该计划总额度的 50%；实用分按折后可用额度计算。',
  },
  {
    key: 'claude-opus-5.max.claude-code',
    basePresetId: 'builtin.harness.claude-opus-5.max.claude-code',
    plans: [CLAUDE_PRO_PLAN, CLAUDE_MAX_20X_PLAN],
  },
  {
    key: 'claude-sonnet-5.max.arena-agent-mode',
    basePresetId: 'builtin.agent.arena.claude-sonnet-5.max',
    plans: [CLAUDE_PRO_PLAN],
  },
  {
    key: 'claude-sonnet-4-6.max.claude-code',
    basePresetId: 'builtin.harness.claude-sonnet-4-6.max.claude-code',
    plans: [CLAUDE_PRO_PLAN],
  },
  {
    key: 'claude-haiku-4-5.max.chat',
    basePresetId: 'builtin.data-md.claude-haiku-4-5.max.vertex',
    plans: [CLAUDE_PRO_PLAN],
  },
  {
    key: 'gemini-3-1-pro.high.gemini-cli',
    basePresetId: 'builtin.harness.gemini-3-1-pro.high.gemini-cli',
    plans: [GOOGLE_AI_PRO_PLAN, GOOGLE_AI_ULTRA_20X_PLAN],
  },
  {
    key: 'gemini-3-7-flash.high.antigravity-sdk',
    basePresetId: 'builtin.harness.gemini-3-7-flash.high.antigravity-sdk',
    plans: [GOOGLE_AI_PRO_PLAN, GOOGLE_AI_ULTRA_20X_PLAN],
  },
  {
    key: 'gemini-3-7-flash.high.opencode',
    basePresetId: 'builtin.harness.gemini-3-7-flash.high.opencode',
    plans: [GOOGLE_AI_PRO_PLAN, GOOGLE_AI_ULTRA_20X_PLAN],
  },
  {
    key: 'gemini-3-5-flash-lite.high.chat',
    basePresetId: 'builtin.data-md.gemini-3-5-flash-lite.high.ai-studio',
    plans: [GOOGLE_AI_PRO_PLAN],
  },
  {
    key: 'grok-4-6.xhigh.chat',
    basePresetId: 'builtin.grok-4-6.xhigh',
    plans: [SUPERGROK_PLAN],
  },
];

const SUBSCRIPTION_CONFIGURATION_SPECS: readonly SubscriptionConfigurationSpec[] =
  SUBSCRIPTION_CONFIGURATION_TARGETS.flatMap((target) => target.plans.map((plan) => ({
    key: `subscription.${plan.key}.${target.key}`,
    basePresetId: target.basePresetId,
    planName: plan.planName,
    monthlyPriceUSD: plan.monthlyPriceUSD,
    apiEquivalentCostUSD: plan.apiEquivalentCostUSD,
    usableQuotaFraction: target.usableQuotaFraction ?? 1,
    note: [plan.note, target.note].filter(Boolean).join(' '),
  })));

/**
 * A subscription is a separate model+harness+access configuration. Capability
 * evidence stays tied to the identical model and production harness, while
 * practical cost uses the fixed monthly plan instead of pretending it is an
 * API route.
 */
function buildSubscriptionConfigurationPresets(
  candidates: readonly BuiltInConfigurationPreset[],
): BuiltInConfigurationPreset[] {
  return SUBSCRIPTION_CONFIGURATION_SPECS.map((spec) => {
    const base = candidates.find((preset) => preset.id === spec.basePresetId);
    if (!base) {
      throw new Error(`Missing subscription base preset ${spec.basePresetId}.`);
    }

    return definePreset({
      key: spec.key,
      productLineId: base.productLineId,
      identity: {
        model: { ...base.identity.model },
        harness: { ...base.identity.harness },
        provider: {
          name: spec.planName,
          upstream: `${spec.planName} fixed monthly plan`,
        },
      },
      origin: base.origin,
      access: 'subscription',
      subscriptionData: {
        planName: spec.planName,
        monthlyPriceUSD: spec.monthlyPriceUSD,
        apiEquivalentCostUSD: spec.apiEquivalentCostUSD,
        usableQuotaFraction: spec.usableQuotaFraction,
      },
      note: [base.note, spec.note].filter(Boolean).join(' '),
      ...(base.sourceCardIds
        ? { sourceCardIds: [...base.sourceCardIds] }
        : {}),
      ...(base.sourceCardLinks
        ? { sourceCardLinks: [...base.sourceCardLinks] }
        : {}),
    });
  });
}

const SUBSCRIPTION_CONFIGURATION_PRESETS =
  buildSubscriptionConfigurationPresets(
    PROVIDER_NEUTRAL_PRACTICAL_AUGMENTATION.presets,
  );

interface PresetCoverageProfile {
  availableDomainCount: number;
  availableDomainIds: readonly string[];
  availableMetricIds: readonly string[];
  scoringMetricCount: number;
  compatibleHarnessMetricCount: number;
  exactHarnessMetricCount: number;
  observationCount: number;
  practicalComponentCount: number;
  effectiveDataSignature: string;
}

const SCORING_METRIC_IDS = new Set(ALL_METRIC_DEFINITIONS.map((definition) => definition.id));

function presetCardIds(preset: BuiltInConfigurationPreset): string[] {
  return uniqueCardIds(
    preset.sourceCardIds,
    preset.sourceCardLinks?.map((link) => link.cardId),
  );
}

function presetCoverageCardDeclarations(
  preset: BuiltInConfigurationPreset,
): BuiltInConfigurationPresetSourceCardLink[] {
  const declarations: BuiltInConfigurationPresetSourceCardLink[] = [
    ...(preset.sourceCardIds || []).map((cardId) => ({
      cardId,
      provenance: { kind: 'exact' } as const,
    })),
    ...(preset.sourceCardLinks || []),
  ];
  const seen = new Set<string>();
  return declarations.filter(({ cardId }) => {
    if (seen.has(cardId)) return false;
    seen.add(cardId);
    return true;
  });
}

export function buildPresetCoverageProfiles(
  presets: readonly BuiltInConfigurationPreset[],
): Map<string, PresetCoverageProfile> {
  const observationsByCard = new Map<string, SourceObservation[]>();
  parseVerifiedSourceObservations().forEach((observation) => {
    const observations = observationsByCard.get(observation.sourceModelCardId) || [];
    observations.push(observation);
    observationsByCard.set(observation.sourceModelCardId, observations);
  });

  const metricDefinitionsByDomain = new Map<string, typeof ALL_METRIC_DEFINITIONS>();
  ALL_METRIC_DEFINITIONS.forEach((definition) => {
    const definitions = metricDefinitionsByDomain.get(definition.domain) || [];
    definitions.push(definition);
    metricDefinitionsByDomain.set(definition.domain, definitions);
  });

  return new Map(presets.map((preset) => {
    const compatibleHarnessMetricIds = new Set<string>();
    const exactHarnessMetricIds = new Set<string>();
    const observations = presetCoverageCardDeclarations(preset)
      .flatMap((declaration) => (
        (observationsByCard.get(declaration.cardId) || []).filter((observation) => {
          if (!isHarnessOnlyCapabilityMetric(observation.metricId)) return true;
          if (
            !isCapabilityMetricCompatibleWithSourceLink(
              observation.metricId,
              preset.identity.harness.name,
              declaration.provenance,
            )
          ) {
            return false;
          }
          compatibleHarnessMetricIds.add(observation.metricId);
          if (declaration.provenance.kind === 'exact') {
            exactHarnessMetricIds.add(observation.metricId);
          }
          return true;
        })
      ));
    const metricIds = new Set(observations.map((observation) => observation.metricId));
    const effectiveMetricValues = new Map<string, string>();
    observations.forEach((observation) => {
      if (
        effectiveMetricValues.has(observation.metricId)
        || (
          !SCORING_METRIC_IDS.has(observation.metricId)
          && !PRACTICAL_METRIC_IDS.has(observation.metricId)
        )
      ) return;
      effectiveMetricValues.set(
        observation.metricId,
        `${observation.rawValue}:${observation.unit}`,
      );
    });
    const availableDomainIds = [...metricDefinitionsByDomain.entries()]
      .filter(([, definitions]) => {
        const totalWeight = definitions.reduce(
          (sum, definition) => sum + definition.internalWeightInDomain,
          0,
        );
        const availableWeight = definitions.reduce(
          (sum, definition) => metricIds.has(definition.id)
            ? sum + definition.internalWeightInDomain
            : sum,
          0,
        );
        // "Available domain" means at least one real observation. Scoring
        // v1.1 permits every positive coverage level to be provisional, so
        // comparing against a zero provisional threshold would incorrectly
        // count completely empty domains as available.
        return totalWeight > 0 && availableWeight > Number.EPSILON;
      })
      .map(([domainId]) => domainId);
    const availableDomainCount = availableDomainIds.length;
    const scoringMetricCount = ALL_METRIC_DEFINITIONS
      .filter((definition) => metricIds.has(definition.id))
      .length;
    const practicalComponentCount = [...PRACTICAL_METRIC_IDS]
      .filter((metricId) => metricIds.has(metricId))
      .length;
    const subscriptionSignature = preset.subscriptionData
      ? [
          `plan=${preset.subscriptionData.planName}`,
          `monthly=${preset.subscriptionData.monthlyPriceUSD}`,
          `apiEquivalent=${preset.subscriptionData.apiEquivalentCostUSD}`,
          `usableQuota=${preset.subscriptionData.usableQuotaFraction}`,
        ].join(',')
      : null;
    const apiPricingSignature = preset.apiPricingData
      ? [
          `tier=${preset.apiPricingData.tierName}`,
          `input=${preset.apiPricingData.inputPricePerMToken}`,
          `output=${preset.apiPricingData.outputPricePerMToken}`,
          `cacheRead=${preset.apiPricingData.cacheReadPricePerMToken ?? 'unknown'}`,
          `effectiveDate=${preset.apiPricingData.effectiveDate}`,
        ].join(',')
      : null;
    return [preset.id, {
      availableDomainCount,
      availableDomainIds,
      availableMetricIds: [...metricIds].sort(),
      scoringMetricCount,
      compatibleHarnessMetricCount: compatibleHarnessMetricIds.size,
      exactHarnessMetricCount: exactHarnessMetricIds.size,
      observationCount: observations.length,
      practicalComponentCount,
      effectiveDataSignature: [
        ...[...effectiveMetricValues.entries()]
          .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
          .map(([metricId, value]) => `${metricId}=${value}`),
        ...(apiPricingSignature ? [`apiPricing:${apiPricingSignature}`] : []),
        ...(subscriptionSignature ? [`subscription:${subscriptionSignature}`] : []),
      ].join('|'),
    }];
  }));
}

function presetProfileStrength(profile: string): number {
  const normalized = profile.trim().toLocaleLowerCase('en-US');
  if (/\bnon[- ]?reasoning\b|\bnone\b|no[- ]?thinking/u.test(normalized)) return 0;
  if (/\bminimal\b/u.test(normalized)) return 1;
  if (/\blow\b/u.test(normalized)) return 2;
  if (/\bmedium\b/u.test(normalized)) return 3;
  if (/\bhigh\b/u.test(normalized) && !/\bx[- ]?high\b|\bxhigh\b/u.test(normalized)) return 4;
  if (/\bx[- ]?high\b|\bxhigh\b/u.test(normalized)) return 5;
  if (/\bmax\b|\breasoning\b|\bthinking\b|\bdefault\b/u.test(normalized)) return 6;
  return 6;
}

function presetModelGroupKey(preset: BuiltInConfigurationPreset): string {
  if (!preset.productLineId.startsWith('source-profile-')) return preset.productLineId;

  const profile = preset.identity.model.profile.toLocaleLowerCase('en-US');
  const removeRouteSuffix = /\b(?:search|grounding)\b/u.test(profile)
    ? /(?:[-–—_/ ]+)(?:search|grounding)\s*$/iu
    : /\bfast\b/u.test(profile)
      ? /(?:[-–—_/ ]+)fast\s*$/iu
      : /$a/u;
  const modelName = preset.identity.model.name
    .normalize('NFKC')
    .replace(removeRouteSuffix, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
  return `source-model:${modelName}`;
}

function isPlainChatPreset(preset: BuiltInConfigurationPreset): boolean {
  return isPlainChatHarness(preset.identity.harness.name);
}

function presetHarnessGroupKey(preset: BuiltInConfigurationPreset): string {
  if (isPlainChatPreset(preset)) return 'chat';
  return preset.identity.harness.name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US');
}

export const BUILT_IN_CONFIGURATION_RELEASE_CUTOFF = '2026-04-24';

/**
 * Explicit user-requested historical comparators. Their real release dates
 * remain in curation metadata; this list is the only exception to the default
 * DeepSeek V4 cutoff and therefore stays small, named, and auditable.
 */
export const BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS = [
  'gemini_31_pro',
  'gpt_55',
  'source-model:gpt-5.4',
  'claude_opus_47',
  'claude_opus_46',
  'source-model:claude sonnet 4.6',
  'kimi_k26',
  'claude_haiku_45',
] as const;

const PINNED_MODEL_GROUP_KEYS = new Set<string>(
  BUILT_IN_CONFIGURATION_PINNED_MODEL_GROUP_KEYS,
);

export const BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS = [
  'alibaba',
  'anthropic',
  'bytedance',
  'deepseek',
  'google',
  'meta',
  'minimax',
  'mistral',
  'moonshot',
  'nvidia',
  'openai',
  'tencent',
  'xai',
  'zai',
] as const;

const KEY_VENDOR_KEYS = new Set<string>(BUILT_IN_CONFIGURATION_KEY_VENDOR_KEYS);

export interface BuiltInConfigurationCurationRow {
  presetId: string;
  modelGroupKey: string;
  vendorKey: string;
  releaseDate: string;
  releaseEvidence:
    | 'vendor_release'
    | 'artificial_analysis'
    | 'openrouter_added'
    | 'explicit_model_date';
  keyVendor: boolean;
  explicitlyPinned: boolean;
  availableDomainCount: number;
  effectiveDataSignature: string;
}

interface ModelGroupMetadata {
  modelGroupKey: string;
  vendorKey: string;
  releaseDate: string;
  releaseEvidence: BuiltInConfigurationCurationRow['releaseEvidence'];
  keyVendor: boolean;
}

const VERIFIED_MODEL_RELEASE_DATE_OVERRIDES:
Readonly<Record<string, {
  releaseDate: string;
  releaseEvidence: BuiltInConfigurationCurationRow['releaseEvidence'];
}>> = {
  // Moonshot's official model page dates Kimi K3 to 2026-07-16. Data.md also
  // records that the 2026-07-17 run happened immediately after launch.
  kimi_k3: {
    releaseDate: '2026-07-16',
    releaseEvidence: 'vendor_release',
  },
};

function normalizedVendorKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (!normalized || /^(?:source-catalog|cross-source-catalog|unknown)$/u.test(normalized)) {
    return null;
  }
  if (/(?:^|-)openai(?:-|$)/u.test(normalized)) return 'openai';
  if (/(?:^|-)anthropic(?:-|$)/u.test(normalized)) return 'anthropic';
  if (/(?:^|-)google(?:-|$)|deepmind/u.test(normalized)) return 'google';
  if (/(?:^|-)x-ai(?:-|$)|(?:^|-)xai(?:-|$)|spacexai/u.test(normalized)) return 'xai';
  if (/(?:^|-)deepseek(?:-|$)/u.test(normalized)) return 'deepseek';
  if (/(?:^|-)qwen(?:-|$)|(?:^|-)alibaba(?:-|$)/u.test(normalized)) return 'alibaba';
  if (/(?:^|-)z-ai(?:-|$)|(?:^|-)zai(?:-|$)|zhipu/u.test(normalized)) return 'zai';
  if (/(?:^|-)moonshot(?:ai)?(?:-|$)|(?:^|-)kimi(?:-|$)/u.test(normalized)) return 'moonshot';
  if (/(?:^|-)minimax(?:-|$)/u.test(normalized)) return 'minimax';
  if (/(?:^|-)meta(?:-llama)?(?:-|$)/u.test(normalized)) return 'meta';
  if (/(?:^|-)mistral(?:ai)?(?:-|$)/u.test(normalized)) return 'mistral';
  if (/(?:^|-)nvidia(?:-|$)/u.test(normalized)) return 'nvidia';
  if (/(?:^|-)tencent(?:-|$)/u.test(normalized)) return 'tencent';
  if (/(?:^|-)bytedance(?:-|$)|byte-dance|seed-team/u.test(normalized)) return 'bytedance';
  if (/(?:^|-)xiaomi(?:-|$)/u.test(normalized)) return 'xiaomi';
  if (/(?:^|-)stepfun(?:-|$)/u.test(normalized)) return 'stepfun';
  if (/(?:^|-)ibm(?:-granite)?(?:-|$)/u.test(normalized)) return 'ibm';
  if (/(?:^|-)inception(?:-|$)/u.test(normalized)) return 'inception';
  if (/(?:^|-)arcee(?:-ai)?(?:-|$)/u.test(normalized)) return 'arcee';
  if (/(?:^|-)allenai(?:-|$)/u.test(normalized)) return 'allenai';
  if (/(?:^|-)intellect(?:-|$)/u.test(normalized)) return 'intellect';
  return normalized;
}

function vendorKeyFromModelName(value: string): string | null {
  const normalized = value.normalize('NFKC').toLocaleLowerCase('en-US');
  if (/\b(?:gpt|o1|o3|o4)\b|gpt-/u.test(normalized)) return 'openai';
  if (/\bclaude\b/u.test(normalized)) return 'anthropic';
  if (/\b(?:gemini|gemma)\b/u.test(normalized)) return 'google';
  if (/\bgrok\b/u.test(normalized)) return 'xai';
  if (/\bdeepseek\b/u.test(normalized)) return 'deepseek';
  if (/\bqwen\b/u.test(normalized)) return 'alibaba';
  if (/\bglm\b/u.test(normalized)) return 'zai';
  if (/\bkimi\b/u.test(normalized)) return 'moonshot';
  if (/\bminimax\b/u.test(normalized)) return 'minimax';
  if (/\b(?:llama|muse(?: spark| glimmer))\b/u.test(normalized)) return 'meta';
  if (/\bmistral\b/u.test(normalized)) return 'mistral';
  if (/\bnemotron\b/u.test(normalized)) return 'nvidia';
  if (/\b(?:hunyuan|hy3)\b/u.test(normalized)) return 'tencent';
  if (/\bmimo\b/u.test(normalized)) return 'xiaomi';
  if (/\bstep\b/u.test(normalized)) return 'stepfun';
  if (/\bgranite\b/u.test(normalized)) return 'ibm';
  return null;
}

function isIsoReleaseDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function explicitReleaseDateFromName(value: string): string | null {
  const normalized = value.normalize('NFKC');
  const separated = normalized.match(/(?:^|\D)(20\d{2})[-_/](\d{2})[-_/](\d{2})(?:\D|$)/u);
  const compact = normalized.match(/(?:^|\D)(20\d{2})(\d{2})(\d{2})(?:\D|$)/u);
  const candidate = separated
    ? `${separated[1]}-${separated[2]}-${separated[3]}`
    : compact
      ? `${compact[1]}-${compact[2]}-${compact[3]}`
      : null;
  return isIsoReleaseDate(candidate) ? candidate : null;
}

function buildModelGroupMetadata(
  modelGroupKey: string,
  group: readonly BuiltInConfigurationPreset[],
  cardsById: ReadonlyMap<string, SourceModelCard>,
): ModelGroupMetadata | null {
  const cards = uniqueCardIds(group.flatMap((preset) => presetCardIds(preset)))
    .flatMap((cardId) => {
      const card = cardsById.get(cardId);
      return card ? [card] : [];
    });

  const scopedVendor = cards.flatMap((card) => {
    const scopeVendor = normalizedVendorKey(card.metadataJson?.scope?.vendorId);
    return scopeVendor ? [scopeVendor] : [];
  })[0];
  const creatorVendor = cards.flatMap((card) => {
    const identity = card.metadataJson?.sourceIdentity;
    const creator = normalizedVendorKey(identity?.modelCreatorSlug)
      || normalizedVendorKey(identity?.modelCreatorName);
    return creator ? [creator] : [];
  })[0];
  const openRouterVendor = cards.flatMap((card) => {
    if (card.source !== 'openrouter') return [];
    const sourceRecordId = card.metadataJson?.sourceIdentity?.sourceRecordId;
    if (typeof sourceRecordId !== 'string') return [];
    const prefix = sourceRecordId.split('/')[0]?.split('#')[0];
    const vendor = normalizedVendorKey(prefix);
    return vendor ? [vendor] : [];
  })[0];
  const providerVendor = group.flatMap((preset) => {
    const vendor = normalizedVendorKey(preset.identity.provider.name);
    return vendor ? [vendor] : [];
  })[0];
  const modelVendor = group.flatMap((preset) => {
    const vendor = vendorKeyFromModelName(preset.identity.model.name);
    return vendor ? [vendor] : [];
  })[0];
  const vendorKey = scopedVendor || creatorVendor || openRouterVendor || modelVendor || providerVendor;
  if (!vendorKey) return null;

  const artificialAnalysisReleaseDates = cards.flatMap((card) => {
    if (card.source !== 'artificial_analysis') return [];
    const releaseDate = card.metadataJson?.sourceIdentity?.releaseDate;
    return isIsoReleaseDate(releaseDate) ? [releaseDate] : [];
  });
  const openRouterReleaseDates = cards.flatMap((card) => {
    if (card.source !== 'openrouter') return [];
    const created = card.metadataJson?.sourceIdentity?.createdUnixSeconds;
    if (typeof created !== 'number' || !Number.isFinite(created) || created <= 0) return [];
    return [new Date(created * 1000).toISOString().slice(0, 10)];
  });
  const explicitModelDates = group.flatMap((preset) => {
    const releaseDate = explicitReleaseDateFromName(preset.identity.model.name);
    return releaseDate ? [releaseDate] : [];
  });
  const verifiedOverride = VERIFIED_MODEL_RELEASE_DATE_OVERRIDES[modelGroupKey];
  const releaseEvidence = verifiedOverride?.releaseEvidence
    || (artificialAnalysisReleaseDates.length > 0
      ? 'artificial_analysis'
      : openRouterReleaseDates.length > 0
        ? 'openrouter_added'
        : explicitModelDates.length > 0
          ? 'explicit_model_date'
          : null);
  const releaseDates = verifiedOverride
    ? [verifiedOverride.releaseDate]
    : releaseEvidence === 'artificial_analysis'
      ? artificialAnalysisReleaseDates
      : releaseEvidence === 'openrouter_added'
        ? openRouterReleaseDates
        : explicitModelDates;
  const releaseDate = [...releaseDates].sort()[0];
  if (!releaseEvidence || !releaseDate) return null;

  return {
    modelGroupKey,
    vendorKey,
    releaseDate,
    releaseEvidence,
    keyVendor: KEY_VENDOR_KEYS.has(vendorKey),
  };
}

/**
 * Explicit reader-facing removals requested after inspecting the compact
 * catalog. Their source cards stay available in the mapping pool; only the
 * shipped configuration boxes are omitted.
 */
const READER_FACING_PRESET_EXCLUSIONS = new Set<string>([
  'builtin.source-catalog.source-profile-granite-4-1-8b.granite-4-1-8b',
  'builtin.source-catalog.source-profile-grok-4-3.grok-4-3',
  'builtin.source-catalog.source-profile-kimi-k2-7-code.kimi-k2-7-code',
  'builtin.source-catalog.source-profile-gemma-4-12b-reasoning.gemma-4-12b-reasoning',
  'builtin.source-catalog.source-profile-gemini-3-1-flash-lite-preview.gemini-3-1-flash-lite-preview',
]);

/**
 * These model lines are represented by their newly published production
 * Harness routes. Their ordinary model cards remain available as one-way
 * capability/practical fallbacks, while plain API configuration boxes stay
 * out of the reader-facing ranking. Subscription access routes are separate
 * configurations and are deliberately unaffected.
 */
const READER_FACING_PLAIN_API_PRODUCT_LINE_EXCLUSIONS = new Set<string>([
  'gemini_37_flash',
  'muse_spark_12',
]);

/**
 * The source sites expose hundreds of low-value execution variants. The
 * reader-facing catalog keeps only score-ready configurations, with one
 * strongest usable profile per independently measured Harness plus explicitly
 * requested subscription access routes. Models
 * released before the DeepSeek V4 cutoff are excluded. Key vendors may keep
 * several current model lines; every other vendor keeps only its newest
 * score-ready model. General source-catalog entries need five available
 * domains plus either direct Chatting evidence, compatible production-harness
 * evidence, or an explicit reader approval. This prevents a domain-only
 * reclassification such as τ³-Banking moving to Agentic Work from silently
 * expanding the catalog. The user's Data.md priority models may remain at the
 * scoring engine's four-domain floor. Source cards remain in the admin pool
 * even when their sparse configuration is not promoted to the ranking.
 */
function curateReaderFacingPresets(
  candidates: readonly BuiltInConfigurationPreset[],
): {
  presets: BuiltInConfigurationPreset[];
  rows: BuiltInConfigurationCurationRow[];
} {
  const coverageByPreset = buildPresetCoverageProfiles(candidates);
  const cardsById = new Map(parseVerifiedSourceCards().map((card) => [card.id, card]));
  const groups = new Map<string, BuiltInConfigurationPreset[]>();
  candidates.forEach((preset) => {
    if (READER_FACING_PRESET_EXCLUSIONS.has(preset.id)) return;
    if (
      preset.access === 'api'
      && isPlainChatPreset(preset)
      && READER_FACING_PLAIN_API_PRODUCT_LINE_EXCLUSIONS.has(preset.productLineId)
    ) return;
    const coverage = coverageByPreset.get(preset.id);
    const minimumDomains = preset.origin === 'source-catalog'
      ? 5
      : SCORING_CONFIG.readerCuration.minimumAvailableDomains;
    const sourceCatalogPromotionApproved = preset.origin !== 'source-catalog'
      || READER_APPROVED_SOURCE_CATALOG_PRODUCT_LINES.has(preset.productLineId)
      || coverage?.availableDomainIds.includes('chatting')
      || (coverage?.compatibleHarnessMetricCount || 0) > 0;
    if (
      !coverage
      || coverage.availableDomainCount < minimumDomains
      || !sourceCatalogPromotionApproved
    ) return;
    const key = presetModelGroupKey(preset);
    const group = groups.get(key) || [];
    group.push(preset);
    groups.set(key, group);
  });

  const metadataByGroup = new Map<string, ModelGroupMetadata>();
  groups.forEach((group, modelGroupKey) => {
    const metadata = buildModelGroupMetadata(modelGroupKey, group, cardsById);
    if (
      !metadata
      || (
        metadata.releaseDate < BUILT_IN_CONFIGURATION_RELEASE_CUTOFF
        && !PINNED_MODEL_GROUP_KEYS.has(modelGroupKey)
      )
    ) {
      groups.delete(modelGroupKey);
      return;
    }
    metadataByGroup.set(modelGroupKey, metadata);
  });

  const originRank: Record<BuiltInConfigurationPresetOrigin, number> = {
    'data-md': 3,
    'source-backed': 2,
    'opus-5-source-backed': 2,
    'source-catalog': 1,
  };
  const score = (preset: BuiltInConfigurationPreset) => coverageByPreset.get(preset.id)!;
  const byHighest = (
    left: BuiltInConfigurationPreset,
    right: BuiltInConfigurationPreset,
  ): number => (
    presetProfileStrength(right.identity.model.profile)
    - presetProfileStrength(left.identity.model.profile)
    || Number(isPlainChatPreset(right)) - Number(isPlainChatPreset(left))
    || score(right).availableDomainCount - score(left).availableDomainCount
    || score(right).practicalComponentCount - score(left).practicalComponentCount
    || score(right).scoringMetricCount - score(left).scoringMetricCount
    || originRank[right.origin] - originRank[left.origin]
    || left.id.localeCompare(right.id, 'en-US')
  );
  const selectedByGroup = new Map<string, BuiltInConfigurationPreset[]>();
  groups.forEach((group, modelGroupKey) => {
    const subscriptionPresets = group
      .filter((preset) => preset.access === 'subscription')
      .sort(byHighest);
    const apiPricingVariantPresets = group
      .filter((preset) => preset.access === 'api' && Boolean(preset.apiPricingData))
      .sort(byHighest);
    const primaryPresets = group.filter((preset) => (
      preset.access !== 'subscription' && !preset.apiPricingData
    ));
    const byHarness = new Map<string, BuiltInConfigurationPreset[]>();
    primaryPresets.forEach((preset) => {
      const harnessKey = presetHarnessGroupKey(preset);
      const harnessGroup = byHarness.get(harnessKey) || [];
      harnessGroup.push(preset);
      byHarness.set(harnessKey, harnessGroup);
    });
    const selectedPerHarness = [...byHarness.values()]
      .map((harnessGroup) => [...harnessGroup].sort(byHighest)[0]);
    const chatPreset = selectedPerHarness.find(isPlainChatPreset);
    const harnessCandidates = selectedPerHarness
      .filter((preset) => !isPlainChatPreset(preset))
      .filter((preset) => {
        const coverage = score(preset);
        if (coverage.compatibleHarnessMetricCount <= 0) return false;
        return preset.identity.harness.name === 'AA Agent Harness'
          ? coverage.availableDomainIds.includes('agentic_work')
          : (
            coverage.availableDomainIds.includes('engineering')
            || coverage.availableDomainIds.includes('agentic_work')
          );
      })
      .sort((left, right) => (
        score(right).availableDomainCount - score(left).availableDomainCount
        || score(right).exactHarnessMetricCount - score(left).exactHarnessMetricCount
        || score(right).scoringMetricCount - score(left).scoringMetricCount
        || byHighest(left, right)
      ));

    if (chatPreset && harnessCandidates.length > 0) {
      const bestHarness = harnessCandidates[0];
      // A real, user-selectable Agent/CLI product with exact mode-specific
      // evidence supersedes the plain Chat row in the compact leaderboard.
      // Chat observations still fill that configuration in the one permitted
      // direction, so retaining both would duplicate the weaker execution.
      selectedByGroup.set(modelGroupKey, [
        bestHarness,
        ...apiPricingVariantPresets,
        ...subscriptionPresets,
      ]);
      return;
    }

    selectedByGroup.set(modelGroupKey, [
      ...selectedPerHarness,
      ...apiPricingVariantPresets,
      ...subscriptionPresets,
    ]);
  });

  const nonKeyGroupsByVendor = new Map<string, string[]>();
  metadataByGroup.forEach((metadata, modelGroupKey) => {
    if (metadata.keyVendor || !selectedByGroup.has(modelGroupKey)) return;
    const vendorGroups = nonKeyGroupsByVendor.get(metadata.vendorKey) || [];
    vendorGroups.push(modelGroupKey);
    nonKeyGroupsByVendor.set(metadata.vendorKey, vendorGroups);
  });
  nonKeyGroupsByVendor.forEach((modelGroupKeys) => {
    const newest = [...modelGroupKeys].sort((left, right) => {
      const leftMetadata = metadataByGroup.get(left)!;
      const rightMetadata = metadataByGroup.get(right)!;
      const leftPresets = selectedByGroup.get(left)!;
      const rightPresets = selectedByGroup.get(right)!;
      const bestCoverage = (presets: readonly BuiltInConfigurationPreset[]) => Math.max(
        ...presets.map((preset) => score(preset).availableDomainCount),
      );
      const bestMetrics = (presets: readonly BuiltInConfigurationPreset[]) => Math.max(
        ...presets.map((preset) => score(preset).scoringMetricCount),
      );
      return rightMetadata.releaseDate.localeCompare(leftMetadata.releaseDate, 'en-US')
        || bestCoverage(rightPresets) - bestCoverage(leftPresets)
        || bestMetrics(rightPresets) - bestMetrics(leftPresets)
        || left.localeCompare(right, 'en-US');
    })[0];
    modelGroupKeys
      .filter((modelGroupKey) => modelGroupKey !== newest)
      .forEach((modelGroupKey) => selectedByGroup.delete(modelGroupKey));
  });

  const selected = [...selectedByGroup.values()].flat();
  const seenDisplayNames = new Set<string>();
  const presets = selected.filter((preset) => {
    if (seenDisplayNames.has(preset.displayName)) return false;
    seenDisplayNames.add(preset.displayName);
    return true;
  });
  const rows = presets.flatMap((preset) => {
    const modelGroupKey = presetModelGroupKey(preset);
    const metadata = metadataByGroup.get(modelGroupKey);
    const coverage = coverageByPreset.get(preset.id);
    if (!metadata || !coverage) return [];
    return [{
      presetId: preset.id,
      modelGroupKey,
      vendorKey: metadata.vendorKey,
      releaseDate: metadata.releaseDate,
      releaseEvidence: metadata.releaseEvidence,
      keyVendor: metadata.keyVendor,
      explicitlyPinned: PINNED_MODEL_GROUP_KEYS.has(modelGroupKey),
      availableDomainCount: coverage.availableDomainCount,
      effectiveDataSignature: coverage.effectiveDataSignature,
    }];
  });
  return { presets, rows };
}

export const ALL_CONFIGURATION_PRESET_CANDIDATES: readonly BuiltInConfigurationPreset[] = [
  ...PROVIDER_NEUTRAL_PRACTICAL_AUGMENTATION.presets,
  ...API_PRICING_VARIANT_PRESETS,
  ...SUBSCRIPTION_CONFIGURATION_PRESETS,
];

const READER_FACING_CONFIGURATION_CURATION =
  curateReaderFacingPresets(ALL_CONFIGURATION_PRESET_CANDIDATES);

/**
 * Compact reader-facing inventory. Sparse source records remain available as
 * cards for future matching but no longer flood the leaderboard as
 * "数据不足" configurations.
 */
export const BUILT_IN_CONFIGURATION_PRESETS: readonly BuiltInConfigurationPreset[] =
  READER_FACING_CONFIGURATION_CURATION.presets;
export const BUILT_IN_CONFIGURATION_CURATION_ROWS:
readonly BuiltInConfigurationCurationRow[] =
  READER_FACING_CONFIGURATION_CURATION.rows;

const BUILT_IN_MODEL_GROUP_COUNTS = BUILT_IN_CONFIGURATION_PRESETS
  .reduce<Map<string, number>>((counts, preset) => {
    const key = presetModelGroupKey(preset);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());

export const BUILT_IN_CONFIGURATION_MODEL_GROUP_COUNT = BUILT_IN_MODEL_GROUP_COUNTS.size;
export const BUILT_IN_CONFIGURATION_MAX_PER_MODEL = Math.max(
  0,
  ...BUILT_IN_MODEL_GROUP_COUNTS.values(),
);
export const DATA_MD_CONFIGURATION_PRESET_COUNT = BUILT_IN_CONFIGURATION_PRESETS
  .filter((preset) => preset.origin === 'data-md')
  .length;
export const CLAUDE_OPUS_5_CONFIGURATION_PRESET_COUNT = BUILT_IN_CONFIGURATION_PRESETS
  .filter((preset) => preset.origin === 'opus-5-source-backed')
  .length;
export const REVIEWED_EQUIVALENT_CARD_ATTACHMENT_COUNT =
  HAND_AUTHORED_EQUIVALENCE_AUGMENTATION.attachedCardCount;
export const PROVIDER_NEUTRAL_PRACTICAL_CARD_ATTACHMENT_COUNT =
  PROVIDER_NEUTRAL_PRACTICAL_AUGMENTATION.attachedCardCount;
export const SOURCE_CATALOG_CONFIGURATION_PRESET_COUNT = BUILT_IN_CONFIGURATION_PRESETS
  .filter((preset) => preset.origin === 'source-catalog')
  .length;
export const BUILT_IN_CONFIGURATION_PRESET_COUNT = BUILT_IN_CONFIGURATION_PRESETS.length;

/**
 * Changing this value tells the running application to reconcile the bundled
 * inventory with its persisted local configuration store.  It makes catalogue
 * additions visible during Vite hot updates as well as after a full reload.
 */
export const BUILT_IN_CONFIGURATION_PRESET_INVENTORY_VERSION =
  '2026-08-16-muse-two-harness-api-price-matrix-v44';
