# 29 · Phase 3: 多视图工作图 — 实现级规格

> 对应 docs/04 策略 1。coforge 目前只有单一 chat 视图。本 Phase 增加 kanban + 文件树视图，共享同一数据模型。

## 1. 动机

docs/03 §1: "chat 是单一模态、线性时间流——难以承载复杂多状态工作"。同一个项目，工程师想看 diff，PM 想看 kanban。本 Phase 不替换 chat，而是给它叠加两个视图。

## 2. 共享数据模型

所有视图共享同一个 `WorkItem` 模型：

```typescript
// web/src/model.ts

interface WorkItem {
  id: string;                    // UUID
  type: 'task' | 'note' | 'decision' | 'file';
  title: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  assignee?: string;             // agent name
  parent_id?: string;            // 子任务 → 父任务
  source_msg_id?: string;        // 来源于哪条聊天消息
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface WorkGraph {
  items: WorkItem[];
  edges: { from: string; to: string; relation: 'blocks' | 'depends_on' | 'child_of' }[];
}
```

### 2.1 从聊天消息自动提取 WorkItem

```
消息: "@Noel fix the login bug [task #1 in_progress]"
  → WorkItem {
      id: "task-1",
      type: "task",
      title: "fix the login bug",
      status: "in_progress",
      assignee: "Noel",
      source_msg_id: "msg-abc"
    }

消息: "决定用 SQLite 而不是 Postgres [decision]"
  → WorkItem {
      type: "decision",
      title: "用 SQLite 而不是 Postgres",
      source_msg_id: "msg-def"
    }
```

解析规则:
- `[task #N status]` → WorkItem(type=task)
- `[decision]` → WorkItem(type=decision)
- `[blocked by #N]` → edge(blocks)

## 3. 三个视图

### 3.1 Chat 视图 (现有)

保持现有功能。新增:
- 消息自动解析标记 → 生成/更新 WorkItem
- 消息旁边显示关联的 WorkItem badge

### 3.2 Kanban 视图 (新增)

```
┌──────────┬──────────────┬───────────┬──────────┐
│  TODO    │  IN PROGRESS │  REVIEW   │  DONE    │
├──────────┼──────────────┼───────────┼──────────┤
│ fix bug  │  build ui    │  test api │  setup   │
│ @Noel    │  @Noel       │  @Pat     │  done    │
│ [blocked]│              │           │          │
│ add docs │              │           │          │
│ @Sam     │              │           │          │
└──────────┴──────────────┴───────────┴──────────┘
```

每个卡片显示: 标题、assignee、标签、依赖关系 (blocked by / depends on)

### 3.3 文件树视图 (新增)

```
├── src/
│   ├── router.ts        (modified by @Pat)
│   └── agents.ts        (modified by @Pat)
├── web/
│   ├── App.tsx          (modified by @Noel)
│   └── Kanban.tsx       (new)
├── docs/
│   └── spec.md          (modified by @Sam)
```

展示哪些 agent 修改了哪些文件（从对话中解析文件路径）。

## 4. 前端架构

```
web/src/
├── App.tsx              # 主入口: 视图切换
├── views/
│   ├── ChatView.tsx     # 重构: 纯 chat 视图 (从 App.tsx 拆分)
│   ├── KanbanView.tsx   # 新增: kanban 视图
│   └── FileTreeView.tsx # 新增: 文件树视图
├── model.ts             # 共享 WorkItem/WorkGraph 类型
├── parser.ts            # 消息解析: 提取 WorkItem
├── api.ts               # API 调用 (不变)
└── components/
    ├── WorkItemCard.tsx  # kanban 卡片
    └── ViewSwitcher.tsx  # 视图切换 tab
```

### 4.1 视图切换

```
┌────────────────────────────────────┐
│  [Chat]  [Kanban]  [Files]         │  ← ViewSwitcher
├────────────────────────────────────┤
│                                    │
│   (当前视图内容)                     │
│                                    │
└────────────────────────────────────┘
```

URL hash 控制: `#chat` / `#kanban` / `#files`

### 4.2 状态管理

```typescript
// 简单状态, 不用 Redux
const [workGraph, setWorkGraph] = useState<WorkGraph>({ items: [], edges: [] });
const [activeView, setActiveView] = useState<'chat'|'kanban'|'files'>('chat');

// 收到新消息 → 解析 WorkItem → 更新 workGraph
function onNewMessage(msg: Message) {
  const items = parseWorkItems(msg.text, msg.agent);
  if (items.length) {
    setWorkGraph(prev => ({
      items: [...prev.items, ...items],
      edges: [...prev.edges, ...parseDependencies(msg.text)]
    }));
  }
}
```

## 5. 后端变更

### 5.1 新增 API

```
GET /api/workgraph
  → { items: WorkItem[], edges: Edge[] }

POST /api/workgraph/items
  body: { title, type, status, assignee }
  → 手动创建 WorkItem (非聊天触发)

PATCH /api/workgraph/items/:id
  body: { status, assignee, ... }
  → 拖拽卡片更新状态
```

### 5.2 SQLite 新表

```sql
CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  assignee TEXT,
  parent_id TEXT,
  source_msg_id TEXT,
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE work_edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  FOREIGN KEY(from_id) REFERENCES work_items(id),
  FOREIGN KEY(to_id) REFERENCES work_items(id)
);
```

## 6. 文件变更清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `web/src/model.ts` | 新增 | +30 |
| `web/src/parser.ts` | 新增 | +60 |
| `web/src/views/ChatView.tsx` | 重构: 从 App.tsx 移出 | +200 → 拆分 |
| `web/src/views/KanbanView.tsx` | 新增 | +150 |
| `web/src/views/FileTreeView.tsx` | 新增 | +100 |
| `web/src/components/ViewSwitcher.tsx` | 新增 | +30 |
| `web/src/components/WorkItemCard.tsx` | 新增 | +50 |
| `web/src/App.tsx` | 重构: 只做入口 + 状态管理 | -100 +40 |
| `router/src/db.ts` | 修改: 加 work_items/work_edges 表 | +30 |
| `router/src/routes.ts` | 新增: /api/workgraph 端点 | +50 |

## 7. 测试

```
test('chat message creates WorkItem', async () => {
  await sendMessage('@Noel fix the login bug [task]');
  const wg = await fetch('/api/workgraph').then(r=>r.json());
  expect(wg.items.some(i => i.title.includes('fix the login bug'))).toBe(true);
});

test('kanban shows items grouped by status', async () => {
  // 创建 3 个不同状态的 WorkItem
  // → kanban 视图应显示 3 列
});

test('view switcher changes URL hash', async () => {
  click('[data-view="kanban"]');
  expect(window.location.hash).toBe('#kanban');
});

test('WorkItem status update reflects in all views', async () => {
  // kanban 拖拽 → chat 视图也看到更新
});
```

## 8. 边界

- 不做实时协作 (B1 并发是 OS 层)
- 不做 diff/代码视图 (Phase 3 只做 kanban + 文件树, diff 是未来)
- WorkItem 解析是 keyword-based (和 Phase 2 一致)
- 不做 Git 集成 (文件树从聊天消息解析, 不读实际 git)
