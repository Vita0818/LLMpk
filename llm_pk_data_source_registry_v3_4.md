# LLMpk Data Source Registry v3.4

生效日期：2026-10-25（Australia/Perth）。当前 84 项计分指标，来自 10 个发布者；来源采集主要在 2026-10-24 完成，各榜单/运行的原始日期分别保留。

| 平台 | 当前证据 |
| --- | --- |
| Artificial Analysis | 原有知识、推理、指令、专业工作、Coding Agent 等证据；AnalystAgent、GDPval-AA 2.1、CritPt v2、AA-3D、科学终端任务 |
| Arena.ai | 原有文本、WebDev、检索和生产 Agent 信号；Document、Vision、Image-to-WebDev |
| OpenRouter | API 单价/速度；原生 GPQA Diamond、τ-bench Airline |
| DesignArena | 整体前端、DataViz、UI Component、SVG；PPTX、HTML 幻灯片和表格 |
| Vals AI | 共 12 项，含 ProofBench 1.1、ProgramBench、VCB 1–100；固定版本和执行设置 |
| LiveBench 2.0 | 2026-10-14 suite 发布版，7 套评测；每模型实际 effort 由官方公开元数据静态解析 |
| Epoch AI | FrontierMath v2 两组难度与 MirrorCode；独立运行 mean_score、run ID、日期和 SE |
| Scale Labs | MCP Atlas、HiL、重构、测试编写、SWE Pro V2 Full/HARD、RLI |
| FrontierCode | 当前 1.1 Main Pass Rate，保留实际 effort 与生产框架 |
| Terminal-Bench | 生产 CLI 的独立 TB4 记录 |

扩展快照含 22 个数据集、1627 条源记录；328 个审核身份、637 个配置连接，产生 328 张来源卡与 460 个原子观测。Vals 保留 123 个模型/执行 ID、7008 个结果行和 327 张审核卡。

## 采集和连接

采集入口为 [fetchSourceExpansionSnapshot.mjs](scripts/fetchSourceExpansionSnapshot.mjs)，审核映射为 [sourceExpansionReviewedMappings.json](src/data/sourceExpansionReviewedMappings.json)。URL、日期、SHA-256、方法和原始文件引用分别保留。

    npm run refresh:source-expansion -- --from-dir /path/to/validated/raw-pack
    npm run refresh:source-expansion -- --arena-dom-dir /path/to/current/arena-captures
    npm run refresh:vals
    npm run test:source-expansion
    npm run validate:source-snapshots

网络采集沿用既有专用 OpenRouter benchmark key，其余使用公开数据。Arena 直接 HTTP 请求返回 403 时使用官方完整 rendered DOM 表格；LiveBench 的方法说明和逐模型设置经哈希和静态解析校验；Epoch 用 Python 3 标准库只读取三个指定 CSV，不执行来源脚本或解压任意路径。

同型号已有成绩按用户指定口径接入，低档可用于高档配置，实际档位标注在原始成绩行。来源或执行身份变化会先触发审核。模型版本、Pro 变体和旧模型不借给当前不同产品。相同 DesignArena 身份出现分数冲突时全部保留为未挂接记录；镜像不重复导入。

SciCode 保留来源复核状态，旧 CritPt 与修订版分开。[BFCL](https://gorilla.cs.berkeley.edu/leaderboard.html)、[OSWorld 2.0](https://osworld-v2.xlang.ai/) 和 [SWE-bench](https://www.swebench.com/) 的本次候选仍没有审核通过的当前模型/执行连接。

## 数据署名

DesignArena 结果来自 Design Arena，经 OpenRouter 提供，采用 CC BY 4.0。Epoch AI 数据遵循其 [Creative Commons Attribution 说明](https://epoch.ai/benchmarks/use-this-data) 署名；题目另遵循原作者许可。其他平台的公开成绩分别保留来源 URL，不推断未公开许可。
