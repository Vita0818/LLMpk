# LLMpk Data Source Registry v3.2

生效日期：2026-10-24。沿用已审核的来源快照与版本映射，将当前读者配置已有的全部 48 种评测纳入能力评分。完整指标、来源链接与正权重见 [Weighting v3.2](llm_pk_domain_classification_weighting_v3_2.md)。

| 来源 | 当前计分证据 |
| --- | --- |
| Artificial Analysis | HLE、CritPt、GPQA、SciCode、IFBench、MMMU-Pro、LCR、Omniscience 两项、AA TB4/TB2.1、Coding Agent 指数及其精确执行分项、AutomationBench、ITBench、EnterpriseOps Gym、APEX-Agents、τ³-Banking、Briefcase、Harvey LAB、GDP.pdf |
| Arena.ai | 指令、多轮、创作、困难提示、数学、检索、编程、WebDev 和五项生产 Agent 行为信号 |
| FrontierCode | 当前 1.1 Main Pass Rate，保留真实生产 Harness 与 effort |
| DesignArena | 审核后精确模型版本与档位的 Frontend Elo |
| Vals AI | Index 2.2、Finance Agent v2、Excel、Vibe Code 1.1、完整 Code Migration、TB4、Legal Research、HLAB 1.1、Tax Agent，九项均计分 |
| Terminal-Bench | 精确模型、effort 与生产 CLI 的 TB4 独立记录 |
| OpenRouter / AA | 价格、TTFT、吞吐，仅用于实用分修正；不重复纳入能力指标 |
| SemiAnalysis / 历史套餐估算 | 已审核的逐模型订阅折算及其证据等级，仅用于成本修正 |

模型版本、effort、生产 Harness、测试框架、榜单版本和来源日期仍是不同字段。生产 Coding Agent 证据不借给普通 API；同一模型的不同推理档位不向下填补；历史任务不改名成新任务。默认档位回退和执行环境回退必须由既有映射明确授权。

AA TB4、Vals TB4 与生产 CLI TB4 使用不同来源记录；AA TB2.1、Coding Agent TB v2 独立保留旧版身份。这五项共用 Agentic 的 28% 预算。Coding Agent 指数与两个编程分项共用 Coding 的 15% 预算。综合与分项仍可能相关，来源数量不能解释为独立任务数量。

日期沿用来源：当前 AA/Arena/FrontierCode 等快照、旧版 Harness 原始快照、Vals 各独立榜更新时间分别披露。新增权重不表示重新测量。所有来源不披露的样本量、置信区间、精确执行设置继续保留未知。

原始值为零与缺测区分。Vals 已披露备用模型时使用官方 `noFallbackScorePct`；保留公布分、备用/拒答数及运行条件。Code Migration 继续使用独立完整任务，不借用 Vals Index 中不同的子集。

公开快照构建会拒绝当前配置中任何没有正计分权重的评测字段；只允许价格/速度回退字段单独进入实用分。前台指标列表由同一计分注册表生成，测试核对 48 项全部可见、各项均能影响所属领域聚合、每域权重合计 100%。

原始采集、哈希、版本审核与历史记录见 [v3.1 来源档案](llm_pk_data_source_registry_v3_1.md) 和 [SOURCE_DATA_PIPELINE](SOURCE_DATA_PIPELINE.md)。这些记录保留原有采集时间，本次没有刷新或修改原始测评分数。
