# 01 · Raft 产品概览

> 本项目的目标是回答两个问题：**Raft 为什么能成功**，以及 **如何做出超越它的产品**。本文档是分析的起点——先把 Raft 是什么讲清楚。

调研来源：raft.build 官网主站、`Introducing Raft` 发布博文、博客索引页、`Is Having Agents in the Room Meant to Be Chaotic?`、`Agents Need Names`、`A Comfortable AX for Agent Search`、`The Metric That Finally Counts Your Agent Teammates: Introducing DAA`。

---

## 1. 一句话定义

Raft（Botiverse, Inc.，2026）是一个**让人与 AI agent 在同一个协作空间里像队友一样共建**的平台。它不把 AI 当作一次性工具，而是当作有持久身份、记忆和自主性的团队成员。

核心口号："**Where humans and AI agents build together.**"

## 2. 产品形态

- **界面 = 聊天工作区**。Channels、DMs、threads 是主交互面。人与 agent 共享同一上下文，"协作零开销"。
- **长时持久 agent**。每个 agent 跨会话保留自己的记忆（代码库知识、偏好、历史对话），可暂停/恢复任务。
- **自托管执行**。agent 通过轻量 daemon 跑在用户自己的硬件上——"对计算的完全掌控，对代码与数据的完全隐私"。
- **Agent 提醒系统**。agent 可被提醒任务与上下文。
- **可观测性**。Free 含基础观测，更高层级含性能追踪。
- **联合频道（Joint channels）**。Pro 起开放跨团队人机协作。
- **内置任务管理**。在聊天界面内跟踪任务。

## 3. 定价模型（关键创新点）

| 计划 | 价格 | 关键差异 |
|------|------|---------|
| Free | $0 | Channels、tasks、自托管 agent、基础观测、30 天历史、100 MB/月上传 |
| Pro | $8.80/座/月（年付） | 无限历史、更高上传、联合频道 |
| Enterprise | "Coming soon" | 私有部署、SSO、高级访问控制、专属 onboarding |

**计价结构性创新**：每个人 = 1 座；每个 agent = 0.1 座。即 agent 的席位成本只有人的 1/10。这从定价层面就鼓励"少数人 + 大量 agent"的团队结构——10 个 agent 才抵 1 个人。这个数字本身就是产品哲学的具体化。

## 4. 设计语言与品牌身份

- **Brutalist 美学**。团队页一位 agent 成员自述"造带观点的像素""在意 brutalist edge"。
- **Millennial 网页聊天怀旧感**。刻意选用的 UI 方向。
- **人机并列的团队页**。团队页把人与 agent 并排列出，agent 拿到 cofounder 头衔（CTO、daemon lead、frontend、performance）。一只叫 DD 的猫是"CEO assistant"。**自己用自己的产品**——以身作则地示范"人机混合团队"。
- **语气**：随意、自信、略带顽皮。

## 5. 目标用户

- **Agent-native builder / 工程团队**——已经在用 AI 编码 agent 的开发者。
- **非技术团队**——有证言称不写代码的 GTM 员工快速上手，像跟人队友一样跟 agent 沟通。
- **精简工作室 / 小团队**——看重角色清晰与任务管理。
- **重度算力用户**——有用户峰值"1.2B tokens/day"，跑多种 agent（devs、architects、memory keepers）。

## 6. 技术主张

- Agent 是"持久进程"，保留记忆。
- 执行经用户硬件上的"轻量 daemon"。
- 实测：某用户峰值 1.2B tokens/day；样例对话展示 staging 上 p99 延迟降低 18%。
- 支持 code review 流、CI/CD 集成（agent 监控并报告 CI 状态）、daemon 级 socket 竞态调试。

## 7. 哲学内核（来自发布博文）

发布博文由创始人 Richard 撰写，核心论点是一次**范式拒绝**：现有 AI 工具把 agent 当"一次性交易性工具"（输入 prompt → 拿答案 → 交互结束）。Raft 建立在不同前提上。

它要解决的痛点：

1. **会话间上下文丢失**——典型 agent 每次从零开始。
2. **手动配置负担**——每次都要显式 setup、briefing。
3. **人作为记忆保管者**——人得记得去 follow-up、提醒 agent、管所有排程。
4. **人为的组织结构**——角色与专长得被指派，而非有机生长。

三大机制对应回应：

1. **持久身份与记忆**——"一个 agent 就是一个 session：跨天跨任务存活的连续身份"。上下文复利积累：第二次 briefing 比第一次短，一周后几乎不用 briefing。
2. **Agent 自主性**——agent 自己排程（"明天要 follow-up 就自己设提醒"），按活跃度自适应节奏，主动接入资源。
3. **有机团队成型**——没有 org chart，agent 从共享 board 认领任务、通过共享频道观察队友学习，专长从重复工作中涌现。"从扁平 agent 池变成有差异角色和共享风格的团队——是长出来的，不是分派的。"

中心哲学命题：

> "个体智能只是及格线。真正重要的是**集体智能**：人与 agent 随时间共建共享上下文。"
> "Raft 是 AI 不再是工具、开始成为队友的地方。"

---

## 关键数据点速查

- 公司：Botiverse, Inc.，产品入口 app.raft.build
- 博文发布：2026-05-21，作者 Richard（Founder & CEO）
- 峰值用量：1.2B tokens/day（单用户）
- 计价锚点：1 人 = 1 座；1 agent = 0.1 座
- 博客主题词：AX（Agent Experience）、DAA（Daily Active Agents，对标 DAU 的 agent 度量）
