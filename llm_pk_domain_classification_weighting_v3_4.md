# LLMpk Domain Classification and Weighting v3.4

生效日期：2026-10-25（Australia/Perth）。当前 84 项评测全部配置正权重；六域各占 1/6，领域内部合计 100%。单一事实源为 [capabilityMetricWeights.json](src/data/capabilityMetricWeights.json)。

本版移除用户指定来源后，对每个领域保留指标的旧权重按原比例重新归一。保留指标之间的相对比例不变，原始值和模型/版本归属保持原记录。

## 名义来源预算

| 发布者 | 六域平均配置权重 |
| --- | --- |
| Artificial Analysis | 29.73% |
| Arena.ai | 28.9% |
| Vals AI | 14.55% |
| LiveBench | 9.09% |
| DesignArena | 7.94% |
| Scale Labs | 3.68% |
| FrontierCode | 2.63% |
| Epoch AI | 2.39% |
| OpenRouter | 0.73% |
| Terminal-Bench | 0.35% |

这是配置预算。可靠性收缩、缺失项的观测权重重分配、领域几何聚合和相对校准会影响最终结果；来源比例不等于固定最终影响。

## 相关信号

- 五个既有终端来源/版本共用 Agentic 的 15.79%；科学终端任务为 3.16%。
- AA Coding Agent 指数与两个编程分项共用 Coding 的 10.53%；Omniscience 两项共用 Reasoning 的 11.49%。
- SciCode 为 Coding 的 2.11%，保留发布者 Under review 状态；原 CritPt 和 v2 分别计分。
- Frontend 的 Arena 两项合计 40%、DesignArena 四项合计 35%、Vals 两项合计 20%、AA-3D 5%。
- LiveBench 的 Design 属于 Documents；七个 suite 分别计分，Overall 不叠加。
- 原发布者与 OpenRouter 镜像使用同一份运行身份；独立运行的相关成绩采用受限预算。

## Chatting

对话、指令遵循、多轮交流与创意表达。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Instruction Following](https://arena.ai/leaderboard/chat/text/instruction-following) | Arena.ai | 26% |
| [Multi-Turn](https://arena.ai/leaderboard/chat/text/multi-turn) | Arena.ai | 26% |
| [Creative Writing](https://arena.ai/leaderboard/chat/text/creative-writing) | Arena.ai | 17.33% |
| [Hard Prompts](https://arena.ai/leaderboard/chat/text/hard-prompts) | Arena.ai | 17.33% |
| [IFBench](https://artificialanalysis.ai/evaluations/ifbench) | Artificial Analysis | 13.33% |

## Reasoning

高难度推理、科学知识、数学与检索整合。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Humanity’s Last Exam](https://artificialanalysis.ai/evaluations/humanitys-last-exam) | Artificial Analysis | 11.49% |
| [CritPt](https://artificialanalysis.ai/evaluations/critpt) | Artificial Analysis | 2.3% |
| [Arena Math](https://arena.ai/leaderboard/chat/text/math) | Arena.ai | 6.9% |
| [Search Arena](https://arena.ai/leaderboard/chat/search) | Arena.ai | 5.75% |
| [GPQA Diamond](https://artificialanalysis.ai/evaluations/gpqa-diamond) | Artificial Analysis | 3.45% |
| [MMMU-Pro](https://artificialanalysis.ai/evaluations/mmmu-pro) | Artificial Analysis | 6.9% |
| [AA-LCR](https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning) | Artificial Analysis | 9.2% |
| [Omniscience Accuracy](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 6.9% |
| [Omniscience Non-Hallucination](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 4.6% |
| [LiveBench 2 · Reasoning](https://livebench.ai/#/methodology) | LiveBench | 5.75% |
| [LiveBench 2 · Data Analysis](https://livebench.ai/#/methodology) | LiveBench | 4.6% |
| [Epoch · FrontierMath 1–3 v2](https://epoch.ai/benchmarks) | Epoch AI | 4.6% |
| [Epoch · FrontierMath 4 v2](https://epoch.ai/benchmarks) | Epoch AI | 3.45% |
| [CritPt v2](https://artificialanalysis.ai/evaluations/critpt-v2) | Artificial Analysis | 5.75% |
| [Vision Arena](https://arena.ai/leaderboard/chat/vision) | Arena.ai | 4.6% |
| [OpenRouter · GPQA Diamond (OR)](https://openrouter.ai/benchmarks) | OpenRouter | 2.3% |
| [Vals · Legal Research](https://www.vals.ai/benchmarks/legal_research) | Vals AI | 3.45% |
| [Vals · Tax Agent Bench](https://www.vals.ai/benchmarks/tax_agent_bench) | Vals AI | 3.45% |
| [Vals · ProofBench 1.1](https://www.vals.ai/benchmarks/proof_bench) | Vals AI | 4.6% |

## Coding

编程解题与代码库修改的可合并质量。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Arena Coding](https://arena.ai/leaderboard/chat/text/coding) | Arena.ai | 23.16% |
| [FrontierCode 1.1 Main · Pass Rate](https://cognition.com/frontiercode) | FrontierCode | 15.79% |
| [SciCode](https://artificialanalysis.ai/evaluations/scicode) | Artificial Analysis | 2.11% |
| [AA Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 4.21% |
| [AA Coding Agent · DeepSWE](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 2.11% |
| [AA Coding Agent · SWE-Atlas-QnA](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 4.21% |
| [LiveBench 2 · Coding](https://livebench.ai/#/methodology) | LiveBench | 10.53% |
| [Epoch · MirrorCode](https://epoch.ai/benchmarks) | Epoch AI | 6.32% |
| [Scale · SWE Atlas Refactoring](https://labs.scale.com/leaderboard/sweatlas-refactoring) | Scale Labs | 3.16% |
| [Scale · SWE Atlas Test Writing · revised](https://labs.scale.com/leaderboard/sweatlas-tw) | Scale Labs | 3.16% |
| [Scale · SWE-Bench Pro V2 Full](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | Scale Labs | 3.16% |
| [Scale · SWE-Bench Pro V2 HARD](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | Scale Labs | 1.05% |
| [Vals · Code Migration](https://www.vals.ai/benchmarks/code-migration) | Vals AI | 15.79% |
| [Vals · ProgramBench](https://www.vals.ai/benchmarks/programbench) | Vals AI | 5.26% |

## Frontend

Web 应用、界面设计与前端交付体验。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Arena WebDev](https://arena.ai/leaderboard/code/webdev) | Arena.ai | 30% |
| [DesignArena Frontend](https://www.designarena.ai/leaderboard/code) | DesignArena | 15% |
| [DesignArena · DataViz](https://www.designarena.ai/leaderboard/code) | DesignArena | 7% |
| [DesignArena · UI Component](https://www.designarena.ai/leaderboard/code) | DesignArena | 7% |
| [DesignArena · SVG](https://www.designarena.ai/leaderboard/code) | DesignArena | 6% |
| [AA-3D 1.0](https://artificialanalysis.ai/evaluations/aa-3d) | Artificial Analysis | 5% |
| [Image-to-WebDev](https://arena.ai/leaderboard/code/image-to-webdev) | Arena.ai | 10% |
| [Vals · Vibe Code Bench 1.1](https://www.vals.ai/benchmarks/vibe-code) | Vals AI | 15% |
| [Vals · Vibe Code Bench 1–100](https://www.vals.ai/benchmarks/vcb-1-100) | Vals AI | 5% |

## Agentic

终端任务、工具使用、恢复与生产 Agent 行为。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [AA Terminal-Bench 4.0](https://artificialanalysis.ai/evaluations/terminalbench-4-0) | Artificial Analysis | 7.37% |
| [Confirmed Success](https://arena.ai/leaderboard/agent) | Arena.ai | 1.58% |
| [Steerability](https://arena.ai/leaderboard/agent) | Arena.ai | 0.53% |
| [Praise vs Complaint](https://arena.ai/leaderboard/agent) | Arena.ai | 0.53% |
| [Bash Recovery](https://arena.ai/leaderboard/agent) | Arena.ai | 0.53% |
| [Tool Hallucination](https://arena.ai/leaderboard/agent) | Arena.ai | 1.05% |
| [AA Terminal-Bench 2.1](https://artificialanalysis.ai/evaluations/terminalbench-v2-1) | Artificial Analysis | 1.58% |
| [AA Coding Agent · Terminal-Bench v2](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 0.53% |
| [Terminal-Bench 4.0 · Production CLI](https://www.tbench.ai/) | Terminal-Bench | 2.11% |
| [AutomationBench](https://artificialanalysis.ai/evaluations/automationbench-aa) | Artificial Analysis | 14.74% |
| [ITBench SRE](https://artificialanalysis.ai/evaluations/itbench) | Artificial Analysis | 5.26% |
| [EnterpriseOps Gym](https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa) | Artificial Analysis | 4.21% |
| [APEX-Agents](https://artificialanalysis.ai/evaluations/apex-agents) | Artificial Analysis | 3.16% |
| [τ³-Banking](https://artificialanalysis.ai/evaluations/tau3-banking) | Artificial Analysis | 3.16% |
| [LiveBench 2 · Long Agentic](https://livebench.ai/#/methodology) | LiveBench | 10.53% |
| [LiveBench 2 · Browser Use](https://livebench.ai/#/methodology) | LiveBench | 8.42% |
| [AA Terminal-Bench Science 0.1](https://artificialanalysis.ai/evaluations/terminal-bench-science) | Artificial Analysis | 3.16% |
| [Scale · MCP Atlas 2026-04](https://labs.scale.com/leaderboard/mcp_atlas) | Scale Labs | 5.26% |
| [Scale · HiL-Bench](https://labs.scale.com/leaderboard/hil) | Scale Labs | 4.21% |
| [Scale · Remote Labor Index](https://labs.scale.com/leaderboard/rli) | Scale Labs | 2.11% |
| [OpenRouter · τ-bench Airline](https://openrouter.ai/benchmarks) | OpenRouter | 2.11% |
| [Vals · Vals Index 2.2](https://www.vals.ai/benchmarks/vals_index) | Vals AI | 3.16% |
| [Vals · Finance Agent v2](https://www.vals.ai/benchmarks/fabv2) | Vals AI | 10.53% |
| [Vals · Terminal-Bench 4.0](https://www.vals.ai/benchmarks/terminal-bench-4) | Vals AI | 4.21% |

## Documents

专业 PDF、Excel 建模与法律工作成果的可验证交付。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [GDP.pdf · All-pass](https://artificialanalysis.ai/evaluations/gdp-pdf) | Artificial Analysis | 18.95% |
| [AA-Briefcase](https://artificialanalysis.ai/evaluations/aa-briefcase) | Artificial Analysis | 14.74% |
| [Harvey LAB (AA)](https://artificialanalysis.ai/evaluations/harvey-lab-aa) | Artificial Analysis | 8.42% |
| [DesignArena · PPTX Slides](https://www.designarena.ai/leaderboard/code) | DesignArena | 4.21% |
| [DesignArena · HTML Slides](https://www.designarena.ai/leaderboard/code) | DesignArena | 3.16% |
| [DesignArena · Spreadsheet](https://www.designarena.ai/leaderboard/code) | DesignArena | 5.26% |
| [LiveBench 2 · Research](https://livebench.ai/#/methodology) | LiveBench | 6.32% |
| [LiveBench 2 · Document Design](https://livebench.ai/#/methodology) | LiveBench | 8.42% |
| [AA-AnalystAgent pass^5](https://artificialanalysis.ai/evaluations/aa-analyst-agent) | Artificial Analysis | 6.32% |
| [GDPval-AA 2.1](https://artificialanalysis.ai/evaluations/gdpval-aa) | Artificial Analysis | 5.26% |
| [Document Arena](https://arena.ai/leaderboard/chat/document) | Arena.ai | 2.11% |
| [Vals · Excel Modeling](https://www.vals.ai/benchmarks/emb) | Vals AI | 8.42% |
| [Vals · HLAB-Vals 1.1](https://www.vals.ai/benchmarks/hlab) | Vals AI | 8.42% |
