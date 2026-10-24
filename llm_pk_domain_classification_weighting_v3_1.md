# LLMpk Domain Classification & Weighting v3.1

生效日期：2026-10-12。六领域等权，各占综合能力的 1/6；新增七项 Vals 独立评测，当前共有 26 项能力指标。v3.0 文档保留作历史对照，两个版本的相对分不直接比较。

| Domain | 衡量内容 | 领域内来源与配置权重 |
| --- | --- | --- |
| Chatting | 对话、指令与表达 | Arena Instruction 30%、Multi-Turn 30%、Creative 20%、Hard Prompts 20% |
| Reasoning | 高难推理、数学、专业检索与论证 | AA HLE 25%、CritPt 20%；Arena Math 20%、Search 15%；Vals Legal Research 10%、Tax Agent 10% |
| Coding | 编程解题、代码库交付与跨语言迁移 | Arena Coding 40%、FrontierCode 1.1 Main 30%、Vals Code Migration 30% |
| Frontend | Web 应用、界面与功能交付 | Arena WebDev 40%、DesignArena Overall Frontend 30%、Vals Vibe Code Bench 1.1 30% |
| Agentic | 终端执行、交互行为与多步工具任务 | AA TB4 40%、Vals Finance Agent v2 30%；Arena Success 10%、Steerability 6%、Praise 3%、Bash Recovery 6%、Tool Hallucination 5% |
| Documents | PDF、Excel 建模与专业工作成果 | AA GDP.pdf All-pass 50%、Vals Excel Modeling 25%、Vals HLAB 1.1 25% |

按六领域各 1/6 折算，各来源的名义配置占比如下。这是规则审计口径；实际结果还会受到缺测后的域内重分配、可靠性收缩、相对归一化和几何聚合影响，不能当作最终分数的固定线性贡献。

| 来源 | 折算后的名义占比 |
| --- | ---: |
| Arena.ai | 40.83% |
| Vals AI | 26.67% |
| Artificial Analysis | 22.50% |
| FrontierCode | 5.00% |
| DesignArena | 5.00% |

Chatting 完全依赖 Arena；Coding 和 Frontend 的 Arena 各占域内 40%。因此当前组合对用户偏好和 Arena 的收录节奏较敏感。Agentic 的 Finance Agent 占 30%，Documents 的法律工作成果占 25%，也意味着领域名称覆盖的实际任务偏向终端、金融、PDF、Excel 和法律交付，不能解读成对所有通用 Agent 或办公场景的完整测量。

Chatting 的任务定义和权重沿用 v3.0。Reasoning 以 AA 高难推理和 Arena 数学/检索为主体，增加法律与税务的专业证据整合任务。Coding 与 Frontend 各采用三个来源：Arena 保留 40% 的真实用户评价，其余两项各 30%，补充可验证的代码迁移、仓库修改或端到端 Web 交付。

Agentic 将终端任务、Arena 生产交互和金融分析的多步工具任务合并衡量。Finance Agent 是使用独立工具环境的模型级评测，不能冒充本站所展示 CLI 的生产实测。Documents 保留 PDF 交付 50%，以 Excel 建模和法律工作成果各 25% 扩展格式与专业任务；只有两个 Vals 文档指标时覆盖为 50%，不能通过领域门槛。

这些是显式产品权重，不宣称统计上最优或相互独立。每域真实加权覆盖至少 60%、六域全部合格、总覆盖至少 75% 才产生综合分。未接通、缺测、版本不匹配和未审核档位仍占覆盖分母。例如只有 Arena WebDev 时 Frontend 覆盖为 40%；WebDev 加 DesignArena 或 Vibe Code 为 70%；DesignArena 加 Vibe Code 为 60%。

Vals 使用独立榜单的总体成绩；Code Migration 使用完整独立任务套件，不使用 Vals Index 中的不同子集。Vals Index 2.2 已聚合这些任务，只保留作参考。Vals Terminal-Bench 4.0 同样保留作参考，当前计分继续使用 AA TB4，避免同名任务重复加权。

2026-10-24 数据修订将 HLAB 从 1.0 切换到 1.1，Documents 内 25% 权重不变。缺少 1.1 成绩的模型保留该部分缺失，不用旧版补分；其余任务版本与权重保持本表定义。Index 更新到 2.2 后仍不计分。

Vals 如披露备用模型，则采用官方 `noFallbackScorePct`，把备用模型任务计为失败，只归因于所请求的模型。原始公布分、备用任务数、拒答数和运行条件同时保留。未披露备用信息时使用公布分并标注未知；不将未知解释为零次备用。原模型口径未披露独立 SE 时保留未知，不借用混合公布分的 SE。

来源链接严格使用已审核的版本、effort 与目标身份。Muse Spark Max 不能向 XHigh 回填，未标明 0902 的 Qwen Max 不连接固定 0902 配置。更新来源和评分指标不自动新增读者模型。规则详见 [Scoring v3.1](llm_pk_scoring_methodology_v3_1.md) 与 [Source registry v3.1](llm_pk_data_source_registry_v3_1.md)。
