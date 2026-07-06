# 22 · coforge directions — exhaustive list before choosing

> Question: what directions does coforge itself have? (Post-paper, post-6/6-
> measured.) Exhaust first, choose second.

## The tension to name first

coforge currently has two identities pulling against each other:

1. **Paper's measuring instrument** — the six non-goal walls are the
   *contribution*. Fixing them destroys the measurement. docs/19 §4 is
   explicit: "do not build the OS layer."
2. **A usable workspace** — the same six walls are *shortcomings* blocking
   real use. README's "what this is not" lists them as gaps.

A direction must pick a side (or pick a third thing). Directions below are
grouped by what coforge *becomes*, with the tension made explicit.

---

## A — Stay the measuring instrument (research tool)

Keep the walls unfixed; deepen the instrument.

- **A1 — second workspace adapter**: implement the harness adapter for Letta
  or a LangGraph-built workspace. Proves the harness is generic, not
  coforge-specific. Unlocks "compare workspaces' walls" as a research
  output. Cost: medium (one adapter). Risk: pure academic, no product users.
- **A2 — R2 unification note**: write the "5/6 abstractions are
  mediation-enforced contracts; skills is the outlier" as a standalone
  short note or a follow-up paper section. Cost: low (writing). Risk: small
  audience.
- **A3 — package the instrument**: isolation-stub + 6 probes as a
  distributable tool with docs. Cost: low. Risk: overlaps C1.

## B — Become a usable workspace product (fix the walls)

Turn coforge into a real workspace. **This conflicts with docs/19 §4** —
fixing walls = rebuilding OS abstractions in user space. Each sub-direction
names which wall it breaks and whether that break is honest.

- **B1 — real concurrency (lock/CAS/event stream)**: fixes the serial-queue
  wall. docs/07 flagged this as the hardest, most error-prone (distributed
  correctness). Risk: high, and it is exactly the OS-layer work docs/19 said
  to leave to the OS.
- **B2 — memory compression (summarization/archival)**: fixes prompt-replay.
  Medium cost. The honest version: still user-space, so still best-effort,
  but token-cheaper. Partial fix.
- **B3 — isolation (borrow OS layer)**: fixes the isolation cliff. The
  isolation-stub proves user-space can't do it correctly; a real fix needs
  seccomp/process boundaries or an external sandbox (Firecracker/gVisor).
  Cost: high, and it stops being "a few hundred lines."
- **B4 — multi-user + auth (SaaS)**: fixes single-user. Turns coforge into
  a hosted product. Conflicts with the "self-hosted PoC" identity. Cost:
  high; also needs the LLM-cost question answered (docs/13).
- **B5 — capability routing (@capability, anti-hardening)**: fixes the
  routing cliff. docs/04 strategy 4. Medium cost. Honest in user space
  (routing is not structurally impossible like isolation, just redundantly
  hard).
- **B6 — multi-view Work Graph (chat/kanban/graph/diff)**: fixes the
  single-chat-view limitation. docs/04 strategy 1. Medium cost; UI-heavy.

**B-group verdict**: only B2, B5, B6 are honest to do in user space (the
wall is "redundantly hard," not "structurally impossible"). B1 and B3 are
the OS-layer work docs/19 says to leave alone; doing them = becoming a
half-baked OS. B4 is a business pivot, not a tech direction.

## C — harness as independent product

Stop treating harness as coforge's test tool; make it the product.

- **C1 — npm/CLI tool**: `npx coforge-harness probe <workspace>` runs the 6
  probes against any adapter. Target: agent-workspace builders. No direct
  competitor (docs/06 confirmed). Market: small but real. Cost: low-medium.
- **C2 — CI integration**: a GitHub Action / pre-commit hook that runs the
  probes on an agent workspace repo, like a linter for agent walls. Variant
  of C1 with a different buyer (dev teams, not researchers). Cost: medium.
- **C3 — probe library**: open the probe interface so the community
  contributes fault-injection probes (prompt-injection variants, capability
  mismatches, eviction policies). coforge ships the core + 6; community adds
  more. Cost: low to start, ecosystem play.

**C-group verdict**: this is docs/19's nominated "durable artifact." It
sidesteps the Raft collision (Raft is a workspace; harness measures
workspaces) and the OS-layer taboo (harness measures the gap, doesn't fill
it). The risk is market size — but it's the only direction with no direct
competitor and no docs/19 conflict.

## D — research project (no product)

Keep coforge as a research vehicle; output papers/notes, not software users.

- **D1 — R2 unification note** (same as A2).
- **D2 — second paper (research track)**: expand the 2-page vision paper to
  a 6-page research paper now that 6/6 are measured. Add the scaling/cliff
  method split + R2 + 10:2 (once C-investigation resolves). Cost: writing.
- **D3 — measure other workspaces**: run the harness against Letta/
  LangGraph/OpenHands and publish a comparison ("which agent runtime hits
  which walls"). Genuine research contribution. Needs adapter work (A1).
- **D4 — generalize enforcer==enforced-upon**: the diagnostic isn't
  agent-specific — any "application draws a boundary it can itself cross"
  fits (microservice advisory isolation, in-process plugin sandboxing).
  Write it as a general systems diagnostic. Cost: thinking + examples.

## E — angles I almost missed

- **E1 — teaching project**: position coforge like nanoagent — a workspace
  small enough to read end-to-end, where the non-goals are *labeled* so
  readers learn what an agent workspace is missing. Not a product, a
  reference. Crosses A/D.
- **E2 — coforge as Raft's inverse map**: keep walls unfixed, annotate each
  with "this is the Raft feature it corresponds to," making coforge a
  labelled map of Raft's OS-layer decisions. Niche; possibly only useful to
  the author.
- **E3 — memory layer as separate product** (docs/08 route A): the
  migratable/governable memory layer, independent of coforge's workspace.
  Requires rewriting coforge's memory from SQLite-full-replay to a proper
  memory object. Medium-high cost; crosses B2.
- **E4 — agent observability** (docs/08 route C): coforge's harness already
  measures; extend to continuous observability (agent Datadog). Crosses C1
  but for runtime, not just probing.
- **E5 — protocol layer** (docs/08 route G): the @mention routing as an
  open agent-interaction protocol, not a workspace. Crosses D4.

---

## Cross-cutting observations

1. **The docs/19 §4 line is the real filter.** It says: don't build OS
   abstractions in user space. That kills B1 (concurrency) and B3
   (isolation) as honest directions — they are exactly the OS work. B2, B5,
   B6 survive (redundantly hard, not structurally impossible). All of A/C/D
   survive (they don't fill walls).

2. **C is the only direction with no competitor and no docs/19 conflict.**
   Raft is a workspace; Letta is memory infra; Devin is SWE teammate.
   Nobody sells "a tool that measures your agent workspace's walls." C is
   also docs/19's explicit "durable artifact" pick.

3. **B (become a workspace) is the high-risk, high-cost path** and the only
   one that collides with Raft directly. It also forces the LLM-cost
   question (docs/13) — a real workspace burns tokens someone pays for.

4. **D (research) is the lowest-cost but lowest-impact** path — outputs
   papers, no users. Good as a side-channel, weak as the primary direction.

5. **The honest small directions (A2, A3, C1, E1)** share a property: they
   cost little, don't conflict with anything, and increase coforge's
   reach without pretending to be a product. A reasonable "default" if no
   strong product ambition.

## A recommendation (since the user asked for exhaustive-then-choose)

If forced to pick one primary: **C1 (harness as npm/CLI tool)**, because it
is the only direction that (a) docs/19 explicitly endorsed as the durable
artifact, (b) has no direct competitor, (c) doesn't conflict with the
paper's measuring-instrument identity, and (d) is low-medium cost.

Pair it with **A1 (second adapter)** as the proof-of-generality, and
**D3 (measure other workspaces)** as the research output that the product
enables. This trio turns coforge from "a workspace + its tests" into "the
tool that measures any agent workspace" — a category Raft, Letta, and Devin
all sit inside of, none of them occupy.

B (become a workspace) is the path if the goal is a product that competes
with Raft — but it is the one path docs/19, docs/07, and the isolation-stub
all warn against doing honestly in user space.
