# coforge harness — wall detector

A measurement tool that, given an agent-workspace adapter, reports where the
workspace scales linearly (scaling-pathology walls) and exposes a
fault-injection hook for correctness cliffs (interface only, not implemented
this round).

This is docs/19's nominated **durable artifact**: useful to the OS community
(consumer-side evidence) and to any agent-app builder (their own diagnosis),
and it does not compete with OS-layer work because it measures the *gap*,
not fills it.

## Run

Start coforge-router in one terminal:

```
cd ../router && npm run dev
```

Run the harness in another:

```
npm install
npm run run      # or: npx tsx src/index.ts
```

Output flags each wall as `linear-growth: YES (wall confirmed)` or `no`,
with the measured points. The verdict, not the raw numbers, is the point.

## Probes (scaling, this round)

- **concurrency** — fire N=1,2,4,8 concurrent @mentions, report wall-clock
  vs N. Serial-queue wall → latency scales with N.
- **history** — hold an 8-turn conversation, report prompt-tokens vs turn.
  Prompt-replay wall → tokens grow monotonically with history.

Two detectors, because the walls grow differently (see `src/analyze.ts`):
`detectScaling` (y-ratio tracks x-ratio) for concurrency, `detectMonotonicGrowth`
(monotonic + meaningful increase) for history.

## Adapters

`src/adapters/coforge.ts` drives coforge-router over HTTP (`/api/chat` for
mentions, `/api/reset` for a clean baseline). Add another workspace by
implementing the `WorkspaceAdapter` interface in `src/types.ts` — core and
probes do not change.

## Out of scope (this round)

- Other adapters — interface only.
- Correctness-cliff probes (prompt injection, capability mismatch) — the
  `WorkspaceAdapter` interface leaves a `faultInjection?` hook for later.
- A web UI — CLI + the per-probe verdict is enough.

## Relation to the paper

The two probes implement the two measured rows of `paper/main.tex` §3
(serial queue, prompt-replay). The harness is the generalization of
`paper/evidence/bench.py` into a reusable tool.
