# 20 · Ideas → spec: turning docs/19 into work packages

> Goal: convert the submission's afterthoughts (docs/19) into concrete specs
> and name the research directions worth investigating next. Three are
> buildable work packages; two are research directions to scope, not build.

## Context

docs/19 surfaced six ideas. They split cleanly:

- **Buildable (code)**: #4 generalized wall-detection harness; #6's three
  small things (measure from day one / non-goals in code / isolation stub).
- **Methodological (writing)**: #1 enforcer-and-enforced-upon diagnostic;
  #3 the scaling-pathology vs correctness-cliff split; #2 consumer-side
  evidence as a method; #5 the unified "mediation-enforced contract" thesis.

#1 and #3 are already documented (docs/19, paper §4). They do not need a
new spec — they need to be **applied** in the buildable work. #2 and #5 are
research directions worth scoping as investigations, not code.

Decisions confirmed with the user:
- harness: **coforge-specific adapter now, adapter interface left open**.
- harness coverage: **scaling-pathology walls now; fault-injection
  (correctness-cliff) interface stubbed for later**.
- #6: **all three** in scope.

---

## Work package A — wall-detection harness

### A.1 Goal

A reusable measurement tool that, given an agent workspace adapter, reports
where the workspace scales linearly (scaling-pathology walls) and exposes
a fault-injection hook for the cliffs (not implemented this round).

### A.2 Why

This is docs/19's nominated **durable artifact**. It is useful to the OS
community (consumer-side evidence) and to any agent-app builder (their own
diagnosis), and it does not compete with OS-layer work because it measures
the *gap*, not fills it.

### A.3 Scope (in)

- A harness core: load adapter → run scaling probes → emit a report.
- A coforge adapter: drives the running coforge-router over HTTP.
- Two scaling probes (carried over from `bench.py`, generalized):
  - **Concurrency probe**: fire N concurrent @mentions, report
    wall-clock vs N; flag if latency ∝ N (serial-queue wall).
  - **History probe**: hold an M-turn conversation, report prompt-tokens
    vs M; flag if tokens ∝ M (prompt-replay wall).
- A probe interface that future adapters/probes implement.
- A fault-injection **interface** (a hook + a no-op default) so cliffs can
  be added without rewriting the core.

### A.4 Scope (out, this round)

- Other adapters (Letta, custom workspaces) — interface only.
- Correctness-cliff probes (prompt injection, capability mismatch) —
  interface stubbed, not implemented.
- A web UI for results — CLI + JSON report is enough.

### A.5 Module shape

```
harness/
├── src/
│   ├── core.ts        # load adapter, run probes, aggregate report
│   ├── probe.ts       # Probe interface (scaling + fault-injection hooks)
│   ├── report.ts      # JSON + human report, "linear-growth?" flag
│   ├── probes/
│   │   ├── concurrency.ts
│   │   └── history.ts
│   └── adapters/
│       └── coforge.ts # drives coforge-router over HTTP
├── package.json
└── README.md
```

### A.6 Adapter contract (the "leave the interface open" part)

```ts
interface WorkspaceAdapter {
  name: string;
  sendMention(agent: string, text: string): Promise<{ reply: string; latencyMs: number; promptTokens?: number }>;
  resetWorkspace(): Promise<void>;   // for clean probe runs
  // future: faultInjection?: FaultInjector;
}
```

Any workspace that can answer `sendMention` + `resetWorkspace` is adaptable.
coforge's adapter calls `POST /api/chat` + reads token usage (requires the
router to surface usage — see package B).

### A.7 Acceptance

- `harness run --adapter coforge` produces a report flagging both scaling
  walls as linear-growth, with the real numbers.
- A second adapter can be added by implementing the interface, without
  touching core or probes.
- Report includes the "linear? yes/no" verdict per probe, not just raw
  numbers (the verdict is the point).

---

## Work package B — measure from day one (built-in bench)

### B.1 Goal

Make the benchmark part of coforge's dev flow, not a paper afterthought.

### B.2 Scope

- Move `paper/evidence/bench.py` logic into `harness/` (it becomes the
  coforge adapter + the two probes — A subsumes B's measurements).
- `router/src/llm.ts` surfaces token usage (`prompt_tokens`,
  `completion_tokens`) in its return, so the harness adapter can read it
  without bypassing the router.
- A router endpoint `POST /api/chat` response includes `usage` when the
  underlying LLM returns it.
- `router/package.json` gets a `bench` script that runs the harness against
  a local router.

### B.3 Acceptance

- `npm run bench` in `router/` runs the harness and prints the report.
- Token counts come through the router, not from a parallel direct-LLM
  call (single source of truth).

---

## Work package C — non-goals in code + isolation stub

### C.1 Goal

Make the code itself state that its workarounds are deliberate, and turn
the isolation wall into a visible artifact.

### C.2 Non-goals in code

Add a short comment at each of the four non-goal sites identified in
`paper/main.tex` §2, pointing to `docs/18` §4 (the enforcer/enforced-upon
argument). Sites:

- `router/src/queue.ts` — serial queue (no concurrency)
- `router/src/memory.ts` — full-history replay (no compression)
- `router/src/agents.ts` — single process + DB, no isolation
- `router/src/agents.ts` `parseMention` — regex routing (no capability
  matching)

Each comment: one line saying "deliberately best-effort; this is a measured
wall, see docs/18 §4 / paper §3." Not a TODO.

### C.3 Isolation stub — "an attempt that provably fails"

A small module `router/src/isolation-stub.ts` that tries, in user space, to
isolate two agents' memory, and documents where it cannot hold. Two
attempts, ordered by escalating rigor:

1. **Process-level**: spawn a second Node process for one agent, share
   nothing via globals — but show the shared SQLite file is still
   cross-readable (the boundary is advisory).
2. ** syscall-level (best-effort, may not be feasible on all platforms)**:
   attempt a `seccomp`/file-permission restriction so one agent's process
   cannot read the other's DB rows — and show that without runtime mediation
   of the DB handle, the restriction is either too coarse (whole file) or
   trivially bypassable (the app re-opens the file).

The stub is **not** a feature. It is a runnable demonstration that user-space
isolation is structurally best-effort — the paper's §4 isolation argument
made executable. Output: a script that runs the attempts and prints where
each holds / fails.

### C.4 Acceptance

- Four non-goal comments present and correct.
- `isolation-stub.ts` runs and its output explicitly states, per attempt,
  "holds / fails because <reason>", with the reason being the
  enforcer/enforced-upon structure (the app that draws the boundary is the
  app that can cross it).

---

## Research directions (scope, don't build)

### R1 — Consumer-side evidence as a method (#2)

**Question**: is "build a real thing in layer X, report its walls, map to
layer-beneath abstractions" a publishable method, or just a one-off angle?

**Investigation (done)**: prior art exists — exokernel, Dune, unikernel,
kernel-bypass (DPDK/AF_XDP) all argue from a real application's limitations
upward to missing OS abstractions. **Revised framing**: this is not a new
method to invent; it is a known genre being applied to a *new layer
boundary* (the agent runtime). The contribution is the layer, not the
method. Implication: do not write a "method paper"; write coforge-as-instance,
and let the method be implicit.

### R2 — Mediation-enforced contract as a unifying thesis (#5)

**Question**: are the six "wanted abstractions" actually six instances of
one concept — a contract enforced by the layer that mediates the resource?

**Investigation**: test the unification against the six rows. If it holds,
this is the "main course" paper the vision paper gestured at. If it does
not (the rows resist unification), that is also a result — it means the
six are genuinely distinct and the enumeration is the contribution. Not yet
investigated; conceptual, no external research needed.

### R3 — Does the scaling/cliff split align with the OS community's own divide? (#3)

**Investigation (done)**: classified the 1st-edition's 12 papers — **10
performance / 2 security** (Execute-Only Agents, Grimlock are the only
security-side; WAF is security-adjacent but LLM-rule-generation-flavored).

**This *overturns* docs/19 §3's assumption.** docs/19 guessed coforge's
scaling/cliff split "maps roughly onto" AgenticOS's performance/security
divide. It does not — the community is heavily performance-weighted (10:2),
while coforge's split is 2 scaling / 4 cliff. The implication is stronger
than the original guess: **coforge's four correctness-cliff walls
(isolation, skills-as-composition, capability routing, managed state)
occupy exactly the ground the OS community is *under*-working.** That is
not alignment; it is a gap-coforge-fills story. Worth foregrounding in the
next paper version, and it raises the priority of the isolation stub
(work package C.3) — that stub demonstrates the most under-served wall.

---

## Priority & dependencies

1. **C.2 (non-goal comments)** — trivial, do first, costs nothing.
2. **B (router surfaces usage)** — small, unblocks A's coforge adapter.
3. **A (harness)** — the main artifact; depends on B.
4. **C.3 (isolation stub)** — independent of A; can parallelize. Most
   research value per line of code.
5. **R1/R2/R3** — investigation, not code; do in parallel with anything,
   lowest urgency but highest upside.

## What this plan does NOT do

- Does not build OS-layer features (scheduling, real isolation, managed
  memory). docs/19 §4 is explicit: coforge stays at the application layer.
  The isolation *stub* demonstrates the wall; it does not fix it.
- Does not promise the harness will be easy to adapt to other workspaces —
  only that the interface is there. Adapting is future work.
- Does not turn R1/R2 into papers yet — they are scoped as investigations
  whose first output is a decision (pursue or not).
