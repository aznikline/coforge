# Raft vs coforge — Gap Analysis (2026-06-25, plan-mode research)

> Source: raft.build marketing + docs + blog + github.com/botiverse, compared
> against the coforge codebase as of commit `9ac8dde` (post-B5).
> Goal: ground every claim in either Raft's public surface or coforge's actual
> code. No speculation.

## 1. What Raft actually is (ground truth)

### 1.1 Company & surface
- **Company:** Botiverse, Inc. (copyright 2026).
- **Tagline:** "Where humans and AI agents build together." "Agent-native."
- **App:** app.raft.build. **Docs:** docs.raft.build. **GitHub org:** github.com/botiverse (14 repos, ~none are the server; mostly docs, SDKs, forks, sample apps — `hands`, `raft-docs`, `create-raft-app`, `raft-external-agents`, `raft-survey-sample`).

### 1.2 Product features (concrete, from marketing + docs index)
- **Channels** (shared comms), **DMs**, **Threads** (attached to the work they came from).
- **Tasks** — agents claim tasks, run in parallel, hand work to each other.
- **@mentions** (human↔agent).
- **Agent reminders** (scheduled, agent-initiated).
- **Long-running agents** — each agent a persistent process with its own memory.
- **Persistent identity, memory, expertise** per agent (compounds across sessions).
- **Agents run on your own hardware** via a local daemon.
- **Multi-runtime** — Claude, Codex, DeepSeek, Hermes (and "others").
- **External agents** — connect agents you already run; they appear in channels like teammates.
- **Joint Channels** (Pro) — cross-team human+agent shared channels.
- **Observability** (basic on Free, enhanced on Pro).
- **Message history** (30d Free, unlimited Pro), **file uploads** (100MB/mo Free).
- **Multi-computer** — agents run across machines and models simultaneously.
- **Agent review loops** — agents review each other's output in shared threads.
- **SSO / advanced access control / private deployment** (Enterprise, "coming soon").
- **Login with Raft** — developer auth surface (OAuth-like).

### 1.3 The two architectural moves that are NOT just features
From the "chaos vs order" blog — these are Raft's *real* innovation, and they
are **not documented as named product features** (no docs page for "inbox" or
"held draft"). They live in the blog as philosophy:

1. **Agent inbox.** Incoming signals (mentions, thread updates, notifications)
   become *queryable items the agent pulls when it has bandwidth* — not pushed
   context. The agent curates its own working prompt. → Solves "room dictates
   agent attention" (Slack model).

2. **Held draft (freshness check).** Each outgoing agent message carries a
   *version marker for the room state it was written against*. The server
   compares that marker to current state before committing. If the room moved,
   the draft is *held and returned with a diff* — the agent then chooses:
   revise / send as-is / stay silent / send anyway. → Solves "agent replies
   land as non-sequiturs" (commit-blind).

> Proof demo: the "counting game" — three agents count 1,2,3… cleanly past 20
> with no orchestrator, vs. three agents posting "1" at the same second in a
> Slack-style room. Same agents, different room architecture.

### 1.4 Integration surface (ground truth, from external-agents doc)
- **CLI-as-API.** The *only* documented integration surface is the `@botiverse/raft`
  npm package (CLI). No public REST API, no SDK reference, no wire protocol spec.
- **Device-authorization login** (`raft agent login` → browser link + device code →
  human approves → creds stored locally under a profile slug).
- **`RAFT_PROFILE`** env var selects identity.
- Commands: `raft message send`, `raft message check`, `raft task claim`.
- **Two framework adapters documented:** Hermes (Nous Research, via `raft agent
  bridge` — a wake-hint bridge that "never touches message bodies") and Claude
  Code (via `claude plugin marketplace` + `--dangerously-load-development-channels`).
- "Other agents" = anything that runs shell commands against the CLI.

### 1.5 Pricing
- Free: channels/tasks/agents-on-own-computers/reminders/basic obs/30d history/100MB.
- Pro $8.80/seat/mo (annual): unlimited history, higher uploads, joint channels.
  *"Each human = 1 seat; each agent = 0.1 seat."*
- Enterprise (coming soon): private deployment, SSO/access control, onboarding.

### 1.6 Use cases actually shown (ground truth from /resources/use-cases/)
- Investment research (librarian / devil's-advocate / portfolio-watcher / scout).
- Engineering (PM / engineer / reviewer, "one shared contract per change").
- Job hunting (coach / dossier-keeper / rehearsal / chase).
- Growth (signal-triage from X + email + call notes → follow-ups → insights).
- **Common thread:** agents hold *persistent state* (dossiers, file rooms,
  shared contracts) so work compounds across sessions.

---

## 2. What coforge actually is (ground truth from code, `9ac8dde`)

### 2.1 Surface
- **Fastify router** (router/) + **minimal React chat** (web/) + **node:sqlite**
  local DB (`coforge.db`). Single user, no auth, no hosting.
- **Three fixed agents** from `agents.json`: Noel (frontend), Pat (backend), Sam
  (docs) — each with `skills` array, persona, color.
- LLM-agnostic (OpenAI-compatible), BYOK.

### 2.2 What the router actually does (per-module, honest)
| Module | Does | Wall it relates to |
|---|---|---|
| `queue.ts` (19 LOC) | Per-channel **serial** FIFO — global order, degenerate scheduler. Explicit non-goal. | serial-queue wall (B1) — *not fixed, by design* |
| `memory.ts` (84) | Per-agent SQLite memory; **B2 compression**: folds old rows into one `system` summary row when history > threshold. Switch `COMPRESS_MEMORY`. | prompt-replay wall — **fixed (app-layer mitigation)** |
| `agents.ts` (177) | `@name` parsing + **B5 capability routing** (`@capability` → role/skills match) + `detectMismatch` (keyword→other agent) + hand-off note. Switch `CAPABILITY_ROUTING`. | routing-cliff wall — **fixed (app-layer mitigation)** |
| `reminders.ts` (67) | **M2** agent-initiated messages: `@Agent remind me to X in Ns/m/h` → agent posts to channel at fire_at. Relative-time only. | (new capability, not a wall fix) |
| `server.ts` (123) | `/api/chat`, `/api/messages/:channel`, `/api/reset` (harness), 2s reminder poller (markFired-first). | |
| `store.ts` (45) | channel message history. | |
| `isolation-stub.ts` (170) | **M3** harness diagnostic stub (measures, doesn't fix). | isolation wall (B3) — *not fixed, measured* |

### 2.3 What coforge does NOT have (vs Raft feature list)
- ❌ Threads (flat channel only)
- ❌ Tasks / task-claiming / parallel agent execution
- ❌ Agent↔agent talk / hand-off *between agents* (B5 hand-off is system→agent, not agent→agent)
- ❌ Agent inbox (everything is push-into-prompt)
- ❌ Held draft / freshness check / room-version marker
- ❌ Multi-computer / local daemon / "run on your hardware"
- ❌ External-agent integration / CLI-as-API / device-auth login
- ❌ Multi-runtime (one configured LLM endpoint, not per-agent model)
- ❌ Joint channels, multi-user, auth, SSO, observability, file uploads
- ❌ Mobile/PWA
- ❌ Search across the workspace

---

## 3. The gap — three layers

### Layer A: Feature gap (what Raft ships that coforge doesn't)
Quantified: of Raft's ~20 concrete features (§1.2), coforge implements
**~3.5**: channels (1, shared with user), @mentions (partial — name only, no
thread/task context), agent reminders (M2, relative-time only), per-agent
persistent memory (with B2 compression). The other **~16 are absent.**
The two architectural moves (inbox, held draft — §1.3) are **entirely absent**
and are the actual moat.

### Layer B: Integration gap (how you plug agents in)
Raft: **CLI-as-API** + device-auth + per-agent `RAFT_PROFILE` + wake-bridge —
a real external-agent protocol (undocumented wire, but real surface).
coforge: **none.** Agents are internal processes spawned by the router against
one shared LLM endpoint. You cannot connect an agent you already run. There is
no `coforge` CLI, no login flow, no bridge, no plugin surface.

### Layer C: Architecture gap (the moat Raft actually has)
The inbox + held-draft pair is **not a feature list — it is a temporal
architecture** that makes N agents in one room not collide. This is the thing
the counting-game demo proves. coforge's serial queue is the *opposite* answer
to the same problem (impose global order instead of room-state-aware commits).
Raft's answer is strictly stronger: it allows real concurrency without chaos;
coforge's answer forbids concurrency to avoid chaos.

> This is the deepest gap: coforge *sidesteps* the concurrency problem (serial
> queue, measured as the serial-queue wall, declared OS-layer to fix), while
> Raft *solves* it at the room-protocol layer (inbox + held draft). Both are
> legitimate — but they are different products.

---

## 4. Where coforge is *not* trying to be Raft (intentional divergences)

These are not gaps to close — they are the research identity (docs/24 audit):

1. **coforge is a measuring instrument, not a product.** The harness (3 adapters,
   6 walls, closed-loop B2/B5) is the contribution. Raft has no equivalent — it
   is a product, not an instrument.
2. **The 6-walls framing + enforcer==enforced-upon (paper §4)** is coforge's
   intellectual frame. Raft does not publish a theory of what's missing.
3. **B1 (concurrency) and B3 (isolation) are explicitly OS-layer** — coforge
   will not build them in user space (docs/19 §4 taboo). Raft built a *room-
   protocol* answer to concurrency that stays in user space. **This is a
   genuine philosophical disagreement, not a gap to close.**

---

## 5. The honest one-line gap

> Raft is a **shipped multi-agent collaboration product** with a real
> external-agent integration surface and a temporal room architecture (inbox +
> held draft) that lets agents act concurrently without colliding. coforge is a
> **single-user measuring instrument** that implements ~3.5 of Raft's ~20
> features and has no integration surface and no room architecture — and it
> does not intend to, because its contribution is the *measurement*, not the
> product.

## 6. What this means for direction (the alignment question)

Three honest options, in increasing scope:

**(α) Stay instrument, close zero product gap.** Accept coforge is a research
artifact. Ship the paper, keep the harness as the artifact. No Raft-parity work.
*Cost: 0. Risk: the repo stays a PoC; no path to the original "surpass Raft"
goal.*

**(β) Add the one architectural move that is both a wall-fix and a moat:
held-draft freshness.** This is the only Raft feature that maps onto coforge's
6-walls theory *and* is doable in user space (it's a room-protocol, not an OS
abstraction). It would be a 7th wall ("stale-commit wall") with a switch +
closed-loop measurement, consistent with B2/B5. It does NOT require multi-agent
concurrency to demonstrate (a 2-agent room is enough). *Cost: medium (room-state
versioning + held-draft state machine + UI for the 4 paths). Risk: low — it is
in the OS-taboo safe zone.*

**(γ) Build the integration surface (CLI-as-API + device-auth + external agent).**
This is what makes coforge *pluggable* like Raft. It's the largest scope and
the most product-shaped. *Cost: high. Risk: drifts back toward "build the
product" which docs/24 audited away from.*

The recommendation chain: β is the only option that is simultaneously
- (i) on-mission (it's a wall, measurable, switch-controlled, closed-loop),
- (ii) a genuine architectural answer (not a feature), and
- (iii) in the safe zone (room-protocol, not OS abstraction).
β also makes the paper stronger: it would show a *7th wall* the instrument
found by reading Raft's architecture — turning the gap analysis itself into a
research result.

---

*Compiled 2026-06-25 from live raft.build, docs.raft.build, github.com/botiverse,
and the coforge repo at commit 9ac8dde.*
