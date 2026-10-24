# LLMpk Domain Classification & Weighting v3.2

生效日期：2026-10-24。当前已挂接且有真实观测的 48 种评测全部分配正权重；六领域各占 1/6，每域权重合计 100%。所有计分项在详情和并排对比直接列出，不设仅参考项或来源折叠区。权重单一事实源为 `src/data/capabilityMetricWeights.json`。

## Chatting · 5 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [Instruction Following](https://arena.ai/leaderboard/chat/text/instruction-following) | Arena.ai | 27% |
| [Multi-Turn](https://arena.ai/leaderboard/chat/text/multi-turn) | Arena.ai | 27% |
| [Creative Writing](https://arena.ai/leaderboard/chat/text/creative-writing) | Arena.ai | 18% |
| [Hard Prompts](https://arena.ai/leaderboard/chat/text/hard-prompts) | Arena.ai | 18% |
| [IFBench](https://artificialanalysis.ai/evaluations/ifbench) | Artificial Analysis | 10% |

## Reasoning · 11 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [Humanity’s Last Exam](https://artificialanalysis.ai/evaluations/humanitys-last-exam) | Artificial Analysis | 14% |
| [CritPt](https://artificialanalysis.ai/evaluations/critpt) | Artificial Analysis | 11% |
| [Arena Math](https://arena.ai/leaderboard/chat/text/math) | Arena.ai | 10% |
| [Search Arena](https://arena.ai/leaderboard/chat/search) | Arena.ai | 8% |
| [GPQA Diamond](https://artificialanalysis.ai/evaluations/gpqa-diamond) | Artificial Analysis | 5% |
| [MMMU-Pro](https://artificialanalysis.ai/evaluations/mmmu-pro) | Artificial Analysis | 10% |
| [AA-LCR](https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning) | Artificial Analysis | 14% |
| [Omniscience Accuracy](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 10% |
| [Omniscience Non-Hallucination](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 8% |
| [Vals · Legal Research](https://www.vals.ai/benchmarks/legal_research) | Vals AI | 5% |
| [Vals · Tax Agent Bench](https://www.vals.ai/benchmarks/tax_agent_bench) | Vals AI | 5% |

## Coding · 7 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [Arena Coding](https://arena.ai/leaderboard/chat/text/coding) | Arena.ai | 35% |
| [FrontierCode 1.1 Main · Pass Rate](https://cognition.com/frontiercode) | FrontierCode | 20% |
| [SciCode](https://artificialanalysis.ai/evaluations/scicode) | Artificial Analysis | 5% |
| [AA Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 6% |
| [AA Coding Agent · DeepSWE](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 3% |
| [AA Coding Agent · SWE-Atlas-QnA](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 6% |
| [Vals · Code Migration](https://www.vals.ai/benchmarks/code-migration) | Vals AI | 25% |

## Frontend · 3 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [Arena WebDev](https://arena.ai/leaderboard/code/webdev) | Arena.ai | 40% |
| [DesignArena Frontend](https://www.designarena.ai/leaderboard/code) | DesignArena | 30% |
| [Vals · Vibe Code Bench 1.1](https://www.vals.ai/benchmarks/vibe-code) | Vals AI | 30% |

## Agentic · 17 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [AA Terminal-Bench 4.0](https://artificialanalysis.ai/evaluations/terminalbench-4-0) | Artificial Analysis | 12% |
| [Confirmed Success](https://arena.ai/leaderboard/agent) | Arena.ai | 2% |
| [Steerability](https://arena.ai/leaderboard/agent) | Arena.ai | 1% |
| [Praise vs Complaint](https://arena.ai/leaderboard/agent) | Arena.ai | 1% |
| [Bash Recovery](https://arena.ai/leaderboard/agent) | Arena.ai | 1% |
| [Tool Hallucination](https://arena.ai/leaderboard/agent) | Arena.ai | 2% |
| [AA Terminal-Bench 2.1](https://artificialanalysis.ai/evaluations/terminalbench-v2-1) | Artificial Analysis | 3% |
| [AA Coding Agent · Terminal-Bench v2](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 1% |
| [Terminal-Bench 4.0 · Production CLI](https://www.tbench.ai/) | Terminal-Bench | 4% |
| [AutomationBench](https://artificialanalysis.ai/evaluations/automationbench-aa) | Artificial Analysis | 20% |
| [ITBench SRE](https://artificialanalysis.ai/evaluations/itbench) | Artificial Analysis | 8% |
| [EnterpriseOps Gym](https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa) | Artificial Analysis | 6% |
| [APEX-Agents](https://artificialanalysis.ai/evaluations/apex-agents) | Artificial Analysis | 4% |
| [τ³-Banking](https://artificialanalysis.ai/evaluations/tau3-banking) | Artificial Analysis | 5% |
| [Vals · Vals Index 2.2](https://www.vals.ai/benchmarks/vals_index) | Vals AI | 5% |
| [Vals · Finance Agent v2](https://www.vals.ai/benchmarks/fabv2) | Vals AI | 17% |
| [Vals · Terminal-Bench 4.0](https://www.vals.ai/benchmarks/terminal-bench-4) | Vals AI | 8% |

## Documents · 5 项

| 指标 | 来源 | 领域内权重 |
| --- | --- | ---: |
| [GDP.pdf · All-pass](https://artificialanalysis.ai/evaluations/gdp-pdf) | Artificial Analysis | 30% |
| [AA-Briefcase](https://artificialanalysis.ai/evaluations/aa-briefcase) | Artificial Analysis | 25% |
| [Harvey LAB (AA)](https://artificialanalysis.ai/evaluations/harvey-lab-aa) | Artificial Analysis | 15% |
| [Vals · Excel Modeling](https://www.vals.ai/benchmarks/emb) | Vals AI | 15% |
| [Vals · HLAB-Vals 1.1](https://www.vals.ai/benchmarks/hlab) | Vals AI | 15% |

## 相关信号预算

- 五种终端任务来源/版本合计占 Agentic 的 28%：AA TB4 12%、Vals TB4 8%、生产 CLI TB4 4%、AA TB2.1 3%、Coding Agent TB v2 1%。版本、执行环境和原始日期独立保留，不互相补值。
- AA Coding Agent 指数 6%、DeepSWE 3%、SWE-Atlas-QnA 6%，合计占 Coding 的 15%。
- Omniscience 准确率 10% 与防幻觉 8%，合计占 Reasoning 的 18%。
- Vals Index 是跨行业综合指数，纳入 Agentic 的多任务证据，权重限制为该域 5%。

共用预算限制重复信号的影响，不宣称综合指数与组成任务统计独立。这些权重是显式产品判断，不是统计优化结论。

## 来源名义占比

按六域各 1/6 折算如下；实际影响还取决于缺测重分配、可靠性收缩、相对校准和几何聚合。

| 来源 | 名义占比 |
| --- | ---: |
| Artificial Analysis | 38.50% |
| Arena.ai | 31.67% |
| Vals AI | 20.83% |
| DesignArena | 5.00% |
| FrontierCode | 3.33% |
| Terminal-Bench | 0.67% |

每域至少 60% 真实加权覆盖、六域全部合格且总体覆盖至少 75% 才有总分；缺失保留 null。详情同时显示配置权重和来源记录，不以其他模型、档位或任务版本补值。算法和迁移影响见 [Scoring v3.2](llm_pk_scoring_methodology_v3_2.md)。
