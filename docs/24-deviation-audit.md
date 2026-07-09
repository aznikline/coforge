# 24 · Deviation audit — from "surpass Raft" to "measure agent-workspace walls"

> The project started (docs/01-04) wanting to build a product that surpasses
> Raft. This file audits, honestly, where coforge actually ended up vs that
> original intent — and whether the drift was a mistake or a rational
> re-targeting.

## What the project started as (docs/04 — "Flot", the Raft-surpassing product)

Ten strategies, each reversing a Raft trade-off or filling a Raft gap:

1. Multi-view Work Graph (chat / kanban / graph / diff / timeline)
2. Native concurrency primitives (lock / CAS / watch / presence, event-stream rooms)
3. Memory as a first-class inspectable object (browser / diff / provenance / branch / ACL)
4. Capability addressing + anti-hardening (@capability, not @name)
5. Tiered autonomy + trust visualization (trust tiers, what an agent must not touch)
6. AX as an open protocol (inbox / held-draft / option-space injection)
7. Collaboration layer + pluggable verticals (meta-agent + SWE/data/design slots)
8. Capability boundaries + learning lineage + decision provenance
9. Enterprise-first (SSO / RBAC / audit / air-gap)
10. Pricing + ecosystem positioning (seat + memory-as-paid + protocol-free)

This is a **workspace product** that competes with Raft head-on, on a
deeper layer.

## What coforge actually is now

- **router/** — Fastify + SQLite. @mention regex routing, serial queue,
  full-replay memory (B2 adds summarization, one wall partly fixed), no
  isolation, single user. ~250 lines. A minimal PoC, not a product.
- **harness/** — a 6-probe tool that measures agent-workspace walls
  (scaling curves + fault-injection rates). CLI, 3 adapters (mock/coforge/
  langgraph). **This is the actual product direction now.**
- **langgraph-ws/** — a second workspace to probe (proves the harness is generic).
- **paper/** — a 2-page AgenticOS vision paper, "An Agent Workspace as a
  Measuring Instrument for the OS It Lacks."
- **docs/** — the analysis chain that drove every decision.

**Coforge is not a Raft-surpassing workspace. It is a wall-detection
instrument that happens to ship a tiny workspace as one of its adapters.**

## How the drift happened (each fork chose cheap/honest/non-Raft-colliding)

1. **docs/04** — set out to build Flot (the 10-strategy Raft-surpasser).
2. **docs/07-09** — costed it: 5 people, 6-9 months, $600-875k to a usable
   clone; "surpass" is 12-18 months. Too expensive for the resources.
3. **docs/10-12** — pivoted to "Claude Code builds the PoC directly," scoped
   down to a minimal C1+C2+C4 workspace (C3 sidestepped). PoC, not product.
4. **PoC built** — the minimal coforge (router + web + Letta→self-hosted
   memory). Walls all present and labeled as non-goals.
5. **paper submission (docs/17-18)** — reframed coforge as "measuring
   instrument" for AgenticOS. docs/19 §4 crystallized the rule: **do not
   build the OS layer in user space** — fixing the walls is "dishonest"
   because they are the OS's job. The walls became the *contribution*, not
   the TODO.
6. **docs/22** — chose direction C (harness as product) over B (become a
   workspace). Rationale: B collides with Raft, is dishonest per §4, burns
   tokens; C has no competitor, is honest, is the "durable artifact."
7. **B2 (docs/23)** — the one wall fixed (memory compression). Only because
   §4 classified it as "redundantly hard but doable," unlike the other five
   which are "structurally impossible in user space."

The drift is not random. **Every fork chose the option that was cheaper,
more honest, or less Raft-colliding.** The accumulation moved coforge from
"product" to "instrument."

## Is the drift a mistake?

Honest answer: **no, it is a rational re-targeting — but it is not what
was asked for.**

- The original ask (docs/01) was "analyze why Raft succeeds + how to build
  a product that surpasses it." coforge-as-instrument does not surpass
  Raft; it *measures* workspaces like Raft. It occupies a different
  category (a tool that inspects the category Raft is in), not the same
  category at a deeper layer.
- The re-targeting was forced by real constraints: resources (docs/09),
  the OS-layer taboo (docs/19 §4), and Raft's head-on collision risk
  (docs/22 B-group). At each fork, the chosen path was defensible.
- But the result is that **none of docs/04's ten strategies shipped**.
  coforge has no multi-view (1), no concurrency (2), no memory inspection
  (3 — B2 is compression, not inspection), no capability addressing (4),
  no trust tiers (5), no AX protocol (6), no verticals (7), no lineage (8),
  no enterprise (9), no pricing (10). Zero of ten.

## What the drift bought (genuinely)

- A real, working, measured instrument (harness, 3 adapters, 6 probes,
  closed-loop B2 verification). This is a *thing*, shippable, with no
  direct competitor.
- A defensible research contribution (paper, accepted-tract-bound).
- Honest scope: coforge never pretended to be a half-built OS.
- Low cost: built for token-money, not salaries.

## What the drift cost

- The original goal — a Raft-surpassing product — is not delivered, and
  the current direction (instrument) will not deliver it. The instrument
  measures gaps; it does not fill them. Filling them is what "surpass
  Raft" meant.
- docs/04's strategies are all still on the shelf, unstarted. The one
  attempted (B2, partial strategy 3) only compresses; it does not give
  memory inspection/provenance/branch/ACL (the "first-class object" part).
- The product identity is ambiguous: is coforge a workspace that happens
  to ship a tester, or a tester that happens to ship a workspace?
  Currently the latter; the former is what was wanted.

## Three honest options for what to do about the drift

1. **Accept the re-targeting.** coforge is an instrument, not a workspace
   product. Drop the "surpass Raft" framing; reposition as the agent-
   workspace wall detector (docs/22 C). The original goal is abandoned
   consciously, not by accident.
2. **Return to the original goal.** Re-engage docs/04's strategies, knowing
   the cost (docs/09) and the OS-layer taboo (docs/19 §4 — which means the
   honest path is docs/08's "pivot features": migratable memory, agent
   observability, protocol layer — not rebuilding OS abstractions). Pick
   one strategy and build it as a product, not an instrument.
3. **Hold both.** Keep coforge-as-instrument (it's real, shippable) and
   fork a workspace-product effort that uses the instrument as its
   measurement layer. The instrument tells you which walls your product
   still hits; the product fills them. This is the most ambitious and the
   most honest about the original goal.

## One-line verdict

> coforge drifted from "a product that surpasses Raft" to "a tool that
> measures where agent workspaces fall short of what an OS would provide."
> The drift was rational at every fork — but zero of docs/04's ten
> strategies shipped, and the current direction will not ship any. To
> return to the original goal requires consciously choosing option 2 or 3,
> knowing the cost and the OS-layer taboo that pushed the project off
> course in the first place.
