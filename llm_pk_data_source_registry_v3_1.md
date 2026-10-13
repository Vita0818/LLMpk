# LLMpk Data Source Registry v3.1

生效日期：2026-10-12。26 个能力计分指标，其中七项来自 Vals 独立评测；另保留 Vals Index 与 Vals TB4 作参考。六领域及覆盖门槛沿用 v3.0。

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
| Vals AI | Legal Research、Tax Agent、Code Migration、Vibe Code、Finance Agent、Excel Modeling、HLAB | 原始 accuracy 为百分数；已披露备用任务采用官方 noFallbackScorePct；保留公布分、版本、effort、环境、SE 和来源日期 |

主要官方说明：[AA HLE](https://artificialanalysis.ai/evaluations/humanitys-last-exam)、[CritPt](https://artificialanalysis.ai/evaluations/critpt)、[AA TB4](https://artificialanalysis.ai/evaluations/terminalbench-4-0)、[GDP.pdf](https://artificialanalysis.ai/evaluations/gdp-pdf)、[Arena](https://arena.ai/leaderboard)、[FrontierCode](https://cognition.com/frontiercode)、[DesignArena API](https://docs.designarena.ai/api-reference/overview)。

FrontierCode 通过官方页面实际使用的 [JSON 端点](https://cognition.com/data/frontiercode-leaderboard/data.json) 刷新，记录抓取时间、revision、dataset、原文件 SHA-256 和实际结果。2026-10-02 抓取包含 42 个模型、125 个 Main effort 记录。此次按已审核的 8 个当前模型和真实生产 harness 生成 37 张当前来源卡；未知模型/harness 不自动借给榜单配置。

DesignArena 获取器使用项目专用 `LLMPK_OPENROUTER_BENCHMARK_API_KEY`，不读取通用 OpenRouter key。当前镜像返回 149 个配置行、128 个模型版本标识，保留原始 Elo、胜率、生成时间、来源引用和 SHA-256。来源 `meta.as_of` 与抓取时间分别保存；未披露的榜单更新时间、测量日期、样本量、置信区间与 benchmark/harness 版本保持未知，不能将全零 tournament_stats 解释为统计样本。

模型连接由 `src/data/designArenaReviewedMappings.json` 明确声明，逐条核对 arena、category、模型 permaslug、发布名称、目录中的固定版本及目标配置 ID/model/profile/harness。同一 permaslug 的多档记录不自动合并；Muse Spark 1.3 XHigh 使用发布的 xhigh 行，Max 行另存但不能向下回填。2026-10-08 审核 13 个来源配置；2026-10-11 明确补充 Opus 同模型、同 effort、同 harness 的两个订阅访问配置，现连接 12 个在榜家族的 22 个配置。11 个来源未披露 effort，保留 Default 条件；向 High/XHigh/Max 的连接逐项声明单向 fallback。内部前端构建环境属于模型级测试方法，不冒充所展示生产 CLI 的实测。

Qwen3.8 Max 的 8 月来源不连接固定 0902 配置；GPT-6.1 Sol、Sonnet 5.5、DeepSeek V4.1 Flash 等缺少当前版本来源时继续缺测。不按最高 Elo 选档，不根据名称相似、来源排序或继任关系补值。来源刷新不能新增映射；已审核的完整来源身份消失或重复时，刷新失败并保留已发布快照。

OpenRouter 自有 GPQA、τ-bench 和四项联网搜索评测保留在独立原始档案与诊断快照中。本版本未为它们分配能力权重，不替换 AA HLE、AA TB4 或 Arena Search 等定义与执行条件不同的指标。

旧指标和旧模型仍保留在原始快照、来源卡与历史标准中，供复核和迁移使用；没有进入当前评分集合。`scoringRole` 将当前四项 AA 能力指标、仅展示指标与实用回退指标分开记录。

来源身份包含模型版本、effort、harness、数据集/评测版本和采样条件。Qwen3.8-Max 固定 0902 来源，不能用无版本 Max 或 Max Prime 补分。Pro、Fast、不同继任版本的来源不互借。

读取来源不等于获得成绩：缺测单项是 null，保留配置权重用于覆盖率。原始值为 0 是有效观测，不能当成缺测。来源不披露 CI 或样本量时不臆造置信度。评分规则见 [Scoring v3.1](llm_pk_scoring_methodology_v3_1.md)。

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

## 2026-10-12 Vals 来源接入

从 [Vals 官方页面](https://www.vals.ai/benchmarks/vals_index)实际引用的 `/_astro/benchmark_view_*.json` 获取数据，无需 API Key。九个页面分别抓取与校验：主指数、Finance Agent v2、Excel Modeling Benchmark、Vibe Code Bench 1.1、Code Migration、Terminal-Bench 4.0、Legal Research Bench、Harvey HLAB、Tax Agent Bench。源数据更新于 2026-10-07 至 2026-10-08；抓取时间单独记录，不能当成重新测试时间。

完整快照保留 111 个模型/执行标识和 8,819 条总体、任务类别及指数分项记录。这些行数不是独立任务样本量。24 个来源身份经过显式版本与运行设置审核，生成 198 张来源卡，并为 39 个既有配置提供 Vals 证据。模型、effort、harness、温度、输出预算及供应商条件写入 `src/data/valsReviewedMappings.json`；刷新只更新既有身份的数值，条件变化、来源消失或重复时要求重新审核。

七项独立评测按任务内容进入 Reasoning、Coding、Frontend、Agentic 与 Documents，领域内权重见 [Weighting v3.1](llm_pk_domain_classification_weighting_v3_1.md)。Vals Index 2.1 的金融/编程/法律/税务 GDP 加权结果作为参考综合指数保存，不重复进入计分。各独立评测也保留自己的总体成绩，尤其 Code Migration 独立榜使用完整任务，而指数使用不同子集，两者不能互填。Vals Terminal-Bench 与 AA Terminal-Bench 保持独立来源；当前只计 AA TB4，Vals TB4 保留作参考；任务耗时与每任务费用只保留在来源档案中，不充当 TTFT、吞吐或 API 单价。

配置详情的 Vals 区域单独披露来源 effort、评测环境、榜单更新时间、公布分、原模型分和标准误。官方图表模块公开逐模型/评测的拒答和备用统计；获取器只解析静态数据声明，不执行上游脚本。元数据的 benchmark ID、模型 ID 和公布分必须与 JSON 当前运行匹配。已披露备用任务时使用官方 `noFallbackScorePct`，将备用任务计为失败；例如 Opus 5.5 的 Code Migration 从公布的 66.646% 改用官方原模型口径 18.416%，106 个备用任务保留可查。未披露备用信息时采用公布分并标注未知。SE 不变成 95% CI，原模型口径缺少独立 SE 时也不借用混合公布分的 SE。`harness=null` 保留为环境未披露，Vibe Code 的 OpenHands 环境保留原名。

Muse Spark 1.3 Max 与 XHigh 分别存卡；Max 不连接 XHigh 配置。Vals 的 Qwen3.8 Max 没有证明是本站固定的 0902 版本，暂不连接。未披露 effort 使用明确的 Default 条件；只允许已经声明的向上档位回退，`0.99` 等未解释数值不自动等价于 XHigh。当前未连接的版本、产品和档位继续保留在完整来源快照中。

## 2026-10-13 新模型与来源刷新

本次增加四条独立产品线：[Muse Wonder / Wonder Full](https://dev.meta.ai/models/muse-wonder)、[Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)、[Mistral Large 4 Preview](https://mistral.ai/news/mistral-large-4/)。目录为 34 条产品线 / 52 个内部配置，公开页合并为 36 个代表配置，其中 21 个达到六域及总体覆盖门槛。原有 Scoring v3.1 的 26 项指标与权重保持不变。

Wonder 与 Full 各自保留 AA Max 模型和 Muse Code 执行证据；不合并或跨型号补分。Full 当前只通过 Muse Code Power / Maximum 订阅提供，官方月费分别为 $50 / $200。本站采用 Maximum 访问代表，月费显示 $200；API 定价及可用 API 等效额度未披露，额度、成本调整和实用分保持 null。其 Vals 来源以 AA 固定模型 ID `muse-wonder-full` 与 2026-10-12 发布日期双重锁定，不伪造 OpenRouter 版本。

Haiku 5.5 保留 Low、Medium、High、XHigh、Max 独立来源，公开页采用已测 Max Claude Code 执行。FrontierCode Main Max 通过率为 51.65%；新行的 flagged rate 未公布，保留 null。Devin Fusion 的 Opus 主模型 / Haiku 副模型结果不归给 Haiku 单模型。Haiku 基础输入 / 输出价格 $0.10 / $0.50 对应不超过 100K 的提示长度，超过该阈值为 $0.50 / $2.50；批处理另存，不冒充普通 API 价格。

新的 Vals 抓取日期为 10 月 13 日，九个来源页面均更新于 10 月 12 日；完整档案包含 114 个模型/执行 ID 与 9,137 条结果。28 个已审核身份生成 234 张来源卡，为 43 个既有配置提供证据。DesignArena 10 月 13 日镜像包含 153 行，15 个审核来源连接 24 个配置；新增 Haiku 5.5 和 Mistral Large 4 的完整版本映射，未披露 effort 继续标记 Default。

AA GDP.pdf 主榜初始化只提供 32 个选中模型；[官方模型比较页](https://artificialanalysis.ai/models/mistral-medium-3-5)公开完整原始比较记录。本站按精确 slug 和发布日期连接，静态解析模型自身及对比表，补齐 212 条 GDP.pdf 记录；与初始榜重复的值必须一致。补充行保留实际来源页和字段，不复制继任模型或不同 effort 的成绩。LongCat 2.0 的 TB4 原始 0 分与 GDP.pdf 原始 6.4% 均保留，不将 0 当成缺测。

Arena Text / Search 迁移到 `/leaderboard/chat/`。本次通过正常浏览器读取九个官方页面的完整内嵌 Flight 数据，静态解析并保存抓取方式与哈希；没有执行来源脚本。Arena 的新 Bash Reliability（`bash_reliability_no_prereq`）与旧 Bash Recovery（`bash_recovery_steps`）定义不同，不能替换旧计分项。旧恢复记录保留原值和 10 月 2 日日期，新可靠性字段留在原始档案中。Wonder、Full、Haiku 尚缺 Chatting 来源，继续显示领域分和覆盖状态而不分配总分或名次。
