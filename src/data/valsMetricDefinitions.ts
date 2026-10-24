import type { DomainId } from '../types/llm_pk';
import metricWeights from './capabilityMetricWeights.json';

/** All nine Vals metrics score in v3.2; related signals share limited domain budgets. */
export const VALS_METRIC_DEFINITIONS: readonly {
  id: string; slug: string; name: string; domain: DomainId; scoringWeightInDomain: number;
  benchmarkVersion: string;
}[] = [
  { id: 'vals_index_v22', slug: 'vals_index', name: 'Vals Index 2.2', domain: 'agentic', scoringWeightInDomain: metricWeights.vals_index_v22, benchmarkVersion: '2.2' },
  { id: 'vals_finance_agent_v2', slug: 'fabv2', name: 'Finance Agent v2', domain: 'agentic', scoringWeightInDomain: metricWeights.vals_finance_agent_v2, benchmarkVersion: '2' },
  { id: 'vals_excel_modeling_v1', slug: 'emb', name: 'Excel Modeling', domain: 'documents', scoringWeightInDomain: metricWeights.vals_excel_modeling_v1, benchmarkVersion: '1' },
  { id: 'vals_vibe_code_v11', slug: 'vibe-code', name: 'Vibe Code Bench 1.1', domain: 'frontend', scoringWeightInDomain: metricWeights.vals_vibe_code_v11, benchmarkVersion: '1.1' },
  { id: 'vals_code_migration_v1', slug: 'code-migration', name: 'Code Migration', domain: 'coding', scoringWeightInDomain: metricWeights.vals_code_migration_v1, benchmarkVersion: '1' },
  { id: 'vals_terminalbench_v4', slug: 'terminal-bench-4', name: 'Terminal-Bench 4.0', domain: 'agentic', scoringWeightInDomain: metricWeights.vals_terminalbench_v4, benchmarkVersion: '4.0' },
  { id: 'vals_legal_research_v1', slug: 'legal_research', name: 'Legal Research', domain: 'reasoning', scoringWeightInDomain: metricWeights.vals_legal_research_v1, benchmarkVersion: '1' },
  { id: 'vals_hlab_v11', slug: 'hlab', name: 'HLAB-Vals 1.1', domain: 'documents', scoringWeightInDomain: metricWeights.vals_hlab_v11, benchmarkVersion: '1.1' },
  { id: 'vals_tax_agent_v1', slug: 'tax_agent_bench', name: 'Tax Agent Bench', domain: 'reasoning', scoringWeightInDomain: metricWeights.vals_tax_agent_v1, benchmarkVersion: '1' },
];

export interface ValsBenchmarkEvidence {
  metricId: string;
  rawValue: number | null;
  publishedRawValue: number | null;
  scoreBasis: 'published' | 'no-fallback';
  fallbackCount: number | null;
  refusalCount: number | null;
  /** Standard error on the 0–1 score scale; it is not a 95% confidence interval. */
  standardError: number | null;
  benchmarkVersion: string | null;
  sourceUrl: string;
  sourceUpdated: string;
  sourceProfile: string;
  sourceHarness: string | null;
  profileFallback: boolean;
  hasRefusalFallbackNotice: boolean;
}
