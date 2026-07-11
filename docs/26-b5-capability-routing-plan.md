# 26 · B5 — capability routing

> Direction: fix the routing cliff (paper §3, "mismatched task refused 0/20")
> with capability addressing. docs/04 strategy 4. The only honest-in-user-space
> fix for this wall (routing is "redundantly hard," not "structurally
> impossible" like isolation — docs/19 §4). Cheapest of the remaining B walls,
> and a prerequisite for B6 multi-view.

## What changes

### agents.json — each agent declares skills (keyword list)
- Noel: `["frontend", "ui", "react", "css", "design", "render"]`
- Pat: `["backend", "sql", "db", "api", "postgres", "query"]`
- Sam: `["docs", "writing", "readme", "documentation", "explain"]`
- `skills` is added to `AgentConfig` (types.ts).

### parseMention — two addressing modes
1. **by name** (existing): `@Noel ...` → routes to Noel.
2. **by capability** (new): `@frontend ...` / `@backend ...` / `@docs ...`
   → routes to the agent whose `role` or `skills` matches the capability word.
   If no agent matches, return a "no agent with that skill" error (not a
   silent fallback to a wrong agent).

### mismatch hand-off (the routing-cliff fix)
- When `@Noel(frontend) write a SQL query` arrives: the body contains a
  keyword (`sql`) that belongs to Pat's skills, not Noel's.
- With `CAPABILITY_ROUTING=true` (default): the system detects the mismatch
  (the @-mentioned agent's skills don't cover a strong keyword in the body),
  routes to the agent whose skills *do* match, and posts a hand-off note
  ("routed to Pat — SQL is backend"). This is the routing cliff being fixed.
- With `CAPABILITY_ROUTING=false`: today's behavior (Noel answers the
  mismatched task badly, 0/20 refuse). Paper reproduction mode.

### config
- `capabilityRouting: process.env.CAPABILITY_ROUTING !== "false"` (default
  true). Off = paper's routing cliff reproduces (regex @name only, no
  hand-off).

## Verification (closed loop, like B2)

The harness routing probe (the one that timed out / was unstable on
langgraph, was 0/20 refuse on coforge) should flip:
- `CAPABILITY_ROUTING=true` → mismatched tasks get handed off (cross rate
  drops from 100% to low) — wall fixed.
- `CAPABILITY_ROUTING=false` → 0/20 refuse, wall confirmed (paper mode).

Note: the routing probe uses an LLM judge. The hand-off is keyword-based
(not LLM), so it is deterministic — but the probe's *measurement* of whether
a hand-off happened is still LLM-judged. The fix is deterministic; the
measurement is noisy. §6 already flags this.

## Honest scope limits

- Keyword matching, not semantic capability routing. `@backend` works;
  `@the-person-who-knows-databases` does not. MVP floor.
- Hand-off routes to one matched agent; it does not negotiate between
  multiple candidates. Single-best-match only.
- Does not fix the other 5 walls. B1/B3 are OS-layer (taboo); B2 is done
  (compression); managed-state/skills/composition remain.

## Acceptance

1. `@backend write a SQL query` → routes to Pat (capability addressing).
2. `@Noel write a SQL query` with CAPABILITY_ROUTING=true → hand-off to Pat
   + a hand-off note in the channel.
3. `@Noel write a SQL query` with CAPABILITY_ROUTING=false → Noel answers
   (paper's routing cliff reproduces).
4. Harness routing probe: CAPABILITY_ROUTING=true lowers the crossed-rate
   vs false.
