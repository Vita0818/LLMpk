import assert from 'node:assert/strict';
import { OAGXM_SCOPE, classifyOagxmModel } from '../src/data/oagxmScope';

/**
 * The scope is deliberately an explicit Data.md product inventory, rather
 * than a vendor-wide prefix filter.  These representative names cover every
 * product line requested from Data.md plus newly source-backed product lines.
 * Gemini 3.1 Pro and its Preview are intentionally one product line with
 * source-published profiles kept as separate source cards.
 */
const expectedProductLines: Array<[string, string]> = [
  ['DeepSeek-v4-Flash', 'deepseek_v4_flash'],
  ['DeepSeek-v4-Flash-0731', 'deepseek_v4_flash_0731'],
  ['DeepSeek V4 Pro 0813', 'deepseek_v4_pro_0813'],
  ['deepseek/deepseek-v4-pro-20260813', 'deepseek_v4_pro_0813'],
  ['deepseek-v4-pro-max-20260813', 'deepseek_v4_pro_0813'],
  ['deepseek-v4-pro-high-20260813', 'deepseek_v4_pro_0813'],
  ['DeepSeek-v4-Pro', 'deepseek_v4_pro'],
  ['GLM-5.2', 'glm_52'],
  ['Hy3', 'hunyuan_hy3'],
  ['Kimi K2.6', 'kimi_k26'],
  ['Kimi K3', 'kimi_k3'],
  ['MiniMax M3', 'minimax_m3'],
  ['Qwen3.8-Max-Preview', 'qwen_38_max_preview'],
  ['Qwen3.7-Max', 'qwen_37_max'],
  ['Qwen3.7-Plus', 'qwen_37_plus'],
  ['Seed-2.1-Turbo', 'seed_21_turbo'],
  ['LongCat 2.0', 'longcat_20'],
  ['KAT-Coder-Pro V2.5', 'kat_coder_pro_v25'],
  ['Mimo V2.5 Pro', 'mimo_v25_pro'],
  ['Step 3.7 Flash', 'step_37_flash'],
  ['GPT-5.6 Sol', 'gpt_56_sol'],
  ['GPT-5.6 Terra', 'gpt_56_terra'],
  ['GPT-5.6 Luna', 'gpt_56_luna'],
  ['GPT-5.5', 'gpt_55'],
  ['GPT-OSS-120B', 'gpt_oss_120b'],
  ['GPT-OSS-20B', 'gpt_oss_20b'],
  ['Claude Fable 5', 'claude_fable_5'],
  ['Claude Opus 4.8', 'claude_opus_48'],
  ['Claude Opus 4.7', 'claude_opus_47'],
  ['Claude Opus 4.6', 'claude_opus_46'],
  ['Claude Opus 4.5', 'claude_opus_45'],
  ['Claude Sonnet 5', 'claude_sonnet_5'],
  ['Claude Haiku 4.5', 'claude_haiku_45'],
  ['Claude Opus 5', 'claude_opus_5'],
  ['Gemini 3.1 Pro', 'gemini_31_pro'],
  ['Gemini 3.1 Pro Preview', 'gemini_31_pro'],
  ['Gemini 3.7 Flash', 'gemini_37_flash'],
  ['Gemini 3.6 Flash', 'gemini_36_flash'],
  ['Gemini 3.5 Flash', 'gemini_35_flash'],
  ['Gemini 3.5 Flash-Lite', 'gemini_35_flash_lite'],
  ['Gemini 3.1 Flash Lite', 'gemini_31_flash_lite'],
  ['Gemini 2.5 Flash Lite', 'gemini_25_flash_lite'],
  ['Grok 4.6', 'grok_46'],
  ['Grok 4.5', 'grok_45'],
  ['Muse Glimmer 30B', 'muse_glimmer'],
  ['Muse Spark 1.2', 'muse_spark_12'],
  ['Muse Spark 1.1', 'muse_spark_11'],
  ['Mistral Medium 3.5', 'mistral_medium_35'],
  ['Gemma 4 31B', 'gemma_4_31b'],
  ['Gemma 4 26B A4B', 'gemma_4_26b_a4b'],
  ['Llama 4 Maverick', 'llama_4_maverick'],
  ['Llama 4 Scout', 'llama_4_scout'],
  ['Qwen3.6 27B', 'qwen_36_27b'],
  ['Qwen3.6 35B A3B', 'qwen_36_35b_a3b'],
  ['Nemotron 3 Ultra', 'nemotron_3_ultra'],
  ['Nemotron 3 Super', 'nemotron_3_super'],
  ['Nemotron 3 Nano', 'nemotron_3_nano'],
];

for (const [sourceName, productLineId] of expectedProductLines) {
  assert.equal(
    classifyOagxmModel(sourceName)?.productLineId,
    productLineId,
    `${sourceName} should resolve to ${productLineId}`,
  );
}

const configuredProductLines = OAGXM_SCOPE.vendors.flatMap((vendor) => vendor.productLines);
assert.equal(configuredProductLines.length, 53, 'Curated inventory should include all four 2026-08 release product lines');
assert.ok(
  configuredProductLines.every((line) => line.rankingClass === 'formal_text_agent'),
  'Image/audio/safety-only product lines must not enter the Data.md capability scope',
);
assert.equal(classifyOagxmModel('GPT Image 2'), null);
assert.equal(classifyOagxmModel('Nano Banana 2'), null);
assert.equal(classifyOagxmModel('Llama Guard 4'), null);
assert.equal(
  classifyOagxmModel(
    'deepseek-v4-flash-high',
    'https://x.com/deepseek_ai/status/2083084415157022911',
  )?.productLineId,
  'deepseek_v4_flash_0731',
  'The Arena row linked to the July 31 DeepSeek announcement must resolve to 0731.',
);
assert.equal(
  classifyOagxmModel(
    'deepseek-v4-flash-high',
    'https://api-docs.deepseek.com/updates/#date-2026-07-31',
  )?.productLineId,
  'deepseek_v4_flash_0731',
  'The refreshed official DeepSeek July 31 anchor must resolve to 0731.',
);
assert.equal(
  classifyOagxmModel(
    'deepseek-v4-flash-high-preview',
    'https://api-docs.deepseek.com/news/news260424',
  )?.productLineId,
  'deepseek_v4_flash',
  'The Arena row linked to the April 24 announcement must remain Preview.',
);
assert.equal(
  classifyOagxmModel('DeepSeek V4 Pro 0813 (Reasoning, Max Effort)')?.productLineId,
  'deepseek_v4_pro_0813',
  'The August 13 release must never collapse into the older DeepSeek V4 Pro Preview line.',
);
assert.equal(
  classifyOagxmModel('DeepSeek V4 Pro Preview')?.productLineId,
  'deepseek_v4_pro',
  'The older DeepSeek V4 Pro Preview line must remain independently addressable.',
);

console.log(`OAGXM scope inventory passed: ${configuredProductLines.length} product lines.`);
