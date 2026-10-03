> 历史版本，仅供复核。当前规范见 [llm_pk_data_source_registry_v3.md](llm_pk_data_source_registry_v3.md)。旧分数不能直接与 v3 比较。

# LLM PK 数据源与指标注册表

**版本：Data Source Registry v1.2**

本文档定义 LLM PK 当前使用的数据来源、具体指标、原始数据类型、采集位置、纳入与排除规则，以及领域映射。

本文档只固定：

- 使用哪些平台；
- 从每个平台读取哪些指标；
- 每项指标读取什么原始值；
- 哪些平台综合分不得使用；
- OpenRouter 数据如何绑定具体访问配置。

本文档暂不固定：

- 六个领域内部的指标权重；
- 六个领域之间的权重；
- 最终数据抓取方式；
- 自动化采集频率；
- 数据源冲突时的优先级。

---

# 1. 当前数据来源

当前使用七类来源：

1. **Artificial Analysis**
   - 提供标准化能力评测的底层原子数据；
   - 不使用 Intelligence Index 或类别综合分。

2. **Arena.ai**
   - 提供真实用户偏好、搜索、Web 开发和 Agent 实际使用数据；
   - 使用具体类别 Score 和 Agent 子指标；
   - 不使用排名换分。

3. **OpenRouter**
   - 提供与具体模型端点对应的价格和性能数据；
   - 仅用于成本、速度和部分基础设施元数据；
   - 不作为能力评分来源。

4. **Scale Labs**
   - 直接读取 EnigmaEval 官方榜单；
   - 不经聚合榜转载。

5. **Terminal-Bench / Stanford / Harbor**
   - 直接读取 Terminal-Bench 4.0 与 Terminal-Bench-Science 0.1 官方榜单；
   - 分数必须绑定模型、reasoning effort 与 agent / harness。

6. **SWE-rebench**
   - 直接读取 v2 官方滚动时间窗；
   - 时间窗是指标版本的一部分。

7. **FrontierCode（Cognition）**
   - 直接读取 FrontierCode 1.1 Main 的 Pass Rate；
   - 不使用 Score 与 Pass Rate 双重计分。

---

# 2. 通用数据原则

## 2.1 只使用连续原始值

允许进入评分的数值包括：

- 准确率；
- pass@1；
- 成功率；
- 连续 Rating；
- Bradley–Terry / Elo 风格 Score；
- 相对改善百分点；
- Token 价格；
- TTFT；
- Throughput；
- End-to-End Latency；
- Uptime 等连续比例。

以下数据不得用于换算能力分：

- Rank；
- Rank Spread；
- 排名百分位；
- 只有名次、没有连续分值的数据。

---

## 2.2 不重复使用平台综合分

若平台同时提供：

- 综合指数；
- 构成该指数的单项指标；

则只能选择其中一层。

固定规则：

```text
Use either:
- platform composite index

or:
- constituent atomic metrics

Never both.
```

当前版本优先使用底层原子指标。

---

## 2.3 一个基准只计一次

固定规则：

```text
One configuration × one benchmark × one benchmark version = one observation
```

同一基准被多个平台转载或收录时，不得重复计权。

平台数量不等于独立证据数量。

---

# 3. Artificial Analysis

## 3.1 使用范围

当前版本继续使用 Artificial Analysis 方法体系中尚未被替换的底层原子评测。

不使用：

- Artificial Analysis Intelligence Index；
- Agents category score；
- Coding category score；
- General category score；
- Scientific Reasoning category score。

原因是这些值已经由底层评测按 Artificial Analysis 自己的权重合成。

---

## 3.2 固定采集指标

活动评分表保留 6 个通用原子指标；另保留 2 个来源明确的 Coding Agent harness 明细。

| Internal ID | 指标 | 读取值 | 数据类型 | 官方查看位置 |
|---|---|---|---|---|
| `aa_gdpval_v2` | GDPval-AA v2 | Elo / Score 点估计 | 连续相对分 | GDPval-AA v2 独立评测页面 |
| `aa_tau3_banking` | τ³-Banking | pass@1 | 成功率 | τ³-Banking 独立评测页面 |
| `aa_lcr` | AA-LCR | pass@1 | 成功率 | Artificial Analysis Long Context Reasoning 页面 |
| `aa_omniscience_accuracy` | AA-Omniscience Accuracy | Accuracy | 准确率 | AA-Omniscience 页面中的 Accuracy |
| `aa_omniscience_nonhallucination` | AA-Omniscience Non-Hallucination | 1 − Hallucination Rate | 正向比例 | AA-Omniscience 页面中的 Hallucination 组成项 |
| `aa_critpt` | CritPt | pass@1 | 成功率 | CritPt 独立评测页面 |
| `aa_coding_agent_deepswe` | Coding Agent · DeepSWE | pass@1 | 成功率 | AA Coding Agents 页面 |
| `aa_coding_agent_swe_atlas_qna` | Coding Agent · SWE-Atlas-QnA | pass@1 | 成功率 | AA Coding Agents 页面 |

---

## 3.3 官方页面模式

Artificial Analysis 的独立评测页面通常采用以下路径模式：

```text
https://artificialanalysis.ai/evaluations/<evaluation-slug>
```

当前版本需要人工或程序化核对的页面包括：

```text
/evaluations/gdpval-aa
/evaluations/tau3-banking
/evaluations/artificial-analysis-long-context-reasoning
/evaluations/omniscience
/evaluations/critpt
/agents/coding-agents
```

方法说明入口：

```text
https://artificialanalysis.ai/methodology/intelligence-benchmarking
```

---

## 3.4 每条观测必须保存的字段

```text
source
source_metric
metric_version
model
model_version
reasoning_effort
harness
provider
raw_value
unit
metric_type
higher_is_better
confidence_low
confidence_high
sample_size
test_date
data_snapshot
source_url
tool_usage
is_composite
```

其中：

```text
source = Artificial Analysis
is_composite = false
```

必须保留模型推理强度和测试环境，不能只保存模型家族名称。

---

## 3.5 不再进入活动评分的 Artificial Analysis 项目

以下观测可继续保留在原始快照和历史来源卡片中，但不再注册为活动计分指标：

```text
Humanity’s Last Exam
GPQA Diamond
SciCode
Terminal-Bench v2.1
Coding Agent · Terminal-Bench v2
Coding Agent Index
```

前五项已由更新指标逐项替换；Coding Agent Index 是综合值，不能与仍保留的组成项重复计分。

## 3.6 v1.2 新增的直接评测来源

| Internal ID | 指标 | 官方发布方 | 读取值 | 版本/更新时间 | 官方入口 |
|---|---|---|---|---|---|
| `scale_enigmaeval` | EnigmaEval | Scale Labs | Accuracy / pass@1 | 2026-07-23 更新 | `https://labs.scale.com/leaderboard/enigma_eval` |
| `tbench_science_v01` | Terminal-Bench-Science 0.1 | Stanford / Terminal-Bench / Harbor | Resolution Rate | 2026-08-27 发布 | `https://www.terminal-bench-science.ai/` |
| `swe_rebench_v2` | SWE-rebench v2 · Current Window | SWE-rebench | Resolved Rate | 2026-05-15—2026-07-01 计分窗口 | `https://swe-rebench.com/` |
| `tbench_v4` | Terminal-Bench 4.0 | Stanford / Terminal-Bench / Harbor | Resolution Rate | 2026-08-28 发布；榜单快照 2026-09-04 | `https://www.tbench.ai/` |
| `frontiercode_v11_main_pass_rate` | FrontierCode 1.1 Main | Cognition | Pass Rate | 2026-07-07 发布；榜单快照 2026-09-03 | `https://cognition.com/frontiercode` |

这五项分别继承被替换指标的领域和权重。数据卡片只复制官方连续值，不从名次反推分数，也不为缺失模型制造替代值。

Terminal-Bench、Terminal-Bench-Science 与 FrontierCode 的对象是完整的模型执行配置：

```text
Identity + Execution + Infrastructure / Access
```

因此必须保存并匹配 `reasoning_effort` 与 `harness`。SWE-rebench 同时发布 Model 与 Agent
两类行：命名 Agent 行必须匹配具体 harness；本次导入的 Model 行保留 reasoning effort，
其公共 runner 作为基准内部方法，不虚构成用户可选择的第四项配置身份。

## 3.7 暂不纳入的其他 Artificial Analysis 项目

当前版本暂不纳入 Intelligence Index 之外的其他 Additional Evaluations，例如：

- AA-Briefcase；
- APEX-Agents-AA；
- LiveCodeBench；
- IFBench；
- MMLU-Pro；
- 其他后续新增评测。

这些指标可以作为后续扩展候选；当前版本先保持未被替换部分稳定。

---

# 4. Arena.ai

Arena 当前拆成四组：

1. Text Arena；
2. Code Arena；
3. Search Arena；
4. Agent Arena。

统一规则：

- 使用连续 Score 或连续相对改善点估计；
- 保存置信区间；
- 保存 Votes 或 Sessions；
- 保存 preliminary 状态；
- 不使用 Rank；
- 不使用 Rank Spread。

---

# 5. Arena Text

## 5.1 固定采集指标

| Internal ID | Arena 类别 | 读取值 | 数据类型 |
|---|---|---|---|
| `arena_text_instruction` | Instruction Following | Score 点估计 | Bradley–Terry 风格连续相对分 |
| `arena_text_multiturn` | Multi-Turn | Score 点估计 | 连续相对分 |
| `arena_text_creative` | Creative Writing | Score 点估计 | 连续相对分 |
| `arena_text_hard` | Hard Prompts | Score 点估计 | 连续相对分 |
| `arena_text_math` | Math | Score 点估计 | 连续相对分 |
| `arena_text_coding` | Coding | Score 点估计 | 连续相对分 |

---

## 5.2 官方查看入口

Arena Text 总入口：

```text
https://arena.ai/leaderboard/text
```

具体类别入口：

```text
https://arena.ai/leaderboard/text/instruction-following
https://arena.ai/leaderboard/text/multi-turn
https://arena.ai/leaderboard/text/creative-writing
https://arena.ai/leaderboard/text/hard-prompts
https://arena.ai/leaderboard/text/math
https://arena.ai/leaderboard/text/coding
```

---

## 5.3 固定提取设置

```text
View: Models
Adjustments: None
License: All
Value: Score point estimate
Metadata: confidence interval, votes, preliminary status
```

若页面有多种展示模式，应保证抓取的是连续 Score，而不是 Rank 或 Pareto Rank。

---

## 5.4 排除项

当前版本不使用：

```text
Arena Text Overall
Arena Text Rank
Arena Text Rank Spread
Arena Text Pareto Rank
```

原因：

- Text Overall 已混合多个能力类别；
- 若同时使用类别 Score，会重复吸收同一批投票信息；
- Rank 和 Rank Spread 不保留连续分差。

---

# 6. Arena Code

## 6.1 固定采集指标

| Internal ID | 指标 | 读取值 | 数据类型 |
|---|---|---|---|
| `arena_code_webdev` | Code Arena WebDev Overall | Score 点估计 | 连续相对分 |

---

## 6.2 官方查看入口

```text
https://arena.ai/leaderboard/code/webdev
```

---

## 6.3 使用规则

当前版本使用 WebDev Overall，而暂不同时采集：

- Fullstack；
- Frontend；
- HTML；
- React；
- 其他 WebDev 子类别。

原因是这些子类别很可能与 Overall 使用同一组或高度重叠的投票数据。当前版本先避免重复计权。

必须保留模型名称中的执行环境信息，例如：

```text
codex-harness
thinking
xhigh
high
```

Code Arena 的对象可能是完整的：

```text
Identity + Harness
```

而不是单独基础模型。

---

# 7. Arena Search

## 7.1 固定采集指标

| Internal ID | 指标 | 读取值 | 数据类型 |
|---|---|---|---|
| `arena_search` | Search Arena Score | Score 点估计 | 连续相对分 |

---

## 7.2 官方查看入口

```text
https://arena.ai/leaderboard/search
```

---

## 7.3 使用规则

Search Arena 评测的是集成搜索能力的具体配置。

必须保留完整名称，例如：

```text
model-search
model-grounding
provider-search
```

不得将 Search Arena 分数自动赋给没有搜索能力的普通基础模型配置。

同时保存：

```text
confidence_interval
votes
preliminary_status
snapshot_date
```

---

# 8. Arena Agent

## 8.1 固定采集子指标

| Internal ID | 指标 | 读取值 | 数据类型 |
|---|---|---|---|
| `arena_agent_success` | Confirmed Success | 点估计 | 有符号相对改善百分点 |
| `arena_agent_praise` | Praise vs Complaint | 点估计 | 有符号相对改善百分点 |
| `arena_agent_steerability` | Steerability | 点估计 | 有符号相对改善百分点 |
| `arena_agent_bash_recovery` | Bash Recovery | 点估计 | 有符号相对改善百分点 |
| `arena_agent_tool_hallucination` | Tool Hallucination | 点估计 | 有符号相对改善百分点 |

---

## 8.2 官方查看入口

```text
https://arena.ai/leaderboard/agent
```

---

## 8.3 使用规则

Agent Arena 的子指标不是普通成功率，而是相对于基线的连续改善效果量。

因此：

```text
metric_type = continuous_relative
```

必须原样保留正负号。

特别注意：

```text
Tool Hallucination
```

虽然名称中包含 Hallucination，但页面发布的值本身已是平台定义的相对效果量，不能未经核对就执行：

```text
1 - x
```

应按照平台给定方向确定 `higher_is_better`。

---

## 8.4 保存的辅助元数据

```text
confidence_low
confidence_high
sessions
preliminary_status
snapshot_date
```

Sessions 不直接计入能力分，只表示证据量和统计稳定程度。

---

## 8.5 排除项

当前版本不使用：

```text
Arena Agent Net Improvement
Arena Agent Rank
```

原因：

- Net Improvement 已由五个子指标组成；
- 若使用五个子指标，再加入 Net Improvement 会重复计分。

---

# 9. OpenRouter

## 9.1 使用范围

OpenRouter 当前仅用于：

- 成本；
- 速度；
- 部分基础设施可靠性元数据。

OpenRouter 不作为能力数据来源。

---

# 10. OpenRouter 成本指标

## 10.1 固定采集字段

| Internal ID | 指标 | 单位 | 是否正式进入成本计算 |
|---|---|---|---|
| `or_price_input` | Input / Prompt price | USD/token 或 USD/1M tokens | 是 |
| `or_price_output` | Output / Completion price | USD/token 或 USD/1M tokens | 是 |
| `or_price_cache_read` | Cache-read price | USD/token | 若端点提供 |
| `or_price_cache_write` | Cache-write price | USD/token | 若端点提供 |
| `or_price_reasoning` | Separately billed reasoning price | USD/token | 若端点提供 |
| `or_price_request` | Per-request price | USD/request | 若端点提供 |
| `or_price_other` | Search、image、tool 等附加费用 | 对应计费单位 | 若配置实际使用 |

---

## 10.2 官方机器读取入口

```text
GET https://openrouter.ai/api/v1/models
```

模型数据中应读取：

```text
id
name
pricing.prompt
pricing.completion
pricing.request
pricing.image
pricing.web_search
pricing.internal_reasoning
links.details
```

字段以 OpenRouter 当时 API 返回为准。

然后根据：

```text
links.details
```

进入具体模型的端点详情。

---

## 10.3 官方人工查看入口

```text
https://openrouter.ai/<provider>/<model>
```

页面中查看：

```text
Providers
Pricing
Performance
Uptime
```

---

## 10.4 Effective Pricing

OpenRouter 页面可能提供考虑 Prompt Cache 后的滚动 Effective Pricing。

保存为参考字段：

```text
or_effective_price_30d_reference
```

但当前版本不将其作为正式成本输入。

原因：

- 它取决于 OpenRouter 全体用户的缓存命中结构；
- 不一定符合本项目定义的标准工作量；
- 正式成本应由输入、输出、缓存和附加调用量自行计算。

---

# 11. OpenRouter 速度指标

## 11.1 固定采集指标

| Internal ID | 指标 | 单位 | 方向 |
|---|---|---|---|
| `or_ttft_p50` | Time to First Token | 秒 | 越低越好 |
| `or_throughput_p50` | Output Throughput | tokens/s | 越高越好 |
| `or_latency_p50` | End-to-End / Total Latency | 秒 | 越低越好 |

若以后能够稳定获取尾部数据，另行保存：

```text
or_ttft_p90
or_throughput_p10
or_latency_p90
```

但不得与 p50 混为同一个指标。

---

## 11.2 官方查看位置

```text
OpenRouter model page
→ Performance
→ Provider / Endpoint
```

必须记录：

```text
model
provider
service_tier
routing_policy
fallback_enabled
measurement_window
snapshot_date
```

---

# 12. OpenRouter 基础设施元数据

当前版本保存但不计入能力分：

| Internal ID | 指标 | 用途 |
|---|---|---|
| `or_uptime_30d` | 过去 30 天请求成功率 | 基础设施可靠性候选 |
| `or_tool_call_success` | 工具调用成功率 | 执行可靠性候选 |
| `or_provider` | 实际 Provider | 配置身份 |
| `or_service_tier` | default / flex / priority 等 | 配置身份 |
| `or_routing_policy` | default / price / throughput / latency / order | 配置身份 |
| `or_fallback_enabled` | 是否允许 fallback | 配置身份 |
| `or_measurement_window` | 性能统计窗口 | 数据版本 |
| `or_snapshot_date` | 抓取日期 | 数据版本 |

---

# 13. OpenRouter 数据适用范围

固定规则：

```text
OpenRouter data applies only to an OpenRouter-based access configuration.
```

例如：

```text
Kimi K3
+ OpenCode
+ OpenRouter API
+ fixed Moonshot provider
```

可以使用对应 OpenRouter endpoint 的价格和性能。

但是：

```text
GPT-5.6 Sol
+ Codex CLI
+ ChatGPT Pro subscription
```

不能直接使用 OpenRouter 的：

- Token 价格；
- TTFT；
- Throughput；
- Latency。

原因是 Infrastructure / Access 不同。

若某配置缺少与自身访问方式匹配的速度或成本数据，则应显示：

```text
Practical Score unavailable
```

不得用 OpenRouter 数据替代。

---

# 14. OpenRouter Provider 与路由策略

## 14.1 固定 Provider

示例：

```text
Model: Kimi K3
Access: OpenRouter API
Provider: Moonshot
Routing: fixed
Fallback: disabled
```

使用该 Provider 端点的：

- 价格；
- TTFT；
- Throughput；
- Latency；
- Uptime。

---

## 14.2 动态路由

示例：

```text
Model: Kimi K3
Access: OpenRouter API
Routing: default
Fallback: enabled
```

不得直接采用：

- 最快 Provider 的性能；
- 最便宜 Provider 的价格；
- 任意单个端点的性能。

动态路由需要使用该路由策略下的实际加权结果。

若无法取得路由后的实际请求分布和有效性能，则暂不计算正式实用分。

---

# 15. 当前活动指标清单总览

## 15.1 Artificial Analysis：8 项

```text
1. GDPval-AA v2 Elo
2. τ³-Banking pass@1
3. AA-LCR pass@1
4. AA-Omniscience Accuracy
5. AA-Omniscience Non-Hallucination
6. CritPt pass@1
7. Coding Agent · DeepSWE pass@1
8. Coding Agent · SWE-Atlas-QnA pass@1
```

---

## 15.2 Arena.ai：13 项

```text
Text Arena
1. Instruction Following Score
2. Multi-Turn Score
3. Creative Writing Score
4. Hard Prompts Score
5. Math Score
6. Coding Score

Code Arena
7. WebDev Overall Score

Search Arena
8. Search Score

Agent Arena
9. Confirmed Success
10. Praise vs Complaint
11. Steerability
12. Bash Recovery
13. Tool Hallucination
```

---

## 15.3 OpenRouter：正式成本与速度字段

```text
Cost
1. Input price
2. Output price
3. Cache-read price
4. Cache-write price
5. Reasoning price
6. Per-request price
7. Other required charges

Speed
8. TTFT p50
9. Output throughput p50
10. End-to-end latency p50
```

保存但暂不计分：

```text
Uptime
Tool-call success
Provider
Service tier
Routing policy
Fallback policy
Measurement window
Snapshot date
```

---

## 15.4 评测方官网直采：5 项

```text
1. Scale Labs · EnigmaEval pass@1
2. Terminal-Bench-Science 0.1 Resolution Rate
3. SWE-rebench v2 Current Window Resolved Rate
4. Terminal-Bench 4.0 Resolution Rate
5. FrontierCode 1.1 Main Pass Rate
```

---

# 16. 当前明确排除的指标

## Artificial Analysis

```text
Intelligence Index
Agents category score
Coding category score
General category score
Scientific Reasoning category score
Humanity’s Last Exam（已替换）
GPQA Diamond（已替换）
SciCode（已替换）
Terminal-Bench v2.1（已替换）
Coding Agent · Terminal-Bench v2（已替换）
Coding Agent Index（综合值）
```

## Arena.ai

```text
Text Overall
Text Rank
Rank Spread
Pareto Rank
Agent Net Improvement
Agent Rank
WebDev subcategories when WebDev Overall is used
```

## OpenRouter

```text
Capability benchmark ranking
Best-provider performance used as generic model performance
OpenRouter data applied to non-OpenRouter access configurations
Platform-wide Effective Pricing used as formal configuration cost
```

---

# 17. 固定领域映射

权重以 Domain Classification & Weighting v2.2 为准。

| 领域 | 活动指标 |
|---|---|
| Chatting | Arena Instruction Following、Multi-Turn、Creative Writing、Hard Prompts |
| Math & Science | Scale EnigmaEval、Terminal-Bench-Science 0.1、AA CritPt、Arena Math |
| Coding | SWE-rebench v2 Current Window、Arena Text Coding |
| Engineering | AA GDPval-AA、Terminal-Bench 4.0、AA DeepSWE、AA SWE-Atlas-QnA、FrontierCode 1.1 Main Pass Rate、Arena Code WebDev |
| Agentic Work | AA τ³-Banking；Arena Confirmed Success、Praise vs Complaint、Steerability、Bash Recovery、Tool Hallucination |
| Search & Knowledge | AA-LCR、AA-Omniscience Accuracy、AA-Omniscience Non-Hallucination；Arena Search |
| Speed Adjustment | OpenRouter TTFT、Throughput、End-to-End Latency |
| Cost Adjustment | OpenRouter 各价格字段计算出的标准工作量有效成本 |

---

# 18. 建议的数据记录结构

## 18.1 能力观测

```json
{
  "source": "Scale Labs",
  "sourceMetric": "EnigmaEval",
  "metricVersion": "2026-07-23",
  "domain": "math_science",

  "model": "model-name",
  "modelVersion": "snapshot-or-release",
  "reasoningEffort": "high",
  "harness": null,
  "provider": null,
  "accessMethod": null,

  "rawValue": 0.842,
  "unit": "pass_at_1",
  "metricType": "accuracy",
  "higherIsBetter": true,

  "confidenceLow": null,
  "confidenceHigh": null,
  "sampleSize": 1161,

  "preliminary": false,
  "testDate": null,
  "dataSnapshot": "YYYY-MM-DD",
  "sourceUrl": "...",
  "isComposite": false
}
```

---

## 18.2 OpenRouter 性能观测

```json
{
  "source": "OpenRouter",
  "sourceMetric": "throughput_p50",

  "model": "model-slug",
  "provider": "provider-name",
  "routingPolicy": "fixed",
  "serviceTier": "default",
  "fallbackEnabled": false,

  "rawValue": 62.4,
  "unit": "tokens_per_second",
  "metricType": "positive_higher_better",

  "measurementWindow": "rolling",
  "dataSnapshot": "YYYY-MM-DD",
  "sourceUrl": "...",
  "isComposite": false
}
```

---

# 19. 固定结论

当前能力数据：

```text
Artificial Analysis atomic evaluations
+
Arena category scores and Agent submetrics
+
Scale Labs EnigmaEval
+
Terminal-Bench 4.0 and Terminal-Bench-Science 0.1
+
SWE-rebench v2 current window
+
FrontierCode 1.1 Main Pass Rate
```

当前速度与成本数据：

```text
OpenRouter endpoint-level pricing and performance
```

必须遵守：

1. 不使用 Artificial Analysis Intelligence Index；
2. 不使用其类别综合分；
3. 不使用 Arena Rank；
4. 不同时使用 Arena 子项和其上层综合项；
5. 不将同一基准重复计分；
6. OpenRouter 数据必须匹配具体端点与访问方式；
7. OpenRouter 数据不得替代订阅制或官方 API 的实际性能；
8. 所有观测必须绑定模型版本、推理强度、Harness、Provider 和数据快照；
9. 指标分类与权重按 Domain Classification & Weighting v2.2 执行；本次替换不改变评分算法。
