# 05 · 竞争格局

> 超越 Raft 不能只在 Raft 的赛道里跑，要把它放回整个 agent 生态里定位，找到"Raft 占了哪格、哪格还空着"。

---

## 一、两条主赛道

Agent 生态当前有两条主 wedge，Raft 卡在一个**介于两者之间、又都不完全是**的位置：

| 赛道 | 卖什么 | 代表 | Raft 的关系 |
|------|--------|------|------------|
| **基础设施型**（stateful agent infra） | 卖"给 agent 记忆/状态的底层" | Letta(原 MemGPT)、Zep、Mem0、LangGraph、LlamaIndex | Raft 不是 infra，是跑在 infra 上的 finished workspace；但它把"持久 + 记忆"做成了产品级而非 SDK 级 |
| **成品队友型**（finished teammate） | 卖"一个能干活的 agent 同事" | Devin(Cognition)、Factory、Poolside、Magic、Augment、OpenHands、SWE-agent、Cursor、Windsurf | Raft 不卖"一个超级 agent"，卖"一群 agent 协作的空间"——是 teammate 的**容器**而非 teammate 本身 |

**关键定位**：Raft = **容器 + 协作层**，而非 infra（太底）也非 single-teammate（太窄）。这个卡位是它的蓝海，但也是它的脆弱点——两边都在往中间挤压。

## 二、按类别细分

### A. 持久记忆 / stateful agent 基础设施
- **Letta（原 MemGPT）**：Berkeley 衍生，核心是 stateful agent + 自编辑长期记忆的 agent server。开源 SDK + 托管平台。最接近 Raft"持久身份"的技术内核，但是 SDK，不是 workspace。
- **Zep**：长期记忆层，时序知识图谱。定位 memory infra 而非 agent runtime。
- **Mem0**：记忆层，embedding + graph recall，常与 Zep 比。
- **LangGraph / LlamaIndex**：stateful、cyclic agent 编排框架，有 durable agent 框架但非 memory-first。

→ **对超越产品的启示**：Raft 的"记忆复利"技术内核来自这一脉。超越产品应**直接用 Letta/Zep 级的记忆能力做底座，但在其上做 Raft 没做的——记忆可检视/治理（见 [03] gap 3）**。即把"记忆 infra"升级为"可治理记忆 infra"。

### B. 自主 SWE 队友
- **Devin（Cognition）**：品类定义者"AI 软件工程师"，长 horizon 规划/编码/调试。
- **Factory AI**：自主 "Droids"。
- **Poolside / Magic**：SWE 专项前沿模型 + agent。
- **Augment Code**：企业级、codebase-wide 上下文。
- **Cursor / Windsurf**：agentic IDE，非完整 teammate 但相邻。
- **OpenHands（原 OpenDevin）/ SWE-agent**：开源 Devin 替代，正在商品化核心 loop。
- **Aider / Continue / Cline**：开源 agentic 编码工具。
- **Replit Agent / Copilot Workspace / Google Jules / Amazon Q**：平台厂 agent。

→ **启示**：SWE 垂直高度拥挤且资本密集（Cognition/Poolside/Magic/Augment 都是九-十位估值）。Raft 在这里只做"点状"（code review、CI 监控），不碰长 horizon 自主工程。**超越产品不该在 SWE 垂直正面硬刚**，而应做"**SWE agent 的协作容器**"——让 Devin/OpenHands 类深度 agent 作为可插拔 vertical 跑在超越产品的协作层里（见 [04] 策略 7）。

### C. "AI 员工 / 队友"横向平台
- **Ema**（"通用 AI 员工"）、**Sierra**（Bret Taylor，企业 CX）、**Harvey**（法律）、**Glean**（企业搜索+集成）、**Cresta**（实时 copilot）、**Lindy/Personal.ai/Pi**（个人助理）、**MultiOn/Anon**（浏览器自主）。

→ **启示**：横向"AI 员工"已有不少玩家，但大多**单 agent**（一个 universal employee）。Raft 的差异化是**多 agent + 人共在一个空间**。超越产品要在"多 agent 协作 + 人"这个维度上继续加深，而非去做"又一个 universal employee"。

## 三、市场观察（来自调研的综合判断）

1. **两个不同 wedge**：Letta 卖 infra（你构建的 agent 的记忆/状态），Devin 卖成品队友。竞品要么聚在 infra，要么聚在成品队友。**Raft 卡在"成品队友的协作容器"——目前基本无直接竞品**。
2. **记忆正在从 product 变 feature**：Pinecone/Weaviate/Chroma 等 vector DB 和编排框架在吸收记忆原语，挤压 standalone memory layer。→ **超越产品不能把"记忆"当唯一卖点**，得把记忆做成可治理的一等对象（差异化点），而非"我们也有记忆"。
3. **"队友"定位拥挤且烧钱**：Cognition/Poolside/Magic/Augment 都是九-十位估值，差异化正转向"长 horizon 可靠性"和"企业集成"而非 demo 效果。→ **超越产品应避开"单 agent 靠谱性军备竞赛"**，主打"多 agent 协作的工程纪律"——这是 Raft 已验证有需求、但竞品都没认真做的维度。
4. **开源在制衡 SWE wedge**：OpenHands/SWE-agent 商品化了核心 loop，逼专有厂走向垂直深度和 trust/safety。→ **超越产品应开源"协作层 + AX 协议"**，让 SWE vertical agent 作为可插拔组件——享受开源生态红利而不与开源竞争。

## 四、Raft 在格局里的坐标

```
                   infra(底)                              成品(顶)
              ┌────────────────────────────────────────────────────┐
   单 agent   │  Letta/Zep/Mem0 ──────────── Devin/Factory/Cursor  │
              │  (卖记忆/状态 infra)          (卖一个能干活的同事)    │
              │                                                      │
   多 agent   │  LangGraph ────────────────── ★ Raft ★ ──────────? │
   + 人       │  (编排框架，无 workspace)    (成品队友的协作容器)   (超越产品位)
              └────────────────────────────────────────────────────┘
```

**Raft 在"多 agent + 人 + 成品容器"这一格，目前几乎独占。** 超越产品的位置就在 Raft 同一格的**更深处**——同样做多 agent 协作容器，但补上 Raft 的全部盲区（[03] 的 9 条），并把 AX 协议化、记忆可治理化、垂直可插拔化。

## 五、超越产品相对每个竞品类别的差异化主张

| 竞品类别 | 它们的局限 | 超越产品的主张 |
|---------|-----------|---------------|
| Letta/Zep/Mem0 | 是 SDK/infra，不是 workspace；记忆不可治理 | 记忆一等可检视对象 + 协作 workspace |
| Devin/Cursor 等 | 单 agent 孤岛，无多 agent 协作空间 | 深度 vertical agent 作为可插拔组件跑在协作层 |
| Ema/Sierra 等横向"AI 员工" | 单 universal agent | 多 named agent + 能力寻址 + 分级自治 |
| LangGraph | 编排框架，无 human-in-loop workspace | 人是协作一等参与者，非"外部调用方" |
| Raft 本身 | 见 [03] 九大盲区 | 见 [04] 战略蓝图 |

---

**一句话结论**：超越产品不是去和 Devin 卷 SWE、不和 Letta 卷 memory infra，而是**占住 Raft 已验证的蓝海格（多 agent + 人 + 成品容器），在更深处把 Raft 没做的工程做透**——可治理记忆、并发原语、分级自治、AX 开放协议、可插拔垂直深度。这格目前只有 Raft 一个不完善的占位者，是最值钱也是最容易被超越者吃下的位置。
