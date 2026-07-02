# 21 · Post-submission ideas — spec after measuring the 3rd wall

> Triggered by the (c) work: measuring the isolation cliff (100/100) and
> reframing the 2:4 split via the community's 10:2 ratio surfaced new
> structure that docs/19/20 did not have. This file specs the buildable work
> and the investigation directions, and notes where docs/20 is now stale.

## What changed since docs/20

docs/20 A.4 listed "correctness-cliff probes — interface stubbed, not
implemented" as out of scope. **(c) implemented the isolation cliff probe.**
So docs/20 is stale on this point. This file supersedes docs/20 A.4: the
fault-injection interface is real, one cliff probe ships, and the remaining
three are now in scope.

## The new insight (not in docs/19)

docs/19 §3 *named* the scaling/cliff split. (c) *operationalized* it: a cliff
can be measured, but with a different instrument (a fault-injection rate,
not a growth curve). This means the six walls are not a homogeneous set
measured at 33% coverage; they are a heterogeneous set requiring two
measurement paradigms. "6/6 measured" does not mean six growth curves — it
means two curves + four rates. This is a small methodological claim in
itself (see investigation A).

## Buildable work packages

### D1 — managed-state probe (scaling side)

**Wall**: managed state (Table 1 row 6). The wall has two faces; the cheap,
objective one is storage growth with no eviction. `memory.ts` is append-only
with `clearMemory` only on `/api/reset` — no runtime eviction. So rows grow
unboundedly with turns.

**Probe**: extend the history probe's turn-loop to M=20+ turns and report
`SELECT COUNT(*) FROM agent_memory WHERE agent=?` vs M. Linear growth =
wall confirmed (no managed-state abstraction).

**Why this row and not a cliff**: managed-state's *cliff* face (no
lifecycle/migration/attested recovery) needs a long-horizon run exceeding
process lifetime — out of PoC reach. The scaling face (unbounded growth)
is cheap and objective. Honest: this is a scaling probe mislabeled as a
cliff in docs/19; correct it here.

**Cost**: ~10 lines, reuses history probe's loop. Returns `kind:"scaling"`,
`wall:"unbounded-state"`.

### D2 — routing cliff probe

**Wall**: capability routing (Table 1 row 5). `parseMention` routes by
@name regex, zero capability matching, zero delegation.

**Probe**: construct N=20 tasks where the @mentioned agent is the wrong one
(e.g. `@Noel(frontend) write a SQL query`). LLM-judge the reply for
refuse/hand-off/answer-wrongly. Today hand-off rate ~0% (always answers,
badly) = cliff confirmed (no routing abstraction). Target under real
routing → high hand-off.

**Subjectivity risk**: LLM-judge. Mitigate: judge only "did the reply
attempt the task" (binary, low-judgement), not "was it good". Multiple
judge passes, majority vote.

**Cost**: medium — new probe + a judge call per trial. Returns
`kind:"cliff"`, `wall:"routing-cliff"`.

### D3 — skills cliff probe (weak proxy, honest)

**Wall**: skills-as-composition (Table 1 row 4). No clean scalar metric;
the cheapest proxy is a binary delegation test.

**Probe**: `@Noel ask @Pat to summarize X` — does the work reach Pat?
`parseMention` matches only the first @name via one regex and has no
inter-agent call path, so the answer is structurally no. N=20 delegation
attempts, report delegation-success rate. Today ~0% = cliff confirmed
(no composition abstraction).

**Honesty**: this is a weak proxy for "skills as composition unit", not a
direct metric. The probe note must say so. Acceptable because the wall is
inherently qualitative; a binary pass/fail is the honest floor.

**Cost**: small — reuses sendMention, checks if Pat's reply appears.
Returns `kind:"cliff"`, `wall:"routing-cliff"` (reuses union; or add
`"composition-cliff"`).

### D4 — wire all probes into harness, update paper to "6/6 measured"

After D1-D3, harness runs 6 probes (2 scaling + ... reclassify: managed-
state is scaling, so 3 scaling + 3 cliff). Paper §3 lists all six as
measured, §3 intro reframe updated, §5 10:2 anchor kept. Target: still
2 pages — D1-D3 add ~3 small subsections; will require trimming §4/§5
further or accepting a 3rd page for the camera-ready (workshop permits
up to 6 pages for research, 2 for vision — if this grows past 2, reclassify
the submission from vision to research track, 6 pages).

**Decision point**: if 6 probes push past 2 pages, switch to the 6-page
research track and expand each wall's measurement. That is a bigger paper
but a stronger one.

## Investigation directions (not built, scoped)

### C — Is the 10:2 performance:security imbalance systematic?

**Status**: docs/20 R3 found 10:2 in the AgenticOS 1st edition (one data
point). That is not "systematic." To claim a field-level imbalance, scan:
- AgenticOS 2nd edition (SOSP 2026) accepted papers — same classification.
- SOSP/OSDI/ASPLOS 2024-2026 papers mentioning "agent" — classify
  performance vs security.
- Is the imbalance stable across venues/years?

**Method**: same classification as docs/20 R3 (per-paper perf/security
label). Output: a small table (venue × year → perf:security ratio) + a
verdict on whether the imbalance coforge anchors to is structural.

**Why it matters**: if 10:2 generalizes, coforge's "we fill the security
gap" is a field-level claim, not a single-workshop observation. If it
doesn't, the §5 anchor weakens to "one workshop's skew."

**Blocker**: OpenAlex search is 503-rate-limited in this environment (tried
twice). The scan needs either a working OpenAlex key or manual collection
from workshop proceedings pages. Defer until env fixed or do manually.

### A — Can consumer-side-evidence stand alone as a method note?

**Status**: docs/19 §2 speculated the method generalizes; docs/20 R1 found
prior art (exokernel/Dune/unikernel/kernel-bypass) and concluded "not a new
method, a known genre applied to a new layer." That was memory-based, not a
grounded search (question-validator's novelty_search could not run — OpenAlex
503).

**Question to resolve**: is there a *named* method-paper that codifies
"build a real app in layer X, report walls, map to layer-beneath
abstractions"? If yes, coforge cites it; if no, there is a gap for a short
method note (independent of coforge).

**Method**: re-run novelty_search from a working-network environment with
queries targeting the *method* ("argue from application limitations to OS
abstractions", "consumer-side evidence systems layer"), not coforge's
specific claim. Review hits for a codified method vs genre instances.

**Why it matters**: decides whether coforge's writing should cite a method
precedent or claim the method's explicit codification as a side
contribution.

### R2 — Do the six abstractions unify under "mediation-enforced contract"?

**Status**: docs/19 §5 speculated yes; never tested. **Tested now (pure
reasoning, no env dependency).**

**Test**: for each of the six rows, ask "is the wanted abstraction a
contract enforced by the layer that mediates the resource?"
- scheduling → mediates execution slots ✓
- managed state → mediates context storage ✓
- isolation → mediates memory accesses ✓
- skills → mediates ??? (composition isn't a mediated resource the same way) ✗
- routing → mediates capability dispatch ✓
- agent state as OS object → mediates state lifecycle ✓

**Verdict (resolved)**: **5/6 fit; skills-as-composition resists.** This is
itself a finding: the unification is not "one concept six ways" — it is
"five mediation-enforced contracts plus one composition-unit abstraction
that is a different kind." Implications:
- The "main course" paper docs/19 §5 gestured at is real but partial: it
  covers 5/6, and the sixth (skills) is the exception that proves the rule.
- For the current vision paper: no change needed (it enumerates six without
  claiming unification). For the next version: the unification can be
  argued for 5/6 with skills explicitly flagged as the outlier — a stronger
  thesis than "six unrelated abstractions" but honest about its limit.
- Skills being the outlier is *consistent* with D3's finding that skills
  has no clean scalar metric — both point to skills being structurally
  different from the other five (it is about *composition*, not *resource
  mediation*).

**Cost**: done.

## Priority

1. **R2** — done (5/6 unify; skills is the outlier, consistent with D3).
2. **D1** (managed-state, ~10 lines, objective) — quick win, 4/6 measured.
3. **D3** (skills, small, weak-but-honest) — 5/6 measured.
4. **D2** (routing, medium, LLM-judge) — 6/6 measured, but subjectivity
   risk.
5. **D4** (wire + paper) — only after D1-D3 land.
6. **A** then **C** (investigations) — need working network for the
   grounded searches; do when env allows, or manually.

## What this plan does NOT do

- Does not build OS-layer features (still: coforge stays at app layer).
- Does not promise 6/6 measured is *better* than 3/6 — the skills proxy is
  weak, and D2's LLM-judge adds subjectivity. The honest framing is "all
  six walls have *some* measured evidence; two are strong, three are
  medium, one is a weak proxy" — not "6/6 measured, done."
- Does not let the 10:2 anchor overclaim: until C runs, §5 says "the
  1st-edition agenda is weighted ten-to-two," not "the field is."
