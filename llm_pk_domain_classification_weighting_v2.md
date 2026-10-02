# LLM PK 领域归类与权重方案

**版本：Domain Classification & Weighting v2.2**

本文档只定义六个能力领域、原子指标归属和领域内权重。归一化、缺失值处理、
覆盖门槛、总分聚合和实用分算法继续沿用现有 Scoring 版本，不在本次变更中修改。

---

# 1. 设计原则

1. 六个领域继续等权，各占能力分的 \(1/6\)。
2. 每个原子指标只进入一个领域。
3. Coding 与 Engineering 分开：前者衡量代码推理与实现，后者衡量端到端工程和专业工作。
4. 原 Reliability 不再作为独立领域；事实非幻觉归入 Search & Knowledge，Agent 错误恢复与工具幻觉归入 Agentic Work。
5. v2.2 只替换五个已过时的指标；每个新指标原样继承被替换项的领域与权重槽位。
6. 综合指标与其组成项不得重复计分。

---

# 2. 六个能力领域

| 领域 | 总分权重 | 主要含义 |
|---|---:|---|
| Chatting | 16.67% | 指令遵循、多轮对话、表达与开放式提示 |
| Math & Science | 16.67% | 数学、科学和高难度学术推理 |
| Coding | 16.67% | 代码生成、算法、科学计算与文本式编程 |
| Engineering | 16.67% | 软件工程、终端任务、专业工作与代码库执行 |
| Agentic Work | 16.67% | 多步业务任务、生产 Agent 控制、纠错与工具可靠性 |
| Search & Knowledge | 16.67% | 开放域知识、非幻觉、长上下文检索与联网搜索 |

---

# 3. Chatting

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| Instruction Following | Arena Text | 30% |
| Multi-Turn | Arena Text | 30% |
| Creative Writing | Arena Text | 20% |
| Hard Prompts | Arena Text | 20% |
| **合计** |  | **100%** |

四项权重按照任务重要性分配；实时覆盖率由配置审计输出，不固化在权重规范中。

---

# 4. Math & Science

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| EnigmaEval | Scale Labs | 30% |
| Terminal-Bench-Science 0.1 | Terminal-Bench / Stanford / Harbor | 30% |
| CritPt | Artificial Analysis | 20% |
| Arena Math | Arena Text | 20% |
| **合计** |  | **100%** |

EnigmaEval 替代 HLE，Terminal-Bench-Science 0.1 替代 GPQA Diamond；两个 30% 权重槽位均不变。
前者测试复杂、多模态、跨领域谜题推理，后者测试来自真实科研工作的可复核分析、模拟、证明、代码和数据产物。

---

# 5. Coding

Coding 只评价代码推理与实现，不再混入端到端软件工程、WebDev 或生产 Agent Harness。

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| SWE-rebench v2 · Current Window | SWE-rebench | 55% |
| Arena Text Coding | Arena Text | 45% |
| **合计** |  | **100%** |

SWE-rebench v2 的当前时间窗替代 SciCode，继承 55% 权重；Arena Text Coding 保留真实用户编程体验信号。
每次更新必须把时间窗作为指标版本的一部分，不能把不同窗口的分数混为同一指标。

---

# 6. Engineering

Engineering 将原 Coding & Engineering 中的端到端工程指标，与 Professional Work
中的专业交付和终端操作组合为同一领域。

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| GDPval-AA v2 | Artificial Analysis | 20% |
| Terminal-Bench 4.0 | Terminal-Bench / Stanford / Harbor | 30% |
| AA Coding Agent · DeepSWE | Artificial Analysis | 13.33% |
| AA Coding Agent · SWE-Atlas-QnA | Artificial Analysis | 13.33% |
| FrontierCode 1.1 Main · Pass Rate | Cognition | 13.33% |
| Code Arena WebDev Overall | Arena Code | 10% |
| **合计** |  | **100%** |

Terminal-Bench 4.0 替代 Terminal-Bench v2.1，继承 30%；FrontierCode 1.1 Main 的
Pass Rate 替代 AA Coding Agent · Terminal-Bench v2，继承 13.33%。三项生产 Coding
Agent 工程指标仍合计 40%，WebDev 仍占 10%。WebDev 不被视为可选择的生产 Harness，
且单独一项仍不足以形成 Engineering 分。

AA Coding Agent Index 是 DeepSWE、Terminal-Bench v2 和 SWE-Atlas-QnA 的综合值。
它及已被替换的 Terminal-Bench v2 明细继续保留在历史来源卡片中用于审计，但不进入能力分。

## 6.1 v2.2 指标替换记录

| 退出指标 | 新指标 | 领域 | 领域内权重 | 新指标发布/更新时间 |
|---|---|---|---:|---|
| Humanity’s Last Exam | EnigmaEval | Math & Science | 30% | 2026-07-23 更新 |
| GPQA Diamond | Terminal-Bench-Science 0.1 | Math & Science | 30% | 2026-08-27 发布（代码标签 v0.1.0：2026-08-26） |
| SciCode | SWE-rebench v2 · 2026-05-15—2026-07-01 窗口 | Coding | 55% | 当前计分窗口截至 2026-07-01 |
| Terminal-Bench v2.1 | Terminal-Bench 4.0 | Engineering | 30% | 2026-08-28 发布 |
| AA Coding Agent · Terminal-Bench v2 | FrontierCode 1.1 Main · Pass Rate | Engineering | 13.33% | 2026-07-07 发布；榜单数据截至 2026-09-03 |

上表的“更新时间”属于基准版本或所采集榜单快照，不是模型发布日期。五个退出指标仍可保留在原始来源快照中供审计，但不再出现在活动评分注册表里。

---

# 7. Agentic Work

Agentic Work 评价多轮业务任务中的工具执行，以及生产 Agent 环境中的控制、纠错和
任务完成行为。τ³-Banking 因其多轮 API 调用与任务执行属性从 Engineering 移入本领域。

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| τ³-Banking | Artificial Analysis | 40% |
| Confirmed Success | Arena Agent | 21% |
| Steerability | Arena Agent | 12% |
| Praise vs Complaint | Arena Agent | 6% |
| Bash Recovery | Arena Agent | 12% |
| Tool Hallucination | Arena Agent | 9% |
| **合计** |  | **100%** |

τ³-Banking 直接测试多步工具任务，因此承担 40%。五项 Arena Agent 行为信号合计
60%；其中任务成功为核心，控制与错误恢复次之，工具幻觉和用户反馈作为可靠性与体验信号。

---

# 8. Search & Knowledge

| 指标 | 来源 | 领域内权重 |
|---|---|---:|
| AA-Omniscience Accuracy | Artificial Analysis | 35% |
| AA-Omniscience Non-Hallucination | Artificial Analysis | 30% |
| AA-LCR | Artificial Analysis | 25% |
| Search Arena | Arena Search | 10% |
| **合计** |  | **100%** |

知识准确性、非幻觉和长上下文检索合计 90%。Search Arena 是领域中唯一直接衡量
真实联网搜索的指标，因此保留 10%。

Search Arena 仍然受配置匹配边界约束：搜索配置的数据不得向无搜索工具的 Chat 配置反向回填。

---

# 9. 原 Reliability 指标去向

| 原指标 | v2.2 归属 | 权重 |
|---|---|---:|
| AA-Omniscience Non-Hallucination | Search & Knowledge | 30% |
| Bash Recovery | Agentic Work | 12% |
| Tool Hallucination | Agentic Work | 9% |

OpenRouter Uptime 继续只作为基础设施元数据，不进入六个能力领域。

---

# 10. 版本边界

本版本只替换五个活动指标，并保持它们原有的领域与权重：

- 不改变单项变换；
- 不改变 Max100 / Median50 归一化；
- 不改变缺失指标处理；
- 不改变覆盖率门槛；
- 不改变六领域总分聚合；
- 不改变速度与成本实用分。

以后如需修改上述算法，应发布新的 Scoring Version；领域分类或权重变化则发布新的 Weighting Version。
