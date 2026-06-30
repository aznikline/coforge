# coforge — PoC

> **coforge** = co(协作) + forge(锻造)。人机共锻。
>
> Raft 平替的最小 PoC。单人 + 多 agent,验证 C1(频道内 @mention 路由)+ C2(持久记忆)。自研 coforge-router 做路由 + 本地 SQLite 记忆 + 百炼 GLM-5.1 做 LLM,自造最小 React 前端。**零外部 agent 服务依赖**——记忆完全本地化。
>
> 完整分析与设计见 [docs/](docs/)。

## 架构

```
浏览器 (最小 React, Vite)
    ↓ POST /api/chat
coforge-router (Node + Fastify)
    - @mention 解析 → agent
    - 串行队列（绕开 C3）
    - SQLite: 频道历史 + agent 记忆
    ↓ OpenAI 兼容 HTTP
百炼 GLM-5.1 (dashscope)
```

每个 agent = {persona + 持久记忆}。记忆存 SQLite,每次对话把历史拼进 prompt,所以**关掉 router 重起,agent 仍记得**。

## 起来

### 1. 配 .env

```bash
cp .env.example .env
# 编辑 .env 填入 LLM_API_KEY（百炼 key）
```

百炼 key 去 https://bailian.console.aliyun.com/ 拿。

### 2. 装 router 依赖

```bash
cd router
npm install
```

### 3. 起 router

```bash
cd router
npm run dev
# coforge-router ready on :8787
```

agents 配置在项目根的 `agents.json`(Noel=前端 / Pat=后端 / Sam=文档),改 persona 直接编辑重启即可。

### 4. 起前端

另开一个终端:

```bash
cd web
npm install
npm run dev
# 打开 http://localhost:5173
```

## 验证(C2 持久记忆是核心)

在浏览器 http://localhost:5173:

1. `@Noel 我是 wizout,在做 coforge 项目`
2. **关掉浏览器,重开** http://localhost:5173
3. `@Noel 我叫什么?` → 应答 "wizout"(**持久记忆跨会话**,记忆在 SQLite 不在内存)
4. `@Pat 帮我看个后端问题` → Pat 后端 persona 响应(**多 agent 路由**)
5. `@Sam 写个 README` → Sam 文档 persona 响应

也可关掉 router 重起,Noel 仍记得(记忆在 coforge.db)。

## 已知限制(PoC 诚实标注)

- **无 C3 协调**:同一频道同时多条消息排队串行处理,不是真并发。多个 agent 不能同时响应。
- **伪协作**:靠人 @ 切换 agent,不是 agent 间自主协作。
- **单人**:没有多用户、权限、共享频道。
- **UI 粗糙**:最小 chat。
- **记忆简单**:全对话历史拼 prompt(无 summarization / archival 分层),agent 多了或对话长了会涨 token。PoC 够用,生产要加记忆压缩。
- **C4 放弃**:非自托管 daemon(OrbStack 容器环境损坏,见 docs/12)。router 本地跑。
- **无企业能力**:无 SSO/RBAC/审计。

## 项目结构

```
coforge/
├── router/                 # coforge-router (Fastify + SQLite)
│   └── src/
│       ├── server.ts       # /api/chat + /api/messages
│       ├── agents.ts       # @mention 解析 + talkToAgent（拼 persona+记忆）
│       ├── llm.ts          # 百炼 OpenAI 兼容调用
│       ├── memory.ts       # agent 记忆持久化（SQLite）
│       ├── queue.ts        # 串行队列
│       ├── store.ts        # 频道消息历史（SQLite, node:sqlite 内置）
│       ├── config.ts
│       └── types.ts
├── web/                    # 最小 React chat
│   └── src/{App.tsx, api.ts, main.tsx, style.css}
├── agents.json             # Noel/Pat/Sam 配置（persona）
├── .env.example
└── docs/                   # 完整分析
```

## 排错

- **`Missing env var LLM_API_KEY`**:.env 没填 key
- **`LLM call failed (401)`**:百炼 key 无效
- **`LLM call failed (400)`**:model 名不对,确认 .env 的 LLM_MODEL
- **router 端口占用**:改 .env 的 ROUTER_PORT
