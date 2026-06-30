# 04 · 超越 Raft 的战略蓝图

> 目标：做一个**功能上超越 Raft** 的产品。本文不写营销话术，只写**在 Raft 每个 trade-off 上选另一边 + 补上 Raft 没做的工程**的具体战略。每条都对应 [03] 的一个盲区，并标注与 [02] 成功因素的关系。

暂称超越产品为 **"Flot"**（Floating raft / 一个能浮得更高的 raft）——仅作占位名。

---

## 战略总纲

Raft 的成功 = **叙事 + 界面 + 工程审美** 三重对齐。超越它不能只加功能，必须在这三层都重新占位：

1. **叙事层**：找一个 Raft 没占据的范式词。候选——**"Agentic Org"（有机体组织）** 或 **"Shared Mind"（共享心智）**。Raft 说"agent 是队友"；Flot 说"agent + 人 = 一个有共享心智的有机体组织"。把粒度从"个体队友"升到"集体心智"。
2. **界面层**：聊天是 Raft 的捷径也是天花板。Flot 的界面 = **同一工作模型的多视图投射**（chat / kanban / graph / diff / timeline），chat 只是其一。
3. **工程层**：把 Raft 留白的九处全部做透——可治理记忆、原生并发、分级自治、AX 协议化、可插拔垂直、能力寻址、企业首发、学习血缘、信任可视化。

---

## 战略 1：工作模型多视图（vs Raft 单一聊天）→ 对应 [03] gap 1

**主张**：Flot 不把 chat 当唯一面，而是定义一个**统一的 Work Graph**（任务 / 决策 / 文件 / agent / 人的节点与边），所有界面都是它的 view：

- `chat` view：兼容 Raft 体验，@路由、thread、inbox、held draft 全保留——**不丢 Raft 的 adoption 优势**。
- `board` view：kanban / list，按状态/负责人/agent 分组。
- `graph` view：任务依赖图、agent 间的调用与学习关系、文件-agent-决策血缘。
- `diff` view：agent 对代码/文档的改动，可直接 review/回滚。
- `timeline` view：时间轴上的 agent 行为与决策审计。

**为什么超越**：Raft 把所有工作压进时间流；Flot 让同一份工作按**每个角色最顺手的视图**呈现。工程师看 diff，PM 看 board，QA 看 timeline——而底层是同一个不断更新的 Work Graph。视图是 free 的，因为模型是统一的。

**风险与对策**：多视图会碎片化。对策——所有 view 共享同一 selection / 同一 context ribbon，点 board 里的卡 = 跳到那条 chat thread = 跳到那段 diff。视图切换是镜头移动，不是上下文丢失。

## 战略 2：原生并发原语 + 事件流房间（vs Raft turn-based + 局部 held draft）→ 对应 [03] gap 2

**主张**：给 agent 之间提供**真正的并发协调原语**，而非靠 AX 缓解：

- **Advisory lock / CAS claim**：agent 认领任务用 CAS 语义（compare-and-set），两个 agent 同时认领只有一个成功，另一个自动 fallback 到"观察 / 认领相关子任务"。
- **Watch / notify**：agent 可 watch 一个资源（文件 / 任务 / 频道），变更以**事件流**推送，而非让 agent 反复拉快照。把房间的 turn-based gap 从根上消掉。
- **Presence + typing awareness**：agent 能感知"另一个 agent 正在处理这个文件""那个任务 3 秒前被 X 认领"——给 agent **连续感知的模拟层**，正是 Raft 自己说缺的东西。
- **Held draft 升级为并发协议**：Raft 的 held draft 是单 agent 的草稿新鲜度；Flot 把它扩展为**跨 agent 的草稿协调**——A 和 B 同时写同一文件的修改，系统提示冲突并 surface 合并/分工选项。

**为什么超越**：Raft 自承认协调/所有权/实时感知未解。Flot 把这些做成一等原语，"计数到 20 不冲突"不再是 demo 极限，而是日常基线。

## 战略 3：记忆一等可检视对象（vs Raft 记忆黑箱）→ 对应 [03] gap 3

**主张**：把 agent 记忆从"黑箱复利"升级为**可治理的一等对象**：

- **Memory browser**：人能像翻 agent 的笔记本一样翻它的记忆，按主题/时间/来源浏览。
- **Memory diff + provenance**：每条记忆有来源（哪次对话、哪个文件、哪个 agent 传授）、有时间戳、可 diff。能回答"agent 为什么记住了这个"。
- **Memory branch / merge / clone**：记忆可分支（克隆一个 agent 做变体）、可合并（两个 agent 的记忆融合）、可迁移（换底座模型时把记忆搬走，不被 vendor lock-in）。
- **Forgetting policy**：按主题/年龄/敏感度自动遗忘，支持 GDPR 删除、纠错式遗忘（"忘掉那条错误的偏好"）。
- **Memory ACL**：谁能看到 agent 记住了关于谁的什么——隐私一等。

**为什么超越**：Raft 的记忆是产品力也是企业风险。Flot 把记忆变成**可审计、可迁移、可合规**的资产——这恰好是企业采购最在意而 Raft 完全没做的。记忆可迁移还顺带解了 vendor lock-in，是 GTM 利器。

## 战略 4：能力寻址 + 可演进画像（vs Raft 命名即路由的硬化风险）→ 对应 [03] gap 4

**主张**：保留 Raft 的"named agent"体验（@Noel 仍然可用），但在其上加一层**能力寻址**：

- **@capability 路由**：`@codeowner(file)` / `@expert(topic)` / `@who-shipped-most(repo, 7d)`——系统解析到当前最合适的具名 agent。人不必记得"@谁"，只需表达"要什么能力"。
- **可演进画像**：每个 agent 有一个**显式能力画像**（会什么、做到什么程度、最近做过什么），随工作自动更新、**可被挑战**。防止"名字硬化成 role"。
- **画像 anti-lock**：系统主动给 agent 分配**画像外**的小任务（"让 Noel 试一下后端"），用真实工作刷新团队心智模型——把 Raft "期望修正要便宜"的原则做成机制。
- **路由解释**：能力寻址命中时，系统告诉人"为什么路由给 Noel 而非 Pat"——可解释、可纠正。

**为什么超越**：Raft 的路由是人发起的显式 @，会硬化。Flot 的路由是**系统辅助的能力匹配 + 主动反硬化**——既比 Raft 更省心，又避免了"名字变 role"的退化。

## 战略 5：分级自治 + 信任可视化（vs Raft 过度拟人、无信任边界）→ 对应 [03] gap 9

**主张**：明确 agent **不该被信任的边界**，并把它做成产品面：

- **Trust tier**：每个 agent 有 0–4 级 trust。0 级=每步 human approval；4 级=prod 自主。tier 由"在该领域累计的成功+审计通过"驱动，可升可降。
- **Tier-gated action**：高敏感动作（动 prod、发客户消息、改支付逻辑、删数据）按 tier 门槛强制 human-in-loop。
- **Trust 可视化**：@一个 agent 时，UI 显示它的 tier、它**不该**碰什么、它最近的决策审计。用户一眼知道"这个能放手用 / 这个要盯着"。
- **分级自治叙事**：Flot 的范式词之一可以是 **"Responsible Autonomy"**——对抗 Raft "throw them into the work"的过度放手哲学。

**为什么超越**：Raft 没有信任边界，在 critical path 上是危险的。Flot 把"该信多少"做成一等工程——这是企业敢用的前提，也是对 Raft 拟人哲学的**安全补丁**。

## 战略 6：AX 开放协议（vs Raft AX 私有学科）→ 对应 [03] gap 8

**主张**：把 Raft 私有的 AX（inbox / held draft / perception empathy / action explicitness）做成**开放协议**，让第三方 vertical agent 接入：

- **AX primitives as protocol**：inbox、held draft、presence、option-space surfacing 都是公开协议，任何 agent runtime（甚至 Letta、LangGraph 跑的 agent）都能接入 Flot 的协作层。
- **Option-space injection**：Raft 的四条 held-draft 路径是平台硬编码；Flot 允许 vertical agent **注入自己的 option-space 与感知 hook**（一个 SWE agent 注入"跑测试 / 跳过测试 / 回滚"选项；一个设计 agent 注入"换布局 / 换配色"选项）。
- **AX SDK + 参考实现**：开源 AX SDK，让第三方按协议实现感知/行动 hook。Flot 做**协议拥有者**而非私有学科拥有者。

**为什么超越**：Raft 的 AX 是叙事资产也是工程债——只有它一家定义。Flot 把 AX 协议化 = 既是**生态护城河**（第三方 agent 都接 Flot），又是**叙事升级**（从"我们有一门学科"到"我们定义行业标准"）。协议拥有者 > 产品拥有者。

## 战略 7：协作层通用 + 垂直深度 agent 可插拔（vs Raft 横向通用、垂直不深）→ 对应 [03] gap 7

**主张**：Flot 不自己写所有 vertical agent，而是做**协作层 + AX 协议**，让深度 vertical agent 可插拔：

- **SWE slot**：可接 Devin / OpenHands / SWE-agent / Cursor 类作为 Flot 的 SWE vertical——它们获得 Flot 的多 agent 协作 + 记忆治理 + 信任分级，Flot 获得它们的 SWE 深度。
- **数据 / 设计 / 运营 slot**：同理，每个垂直有可插拔深度 agent。
- **Flot 自研"协作 meta-agent"**：Flot 自己只深度做一类 agent——**协调其他 agent 的 meta-agent**（路由、拆解、合并、冲突裁决）。这是 Raft 完全没有的层。

**为什么超越**：Raft 横向通用但每个垂直浅；Flot 横向协作层通用 + 每个 vertical 借力生态里最深的 agent。**不和 Devin 卷 SWE，让 Devin 来 Flot 里当 SWE vertical**——这是生态打法，不是正面竞争。

## 战略 8：能力边界 + 学习血缘 + 决策 provenance（vs Raft 有机黑箱团队）→ 对应 [03] gap 5

**主张**：给"有机团队"配上**可治理的边界与血缘**：

- **Capability boundary**：每个 agent 有显式"能做 / 不能做 / 需审批"边界，认领任务受边界约束，越权自动转 human。
- **Learning lineage**：agent A 从 agent B 学到的每条知识有血缘记录（源自 B、源自某次观察）。可审计"这个错误知识从哪传染来"。
- **Learning immunization**：可设策略——某 agent 不可向某 agent 学习某类信息（隔离坏习惯/敏感信息）。
- **Decision provenance**：每个决策有 agent-level provenance——"由哪个 agent、基于哪条记忆/哪次观察、在什么 tier 下做出"。满足审计。

**为什么超越**：Raft 的有机团队不可审计。Flot 让"有机"和"可治理"共存——企业能买。

## 战略 9：Enterprise-grade 首发（vs Raft "Coming soon"）→ 对应 [03] gap 6

**主张**：Flot **首发就带** Raft 还没交付的企业能力：

- SSO/SAML、SCIM、RBAC、数据驻留选择、SOC2/ISO27001、私钥自管、审计日志导出、agent 行为合规策略。
- **Agent 行为 SLA / kill switch**：企业可设全局策略（某类动作全停），一键冻结所有 agent。
- **Air-gapped 私有部署**：比 Raft 自托管 daemon 更进一步，支持完全离线部署。

**为什么超越**：Raft 的 Enterprise 是 "Coming soon"——它当前不在企业采购桌上。Flot 首发 enterprise-ready，直接吃下金融/医疗/政府盘子，这是 Raft 短期够不到的。

## 战略 10：定价与生态占位（vs Raft 0.1 席）

**主张**：保留 Raft "agent 席位便宜"的精神，但加两层：

- **协作层 per-seat + vertical agent 按用量**：人在协作层按 seat，vertical agent（如 Devin 接入的 SWE slot）按其自身用量计费——Flot 是**聚合计费层**，用户一张账单用多个 vertical。
- **Memory as priced asset**：可治理记忆是付费差异化——基础记忆免费，记忆 diff/provenance/branch/ACL 是付费档。把 Raft 没变现的"记忆"变成显性付费价值。
- **Protocol ecosystem free**：AX 协议 + SDK 完全免费开源——生态护城河不靠收协议费，靠协作层 seat + memory 治理 + vertical 聚合计费。

---

## 超越战略速查表

| 战略 | 对应 Raft 盲区 | 超越点 | 性质 |
|------|--------------|--------|------|
| 1 工作模型多视图 | gap 1 单一模态 | 统一 Work Graph + 多 view | 界面 |
| 2 原生并发原语 | gap 2 协调未解 | lock/CAS/watch/presence + 事件流 | 工程 |
| 3 记忆可检视治理 | gap 3 记忆黑箱 | browser/diff/provenance/branch/forget/ACL | 工程+企业 |
| 4 能力寻址+反硬化 | gap 4 名字硬化 | @capability + 可演进画像 + anti-lock | 架构 |
| 5 分级自治+信任可视化 | gap 9 过度拟人 | trust tier + gated action + 可视化 | 工程+安全 |
| 6 AX 开放协议 | gap 8 AX 私有 | 协议化 + option-space 注入 + SDK | 生态+叙事 |
| 7 协作层+垂直可插拔 | gap 7 垂直不深 | 通用协作层 + 深度 vertical 接入 + meta-agent | 生态 |
| 8 边界+血缘+provenance | gap 5 有机黑箱 | capability boundary + learning lineage + provenance | 治理 |
| 9 Enterprise 首发 | gap 6 企业缺失 | SSO/RBAC/驻留/合规/air-gap/kill-switch | 企业 |
| 10 定价与生态占位 | — | 协作层 seat + memory 付费 + 协议免费 | 商业 |

---

## 落地优先级建议（MVP → 完整）

**Phase 0（占叙事 + 打 adoption，对标 Raft 核心）**
- 聊天 view + named agent + 持久身份 + 拉式 inbox + held draft——**先追平 Raft 的 [02] 成功因素 1-4**，不输底座体验。
- 定范式词（"Shared Mind / Responsible Autonomy"）。

**Phase 1（做 Raft 没做的工程差异化）**
- 记忆可检视（战略 3）+ 分级自治（战略 5）——这两条是企业敢用的最低门槛，且 Raft 完全空白。
- 原生并发原语（战略 2）——把"协调未解"从 Raft 的软肋变成 Flot 的硬卖点。

**Phase 2（生态化，拉开身位）**
- AX 开放协议 + SDK（战略 6）+ 第一个可插拔 vertical（SWE，战略 7）——从产品升级为协议/生态。
- 能力寻址 + 反硬化（战略 4）——路由体验超过 Raft 的 @名字。

**Phase 3（吃企业盘子）**
- Enterprise 全家桶（战略 9）+ 学习血缘/provenance（战略 8）+ 多视图全开（战略 1）。

---

## 一句话战略

> **超越 Raft = 在它已验证的蓝海格（多 agent + 人 + 成品容器）里，把它的每个 trade-off 反过来选（多视图 / 并发原语 / 可治理记忆 / 能力寻址 / 分级自治 / 协议化 AX / 可插拔垂直），并首发企业级治理。Raft 押注"聊天够用、有机够好、放手信任"；Flot 押注"多视图、可治理协调、分级自治、协议生态"——同一个赛道，更深的一层。**
