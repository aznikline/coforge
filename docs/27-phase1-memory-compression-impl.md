# 27 · Phase 1: 记忆压缩 — 实现级规格

> 对应 docs/23 B2。本文档细化到可直接编码的级别。

## 1. 动机

当前 coforge 每轮对话将**完整历史**塞入 prompt。N 轮对话的 token 成本 ∝ N²。docs/23 已论证这是用户空间唯一诚实的可修墙壁。

## 2. 压缩策略

```
触发: 消息数 > N + K (N=10轮=20条, K=4轮=8条)
方法: LLM 摘要 + 滑动窗口
```

### 2.1 算法

```
function maybeCompress(agentName, llmClient):
  rows = db.getMessages(agentName, compressed=false)
  if rows.length <= N + K: return  // 不触发

  // 取最旧的 rows[0..len-K-1] 做摘要
  toSummarize = rows.slice(0, rows.length - K)
  recent = rows.slice(rows.length - K)

  // 调用 LLM 生成摘要
  summary = await llmClient.summarize(toSummarize, {
    systemPrompt: "Summarize this conversation history. Keep: user name,
      preferences stated, decisions made, facts learned, tasks assigned.
      Discard: greetings, small talk, redundant information.
      Output one paragraph in the user's language."
  })

  // 存入数据库
  db.insertSummary({
    agent_name: agentName,
    content: summary,
    source_range_start: toSummarize[0].id,
    source_range_end: toSummarize[toSummarize.length-1].id
  })

  // 标记被压缩的消息
  db.markCompressed(toSummarize.map(r => r.id))
```

### 2.2 Prompt 组装

```
function buildPrompt(agentName, persona, newMessage):
  summaries = db.getSummaries(agentName)
  recent = db.getRecentMessages(agentName, K)

  return [
    {role: "system", content: persona},
    ...summaries.map(s => ({role: "system", content: `[Earlier: ${s.content}]`})),
    ...recent,
    {role: "user", content: newMessage}
  ]
```

### 2.3 增量压缩

```
第二次触发时:
  - 新摘要基于 [上次摘要 + 新增的未压缩消息]
  - 不重新摘要已有摘要覆盖的范围
  - 每次只摘要增量部分, 成本 O(1) 而非 O(n)
```

## 3. 数据库变更

```sql
-- messages 表加字段
ALTER TABLE messages ADD COLUMN compressed INTEGER DEFAULT 0;

-- 新表: summaries
CREATE TABLE summaries (
  id TEXT PRIMARY KEY,              -- UUID
  agent_name TEXT NOT NULL,
  content TEXT NOT NULL,            -- LLM 生成的摘要文本
  source_start_id TEXT,             -- 覆盖的第一条消息 ID
  source_end_id TEXT,               -- 覆盖的最后一条消息 ID
  created_at TEXT DEFAULT (datetime('now')),
  token_count INTEGER               -- 摘要的 token 数
);
CREATE INDEX idx_summaries_agent ON summaries(agent_name);
```

## 4. API 端点

### 4.1 手动触发压缩

```
POST /api/memory/{agentName}/compress
Response 200:
{
  "summaries_created": 1,
  "messages_compressed": 12,
  "tokens_before": 4800,
  "tokens_after": 2100
}
```

### 4.2 记忆统计

```
GET /api/memory/{agentName}/stats
Response 200:
{
  "total_messages": 45,
  "compressed_messages": 24,
  "summary_count": 2,
  "estimated_tokens_saved": 3200
}
```

### 4.3 摘要检视

```
GET /api/memory/{agentName}/summaries
Response 200:
[
  {
    "id": "abc123",
    "content": "User is building a qimen app. Decided to use Python stems...",
    "source_start_id": "msg-001",
    "source_end_id": "msg-012",
    "created_at": "2026-07-12T10:00:00Z",
    "token_count": 85
  }
]
```

## 5. 文件变更清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `router/src/config.ts` | 修改: 加 COMPRESS_MEMORY 开关 | +3 |
| `router/src/memory.ts` | 新增: summarizeOld(), 改 role 类型 | +45 |
| `router/src/agents.ts` | 修改: buildPrompt() 重构 | +30 |
| `router/src/db.ts` | 修改: ensureSummariesTable() | +15 |
| `web/src/App.tsx` | 修改: 加压缩统计展示 | +20 |

## 6. 测试方案

### 6.1 自动化

```
test('30 messages triggers compression', async () => {
  for (let i=0; i<31; i++) await sendMessage('@Noel msg '+i);
  const stats = await fetch('/api/memory/Noel/stats').then(r=>r.json());
  expect(stats.compressed_messages).toBeGreaterThan(0);
});

test('agent remembers name after compression', async () => {
  await sendMessage('@Noel my name is Zhao Wei');
  // 触发压缩...
  await sendMessage('@Noel what is my name?');
  expect(lastResponse).toContain('Zhao Wei');
});

test('COMPRESS_MEMORY=false preserves full replay', async () => {
  // 关闭压缩 → 完整历史, 无摘要
  const stats = await fetch('/api/memory/Noel/stats').then(r=>r.json());
  expect(stats.compressed_messages).toBe(0);
});
```

### 6.2 手动验证

- [ ] 30 条消息后自动触发压缩
- [ ] 压缩后 agent 记得用户名和偏好
- [ ] 压缩后 prompt token 数显著下降
- [ ] COMPRESS_MEMORY=false 恢复全量回放
- [ ] Harness history probe: compress=true → wall fixed
- [ ] Harness history probe: compress=false → wall confirmed

## 7. 边界

- 不做记忆检视/溯源/branch (那是策略 3 的完整版, Phase 1 只做压缩)
- 不做跨 agent 记忆共享 (那是未来的能力)
- 摘要质量依赖 LLM, 可能会有信息丢失 (用户空间尽力而为)
