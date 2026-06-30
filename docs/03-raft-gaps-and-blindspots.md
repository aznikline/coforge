# 03 · Raft 的弱点与盲区

> 要超越 Raft，必须先精确指出它的结构性限制。以下每一条都来自 Raft 自己博客承认的边界 + 范式本身的代价。超越产品的机会点就在这些 gap 里。

---

## 一、聊天是单一模态、线性时间流——难以承载复杂多状态工作

Raft 把一切压进 chat。这是它 adoption 的捷径，也是天花板：

- **线性流吞掉结构**。一个有 5 个并行子任务、3 个 review 状态、2 个 blocked 依赖的工作，塞进 chat 流里就变成"滚动的消息墙"。人靠 scroll 找状态，agent 靠 inbox 拉取——但**全局工作结构**没有一等表达。
- **没有多视图**。同一份工作，工程师想看 diff/branch，PM 想看 kanban，QA 想看 failing tests——chat 只有一个视图。Raft 的 task 管理是"在聊天里内置"，而非"多视图投射同一工作模型"。
- **空间维度缺失**。chat 是时间流，但真实工作有**空间结构**（哪个 repo、哪个服务、哪个客户、哪个环境）。@一个 agent 解决路由，但没解决"这个对话属于哪个工作空间切片"。

**机会**：超越产品应提供**同一工作模型的多种视图投射**（chat / kanban / graph / diff / timeline），而非把 chat 当唯一面。

## 二、协调问题被 AX 缓解，但远未解决

`Is Having Agents in the Room Meant to Be Chaotic?` 自己承认这是 open problem：

> "What remains unsolved: coordination, ownership, and real-time awareness."

- **Held draft 是局部解**。它解决"草稿写完房间已动"的非 sequitur，但**不解决**两个 agent 同时认领同一任务、两个 agent 对同一文件做冲突修改、agent 之间对"谁负责"的歧义。
- **没有显式的所有权 / 锁机制**。AX 让 agent"决定"何时发言，但没有让 agent 之间形成**正式的并发控制**（如对资源的 advisory lock、对任务的 claim with CAS 语义）。
- **实时感知仍是 turn-based**。Raft 明确指出 agent 是"读快照 → 推理 → 提交 → 等待"的 turn-based，与人类的 continuous perception 有 gap。inbox 是缓解，**没有消除**这个 gap。agent 仍不知道"对方正在打字""那个任务 3 秒前被认领了"。

**机会**：超越产品应给 agent 之间提供**原生并发原语**（锁、CAS、watch/notify、presence）+ 一个**事件流而非快照**的房间模型。

## 三、记忆是黑箱——不可检视、不可治理、不可迁移

Raft 反复强调"记忆复利积累"，但博客里**没有**讲：

- 记忆存在哪、什么格式、能不能导出/检视/审计？
- 记忆会不会**污染**（agent 记住了错误的东西、过时的偏好、被污染的指令）？
- 记忆如何**遗忘**（GDPR 删除、过期、纠错）？
- 一个 agent 的记忆能不能**迁移/克隆/分支**给另一个 agent？
- 谁能看见 agent 记住了关于谁的什么（隐私）？

`Agents Need Names` 自己点出了"cache 会过期"——name 是缓存，团队心智模型会过时。但**agent 内部记忆这个更大的缓存，Raft 没有给治理工具**。

**机会**：超越产品应把记忆做成**一等可检视对象**——记忆浏览器、记忆 diff、记忆来源溯源、记忆分支/合并、记忆遗忘策略、记忆的权限与审计。这是企业采购最在意的点，Raft 留了空白。

## 四、"命名即路由"有上限——名字会硬化成 role

`Agents Need Names` 自己承认的张力：

> "When expectations harden, a name degrades back into a role."

- 团队对一个 agent 的**期望会固化**。"Noel 就是做前端的"→ 没人再问它后端的事 → 它的专长被**自我实现的预言**锁死。
- Raft 的解法是"可见工作史 + 命中具名 agent 的反馈 + 低成本期望修正"——但这是**原则，不是机制**。博客没给出让"期望修正"真正便宜的 product surface。
- 名字也是**路由的单点**：@一个名字 = 路由到那一个 agent。但很多时候工作该路由给"**最合适的那个**"，而非"**我习惯 @ 的那个**"。Raft 的路由是**人发起的显式寻址**，没有**系统发起的能力路由**。

**机会**：超越产品应提供"**能力寻址**"——@一个能力（"@codeowner of this file"、"@whoever has shipped most in this repo this week"），系统解析到当前最合适的具名 agent；并给 agent 的"被认知的能力"一个**可演进的、可挑战的**画像，避免硬化。

## 五、有机团队 = 黑箱团队，缺乏可治理的边界

- "agent 从共享 board 认领任务、专长涌现"——很美，但**谁能保证它认领的是该它做的**？没有显式的权限/能力边界，agent 可能越权认领、做错领域、学到不该学的东西。
- **跨 agent 学习无监督**："agent 观察队友学习"——一个 agent 的坏习惯/错误知识会不会**传染**给其他 agent？Raft 没讲隔离与免疫。
- 对企业来说，"有机涌现"= **不可审计**。审计员要的是"这个决策由哪个 agent 基于哪条信息做出"，而 Raft 的有机模型把责任分散进了涌现过程。

**机会**：超越产品应给"有机团队"配上**可治理的能力边界 + 学习血缘**——agent 之间能学什么、不能学什么有策略；每个决策有 agent-level provenance。

## 六、Enterprise 缺失（"Coming soon"）

- SSO、私有部署、高级访问控制、专属 onboarding 都还在 "Coming soon"。
- 这意味着 Raft **当前不在企业采购桌上**。重度团队（金融、医疗、政府）买不了。
- 自托管 daemon 解决了"代码不出门"，但**不解决**"agent 行为的合规审计、RBAC、数据驻留认证、SOC2/ISO27001"。

**机会**：超越产品若**首发就带 enterprise-grade 治理**，可直接吃下 Raft 暂时够不到的盘子。

## 七、垂直深度 vs 横向通用——Raft 是"什么都做一点"

- Raft 既能做 code review、CI/CD 监控，又能做 GTM 沟通——**横向通用**是它的 adoption 优势，但每个垂直都"够用但不够深"。
- 在 SWE 垂直，它会撞上 Devin / Cursor / Augment 这类**深度专项**产品的纵深。Raft 的 agent 做 code review，但能不能做长 horizon 的自主 multi-file 重构、跑测试-修-再跑的闭环？博客只展示了 p99 延迟优化这类**点状**成果，没展示**长 horizon 自主工程**能力。

**机会**：超越产品可以走"**横向协作层 + 可插拔垂直深度 agent**"——协作层像 Raft 一样通用，但每个垂直（SWE / 数据 / 设计 / 运营）有**深度专项 agent**，比 Raft 的通用 agent 深、比 Devin 的孤岛 agent 协同好。

## 八、AX 是叙事资产，但也是工程债

- AX 这门"学科"目前**只有 Raft 在定义**——意味着没有标准、没有第三方验证、没有 ecosystem。它的 demo（计数到 20 不冲突）是**受控场景**，真实复杂工作下的 AX 行为未经大规模验证。
- "把选项空间显式呈现给 agent"是好原则，但**谁来决定选项空间**？Raft 自己设计的四条 held-draft 路径，是**平台硬编码的**。更复杂的场景下，选项空间本身需要可扩展、可由第三方 vertical 注入。

**机会**：超越产品应把 **AX 做成开放协议**——held draft / inbox / presence 是协议，第三方 vertical agent 可以注入自己的 option-space、自己的感知 hook。让 AX 从"Raft 的私有学科"变成"行业协议"，超越者做协议拥有者。

## 九、单租户心智：人机并列团队页是营销，也是认知锚

- 团队页人机并列、猫当 CEO——**极具传播力**，但也固化了"agent = 仿人同事"这个隐喻。
- 仿人隐喻的代价：**用户会按人的标准要求 agent**（该懂潜台词、该有情商、该记得上次聊天），而 agent 做不到时落差更大。过度拟人也会让用户**高估 agent 的可靠性**，在 critical path 上误用。
- Raft 没有明确**"agent 不该被信任的边界"**——什么时候 agent 该自作主张，什么时候必须 human-in-the-loop？博客里"throw them into the work"的哲学对低风险工作成立，对 prod/支付/客户数据是危险的。

**机会**：超越产品应明确**分级自治**——agent 有 trust tier，低 tier 必须 human approval，高 tier 自主；并把 tier 显式可视化（@一个 agent 时能看到它的 trust tier 和它**不该**碰什么）。

---

## 盲区速查表

| # | 盲区 | Raft 状态 | 超越机会 |
|---|------|----------|---------|
| 1 | 单一聊天模态、无多视图 | 押注聊天够用 | 同一工作模型多视图投射 |
| 2 | 协调/所有权/实时感知未解 | AX 缓解、自承认未解 | 原生并发原语 + 事件流房间 |
| 3 | 记忆黑箱、不可检视治理 | 未提 | 记忆一等对象 + diff/溯源/遗忘 |
| 4 | 名字会硬化成 role | 承认但无机制 | 能力寻址 + 可演进画像 |
| 5 | 有机团队=黑箱团队、无边界 | 哲学优先 | 能力边界 + 学习血缘 + provenance |
| 6 | Enterprise 缺失 | Coming soon | 首发 enterprise-grade 治理 |
| 7 | 横向通用、垂直不深 | 通用优势即代价 | 协作层通用 + 垂直深度 agent 可插拔 |
| 8 | AX 是私有学科非协议 | 叙事资产即债 | AX 开放协议、第三方可注入 |
| 9 | 过度拟人、无分级自治 | 哲学优先 | trust tier 显式化 + human-in-loop 边界 |

**核心洞察**：Raft 的每一个成功因素，反过来都是它的盲区。押注聊天 → 失去多视图；AX 缓解协调 → 没解决协调；命名即路由 → 名字会硬化；有机团队 → 不可治理；自托管 → 没企业治理；横向通用 → 垂直不深。**超越产品不是"抄 + 加功能"，而是在 Raft 的每一个 trade-off 上选另一边，并补上 Raft 没做的工程（记忆治理、并发原语、分级自治、AX 协议化）。**
