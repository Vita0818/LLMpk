/**
 * Explicit, source-backed API effort-profile evidence.
 *
 * This is intentionally a small curated table, not a model-name matcher.
 * Every card ID is a stable record from the bundled three-source catalog.
 * Availability-only tiers were cross-checked against the official OpenRouter
 * `/api/v1/models` `reasoning.supported_efforts` field on 2026-07-27. A
 * profile can borrow only cards from a strictly lower numeric level; the
 * caller receives those cards in nearest-lower-first order.
 */

export interface ApiProfileTierEvidence {
  /** Stable key used by the built-in configuration generator. */
  key: string;
  /** Public/API-facing profile label shown in the configuration identity. */
  label: string;
  /** Explicit one-way effort ordering within this exact product line. */
  level: number;
  /** Exact capability cards for this profile; never inferred by name. */
  exactCapabilityCardIds: readonly string[];
}

export interface ApiProfileFamilyEvidence {
  productLineId: string;
  tiers: readonly ApiProfileTierEvidence[];
}

const tier = (
  key: string,
  label: string,
  level: number,
  exactCapabilityCardIds: readonly string[] = [],
): ApiProfileTierEvidence => ({ key, label, level, exactCapabilityCardIds });

/**
 * Only families with a source-published or otherwise explicitly labelled
 * effort profile live here. A card whose source omits the effort is not
 * silently treated as a tier and therefore cannot create a fallback.
 */
export const API_PROFILE_FAMILIES: readonly ApiProfileFamilyEvidence[] = [
  {
    productLineId: 'gpt_56_sol',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gpt-5-6-sol-non-reasoning']),
      tier('low', 'Low', 1, ['card-aa-gpt-5-6-sol-low']),
      tier('medium', 'Medium', 2, ['card-aa-gpt-5-6-sol-medium']),
      tier('high', 'High', 3, ['card-aa-gpt-5-6-sol-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-gpt-5-6-sol-xhigh', 'card-arena-gpt-5-6-sol-xhigh']),
      tier('max', 'Max', 5, ['card-aa-gpt-5-6-sol']),
    ],
  },
  {
    productLineId: 'gpt_56_terra',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gpt-5-6-terra-non-reasoning']),
      tier('low', 'Low', 1, ['card-aa-gpt-5-6-terra-low']),
      tier('medium', 'Medium', 2, ['card-aa-gpt-5-6-terra-medium']),
      tier('high', 'High', 3, ['card-aa-gpt-5-6-terra-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-gpt-5-6-terra-xhigh']),
      tier('max', 'Max', 5, ['card-aa-gpt-5-6-terra']),
    ],
  },
  {
    productLineId: 'gpt_56_luna',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gpt-5-6-luna-non-reasoning']),
      tier('low', 'Low', 1, ['card-aa-gpt-5-6-luna-low']),
      tier('medium', 'Medium', 2, ['card-aa-gpt-5-6-luna-medium']),
      tier('high', 'High', 3, ['card-aa-gpt-5-6-luna-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-gpt-5-6-luna-xhigh']),
      tier('max', 'Max', 5, ['card-aa-gpt-5-6-luna']),
    ],
  },
  {
    productLineId: 'gpt_55',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gpt-5-5-non-reasoning']),
      tier('low', 'Low', 1, ['card-aa-gpt-5-5-low']),
      tier('medium', 'Medium', 2, ['card-aa-gpt-5-5-medium']),
      tier('high', 'High', 3, ['card-aa-gpt-5-5-high', 'card-arena-gpt-5-5-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-gpt-5-5', 'card-arena-gpt-5-5-xhigh']),
      // The source catalog does not publish a Max card; XHigh is its closest
      // permitted fallback and is deliberately not relabelled as Max.
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'deepseek_v4_flash_0731',
    tiers: [
      tier('high', 'High', 3, ['card-arena-deepseek-v4-flash-high']),
      tier('max', 'Max', 5, ['card-aa-deepseek-v4-flash']),
    ],
  },
  {
    productLineId: 'deepseek_v4_flash',
    tiers: [
      tier('none', 'None', 0, ['card-aa-deepseek-v4-flash-non-reasoning', 'card-arena-deepseek-v4-flash']),
      tier('high', 'High', 3, ['card-aa-deepseek-v4-flash-0420-high', 'card-arena-deepseek-v4-flash-high-preview']),
      // OpenRouter publishes XHigh availability, but no XHigh capability card.
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-deepseek-v4-flash-0420']),
    ],
  },
  {
    productLineId: 'deepseek_v4_pro_0813',
    tiers: [
      tier('low', 'Low', 1),
      tier('high', 'High', 3, ['card-arena-deepseek-v4-pro-high-20260813']),
      tier('max', 'Max', 5, ['card-aa-deepseek-v4-pro']),
    ],
  },
  {
    productLineId: 'deepseek_v4_pro',
    tiers: [
      tier('none', 'None', 0, ['card-aa-deepseek-v4-pro-0424-non-reasoning', 'card-arena-deepseek-v4-pro']),
      tier('high', 'High', 3, ['card-aa-deepseek-v4-pro-0424-high', 'card-arena-deepseek-v4-pro-high-preview']),
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-deepseek-v4-pro-0424']),
    ],
  },
  {
    productLineId: 'glm_52',
    tiers: [
      tier('none', 'None', 0, ['card-aa-glm-5-2-non-reasoning']),
      tier('high', 'High', 3),
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-glm-5-2', 'card-arena-glm-5-2-max']),
    ],
  },
  {
    productLineId: 'glm_53',
    tiers: [
      // Z.ai also documents Low and High, but the published leaderboard only
      // exposes a score-backed Max configuration until those tiers receive
      // independent capability measurements.
      tier('max', 'Max', 5, ['card-aa-glm-5-3', 'card-arena-glm-5-3-max']),
    ],
  },
  {
    productLineId: 'claude_fable_5',
    tiers: [
      tier('minimal', 'Minimal', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-arena-claude-fable-5-high']),
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-claude-fable-5']),
    ],
  },
  {
    productLineId: 'claude_opus_45',
    tiers: [
      tier('none', 'None', 0, ['card-aa-claude-opus-4-5']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-claude-opus-4-5-thinking']),
    ],
  },
  {
    productLineId: 'claude_opus_46',
    tiers: [
      tier('none', 'None', 0, ['card-aa-claude-opus-4-6']),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3),
      tier('max', 'Max', 5, ['card-aa-claude-opus-4-6-adaptive']),
    ],
  },
  {
    productLineId: 'claude_opus_47',
    tiers: [
      tier('none', 'None', 0, ['card-aa-claude-opus-4-7-non-reasoning']),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-arena-claude-opus-4-7-high']),
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-claude-opus-4-7']),
    ],
  },
  {
    productLineId: 'claude_opus_48',
    tiers: [
      // The Data.md None configuration remains distinct even though the
      // current published OpenRouter effort list begins at Low.
      tier('none', 'None', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-arena-claude-opus-4-8-high']),
      tier('xhigh', 'XHigh', 4),
      tier('max', 'Max', 5, ['card-aa-claude-opus-4-8']),
    ],
  },
  {
    productLineId: 'claude_haiku_45',
    tiers: [
      tier('none', 'None', 0, ['card-aa-claude-4-5-haiku']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-claude-4-5-haiku-reasoning']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'claude_sonnet_5',
    tiers: [
      tier('none', 'None', 0, ['card-aa-claude-sonnet-5-non-reasoning']),
      tier('low', 'Low', 1, ['card-aa-claude-sonnet-5-low']),
      tier('medium', 'Medium', 2, ['card-aa-claude-sonnet-5-medium']),
      tier('high', 'High', 3, ['card-aa-claude-sonnet-5-high', 'card-arena-claude-sonnet-5-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-claude-sonnet-5-xhigh']),
      tier('max', 'Max', 5, ['card-aa-claude-sonnet-5']),
    ],
  },
  {
    productLineId: 'gemini_31_pro',
    tiers: [
      tier('low', 'Low', 1),
      // The official API record names Medium as the default effort, so the
      // unlabelled AA/Arena rows belong here rather than being copied to Low.
      tier('medium', 'Medium', 2, ['card-aa-gemini-3-1-pro-preview', 'card-arena-gemini-3-1-pro-preview']),
      tier('high', 'High', 3),
    ],
  },
  {
    productLineId: 'gemini_37_flash',
    tiers: [
      tier('low', 'Low', 1, ['card-aa-gemini-3-7-flash-low']),
      tier('medium', 'Medium', 2, ['card-aa-gemini-3-7-flash-medium']),
      tier('high', 'High', 3, [
        'card-aa-gemini-3-7-flash',
        'card-arena-gemini-3-7-flash-high',
      ]),
    ],
  },
  {
    productLineId: 'gemini_35_flash',
    tiers: [
      tier('minimal', 'Minimal', 0, ['card-aa-gemini-3-5-flash-minimal']),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2, ['card-aa-gemini-3-5-flash-medium', 'card-arena-gemini-3-5-flash-medium']),
      tier('high', 'High', 3, ['card-aa-gemini-3-5-flash', 'card-arena-gemini-3-5-flash-high']),
    ],
  },
  {
    productLineId: 'gemini_35_flash_lite',
    tiers: [
      // The model API lists Minimal as default; the source rows did not
      // carry an effort suffix, so they are pinned to that documented tier.
      tier('minimal', 'Minimal', 0, ['card-aa-gemini-3-5-flash-lite', 'card-arena-gemini-3-5-flash-lite']),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3),
    ],
  },
  {
    productLineId: 'gemini_36_flash',
    tiers: [
      tier('minimal', 'Minimal', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2, ['card-aa-gemini-3-6-flash']),
      tier('high', 'High', 3, ['card-arena-gemini-3-6-flash-high']),
    ],
  },
  {
    productLineId: 'gemini_31_flash_lite',
    tiers: [
      // Availability is published, but this catalog currently has price-only
      // evidence for the stable model, so no capability card is attached.
      tier('minimal', 'Minimal', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3),
    ],
  },
  {
    productLineId: 'gemini_25_flash_lite',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gemini-2-5-flash-lite']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-gemini-2-5-flash-lite-reasoning']),
    ],
  },
  {
    productLineId: 'hunyuan_hy3',
    tiers: [
      tier('none', 'None', 0),
      tier('low', 'Low', 1),
      tier('high', 'High', 3, ['card-aa-hy3', 'card-arena-hy3']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'kimi_k3',
    tiers: [
      tier('low', 'Low', 1),
      tier('high', 'High', 3),
      // The current Arena coding/agent observations were produced through
      // Kimi Code. They belong to the Kimi Code CLI configuration, not Chat.
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'muse_glimmer',
    tiers: [
      tier('low', 'Low', 1),
      // Arena publishes the unsuffixed/default profile; OpenRouter documents
      // Medium as the model's default effort, so it belongs here.
      tier('medium', 'Medium', 2, ['card-arena-muse-glimmer']),
      tier('high', 'High', 3, ['card-aa-muse-glimmer']),
      tier('xhigh', 'XHigh', 4),
    ],
  },
  {
    productLineId: 'muse_spark_12',
    tiers: [
      tier('minimal', 'Minimal', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3),
      tier('xhigh', 'XHigh', 4, [
        'card-aa-muse-spark-1-2',
        'card-arena-muse-spark-1-2-xhigh',
      ]),
    ],
  },
  {
    productLineId: 'muse_spark_11',
    tiers: [
      tier('minimal', 'Minimal', 0),
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2, ['card-arena-muse-spark-1-1']),
      tier('high', 'High', 3),
      tier('xhigh', 'XHigh', 4, ['card-aa-muse-spark-1-1']),
    ],
  },
  {
    productLineId: 'mistral_medium_35',
    tiers: [
      tier('none', 'None', 0),
      tier('high', 'High', 3, ['card-aa-mistral-medium-3-5', 'card-arena-mistral-medium-3-5']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'step_37_flash',
    tiers: [
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2, ['card-aa-step-3-7-flash']),
      tier('high', 'High', 3),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'grok_46',
    tiers: [
      tier('low', 'Low', 1, ['card-aa-grok-4-6-low']),
      tier('medium', 'Medium', 2, ['card-aa-grok-4-6-medium']),
      tier('high', 'High', 3, ['card-aa-grok-4-6', 'card-arena-grok-4-6-high']),
      tier('xhigh', 'XHigh', 4, ['card-aa-grok-4-6-xhigh']),
    ],
  },
  {
    productLineId: 'grok_45',
    tiers: [
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-aa-grok-4-5', 'card-arena-grok-4-5']),
    ],
  },
  {
    productLineId: 'gemma_4_31b',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gemma-4-31b-non-reasoning']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-gemma-4-31b']),
      tier('high', 'High', 3),
    ],
  },
  {
    productLineId: 'gemma_4_26b_a4b',
    tiers: [
      tier('none', 'None', 0, ['card-aa-gemma-4-26b-a4b-non-reasoning']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-gemma-4-26b-a4b']),
      tier('high', 'High', 3),
    ],
  },
  {
    productLineId: 'qwen_36_27b',
    tiers: [
      tier('none', 'None', 0, ['card-aa-qwen3-6-27b-non-reasoning']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-qwen3-6-27b']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'qwen_36_35b_a3b',
    tiers: [
      tier('none', 'None', 0, ['card-aa-qwen3-6-35b-a3b-non-reasoning']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-qwen3-6-35b-a3b']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'qwen_38_max',
    tiers: [
      // OpenRouter publishes XHigh as Qwen3.8 Max's default reasoning effort;
      // the AA Coding Agent row uses that model identity without restating it.
      tier('xhigh', 'XHigh', 4, ['card-aa-qwen3-8-max']),
    ],
  },
  {
    productLineId: 'qwen_38_27b',
    tiers: [
      // The official OpenRouter route defaults to XHigh and AA publishes the
      // corresponding current model record.
      tier('xhigh', 'XHigh', 4, ['card-aa-qwen3-8-27b']),
    ],
  },
  {
    productLineId: 'gpt_oss_120b',
    tiers: [
      tier('low', 'Low', 1, ['card-aa-gpt-oss-120b-low']),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-aa-gpt-oss-120b']),
    ],
  },
  {
    productLineId: 'gpt_oss_20b',
    tiers: [
      tier('low', 'Low', 1, ['card-aa-gpt-oss-20b-low']),
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-aa-gpt-oss-20b']),
    ],
  },
  {
    productLineId: 'nemotron_3_nano',
    tiers: [
      tier('none', 'None', 0, ['card-aa-nvidia-nemotron-3-nano-30b-a3b']),
      tier('reasoning', 'Reasoning', 1, ['card-aa-nvidia-nemotron-3-nano-30b-a3b-reasoning']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'nemotron_3_super',
    tiers: [
      tier('low', 'Low', 1),
      tier('medium', 'Medium', 2, ['card-aa-nvidia-nemotron-3-super-120b-a12b']),
      tier('max', 'Max', 5),
    ],
  },
  {
    productLineId: 'nemotron_3_ultra',
    tiers: [
      tier('medium', 'Medium', 2),
      tier('high', 'High', 3, ['card-aa-nvidia-nemotron-3-ultra-550b-a55b']),
      tier('max', 'Max', 5),
    ],
  },
];

export interface ApiProfileFallbackCard {
  cardId: string;
  sourceProfile: string;
  sourceLevel: number;
  targetProfile: string;
  targetLevel: number;
}

export interface ApiProfileCardPlan {
  exactCardIds: readonly string[];
  lowerFallbackCards: readonly ApiProfileFallbackCard[];
}

export function getApiProfileTier(
  productLineId: string,
  profileKey: string,
): ApiProfileTierEvidence | null {
  const family = API_PROFILE_FAMILIES.find((candidate) => candidate.productLineId === productLineId);
  return family?.tiers.find((candidate) => candidate.key === profileKey) || null;
}

/**
 * Builds an auditable card plan for one exact API model/profile. The caller
 * may add a route-specific price card separately; price cards never become a
 * capability fallback through this helper.
 */
export function planApiProfileCards(
  productLineId: string,
  profileKey: string,
  targetProfile: string,
): ApiProfileCardPlan | null {
  const family = API_PROFILE_FAMILIES.find((candidate) => candidate.productLineId === productLineId);
  const target = family?.tiers.find((candidate) => candidate.key === profileKey);
  if (!family || !target) return null;

  const lowerFallbackCards = family.tiers
    .filter((candidate) => candidate.level < target.level)
    .sort((left, right) => right.level - left.level)
    .flatMap((candidate) => candidate.exactCapabilityCardIds.map((cardId) => ({
      cardId,
      sourceProfile: candidate.label,
      sourceLevel: candidate.level,
      targetProfile,
      targetLevel: target.level,
    })));

  return {
    exactCardIds: target.exactCapabilityCardIds,
    lowerFallbackCards,
  };
}
