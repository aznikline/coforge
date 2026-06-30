# 12 · coforge PoC 实现计划

> **Status**: 项目已定名 **coforge**(开发初期代号 slock)。本计划为实现前所写,实际执行有调整:放弃 Letta/LibreChat/Docker(OrbStack 损坏 + Letta 计费墙),改用自研记忆层 + 百炼 GLM-5.1。当前真实状态见根目录 README。以下原文保留作计划记录。

> 基于 [11 PoC Spec] + 调研确认的技术选型。前端改为**自造最小 React**（不 fork LibreChat，避免消息链路改造不可控）。这是 plan，审批后执行。

---

## 0. 调研确认的关键事实

| 事实 | 来源 | 影响 |
|------|------|------|
| Letta 自托管默认端口 **8283**，REST 在 `/v1` | docs.letta.com/guides/docker | router 连 `http://letta:8283` |
| Letta Docker 镜像 `letta/letta:latest`，挂 PG volume，传 `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` | 同上 | compose 配置 |
| TS SDK `@letta-ai/letta-client`，`new Letta({ baseURL })` | docs.letta.com/api-overview/client-sdks | router 用 TS SDK |
| 创建 agent：`client.agents.create({ model, embedding, memoryBlocks })` | 同上 | 初始化脚本 |
| 发消息：`client.agents.messages.create(agentId, { input })` | 同上 | router 核心 |
| 读记忆：`client.agents.blocks.list(agentId)` | 同上 | 记忆验证 |
| **创建 agent 必须指定 embedding** | 同上 | 初始化脚本要带 embedding |
| LibreChat 消息链路是 MongoDB + 复杂 service 层 | github 结构调研 | **放弃 fork，自造前端** |

## 1. 最终架构（自造前端版）

```
┌──────────────────────────────────────────┐
│  浏览器  (自造最小 React, Vite)           │
│  - 单频道 chat 视图                       │
│  - @mention 输入框                        │
│  - 消息按 agent 署名+颜色显示             │
└──────────────────┬───────────────────────┘
                   │  POST /api/chat  { text }
                   ▼
┌──────────────────────────────────────────┐
│  slock-router  (Node 20 + Fastify)       │
│  - 解析 @mention → agent_name            │
│  - agent_registry: name→letta_agent_id   │
│  - 串行队列（同频道排队，不并发）         │
│  - 调 Letta TS SDK 发消息                │
│  - 持久化消息到 SQLite（频道历史）        │
└──────────────────┬───────────────────────┘
                   │  Letta SDK
                   ▼
┌──────────────────────────────────────────┐
│  Letta server  (letta/letta:latest)      │
│  - Noel/Pat/Sam 三个持久 agent           │
│  - memory_blocks (human/persona)         │
│  - archival memory                       │
│  - 内置 Postgres                         │
└──────────────────────────────────────────┘
```

**关键简化**（vs spec 原版）：
- 不用 LibreChat/MongoDB → 自造前端 + SQLite 存频道历史。少一个组件，改造可控。
- 这牺牲了 LibreChat 的成熟 UI，但 PoC 只验证 C1（能 @ 路由）+C2（持久记忆）+C4（自托管），粗糙 UI 不影响验证。

## 2. 文件结构

```
slock/
├── docker-compose.yml          # 起 router + letta + 前端
├── .env.example                # OPENAI_API_KEY / ANTHROPIC_API_KEY
├── README.md                   # 怎么起、怎么 demo
├── router/                     # slock-router
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts           # Fastify 服务 + /api/chat + /api/messages
│   │   ├── letta.ts            # Letta SDK 封装（发消息、读记忆）
│   │   ├── router.ts           # @mention 解析 + agent_registry
│   │   ├── store.ts            # SQLite 频道历史持久化
│   │   ├── queue.ts            # 串行队列（绕开 C3）
│   │   └── types.ts
│   └── Dockerfile
├── web/                        # 自造最小前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx             # chat 视图
│       ├── api.ts              # 调 router
│       └── style.css
├── scripts/
│   └── seed-agents.ts          # 创建 Noel/Pat/Sam 三个 Letta agent
└── docs/                       # 已有分析文档
```

## 3. 任务拆解与执行顺序

### Step 1 · 项目骨架 + compose（先起 Letta）
- [ ] `docker-compose.yml`：letta 服务（端口 8283，挂 volume，传 API key）
- [ ] `.env.example`
- [ ] `docker compose up letta` 验证 Letta 起来
- [ ] `curl http://localhost:8283/v1/health` 验证

### Step 2 · seed-agents 脚本（验证 C2）
- [ ] `scripts/seed-agents.ts`：用 Letta TS SDK 创建 Noel（前端 persona）、Pat（后端）、Sam（文档）
- [ ] 每个 agent 带 `memoryBlocks`（human: "用户是 wizout"，persona: 各自角色）
- [ ] **必须带 embedding**（`openai/text-embedding-3-small`）
- [ ] 打印三个 agent_id，存到 `router/agents.json`
- [ ] 验证：手动给 Noel 发消息，确认能回

### Step 3 · slock-router 核心（验证路由）
- [ ] `router/src/letta.ts`：封装 `client.agents.messages.create` + `blocks.list`
- [ ] `router/src/router.ts`：@mention 正则解析 + agent_registry（读 agents.json）
- [ ] `router/src/queue.ts`：串行 Promise 队列
- [ ] `router/src/store.ts`：SQLite 存消息（agent_name, text, ts）
- [ ] `router/src/server.ts`：Fastify，`POST /api/chat`（收消息→路由→调 Letta→存→返回回复），`GET /api/messages`（频道历史）
- [ ] 验证：curl 发 `@Noel 你好`，收到 Noel 署名回复

### Step 4 · 最小前端（验证 C1）
- [ ] `web/`：Vite + React，单频道 chat 界面
- [ ] 输入框支持 `@Noel/@Pat/@Sam`（带简单自动补全）
- [ ] 消息列表按 agent 署名 + 颜色区分
- [ ] 调 `POST /api/chat` + `GET /api/messages`
- [ ] 验证：浏览器里 @Noel 问问题，看到 Noel 回复

### Step 5 · 端到端 demo + 持久记忆验证（验证 H1/H2）
- [ ] demo 脚本：
  1. `@Noel 我是 wizout，在做 slock 项目`
  2. 关浏览器重开，`@Noel 我叫什么？` → 应答 wizout（**验证 C2 跨会话记忆**）
  3. `@Pat 帮我看个后端问题` → Pat 后端 persona 响应（**验证 C1 多 agent 路由**）
  4. `@Sam 写个 README` → Sam 文档 persona 响应
- [ ] 关掉 router 重起，Noel 仍记得（因为记忆在 Letta，不在 router）

### Step 6 · 文档 + 已知限制
- [ ] `README.md`：一键起、配 agent、demo 步骤
- [ ] 已知限制清单（无 C3、伪协作串行、单人、UI 粗糙）

## 4. 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端 | 自造最小 React（不 fork LibreChat） | 调研发现 LibreChat 消息链路改造不可控；自造 2-4 天确定 |
| 频道历史 | SQLite（不用 MongoDB） | 少一个组件，PoC 够用 |
| 记忆 | Letta（TS SDK） | 完美覆盖 C2，调研确认 API |
| 路由 | 自研 @mention 解析 + agent_registry | LibreChat 无此能力，必须自建 |
| 协调 | 串行 Promise 队列 | 绕开 C3 正确性 |
| LLM | Letta 内置调（用户传 OPENAI/ANTHROPIC key） | BYOK，不承担 token 费 |
| router 语言 | TypeScript（与 Letta TS SDK 一致） | 类型安全，SDK 原生 |

## 5. 降级方案

| 风险 | 降级 |
|------|------|
| Letta agent 创建失败 | 退而用 REST 直调 `/v1/agents`，不用 SDK |
| @mention 解析边界 case 多 | 限定格式 `@Name `（名字后必须空格或行尾），简化正则 |
| 前端做不完 | 降级为 curl 脚本 demo，仍验证 C2+C3 路由 |
| Letta 跨会话记忆不生效 | 排查 memoryBlocks 配置；最差 router 自己存对话历史兜底 |

## 6. 验收标准（与 spec 一致）

- [ ] `docker compose up` 一键起
- [ ] 浏览器单频道 chat 能用
- [ ] @Noel/@Pat/@Sam 各自路由响应（不同 persona）
- [ ] 关浏览器重开，agent 记得上次（C2）
- [ ] demo 脚本 4 步通过
- [ ] README + 已知限制完成

## 7. 资源

- 工时：~30-50h（Step 1-2: 6-10h, Step 3: 8-12h, Step 4: 8-12h, Step 5-6: 6-10h, 调试: 6-10h）
- 你的参与：提供 OPENAI/ANTHROPIC API key，验收 demo
- token 费：$200-500
- 连续驱动 2-4 天

## 8. 执行注意

- **先起 Letta + seed agent 验证 C2**，这是最核心假设，先证伪
- 每步验证通过再下一步，不堆代码
- Bash 分类器之前暂不可用——若执行时仍不可用，我会用只读工具 + 告知你需要手动跑的命令
- 代码风格遵循项目 CLAUDE.md 的 web/common 规则（小文件、不可变、语义 HTML、CSS 变量）
