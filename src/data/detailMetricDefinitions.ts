import type { DomainId } from '../types/llm_pk';

export interface DetailOnlyMetricDefinition {
  id: string;
  name: string;
  unit: '%' | 'Elo';
  domain: DomainId;
}

/**
 * Verified source metrics shown on a configuration page without participating
 * in the current six-domain scoring algorithm.
 */
export const DETAIL_ONLY_METRIC_DEFINITIONS: readonly DetailOnlyMetricDefinition[] = [
  {
    id: 'aa_hle',
    name: 'Humanity’s Last Exam',
    unit: '%',
    domain: 'math_science',
  },
  {
    id: 'aa_terminalbench_v4',
    name: 'AA Terminal-Bench 4.0',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_gdp_pdf_all_pass',
    name: 'GDP.pdf · All-pass',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_ifbench',
    name: 'IFBench',
    unit: '%',
    domain: 'chatting',
  },
  {
    id: 'aa_mmmu_pro',
    name: 'MMMU-Pro',
    unit: '%',
    domain: 'math_science',
  },
  {
    id: 'aa_coding_agent_index',
    name: 'AA Coding Agent Index',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_itbench_sre',
    name: 'ITBench SRE',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_briefcase',
    name: 'AA-Briefcase',
    unit: 'Elo',
    domain: 'engineering',
  },
  {
    id: 'aa_automationbench',
    name: 'AutomationBench',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_harvey_lab',
    name: 'Harvey LAB',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_enterprise_ops_gym',
    name: 'EnterpriseOps Gym',
    unit: '%',
    domain: 'engineering',
  },
  {
    id: 'aa_apex_agents',
    name: 'APEX-Agents',
    unit: '%',
    domain: 'agentic_work',
  },
];
