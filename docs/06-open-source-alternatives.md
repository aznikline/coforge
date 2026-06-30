# 06 · 开源能否替代 Raft？

> 问题：现在有没有开源项目能替代 Raft？
>
> **结论先行**：**没有单一开源项目能整体替代 Raft。** Raft 是一个"成品协作工作区"，而现有开源生态几乎全部集中在**框架/基础设施层**（orchestration、memory、agent runtime），没有一个开源项目同时覆盖 Raft 的五个关键能力——尤其是"人机共享频道 + agent 路由/寻址 + AX 协调工程"。但有若干项目能**组合拼出 Raft 的 70-80%**，且剩下 20-30% 的缺口正是 [04 超越战略] 的发力点。

---

## 一、先把 Raft 拆成可替代性维度

判断"能否替代"必须先定义 Raft 的能力集。Raft = 五个能力的合体：

| # | 能力 | 性质 |
|---|------|------|
| C1 | **聊天工作区 UI**（channel/DM/thread，人机共享） | 成品界面 |
| C2 | **持久身份 + 复利记忆**（agent 跨天跨任务存活） | agent runtime + memory |
| C3 | **多 agent 协调**（命名路由、inbox、held draft、claim 任务） | AX 协调工程 |
| C4 | **自托管 daemon**（agent 跑在用户硬件，隐私 + 算力可控） | 部署 |
| C5 | **成品体验**（开箱即用、非 SDK、非框架） | 产品化程度 |

**关键观察**：开源生态在 C2、C4 上有强供给；在 C1、C3、C5 上几乎没有供给。Raft 的真正稀缺性在 C3（AX 协调工程）——这也是 [02] 里最难复制的成功因素。

## 二、逐个项目评估

### Letta（原 MemGPT）— `github.com/letta-ai/letta`，Apache-2.0
- **是什么**：stateful agent 平台。agent 有 `memory_blocks`（human/persona 分段），跨会话保留记忆、可自编辑。
- **覆盖**：✅ C2（持久记忆，这是它的核心） ✅ C4（Docker 自托管，多种 compose）。
- **不覆盖**：❌ C1（无 web chat GUI，是 CLI + SDK） ❌ C3（有 subagents 但无共享频道/inbox/held-draft 协调） ❌ C5（是 infra/SDK，非成品 workspace）。
- **定位**：Raft 的**记忆技术内核的开源版**，但只是引擎，没有车壳。
- **替代度**：~25%（只覆盖记忆这一个维度，且深度足够）。

### OpenHands（原 OpenDevin）— `github.com/All-Hands-AI/OpenHands`，MIT，78k★
- **是什么**：AI 驱动开发平台。有 **Agent Canvas**（浏览器 UI + backend）、`agent-server`、SDK，可本地或云端跑千级 agent。多 agent 架构，多用户 + RBAC + 对话共享（OpenHands Cloud），可在自有 VPC 自托管。
- **覆盖**：✅ C4（Docker 全 MIT，VPC 自托管） ✅ C1 部分（Agent Canvas 是浏览器 UI，但偏向"跑一个 agent 做任务"而非"人机共享频道长期协作"） ✅ C5 部分（比 Letta 更接近成品）。
- **不覆盖**：❌ C2 明确（无跨会话持久身份的明确说明） ❌ C3（无命名路由/inbox/held-draft；无"agent 作为具名队友"概念） ❌ C1 的"人机共享频道"形态（Canvas 是单 agent 任务界面，非多 agent + 多人共享频道）。
- **定位**：开源里**最接近 Raft"成品感"的项目**，但它的 UI 范式是"任务执行台"而非"协作聊天频道"。且偏向 SWE（有 ToM-SWE），非通用协作。
- **替代度**：~45%（最接近的一个，但协作范式不同 + 缺持久身份 + 缺 AX 协调）。

### AutoGPT — `github.com/Significant-Gravitas/AutoGPT`
- **是什么**：框架 + 平台。AutoGPT Platform（可视化 block 拼接建 agent + Agent Server + marketplace）+ Forge（classic 工具包）。可自托管（"Download to self-host (Free!)"）。
- **覆盖**：✅ C4（自托管） ✅ C5 部分（有可视化 builder UI）。
- **不覆盖**：❌ C1（UI 是"block 拼接 builder + 监控"，非聊天频道） ❌ C2（无明确持久记忆） ❌ C3（无多 agent 动态协作，是单 agent 串多 step）。
- **关键陷阱**：**AutoGPT Platform 是 Polyform Shield License（非开源）**，只有 classic 是 MIT。商用要小心。
- **替代度**：~20%（范式完全不同，是 workflow builder 不是协作空间）。

### CrewAI — `github.com/crewAIInc/crewAI`，MIT
- **是什么**：Python 框架。Crews（自治 agent 团队）+ Flows（事件驱动工作流）。有 human-in-the-loop。商业层是 AMP/Control Plane。
- **覆盖**：✅ C2 部分（memory 是 per-crew 内能力，无明确跨会话持久） ✅ C4（本地 / on-prem）。
- **不覆盖**：❌ C1（无 chat UI，是 CLI + YAML + 代码） ❌ C3（多 agent 编排有，但是"跑一次任务"的 crew，非长期共享频道协作） ❌ C5（纯框架）。
- **定位**：编排框架，不是工作区。**典型代表 Raft 之外的那一脉竞品**（[05] 的 infra 赛道）。
- **替代度**：~20%。

### LangGraph — `github.com/langchain-ai/langgraph`，MIT
- **是什么**：低层编排框架。durable execution（失败后从断点恢复）+ 短期/长期记忆 + human-in-the-loop（可检查/改 agent state）。Deep Agents 子包支持 subagents。
- **覆盖**：✅ C2（checkpoint + 跨会话长期记忆，工程上最扎实） ✅ C4（pip 包自跑）。
- **不覆盖**：❌ C1（无 chat workspace，LangSmith Studio 是可视化原型，非协作空间） ❌ C3（是图编排，无频道/路由/inbox 语义） ❌ C5（纯 infra）。
- **定位**：最适合**做 Raft 的底座**，但本身离成品最远。
- **替代度**：~20%（但作为底座的"可被组装度"最高）。

### LibreChat — `github.com/danny-avila/LibreChat`，MIT，39.8k★
- **是什么**：自托管 AI chat 平台（增强版 ChatGPT clone），统一多 provider。有 Agents（无代码助手 + marketplace + 协作分享 + subagents）、MCP、SSO/SAML/LDAP、code interpreter、artifacts。
- **覆盖**：✅ C1（完整 chat UI，桌面+移动+明暗） ✅ C4（Docker/Helm 自托管） ✅ C5（成熟成品，生产可用，Shopify/Daimler/Stripe 在用） ✅ 企业能力（SSO/RBAC/分组权限——Raft 这块还是 Coming soon）。
- **不覆盖**：❌ C2（无跨会话持久 agent 记忆，只有对话历史 + 分支 + 预设） ❌ C3（是"单用户 ↔ AI"模型，**无多 agent + 多人共享频道**；subagents 是隔离子运行，非动态协作） ❌ C3 的命名路由/AX。
- **定位**：**开源里唯一有"成品 chat 工作区"形态的项目**，但它的交互模型是"个人 ↔ 助手"，不是 Raft 的"团队 + 多 agent 共享频道"。它像 Raft 的 **C1 外壳**，缺 C2/C3 内核。
- **替代度**：~40%（外壳最像，内核最缺）。

## 三、能力覆盖矩阵

| 能力 | Letta | OpenHands | AutoGPT | CrewAI | LangGraph | LibreChat | **Raft** |
|------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| C1 聊天工作区（人机共享频道） | ✗ | △ 任务台 | ✗ builder | ✗ | ✗ | **✓ chat** | **✓✓** |
| C2 持久身份+复利记忆 | **✓✓** | ✗ | ✗ | △ | **✓✓** | ✗ | **✓✓** |
| C3 多 agent 协调（命名路由/inbox/held-draft） | ✗ | ✗ | ✗ | △ crew | ✗ 图 | ✗ | **✓✓** |
| C4 自托管 daemon | ✓ | **✓✓** | ✓ | ✓ | △ | **✓✓** | **✓✓** |
| C5 成品体验（非 SDK/框架） | △ CLI | **✓** | △ | ✗ | ✗ | **✓✓** | **✓✓** |

✓✓ = 强覆盖 / 原生；✓ = 有；△ = 部分/不同范式；✗ = 无

**读法**：没有任何一行全是 ✓✓。**C3 那一列除了 Raft 全是 ✗/△**——这就是开源的最大缺口，也是 Raft 最深的护城河。

## 四、能拼出 Raft 吗？组合方案评估

既然没有单一项目，能否组合？理论上：

> **LibreChat（C1 外壳 + C5 成品 + 企业）+ Letta 或 LangGraph（C2 记忆底座）+ 自研 C3 协调层 + 自研 daemon 适配（C4）**

- **可行部分**：LibreChat 提供现成 chat UI + SSO/RBAC（甚至比 Raft 企业版还成熟）；Letta/LangGraph 提供记忆引擎。这两块拼起来能拿到 Raft 的 C1+C2+C4+C5 的大部分。
- **不可行部分**：**C3 几乎要从零写**。LibreChat 的"单用户↔助手"模型要改造成"多 agent + 多人共享频道 + 命名路由 + inbox + held draft"——这不是配置，是**重写交互模型与后端语义**。开源生态没有任何项目提供这套 AX 协调原语，这正是 Raft 博客里反复强调的、它自己工程化出来的东西。
- **集成成本**：LibreChat 的 agent 模型与 Letta 的 memory_blocks 是两套抽象，缝合的接缝（一个 LibreChat agent 如何映射到一个 Letta stateful agent、如何在频道里被 @ 路由、如何做 held-draft 新鲜度检查）全部要自研。

**组合替代度现实评估**：~70-80%，但**最后 20-30%（C3 + 缝合）的工程量 ≈ 自研一个新产品的核心难度**。换句话说，"用开源拼"省下的是外壳和记忆引擎，没省下的是 Raft 真正值钱的那层。

## 五、开源 vs Raft 的结构性差异

即使拼到 80%，开源组合与 Raft 仍有三个不可弥合的差异：

1. **范式不同**：开源项目几乎都是"**单 agent 或任务流**"心智（跑一个 agent 完成一个 job）。Raft 是"**多 agent 长期驻留共享空间**"心智。这是产品定义层的差异，不是代码量能补的——见 [02] 成功因素 1（范式占位）。
2. **AX 是 Raft 私有工程**：inbox 拉式注意力、held-draft 新鲜度、感知共情、行动显式化——这些 Raft 在博客里当作学科在定义，**开源生态零供给**。要复制就是从零做这门工程。见 [02] 成功因素 4、[03] gap 8。
3. **命名即路由的语义无处可借**：`@Noel` 把请求路由给一个有累积上下文的具名 agent——LibreChat 的 agent 是"无代码助手"（可分享但无累积身份），Letta 的 agent 有身份但不在频道里被 @。开源里**身份系统与路由系统是断开的两套**，Raft 把它们焊在了一起。见 [02] 成功因素 5。

## 六、对超越产品（Flot）的启示

这个调研直接修正 [04] 的战略判断：

1. **别等开源追上来再动手——C3 是真空**。开源生态短期不会补 C3（AX 协调是工程密集 + 无人在做），这正是超越产品的窗口。Flot 应**把 C3 做成开放协议**（[04] 战略 6），既建护城河又占生态位——让开源 agent runtime（Letta/LangGraph 跑的 agent）将来**接入 Flot 的协作层**，而不是自己重造 agent 引擎。
2. **底座直接用开源，别重造 C2/C4**。Flot 的记忆引擎可以用 Letta 或 LangGraph checkpoint 做**底座**，但在其上做 [04] 战略 3 的"记忆可检视治理"（browser/diff/provenance/branch/ACL）——这是开源没有、Raft 没做的差异化层。
3. **外壳可参考 LibreChat，但交互模型要重写**。LibreChat 证明了"自托管成品 chat + 企业 SSO"开源能做且成熟，Flot 的 C1 可以借鉴其工程，但必须重写为"多 agent + 多人共享频道"模型——这是 Raft 做对而 LibreChat 没做的。
4. **OpenHands 是最该接入的第一个 vertical**。[05] 战略 7 说做可插拔 vertical——OpenHands（MIT、78k★、SWE 深度、有 Agent Canvas）是最理想的 SWE vertical 接入对象，比自研 SWE agent 划算得多。
5. **License 雷区**：AutoGPT Platform 是 Polyform Shield（非开源），CrewAI 商业层是 AMP。Flot 若借鉴/接入，**只用其 MIT 部分**（AutoGPT classic、CrewAI 框架本体），避免传染。

## 七、最终判断

| 问题 | 答案 |
|------|------|
| 有单一开源项目替代 Raft 吗？ | **没有。** 最接近的 OpenHands ~45%，LibreChat ~40%，都缺 C3 + 范式不同。 |
| 能组合开源拼出 Raft 吗？ | **能拼到 ~70-80%**，但 C3（AX 协调）+ 缝合要从零写，工程量≈自研核心。 |
| 开源生态的最大缺口是什么？ | **C3 多 agent 协调工程**——inbox/held-draft/命名路由/感知共情，开源零供给。 |
| 对超越产品的意义？ | **窗口期存在**：开源短期补不上 C3，Flot 应把 C3 做成开放协议 + 用开源做 C2/C4 底座 + 接入 OpenHands 做 SWE vertical。 |

**一句话**：开源能给你 Raft 的零件（记忆引擎、chat 外壳、自托管、企业 SSO），但给不了 Raft 的灵魂——**多 agent 在共享空间里协调、寻址、积累信任的那层 AX 工程**。这层既是开源的真空，也是 Raft 的护城河，更是超越产品最该占下的位置。
