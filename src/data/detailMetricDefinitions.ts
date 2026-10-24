import type { DomainId } from '../types/llm_pk';

export interface DetailOnlyMetricDefinition {
  id: string;
  name: string;
  unit: '%' | 'Elo';
  domain: DomainId;
}

/** Historical source definitions with no observation on the reviewed current cohort.
 * Any future current-cohort observation must receive a positive scoring weight;
 * the public snapshot generator rejects unweighted benchmark evidence.
 */
export const DETAIL_ONLY_METRIC_DEFINITIONS: readonly DetailOnlyMetricDefinition[] = [
  { id: 'aa_gdpval_v2', name: 'GDPval-AA v2', unit: 'Elo', domain: 'documents' },
  { id: 'scale_enigmaeval', name: 'EnigmaEval', unit: '%', domain: 'reasoning' },
  { id: 'tbench_science_v01', name: 'Terminal-Bench-Science 0.1', unit: '%', domain: 'reasoning' },
  { id: 'swe_rebench_v2', name: 'SWE-rebench v2 · July 2026 Window', unit: '%', domain: 'coding' },
];
