import type { Probe, ProbeResult, WorkspaceAdapter } from "../types.js";
import { detectMonotonicGrowth } from "../analyze.js";

// Managed-state wall (storage side): the workspace stores every turn with no
// eviction, archival, or lifecycle abstraction. So stored rows grow
// unboundedly with turns — a scaling pathology on the storage side, distinct
// from the prompt-side cost the history probe measures.
//
// Note: docs/19 labeled this a correctness-cliff; the cheap, objective face
// is actually a scaling curve (rows vs turns). The true cliff face (no
// lifecycle/migration) needs a long-horizon run beyond PoC scope.
export const managedStateProbe: Probe = {
  id: "managed-state",
  description: "M-turn conversation, report stored-memory rows vs M",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    const obs = adapter.storageObserver;
    if (!obs) {
      return {
        kind: "scaling",
        probeId: "managed-state",
        wall: "unbounded-state",
        points: [],
        linearGrowth: false,
        note: "adapter has no storageObserver hook — probe skipped",
      } satisfies ProbeResult;
    }

    const turns = [
      "I'm Alex, working on a rendering engine called forge.",
      "It uses WebGPU for the frontend.",
      "We hit a problem with buffer recycling.",
      "The team has 3 engineers.",
      "Our staging environment is on fly.io.",
      "I prefer dark themes for dashboards.",
      "We ship every Thursday.",
      "Our p99 latency target is 200ms.",
      "We use Postgres for the catalog.",
      "The CI runs on GitHub Actions.",
      "Our deploy target is fly.io.",
      "We pair on Mondays.",
      "The API is GraphQL.",
      "We track p99 not p50.",
      "Logs go to Loki.",
      "We pin Node 22.",
      "The frontend is React.",
      "We ship dark mode first.",
      "Our on-call rota is weekly.",
      "The DB is SQLite.",
    ];
    // Reset so row-count starts from 0 — this probe measures storage growth
    // in isolation from prior probes' history.
    await adapter.resetWorkspace();
    const points = [];
    for (let i = 0; i < turns.length; i++) {
      await adapter.sendMention("Noel", turns[i]);
      const rows = await obs.countAgentMemory("Noel");
      points.push({ x: i + 1, y: rows });
    }
    const linearGrowth = detectMonotonicGrowth(points);
    return {
      kind: "scaling",
      probeId: "managed-state",
      wall: "unbounded-state",
      points,
      linearGrowth,
      note: linearGrowth
        ? "stored rows grow with turns — no eviction/lifecycle abstraction (unmanaged state)"
        : "stored rows do not grow with turns (no managed-state wall detected)",
    } satisfies ProbeResult;
  },
};
