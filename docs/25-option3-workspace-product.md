# 25 · Option 3 — workspace product + harness as diagnostic layer

> Decision: keep the harness as a diagnostic layer (docs/22 C, done), and
> fork a workspace-product effort that uses it. The original goal was a
> Raft-like human-agent co-building community; this returns to it, knowing
> the cost (docs/09) and the OS-layer taboo (docs/19 §4).

## What "Raft-like community, human-agent co-building" actually means

From docs/02 (Raft's success factors), not from feature lists:
- agents have **persistent identity + compounding memory** (cross-day,
  cross-task; a second briefing is shorter than the first)
- agents are **autonomous** (self-schedule, set their own reminders, join
  channels, claim work)
- **organic team formation** (roles emerge, not assigned)
- the channel is a **human-agent shared collaboration surface** (agents
  are first-class participants, not invoked tools)
- humans have identity; there is a team feel

coforge-as-instrument has none of this. The workspace product must build it.

## The OS-layer taboo, re-scoped correctly

docs/19 §4 says "don't build OS abstractions in user space." This does
**not** forbid a Raft-like workspace product. Raft itself is an application-
layer workspace; it doesn't build OS abstractions either. The taboo forbids
only the two walls that are *structurally impossible* in user space:
- B1 (real concurrency/correctness across agents)
- B3 (runtime-enforced isolation)

Everything else a Raft-like product needs is **application-layer feature
work**, not OS work:
- agent persistent identity + memory → application storage (B2-extended)
- agent autonomy (self-scheduled reminders, proactive messages) →
  application scheduling (a cron + a queue — NOT multi-agent correctness)
- multi-view, capability routing → application UI/logic
- multi-user → application accounts (B4, last)

The confusion that pushed coforge off course was treating "agent autonomy"
as if it required OS-level scheduling. It doesn't: a single agent setting
its own reminder and posting later is an application timer, not a scheduler.
The taboo only bites if you try to make N agents correctly coordinate
without an OS — which the MVP does not attempt.

## MVP scope — turn the router into a real collaboration space

The current router is a "test stub": 3 fixed agents, single "general"
channel, "you" with no identity, agents only reply when @-mentioned. The
MVP makes it a minimal but real collaboration space a person can actually
use over days:

### M1 — human identity + persistent agent identity
- **Human identity**: replace the "you" literal with a named user (config
  in .env or a tiny users table). Single user for now (B4 adds accounts).
- **Agent persona evolution**: agents' personas are no longer frozen JSON.
  After each turn, the agent can append a "what I learned about this user/
  team" note to its own persona block (the B2 summarizer already writes
  summary rows; extend it to also maintain a living persona row). This is
  the "compounding memory" Raft factor — a second briefing is shorter
  because the agent remembers.
- Acceptance: tell Noel your name day 1; kill router; restart day 2; Noel
  still knows your name AND its persona reflects "this user is building X."

### M2 — the channel as a real collaboration surface (agents can initiate)
- Currently agents only respond to @mentions. Raft's agents **initiate**
  (self-scheduled reminders, proactive notices). M2 adds:
  - **agent reminders**: an agent can be told "remind me tomorrow" or set
    its own reminder; a per-agent timer fires and posts to the channel as
    that agent (not @-invoked). This is an application timer, not multi-
    agent coordination — explicitly within the OS taboo's safe zone.
  - **agent proactive posts**: an agent with a pending reminder/follow-up
    posts to the channel on its own schedule, attributed to the agent.
- This is the single biggest "feels like Raft" change: the channel is no
  longer a help-desk queue, it has agent presence.
- Acceptance: @Noel "remind me to check the deploy tomorrow 9am"; at 9am
  Noel posts unprompted "Reminder: check the deploy." Kill/restart the
  router before 9am — the reminder survives (persisted).

### M3 — harness as the diagnostic layer (already built, just wire it)
- Run the harness against the M1+M2 workspace. The walls that move (prompt-
  replay softens with B2 compression; others may appear as autonomy changes
  the surface) become the product's own progress dashboard.
- Acceptance: `npm run probe:coforge` against the M2 router shows which
  walls the product still hits — the instrument is now guiding the product.

## Out of MVP scope (explicitly)

- B1 real concurrency — leave to OS (taboo).
- B3 runtime isolation — leave to OS (taboo); the isolation-stub remains
  the honest proof it's best-effort in user space.
- B4 multi-user/accounts — last, after single-user collaboration is real.
- B6 multi-view, B5 capability routing — valuable but layer on top of the
  collaboration space; do after M1/M2 make it actually a space.
- Organic team formation (agents claiming work from a board) — needs M1+M2
  first; a future milestone, not MVP.

## What this does NOT do

- Does not abandon the harness — it stays as the diagnostic layer and
  ships alongside (C1+A1+D3 done). The product and the instrument coexist;
  the instrument measures the product.
- Does not pretend to surpass Raft on day one — M1/M2 reaches "minimal
  real collaboration space," not "deeper than Raft." docs/04's ten
  strategies remain post-MVP.
- Does not re-introduce the OS-layer taboo confusion: autonomy = application
  timer, not OS scheduler. The line is drawn at "N agents coordinating
  correctly," which the MVP does not cross.

## One-line

> Option 3: keep the harness (done), build a workspace product on top of
> the router — M1 human+agent persistent identity, M2 agents that initiate
> (reminders/proactive posts), M3 harness measures the product's walls.
> Multi-user (B4) last; OS-layer walls (B1/B3) explicitly left to the OS.
> The OS-layer taboo is re-scoped correctly: it forbids multi-agent
> correctness, not agent autonomy — so a Raft-like product is buildable.
