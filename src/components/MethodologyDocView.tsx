import React, { useState } from 'react';
import { BookOpen, FileText, CheckCircle, ExternalLink, Code } from 'lucide-react';
import { SCORING_CONFIG } from '../engine/scoringConfig';

export const MethodologyDocView: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<'registry' | 'weighting' | 'scoring'>('scoring');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-cyan-400">
            <BookOpen className="w-4 h-4" /> Standard Specifications & Reference
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            LLMpk 评分系统 <span className="text-cyan-400">三份标准规范文档</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            包含数据源与指标注册表 v1.1、领域归类与权重方案 v2.1、评分系统与实用分方法说明 v{SCORING_CONFIG.version}
          </p>
        </div>

        {/* Doc Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveDoc('scoring')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeDoc === 'scoring' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. 评分方法 Scoring v{SCORING_CONFIG.version}
          </button>

          <button
            onClick={() => setActiveDoc('weighting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeDoc === 'weighting' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. 领域权重 Weighting v2.1
          </button>

          <button
            onClick={() => setActiveDoc('registry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeDoc === 'registry' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. 数据源注册 Data Source v1.1
          </button>
        </div>
      </div>

      {/* Doc Viewer Content */}
      <div className="bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6 text-slate-200 leading-relaxed text-sm">
        {activeDoc === 'scoring' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                llm_pk_scoring_methodology_v1.md
              </span>
              <h2 className="text-xl font-bold text-white mt-2">LLM PK 评分系统方法说明 (Scoring v{SCORING_CONFIG.version})</h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <h3 className="text-base font-bold text-white">1. 评分对象 LLM Configuration</h3>
              <p>
                一个完整的 LLM Configuration 由三部分组成：
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-cyan-300">
                LLM Configuration = Identity + Execution + Infrastructure / Access
              </div>

              <h3 className="text-base font-bold text-white">2. 总体评分流程</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-slate-300 text-xs">
                原始数据 &rarr; 按类型 Logit/Log 变换 &rarr; 基础相对分 &rarr; 可靠度向 50 收缩 &rarr; 领域内缺失单项固定 50 &rarr; 领域几何聚合与归一化 &rarr; 排除零观测领域 &rarr; 可用领域直接几何平均 &rarr; 能力分 &rarr; 饱和效用速度成本调整 &rarr; Practical Score
              </div>

              <h3 className="text-base font-bold text-white">3. 单项基础分与可靠度收缩</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-amber-300 space-y-1">
                <div>s_base = 100 &bull; 2^-( (y_max - y_i) / (y_max - y_med) )</div>
                <div>s_eff = 50 + &rho; &bull; (s_base - 50)</div>
              </div>
              <p>
                基础分保持 Max=100、Median=50；可靠度 &rho; 同时受参评数量和统计区分度约束。
                数据越少或误差相对差异越大，分数区间越靠近 50，但不会改变该指标内原有的高低顺序。
              </p>

              <h3 className="text-base font-bold text-white">4. 缺失指标与覆盖率</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-sky-300">
                q_domain = Σ(configuredWeight · ln(s_eff / 50)), missing s_eff = 50
              </div>
              <p>
                合法的数据匹配和“下位可替上位”兜底之后，仍缺失的指标固定按中位水平 50 进入聚合，
                并保留原配置权重，绝不把权重转移给已有指标。覆盖率单独展示：
                覆盖率 &ge;{SCORING_CONFIG.coverage.officialMinimum * 100}% 为正式，0 至
                {SCORING_CONFIG.coverage.officialMinimum * 100}% 为部分覆盖；完全没有真实观测时领域显示
                --、标记为无观测数据，并且不参与总能力分。
              </p>

              <h3 className="text-base font-bold text-white">5. 可用领域能力分</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-violet-300">
                A = (Π D_available)^(1 / available_domain_count)
              </div>
              <p>
                完全没有真实观测的领域不生成数值分，也不参与总能力分；其余可用领域重新等权，
                直接取几何平均，不再进行第二次跨模型归一化。因此榜首不会被强制拉到 100；
                只有全部可用领域均为 100 时，能力分才会达到 100。能力分必须与可用领域数量和
                覆盖状态一起展示。
              </p>

              <h3 className="text-base font-bold text-white">6. Chat / Harness 数据边界</h3>
              <p>
                Chat 与 Codex CLI、Claude Code、Kimi Code CLI、OpenCode 等 harness 是独立配置。
                Agent、终端和 Code Arena 指标不得进入 Chat；harness 可以用同模型同档位的 Chat 指标补缺，
                但 Chat 绝不能反向使用 harness 数据。若拆分后 Chat 低于入榜门槛，而来源明确的 harness
                配置可用，则榜单以 harness 配置取代 Chat。
              </p>

              <h3 className="text-base font-bold text-white">7. 实用分 Practical Score</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-emerald-300">
                P_i = max(0, A_i + &Delta;v + &Delta;c)
                <br />
                -8 &lt; &Delta;v &lt; +7.5  |  -12 &lt; &Delta;c &lt; +7.5
                <br />
                -20 &lt; &Delta;v + &Delta;c &lt; +15
              </div>
              <p>
                速度与成本采用同模型产品线的 OpenRouter 目录价格和 Standard 聚合性能，
                不绑定配置卡片中原始记录的具体 API 提供商；这些数据只影响实用分，绝不跨档位补能力分。
                榜单显示相对能力分的净调整 &Delta;P = &Delta;v + &Delta;c：正数为绿色加成，
                负数为红色扣减；内部最终值仍按 P = max(0, A + &Delta;P) 计算。
                没有完整价格与性能来源时仍显示数据不足。
              </p>
            </div>
          </div>
        )}

        {activeDoc === 'weighting' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                llm_pk_domain_classification_weighting_v2.md
              </span>
              <h2 className="text-xl font-bold text-white mt-2">LLM PK 领域归类与权重方案 (Domain Classification v2.1)</h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <p>六个能力领域在六维综合能力分中完全等权，各占 1/6 (16.67%)：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Chatting (16.67%)</strong>: Arena Instruction (30%), Multi-Turn (30%), Creative (20%), Hard Prompts (20%)</li>
                <li><strong>Math & Science (16.67%)</strong>: HLE (30%), GPQA Diamond (30%), CritPt (20%), Arena Math (20%)</li>
                <li><strong>Coding (16.67%)</strong>: SciCode (55%), Arena Text Coding (45%)</li>
                <li><strong>Engineering (16.67%)</strong>: GDPval-AA (20%), Terminal-Bench v2.1 (30%), DeepSWE / SWE-Atlas-QnA / Coding Agent Terminal-Bench v2 (各 13.33%), WebDev (10%)</li>
                <li><strong>Agentic Work (16.67%)</strong>: τ³-Banking (40%), Confirmed Success (21%), Steerability (12%), Praise (6%), Bash Recovery (12%), Tool Hallucination (9%)</li>
                <li><strong>Search & Knowledge (16.67%)</strong>: AA-Omniscience Accuracy (35%), Non-Hallucination (30%), AA-LCR (25%), Search Arena (10%)</li>
              </ul>
              <p>
                权重参考当前内置配置的来源覆盖率：高覆盖指标承担较高权重，低覆盖指标保留为补充信号。
                AA Coding Agent Index 综合分仅保留在来源卡片中，不与其三个组成项重复计分。
              </p>
            </div>
          </div>
        )}

        {activeDoc === 'registry' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                llm_pk_data_source_registry_v1.1.md
              </span>
              <h2 className="text-xl font-bold text-white mt-2">LLM PK 数据源与指标注册表 (Data Source Registry v1.1)</h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <p>第一版固定三个数据来源：</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Artificial Analysis</strong>: 采集 10 项通用模型指标，以及 Coding Agent Index 综合分与 DeepSWE、SWE-Atlas-QnA、Terminal-Bench v2 三项 harness 明细，共 14 项。</li>
                <li><strong>Arena.ai</strong>: 采集 Text(6项), Code WebDev(1项), Search(1项), Agent(5项) 共13项连续 Score/点估计。</li>
                <li><strong>OpenRouter API</strong>: 采集模型端点 Pricing (Input/Output/Cache) 与 Performance (TTFT, Throughput p50, Uptime)。仅用于实用分，不进入能力分。</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
