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
    id: 'aa_ifbench',
    name: 'IFBench',
    unit: '%',
    domain: 'chatting',
  },
  {
    id: 'aa_mmmu_pro',
    name: 'MMMU-Pro',
    unit: '%',
    domain: 'reasoning',
  },
  {
    id: 'aa_coding_agent_index',
    name: 'AA Coding Agent Index',
    unit: '%',
    domain: 'coding',
  },
  {
    id: 'aa_itbench_sre',
    name: 'ITBench SRE',
    unit: '%',
    domain: 'agentic',
  },
  {
    id: 'aa_briefcase',
    name: 'AA-Briefcase',
    unit: 'Elo',
    domain: 'documents',
  },
  {
    id: 'aa_automationbench',
    name: 'AutomationBench',
    unit: '%',
    domain: 'agentic',
  },
  {
    id: 'aa_harvey_lab',
    name: 'Harvey LAB',
    unit: '%',
    domain: 'documents',
  },
  {
    id: 'aa_enterprise_ops_gym',
    name: 'EnterpriseOps Gym',
    unit: '%',
    domain: 'agentic',
  },
  {
    id: 'aa_apex_agents',
    name: 'APEX-Agents',
    unit: '%',
    domain: 'agentic',
  },
  { id: 'aa_gdpval_v2', name: 'GDPval-AA v2', unit: 'Elo', domain: 'documents' },
  { id: 'aa_coding_agent_deepswe', name: 'AA Coding Agent · DeepSWE', unit: '%', domain: 'coding' },
  { id: 'aa_coding_agent_swe_atlas_qna', name: 'AA Coding Agent · SWE-Atlas-QnA', unit: '%', domain: 'coding' },
  { id: 'aa_tau3_banking', name: 'τ³-Banking', unit: '%', domain: 'agentic' },
  { id: 'aa_omniscience_accuracy', name: 'AA-Omniscience Accuracy', unit: '%', domain: 'reasoning' },
  { id: 'aa_omniscience_nonhallucination', name: 'AA-Omniscience Non-Hallucination', unit: '%', domain: 'reasoning' },
  { id: 'aa_lcr', name: 'AA-LCR', unit: '%', domain: 'reasoning' },
  { id: 'scale_enigmaeval', name: 'EnigmaEval', unit: '%', domain: 'reasoning' },
  { id: 'tbench_science_v01', name: 'Terminal-Bench-Science 0.1', unit: '%', domain: 'reasoning' },
  { id: 'tbench_v4', name: 'Terminal-Bench 4.0 · Production CLI', unit: '%', domain: 'agentic' },
  { id: 'swe_rebench_v2', name: 'SWE-rebench v2 · July 2026 Window', unit: '%', domain: 'coding' },
];
