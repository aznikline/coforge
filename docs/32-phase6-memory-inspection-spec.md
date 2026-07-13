# 32 · Phase 6: 记忆检视 — 实现级规格

> 对标 docs/03 §3: "记忆是一等可检视对象"。Phase 1 压缩了记忆，Phase 6 让它可读、可搜、可溯源。

## 1. 动机

docs/03 §3 指出 Raft 的记忆是黑箱——不可检视、不可治理、不可迁移。coforge 的 SQLite 记忆天然可检视（就是一张表），但缺少 UI 和 API 让它真正可用。

## 2. 功能

### 2.1 记忆浏览器

```
┌─ Memory: Noel ──────────────────────┐
│ 🔍 [search...]                       │
│                                      │
│ ── Summaries (2) ──                  │
│ 📝 "User is building a qimen app..." │
│    covers msg#1-12 · 85 tokens       │
│ 📝 "Decided to use SQLite..."        │
│    covers msg#13-24 · 62 tokens      │
│                                      │
│ ── Recent (8) ──                     │
│ 💬 user: "@Noel what's my name?"     │
│ 🤖 Noel: "Your name is Zhao Wei"     │
│ ...                                  │
└──────────────────────────────────────┘
```

### 2.2 记忆搜索

```
GET /api/memory/:agent/search?q=zhao
→ [
  { role:"user", content:"my name is Zhao Wei", ts: 1720000000 },
  { role:"assistant", content:"Your name is Zhao Wei", ts: 1720001000 }
]
```

### 2.3 记忆溯源

```
点击一条 agent 回复 → 看到它的推理依据:
  - prompt tokens: 3200
  - 包含的摘要: "User is building a qimen app..."
  - 包含的最近消息: 最近 8 条
  - LLM 调用耗时: 1.2s
  - 模型: deepseek-chat
```

### 2.4 记忆纠错

```
用户在记忆浏览器中删除/编辑一条记忆:
  DELETE /api/memory/:agent/messages/:ts
  → agent 下次对话不再引用被删的记忆

用户手动注入一条记忆:
  POST /api/memory/:agent/inject
  body: { content: "User prefers TypeScript over JavaScript" }
  → 下次 prompt 会包含这条 system 消息
```

## 3. API 端点

### 3.1 搜索记忆

```
GET /api/memory/:agent/search?q=<term>&limit=20
→ { results: MemoryTurn[] }
```

### 3.2 获取原始消息

```
GET /api/memory/:agent/messages?offset=0&limit=50
→ { messages: MemoryTurn[], total: 145, compressed_count: 120 }
```

### 3.3 删除消息

```
DELETE /api/memory/:agent/messages/:ts
→ { ok: true }
→ 注意: 删除消息可能影响摘要的准确性
```

### 3.4 注入记忆

```
POST /api/memory/:agent/inject
body: { content: "User prefers dark mode", role: "system" }
→ { ok: true }
```

### 3.5 LLM 调用日志

```
GET /api/memory/:agent/calls?limit=20
→ [
  {
    timestamp: "2026-07-13T10:00:00Z",
    prompt_tokens: 3200,
    completion_tokens: 150,
    duration_ms: 1200,
    model: "deepseek-chat",
    summary_used: true
  }
]
```

## 4. 数据库变更

```sql
-- LLM 调用日志表
CREATE TABLE llm_call_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,
  model TEXT,
  summary_used INTEGER DEFAULT 0,
  ts INTEGER NOT NULL
);
CREATE INDEX idx_llm_log_agent ON llm_call_log(agent, ts);
```

## 5. 前端变更

### 5.1 记忆浏览器组件

```
web/src/MemoryInspector.tsx  (~150 行)
  - 搜索框 + 搜索结果列表
  - 摘要区 (折叠)
  - 最近消息区 (分页)
  - 每条消息可删除
  - 注入记忆的输入框
```

### 5.2 App.tsx 集成

```
视图切换加第三个选项:
  [💬 Chat] [📋 Kanban] [🧠 Memory]
```

## 6. 文件清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `router/src/memory.ts` | 修改: 加 search/delete/inject/llmLog | +60 |
| `router/src/server.ts` | 修改: 加 memory API routes | +40 |
| `web/src/MemoryInspector.tsx` | 新增 | ~150 |
| `web/src/App.tsx` | 修改: 视图切换加 Memory | +10 |

## 7. 测试

```
test('search finds user name', async () => {
  await sendMessage('@Noel my name is Zhao Wei');
  const r = await fetch('/api/memory/Noel/search?q=Zhao').then(r=>r.json());
  expect(r.results.some(m=>m.content.includes('Zhao Wei'))).toBe(true);
});

test('delete removes message from memory', async () => {
  await sendMessage('@Noel secret info 12345');
  const before = await searchMemory('Noel', 'secret');
  await deleteMemory('Noel', before.results[0].ts);
  const after = await searchMemory('Noel', 'secret');
  expect(after.results.length).toBe(0);
});

test('inject adds system message to prompt', async () => {
  await injectMemory('Noel', 'User prefers dark mode');
  // 下一次 @Noel 的 prompt 应该包含这条 system 消息
  const msg = await sendMessage('@Noel what theme do I prefer?');
  expect(msg.reply).toMatch(/dark/i);
});

test('llm call log records token usage', async () => {
  await sendMessage('@Noel hi');
  const calls = await fetch('/api/memory/Noel/calls').then(r=>r.json());
  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0].prompt_tokens).toBeGreaterThan(0);
});
```

## 8. 边界

- 不做记忆分支/合并 (那是 git-for-memory 的概念, 过度设计)
- 不做 GDPR 级别的审计删除 (那是 Enterprise Phase)
- 不做记忆导出/导入 (MVP 不做)
- LLM 调用日志是尽力而为的 (`duration_ms` 可能有 ±10ms 误差)
