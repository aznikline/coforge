# 30 · Phase 4: 任务系统 — 实现级规格

> 对标 Raft task create/claim/update 状态机。让聊天不只是聊天——一句话变任务、agent 认领、人验收。

## 1. 动机

coforge 目前只有 chat。用户说"@Noel fix the login bug"，Noel 回复了，但**没有任务追踪**：
- 不知道这个 bug 修了没有
- 不知道谁在做
- 不知道被什么阻塞了

Raft 的任务系统让每个 `[task]` 有独立生命周期，agent 通过 claim 声明所有权。

## 2. 状态机

```
          claim           start           complete
  todo ────────→ claimed ─────→ in_progress ─────→ in_review
                                     ↑                  │
                                     │    approve       │
                                     └──────────────────┘
                                      reject: 回到 in_progress
```

- **todo**: 创建时默认状态，无人认领
- **claimed**: agent 认领了，但还没开始
- **in_progress**: agent 开始工作
- **in_review**: agent 完成，等人验收
- **done**: 人验收通过
- **blocked**: 被其他任务阻塞（可从任意状态转入）

## 3. 数据库变更

扩展现有 `work_items` 表（Phase 3 已建）：

```sql
-- 新增字段
ALTER TABLE work_items ADD COLUMN claimed_by TEXT;
ALTER TABLE work_items ADD COLUMN claimed_at TEXT;
ALTER TABLE work_items ADD COLUMN completed_at TEXT;
ALTER TABLE work_items ADD COLUMN reviewer TEXT;

-- 任务事件日志（审计用）
CREATE TABLE task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- created|claimed|started|completed|approved|rejected|blocked
  actor TEXT NOT NULL,       -- agent name or "user"
  comment TEXT,
  ts INTEGER NOT NULL,
  FOREIGN KEY(task_id) REFERENCES work_items(id)
);
```

## 4. API 端点

### 4.1 创建任务

```
POST /api/tasks
body: { title: "fix login bug", assignee?: "Noel", tags?: ["bug","urgent"] }
→ { task: WorkItem, event: TaskEvent }
```

### 4.2 认领任务

```
POST /api/tasks/:id/claim
body: { agent: "Noel" }
→ { task: WorkItem, event: TaskEvent }
→ 409 如果已被别人认领
```

### 4.3 更新任务状态

```
POST /api/tasks/:id/transition
body: { action: "start"|"complete"|"approve"|"reject"|"block", actor: "user"|"Noel", reason?: "..." }
→ { task: WorkItem, event: TaskEvent }
```

### 4.4 列出任务

```
GET /api/tasks?status=todo&assignee=Noel
→ { tasks: WorkItem[] }
```

## 5. 与聊天集成

### 5.1 聊天中创建任务

```
用户: "@Noel fix the login button [task urgent]"
  → 保存消息 → 自动创建 WorkItem(type=task, status=todo, tags=["urgent"])
  → Noel 看到消息 + 任务被创建的通知
```

### 5.2 Agent 回复中更新任务

```
Noel: "claimed [task #3], starting now"
  → parseMention 检测到 agent 自己的消息含 "claimed [task #3]"
  → POST /api/tasks/3/claim { agent: "Noel" }
```

### 5.3 任务通知

```
任务状态变更 → 在频道中发 system 消息:
  "📋 task #3 'fix login button' → in_progress (Noel)"
```

## 6. 前端变更

### 6.1 Kanban 增强

```
- 拖拽卡片换列 → POST /api/tasks/:id/transition
- 卡片显示 claimed_by 头像/名字
- blocked 列显示阻塞原因
- 右键菜单: claim/start/complete/block
```

### 6.2 Chat 增强

```
- 任务创建/状态变更的 system 消息以卡片形式渲染
- 消息内 task #N 可点击 → 跳转到 kanban 对应卡片
```

## 7. 文件清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `router/src/tasks.ts` | 新增 | ~120 |
| `router/src/server.ts` | 修改: 加 task API routes | +40 |
| `router/src/workgraph.ts` | 修改: 扩展现有 work_items | +20 |
| `web/src/KanbanView.tsx` | 修改: 拖拽 + claim UI | +80 |
| `web/src/App.tsx` | 修改: task 通知渲染 | +30 |

## 8. 测试

```
test('task flows through full lifecycle', async () => {
  // 创建
  const { task } = await createTask('fix bug', 'Noel');
  expect(task.status).toBe('todo');

  // 认领
  const claimed = await claimTask(task.id, 'Noel');
  expect(claimed.status).toBe('claimed');

  // 开始
  const started = await transition(task.id, 'start', 'Noel');
  expect(started.status).toBe('in_progress');

  // 完成
  const done = await transition(task.id, 'complete', 'Noel');
  expect(done.status).toBe('in_review');

  // 验收
  const approved = await transition(task.id, 'approve', 'user');
  expect(approved.status).toBe('done');
});

test('double claim fails', async () => {
  await claimTask('task-1', 'Noel');
  await expect(claimTask('task-1', 'Pat')).rejects.toMatch(/already claimed/);
});
```
