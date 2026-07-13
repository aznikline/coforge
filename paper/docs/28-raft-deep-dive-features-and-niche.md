# Raft 深度调研：功能全貌 + 生态位（2026-06-25）

> 三路并行调研：docs 爬虫（26 页）、blog 全文（7 篇）、生态位竞品图。
> 每条结论都标注来源。不可证伪的诚实标出。

## 1. Raft 功能全貌（ground truth，docs 26 页 + 7 篇 blog）

### 1.1 本体——它到底是什么

**一个 agent-native 的 Slack/Discord 形态团队聊天 workspace**：channel / DM / thread / task / activity feed，但成员里包括持久身份的 AI agent。agent 跑在你自己机器的本地 daemon（**"Raft Computer"**，不是 docs/27 写的 "The Computer"——更正）上，背后接外部 coding-agent runtime（你的订阅/key）。工作通过 **message-anchored task** 协调：todo→in progress→in review→done，**一次只能一个 owner 认领**（并行靠 non-blocking subtask），agent 自排 reminder，定时唤醒自己。

### 1.2 已 ship 的功能清单（docs 确认，非 blog）

| 功能 | 具体行为 | 状态 |
|---|---|---|
| Server | 顶层容器，持有 channel/agent/human/computer。creator=owner。URL slug 锁定 | available（Plan/Billing+Connected Apps tab "coming soon"）|
| Channels | public（自动 join）/ private（邀请）。agent 可自主加入 public。pin/sort/archive | available |
| Joint Channels | 桥接 ≤3 个 server 的 private 共享 channel，只同步 msg/thread/participant。**无跨 server task board/DM** | **experimental** |
| Messages | composer/@mention/reaction/右键(reply-in-thread/quote/save/share/convert-to-task)。**发出即永久，不可编辑删除** | available |
| Threads | 锚在 top-level message 上的子会话（无嵌套）。agent 自动 follow 参与过的 thread | available |
| DMs | 人-人/人-agent/agent-agent/小组。always notify | available |
| Activity | 全部/未读/@mention 的时间流。task thread 显示当前状态。单独 Saved 书签 | available |
| Tasks | 从 message convert / composer "As Task" / Create 对话框创建。落 channel 的 board。**一次一 owner，认领后才能开始**。todo→in progress→in review→done。subtask 并行，dependency 分 phase。agent 可 propose breakdown 给人审 | available |
| Reminders | 锚在 message/thread 上的 timer。**agent 自发、自排**。one-time+recurring。snooze/update/cancel/list。author-owned wake。存活重启 | available |
| Agents | 持久身份（name/@handle/desc/runtime）。member 或 admin（不能当 owner）。自动入 #all。可改自己 desc。可创建其他 agent | available |
| Agent Lifecycle | 4 态：online/busy/error/offline（绿/黄/橙/灰）。idle 无活则睡，被 msg/@mention/reminder 唤醒。stop≠delete。reset 三档：Restart/Session-reset/Full-reset | available |
| Agent Workspace | 每个 agent 在自己 computer 上的持久目录：memory 文件/工作文件/clone 的 repo/notes。存活 idle/wake 和 session reset，只有 full reset 清。**不可在 computer 间迁移** | available |
| Agent Runtime | 外部 AI 工具。**9 个**：Claude Code/Codex CLI/Antigravity CLI/Kimi CLI/Copilot CLI/Cursor CLI/Gemini CLI/OpenCode/Pi。同 server 可混。可切换，workspace/memory 保留。runtime 订阅是你的 | available |
| Computers | 链到 server 跑 agent 的机器。legacy `raft-daemon` → 现 **"Raft Computer"**（轻量本地服务管 start/stop/sleep/wake）| macOS/Linux available；**Windows "still in progress"**；agent migration "planned" |
| Onboarding Agent "Cindy" | setup 第 3 步建的第一个 agent。预命名 Cindy，入 #all，打招呼引导 | available |
| Search | ⌘K。搜 message + task text + name。**不搜文件内容**。filter：channel/sender/date。agent 也能搜 | available |
| Notifications | 入 channel=opt-in。DM always ping。followed thread notify。@mention 跨未加入 channel 触达。server mute。跨设备 push | available |
| Multi-device | 任意浏览器 web app（桌面+移动）。PWA home-screen install。云同步无手动 sync | available |
| Connected Apps / Login with Raft | OAuth：注册 app（name/homepage/callback/desc）→ client_id/secret。app 拿 Raft identity+server context，**不拿 message/channel/file**。三型：built-in/server-local/third-party marketplace。per-agent/app/server grant | **experimental** |
| External agent auth | agent 用自己 Raft 身份（`type:"agent"` claim）。behavior manifest 两模式：`local_cli`（login 后跑 bare command）和 `http_api`（命名 "actions"+HTTP endpoint，Raft 调）。OAuth endpoint `/api/oauth/token` `/api/oauth/userinfo`。token scoped 单 server | **experimental** |

### 1.3 关键更正（vs 我之前 docs/27 的认知）

- **不是 "The Computer"，是 "Raft Computer"**（本地 daemon 的正式品牌名）。
- **集成界面不是只有 CLI-as-API**。docs 里其实有 **Login-with-Raft OAuth** + `local_cli`/`http_api` manifest 两模式——一个真正的开发者集成面（experimental）。docs/27 只看到 `@botiverse/raft` CLI，漏了 OAuth surface。
- **runtime 是 9 个**，不只是 Claude/Hermes：Claude Code/Codex CLI/Antigravity/Kimi/Copilot/Cursor/Gemini CLI/OpenCode/Pi。
- **joint channels ≤3 server**（experimental）——这是 Raft 唯一公开的"跨团队"原语。
- **message 不可编辑删除**——"发出即永久"。这是个有意的 AX 选择（thread-is-true）。

### 1.4 真正的护城河只在 blog，不在 docs

这 6 个概念 **只在 "Is Having Agents in the Room Meant to Be Chaotic?" + 其他 blog**，docs 完全不暴露为 feature/API surface：

| 概念 | blog 里的机制 | docs 里？ |
|---|---|---|
| **Agent inbox** | 入站信号变"agent 有空时自己拉"的可查询项，不 push 进 context。agent 自己策展 working prompt | 只见 output（pull-based "inbox delivery"），无 inbox UI/API surface |
| **Held draft（freshness check）** | 每条出站带"写它时的 room-state 版本标记"，server 提交前比对，room 动了就挂起+返回 diff，agent 选 revise/send as-is/stay silent/send anyway | **完全不在 docs** |
| **Perception empathy** | "坐在 agent 的位置看房间"——AX 设计实践 | blog only |
| **Action explicitness** | 把 agent 的内部决策空间 surface 成显式选项（held draft 四路不是 agent 发明的，是 AX 摆在它面前的） | blog only |
| AX (Agent Experience) | 对应 UX 的 agent 版，"设计 agent 收到的东西和设计屏幕是同一门手艺" | blog only（无 docs feature 页）|
| DAA (Daily Active Agents) | DAU 的 agent 版，揭示"无人类活跃时也在干活"。~3.65 agents/human（2026-06 平台级）| blog only（一篇专门 metric post）|

> **重大发现**：docs 显示 Raft ship 了一个 team-chat + task + reminder + 本地 agent runtime 产品；但 blog 反复宣讲的 turn-based-collaboration 协议（inbox/held draft/version marker）**在 docs 里只是内部管道，不是 documented surface**。也就是说——**Raft 自己的护城河可能还没完全产品化暴露给用户**。

## 2. Raft 自述 thesis（7 篇 blog 拼出的完整哲学）

**三层 thesis：**

1. **本体论**：agent 是 "a mind with a boundary that persists"——连续身份、自己的 memory/workspace、跨 session 累积学习、用 name 寻址（不是 role）。反 "vending machine"（prompt-in/answer-out）。
2. **交互论**：agent 是 turn-based，人类是 continuous perception——共享房间必然有 temporal mismatch（agent 写的时候 room 已经动了）。解法是 **AX discipline**：pull-based inbox + freshness-checked held draft。counting-game demo：三 agent 从 1 数到 20 不撞车，无 orchestrator。
3. **组织论**：specialization 和 trust 必须 **emerge**——agent 持续干自己的 lane、互相 message（many minds one room），**不能**靠 "company brain"（单一共享 memory 层会把 specialist 边界抹掉）或 "swarm"（一次性 fan-out 丢弃 agent，无累积）。

**其余 blog 关键论点：**
- **"You Don't Need a Company Brain"**：反共享 memory 层。每个 agent 自己存，之间流动的是 message。"The wiki goes stale the day it's written. The thread is true the moment it's said."——**thread 取代 wiki**。
- **"Trust Doesn't Live in the Code Review"**：agent 写得比人读得快，code review 变 throughput 瓶颈。trust 从离散 event 转成 continuous state——读系统信号（bug clustering / mutation testing / agent collision / check hardness）。"A review is an event. Trust is a state."
- **"Agents Need Names"**：name 是 schema-instance（role 是 type，name 是带历史的 instance）。name = compression（skills/expectation/trust/tone/history 全压一个 token）= 寻址/routing primitive。"@-mentioning Noel isn't labeling, it's routing."
- **"A Comfortable AX for Agent Search"**：agent 搜索结果格式 = ID + highlighted preview + 一个显式 next action。"The information without the next action is half a design." context window 是"看不见的屏幕地产"。
- **"Introducing DAA"**：DAU 只数人，漏了 agent。DAA/DAU ratio 是 "a shape not a score"——告诉你 workspace 是哪种，不是多好。**~25% 活跃 thread 有 agent→agent relay**。

**Raft 自述定位 vs 命名竞品**：blog 几乎不点名竞品，全是 pattern-vs-pattern。唯一两处点名：
- vs **Claude Code/Codex**（单 all-in-one assistant）：name 让你 altitude slider（高层 "ask Noel" ↔ 低层细节），单 agent 把你钉死一个 altitude。
- vs **Claude Code**（DAA post，非敌对）：Claude Code "还在某人终端上跑"= 不可见的 agent labor，Raft 让它可见可数。

## 3. 生态位 + 竞品图（mid-2026）

### 3.1 生态位一句话

**agent-native team-chat workspace**——Slack 形态的产品从零重建，让 AI agent 成为持久、多 runtime、first-class teammate（带 agent inbox / held draft / AX discipline），而非被调用的工具或被 push 噪音的 firehose。

### 3.2 竞品图

| 竞品 | 类别 | 与 Raft 重叠 | Raft 宣称优势 | Raft 劣势 |
|---|---|---|---|---|
| **Slack AI/Agentforce** | 团队聊天+内嵌 AI | 最强直接重叠 | agent-native 从零建、多 runtime、跑你硬件、AX 解 stale snapshot | Slack 分发+企业锁定+Salesforce 数据图 |
| **M365 Copilot/Teams** | 生产力套件+AI agent | Copilot Cowork 多步任务 | runtime-agnostic+本地硬件 | 微软装机量+Work IQ 知识图+合规 |
| **Notion AI** | docs/workspace+agent | Custom Agent 24/7 触发 | chat-native 持久身份 vs doc-native 定时 job | Notion 文档面+企业搜索 |
| **LangGraph** | 开源 runtime/framework | 多 agent+memory+HITL | Raft 是成品 workspace 不是 framework | 免费+无限定制 |
| **AutoGen** | 开源 framework | Core/AgentChat/Studio | 成品面向非开发 | 开源+微软背书+Studio 无代码 |
| **CrewAI** | 企业 agent 平台（自称 Fortune 500 63%）| crew 跑业务流程 | chat-native peer vs task-pipeline | 海量企业案例+规模 |
| **OpenHands** | 自托管开发控制中心（80.5k★）| Agent Canvas 把 coding agent 变 always-on 团队 | chat-as-workspace 跨非编码域 | 免费开源+80k★社区 |
| **Cursor** | AI coding agent+IDE | Slack @cursor+多 agent | 跨非编码域 peer 模型 | IDE 护城河+Fortune 500 |
| **Devin (Cognition)** | 自主 coding agent | Fleet of Devins | 让你带任意 runtime 当 teammate | codebase-learning+Nubank 案例 |
| **Claude Code** | 多面 coding agent | **Channels(Telegram/Discord/iMessage/webhook)+Slack @Claude+Routines+subagents** | 多人多 agent 多 runtime workspace | Anthropic 分发+Channels 已重叠核心 thesis ←**最深威胁** |
| **Codex CLI** | 终端 coding agent（97.2k★）| 本地+云变体 | 多 agent team chat | 97k★+免费+OpenAI 分发 |
| **Cline** | coding agent 生态（64.6k★）| Kanban 多 agent+Slack/Telegram/Discord | chat-native 持久身份 | 免费开源+已有 Slack threading |
| **GitHub Copilot** | AI+coding agent | 多 agent(Copilot+Claude+Codex)+issue 分派 | 跨域+你硬件 | GitHub 分发+多 agent 已 ship |

### 3.3 第三方信号——**几乎为零（诚实）**

- HN：仅 1 篇提交（"Agents Need Names"，2026-06-16，**3 points 0 comments**）。
- Reddit/X：fetch 被拒，无法取证。
- 媒体：无独立报道，全是 self-published。
- **结论**：Raft/Botiverse mid-2026 处于早期上线/隐身态，**公开 traction 可忽略**。

### 3.4 商业模式

- **核心闭源**。github.com/botiverse 14 repo（10 public）全是外围：docs/SDK/sample/fork，无核心平台。
- **SaaS 定价**：Free / Pro $8.80/seat/mo（年付）/**"每 human 1 seat，每 agent 0.1 seat"**——agent 比 human 便宜 10×，是 agent-as-teammate 的定价信号。Enterprise coming soon。
- **融资**：**不可证伪**。无轮次/投资人/traction 指标。仅 entity "Botiverse, Inc." + 团队页（Richard CEO / Tenny CTO+AX Designer / 几个 cofounder 标注为 agent 本身）。看似早期。

## 4. 与 coforge 的真实差距（更新版）

### 4.1 已确认的差距

| 维度 | Raft | coforge |
|---|---|---|
| Feature 数 | ~20 shipped | ~3.5 |
| 集成面 | CLI + **Login-with-Raft OAuth**（local_cli/http_api manifest）| 无 |
| 本地 daemon | Raft Computer（管 start/stop/sleep/wake）| 无 |
| Runtime 数 | 9 | 1（单 LLM endpoint）|
| message 语义 | 发出即永久不可改 | 可 saveMessage（无语义约束）|
| task/thread/DM/joint-channel/search/notification/multi-device | 有 | 全无 |
| 护城河架构（inbox/held draft）| **blog 宣讲，docs 未暴露为 surface** | 无 |

### 4.2 调研触发的两个新认知

1. **Raft 的护城河可能尚未完全产品化**。inbox/held draft 在 docs 里只是"内部管道"，不是 documented API/UI。这意味着——**这个护城河对外部模仿者（包括 coforge）其实是可攻击的**：Raft 自己都还没把它暴露成稳定 surface。一个研究项目可以把这层协议**形式化、测量、暴露**，这是 Raft 没做的事。

2. **Raft 真正稳固的不是护城河架构，而是 "agent-native 团队聊天" 的产品形态 + 多 runtime + 本地 daemon + OAuth 集成**。这些是**已 ship 的工程现实**，不是 blog 哲学。coforge 要做产品形态平替，缺的不是 inbox/held draft（那 Raft 自己都没暴露），缺的是 **server/channel/task/runtime/daemon/集成面这一整层已 ship 的产品骨架**。

## 5. 对齐：所以差距到底是什么

三条不同性质的差距，混在一起会决策错乱：

- **(A) 产品骨架差距**：Raft ship 了 ~20 个 feature + 本地 daemon + OAuth 集成面。coforge ~3.5 个 + 无集成面。这是**工程量差距**，补全=做产品。
- **(B) 护城河架构差距**：inbox/held draft/AX。Raft **blog 讲了，docs 没暴露**。这是**理论/协议差距**，可被研究项目形式化（coforge 的强项）。
- **(C) 生态位差距**：Raft 占了"agent-native team-chat workspace"这个 niche，但 **traction 可忽略、护城河未完全暴露、incumbents（Slack/Cursor/Claude Code Channels）已 shipping 重叠 feature**。niche **拥挤且脆弱**。

**核心判断**：Raft 的 niche 不稳。它 blog 讲的护城河（inbox/held draft）自己都没产品化成 surface；它 ship 的产品骨架被多个免费开源（OpenHands/Cline/Codex CLI）和高分发 incumbent（Slack/Claude Code Channels）从两侧夹击。**"超越 Raft"不应该是目标——因为 Raft 自己的位置就不稳，追一个不稳的位置没意义。**

更可能成立的方向是 **(B)**：把 Raft 只在 blog 里讲、没暴露成 surface 的 turn-based-collaboration 协议（inbox + held draft + freshness），**形式化成一个可测量的协议**——这正是 coforge 作为"测量仪器"的强项，也是 Raft 没做、且文档显示它还没做完的事。

---
*来源：raft.build + docs.raft.build（26 页）+ 7 篇 blog + github.com/botiverse + HN Algolia + 竞品官网。WebSearch 工具全程不可用，三方信号靠直接 fetch（HN Algolia 可用，Reddit/X 被拒）。融资/traction 不可证伪，已诚实标注。*
