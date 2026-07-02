# 18 · Can coforge submit to AgenticOS 2026?

> Question: can coforge be submitted to the 2nd AgenticOS Workshop (SOSP 2026)?
>
> **Short answer: yes, as a 1–2 page vision paper — but only with a specific
> reframing.** As-is, coforge is an application-layer PoC and would be rejected
> as off-topic for an OS workshop. Reframed around the interface where coforge
> *meets* OS-level concerns, it becomes a legitimate vision submission. The
> deadline is the real constraint.

## Hard facts about the venue

- **Deadline**: 2026-07-08 (Anywhere on Earth, already extended). From today
  (2026-06-30) that is **~8 days**.
- **Format**: ACM double-column, double-blind, ≥2 reviewers, via HotCRP.
- **Vision paper**: 1–2 pages (excl. references). Explicitly for "early-stage
  ideas, position statements, ongoing projects, demos, and insights from
  production systems." They "strongly welcome contributions from industry
  practitioners and the open source community."
- **Eligibility**: arXiv OK; concurrent submission elsewhere OK; **no formal
  proceedings** (accepted papers appear only on the website, does not block
  future publication).
- **No-proceedings + welcome-open-source + welcome-ongoing-work** is the
  most permissive combination possible. The bar is "a defensible position +
  something real behind it," not "a finished systems paper."

## The core problem: coforge is off-topic as-is

coforge is an **application/workspace layer** project: `@mention` routing,
per-agent memory in SQLite, a serial queue, a React UI. AgenticOS is an
**OS layer** workshop: agent-aware cgroups, fork/explore/commit, execute-only
isolation, skills-as-apps.

A submission titled "coforge: a multi-agent chat workspace" would draw the
reviewer comment: *"this is a chat app, not an OS contribution."* That is a
fair rejection. The application does not, by itself, constitute an OS
abstraction argument.

## The reframing that makes it on-topic

docs/17 already identified the real interface: **coforge hand-rolls, badly and
by admission, exactly the primitives AgenticOS wants to make OS-level.** That
is the submission. Not "here is our app" but:

> **"What an application-layer agent workspace reveals about the OS
> abstractions it is missing."**

The argument structure:

1. **We built a real, open-source multi-agent workspace** (coforge) and ran it.
2. **At every hard problem, we hit a wall that is not an application problem
   but a missing-OS-primitive problem**, and we had to hand-roll a degraded
   workaround.
3. **The workarounds are the evidence.** Each one is a place where an OS
   abstraction should exist and does not.

This turns coforge's honest non-goals (docs: "no real concurrency, no
isolation, no memory compression") from limitations into **the research
contribution** — they become the enumerated list of OS abstractions the agent
stack lacks.

## The concrete mapping (this is the paper's spine)

| coforge's workaround | What it hand-rolls | The OS abstraction it wants |
|----------------------|-------------------|----------------------------|
| Serial queue per channel | Sidesteps multi-agent concurrency entirely | Semantics-aware agent scheduling (AgentCgroup / scheduling topic) |
| Full history replayed into prompt | No compression, no episodic layer | Long-lived state abstraction for agent context/memory (state topic) |
| All agents share one process + one DB | No isolation between agents | Execute-only / attested-channel isolation (security topic) |
| `agents.json` personas | Hand-written capability bundles | Skills-as-apps composition unit (Skill OS line) |
| `@mention` regex routing | No capability matching, no delegation | Agent-facing interface / IPC redesign (OS interfaces topic) |
| `coforge.db` on local disk | No managed memory object | Agent state as an OS-managed object (state topic) |

Every row is a coforge design decision that maps onto an AgenticOS topic.
That mapping **is** the vision: an application that, by being honest about
what it could not do, surfaces the OS primitives the agent era needs.

## Why this angle is defensible

- **It is grounded in a real build**, not just speculation. The workarounds
  exist in code; reviewers can read them. This is exactly the "insights from
  production systems" the vision track asks for.
- **It contributes from the consumer side of the OS interface**, which the OS
  community under-hears from. OS workshops get lots of "here is a new kernel
  primitive"; they get little "here is what the application layer is starved
  for." That inversion is a legitimate position.
- **It does not claim to be an OS contribution.** It claims to be evidence
  for one. Vision papers are the right venue for exactly this.

## What coforge needs before submitting

The code is enough to substantiate the claims, but a submission needs:

1. **A 1–2 page ACM double-column vision paper** arguing the mapping above.
   ~8 days is tight but a 2-page position paper is writable in 2-3 focused
   days; the rest is editing.
2. **Anonymization for double-blind review.** coforge is public on GitHub
   under a named account. Double-blind does not require the code to be
   secret — it requires the *paper text* to not identify authors. Cite the
   system as "an open-source agent workspace (anonymized for review)" and
   avoid author/owner names in the text. The repo can be shared via an
   anonymized link if a reviewer asks, but is not required in the submission.
3. **One concrete worked example per row** in the mapping — a short trace
   from coforge showing the workaround hitting its wall. This is what makes
   it "insights from a real system" rather than a position statement anyone
   could write.
4. **A clear "what we are not claiming" paragraph**: coforge does not propose
   a new OS; it surfaces the abstractions an application needs. This preempts
   the "where is the OS contribution" rejection.

## The honest risk

Even reframed, the angle can be rejected as:
- *"This is a list of missing features framed as OS gaps — not every missing
  feature is an OS abstraction."* Mitigation: tie each row to a *specific*
  AgenticOS topic and argue why it is a primitive, not a feature.
- *"Anecdotal evidence from one app does not generalize."* Mitigation: ground
  each gap in why *any* agent workspace would hit it, not just coforge.
- *"8 days is not enough to write a good paper even at 2 pages."* Real. A
  rushed 2-pager that is half-baked is worse than not submitting. The
  no-proceedings rule means a rejected submission costs nothing, but a
  weak submission wastes the angle for a future, better one.

## Recommendation

- **If you can give it ~3 focused days in the next 8**: write the vision
  paper around the mapping above. The angle is real, the venue is permissive,
  and the no-proceedings rule means downside is near zero. Worth doing.
- **If you cannot free the days**: do not rush. The same angle can go to the
  next AgenticOS edition or a sister venue (the 1st edition was at ASPLOS;
  the series continues). A weak 2-pager under deadline pressure burns an
  angle that a careful version would land.
- **If you want to strengthen it first**: the single highest-leverage addition
  is one quantitative trace — e.g. "at N agents / M turns, the serial queue
  adds Xs latency and the prompt-replay memory costs Y tokens, and neither
  is fixable in the application layer without re-implementing OS-level
  scheduling and a managed memory object." One number per row turns the
  mapping from a position into evidence.

## One-line answer

> Yes, coforge can submit to AgenticOS 2026 as a 1–2 page vision paper — but
> only reframed from "here is our app" to "here is what building a real agent
> workspace revealed about the OS abstractions it is missing," with each of
> coforge's honest workarounds mapping onto a specific AgenticOS topic. The
> angle is legitimate and the venue is permissive (no proceedings, welcomes
> open-source/ongoing work); the real constraint is the 8-day deadline and
> whether you can write a careful 2-pager in time.
