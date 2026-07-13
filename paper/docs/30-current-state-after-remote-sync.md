# 现状分析（2026-06-25，远端对齐后）

> 触发：用户让"对齐远端，再分析一轮现状"。
> 对齐远端时发现：另一个会话/机器在 B5 之后推了 4 个 commit（Phase 1-6
> 实现级 spec + 代码），走的是**产品骨架方向**——正是 docs/29 §5 我刚
> 撤回的 (A)/(B)。两个会话的方向判断在打架。本文件做统一现状判断。

## 1. 远端做了什么（实证，非转述）

### 1.1 4 个 commit（HEAD 9ac8dde 之后）
```
c88f812 docs: Phase 1-3 implementation-level specs
d8ff7f3 feat: Phase 3 multi-view work graph
50cdde9 docs: Phase 4-6 implementation specs
fef4c08 feat: Phase 4-6: tasks, channels, memory inspection
```
+1981 行。新增 `router/src/{workgraph.ts,tasks.ts}`、`web/src/{KanbanView.tsx,MemoryInspector.tsx,types.ts}`，扩 server.ts +133 行、App.tsx +58 行。根 `docs/` 建了 docs/27-32（phase1-6 spec，**与我 paper/docs/ 的 27-29 同号不同目录**）。

### 1.2 方向：产品骨架（Raft 平替路线）
- Phase 3: Work Graph（task/decision/edge，从消息 parse `[task #id]` `[blocked by #x]`）
- Phase 4: Task 状态机（todo→claimed→in_progress→in_review→done，claim/transition API + task_events 审计）
- Phase 5: Channel 隔离（channels 表 + CRUD + agent memory 打 `[#channel]` 前缀）
- Phase 6: Memory Inspector（per-agent memory 浏览/搜索/删除/注入 + 压缩计数）

这是 docs/04 战略 1（multi-view Work Graph）+ 战略 3（memory as object）+ Raft feature 平替（task/channel/kanban）。**正是 docs/29 §5 我撤回的 (A) 产品骨架方向。**

## 2. 这批代码的真相（实证：运行即崩）

### 2.1 typecheck 坏（已由我修）
`server.ts` 有 **duplicate `import { clearMemory }`**（行 7 和 12，TS2300）+ channels GET 把 row 断言成 `Record<string, unknown>` 导致 `r.name` 给 SQL `.get()` 类型不匹配（TS2769）。**推的时候没 typecheck。** 我已修（commit `633d5ab`），router+web typecheck 现干净。

### 2.2 schema 不自洽（运行即崩，更严重）
- `workgraph.ts` 的 `ensureWorkGraphTables` 建的 `work_items` 表**没有** `claimed_by/claimed_at/completed_at/reviewer` 列。
- `tasks.ts` 的 `claimTask`/`transitionTask` 却 UPDATE 这些列。
- 实证（`node:sqlite` 内存库跑）：
  ```
  created item: 124a8773-...
  claimTask CRASH: no such column: claimed_by
  transitionTask CRASH: invalid transition: todo → in_progress
  ```
- 而且 `transitionTask` 的 action="start"→in_progress 与状态机（todo 只能→claimed）**逻辑冲突**——就算列存在，第二个 task 也转不了。

**结论：Phase 4 task 系统的核心 API（claim/transition）跑起来就崩。** 这是**没跑过就推的半成品**——`as Record<string, unknown>` 把类型蒙住骗过了 typecheck，运行时才暴露 schema 不自洽。

### 2.3 其余模块未验
workgraph.ts 的 parseWorkItems / createWorkItem / getWorkGraph 没实测；web 的 Kanban/MemoryInspector 没实测。但按 Phase 4 的质量推断，未验部分大概率也有类似问题。**整批 Phase 3-6 处于"写了没验"状态。**

## 3. 两个会话的方向冲突

| | 本会话（docs/29） | 远端会话（Phase 1-6） |
|---|---|---|
| 判断 | 撤回产品方向；measurement-based analysis | 走产品骨架（task/kanban/channel/memory）|
| 依据 | docs/28: Raft niche 不稳被夹击 + docs/29: "测量强项"是叙事、实际只 1 条硬产出 | docs/25 option 3 的产品分支（M1-M3 之后自然延伸到 B6 workgraph）|
| Raft 关系 | 不追 Raft niche | 正在补 Raft 的 task/channel feature（平替）|

**冲突本质**：远端在补 Raft 已 ship 的 feature（task 状态机、channel、kanban 正是 Raft docs/28 §1.2 里 Raft ship 的东西），而本会话 docs/29 的结论是"不追 Raft niche"。**如果远端的方向成立，那 docs/29 的"撤回产品方向"判断就错了；反之亦然。**

这不能两个都对。需要判断：**远端补的这些 Raft feature，是值得做的真进展，还是 docs/29 说的"追不稳的 niche"？**

## 4. 我的判断（基于实证）

### 4.1 远端代码本身：不合格，但方向可论证
- 代码质量：**不及格**——typecheck 坏 + 运行即崩，是没验就推。这点无论方向对错都该修。
- 方向：**可论证但非最优**。补 Raft 的 task/channel/kanban 确实缩小了 docs/29 §1 说的"~3.5/20 feature"差距，但它正是 docs/28 §3.3 说的"被免费开源（OpenHands/Cline）和高分发 incumbent（Slack/Claude Code Channels）两侧夹击"的那条赛道。**在一条拥挤且被夹击的赛道上追平 Raft，追平了也是追到悬崖边。**

### 4.2 docs/29 定位的有效性：仍然成立，但需补一条
docs/29 的核心判断（撤回强项叙事、撤回 (B)、定位为 measurement-based analysis）**不因远端推了产品代码而失效**——反而被强化：
- 远端推的代码是半成品（崩），说明产品路线在当前资源下连"能跑"都还没到，更别说"追平 Raft"。**这印证了 docs/29 §0：产品方向是 docs/17 reframe 出来的、因果反的——现在看连执行都没站稳。**
- docs/29 唯一硬资产（bench.json serial-queue 线性 + 3-way 真 divergence）**没被动**。measurement-based analysis 的底座还在。

但 docs/29 **漏了一条**：它没预见到另一个会话会去补产品骨架。现在现状是**两条腿在朝两个方向走**——一条 measurement（本会话），一条 product（远端，且崩着）。**得选一条，或明确两条的关系。**

## 5. 现状的诚实一句话

> coforge 现在是**两条腿分叉**：远端在补 Raft 平替的产品骨架（Phase 3-6，但代码运行即崩、未验就推）；本会话在 docs/29 把定位撤回为 measurement-based analysis。measurement 那条腿有 1 条硬产出（serial-queue 线性曲线 + 真 divergence）站着；产品那条腿连"能跑"都没到（task 系统核心 API 崩）。**两条腿都不能同时走，且不能都不选。**

## 6. 待决策（不替用户定）
1. **产品骨架（远端 Phase 3-6）修不修、续不续？** 修是低成本的（schema 补列 + 状态机逻辑），但续是高成本的（继续追 Raft feature 平替，进入 docs/28 说的夹击赛道）。
2. **measurement-based analysis（docs/29）要不要正式立为主线？** 这意味着把 paper/harness 当主交付，产品 PoC 只当被测对象，不再扩 feature。
3. **两条腿的关系**：产品骨架能不能反过来当 measurement 的"被测对象"——即远端那批 Raft 平替代码，正好可以塞进 harness 当**第 4 个 adapter**，测它的 task/channel/kanban 有没有复现 Raft 的墙。这样远端代码不浪费、且反哺 measurement 论点（"连照着 Raft 抄都抄出墙"是比"测 coforge 自己"更强的证据）。

第 3 条是我看到的**唯一能让两个会话的产出都对得上的接法**——远端的产品代码不报废、本会话的 measurement 定位不落空。但它是新方向，要用户拍板。

---
*实证：git log/fetch/merge-base + tsc + node:sqlite 内存库跑 claimTask/transitionTask。所有"崩溃"结论来自实跑，非推断。*
