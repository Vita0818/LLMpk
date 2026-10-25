# LLMpk Domain Classification and Weighting v3.3

生效日期：2026-10-25（Australia/Perth）。来源快照主要采于 2026-10-24，来源自带的评测/榜单更新日期分别保留。共 108 项计分指标；六域各占 1/6，领域内部合计 100%。单一权重配置为 [capabilityMetricWeights.json](src/data/capabilityMetricWeights.json)。

本版在 v3.2 的 48 项上增加 60 项：LiveBench 7、OpenCompass 24、Epoch 3、Scale 7、DesignArena 6、Vals 3、AA 5、Arena 3、OpenRouter 原生 2。字段数量不决定平台预算；缺测继续占配置权重分母。

## 名义来源预算

| 发布者 | 六域平均配置权重 |
| --- | --- |
| Artificial Analysis | 27.17% |
| Arena.ai | 24.67% |
| Vals AI | 13.83% |
| OpenCompass | 8.83% |
| LiveBench | 8.5% |
| DesignArena | 7.83% |
| Scale Labs | 3.5% |
| FrontierCode | 2.5% |
| Epoch AI | 2.17% |
| OpenRouter | 0.67% |
| Terminal-Bench | 0.33% |

这是配置预算，不是固定的最终影响比例。可靠性收缩、缺失项的实测权重重分配、领域几何聚合和相对校准都会影响实际结果。权重是明确的产品判断，不宣称统计最优。

## 相关信号与质量状态

- 既有五个终端来源/版本共享 Agentic 的 15%，新 AA 科学终端任务另占 3%。
- AA Coding Agent 指数与 DeepSWE、SWE-Atlas-QnA 共享 Coding 的 10%；Scale 的重构、测试编写、SWE Pro Full/HARD 共享另一个 10% 预算。
- SciCode 保留 2% Coding 权重并显示 AA 的 Under review 状态；原 CritPt 保留 2% Reasoning，新 CritPt v2 为 5%。旧结果不更名。
- Frontend 中 Arena 两项共 40%、DesignArena 整体/三个细分共 35%、Vals 两项共 20%、AA-3D 5%。
- OpenCompass 的 24 个原子字段共享 Chatting 25%、Reasoning 13%、Coding 5%、Agentic 5%、Documents 5% 的预算，不再叠加其 Overall 或六类平均分。
- LiveBench Design 是文档/演示成品，进入 Documents。七套 suite 分别计分，Overall 不再叠加。
- OpenRouter 的 AA、DesignArena 镜像采用原发布者身份，不重复创建指标；OpenRouter 自测 GPQA 与 τ-bench 保留独立来源。

## Chatting

对话、指令遵循、多轮交流与创意表达。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Instruction Following](https://arena.ai/leaderboard/chat/text/instruction-following) | Arena.ai | 19.5% |
| [Multi-Turn](https://arena.ai/leaderboard/chat/text/multi-turn) | Arena.ai | 19.5% |
| [Creative Writing](https://arena.ai/leaderboard/chat/text/creative-writing) | Arena.ai | 13% |
| [Hard Prompts](https://arena.ai/leaderboard/chat/text/hard-prompts) | Arena.ai | 13% |
| [IFBench](https://artificialanalysis.ai/evaluations/ifbench) | Artificial Analysis | 10% |
| [OpenCompass · 心智建模与社会认知](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 6% |
| [OpenCompass · 语言表达与语用](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 7% |
| [OpenCompass · 交互认知与主动适应](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 6% |
| [OpenCompass · 无害性与越狱抵抗](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.5% |
| [OpenCompass · 对抗鲁棒性](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.5% |
| [OpenCompass · 公平性与偏见管理](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.5% |
| [OpenCompass · 隐私保护](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.5% |

## Reasoning

高难度推理、科学知识、数学与检索整合。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Humanity’s Last Exam](https://artificialanalysis.ai/evaluations/humanitys-last-exam) | Artificial Analysis | 10% |
| [CritPt](https://artificialanalysis.ai/evaluations/critpt) | Artificial Analysis | 2% |
| [Arena Math](https://arena.ai/leaderboard/chat/text/math) | Arena.ai | 6% |
| [Search Arena](https://arena.ai/leaderboard/chat/search) | Arena.ai | 5% |
| [GPQA Diamond](https://artificialanalysis.ai/evaluations/gpqa-diamond) | Artificial Analysis | 3% |
| [MMMU-Pro](https://artificialanalysis.ai/evaluations/mmmu-pro) | Artificial Analysis | 6% |
| [AA-LCR](https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning) | Artificial Analysis | 8% |
| [Omniscience Accuracy](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 6% |
| [Omniscience Non-Hallucination](https://artificialanalysis.ai/evaluations/omniscience) | Artificial Analysis | 4% |
| [LiveBench 2 · Reasoning](https://livebench.ai/#/methodology) | LiveBench | 5% |
| [LiveBench 2 · Data Analysis](https://livebench.ai/#/methodology) | LiveBench | 4% |
| [OpenCompass · 应用科学知识](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.6% |
| [OpenCompass · 日常常识](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.6% |
| [OpenCompass · 形式科学知识](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.6% |
| [OpenCompass · 自然科学知识](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.6% |
| [OpenCompass · 社会科学与人文](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.6% |
| [OpenCompass · 注意与扫描](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.75% |
| [OpenCompass · 语言理解](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.75% |
| [OpenCompass · 相关信息识别](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.75% |
| [OpenCompass · 概念化与抽象](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 0.75% |
| [OpenCompass · 逻辑推理](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.25% |
| [OpenCompass · 数量推理](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.25% |
| [OpenCompass · 空间与物理推理](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.25% |
| [OpenCompass · 批判性思考过程](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 1.25% |
| [OpenCompass · 已知与未知校准](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 2% |
| [Epoch · FrontierMath 1–3 v2](https://epoch.ai/benchmarks) | Epoch AI | 4% |
| [Epoch · FrontierMath 4 v2](https://epoch.ai/benchmarks) | Epoch AI | 3% |
| [CritPt v2](https://artificialanalysis.ai/evaluations/critpt-v2) | Artificial Analysis | 5% |
| [Vision Arena](https://arena.ai/leaderboard/chat/vision) | Arena.ai | 4% |
| [OpenRouter · GPQA Diamond (OR)](https://openrouter.ai/benchmarks) | OpenRouter | 2% |
| [Vals · Legal Research](https://www.vals.ai/benchmarks/legal_research) | Vals AI | 3% |
| [Vals · Tax Agent Bench](https://www.vals.ai/benchmarks/tax_agent_bench) | Vals AI | 3% |
| [Vals · ProofBench 1.1](https://www.vals.ai/benchmarks/proof_bench) | Vals AI | 4% |

## Coding

编程解题与代码库修改的可合并质量。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [Arena Coding](https://arena.ai/leaderboard/chat/text/coding) | Arena.ai | 22% |
| [FrontierCode 1.1 Main · Pass Rate](https://cognition.com/frontiercode) | FrontierCode | 15% |
| [SciCode](https://artificialanalysis.ai/evaluations/scicode) | Artificial Analysis | 2% |
| [AA Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 4% |
| [AA Coding Agent · DeepSWE](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 2% |
| [AA Coding Agent · SWE-Atlas-QnA](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 4% |
| [LiveBench 2 · Coding](https://livebench.ai/#/methodology) | LiveBench | 10% |
| [OpenCompass · 代码与终端工程执行](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 5% |
| [Epoch · MirrorCode](https://epoch.ai/benchmarks) | Epoch AI | 6% |
| [Scale · SWE Atlas Refactoring](https://labs.scale.com/leaderboard/sweatlas-refactoring) | Scale Labs | 3% |
| [Scale · SWE Atlas Test Writing · revised](https://labs.scale.com/leaderboard/sweatlas-tw) | Scale Labs | 3% |
| [Scale · SWE-Bench Pro V2 Full](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | Scale Labs | 3% |
| [Scale · SWE-Bench Pro V2 HARD](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | Scale Labs | 1% |
| [Vals · Code Migration](https://www.vals.ai/benchmarks/code-migration) | Vals AI | 15% |
| [Vals · ProgramBench](https://www.vals.ai/benchmarks/programbench) | Vals AI | 5% |

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
| [AA Terminal-Bench 4.0](https://artificialanalysis.ai/evaluations/terminalbench-4-0) | Artificial Analysis | 7% |
| [Confirmed Success](https://arena.ai/leaderboard/agent) | Arena.ai | 1.5% |
| [Steerability](https://arena.ai/leaderboard/agent) | Arena.ai | 0.5% |
| [Praise vs Complaint](https://arena.ai/leaderboard/agent) | Arena.ai | 0.5% |
| [Bash Recovery](https://arena.ai/leaderboard/agent) | Arena.ai | 0.5% |
| [Tool Hallucination](https://arena.ai/leaderboard/agent) | Arena.ai | 1% |
| [AA Terminal-Bench 2.1](https://artificialanalysis.ai/evaluations/terminalbench-v2-1) | Artificial Analysis | 1.5% |
| [AA Coding Agent · Terminal-Bench v2](https://artificialanalysis.ai/agents/coding-agents) | Artificial Analysis | 0.5% |
| [Terminal-Bench 4.0 · Production CLI](https://www.tbench.ai/) | Terminal-Bench | 2% |
| [AutomationBench](https://artificialanalysis.ai/evaluations/automationbench-aa) | Artificial Analysis | 14% |
| [ITBench SRE](https://artificialanalysis.ai/evaluations/itbench) | Artificial Analysis | 5% |
| [EnterpriseOps Gym](https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa) | Artificial Analysis | 4% |
| [APEX-Agents](https://artificialanalysis.ai/evaluations/apex-agents) | Artificial Analysis | 3% |
| [τ³-Banking](https://artificialanalysis.ai/evaluations/tau3-banking) | Artificial Analysis | 3% |
| [LiveBench 2 · Long Agentic](https://livebench.ai/#/methodology) | LiveBench | 10% |
| [LiveBench 2 · Browser Use](https://livebench.ai/#/methodology) | LiveBench | 8% |
| [OpenCompass · 任务理解规划与工具调用](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 5% |
| [AA Terminal-Bench Science 0.1](https://artificialanalysis.ai/evaluations/terminal-bench-science) | Artificial Analysis | 3% |
| [Scale · MCP Atlas 2026-04](https://labs.scale.com/leaderboard/mcp_atlas) | Scale Labs | 5% |
| [Scale · HiL-Bench](https://labs.scale.com/leaderboard/hil) | Scale Labs | 4% |
| [Scale · Remote Labor Index](https://labs.scale.com/leaderboard/rli) | Scale Labs | 2% |
| [OpenRouter · τ-bench Airline](https://openrouter.ai/benchmarks) | OpenRouter | 2% |
| [Vals · Vals Index 2.2](https://www.vals.ai/benchmarks/vals_index) | Vals AI | 3% |
| [Vals · Finance Agent v2](https://www.vals.ai/benchmarks/fabv2) | Vals AI | 10% |
| [Vals · Terminal-Bench 4.0](https://www.vals.ai/benchmarks/terminal-bench-4) | Vals AI | 4% |

## Documents

专业 PDF、Excel 建模与法律工作成果的可验证交付。

| 指标 | 来源 | 领域内权重 |
| --- | --- | --- |
| [GDP.pdf · All-pass](https://artificialanalysis.ai/evaluations/gdp-pdf) | Artificial Analysis | 18% |
| [AA-Briefcase](https://artificialanalysis.ai/evaluations/aa-briefcase) | Artificial Analysis | 14% |
| [Harvey LAB (AA)](https://artificialanalysis.ai/evaluations/harvey-lab-aa) | Artificial Analysis | 8% |
| [DesignArena · PPTX Slides](https://www.designarena.ai/leaderboard/code) | DesignArena | 4% |
| [DesignArena · HTML Slides](https://www.designarena.ai/leaderboard/code) | DesignArena | 3% |
| [DesignArena · Spreadsheet](https://www.designarena.ai/leaderboard/code) | DesignArena | 5% |
| [LiveBench 2 · Research](https://livebench.ai/#/methodology) | LiveBench | 6% |
| [LiveBench 2 · Document Design](https://livebench.ai/#/methodology) | LiveBench | 8% |
| [OpenCompass · 数据分析与深度研究](https://rank.opencompass.org.cn/leaderboard/llm) | OpenCompass | 5% |
| [AA-AnalystAgent pass^5](https://artificialanalysis.ai/evaluations/aa-analyst-agent) | Artificial Analysis | 6% |
| [GDPval-AA 2.1](https://artificialanalysis.ai/evaluations/gdpval-aa) | Artificial Analysis | 5% |
| [Document Arena](https://arena.ai/leaderboard/chat/document) | Arena.ai | 2% |
| [Vals · Excel Modeling](https://www.vals.ai/benchmarks/emb) | Vals AI | 8% |
| [Vals · HLAB-Vals 1.1](https://www.vals.ai/benchmarks/hlab) | Vals AI | 8% |
