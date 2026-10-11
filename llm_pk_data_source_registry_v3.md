# LLMpk Data Source Registry v3.0

生效日期：2026-10-03。19 个配置指标。2026-10-08 接通 DesignArena 真实来源，不改变指标集合、权重或默认模型目录。

| 来源 | 当前计分指标 | 原始尺度与边界 |
| --- | --- | --- |
| Artificial Analysis | HLE、CritPt、Terminal-Bench 4.0、GDP.pdf All-pass | 准确率比例；精确版本与 effort；保留 Default Fallback 等来源条件 |
| Arena.ai Text / Search | Instruction、Multi-Turn、Creative、Hard、Math、Coding、Search | Bradley–Terry / Elo 等来源连续尺度；带来源 CI 时保留 |
| Arena.ai WebDev | WebDev Overall | Benchmark 内部构建环境；模型级前端信号 |
| Arena.ai Agent | Success、Steerability、Praise、Bash Recovery、Tool Hallucination | 原来源正向效果量；实际执行环境为 Arena Agent Mode |
| Cognition FrontierCode | 1.1 Main Pass Rate | 官方 `v1_1.data[model][effort].main.correct`；按来源 harness 与 effort 连接 |
| DesignArena | Overall Frontend Elo | 官方 Models Arena / codecategories，经 OpenRouter Benchmark API 获取；按完整来源配置与已审核目标连接 |
| OpenRouter / AA 实用数据 | 输入输出价格、TTFT、吞吐 | 只调整实用分，不进入六域能力权重；来源、路由和 effort 的测量条件需分别审视 |
| SemiAnalysis 订阅实测 | 逐套餐、逐模型的月度 API 等效额度 | 公开 agentic 工作负载；满额利用假设；只调整成本，不提供能力或速度证据 |

主要官方说明：[AA HLE](https://artificialanalysis.ai/evaluations/humanitys-last-exam)、[CritPt](https://artificialanalysis.ai/evaluations/critpt)、[AA TB4](https://artificialanalysis.ai/evaluations/terminalbench-4-0)、[GDP.pdf](https://artificialanalysis.ai/evaluations/gdp-pdf)、[Arena](https://arena.ai/leaderboard)、[FrontierCode](https://cognition.com/frontiercode)、[DesignArena API](https://docs.designarena.ai/api-reference/overview)。

FrontierCode 通过官方页面实际使用的 [JSON 端点](https://cognition.com/data/frontiercode-leaderboard/data.json) 刷新，记录抓取时间、revision、dataset、原文件 SHA-256 和实际结果。2026-10-02 抓取包含 42 个模型、125 个 Main effort 记录。此次按已审核的 8 个当前模型和真实生产 harness 生成 37 张当前来源卡；未知模型/harness 不自动借给榜单配置。

DesignArena 获取器使用项目专用 `LLMPK_OPENROUTER_BENCHMARK_API_KEY`，不读取通用 OpenRouter key。当前镜像返回 149 个配置行、128 个模型版本标识，保留原始 Elo、胜率、生成时间、来源引用和 SHA-256。来源 `meta.as_of` 与抓取时间分别保存；未披露的榜单更新时间、测量日期、样本量、置信区间与 benchmark/harness 版本保持未知，不能将全零 tournament_stats 解释为统计样本。

模型连接由 `src/data/designArenaReviewedMappings.json` 明确声明，逐条核对 arena、category、模型 permaslug、发布名称、目录中的固定版本及目标配置 ID/model/profile/harness。同一 permaslug 的多档记录不自动合并；Muse Spark 1.3 XHigh 使用发布的 xhigh 行，Max 行另存但不能向下回填。2026-10-08 审核 13 个来源配置；2026-10-11 明确补充 Opus 同模型、同 effort、同 harness 的两个订阅访问配置，现连接 12 个在榜家族的 22 个配置。11 个来源未披露 effort，保留 Default 条件；向 High/XHigh/Max 的连接逐项声明单向 fallback。内部前端构建环境属于模型级测试方法，不冒充所展示生产 CLI 的实测。

Qwen3.8 Max 的 8 月来源不连接固定 0902 配置；GPT-6.1 Sol、Sonnet 5.5、DeepSeek V4.1 Flash 等缺少当前版本来源时继续缺测。不按最高 Elo 选档，不根据名称相似、来源排序或继任关系补值。来源刷新不能新增映射；已审核的完整来源身份消失或重复时，刷新失败并保留已发布快照。

OpenRouter 自有 GPQA、τ-bench 和四项联网搜索评测保留在独立原始档案与诊断快照中。本版本未为它们分配能力权重，不替换 AA HLE、AA TB4 或 Arena Search 等定义与执行条件不同的指标。

旧指标和旧模型仍保留在原始快照、来源卡与历史标准中，供复核和迁移使用；没有进入当前评分集合。`scoringRole` 将当前四项 AA 能力指标、仅展示指标与实用回退指标分开记录。

来源身份包含模型版本、effort、harness、数据集/评测版本和采样条件。Qwen3.8-Max 固定 0902 来源，不能用无版本 Max 或 Max Prime 补分。Pro、Fast、不同继任版本的来源不互借。

读取来源不等于获得成绩：缺测单项是 null，保留配置权重用于覆盖率。原始值为 0 是有效观测，不能当成缺测。来源不披露 CI 或样本量时不臆造置信度。评分规则见 [Scoring v3](llm_pk_scoring_methodology_v3.md)。

## 2026-10-11 订阅额度复核

依据 [SemiAnalysis 原文](https://newsletter.semianalysis.com/p/anthropic-subscriptions-offer-5x)及公开图表逐项转录；原文标注日期为 2026-10-05，核对日期为 2026-10-11，不表示重新实测当日限额。完整来源、图表地址和精确套餐/模型键保存于 `src/data/subscriptionPricing.ts`。

| 模型 | $20/月套餐的可用 API 等效额度 | $200/月套餐的可用 API 等效额度 | 图表 |
| --- | ---: | ---: | --- |
| GPT-6.1 Sol | ChatGPT Plus：$211/月 | ChatGPT Pro：$2,084/月 | [Sol / Opus](https://substack-post-media.s3.amazonaws.com/public/images/44bfcff4-5589-4822-a348-bc4e83cf478b_2048x1161.png) |
| GPT-6 Astra | ChatGPT Plus：$162/月 | ChatGPT Pro：$2,897/月 | [Astra / Fable](https://substack-post-media.s3.amazonaws.com/public/images/181ea48e-2e63-4f41-a742-c7af3d7eeb15_2048x1157.png) |
| Claude Opus 5.5 | Claude Pro：$1,178/月 | Claude Max 20×：$11,726/月 | [Sol / Opus](https://substack-post-media.s3.amazonaws.com/public/images/44bfcff4-5589-4822-a348-bc4e83cf478b_2048x1161.png) |
| Claude Sonnet 5.5 | Claude Pro：$1,241/月 | Claude Max 20×：$12,524/月 | [Claude 分模型](https://substack-post-media.s3.amazonaws.com/public/images/8fc90004-5853-4cd5-87ff-465898c5ee6b_2048x1033.png) |
| Claude Fable 5.1 | 不含于 Claude Pro | Claude Max 20×：$2,485/月 | [Astra / Fable](https://substack-post-media.s3.amazonaws.com/public/images/181ea48e-2e63-4f41-a742-c7af3d7eeb15_2048x1157.png) |

Fable 的 $2,485 已含 50% 模型上限。数据结构仍保留完整额度基准与可用比例，写为 $4,970 × 0.5；评分和详情展示均使用 $2,485，不再折半。ChatGPT $200 采用降额后口径，名称不再标为 20×；旧订阅临时保留到 2026-10-29 的较高限额不作为默认。

上述额度属于 agentic 混合负载，图表使用约 0.4% 输入、96.6% 缓存读取、2.6% 缓存写入、0.3% 输出（四舍五入后不严格合计 100%）。本站将月费/额度视为折扣系数，映射到既有 1M 输入 + 0.25M 输出场景；实际利用率、缓存比例及厂商限额会影响结果，不能解读为 API 现金余额或保证可消费的额度。原文未披露的 effort 不补成 Max。订阅共享对应模型和 harness 的能力、速度来源，缺失的能力证据继续缺失。

Google AI Pro / Ultra 保留旧估算 $260 / $5,200，GPT-5.6 Terra 的 ChatGPT Plus 保留 $100，历史 SuperGrok 记录保留 $150；均未得到本次可核对的对应模型公开实测，标为 `legacy-estimate`。已退役模型不因更新订阅而重新加入读者目录；不将 Sol 的实测迁移给 Terra/Luna，也不将 Opus 额度迁移给 Fable。SemiAnalysis 的付费订阅仪表盘本次未读取，公开证据以外的档位不推算。
