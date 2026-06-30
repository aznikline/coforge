# 11 · coforge PoC 技术 Spec

> **Status**: The project is now named **coforge** (working codename was `slock`). This spec was written before implementation; the actual build diverged — Letta/LibreChat were dropped (billing wall + large改造 surface) in favor of a self-contained memory layer in SQLite, an OpenAI-compatible LLM call (bring-your-own-key), and a minimal React frontend. See the root `README.md` for the real, current state. The text below is kept as a design record.

> **范围**：最小可验证 PoC。单人 + 多 agent 场景。验证"Claude Code 直接做"能否跑通 Raft 的核心体验。
> **目标**：能 demo，不追求 C3 正确性。
> **周期**：2-5 天连续驱动。
> **栈**：LibreChat fork（C1 外壳）+ Letta（C2 持久记忆）+ 自研轻量路由层（补 LibreChat 没有的多 agent 频道内路由）。

---

## 1. 目标与边界

### 1.1 要验证的假设

| # | 假设 | 验证方式 |
|---|------|---------|
| H1 | LibreChat fork 能改成"多 named agent 在同一频道长期协作" | 一个频道里 @Noel 和 @Pat 都能被路由、各自回复 |
| H2 | Letta 能作为记忆后端，agent 跨会话保留记忆 | 关掉重开，agent 还记得上次对话 |
| H3 | Claude Code 直接做这个 PoC 在 2-5 天内能跑通 | 实际做出来 |
| H4 | named agent + 持久记忆的组合体验接近 Raft 底座 | demo 时主观对比 |

### 1.2 PoC 做（IN-SCOPE）

- C1：共享频道外壳（单频道 + @mention 路由到具名 agent）
- C2：agent 持久记忆（接 Letta，跨会话存活）
- C4：本地自托管（Docker Compose 一键起）
- 轻量路由层：@Noel → 路由到对应 Letta agent
- 2-3 个 demo agent（如"前端""后端""文档"）

### 1.3 PoC 不做（OUT-OF-SCOPE，诚实标注）

- ❌ C3 真正的并发协调（锁/CAS/事件流/presence）——用"串行处理 + 单 agent 轮转"绕开
- ❌ held draft 新鲜度协议
- ❌ 多视图（board/graph/diff/timeline）——只有 chat
- ❌ 多人协作——单人 + 多 agent
- ❌ 企业能力（SSO/RBAC/审计）
- ❌ daemon 跑用户硬件的 agent 执行——PoC 用容器内执行即可
- ❌ 跨 agent 学习、能力寻址、记忆可检视
- ❌ 计费、marketplace、onboarding 流程

**后果告知**：PoC 的多 agent 协调是"伪协作"——同一时刻只有一个 agent 响应，靠人 @ 切换。这不能替代 Raft 的 C3 体验，**只验证 C1+C2+C4 能跑通**。

## 2. 架构

### 2.1 组件图

```
┌─────────────────────────────────────────────────┐
│  浏览器  (LibreChat 前端, fork)                  │
│  - 单频道视图 + @mention 输入                    │
└──────────────────┬──────────────────────────────┘
                   │ OpenAI-compatible API
                   ▼
┌─────────────────────────────────────────────────┐
│  slock-router (自研轻量路由层, Node)             │
│  - 解析 @mention → agent_id                      │
│  - 单 agent 轮转（无并发）                       │
│  - 维护 channel → agents 映射                   │
└──────┬───────────────────────┬──────────────────┘
       │                         │
       ▼                         ▼
┌──────────────┐         ┌──────────────────────┐
│ LibreChat    │         │ Letta server (Docker)│
│ api-server   │         │ - agent CRUD         │
│ (MongoDB)    │         │ - memory_blocks      │
│ - 消息存储    │         │ - archival memory    │
│ - 频道/会话   │         │ - 持久身份           │
└──────────────┘         └──────────────────────┘
```

### 2.2 数据流（@Noel 帮我看看这个 PR）

1. 用户在频道输入 `@Noel 帮我看看这个 PR`
2. LibreChat 前端发消息到 slock-router
3. slock-router 解析 `@Noel` → 查 `agent_registry` 得 `letta_agent_id = "noel-xxx"`
4. slock-router 调 Letta `/api/resources/agents/{id}/messages` 发消息
5. Letta 用 Noel 的 memory_blocks + archival memory 组织上下文，调 LLM，返回
6. slock-router 把回复写回 LibreChat 频道（署名 Noel）
7. Letta 同时更新 Noel 的记忆（若配置了自编辑）

### 2.3 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端 | fork LibreChat 而非自造 | [06] 确认它有成熟 chat UI + MongoDB 持久化 + @mention，省 ~80% C1 工作量 |
| 记忆后端 | Letta 而非自造 | [06] 确认它有 memory_blocks + archival + 持久身份，完美覆盖 C2 |
| 路由层 | 自研薄 Node 服务 | LibreChat 是"单 agent 选中"模型，没有"@mention 路由到不同 agent 各自响应"——这是必须补的 gap |
| 协调 | 串行单 agent 轮转 | 绕开 C3 正确性，PoC 不需要并发 |
| agent 执行 | Letta 内置（调 LLM API） | 不自造 daemon，PoC 用容器内执行 |
| LLM | 用户自带 key（BYOK） | 避免我承担 token 费，也符合 [09] 风险提醒 |

## 3. 模块拆解与任务

### M1 · LibreChat fork + 频道化改造
- [ ] fork LibreChat，本地 Docker 起得来
- [ ] 确认 @mention 选 agent 能用（原生能力）
- [ ] 改造：单频道视图，频道内可 @ 多个 agent（原生是单 agent 切换）
- [ ] 消息署名显示 agent 名字 + 头像
- **风险**：LibreChat 的 @mention 是"选中一个 agent"，不是"频道内路由"。改造量取决于能否 hook 进它的消息发送链路。**若改造超 2 天，降级为"顶部 dropdown 选 agent + 署名显示"**，PoC 仍能验证 C2。

### M2 · Letta 接入 + 持久记忆
- [ ] Letta Docker 起来
- [ ] 用 Letta SDK 创建 2-3 个 agent（Noel=前端、Pat=后端、Sam=文档），各设 persona memory_block
- [ ] 验证：给 Noel 发消息，关掉重开，Noel 还记得
- [ ] 验证 archival memory：让 Noel 记住一个长文档，后续能 recall

### M3 · slock-router 轻量路由层
- [ ] Node 服务，OpenAI-compatible 接口收消息
- [ ] `agent_registry`：agent_name → letta_agent_id 映射（存配置文件或 SQLite）
- [ ] @mention 解析器（正则 + agent 名字列表）
- [ ] 调 Letta API 转发 + 回复写回
- [ ] 串行队列（同一频道同时多条消息时排队，不并发）

### M4 · 端到端 demo 脚本
- [ ] docker-compose 一键起（LibreChat + MongoDB + Letta + slock-router）
- [ ] demo 脚本：
  1. 在频道 @Noel："我是 wizout，在做 slock 项目"
  2. 关掉浏览器重开
  3. @Noel："我叫什么？" → 应答 "wizout"（验证 H2 持久记忆）
  4. @Pat："帮我看个后端问题" → Pat 以后端 persona 响应（验证 H1 多 agent 路由）
- [ ] 录屏 + 截图存档

### M5 · 文档
- [ ] README：怎么起、怎么配 agent、怎么 demo
- [ ] 已知限制清单（明确写"无 C3 协调、伪协作、单人"）

## 4. 技术栈与依赖

| 组件 | 版本/选型 | license |
|------|----------|---------|
| LibreChat | 最新 stable | MIT |
| Letta | 最新 stable | Apache-2.0 |
| MongoDB | 7.x（LibreChat 依赖） | SSPL（注意：仅作为 LibreChat 依赖，不直接分发） |
| slock-router | Node 20 + Fastify | 自研 MIT |
| SQLite | router 的 agent_registry | 公有领域 |
| Docker Compose | v2 | — |
| LLM | 用户 BYOK（OpenAI/Anthropic 兼容） | — |

**license 审计**：LibreChat(MIT) + Letta(Apache-2.0) 都可商用。MongoDB SSPL 只在容器内跑，不分发，无传染风险。**避开 AutoGPT Platform 的 Polyform Shield**（[06] 已警告）。

## 5. 验收标准

PoC 完成 = 全部满足：

- [ ] `docker compose up` 一键起，无手动步骤
- [ ] 浏览器能看到单频道 chat 界面
- [ ] @Noel 能路由到 Noel agent 并回复
- [ ] @Pat 能路由到 Pat agent 并回复（不同 persona）
- [ ] 关浏览器重开，agent 记得上次对话（H2）
- [ ] demo 脚本 4 步全通过
- [ ] README + 已知限制文档完成

**不验收**（诚实）：C3 协调、多 agent 同时响应、held draft、多人、企业能力。

## 6. 风险与降级方案

| 风险 | 概率 | 降级方案 |
|------|------|---------|
| LibreChat @mention 改造比预期难 | 中 | 降级为 dropdown 选 agent + 署名，仍验证 C2 |
| Letta SDK 接入有坑 | 低 | 退而用 Letta REST API 直调 |
| agent 记忆跨会话不生效 | 低 | 排查 memory_block 配置；最差手动持久化对话历史 |
| Claude Code 单会话做不完 | 中 | 分会话推进，靠 memory + 本 spec 续上下文 |
| LLM key/成本 | 低 | BYOK，用户承担；PoC 用便宜模型（Haiku/mini） |

## 7. 时间估算（Claude Code 直接做）

| 任务 | 我的工时 | 你的参与 |
|------|---------|---------|
| M1 LibreChat fork + 改造 | 8-15h | 验收 |
| M2 Letta 接入 + 验证记忆 | 4-8h | 提供 LLM key |
| M3 slock-router | 6-10h | 验收 |
| M4 端到端 + demo 脚本 | 4-6h | 看 demo |
| M5 文档 | 2-3h | — |
| 调试缓冲 | 6-10h | 反馈 |
| **合计** | **30-52h** | **~3-6h** |

→ 连续驱动 **2-4 天**可完成；间歇 **5-10 天**。token 费估 **$200-500**。

## 8. 成功标准与后续

**PoC 成功** = H1-H3 全部验证（H4 主观）。

**PoC 成功后的决策点**：
- 若跑通 → 进 [09] 可用平替版（加轻量 C3 + 产品化 + 多 vertical）
- 若 LibreChat 改造太难 → 评估换 OpenHands Agent Canvas 做外壳，或自造最小 chat 前端
- 若 C2 体验远不如 Raft → 重新评估记忆后端（试 LangGraph checkpoint）

**PoC 失败的诚实出口**：若 2 天内 M1 改造卡死且降级方案也不可接受，说明"复用 LibreChat 做 C1 外壳"假设不成立，需回到 [06] 重选底座。这本身是有价值的负面结论。

---

## 一句话

> PoC = fork LibreChat（C1）+ 接 Letta（C2）+ 自研 slock-router（补多 agent 路由）+ Docker 起来（C4），单人+多 agent，串行绕开 C3，2-4 天 / 30-52 工时 / $200-500 token 验证"我直接做"跑不跑得通。验收只看 C1+C2+C4，C3 诚实标为不做。
