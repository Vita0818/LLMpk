> 历史版本，仅供复核。当前规范见 [llm_pk_scoring_methodology_v3.md](llm_pk_scoring_methodology_v3.md)。旧分数不能直接与 v3 比较。

# LLM PK 评分系统方法说明

**版本：Scoring v1.2 + Practical Adjustment v1.3**

本文档定义 LLM PK 网站中一个完整 LLM Configuration 的评分流程。本文档只规定数据处理与评分算法，不规定具体数据源、基准清单与权重分配。

> 实现状态：当前评分引擎与页面已采用 Scoring v1.2。旧版本导出的历史分数必须重新计算后，才可与当前榜单比较。

Scoring v1.2 在 v1.1 的可靠度收缩基础上采用以下固定原则：

1. 单项先得到基础相对分，再按数据可靠度向 50 分收缩；
2. 领域内部的缺失单项固定按 50 分参与聚合，不把其权重重新分配给已有项；
3. 低覆盖率只降低分数的拉开幅度并标记为 provisional，不自动取消入榜资格。
4. 只有单项和领域进行竞技场归一化；总能力分对有真实观测的领域直接取几何平均，不进行第二次跨模型归一化。整个领域零观测时显示 `--`，并从总分聚合中排除。

---

## 1. 评分对象

一个完整的 LLM Configuration 由三部分组成：

1. **Identity**
   - 模型名称
   - 模型版本
   - 推理强度或 reasoning effort
   - 其他会改变模型能力表现的身份参数

2. **Execution**
   - Harness
   - Agent framework
   - CLI、IDE、桌面端或其他执行环境
   - 工具权限、上下文管理与任务执行方式

3. **Infrastructure / Access**
   - API、订阅或其他访问方式
   - 实际调用入口
   - 使用额度、限流与计费方式
   - 影响速度与成本的基础设施条件

评分对象不是单独的基础模型，而是完整配置：

\[
\text{LLM Configuration}
=
\text{Identity}
+
\text{Execution}
+
\text{Infrastructure / Access}
\]

---

## 2. 六个能力领域

每个配置在以下六个领域中，有真实观测的领域获得一个 0–100 的领域分：

1. **Chatting**
2. **Math & Science**
3. **Coding**
4. **Engineering**
5. **Agentic Work**
6. **Search & Knowledge**

六个领域用于绘制雷达图；整个领域零观测时，该顶点显示为 `--`，不绘制虚构的 50 分。

速度和成本不进入雷达图，也不进入六个能力领域。

具体指标归属和领域内权重由 Domain Classification & Weighting v2.0 定义；
该版本变化不修改本文档规定的评分算法。

---

## 3. 最终输出

每个配置至少输出以下结果：

- 六个领域的得分或无数据状态
- 能力原始分 `Raw Capability Score`
- 速度调整分
- 成本调整分
- 实用分 `Practical Score`
- 各项原始数据、类型变换值和基础相对分
- 各项参评数量可靠度、统计分辨力可靠度与最终可靠度
- 各项经过可靠度收缩后的有效分
- 数据覆盖率
- 评分版本

其中：

- 每个正常校准领域的领域分满足最高值为 100、中位数为 50；
- 能力原始分是所有有真实观测领域的直接等权几何平均，不强制最高值为 100 或中位数为 50；
- 实用分不要求最高值为 100，也不要求中位数为 50。
- 单项基础相对分可以使用完整的 0–100 区间；可靠度不足时，单项有效分围绕 50 收缩到更窄区间。

---

# 第一部分：能力评分

## 4. 总体流程

\[
\text{原始数据}
\rightarrow
\text{按类型预处理}
\rightarrow
\text{单项基础相对分}
\rightarrow
\text{可靠度收缩}
\rightarrow
\text{领域内聚合}
\rightarrow
\text{有观测的领域分}
\rightarrow
\text{能力原始分}
\]

具体流程如下：

1. 采集连续原始数值；
2. 将所有指标统一为“数值越大越好”；
3. 按数据类型进行必要变换；
4. 将每个单项归一化为基础相对分，最高 100、中位数 50；
5. 根据参评模型数量和测量不确定性计算该单项的可靠度；
6. 将可靠度不足的单项分数向 50 收缩；
7. 领域内部的缺失单项固定按 50 分处理；
8. 在每个领域内对多个单项进行几何聚合；
9. 再次归一化，得到领域分；
10. 排除整个领域零观测的项，对剩余领域进行等权几何聚合；
11. 将可用领域的几何平均直接作为能力原始分，不再进行跨模型归一化。

---

## 5. 数据类型与预处理

所有原始数据进入统一归一化前，都要先转换为连续变量 \(y\)，并保证：

\[
y \text{ 越大，代表表现越好}
\]

### 5.1 准确率、通过率、成功率

若原始值为比例：

\[
0 < p < 1
\]

使用 Logit 变换：

\[
y=\ln\frac{p}{1-p}
\]

原因：

- 高端模型经常集中在较高百分比区间；
- 90% 到 95% 与 50% 到 55% 不应被看作完全相同的提升；
- Logit 可以缓解天花板效应。

若知道成功次数 \(k\) 和样本数 \(n\)，使用平滑比例：

\[
\tilde p=\frac{k+0.5}{n+1}
\]

再计算：

\[
y=\ln\frac{\tilde p}{1-\tilde p}
\]

### 5.2 错误率、幻觉率、失败率

先转成正向比例：

\[
p_{\text{good}}=1-p_{\text{bad}}
\]

然后按准确率处理。

### 5.3 连续相对分数

对于已经是连续相对量的指标，例如：

- Rating
- Bradley–Terry 强度
- Elo 风格分数
- 相对改善百分点
- 综合连续指数

直接使用：

\[
y=x
\]

不得转成排名，也不得按名次换分。

### 5.4 正数比例尺度

对于正值且更适合比较倍数关系的数据：

#### 越大越好

例如吞吐率：

\[
y=\ln x
\]

#### 越小越好

例如延迟、时间、成本：

\[
y=-\ln x
\]

### 5.5 只有排名的数据

如果只有名次而没有连续数值：

\[
1,2,3,\ldots
\]

则该指标不进入核心评分。

排名可以展示，但不能转换成能力分。

---

## 6. 单项基础归一化与可靠度收缩

Scoring v1.1 将单项处理拆成两步：

1. 先计算基础相对分，表达当前观测值之间的相对顺序和距离；
2. 再根据该项数据的可靠度，决定这些差异可以在多宽的分数区间内展开。

可靠度只控制“离 50 分多远”，不改变模型在该单项上的原始高低顺序。

### 6.1 基础相对分

设某单项经过预处理后的已观测值为：

\[
y_1,y_2,\ldots,y_n
\]

定义：

\[
y_{\max}=\max_i y_i
\]

使用指数衰减归一化：

\[
\boxed{
s^{\text{base}}_i
=
100\exp\left[-\lambda(y_{\max}-y_i)\right]
}
\]

其中 \(\lambda>0\) 由程序求解，使得：

\[
\boxed{
\operatorname{median}
\left(
s^{\text{base}}_1,\ldots,s^{\text{base}}_n
\right)
=50
}
\]

因此基础相对分满足：

\[
\max_i s^{\text{base}}_i=100
\]

\[
\operatorname{median}_i s^{\text{base}}_i=50
\]

当：

\[
y_{\text{med}}=\operatorname{median}(y_1,\ldots,y_n)
\]

且 \(y_{\max}\ne y_{\text{med}}\) 时，有：

\[
\boxed{
\lambda=\frac{\ln 2}{y_{\max}-y_{\text{med}}}
}
\]

最终：

\[
\boxed{
s^{\text{base}}_i
=
100
\cdot
2^{-\frac{y_{\max}-y_i}{y_{\max}-y_{\text{med}}}}
}
\]

基础相对分的直观含义为：

- 最强者：100 分；
- 中位水平：50 分；
- 再低一个“最高值到中位值”的距离：约 25 分；
- 再低一个相同距离：约 12.5 分。

### 6.2 参评数量可靠度

设：

- \(N\)：固定竞技场快照中符合该指标适用范围的配置总数；
- \(n_j\)：指标 \(j\) 实际拥有有效观测值的配置数；
- \(n_{\text{ref}}\)：认为参评数量已经充分的参考数量。

Scoring v1.1 默认：

\[
\boxed{
n_{\text{ref}}
=
\min
\left(
N,
\max\left(10,\left\lceil0.60N\right\rceil\right)
\right)
}
\]

参评数量可靠度为：

\[
\boxed{
\rho^{\text{count}}_j
=
\min\left(1,\frac{n_j}{n_{\text{ref}}}\right)
}
\]

因此：

- 参评配置很少时，单项分数只能在 50 附近小幅展开；
- 参评数量达到参考值后，不再因为继续增加配置而额外放大区间；
- \(N\)、\(n_j\) 和 \(n_{\text{ref}}\) 必须随评分快照保存。

### 6.3 统计分辨力可靠度

参评模型多，不代表该项一定能够可靠地区分模型。

定义：

\[
\Delta_j=y_{\max}-y_{\text{med}}
\]

设 \(u_j\) 为该指标在同一变换尺度上的典型 95% 置信区间半径。
优先使用所有有效观测的置信区间半径中位数。

定义信号相对不确定性的倍数：

\[
\boxed{
R_j=\frac{\Delta_j}{u_j}
}
\]

Scoring v1.1 默认要求“最高值到中位值的距离”至少达到典型不确定性的 2 倍，才视为具有完整分辨力：

\[
\boxed{
\rho^{\text{signal}}_j
=
\min\left(1,\frac{R_j}{2}\right)
}
\]

若原始数据没有直接提供置信区间：

1. 准确率、通过率等优先使用任务数与成功数估计不确定性；
2. 有重复运行时使用 Bootstrap 估计；
3. 有标准误差时先换算为 95% 置信区间半径；
4. 所有不确定性必须转换到与 \(y\) 相同的尺度后再比较；
5. 确实无法估计时，暂令 \(\rho^{\text{signal}}_j=1\)，同时标记 `uncertainty_unknown`，不得将其描述为“统计上充分可靠”。

### 6.4 单项总可靠度

单项总可靠度取两个维度中较弱者：

\[
\boxed{
\rho_j
=
\min
\left(
\rho^{\text{count}}_j,
\rho^{\text{signal}}_j
\right)
}
\]

其中：

\[
0\le\rho_j\le1
\]

采用较小值而不是相乘，是为了让最弱证据限制分数区间，同时避免对同一项数据重复惩罚。

### 6.5 向 50 分收缩

对已有观测值，最终进入聚合的单项有效分为：

\[
\boxed{
s^{\text{eff}}_{i,j}
=
50
+
\rho_j
\left(
s^{\text{base}}_{i,j}-50
\right)
}
\]

其性质为：

- \(\rho_j=1\)：保留完整基础相对分；
- \(\rho_j=0.6\)：若基础区间为 0–100，则收缩为 20–80；
- \(\rho_j=0.2\)：若基础区间为 0–100，则收缩为 40–60；
- \(\rho_j=0\)：所有配置在该项上均为 50；
- 收缩前后的模型顺序保持不变。

缺失观测不进行基础归一化，直接定义为：

\[
\boxed{
s^{\text{eff}}_{i,j}=50
}
\]

### 6.6 退化与低分辨力情况

如果：

\[
y_{\max}=y_{\text{med}}
\]

则该指标无法形成有效的最高值到中位值距离。

此时：

\[
\rho^{\text{signal}}_j=0
\]

所有有效分均回到 50，并标记：

```text
insufficient_discrimination
```

如果 \(y_{\max}\ne y_{\text{med}}\)，但差距小于统计不确定性，则不再把微小差异强制铺满 0–100，而是根据 \(\rho^{\text{signal}}_j\) 连续收缩。

### 6.7 直观示例

假设固定竞技场中有 35 个适用配置：

\[
n_{\text{ref}}=\max(10,\lceil0.60\times35\rceil)=21
\]

如果某单项只有 5 个配置有数据，且其统计分辨力充分：

\[
\rho^{\text{count}}=\frac5{21}\approx0.238
\]

则基础 0–100 区间会收缩到大约：

\[
38.1\text{–}61.9
\]

如果某单项有 26 个配置参与，但“最高值到中位值的距离”只有典型置信区间半径的 0.375 倍：

\[
\rho^{\text{count}}=1
\]

\[
\rho^{\text{signal}}=\frac{0.375}{2}=0.1875
\]

最终：

\[
\rho=0.1875
\]

基础 0–100 区间会收缩到大约：

\[
40.6\text{–}59.4
\]

这说明参评配置数量只是可靠度的一部分；即使参与模型很多，差异小于测量误差时也不能铺满 0–100。任何缺失配置在该单项上仍直接取 50。

---

## 7. 同一指标的重复数据

固定规则：

\[
\boxed{
\text{一个模型配置 × 一个基准 × 一个版本，只计一次}
}
\]

若同一基准被多个平台收录，不得重复计权。

平台数量不是证据数量。

---

## 8. 平台综合分与组成项

若某平台同时提供：

- 一个综合指数；
- 构成该指数的单项基准；

则两者不能同时进入同一评分链路。

固定规则：

```text
Use either:
- platform composite index

or:
- its constituent benchmark values

Never both.
```

这样可以避免重复计分。

---

## 9. 领域内聚合

设模型 \(i\) 在领域 \(d\) 中有多个单项分：

\[
s^{\text{eff}}_{i,1},
s^{\text{eff}}_{i,2},
\ldots,
s^{\text{eff}}_{i,m}
\]

每个单项有效分已经位于 0–100，中位数为 50；其实际展开区间由该单项可靠度决定。

先转成相对于 50 分的对数能力：

\[
r_{i,j}=\ln\frac{s^{\text{eff}}_{i,j}}{50}
\]

领域内综合值为：

\[
\boxed{
q_{i,d}
=
\sum_{j=1}^{m}
w_{d,j}
\ln\frac{s^{\text{eff}}_{i,j}}{50}
}
\]

其中：

\[
w_{d,j}\ge0
\]

\[
\sum_{j=1}^{m}w_{d,j}=1
\]

这等价于加权几何平均：

\[
G_{i,d}
=
50
\prod_{j=1}^{m}
\left(\frac{s^{\text{eff}}_{i,j}}{50}\right)^{w_{d,j}}
\]

然后对该领域至少拥有一个真实观测值的配置集合，使用统一归一化函数：

\[
\boxed{
D_{i,d}=\mathcal N(q_{i,d})
}
\]

其中 \(\mathcal N\) 表示：

\[
\mathcal N(x_i)
=
100
\cdot
2^{-\frac{x_{\max}-x_i}{x_{\max}-x_{\text{med}}}}
\]

最终每个领域分满足：

\[
\max_iD_{i,d}=100
\]

\[
\operatorname{median}_iD_{i,d}=50
\]

完全没有该领域真实观测值的配置不参与领域归一化参数的估计，不生成该领域数值分，页面显示 `--`，并标记为 `no_observed_data`。

---

## 10. 为什么领域内使用几何聚合

不使用普通算术平均，原因是算术平均允许某个极强项完全补偿另一个严重短板。

几何聚合具有以下性质：

- 高分项不能无限掩盖低分项；
- 更重视能力结构的均衡性；
- 同比例改善具有相近意义；
- 仍然保留连续变化；
- 适合综合能力型评分。

Scoring v1.1 在几何聚合前先进行可靠度收缩，避免一个统计上无法稳定区分模型的近零单项分，对整个领域形成不合理的“一票否决”。

---

## 11. 缺失数据

缺失数据：

- 不记为 0；
- 不删除该项后重新分配权重；
- 数据匹配阶段仍可按独立规则执行“下位配置可替上位配置”的合法兜底，但不得反向使用“上位替下位”，也不得跨模型替代；
- 只有在全部合法匹配和兜底完成后仍无观测值时，才进入本节的缺失处理；
- 固定使用该单项的中位水平 50。

设领域 \(d\) 的完整指标权重总和为 1，模型 \(i\) 有数据的指标集合为 \(A_i\)。

领域潜在综合值仍使用完整指标权重：

\[
\boxed{
q_{i,d}
=
\sum_{j=1}^{m}
w_{d,j}
\ln\frac{s^{\text{eff}}_{i,j}}{50}
}
\]

其中，对 \(j\notin A_i\)：

\[
\boxed{
s^{\text{eff}}_{i,j}=50
}
\]

因此缺失项等价于：

\[
\ln\frac{50}{50}=0
\]

即默认贡献中位水平。

不得改写为：

\[
\frac{
\sum_{j\in A_i}
w_{d,j}
\ln\frac{s^{\text{eff}}_{i,j}}{50}
}{
\sum_{j\in A_i}w_{d,j}
}
\]

因为该写法会把缺失项的权重重新分配给已有项，使数据越少的配置反而更容易被单个强项抬高。

定义领域覆盖率：

\[
\boxed{
c_{i,d}
=
\sum_{j\in A_i}w_{d,j}
}
\]

若：

\[
c_{i,d}<0.60
\]

则该领域标记为：

```text
provisional_coverage
```

低覆盖率不自动取消入榜资格。页面必须同时展示覆盖率和 provisional 状态，不能把按 50 处理的缺失项伪装成真实测量。

若：

\[
c_{i,d}=0
\]

则该领域不生成数值分、页面显示 `--`，并从总能力分的几何平均中排除，同时标记：

```text
no_observed_data
```

---

## 12. 可用领域合成能力原始分

设模型 \(i\) 具有真实领域观测的集合为：

\[
A_i=\{d\mid c_{i,d}>0\}
\]

其可用领域数量为：

\[
k_i=|A_i|
\]

能力原始分直接取所有可用领域的等权几何平均：

\[
\boxed{
R_i
=
\prod_{d\in A_i}
\left(D_{i,d}\right)^{1/k_i}
}
\]

也可以写成相对于 50 分的对数形式：

\[
\ln\frac{R_i}{50}
=
\frac1{k_i}
\sum_{d\in A_i}
\ln\frac{D_{i,d}}{50}
\]

其中 \(R_i\) 为能力原始分。

若 \(k_i=0\)，则能力原始分为空，该配置不能生成名次。

最终满足：

\[
0\le R_i\le100
\]

能力分不再做第二次跨模型归一化，因此：

- 榜首不会被自动拉到 100；
- 只有全部可用领域分均为 100 时，能力分才为 100；
- 全部可用领域分均为 50 时，能力分为 50；
- 某个有观测领域变弱会直接降低最终能力分；
- 零观测领域既不奖励也不惩罚模型，而是完全不参与总分；
- 比较能力分时必须同时展示可用领域数量和覆盖率。

---

# 第二部分：实用分

## 13. 实用分设计原则

速度和成本不重新参与能力评分。

实用分直接在能力原始分上做有限调整：

\[
\boxed{
P_i=R_i+\Delta_{v,i}+\Delta_{c,i}
}
\]

其中：

- \(R_i\)：能力原始分；
- \(\Delta_{v,i}\)：速度调整；
- \(\Delta_{c,i}\)：成本调整；
- \(P_i\)：实用分。

实用分：

- 不要求最大值为 100；
- 不要求中位数为 50；
- 不重新归一化；
- 直接显示速度和成本让配置加了或减了多少分。

---

## 14. 有利倍数

对于每个速度或成本指标，定义有利倍数 \(r\)。

### 14.1 越大越好

例如输出速度：

\[
r=\frac{x_i}{x_{\text{ref}}}
\]

### 14.2 越小越好

例如延迟、任务完成时间、成本：

\[
r=\frac{x_{\text{ref}}}{x_i}
\]

参照值默认使用高端配置池中位数：

\[
x_{\text{ref}}=\operatorname{median}(x)
\]

因此：

- \(r=1\)：处于参照水平；
- \(r>1\)：优于参照水平；
- \(r<1\)：弱于参照水平。

---

## 15. 饱和效用函数

速度与成本的实际价值不是无限线性的。

定义：

\[
\boxed{
u(r)=
\begin{cases}
1-\dfrac1r, & r\ge1\\[6pt]
r-1, & 0<r<1
\end{cases}
}
\]

其范围为：

\[
-1<u(r)<1
\]

典型值：

| 有利倍数 \(r\) | \(u(r)\) |
|---:|---:|
| 0.25 | -0.75 |
| 0.50 | -0.50 |
| 1.00 | 0 |
| 2.00 | +0.50 |
| 4.00 | +0.75 |
| 趋近无穷 | 趋近 +1 |

该函数表达：

- 快一倍或便宜一半，只取得一半的最大奖励；
- 快四倍或便宜到四分之一，取得四分之三奖励；
- 极端优势不会无限加分；
- 边际收益递减。

---

## 16. 速度调整

速度可能包含：

- 首 Token 延迟；
- 输出吞吐率；
- 端到端任务完成时间；
- 排队与限流影响。

每个速度指标先计算：

\[
u(r_k)
\]

再聚合：

\[
\boxed{
u_v
=
\sum_k w_{v,k}u(r_k)
}
\]

其中：

\[
\sum_k w_{v,k}=1
\]

速度调整采用非对称上限：

\[
\boxed{
\Delta_v=
\begin{cases}
7.5u_v, & u_v\ge0\\
12u_v, & u_v<0
\end{cases}
}
\]

因此：

\[
-12<\Delta_v<7.5
\]

含义：

- 速度优势最多约加 7.5 分；
- 速度劣势最多约扣 12 分。

---

## 17. 成本调整

成本必须先转成某个固定使用场景下的有效成本：

\[
C_i^{\text{effective}}
\]

使用场景可分为：

- 轻度使用；
- 标准使用；
- 重度使用。

API 有效成本可包括：

- 输入 Token；
- 输出 Token；
- 缓存 Token；
- 平台附加费；
- 额外工具费。

订阅有效成本可包括：

- 月费；
- 使用额度；
- 限流；
- 是否能够完成标准工作量；
- 超额部分的附加成本。

当订阅给出了“等价 API 成本”时，先把它换算回与 API
标准工作量相同的成本尺度：

\[
\boxed{
C_{\text{sub}}^{\text{effective}}
=
C_{\text{api}}^{\text{scenario}}
\cdot
\frac{
P_{\text{monthly}}
}{
V_{\text{api-equivalent}}\cdot q_{\text{usable}}
}
}
\]

其中 \(q_{\text{usable}}\) 是该模型实际可使用的订阅额度比例。比如模型只允许
使用套餐总额度的 50%，则 \(q_{\text{usable}}=0.5\)，不能把剩余 50% 冒充成
该模型的可用价值。

当两个套餐的月费与额度完全同比例增长时，它们的有效成本相同，不重复建配置。
例如 100 美元档的额度是 20 美元档的 5 倍时，两者均由 20 美元基础档代表；
200 美元 20× 档因额度相对基础档增长 20 倍，成本效率不同，继续独立保留。

如果 API 与订阅配置共享完全相同的模型、Harness 和能力观测，订阅项仍会得到
同一套能力分，但不会作为第二份重复样本进入能力归一化基准；两者只在访问方式
与实用成本上独立比较。

成本有利倍数：

\[
\boxed{
r_c
=
\frac{
\operatorname{median}(C^{\text{effective}})
}{
C_i^{\text{effective}}
}
}
\]

成本效用：

\[
u_c=u(r_c)
\]

成本调整：

\[
\boxed{
\Delta_c=
\begin{cases}
7.5u_c, & u_c\ge0\\
18u_c, & u_c<0
\end{cases}
}
\]

因此：

\[
-18<\Delta_c<7.5
\]

含义：

- 成本优势最多约加 7.5 分；
- 成本劣势最多约扣 18 分。

---

## 18. 实用分范围

最终：

\[
\boxed{
P_i=R_i+\Delta_{v,i}+\Delta_{c,i}
}
\]

总调整范围：

\[
-30<P_i-R_i<15
\]

可设置最低下限：

\[
\boxed{
P_i=\max(0,R_i+\Delta_{v,i}+\Delta_{c,i})
}
\]

不设置 100 分上限。

因此，理论上能力第一且速度、成本均明显优秀的配置，实用分可以略高于 100。

该分数应称为：

```text
Practical Score
```

或：

```text
Practical Index
```

而不是百分比。

---

## 19. 实用分展示

推荐页面直接展示分解：

```text
Raw Capability Score     82.0
Speed Adjustment         +1.5
Cost Adjustment          -3.5
--------------------------------
Practical Score          80.0
```

不得隐藏调整过程，也不得将实用分重新归一化。

---

# 第三部分：置信度与版本

## 20. 统计不确定性

若原始数据提供：

- 标准误差；
- 置信区间；
- 样本量；

则这些信息同时用于：

1. 计算第 6 节定义的单项统计分辨力可靠度；
2. 将证据不足的相对差异向 50 分收缩；
3. 使用 Bootstrap 或 Monte Carlo 传播剩余不确定性；
4. 输出领域分、能力原始分和实用分的区间；
5. 若两个配置区间高度重叠，标记为“差异暂不显著”。

可靠度收缩不是“能力扣分”：

- 可靠度低不会把模型压向 0；
- 只会减少该项数据把模型拉离 50 的幅度；
- 数据变多或置信区间收窄后，分数区间可以自动扩大；
- 不得因为来源没有公开误差数据，就把“不确定”表述成“模型能力差”。

来源的不确定性与能力领域是两个不同概念：

- 统计不确定性：我们对该测量有多确定；
- 能力领域分：配置在对应任务类型上的相对表现。

原 Reliability 已在 Weighting v2.0 中撤销；非幻觉、Bash Recovery 和
Tool Hallucination 分别归入 Search & Knowledge 与 Agentic Work，但仍不得与统计不确定性混合。

---

## 21. 评分版本

由于领域分和能力原始分依赖参评模型集合，所以必须使用固定竞技场快照。

示例：

```text
Scoring Method: v1.1
Practical Adjustment: v1.0
Cohort: Frontier Cohort 2026-Q3
Data Snapshot: 2026-07-29
```

固定规则：

- 页面筛选不触发重新计算；
- 同一快照内参评模型集合固定；
- 新增模型或更新数据时发布新快照；
- 历史分数保留；
- 指标定义、权重和算法版本必须可追踪；
- 每个单项的 \(N\)、\(n_j\)、\(n_{\text{ref}}\)、\(\rho^{\text{count}}\)、\(\rho^{\text{signal}}\) 与最终 \(\rho_j\) 必须随快照保存；
- 页面筛选不得改变单项可靠度，也不得重新展开分数区间。

---

# 第四部分：完整伪代码

```python
def transform_raw_metric(value, metric_type):
    if metric_type == "accuracy":
        p = clip(value, epsilon, 1 - epsilon)
        return log(p / (1 - p))

    if metric_type == "error_rate":
        p = 1 - value
        p = clip(p, epsilon, 1 - epsilon)
        return log(p / (1 - p))

    if metric_type == "continuous_relative":
        return value

    if metric_type == "positive_higher_better":
        return log(value)

    if metric_type == "positive_lower_better":
        return -log(value)

    raise UnsupportedMetricType()


def normalize_base_max100_median50(values):
    max_value = max(values)
    median_value = median(values)

    if max_value == median_value:
        return [50 for _ in values], "insufficient_discrimination"

    scores = [
        100 * 2 ** (
            -(max_value - value)
            / (max_value - median_value)
        )
        for value in values
    ]

    return scores, "ok"


def participation_reliability(observed_count, eligible_count):
    reference_count = min(
        eligible_count,
        max(10, ceil(0.60 * eligible_count))
    )

    if reference_count == 0:
        return 0.0

    return min(1.0, observed_count / reference_count)


def discrimination_reliability(
    transformed_values,
    uncertainty_radii=None,
    full_signal_ratio=2.0,
):
    max_value = max(transformed_values)
    median_value = median(transformed_values)
    spread = max_value - median_value

    if spread == 0:
        return 0.0, "insufficient_discrimination"

    valid_radii = [
        radius
        for radius in (uncertainty_radii or [])
        if radius is not None and radius > 0
    ]

    if not valid_radii:
        # Do not invent a statistical penalty when uncertainty is unavailable.
        return 1.0, "uncertainty_unknown"

    typical_radius = median(valid_radii)
    signal_ratio = spread / typical_radius

    return (
        min(1.0, signal_ratio / full_signal_ratio),
        "estimated",
    )


def calculate_metric_reliability(
    observed_count,
    eligible_count,
    transformed_values,
    uncertainty_radii=None,
):
    count_rho = participation_reliability(
        observed_count,
        eligible_count,
    )
    signal_rho, uncertainty_status = discrimination_reliability(
        transformed_values,
        uncertainty_radii,
    )

    return {
        "rho": min(count_rho, signal_rho),
        "count_rho": count_rho,
        "signal_rho": signal_rho,
        "uncertainty_status": uncertainty_status,
    }


def shrink_toward_neutral(base_score, reliability):
    return 50 + reliability * (base_score - 50)


def build_effective_metric_scores(
    transformed_values_by_config,
    uncertainty_radii_by_config,
    eligible_config_ids,
):
    observed_ids = [
        config_id
        for config_id in eligible_config_ids
        if transformed_values_by_config.get(config_id) is not None
    ]
    observed_values = [
        transformed_values_by_config[config_id]
        for config_id in observed_ids
    ]

    if not observed_values:
        return (
            {config_id: 50 for config_id in eligible_config_ids},
            set(),
            {
                "rho": 0.0,
                "count_rho": 0.0,
                "signal_rho": 0.0,
                "uncertainty_status": "no_observed_data",
            },
        )

    base_scores, discrimination_status = (
        normalize_base_max100_median50(observed_values)
    )
    reliability = calculate_metric_reliability(
        observed_count=len(observed_ids),
        eligible_count=len(eligible_config_ids),
        transformed_values=observed_values,
        uncertainty_radii=[
            uncertainty_radii_by_config.get(config_id)
            for config_id in observed_ids
        ],
    )

    if discrimination_status == "insufficient_discrimination":
        reliability["rho"] = 0.0
        reliability["signal_rho"] = 0.0
        reliability["uncertainty_status"] = discrimination_status

    base_by_config = dict(zip(observed_ids, base_scores))
    effective_scores = {}

    for config_id in eligible_config_ids:
        base_score = base_by_config.get(config_id)

        if base_score is None:
            # Missing observations remain neutral and retain their full weight.
            effective_scores[config_id] = 50
        else:
            effective_scores[config_id] = shrink_toward_neutral(
                base_score,
                reliability["rho"],
            )

    return effective_scores, set(observed_ids), reliability


def aggregate_domain(
    metric_scores,
    metric_weights,
    observed_flags,
    coverage_threshold=0.60,
):
    # Missing metrics contribute the neutral median score 50.
    coverage = sum(
        weight
        for is_observed, weight in zip(observed_flags, metric_weights)
        if is_observed
    )

    q = 0.0

    for score, weight in zip(metric_scores, metric_weights):
        q += weight * log(score / 50)

    if coverage == 0:
        status = "no_observed_data"
    elif coverage < coverage_threshold:
        status = "provisional_coverage"
    else:
        status = "official"

    return q, coverage, status


def calculate_domain_scores(all_model_domain_results):
    calibrating_rows = [
        row
        for row in all_model_domain_results
        if row.coverage > 0
    ]
    calibrated_scores, _ = normalize_base_max100_median50(
        [row.q for row in calibrating_rows]
    )
    scores_by_config = {
        row.config_id: score
        for row, score in zip(calibrating_rows, calibrated_scores)
    }

    for row in all_model_domain_results:
        if row.coverage == 0:
            scores_by_config[row.config_id] = None

    return scores_by_config


def aggregate_raw_capability(domain_scores):
    # Direct equal-weight geometric mean across available domains only.
    # Do not normalize the result against the model cohort again.
    available_scores = [
        score for score in domain_scores
        if score is not None
    ]

    if not available_scores:
        return None

    if any(score <= 0 for score in available_scores):
        return 0

    return exp(
        sum(log(score) for score in available_scores)
        / len(available_scores)
    )


def utility_ratio(r):
    if r >= 1:
        return 1 - 1 / r
    return r - 1


def speed_adjustment(speed_metrics, speed_weights, reference_values):
    utilities = []

    for metric, weight, reference in zip(
        speed_metrics,
        speed_weights,
        reference_values
    ):
        if metric.higher_is_better:
            r = metric.value / reference
        else:
            r = reference / metric.value

        utilities.append(weight * utility_ratio(r))

    u_v = sum(utilities)

    if u_v >= 0:
        return 7.5 * u_v

    return 12 * u_v


def cost_adjustment(effective_cost, median_effective_cost):
    r_c = median_effective_cost / effective_cost
    u_c = utility_ratio(r_c)

    if u_c >= 0:
        return 7.5 * u_c

    return 18 * u_c


def practical_score(raw_score, speed_delta, cost_delta):
    return max(0, raw_score + speed_delta + cost_delta)
```

---

# 第五部分：最终固定规则摘要

## 能力评分

```text
Raw metric
→ Type-specific transformation
→ Base Max = 100, Median = 50 normalization
→ Reliability estimation
→ Shrink toward 50 according to reliability
→ Missing observation = 50
→ Geometric aggregation inside each domain
→ Domain re-normalization
→ Exclude wholly unobserved domains
→ Direct geometric mean across available domains
→ Raw Capability Score (no second cohort normalization)
```

## 实用评分

```text
Raw Capability Score
+ bounded nonlinear speed adjustment
+ bounded nonlinear cost adjustment
= Practical Score
```

## 强制规则

1. 不使用排名换分；
2. 不使用普通 Min-Max；
3. 不使用普通算术平均作为核心聚合；
4. 百分比准确率先进行 Logit 变换；
5. 连续相对分直接使用；
6. 成本、延迟和吞吐类指标先按倍数关系处理；
7. 单项基础相对分满足最高 100、中位数 50；
8. 单项有效分的中位数为 50，实际展开区间由可靠度决定；
9. 可靠度至少同时考虑参评配置数量和统计分辨力；
10. 可靠度只能把差异向 50 收缩，不得把不确定性解释成能力差；
11. 正常校准领域满足最高 100、中位数 50；能力原始分直接汇总所有可用领域，不再次归一化；
12. 实用分不重新归一化；
13. 实用分直接显示速度和成本的加减分；
14. 同一基准不得因为多个平台重复收录而重复计分；
15. 平台综合分与其组成项不能同时使用；
16. 只有排名而没有连续值的数据不进入评分；
17. 领域内部的缺失单项固定按 50 分计算，且不得重新分配其权重；
18. 领域覆盖率低于 60% 时标记 provisional，但不自动取消入榜；
19. 完全没有领域观测时，该领域显示 `--`、不参与总能力分，并标记 `no_observed_data`；
20. 所有结果必须绑定评分版本、参评池、可靠度参数和数据快照。
