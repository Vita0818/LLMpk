/**
 * Short labels used only in dense metric lists.
 *
 * Canonical metric names remain unchanged in the scoring definitions and are
 * still exposed by the row tooltip.
 */
const COMPACT_METRIC_NAMES: Readonly<Record<string, string>> = {
  aa_hle: 'HLE',
  aa_terminalbench_v4: 'TB4 (AA)',
  aa_gdp_pdf_all_pass: 'GDP.pdf',
  designarena_frontend: 'DesignArena',
  arena_text_instruction: 'Instruction',
  arena_agent_success: 'Success',
  arena_agent_praise: 'Praise',
  aa_coding_agent_deepswe: 'DeepSWE',
  aa_coding_agent_swe_atlas_qna: 'SWE-Atlas Q&A',
  tbench_science_v01: 'TB-Science 0.1',
  tbench_v4: 'Terminal-Bench 4.0',
  frontiercode_v11_main_pass_rate: 'FrontierCode 1.1',
  swe_rebench_v2: 'SWE-rebench v2',
  scale_enigmaeval: 'EnigmaEval',
  arena_code_webdev: 'WebDev Overall',
  aa_coding_agent_index: 'Coding Agent Index',
  aa_omniscience_accuracy: 'Omniscience Accuracy',
  aa_omniscience_nonhallucination: 'Omniscience Non-Halluc.',
};

export function getCompactMetricName(metricId: string, canonicalName: string): string {
  return COMPACT_METRIC_NAMES[metricId] ?? canonicalName;
}
