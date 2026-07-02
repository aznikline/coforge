# Novelty search — result and honest caveat

Ran the `question-validator` skill's `novelty_search.py`
(`~/op/autoresearch/skills/academic/question-validator/references/novelty_search.py`)
on the paper's core claim on 2026-07-02.

## Queries (all returned 0 hits)

1. "application-layer agent workspace reveals missing operating system
   abstractions for AI agents"
2. "operating system abstractions for LLM agents consumer-side evidence"
3. "OS for AI agents missing abstractions"
4. (sanity) "AgentCgroup OS resources AI agents" — a known AgenticOS paper title
5. (sanity) "agent operating system LLM" — a topic with known existing literature

## Why 0 hits is NOT a novelty verdict here

The skill's discipline rule 1 says the verdict must be grounded in the
search, never in memory. **But the search did not function in this
environment.** Direct API probes at the same time:

- OpenAlex: HTTP 503 — "Anonymous search is temporarily rate-limited due to
  heavy load. Please retry shortly, or use a free API key."
- arXiv: HTTP 301 (redirect, no results returned).

The sanity queries (4, 5) — which *should* return hits, since the AgenticOS
1st-edition papers and the broader "agent OS" literature demonstrably exist
— also returned 0. That is the tell: the searches failed, not the literature
being empty.

Per the skill's own rule ("absence of evidence is not evidence of absence"),
and given the search itself was unavailable, **no grounded novelty verdict
can be issued from this run.** A 0-on-a-broken-search is worthless either
way: it cannot support "novel" and it cannot support "not novel."

## What we can say (clearly labeled as not-a-grounded-verdict)

From the non-search prior-art scan in docs/19/20 (R1), the *genre* —
"argue from a real application's limitations upward to missing OS
abstractions" — has prior instances: exokernel, Dune, unikernel, kernel-bypass
(DPDK/AF_XDP). That scan is **memory-based, not a grounded search**, so it
does not satisfy the skill either. It is a pointer for a human to do the real
search, not a substitute for it.

## What this means for the paper

- Do **not** write in the paper "to our knowledge no prior work..." — the
  grounded search to support that did not run.
- The paper currently does not make such a claim, so nothing needs retracting.
- Before submission, run `novelty_search.py` from an environment with
  working OpenAlex/arXiv access (or with a free OpenAlex API key set). If it
  returns hits, review them for overlap; if it returns 0 on a *working*
  search, the honest verdict is still "no overlapping hit found as of
  <date>," never "novel."
- The paper's positioning as "consumer-side evidence" (not "the first to
  argue from applications to OS") survives regardless — the contribution is
  the layer (agent runtime), and docs/19/20 already concluded the method is
  a known genre, not an invention.
