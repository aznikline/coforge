import type { Probe, ProbeResult, WorkspaceAdapter } from "../types.js";
import { detectScaling } from "../analyze.js";

// Serial-queue wall: fire N concurrent mentions, measure wall-clock vs N.
// If the router serializes (no scheduling layer), wall-clock scales with N.
export const concurrencyProbe: Probe = {
  id: "concurrency",
  description: "fire N concurrent mentions, report wall-clock vs N",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    const Ns = [1, 2, 4, 8];
    const points = [];
    for (const n of Ns) {
      const t0 = Date.now();
      await Promise.all(
        Array.from({ length: n }, (_, i) => adapter.sendMention("Noel", `say only the number ${i}`)),
      );
      points.push({ x: n, y: Date.now() - t0 });
    }
    const linearGrowth = detectScaling(points);
    return {
      probeId: "concurrency",
      wall: "serial-queue",
      points,
      linearGrowth,
      note: linearGrowth
        ? "latency scales with concurrency — degenerate scheduler (no agent scheduling layer)"
        : "latency does not scale with concurrency (no serial-queue wall detected)",
    } satisfies ProbeResult;
  },
};
