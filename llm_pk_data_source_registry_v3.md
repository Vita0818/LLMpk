# LLMpk Data Source Registry v3.0

生效日期：2026-10-03。19 个配置指标，其中 DesignArena 尚待真实 API 数据。

| 来源 | 当前计分指标 | 原始尺度与边界 |
| --- | --- | --- |
| Artificial Analysis | HLE、CritPt、Terminal-Bench 4.0、GDP.pdf All-pass | 准确率比例；精确版本与 effort；保留 Default Fallback 等来源条件 |
| Arena.ai Text / Search | Instruction、Multi-Turn、Creative、Hard、Math、Coding、Search | Bradley–Terry / Elo 等来源连续尺度；带来源 CI 时保留 |
| Arena.ai WebDev | WebDev Overall | Benchmark 内部构建环境；模型级前端信号 |
| Arena.ai Agent | Success、Steerability、Praise、Bash Recovery、Tool Hallucination | 原来源正向效果量；实际执行环境为 Arena Agent Mode |
| Cognition FrontierCode | 1.1 Main Pass Rate | 官方 `v1_1.data[model][effort].main.correct`；按来源 harness 与 effort 连接 |
| DesignArena | Overall Frontend Elo | 官方 Models Arena / codecategories；当前 API 密钥未取得，不生成观测 |
| OpenRouter / AA 实用数据 | 输入输出价格、TTFT、吞吐 | 只调整实用分，不进入六域能力权重；来源、路由和 effort 的测量条件需分别审视 |

主要官方说明：[AA HLE](https://artificialanalysis.ai/evaluations/humanitys-last-exam)、[CritPt](https://artificialanalysis.ai/evaluations/critpt)、[AA TB4](https://artificialanalysis.ai/evaluations/terminalbench-4-0)、[GDP.pdf](https://artificialanalysis.ai/evaluations/gdp-pdf)、[Arena](https://arena.ai/leaderboard)、[FrontierCode](https://cognition.com/frontiercode)、[DesignArena API](https://docs.designarena.ai/api-reference/overview)。

FrontierCode 通过官方页面实际使用的 [JSON 端点](https://cognition.com/data/frontiercode-leaderboard/data.json) 刷新，记录抓取时间、revision、dataset、原文件 SHA-256 和实际结果。2026-10-02 抓取包含 42 个模型、125 个 Main effort 记录。此次按已审核的 8 个当前模型和真实生产 harness 生成 37 张当前来源卡；未知模型/harness 不自动借给榜单配置。

DesignArena API 获取器仍检查响应类别、更新时间、行数、Elo、重复模型 ID。模型连接使用唯一且精确的 OpenRouter ID；无 ID、重复 ID 或仅名称相似的记录不连接。未披露 effort 的行仅作为 Default 来源，任何向高 effort 补缺均显式标注。

旧指标和旧模型仍保留在原始快照、来源卡与历史标准中，供复核和迁移使用；没有进入当前评分集合。`scoringRole` 将当前四项 AA 能力指标、仅展示指标与实用回退指标分开记录。

来源身份包含模型版本、effort、harness、数据集/评测版本和采样条件。Qwen3.8-Max 固定 0902 来源，不能用无版本 Max 或 Max Prime 补分。Pro、Fast、不同继任版本的来源不互借。

读取来源不等于获得成绩：缺测单项是 null，保留配置权重用于覆盖率。原始值为 0 是有效观测，不能当成缺测。来源不披露 CI 或样本量时不臆造置信度。评分规则见 [Scoring v3](llm_pk_scoring_methodology_v3.md)。
