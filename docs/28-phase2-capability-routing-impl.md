# 28 · Phase 2: 能力路由 — 实现级规格

> 对应 docs/26 B5。修复 routing cliff: @mention 不再仅限于精确 agent 名，支持能力寻址。

## 1. 动机

当前 `@Noel` 只能路由到名为 Noel 的 agent。docs/03 §4 指出名字会硬化成 role。本 Phase 实现两大能力:
1. **能力寻址**: `@frontend build landing page` → 路由到 skills 匹配的 agent
2. **错配移交**: `@Noel(frontend) write a SQL query` → 检测到 SQL 不属于 Noel 的技能 → 自动移交给 Pat

## 2. 路由决策树

```
用户输入 "@X message body"
  │
  ├─ X 精确匹配 agent 名?
  │   ├─ 是 → 检查 body 是否含其他 agent 的技能关键词
  │   │   ├─ 有 → 移交 (hand-off)
  │   │   └─ 无 → 直接路由到 X
  │   └─ 否 → 能力寻址
  │       ├─ X 匹配某个 agent 的 role?
  │       │   └─ 是 → 路由到该 agent
  │       ├─ X 匹配某个 agent 的 skills?
  │       │   └─ 是 → 路由到该 agent
  │       └─ 否 → 返回候选列表 (scored)
```

## 3. 数据结构变更

### 3.1 agents.json

```json
{
  "agents": [
    {
      "name": "Noel",
      "role": "frontend",
      "color": "#e06c75",
      "skills": {
        "frontend": 0.9, "ui": 0.85, "react": 0.8,
        "css": 0.8, "design": 0.7, "render": 0.75,
        "typescript": 0.7, "html": 0.85
      }
    }
  ]
}
```

`skills` 从 `string[]` 升级为 `Record<string, number>` — 权重值用于排序和学习。

### 3.2 TypeScript 类型

```typescript
// router/src/types.ts
interface AgentConfig {
  name: string;
  role: string;
  color: string;
  skills: Record<string, number>;  // skill_name → weight (0-1)
  persona: string;
}

interface RouteResult {
  matchType: 'exact' | 'handoff' | 'capability' | 'candidates';
  agent?: string;
  candidates?: { name: string; score: number; matched_skills: string[] }[];
  note?: string;  // 移交说明, 如 "routed to Pat — SQL is backend"
}
```

## 4. 核心算法

### 4.1 能力匹配 (keyword-based, deterministic)

```typescript
function rankByCapability(query: string, agents: AgentConfig[]): Candidate[] {
  const queryWords = query.toLowerCase().split(/\s+/);
  return agents
    .map(agent => {
      let score = 0;
      const matched: string[] = [];
      for (const [skill, weight] of Object.entries(agent.skills)) {
        if (queryWords.some(w => skill.includes(w) || w.includes(skill))) {
          score += weight;
          matched.push(skill);
        }
      }
      // role 也参与匹配
      if (queryWords.includes(agent.role)) {
        score += 0.5;
        matched.push(`role:${agent.role}`);
      }
      return { name: agent.name, score: score / Object.keys(agent.skills).length, matched_skills: matched };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);
}
```

### 4.2 错配检测

```typescript
function detectMismatch(
  mentionedAgent: AgentConfig,
  messageBody: string,
  allAgents: AgentConfig[]
): string | null {
  const bodyWords = new Set(messageBody.toLowerCase().split(/\s+/));

  // 提取 body 中的技术关键词
  const techWords = [...bodyWords].filter(w =>
    w.length > 2 && !STOP_WORDS.has(w)
  );

  // 检查是否命中其他 agent 的技能
  for (const other of allAgents) {
    if (other.name === mentionedAgent.name) continue;
    for (const [skill, weight] of Object.entries(other.skills)) {
      if (weight > 0.6 && techWords.has(skill)) {
        // 被 @ 的 agent 没有这个 skill
        if (!(skill in mentionedAgent.skills)) {
          return other.name;
        }
      }
    }
  }
  return null;  // 无错配
}

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been',
  'of','in','to','for','with','on','at','by','from',
  'and','or','not','but','if','than','that','this',
  'it','its','we','you','i','me','my','your','our',
  'please','can','could','would','should','will',
  'write','make','build','create','add','fix','do','get'
]);
```

## 5. API 变更

### 5.1 POST /api/chat

```typescript
// Request body 新增字段
interface ChatRequest {
  text: string;
  confirm_agent?: string;   // 用户确认的 agent (可选)
}

// Response 新增状态
interface ChatResponse {
  status: 'ok' | 'needs_confirmation';
  message?: Message;         // status=ok 时
  route?: RouteResult;       // 路由信息 (总是返回)
  candidates?: Candidate[];  // status=needs_confirmation 时
}
```

### 5.2 交互流程

```
用户: "@frontend build a landing page"
  → POST /api/chat { text: "@frontend build a landing page" }
  ← 200 { status: "ok", route: { matchType: "capability", agent: "Noel" } }

用户: "@Noel write a SQL query"
  → POST /api/chat { text: "@Noel write a SQL query" }
  ← 200 { status: "ok", route: { matchType: "handoff", agent: "Pat",
           note: "routed to Pat — SQL is backend" } }

用户: "@build landing page"  (模糊)
  → POST /api/chat { text: "@build landing page" }
  ← 200 { status: "needs_confirmation",
           candidates: [
             {name:"Noel", score:0.82, matched_skills:["frontend","ui"]},
             {name:"Sam",  score:0.31, matched_skills:["writing"]}
           ]}
用户: 点击 Noel
  → POST /api/chat { text: "@build landing page", confirm_agent: "Noel" }
  ← 200 { status: "ok" }
```

## 6. 学习机制

```typescript
function learnFromChoice(agent: AgentConfig, query: string, chosen: boolean): void {
  if (!chosen) return;
  const words = query.toLowerCase().split(/\s+/);
  for (const [skill, weight] of Object.entries(agent.skills)) {
    if (words.some(w => skill.includes(w) || w.includes(skill))) {
      // 小幅提升权重 (max 1.0)
      agent.skills[skill] = Math.min(1.0, weight + 0.02);
    }
  }
  // 写入 agents.json
  saveAgentsConfig();
}
```

## 7. 文件变更清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `router/src/types.ts` | 修改: AgentConfig, 加 RouteResult | +15 |
| `router/src/agents.ts` | 修改: parseMention() 重构 | +40 |
| `router/src/router.ts` | 新增: capability.ts 核心逻辑 | +120 |
| `router/src/config.ts` | 修改: 加 CAPABILITY_ROUTING 开关 | +3 |
| `agents.json` | 修改: skills 升级为 weight map | ~20 |
| `web/src/App.tsx` | 修改: 候选确认 UI | +30 |

## 8. 测试

```
test('@frontend routes to Noel', async () => {
  const r = await chat('@frontend build a button');
  expect(r.route.matchType).toBe('capability');
  expect(r.route.agent).toBe('Noel');
});

test('@Noel SQL query hands off to Pat', async () => {
  const r = await chat('@Noel write a SQL query');
  expect(r.route.matchType).toBe('handoff');
  expect(r.route.agent).toBe('Pat');
});

test('fuzzy @mention returns candidates', async () => {
  const r = await chat('@build something');
  expect(r.status).toBe('needs_confirmation');
  expect(r.candidates.length).toBeGreaterThan(0);
});

test('CAPABILITY_ROUTING=false preserves old behavior', async () => {
  // 关闭后 @frontend 应该失败 (没有名为 frontend 的 agent)
  const r = await chat('@frontend do something');
  expect(r.status).not.toBe('ok');
});
```

## 9. 边界

- 仅 keyword 匹配, 不做语义路由 (`@the-database-person` 不工作)
- 移交是单候选, 不协商多 agent
- 不修其他 5 堵墙
