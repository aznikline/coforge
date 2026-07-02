# 17 · AgenticOS — OS for AI agents

> Source: https://os-for-agent.github.io/ (2nd AgenticOS Workshop, SOSP 2026)
> + 1st edition (ASPLOS 2026, 12 accepted papers).
>
> **What it is**: an academic workshop series arguing that operating systems
> need new abstractions for AI agent workloads. Not a product. A research
> agenda.

---

## The thesis in one line

> "Operating systems themselves must become _agentic_, adapting their
> abstractions and resource management policies to the semantic behaviors of
> agents."

The claim: traditional OS primitives — **processes, threads, files, sockets,
cgroups** — were designed for static, predictable workloads. Agents are
long-lived, semantically aware, adaptive, tool-invoking, and unpredictable.
The mismatch is the problem; redesigning OS abstractions for agents is the
agenda.

## Why it matters (and why now)

Two forces make this timely rather than speculative:

1. **Agents are becoming always-on services**, not one-shot prompts. They
   plan, call tools, collaborate, and persist. A process model that assumes
   "run, exit, free resources" does not fit something that lives for days and
   accumulates state.
2. **Agents now manage systems**, not just run on them. One whole topic area
   is agents doing kernel tuning, anomaly detection, failure recovery — the
   manager becomes the managed.

This is a two-way co-evolution: **OSes must support agents, and agents can
run OSes.** The workshop is explicit about both directions.

## The 1st edition already mapped the concrete problems (ASPLOS 2026)

Twelve papers, each a real research bet on which abstraction breaks first.
Grouped by theme:

### Resource control & scheduling
- **AgentCgroup** — extend cgroup-style resource control to agent workloads.
  The question: what even *is* an agent's resource footprint when it spawns
  sub-agents, calls tools, and burns tokens?
- **Towards Agentic Performance Management** — rethink perf monitoring loops
  for adaptive, agent-driven workloads.
- **Fuyun** — LLM agents close the "semantic gap" in serverless autoscaling by
  understanding workload intent.

### New execution primitives
- **Fork, Explore, Commit** — version-control-style OS primitives so an agent
  can branch its execution context, explore alternatives, and commit the
  winner. This is directly the "agent exploration needs first-class branching"
  argument.
- **pMVX** — policy-level multi-version execution: run several policy variants
  concurrently and let the kernel self-tune. (Classic multikernel lineage.)

### The unit of composition
- **Skills are the new Apps — Skill OS** — argues "skills" (agent
  capabilities) should replace "apps" as the OS-level composition unit. This
  is the most ambitious reframing in the set.
- **Rethinking OS Interfaces for LLM Agents** — are syscalls/IPC even the
  right interface, or do agents need a new syscall surface?

### Isolation & security
- **Execute-Only Agents** — an architectural isolation model against prompt
  injection: the agent can execute but not escalate, so injected prompts
  cannot widen privilege.
- **Grimlock** — eBPF + attested channels to guard "high-agency" systems
  (agents that operate with real autonomy).
- **LLM-Driven Rule Generation for WAF** — can LLMs auto-generate enforcement
  rules? Explored via web application firewall.

### Model-as-resource
- **Virtualizing Foundation Models with a Self-evolving OS Layer** — treat
  foundation models as a virtualizable resource with an OS-style management
  layer (multiplexing, lifecycle, adaptation).

### Protocol bridging
- **Mobile-MCP** — implement Model Context Protocol via Android's inter-app
  communication. Bridges the agent protocol world to the mobile OS world.

## The agenda this implies (synthesis)

Strip away the paper-by-paper detail and a coherent research program emerges:

| Layer | Traditional | AgenticOS direction |
|-------|--------------|---------------------|
| **Unit of execution** | process/thread | long-lived, branching agent context (fork/explore/commit) |
| **Unit of composition** | app | skill (capability bundle) |
| **Resource accounting** | cgroup (cpu/mem/io) | agent-aware: tokens, tool calls, sub-agent spawns, semantic cost |
| **Interface** | syscalls / IPC | agent-facing syscall surface; MCP as a first-class bridge |
| **Isolation** | user/process boundary | execute-only / attested-channel boundaries against prompt injection |
| **Scheduling** | fairness / throughput | semantics-aware: intent, priority, exploration vs exploitation |
| **State** | files / memory pages | long-lived episodic memory + context as a managed OS object |
| **Control flow** | kernel manages all | bidirectional: kernel manages agents, agents tune kernel |

## How this relates to coforge

coforge and AgenticOS sit at **different layers of the same stack** and are
quietly complementary:

- **coforge is the application/workspace layer**: it asks "how does a human
  route work to named agents, and how do those agents remember?" Its
  primitives are `@mention`, persona, per-agent memory, a serial queue.
- **AgenticOS is the platform/OS layer**: it asks "what should the runtime
  *underneath* such agents look like?" Its primitives are fork/explore/commit,
  agent-cgroup, execute-only isolation, skills-as-apps.

The connection points are concrete:

- coforge's **serial queue** (the honest non-goal that sidesteps C3
  coordination) is exactly the kind of thing AgenticOS wants to make
  first-class — semantics-aware scheduling would let coforge drop the
  "one-at-a-time" constraint without writing its own concurrency layer.
- coforge's **per-agent memory in SQLite** is the application-level version of
  AgenticOS's "long-lived state abstractions for context and episodic memory."
  If the OS provided a memory object primitive, coforge's `memory.ts` would
  delegate to it instead of hand-rolling replay-into-prompt.
- coforge's **no isolation between agents** (they share a process, a router,
  a DB) is the gap AgenticOS's execute-only / attested-channel work targets.
  A real deployment with untrusted agents would want exactly that OS-level
  boundary.
- The **"skills are the new apps"** line maps onto coforge's `agents.json` —
  personas are a primitive form of skill bundle. If skills became an OS
  composition unit, coforge's agent definitions would naturally become
  installable skills.

In short: **coforge is a place where AgenticOS's abstractions, if they
existed, would slot in directly.** coforge hand-rolls (badly, by admission)
the things AgenticOS wants to provide as OS primitives.

## What this means for coforge's roadmap

Three honest takeaways for coforge specifically:

1. **Don't build the OS layer yourself.** coforge's deliberate non-goals
   (no real concurrency, no isolation, no self-hosted execution surface)
   overlap heavily with what AgenticOS is arguing the OS should provide.
   That overlap is not a coincidence — it means coforge should *stay* at the
   application layer and expect these primitives to arrive from below, not
   reinvent them.
2. **Watch fork/explore/commit and agent-cgroup.** These two are the closest
   to features coforge would actually use. If/when an OS or runtime exposes
   them, coforge's serial queue and per-agent memory could be replaced by
   native primitives — a real C3 story without the distributed-correctness
   pain (the thing docs/08 said to avoid).
3. **There is a research-to-product gap, and it is wide.** AgenticOS is
   vision + early papers, with no production runtime to target. coforge
   cannot depend on it today. Treat it as a **map of where the layer beneath
   you is going**, not a dependency.

## One-line summary

> AgenticOS is an academic workshop series arguing the OS must be redesigned
> for agent workloads — new execution units (branching contexts, skills),
> agent-aware resource accounting (cgroup for tokens/tools/sub-agents), and
> isolation against prompt injection. It sits one layer below coforge: where
> coforge hand-rolls routing, memory, and a serial queue at the app layer,
> AgenticOS wants to make those OS primitives. coforge should stay at its
> layer, watch fork/explore/commit and agent-cgroup, and not try to build the
> OS itself.
