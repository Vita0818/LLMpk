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
  vals_finance_agent_v2: 'Vals Finance',
  vals_excel_modeling_v1: 'Vals Excel',
  vals_vibe_code_v11: 'Vals Vibe Code',
  vals_code_migration_v1: 'Vals Migration',
  vals_legal_research_v1: 'Vals Legal',
  vals_hlab_v11: 'Vals HLAB 1.1',
  vals_tax_agent_v1: 'Vals Tax',
  vals_index_v22: 'Vals Index 2.2',
  vals_terminalbench_v4: 'TB4 (Vals)',
  aa_coding_agent_index: 'Coding Agent Index',
  aa_omniscience_accuracy: 'Omniscience Accuracy',
  aa_omniscience_nonhallucination: 'Omniscience Non-Halluc.',
};

export function getCompactMetricName(metricId: string, canonicalName: string): string {
  return COMPACT_METRIC_NAMES[metricId] ?? canonicalName;
}
