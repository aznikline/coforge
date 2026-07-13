# coforge 诚实定位（2026-06-25，能力事实重审）

> 触发：被问到"从什么阶段开始测量变成强项了"——答出"是 docs/17 投稿
> reframe 的产物，因果是反的"。本文件不再用"测量强项"叙事，从能力事实
> 重新定位。所有先例都经本轮独立验证；子 agent 出错的两条已剔除。

## 0. 先剔除两个子 agent 编造的"先例"

调研里 spawn 的定位 agent 给了两条建议，本轮验证为错：
- ❌ **Hylos (arXiv:2605.24728)** "downgrade benchmark→artifact study + claim-evidence
  matrix"：arXiv 抓到的 abstract 里**没有"claim-evidence matrix"**，且 ID 超训练
  截止无法独立确认。**删除，不作先例。**
- ❌ **"IISWC 2026 有 6 页 benchmark/tool track"**：实抓 iiswc.org/iiswc2026/，
  tracks 是 Papers/Tutorials/Workshops/Posters/**Artifact Evaluation**——**无
  benchmark/tool track**。且 paper deadline 5/21 已过（今天 6/25），AE 8/3。
  **删除。**

子 agent 在 arXiv ID、track 名称、claim-evidence matrix 上三次幻觉。教训：
**涉及外部事实先例，一律 WebFetch 独立验证，不采信 agent 转述。**

## 1. coforge 的能力事实（不靠叙事）

### 1.1 实物清单（LOC 全实测）
| 件 | LOC | 状态 |
|---|---|---|
| router（Fastify+node:sqlite）| 818 | 跑得动的小 PoC。3 agent，per-agent memory 带 B2 压缩开关，B5 能力路由开关，serial queue，M2 reminder |
| harness（6 probe+3 adapter+CLI+analyze）| 854 | 跑得动。3 adapter 里**真外部只有 langgraph 一个**（mock 是自家、coforge 是自家）|
| langgraph-ws（server.py）| ~200 | 跑得动。第三个 adapter 的后端，bailian GLM-5.1 |
| paper（main.tex）| 2 页 | acmart sigconf，double-blind，已对齐 AgenticOS workshop |

### 1.2 实测产出（bench.json，真数字）
serial-queue 墙：N=1,2,4,8 并发 → wall-clock 3.34 / 7.01 / 13.93 / 27.3s。**线性增长，可复现。** 这是 coforge 最硬的一条证据——一个能用数字说话的测量。

### 1.3 三方对比的真 divergence（harness/reports/three-way-comparison.md）
- serial-queue：coforge 线性（有墙）vs langgraph flat（无墙）→ **probe 真能区分架构差异，不是 canned "always-confirm"**。
- isolation + composition：三 workspace 全中（100/100、0/20）→ 这两墙是 "agent workspace" 形态的结构性属性，是 §4 enforcer==enforced-upon 最强支撑。
- prompt-replay：langgraph 不可测（token usage 不暴露，读 0）→ **honest gap**。
- routing：LLM judge 方差大，coforge 100%→30% 抖动，langgraph timeout → **probe 不稳**。

### 1.4 闭环修复（B2+B5）
只有 **2/6 墙**有开关闭环（B2 压缩、B5 路由）。都是 app-layer mitigation，按 §4 不构成 OS 层消除——这点 paper §3 的测量条件已诚实写明"switch disabled to surface walls"。

## 2. 能站住的先例（本轮独立验证）

只剩一条硬先例 + 一条广为引用的框架：

### 2.1 MCP-LLM-agents（arXiv:2511.07426）✅ 已验证真
**"Network and Systems Performance Characterization of MCP-Enabled LLM Agents"**
（Ding/Zhu/Liu）。abstract 明写 "comprehensive measurement-based analysis of
MCP-enabled interactions with LLMs"，揭示 token 效率/成本/完成时间/成功率
trade-off，**不提 benchmark suite、不发布数据集、不发布 harness**。
→ **直接先例：一个 agent 协议的"measurement-based analysis"，不带 benchmark 框架，也能发。**

这正是 coforge 该用的 claim 形态——不是"我们是 benchmark"，是"agent workspace substrate 的 measurement-based analysis"。

### 2.2 Gray 基准四准则（广为引用，本轮未逐字验证原文）
relevance / portability / scalability / simplicity。YCSB（Cooper et al.）引述。
**按这四条自查 coforge**：
- relevance：✅ 真问题（agent workspace 墙确实存在，Raft 自己都在讲）
- portability：⚠️ 弱——3 adapter 里 2 个自家，只 1 个真外部。benchmark 要求"跨系统可移植"，coforge 只演示了 2 个系统
- scalability：✅ scaling 墙有 N=1..8 曲线
- simplicity：✅ probe 都很短（31-83 行）

**4 中 3 达标，portability 是软肋。** 所以"benchmark"这个 label 撑不住，但"measurement-based analysis"撑得住。

## 3. 诚实定位光谱（从最强 claim 到最弱）

| Label | claim 它许可的 | coforge 现有证据 | 差什么 |
|---|---|---|---|
| OS 研究 artifact | "agent workspace 缺 OS 抽象" | §4 enforcer==enforced-upon + 2 墙结构性（isolation/composition 三方全中）| **没投出去验证过**（OpenAlex novelty 503 没跑成）；只 2 页 vision |
| **Measurement-based analysis**（推荐）| "这是 agent workspace substrate 的一组测量+真 divergence" | bench.json 线性曲线 + 3-way 真 divergence + MCP 先例 | **足够**——MCP 论文就是这个 claim 形态 |
| Benchmark suite | "可复现的跨系统评测套件" | 6 probe + 3 adapter + CLI | **portability 软肋**（只 1 真外部 adapter）；Gray 准则 4 中缺 1 |
| Teaching reference | "可读的小型 agent workspace 参考" | 818 行 router，README 诚实 | 够，但降级了 |
| Negative-result note | "这些墙在 app 层修不掉" | §4 + B1/B3 OS-taboo | 够，但比 measurement analysis 弱 |
| Blog-grade demo | "我做了个小工具" | 有 | 够，但浪费了真 divergence |

**最 defensible 的 label：measurement-based analysis（对照 MCP-LLM-agents 先例）。**
**次强 OS research artifact 的真实 gap**：缺一次成功的 novelty 检索（OpenAlex 503 没跑成是上次遗留，不是能力缺失——是工具可用性问题）。

## 4. 和"测量是不是强项"这个被戳的问题的清算

上一轮承认了：**"测量强项"是 docs/17 投稿 reframe 出来的叙事，因果反了**（做不动产品→reframe 成不该做→把已有的墙/纸/harness 包装成贡献）。

但本轮能力重审发现一个**部分翻案的事实**：
- bench.json 的线性曲线是**真测量产出**，不是叙事。
- 3-way 的 serial-queue divergence 是**真区分能力**，不是 canned。
- 这两样是"measurement-based analysis" claim 形态的真实底座。

所以诚实的修正不是"测量完全不是强项"，而是：
> **coforge 有 1 条硬测量产出（serial-queue 线性）+ 1 条真区分能力（3-way divergence），足以支撑"measurement-based analysis"这个弱-中 label，但不足以支撑"benchmark suite"或"OS research artifact"这两个强 label。** 强项被叙事夸大了，但不是凭空。

## 5. 所以"定位"到底是什么（对齐用）

不靠叙事，靠能力事实，coforge 诚实的定位是：

> **一个 agent-workspace substrate 的 measurement-based analysis，附带一个最小可跑 PoC 作为被测对象之一。** claim 边界：发现了真 divergence（serial-queue 在 coforge 有/langgraph 无），测量了 6 墙里若干墙的增长/故障率，诚实地把 2/6 的 app-layer 修复标为"非 OS 层消除"。它**不是 benchmark**（portability 软肋），**不是完整 OS 研究**（未投出未验证），**不是产品**（~3.5/20 feature）。

**这个定位和 Raft 的关系**：不追 Raft 的 niche（不稳、被夹击），也不假装"形式化 Raft 协议"（那是上一轮用夸大的"测量强项"撑出来的 (B)，现在撤回）。coforge 站的位置是 **Raft 和所有 incumbent 都没站的位置——"agent workspace substrate 的第三方测量者"**。Raft 自己不测、incumbents 不测、学术 AgenticOS 议程在喊缺抽象但也没给可复现测量。**这个位置是否真空、值不值得站，是下一步要验证的。**

## 6. 下一步待验证（不预设答案）
1. "agent workspace substrate 的第三方测量"这个 niche 是否真空——需查是否有任何人在做"workspace 级"（不是 agent 级、不是 task 级）的测量/对比。
2. measurement-based analysis 的合理 venue（AgenticOS 是 OS 方向；MCP 那篇在什么 venue 发的、coforge 的 measurement 形态投哪类更匹配）。
3. 若 niche 非空已有占据者，coforge 是否有差异化（它的 6 墙理论 + §4 enforcer 论点 + 真 divergence，是不是别人没有的）。

这三条都不预设"强项"，纯事实驱动。

---
*先例验证：MCP-LLM-agens arXiv:2511.07426（WebFetch 实抓 abstract 确认）；Gray 四准则（广为引用，原文本轮未逐字验证，已标注）；Hylos 与 IISWC benchmark track（子 agent 转述，本轮 WebFetch 证伪，已剔除）。能力事实：bench.json + three-way-comparison.md + 6 probe 源码，全本地实读。*
