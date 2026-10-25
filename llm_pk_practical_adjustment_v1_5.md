# LLMpk Practical Adjustment v1.5

生效日期：2026-10-25。能力评分仍为 Scoring v3.4，84 项观测、六域权重、覆盖门槛和六轴雷达图不变。

## 算法和预算

沿用 `P = max(0, R + Δspeed + Δcost)`。单项相对同口径中位数的优势比为 r：吞吐为 `本项/中位数`，用时和成本为 `中位数/本项`。保留旧饱和函数：`r >= 1` 时 `u(r) = 1 - 1/r`，`0 < r < 1` 时 `u(r) = r - 1`；零优势比使用旧的 -0.99 下限。

领域效用为 `Σ 配置权重 × 单项效用`。正效用乘 7.5；速度负效用乘 8，成本负效用乘 12。速度和成本的正向奖励预算各占一半，保留成本较重的负向惩罚。没有改变能力评分或增加另一轮总分归一化。

| 指标组 | 速度预算 | 成本预算 |
| --- | ---: | ---: |
| AA Coding Agents 真实任务运行 | 35% | 35% |
| Vals 11 个独立评测任务 | 25% | 25% |
| AA Intelligence Index 任务折算 | 10% | 10% |
| API 输出吞吐 | 15% | — |
| API 首 token 延迟 | 15% | — |
| 1M 输入 + 0.25M 输出标准场景费用 | — | 30% |

任务层占 70%，其中直接运行资料占 60%，折算资料占 10%。Vals 的 11 个独立评测均分 25%；Vals Index 的综合值不重复计入。各任务在相同来源、版本、题集内计算中位数，不混合原始秒数或美元数。

## 证据和缺测

- AA Coding Agents 的 `mean.agentWallTimeSec` 是代理阶段墙钟时间；不是成功尝试专属均值，也不改称包含所有阶段的完整任务耗时。`mean.costUsd` 保留原评测 API 成本。
- Vals `latency` 为秒，`cost_per_test` 为该基准的每任务费用；原始版本、来源 effort、提供方和执行环境随指标保留。例如 EMB 的 2106.434 秒在官方表格显示为 35m06s。
- AA `intelligenceIndexTimePerTask` 按真实答案/推理 token 与实测 API 速度折算，明确标为估计；`intelligenceIndexCostPerTask` 按评测 token 与价格计算，不改成固定 token 单价。
- 已审核的同模型、同实测档位才提供任务效率证据；能力分中允许的异档成绩不自动授权异档耗时。AA 模型级任务是其评测环境的资料，不冒充生产 CLI 的独立计时。
- 备用模型混合运行的总耗时和总费用无法归属于原模型，因而不参与本版任务效率计算。纯失败、缺失成绩的运行不提供效率加成。
- 每个缺测项保留 null，其预算不贡献附加分；已测项目不重新放大到 100%。详情显示速度、成本各自的加权覆盖率。整域无可用资料时为 null，实用总分也为 null。
- 同一来源记录通过订阅或其他 API 路线重复出现，不重复影响任务速度中位数；同模型、档位和执行环境的重复访问不重复影响请求速度中位数。

## 订阅费用

沿用 SemiAnalysis 的套餐 × 模型实测值：`可用 API 等效额度 = 全额度基准 × 模型可用比例`。任务成本按 `原任务 API 费用 × 月费 / 可用等效额度` 近似折算，假设满额使用；这是对应 agentic 负载的估算，不是用户账单。Fable 5.1 的净 $2,485 已含 50% 上限，不能再次折半。共享套餐的不同模型额度不能相加。

只有 `measured` 订阅证据可折算 agentic 任务成本；AA 的推理任务混合负载不套用这组测量。旧估算仍只保留在标准 token 场景，明确标注；未知额度不生成成本加分。缓存配比、API 报价日期、利用率和额度变化都会影响估算。API 任务费用保留原提供方及测试环境，标准场景继续独立体现当前路由单价。

本地 SemiAnalysis 数据发布于 2026-10-05、核验于 2026-10-11，本版没有将其改称 10 月 25 日实时测量。OR 和 AA 的 API 速度供订阅路线参考，不等于订阅客户端独立测速。

## 来源

- [AA Coding Agent methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking)
- [AA Time per Task / Cost per Task definitions](https://artificialanalysis.ai/methodology)
- [Vals Excel Modeling](https://www.vals.ai/benchmarks/emb)
- [SemiAnalysis subscription measurements](https://newsletter.semianalysis.com/p/anthropic-subscriptions-offer-5x)
