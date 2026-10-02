import { CohortSnapshot } from '../types/llm_pk';

/**
 * Describes the currently configured cohort only. Capability observations are
 * loaded exclusively from the verified source-card store.
 */
export const CURRENT_COHORT_SNAPSHOT: CohortSnapshot = {
  id: 'recent_3_months_2026',
  name: '近 3 个月新发布前沿模型快照（截至 2026-10-02）',
  scoringVersion: 'Scoring v1.2 + Weighting v2.2',
  snapshotDate: '2026-10-02',
  totalConfigs: 93,
  description: '榜单仅使用已映射且可追溯至评测方官网、Artificial Analysis、Arena 或 OpenRouter 的来源记录；覆盖状态单独披露。',
};
