# Three-way comparison — coforge vs mock vs langgraph

> D3 (revised): run the harness against three workspaces. langgraph replaces
> mock's "author-written" caveat — it is a real third-party framework (pip-
> installed, no Docker/Letta credits), driven through an HTTP service
> (langgraph-ws/server.py) using glm-5.1 via bailian (BYOK, same key as
> coforge). Generated 2026-07-07.

## Why three

mock proved the harness *interface* is generic (adapters work for non-
coforge code). langgraph proves the harness flags walls in a workspace built
on a **real independent framework** — and because langgraph has different
internals (an async graph, a MemorySaver checkpointer), it diverges from
coforge on some walls. Divergence is the point: it shows the probes surface
real differences, not a canned pass.

## Results

| Wall | Family | coforge | mock | langgraph |
|------|--------|---------|------|-----------|
| Serial queue | scaling | YES | YES | **no** |
| Prompt replay | scaling | YES | YES | **unmeasurable** (usage=0) |
| Managed state | scaling | YES | YES | YES |
| Isolation | cliff | YES (100/100) | YES (100/100) | YES (100/100) |
| Composition | cliff | YES (0/20) | YES (0/20) | YES (0/20) |
| Routing | cliff | no / unstable | skipped (no LLM) | **timeout** |

## What the comparison shows

- **Serial queue diverges.** coforge serializes (latency 3.3→27.3s over
  N=1..8, linear); langgraph does not (1451/1658/3457/2431ms, flat-ish). This
  is a real architectural difference: langgraph-ws serves concurrent
  /chat requests via uvicorn's async loop, while coforge's router enforces a
  per-channel serial queue. The probe correctly distinguishes them — the
  harness is not a canned "always-confirm" tool.
- **Prompt replay is unmeasurable on langgraph.** langchain's ChatOpenAI did
  not surface token usage from the bailian endpoint (response_metadata had
  no token_usage), so the probe read 0 tokens every turn. The detector was
  fixed to return "no" on a zero baseline (vacuous growth) rather than a
  false "YES." Honest: this probe cannot evaluate langgraph without a
  usage-surfacing fix in langgraph-ws. (langgraph-ws/server.py reads
  `resp.response_metadata.token_usage`; bailian may report it under a
  different key, or langchain drops it — left as a known gap.)
- **Managed state holds on langgraph too.** langgraph-ws writes each turn
  to a shared SQLite (2 rows/turn → 1,2,…,20 over 20 turns, linear). The
  MemorySaver checkpointer is in-memory and not the source of truth for
  history (rebuilt from SQLite each turn), so it does not actually provide
  an eviction/lifecycle abstraction for the stored rows. The wall holds.
- **Isolation and composition are universal.** All three workspaces cross the
  isolation boundary 100/100 (all share a store any code path can read) and
  fail delegation 0/20 (none has an inter-agent call path). These two walls
  appear to be structural to the "agent workspace" shape, not specific to
  one implementation — the strongest evidence yet for the §4
  enforcer==enforced-upon argument.
- **Routing remains the unstable probe.** coforge's routing result flipped
  100%→30% across runs (LLM judge variance); on langgraph the probe timed
  out (the /chat call + a second judge LLM call doubled latency, hitting
  fetch's headers timeout). §6's "routing uses an LLM judge" caveat now has
  measured evidence across two workspaces.

## Honest limitations

- langgraph-ws is author-written (the HTTP wrapper around langgraph), even
  though langgraph itself is a third-party framework. The agent loop is
  mine; only the runtime is external. A purer test would point the adapter
  at an unmodified third-party agent server — still future work.
- The prompt-replay gap is fixable (find where bailian/langchain reports
  usage) but unfixed here; the probe honestly returns "no" rather than
  fabricating.
- The routing timeout is a probe-side robustness gap (no per-trial fetch
  timeout + skip-on-failure), flagged in docs/21 D2.

## Reproduce

```
# langgraph (needs the venv + LLM key)
cd /Users/wizout/op/slock
source harness/.venv-langgraph/bin/activate
set -a && . .env && set +a
python3 langgraph-ws/server.py   # port 8788, separate terminal
cd harness && set -a && . ../.env && set +a && npm run probe:langgraph

# coforge (router) and mock — see harness/README.md
```

## Implication for the harness-as-product direction (docs/22 C)

The three-way run is the strongest validation yet that the harness is a
generic instrument: it flagged the same universal walls (isolation,
composition, managed-state) across three implementations, and correctly
*did not* flag the serial-queue wall where langgraph genuinely avoids it.
A tool that only ever said "wall confirmed" would be useless; this one
distinguishes real architecture. That is the case for C1 (harness as
distributable tool) holding up beyond coforge.
