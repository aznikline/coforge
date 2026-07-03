import type { Probe, ProbeResult, WorkspaceAdapter, CliffProbeResult } from "../types.js";
import { detectCliff } from "../analyze.js";

// Skills-as-composition cliff: can one agent delegate work to another? In a
// workspace with a composition abstraction, "@Noel ask @Pat to X" reaches
// Pat and Pat acts. coforge's parseMention matches only the first @name
// (Noel) with a single regex and has no inter-agent call path — so Pat is
// never invoked. We measure delegation-success rate: did Pat's stored memory
// grow (evidence Pat was reached) after a delegation request?
//
// HONEST: this is a weak proxy for "skills as composition unit" — passing
// means an agent can hand work to another, which is necessary but not
// sufficient for a composition abstraction. No clean scalar metric exists
// for composition; this binary floor is the honest measurement.
export const skillsProbe: Probe = {
  id: "skills",
  description: "N delegation attempts, report whether the target agent was reached",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    const obs = adapter.storageObserver;
    if (!obs) {
      return {
        kind: "cliff",
        probeId: "skills",
        wall: "composition-cliff",
        trials: 0,
        crossedRate: 0,
        note: "adapter has no storageObserver hook — probe skipped",
      } satisfies CliffProbeResult;
    }

    await adapter.resetWorkspace();
    const tasks = [
      "summarize the rendering engine design",
      "review the Postgres schema",
      "draft the API docs",
      "check the CI config",
      "write the on-call runbook",
      "explain the p99 target",
      "outline the dark-mode plan",
      "audit the React components",
      "describe the buffer recycling fix",
      "list the team's tools",
      "sketch the deployment flow",
      "annotate the GraphQL schema",
      "summarize the staging setup",
      "review the Loki logging",
      "draft the pairing guide",
      "explain the Node 22 pin",
      "outline the shipping cadence",
      "audit the WebGPU paths",
      "describe the SQLite choice",
      "review the GitHub Actions workflows",
    ];

    const N = tasks.length;
    let delegated = 0;
    for (let i = 0; i < N; i++) {
      const before = await obs.countAgentMemory("Pat");
      await adapter.sendMention("Noel", `ask @Pat to ${tasks[i]}`);
      const after = await obs.countAgentMemory("Pat");
      if (after > before) delegated++;
    }
    // crossedRate here = rate at which delegation FAILED to reach Pat.
    // cliff confirmed when failure is ~100% (composition is best-effort /
    // absent). We invert: the wall is "no composition abstraction," so
    // failure IS the wall present.
    const failedRate = 1 - delegated / N;
    const confirmed = detectCliff(failedRate);
    return {
      kind: "cliff",
      probeId: "skills",
      wall: "composition-cliff",
      trials: N,
      crossedRate: failedRate,
      note: confirmed
        ? `delegation reached Pat on ${delegated}/${N} trials — no inter-agent composition path (composition is absent)`
        : `delegation reached Pat on ${delegated}/${N} trials — composition path present`,
    } satisfies CliffProbeResult;
  },
};
