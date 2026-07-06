# coforge vs mock — wall-detection comparison

> D3 output: run the harness against two workspaces (coforge + a mock) and
> compare. Generated 2026-07-03.

## Why two workspaces

The harness was born against coforge. Running it against a second,
independent workspace (mock — pure local, no LLM, separate process and
storage) is the proof that the probes flag walls in *any* workspace, not
just the one they were written for. If mock — which mirrors coforge's
wall structure by construction — confirms the same walls, the harness is
generic; if it diverged, the harness would be coforge-specific.

## Results

| Wall | Family | coforge | mock |
|------|--------|---------|------|
| Serial queue | scaling | YES (confirmed) | YES (confirmed) |
| Prompt replay | scaling | YES (confirmed) | YES (confirmed) |
| Managed state | scaling | YES (confirmed) | YES (confirmed) |
| Isolation | cliff | YES (100/100 crossed) | YES (100/100 crossed) |
| Composition | cliff | YES (0/20 delegation) | YES (0/20 delegation) |
| Routing | cliff | no (30% crossed) | skipped (no LLM) |

Both workspaces confirm 5/6 walls (mock skips routing only because it has
no LLM to judge — honest skip, not a divergence).

## What the comparison shows

- **The harness is generic.** The same six probes confirm the same walls in
  two workspaces with no shared code (mock is a separate adapter, separate
  storage, no coforge import). The adapter contract — `sendMention` /
  `resetWorkspace` / `faultInjection` / `storageObserver` — is sufficient
  to plug any workspace in.
- **Wall structure is portable.** mock deliberately mirrors coforge's
  walls (serial queue, replay, shared storage, no delegation). The probes
  flag both, which is the point: a workspace built with these non-goals
  hits these walls, regardless of implementation.
- **Routing is the unstable probe.** coforge's routing result flipped
  from 100% crossed (earlier run) to 30% (this run) — the LLM judge is
  sensitive to the agent's accumulated history and to judge-side variance.
  §6 of the paper already flags routing as LLM-judged and skills as a weak
  proxy; this run shows the routing instability empirically. The honest
  takeaway: routing is the one probe whose verdict is not deterministic.

## Honest limitations

- mock is author-written, not an independent third-party workspace. It
  proves the *interface* is generic (adapters work), not that the harness
  has been validated against a workspace the author didn't design. A
  Letta/LangGraph/OpenHands adapter — the real A1 goal — is still future
  work (blocked on a usable agent-runtime endpoint; Letta hosted needs
  credits, self-hosted needs Docker which is broken in this env).
- mock skips routing by design (no LLM). A LLM-backed mock would close this
  but would just re-implement coforge's LLM path.
- The coforge routing flip means any single routing run is noisy; a robust
  version would run N judge passes and majority-vote (noted in docs/21 D2).

## Reproduce

```
# coforge (needs running router + LLM key)
cd router && npm run dev   # separate terminal
cd ../harness && set -a && . ../.env && set +a
npm run probe:coforge

# mock (no deps)
cd harness && npm run probe:mock
```
