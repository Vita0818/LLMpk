/**
 * Reader inventory decisions, separate from source retention and scoring.
 * Superseded releases leave every shipped access/harness route together;
 * their original source records remain available for provenance and imports.
 */
export interface ReaderModelRetirement {
  modelGroupKey: string;
  successorModelGroupKey: string;
  sourceUrl: string;
}

export const READER_MODEL_RETIREMENTS: readonly ReaderModelRetirement[] = [
  { modelGroupKey: 'gpt_56_sol', successorModelGroupKey: 'gpt_61_sol', sourceUrl: 'https://developers.openai.com/api/docs/guides/latest-model' },
  { modelGroupKey: 'gpt_6_sol', successorModelGroupKey: 'gpt_61_sol', sourceUrl: 'https://developers.openai.com/api/docs/guides/latest-model' },
  { modelGroupKey: 'gpt_56_luna', successorModelGroupKey: 'gpt_6_luna', sourceUrl: 'https://developers.openai.com/api/docs/guides/latest-model' },
  { modelGroupKey: 'claude_fable_5', successorModelGroupKey: 'claude_fable_51', sourceUrl: 'https://www.anthropic.com/claude-fable-and-mythos-5-1' },
  ...['claude_opus_45', 'claude_opus_46', 'claude_opus_47', 'claude_opus_48', 'claude_opus_5'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'claude_opus_55', sourceUrl: 'https://platform.claude.com/docs/en/models/overview',
  })),
  ...['claude_sonnet_5', 'source-model:claude sonnet 4.6'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'claude_sonnet_55', sourceUrl: 'https://platform.claude.com/docs/en/models/overview',
  })),
  ...['gemini_35_flash', 'gemini_36_flash', 'gemini_37_flash'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'gemini_38_flash', sourceUrl: 'https://ai.google.dev/gemini-api/docs/models',
  })),
  ...['muse_spark_11', 'muse_spark_12'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'muse_spark_13', sourceUrl: 'https://developer.meta.com/docs/muse-spark-1-3',
  })),
  ...['grok_45', 'grok_46', 'source-model:grok 4.3'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'grok_47', sourceUrl: 'https://docs.x.ai/developers/models',
  })),
  { modelGroupKey: 'glm_52', successorModelGroupKey: 'glm_53', sourceUrl: 'https://docs.z.ai/guides/llm/glm-5.3' },
  { modelGroupKey: 'kimi_k26', successorModelGroupKey: 'kimi_k3', sourceUrl: 'https://platform.moonshot.ai/docs/guide/start-using-kimi' },
  ...['deepseek_v4_flash', 'deepseek_v4_flash_0731', 'deepseek_v4_pro', 'deepseek_v4_pro_0813'].map((modelGroupKey) => ({
    modelGroupKey, successorModelGroupKey: 'deepseek_v41_flash', sourceUrl: 'https://api-docs.deepseek.com/news/news260910/',
  })),
  { modelGroupKey: 'hunyuan_hy3', successorModelGroupKey: 'hy4_preview', sourceUrl: 'https://huggingface.co/tencent/Hy4-preview' },
  { modelGroupKey: 'mimo_v25_pro', successorModelGroupKey: 'mimo_v26_pro', sourceUrl: 'https://mimo.mi.com/docs/en-US/news/latest/v2-6' },
  { modelGroupKey: 'qwen_36_27b', successorModelGroupKey: 'qwen_38_27b', sourceUrl: 'https://www.alibabacloud.com/help/en/model-studio/models' },
  { modelGroupKey: 'qwen_37_max', successorModelGroupKey: 'qwen_38_max', sourceUrl: 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen3-8-max' },
];

export const RETIRED_READER_MODEL_GROUP_KEYS: ReadonlySet<string> = new Set(
  READER_MODEL_RETIREMENTS.map((retirement) => retirement.modelGroupKey),
);

/** Reviewed inventory after successor pruning. Scoring changes cannot silently expand it. */
export const READER_CURRENT_MODEL_GROUP_KEYS: ReadonlySet<string> = new Set(
[
  "claude_fable_51",
  "claude_opus_55",
  "claude_sonnet_55",
  "command_a_plus",
  "deepseek_v41_flash",
  "gemini_35_flash_lite",
  "gemini_38_flash",
  "glm_53",
  "glm_53_flash",
  "gpt_56_terra",
  "gpt_61_sol",
  "gpt_6_astra",
  "gpt_6_luna",
  "grok_47",
  "hy4_preview",
  "inkling",
  "kimi_k3",
  "longcat_20",
  "mimo_v26_pro",
  "minimax_m3",
  "mistral_medium_35",
  "muse_glimmer",
  "muse_spark_13",
  "nemotron_35_lightning",
  "qwen_37_plus",
  "qwen_38_24t_a95b",
  "qwen_38_27b",
  "qwen_38_flash_next",
  "qwen_38_max",
  "step_5_preview"
]
);
