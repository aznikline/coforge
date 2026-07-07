# coforge-harness — agent-workspace wall detector

A CLI tool that runs six probes against an agent workspace and reports which
walls it hits: three scaling-pathology walls (growth curves) and three
correctness cliffs (fault-injection rates). Plug any workspace in via the
adapter contract; the harness flags the same walls regardless of
implementation.

This is docs/19's nominated **durable artifact**: useful to the OS community
(consumer-side evidence) and to any agent-app builder (their own diagnosis),
and it does not compete with OS-layer work because it measures the *gap*,
not fills it.

## Quick start

```
cd harness && npm install

# mock workspace — pure local, no LLM/server (good for CI / first run)
npm run probe:mock

# coforge workspace — needs a running router + LLM key
cd ../router && npm run dev        # separate terminal
cd ../harness && set -a && . ../.env && set +a
npm run probe:coforge
```

Output: one block per probe with a verdict (`wall confirmed` / `no`) and the
measured numbers. The verdict, not the raw numbers, is the point.

## Adapters

Three ship; the contract is open for more.

- **mock** (`adapters/mock.ts`) — a pure-local workspace with no LLM. Mirrors
  coforge's wall structure by construction. Use to verify the harness works
  without any external deps. Skips the routing probe (needs an LLM judge).
- **coforge** (`adapters/coforge.ts`) — drives a running coforge-router over
  HTTP. Uses the router's `/api/chat` (mentions + token usage), `/api/reset`
  (clean baseline), and opens the router's SQLite for fault-injection +
  storage observation.
- **langgraph** (`adapters/langgraph.ts`) — drives `langgraph-ws/server.py`,
  a real third-party framework (LangGraph) exposed as HTTP. Uses glm-5.1
  via bailian (BYOK, same key as coforge). Requires the Python venv at
  `harness/.venv-langgraph` and the env vars in `.env`. Run:
  ```
  source harness/.venv-langgraph/bin/activate
  set -a && . .env && set +a
  python3 langgraph-ws/server.py   # port 8788
  npm run probe:langgraph          # in harness/
  ```

Add a fourth by implementing `WorkspaceAdapter` in `src/types.ts`:
`sendMention`, `resetWorkspace`, and optional `faultInjection` +
`storageObserver`. Core and probes do not change.

## Probes (six, two families)

| Probe | Wall | Family | What it measures |
|-------|------|--------|------------------|
| concurrency | serial-queue | scaling | latency vs N concurrent mentions |
| history | prompt-replay | scaling | prompt tokens vs turn count |
| managed-state | unbounded-state | scaling | stored rows vs turn count |
| isolation | isolation-cliff | cliff | cross-agent read cross-rate (100 trials) |
| skills | composition-cliff | cliff | delegation reach rate (20 trials) |
| routing | routing-cliff | cliff | role-mismatch refuse rate (20 trials, LLM judge) |

Two detectors (`analyze.ts`): `detectScaling`/`detectMonotonicGrowth` for
curves, `detectCliff` (cross-rate ≥ 0.9) for fault-injection rates.

## Reports

- `reports/coforge-vs-mock.md` — D3 comparison: both workspaces confirm 5/6
  walls (mock skips routing, no LLM). Proves the harness is generic, not
  coforge-specific. Also notes the routing probe's LLM-judge instability
  (coforge's routing result flipped 100%→30% across runs).

## Honest limitations

- The routing probe uses an LLM judge (same model the workspace uses); its
  verdict is not deterministic. A robust version would majority-vote N passes.
- The skills probe is a weak proxy (no scalar metric for composition exists).
- mock is author-written; a third-party adapter (Letta/etc.) is the real
  generality proof, still future work.

## Relation to the paper

The six probes implement the measured rows of `paper/main.tex` §3's
measurement table. `paper/evidence/bench.json` holds the raw numbers.
