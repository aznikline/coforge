import type { Probe, ProbeResult, WorkspaceAdapter } from "../types.js";
import { detectMonotonicGrowth } from "../analyze.js";

// Prompt-replay wall: hold an M-turn conversation, report prompt-tokens vs M.
// If the workspace replays full history, prompt tokens grow monotonically
// (off a base, so not necessarily 8× — but strictly increasing each turn).
export const historyProbe: Probe = {
  id: "history",
  description: "M-turn conversation, report prompt-tokens vs M",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    const turns = [
      "I'm Alex, working on a rendering engine called forge.",
      "It uses WebGPU for the frontend.",
      "We hit a problem with buffer recycling.",
      "The team has 3 engineers.",
      "Our staging environment is on fly.io.",
      "I prefer dark themes for dashboards.",
      "We ship every Thursday.",
      "Our p99 latency target is 200ms.",
    ];
    const points = [];
    for (let i = 0; i < turns.length; i++) {
      const r = await adapter.sendMention("Noel", turns[i]);
      points.push({ x: i + 1, y: r.promptTokens });
    }
    const linearGrowth = detectMonotonicGrowth(points);
    return {
      kind: "scaling",
      probeId: "history",
      wall: "prompt-replay",
      points,
      linearGrowth,
      note: linearGrowth
        ? "prompt tokens grow with history — full-history replay (no managed memory abstraction)"
        : "prompt tokens do not grow with history (no replay wall detected)",
    } satisfies ProbeResult;
  },
};
