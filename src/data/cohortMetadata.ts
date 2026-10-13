import { CohortSnapshot } from '../types/llm_pk';

/**
 * Describes the currently configured cohort only. Capability observations are
 * loaded exclusively from the verified source-card store.
 */
export const CURRENT_COHORT_SNAPSHOT: CohortSnapshot = {
  id: 'current_product_lines_2026_10_13_v3_1',
  name: '当前产品线前沿模型快照（截至 2026-10-13）',
  scoringVersion: 'Scoring v3.1 + Weighting v3.1',
  snapshotDate: '2026-10-13',
  totalConfigs: 52,
  description: '按继任关系淘汰旧版本，取消历史对照例外；不同用途的当前产品线分别保留。榜单只使用可追溯的来源记录，覆盖状态单独披露。',
};
