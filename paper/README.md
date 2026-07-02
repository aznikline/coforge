# AgenticOS 2026 vision paper

`main.tex` — a 1–2 page double-blind vision paper for the 2nd AgenticOS
Workshop (SOSP 2026, Prague, 2026-09-29). Submission deadline 2026-07-08
(AOE). See https://os-for-agent.github.io/.

## Argument

The paper does **not** propose a new OS. It reports where a real,
application-layer agent workspace (the coforge PoC, anonymized for review)
hit walls that are not application problems but missing-OS-primitive
problems. Each of the workspace's admitted workarounds maps onto an
operating-system abstraction that would remove it. Two workarounds are
measured.

The angle, evidence, and submission-fit analysis live in
`../docs/17-agenticos-analysis.md` and `../docs/18-agenticos-submission-feasibility.md`.

## Compile

`acmart` with `sigconf, review, anonymous`. Bibliography is hand-rolled
(`thebibliography`), so no bibtex pass is needed.

```
pdflatex main
pdflatex main      # second pass resolves refs + table floats
```

Or upload `main.tex` to Overleaf (acmart is preinstalled there; choose
`pdflatex` as the compiler). Target: 2 pages excluding references.

## Evidence

`evidence/bench.json` — the measured numbers cited in §3.1 (serial queue)
and §3.2 (prompt-replay memory). Reproducible:

```
# from repo root, with a running router (cd router && npm run dev)
set -a && . .env && set +a
python3 scripts/bench.py        # or paper/evidence/bench.py
```

Measurement 1 (serial queue): concurrent mentions at N=1,2,4,8 → wall-clock
3.3s, 7.0s, 13.9s, 27.3s (near-linear; no scheduling layer).

Measurement 2 (prompt replay): 8-turn conversation, prompt tokens per turn
39, 81, 118, 142, 173, 206, 240, 308 (~8× growth; no managed memory object).

These are real measurements against a live OpenAI-compatible endpoint, not
synthetic numbers. Re-running against a different model/endpoint will change
absolute values but not the shapes (linear concurrency latency, linear
history-token growth).

## Double-blind note

The system is public on GitHub under a named account. Double-blind review
does not require the code to be secret — it requires the **paper text** to
not identify the authors. The text refers to the system only as "an
open-source agent workspace (anonymized for review)" and cites no author or
owner name. If a reviewer asks for the artifact, share the repo via an
anonymized link at rebuttal time; this is not required in the submission.

## Status before submission

Before uploading to HotCRP (https://agenticos26.hotcrp.com/), do a final
pass:

- Compile and confirm the PDF is ≤ 2 pages excluding references.
- Re-read §6 (what we are not claiming) — keep it; it preempts the "where is
  the OS contribution" rejection.
- Verify no author/owner/GitHub identity leaked into the text or footer.
- ACM double-column format, ≥2 reviews, double-blind.
