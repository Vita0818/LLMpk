# LLMpk Domain Classification & Weighting v3.0

生效日期：2026-10-03。主榜六域等权，各占 1/6；合格领域不足六个时不生成综合分。

| Domain | 衡量内容 | 领域内来源与配置权重 |
| --- | --- | --- |
| Chatting | 对话、指令与表达 | Arena Instruction 30%、Multi-Turn 30%、Creative 20%、Hard Prompts 20% |
| Reasoning | 推理、科学知识与检索整合 | AA HLE 30%、CritPt 25%、Arena Math 25%、Arena Search 20% |
| Coding | 编程解题与代码库交付 | Arena Coding 60%、FrontierCode 1.1 Main Pass Rate 40% |
| Frontend | Web 应用和界面生成 | Arena WebDev 60%、DesignArena Overall Frontend 40% |
| Agentic | 终端任务与生产 Agent 行为 | AA TB4 60%；Arena Success 14%、Steerability 8%、Praise 4%、Bash Recovery 8%、Tool Hallucination 6% |
| Documents | 专业文档任务 | AA GDP.pdf All-pass 100% |

HLE 与 CritPt 组成高难度独立推理评测，Arena 数学和检索评价补充真实使用任务。Search 不再单列，GDP.pdf 从专业文档交付角度归入 Documents。

Coding 将文本编程与真实仓库的 blocker 通过率结合。FrontierCode 按官方当前 1.1 Main 和实际 effort/harness 记录，不取“最佳档位”代替所展示档位。七月 SWE-rebench 滚动窗口暂退出评分，保留历史详情。

Frontend 单独计分。DesignArena 尚未取得 API 密钥，当前没有该项观测；配置权重仍为 40%，因此只有 Arena WebDev 时覆盖率明确为 60%。不把缺测数据标成满覆盖，也不拼造 DesignArena Elo。

Agentic 的 AA TB4 是固定 mini-swe-agent 下的模型级评测，不能说成 Codex/Claude Code 的实测。Arena Agent Mode 是生产执行信号，只连接相应 Agent/CLI 路线；允许的向上回退必须保留来源环境。直接 Terminal-Bench CLI 记录保留作详情，不与 AA TB4 重复计分。

AA 能力指标仅保留 HLE、CritPt、TB4、GDP.pdf。GDPval、旧 DeepSWE/SWE-Atlas、τ³、Omniscience、LCR、EnigmaEval、TB-Science 与旧窗口 SWE-rebench 不参与当前权重。

全部权重留在覆盖分母。每域 60%、六域均合格、总覆盖 75% 才有综合排名。门槛是当前产品规则，可版本化调整；它不能代替对缺测类别和不同测试条件的审查。
