import React, { useState } from 'react';
import { ALL_METRIC_DEFINITIONS, DOMAIN_DEFINITIONS } from '../engine/scoringEngine';
import { DOMAIN_IDS, SCORING_CONFIG } from '../engine/scoringConfig';
import { SEMIANALYSIS_SUBSCRIPTION_SOURCE } from '../data/subscriptionPricing';
import { formatMetricWeight } from './ConfigurationDetailContent';

export const MethodologyDocView: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<'scoring' | 'weighting' | 'registry'>('scoring');
  return (
    <div className="space-y-6 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">LLMpk Scoring v{SCORING_CONFIG.version}</h1>
          <p className="mt-1 text-xs">{ALL_METRIC_DEFINITIONS.length} 项计分指标全部展示；六域等权；覆盖不足保留详情。</p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="评分规范">
          {(['scoring', 'weighting', 'registry'] as const).map(id => (
            <button key={id} type="button" role="tab" aria-selected={id === activeDoc}
              className={`rounded-lg px-3 py-2 font-semibold ${id === activeDoc ? 'bg-slate-950 text-white' : 'bg-slate-100'}`}
              onClick={() => setActiveDoc(id)}>
              {{ scoring: 'Scoring', weighting: 'Weights', registry: 'Sources' }[id]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6" role="tabpanel">
        {activeDoc === 'scoring' && <>
          <h2 className="text-lg font-bold">覆盖先于综合分</h2>
          <p>领域覆盖率是已实测指标的配置权重之和。每域至少 60% 才有领域分，六域均达标且总覆盖率至少 75% 才有能力分和综合排名。任何整域缺测都不能被其他优势领域隐藏。</p>
          <p>缺测单项保持 null，不补成 50 分。合格领域只对实测指标重新归一权重；详情显示配置权重与实际覆盖。覆盖门槛不能证明未测任务没有短板，比较时仍需检查缺测项和来源条件。</p>
          <p>原始比例经 Logit 变换，Elo/效果量保留连续尺度。相对分以同批参考配置的最高值为 100、中位数为 50，再根据参与量与置信区间将弱信号向 50 收缩。领域聚合后再次以同批合格配置校准。</p>
          <div className="rounded-lg bg-slate-50 p-4 font-mono text-xs">R = (Chatting × Reasoning × Coding × Frontend × Agentic × Documents)^(1/6)</div>
          <p>六域等权几何平均保留领域短板。订阅、价格档位等共享能力证据的路线不重复加重能力校准样本。</p>
          <p>Practical Adjustment v{SCORING_CONFIG.practicalAdjustment.version} 保持现有规则：能力分加速度与成本的饱和奖惩。缺少能力总分或可核实的速度/成本时，实用分也保持空值。不同 effort、速度测试条件或订阅路线应分别比较。</p>
          <p>订阅成本 = 同模型 API 场景成本 × 月费 ÷ 可用月度 API 等效额度。SemiAnalysis 的额度来自 agentic 混合负载，将其折扣系数映射到本站 1M 输入 + 0.25M 输出场景是近似；缓存比例、实际利用率和限额变化都会影响结果。Fable 5.1 的 $2,485 已包含 50% 模型上限，不再折半。详情中 ≈ 表示保留的旧估算。</p>
          <p>默认模型按同产品线的继任关系筛选，取消历史对照例外；不同用途的当前产品线继续保留。历史原始来源记录供复核使用。</p>
        </>}
        {activeDoc === 'weighting' && <>
          <h2 className="text-lg font-bold">六域各占 1/6</h2>
          {DOMAIN_IDS.map(id => <div key={id} className="border-b border-slate-100 pb-3">
            <h3 className="font-bold" style={{ color: DOMAIN_DEFINITIONS[id].color }}>{DOMAIN_DEFINITIONS[id].nameEn}</h3>
            <p className="mt-1 text-xs">{DOMAIN_DEFINITIONS[id].description}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {ALL_METRIC_DEFINITIONS.filter(m => m.domain === id).map(m => <li key={m.id}>
                {m.name} · {formatMetricWeight(m.internalWeightInDomain)} · {m.source}
              </li>)}
            </ul>
          </div>)}
          <p>五个终端来源/版本共用 Agentic 的 15%，新的科学终端任务另占 3%；AA Coding Agent 指数和两个编程分项共用 Coding 的 10%；Omniscience 两个信号共用 Reasoning 的 10%。同一运行的镜像只导入一次，相关独立运行共用预算。</p>
          <p>Frontend 为 Arena WebDev 与 Image-to-WebDev 合计 40%、DesignArena 整体与 DataViz/UI/SVG 合计 35%、Vals 两类 Vibe Code 合计 20%、AA-3D 5%。OpenCompass 的原子字段共享预设预算，Overall 和领域均分不再叠加。来源缺失仍占覆盖分母。</p>
        </>}
        {activeDoc === 'registry' && <>
          <h2 className="text-lg font-bold">可核实的当前来源</h2>
          <p>订阅价格于 2026-10-11 按 <a href={SEMIANALYSIS_SUBSCRIPTION_SOURCE} target="_blank" rel="noreferrer" className="text-blue-700 underline">SemiAnalysis 10 月实测</a>逐套餐、逐模型更新，采用公开 agentic 月度 API 等效额度。ChatGPT $200 档使用降额后的新购限额；临时保留至 10 月 29 日的旧额度不纳入。Google、SuperGrok 与旧 Terra 尚无本次可核对的公开数值，保留旧估算，不能视为 SemiAnalysis 实测。</p>
          <p>当前 {ALL_METRIC_DEFINITIONS.length} 项评测全部分配正权重，统一列在详情与对比中。新增 LiveBench 2.0、OpenCompass v3.0、Epoch 独立运行及 Scale 的工具、协作、重构和测试任务；Vals 共 12 项。GDPval-AA 2.1、CritPt v2、AA-3D 和科学终端任务独立使用新版本标识。</p>
          <p>LiveBench 的 Design 测 Word/PDF/幻灯片成品，进入 Documents；长任务和浏览器任务进入 Agentic。Epoch 采用单次记录的 mean_score 与标准误，按档位选择最近运行。Scale Full/HARD、生产 CLI、内部 mini-swe-agent 和来源回合预算分别保留。</p>
          <p>SciCode 按 AA 官方状态标注“复核”，保留已公布值与 2% Coding 预算；原 CritPt 标为旧版，与修订版分别计分。DesignArena 身份相同但分数冲突的记录不挂接。旧版 Kimi K3、八月 Qwen Max 和 OpenRouter 搜索任务中的旧模型成绩不会填给当前继任版本。</p>
          <p>FrontierCode 保留当前 1.1 Main 的实际 effort 与 harness。Terminal-Bench 2.1、4.0、AA Coding Agent 的旧版 v2 及生产 CLI 成绩独立保留；共用终端任务预算，不能互相补值。指标行的“来源快照”说明记录日期，不表示重新执行任务。</p>
          <p>同一模型有成绩就接入：优先同档，其次较低档；缺少时采用该模型已有实测档位，并标注“异档”和来源实际设置。低档成绩可以用于高档配置。模型版本、Pro、Fast 和 Qwen3.8-Max 固定 0902 快照分别归属；生产 CLI 的实际环境单独保留。</p>
          <p>DesignArena 的来源行同时保留模型版本和发布的档位名称；同一模型 ID 的 XHigh 与 Max 是不同记录。前端成绩反映 DesignArena 内部构建环境，不冒充所展示 CLI 的独立实测；来源未披露置信区间或样本量时保持未知。</p>
          <p>DesignArena 数据来源：<a href="https://www.designarena.ai" target="_blank" rel="noreferrer" className="text-blue-700 underline">Design Arena</a>，经 <a href="https://openrouter.ai/rankings" target="_blank" rel="noreferrer" className="text-blue-700 underline">OpenRouter</a> 提供；采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="text-blue-700 underline">CC BY 4.0</a> 许可。</p>
          <p>Epoch AI 数据来源：<a href="https://epoch.ai/benchmarks/use-this-data" target="_blank" rel="noreferrer" className="text-blue-700 underline">Epoch AI Capabilities &amp; benchmarking</a>，按其 Creative Commons Attribution 许可署名；使用独立运行，外部镜像不重复计分。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_METRIC_DEFINITIONS.map(metric => <a key={metric.id} href={metric.officialUrl}
              target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline underline-offset-2">
              {metric.name} · {metric.source}
            </a>)}
          </div>
        </>}
      </div>
    </div>
  );
};
