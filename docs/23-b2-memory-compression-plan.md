# 23 · B2 — memory compression (the one honest in-user-space wall fix)

> Direction: fix coforge's prompt-replay wall by adding summarization +
> recent-buffer. This is the only wall docs/19 §4 says is honest to fix in
> user space (the wall is "redundantly hard," not "structurally impossible"
> like isolation or concurrency).

## The tension with the paper (must be named)

paper §3.2 measures the prompt-replay wall (tokens 39→308 over 8 turns,
linear) — that evidence **disappears** if B2 ships on by default. Resolution:
a `COMPRESS_MEMORY` env switch. Default **on** (coforge as usable workspace,
the wall is fixed). Off (paper / measurement reproduction) the wall returns.
harness's history probe, run against a compress-on coforge, should flip
from `YES (wall confirmed)` to `no` — the same instrument that found the
wall verifies its fix. This is the cleanest possible closed loop.

## Design — summarization + recent buffer

When an agent's history exceeds a threshold, the oldest turns are
summarized into one `system` row; the most recent turns stay verbatim. Only
re-trigger summarization at the boundary, not every turn.

- **N (trigger threshold)** = 10 turns (20 rows). Below this, full replay
  (unchanged behavior, zero overhead).
- **K (recent buffer kept verbatim)** = 4 turns (8 rows). The rest of the
  history above N is summarized.
- **Summarize cadence**: only when history crosses N+K. Each summarization
  folds the oldest (history.length - K) turns into the running summary,
  then deletes those rows. Next trigger only when it again crosses N+K.
- **Summary row**: `role="system"`, content=`"Summary of earlier
  conversation: <LLM-generated>"`. `loadMemory` is changed to surface this
  row first (as a system message in the prompt, before the persona).
- **Summarizing LLM call**: one `callLLM` with a "summarize this
  conversation so far" prompt over the old turns. Costs tokens once per
  trigger; saves them every turn thereafter.

## Module changes

### `router/src/config.ts`
- add `compressMemory: process.env.COMPRESS_MEMORY !== "false"` (default
  true). `COMPRESS_MEMORY=false` → full replay (paper mode).

### `router/src/memory.ts`
- widen the role type to allow `"system"` for summary rows.
- add `summarizeOld(agent, keep)`: reads rows beyond the most recent `keep`,
  calls a passed-in LLM summarizer, writes one `system` summary row,
  deletes the summarized rows. (memory.ts stays LLM-free; the summarizer
  is passed in from agents.ts to avoid a circular dep.)
- `loadMemory` unchanged in shape (returns all rows for an agent); the
  prompt-assembly logic in agents.ts decides what to include.

### `router/src/agents.ts` — `talkToAgent`
- after `appendMemory(user)`, if `compressMemory` and history > N+K rows:
  call `summarizeOld(agent, K*2)` with a summarizer that uses `callLLM`.
- assemble prompt: `[persona/system, summary-system?, ...recent-K-turns]`
  instead of `[persona, ...all-history]`.
- when `compressMemory` is false, the path is exactly today's (paper mode).

### `harness/src/probes/history.ts`
- no code change. Re-run against a compress-on coforge: the probe should
  report tokens plateauing after N turns (summary kicks in), verdict `no`.
  This is the verification artifact.

## Honest accounting of the token trade

- Without compression: turn T costs `prompt_tokens(T) ∝ T` (full replay).
  Over M turns, total ∝ M².
- With compression: each turn costs `summary_tokens + K turns` ≈ constant
  after the first trigger; plus one summarize call per trigger (≈ every
  N turns). Total ≈ O(M) + O(M/N) summarize calls.
- Break-even: compression wins once history ≫ N. For a short session
  (<N turns) it never triggers and costs nothing extra. For a long-running
  agent (the AgenticOS "days/weeks" case) it is the difference between
  affordable and not.

The paper §3.2 "agent that persists across days becomes costly" is exactly
the case B2 fixes — and the fix is honest in user space (unlike isolation).

## Acceptance

1. `COMPRESS_MEMORY=false npm run dev` → harness history probe still says
   `YES (wall confirmed)` (paper mode intact, 39→308 reproduces).
2. `COMPRESS_MEMORY=true npm run dev` (default) → harness history probe
   says `no` (tokens plateau after ~10 turns; wall fixed).
3. A long conversation (20+ turns) under compression still recalls early
   facts (summary carries them) — manual check.
4. No regression in the other 5 probes (they don't touch this path except
   managed-state, which counts rows — note: summary rows change the row
   count; managed-state probe may need a note that compression reduces
   row growth, which is itself evidence the wall is being addressed).

## What this does NOT do

- Does not fix the other walls (isolation/concurrency/routing/skills) —
  those are the OS-layer work docs/19 §4 says to leave alone.
- Does not change the paper text — the paper still reports the
  uncompressed measurement; B2 is a coforge-product improvement that the
  paper's measurement can reproduce by flipping the switch off.
- Does not claim compression is as good as a runtime-managed memory
  object — it is still user-space best-effort (the summary could lose
  detail). It is "redundantly hard but doable," which is exactly the
  honest category docs/19 put it in.
