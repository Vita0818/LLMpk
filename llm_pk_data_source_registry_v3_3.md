# LLMpk Data Source Registry v3.3

生效日期：2026-10-25（Australia/Perth）。本版新增 60 项计分指标，总计 108 项；49 条内部配置、35 条前台代表。来源原始采集主要在 2026-10-24 完成，榜单或运行日期按每行原文保留。

## 当前新增来源

| 平台 | 新接入内容 |
| --- | --- |
| [LiveBench](https://livebench.ai/#/methodology) | 2.0 / 2026-10-14 发布版，7 个 suite；53 个源模型行；22 个审核的当前模型身份 |
| [OpenCompass](https://rank.opencompass.org.cn/leaderboard/llm) | v3.0 文本版，22 行 × 24 个原子字段；15 个当前身份，保留模型链接、发布时间和评测日 |
| [Epoch AI](https://epoch.ai/benchmarks/use-this-data) | FrontierMath v2 两组难度与 MirrorCode；独立运行的 mean_score/SE、run ID、开始时间；不重复导入外部发布者镜像 |
| [Scale Labs](https://labs.scale.com/leaderboard) | MCP Atlas、HiL、SWE Atlas 重构/测试编写、SWE Pro V2 Full/HARD、RLI，7 项；生产 CLI 和内部框架分别保存 |
| [DesignArena](https://www.designarena.ai/leaderboard/code) | DataViz、UI Component、SVG；Python-PPTX、HTML 幻灯片和 Spreadsheet，6 项 |
| [Vals AI](https://www.vals.ai/benchmarks) | ProofBench 1.1、ProgramBench、VCB 1–100，3 项；加上原有 9 项，共 12 项 |
| [Artificial Analysis](https://artificialanalysis.ai/evaluations) | AnalystAgent pass^5、GDPval-AA 2.1、CritPt v2、AA-3D、Terminal-Bench Science 0.1，5 项 |
| [Arena](https://arena.ai/leaderboard) | Document、Vision、Image-to-WebDev，3 项；保存真实更新日期及对称/非对称 95% CI |
| [OpenRouter](https://openrouter.ai/benchmarks) | 原生 GPQA Diamond、τ-bench Airline，2 项；AA/DesignArena 镜像保留原发布者，不再重复导入 |

扩展快照含 23 个数据集、1649 条源记录；审核清单固定 343 个源身份和 666 个配置连接，运行时产生 343 张来源卡及 820 个原子观测。Vals 独立快照有 123 个模型/执行 ID、7008 个结果行；审核后的 327 张卡连接到 39 条现有配置。

## 采集与复现

实现为 [fetchSourceExpansionSnapshot.mjs](scripts/fetchSourceExpansionSnapshot.mjs)、[sourceExpansionSnapshotUtils.mjs](scripts/sourceExpansionSnapshotUtils.mjs)、[sourceExpansionSeedCards.ts](src/data/sourceExpansionSeedCards.ts)。每个数据集保留 URL、实际采集时间、原始文件、SHA-256、方法证据。新映射只来自 [sourceExpansionReviewedMappings.json](src/data/sourceExpansionReviewedMappings.json)。

```bash
npm run refresh:source-expansion -- --from-dir /path/to/validated/raw-pack
npm run refresh:source-expansion -- --arena-dom-dir /path/to/current/arena-captures --opencompass-rule-dom /path/to/current/opencompass-rule-version.json
npm run refresh:vals
npm run test:source-expansion
npm run validate:source-snapshots
```

网络采集使用既有专用 OpenRouter benchmark key；其余来源为公开数据。Epoch ZIP 仅读取三张指定 CSV，需要 Python 3 标准库，不执行来源脚本或解压任意路径。Vals 的页面关联 JSON 与拒答元数据继续采用原有静态解析方式。

Arena 的普通 HTTP 请求当前返回 403，需从官方页面保存完整表格的 rendered DOM；导入器校验 URL、日期、模型名、成绩与 CI 列。OpenCompass 数据 JSON 本身不提供规则版本，需附同一官方页面的 V3.0 版本标题证据。LiveBench notes 的零分政策和前端逐模型 effort 元数据均经哈希与静态解析校验。方法或身份变化时刷新先失败，保留现有发布文件。

## 质量与未挂接内容

DesignArena 有 8 组同名、同 permaslug、同分类但分数冲突的旧记录；16 行均保留原始值而不选择最高值。未匹配的旧 Kimi、旧 DeepSeek、八月 Qwen Max、OpenRouter Pro 变体和搜索任务旧模型不填给当前配置。来源未披露的版本、effort、样本量或不确定性保持未知。

[BFCL v4](https://gorilla.cs.berkeley.edu/leaderboard.html)、[OSWorld 2.0](https://osworld-v2.xlang.ai/) 和 [SWE-bench 官方榜](https://www.swebench.com/) 继续作为候选：本次核验到的公开记录以更早模型或不同电脑 Agent 环境为主，没有通过当前版本/执行身份的连接审核；不为当前模型制造分数或空的计分占位。

SciCode 依 [AA 官方状态](https://artificialanalysis.ai/evaluations/scicode) 显示 Under review，并保留受限权重。原 CritPt 与修订版 v2 分别存储。完整权重、相互重叠的预算及门槛见 [Weighting v3.3](llm_pk_domain_classification_weighting_v3_3.md) 和 [Scoring v3.3](llm_pk_scoring_methodology_v3_3.md)。

## 数据署名

DesignArena 结果来自 Design Arena，经 OpenRouter 提供，采用 CC BY 4.0。Epoch AI 数据按其 [Creative Commons Attribution 说明](https://epoch.ai/benchmarks/use-this-data) 署名；基准题目另遵循原作者许可。其他平台的公开成绩与来源 URL 分别保留，不推断未公开的再分发许可。

## 本轮原始数据集

| 数据集 | 源记录数 | 入口 | 采集方式 |
| --- | --- | --- | --- |
| design-agents | 81 | [来源](https://openrouter.ai/api/v1/benchmarks?include_run_config=true&source=design-arena&arena=agents) | official-public-data |
| design-models | 416 | [来源](https://openrouter.ai/api/v1/benchmarks?include_run_config=true) | official-public-data |
| livebench2 | 53 | [来源](https://livebench.ai/data/20261014/table.csv) | official-public-data |
| opencompass-v3 | 22 | [来源](https://cdn.opencompass.org.cn/assets/lm/data-lm-ability_official.json?benchmark=text) | official-public-data |
| epoch-frontiermath_tiers_1_3_v2 | 121 | [来源](https://epoch.ai/data/benchmark_data.zip) | official-public-data |
| epoch-frontiermath_tier_4_v2 | 77 | [来源](https://epoch.ai/data/benchmark_data.zip) | official-public-data |
| epoch-mirrorcode | 10 | [来源](https://epoch.ai/data/benchmark_data.zip) | official-public-data |
| aa-analyst | 27 | [来源](https://artificialanalysis.ai/evaluations/aa-analyst-agent) | official-public-data |
| aa-gdpval21 | 27 | [来源](https://artificialanalysis.ai/evaluations/gdpval-aa) | official-public-data |
| aa-critpt2 | 12 | [来源](https://artificialanalysis.ai/evaluations/critpt-v2) | official-public-data |
| aa-3d | 23 | [来源](https://artificialanalysis.ai/evaluations/aa-3d) | official-public-data |
| aa-tbscience | 27 | [来源](https://artificialanalysis.ai/evaluations/terminal-bench-science) | official-public-data |
| scale-mcp | 34 | [来源](https://labs.scale.com/leaderboard/mcp_atlas) | official-public-data |
| scale-hil | 30 | [来源](https://labs.scale.com/leaderboard/hil) | official-public-data |
| scale-refactor | 17 | [来源](https://labs.scale.com/leaderboard/sweatlas-refactoring) | official-public-data |
| scale-tests | 24 | [来源](https://labs.scale.com/leaderboard/sweatlas-tw) | official-public-data |
| scale-pro2-full | 16 | [来源](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | official-public-data |
| scale-pro2-hard | 16 | [来源](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | official-public-data |
| scale-rli | 21 | [来源](https://labs.scale.com/leaderboard/rli) | official-public-data |
| arena-document | 44 | [来源](https://arena.ai/leaderboard/chat/document) | official-rendered-dom |
| arena-vision | 167 | [来源](https://arena.ai/leaderboard/chat/vision) | official-rendered-dom |
| arena-image-webdev | 65 | [来源](https://arena.ai/leaderboard/code/image-to-webdev) | official-rendered-dom |
| openrouter-native | 319 | [来源](https://openrouter.ai/api/v1/benchmarks?include_run_config=true) | official-public-data |
