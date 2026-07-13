# 31 · Phase 5: 频道隔离 — 实现级规格

> 对标 Raft 的多频道架构。从单 `general` 频道到多频道隔离，每个频道独立的消息历史和 agent 参与。

## 1. 动机

coforge 目前是单频道 `general`。所有对话混在一起，agent 记忆不可分。Raft 的多频道让每个项目/工作流独立——#engineering 和 #design 互不干扰。

## 2. 设计

### 2.1 频道模型

```
channel: {
  name: "general" | "engineering" | "design" | ...
  agents: ["Noel", "Pat"]          // 参与该频道的 agent
  created_at: string
}
```

- 频道是**扁平列表**，无层级
- agent 可以参与多个频道
- 每个频道有独立的消息历史
- agent 记忆**仍然按 agent 隔离**（跨频道共享），但频道上下文在消息中标注

### 2.2 路由变更

```
当前: POST /api/chat { channel: "general", text: "@Noel hi" }
变更:  channel 参数从固定字符串变为用户选择的值

新增: GET /api/channels → [{ name, agents, message_count }]
新增: POST /api/channels { name, agents[] } → 创建频道
```

agent 在收到消息时，知道来自哪个频道：
```
prompt 增加: [channel: #engineering]
```

## 3. 数据库变更

```sql
-- 频道表
CREATE TABLE channels (
  name TEXT PRIMARY KEY,  -- kebab-case, 如 "engineering"
  agents TEXT NOT NULL DEFAULT '[]',  -- JSON array of agent names
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- messages 表已有 channel 字段，无需变更
-- 预置默认频道
INSERT OR IGNORE INTO channels (name, agents) VALUES ('general', '["Noel","Pat","Sam"]');
```

## 4. API 端点

### 4.1 列出频道

```
GET /api/channels
→ [
  { name: "general", agents: ["Noel","Pat","Sam"], message_count: 45 },
  { name: "engineering", agents: ["Noel","Pat"], message_count: 12 }
]
```

### 4.2 创建频道

```
POST /api/channels
body: { name: "design", agents: ["Noel", "Sam"] }
→ { channel: { name, agents, created_at } }
→ 409 如果频道已存在
```

### 4.3 频道消息隔离

现有 `GET /api/messages/:channel` 和 `POST /api/chat` 已经支持 channel 参数，无需变更。

### 4.4 Agent 跨频道记忆

agent 记忆 `agent_memory` 表不变，但在 `talkToAgent` 中加入频道上下文：

```typescript
// 在 prompt 中插入:
{ role: "system", content: `Current channel: #${channel}. ` }
// 消息记录加上 channel 前缀:
appendMemory(agent, "user", `[#${channel}] ${userText}`);
```

## 5. 前端变更

### 5.1 频道侧栏

```
┌──────────────┬──────────────────────┐
│ 📁 CHANNELS  │  #general            │
│              │                      │
│ #general   ● │  [chat messages...]  │
│ #engineering │                      │
│ #design    ○ │                      │
│              │                      │
│ [+ new]      │                      │
└──────────────┴──────────────────────┘
```

- 点击频道名切换
- ● 表示有 agent 在线（未来 Phase 9）
- [+ new] 创建新频道

### 5.2 App.tsx 重构

```typescript
const [channels, setChannels] = useState<Channel[]>([]);
const [activeChannel, setActiveChannel] = useState("general");

// 切换频道 → 重新加载消息
useEffect(() => {
  loadMessages(activeChannel);
}, [activeChannel]);
```

## 6. 文件清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `router/src/channels.ts` | 新增 | ~60 |
| `router/src/server.ts` | 修改: 加 channel API routes | +30 |
| `router/src/agents.ts` | 修改: talkToAgent 加 channel context | +5 |
| `web/src/App.tsx` | 修改: 频道侧栏 + 切换 | +80 |
| `web/src/App.css` | 修改: 侧栏样式 | +40 |

## 7. 测试

```
test('create and switch channels', async () => {
  await createChannel('engineering', ['Noel', 'Pat']);
  const channels = await fetch('/api/channels').then(r=>r.json());
  expect(channels.map(c=>c.name)).toContain('engineering');
});

test('messages are isolated per channel', async () => {
  await sendChat('general', 'hello');
  await sendChat('engineering', 'world');
  const gen = await fetchMessages('general');
  const eng = await fetchMessages('engineering');
  expect(gen.map(m=>m.text)).not.toContain('world');
  expect(eng.map(m=>m.text)).not.toContain('hello');
});

test('agent memory includes channel context', async () => {
  await sendChat('engineering', '@Noel remember this');
  // agent 的 memory 中应包含 [#engineering] 标记
});
```

## 8. 边界

- 不做私有频道（auth 是 Phase 未来）
- 不做频道权限（所有 agent 可加入任何频道）
- 不做频道归档/删除（MVP 最小集）
