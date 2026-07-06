import type { MentionResult, WorkspaceAdapter, FaultInjector, StorageObserver } from "../types.js";

// A mock agent workspace — pure local, no LLM. Implements the same adapter
// contract as coforge, with *intentionally walled* behavior so the harness
// can be tested against a second workspace without a LLM key or a running
// server. It is NOT coforge: separate process, separate storage, simulated
// replies. Its walls mirror coforge's by construction (serial queue, replay,
// shared storage, no delegation, no routing) so the probes should confirm
// them — which proves the harness flags walls in any workspace, not just
// the one it was born in.

interface MockMemory {
  readonly agent: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly ts: number;
}

export function mockAdapter(): WorkspaceAdapter {
  // Per-agent history in a shared array — the "shared DB" the isolation
  // probe will cross-read.
  let store: MockMemory[] = [];
  // Serial queue — the concurrency probe will see latency stack.
  let queueTail: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = queueTail.then(task, task);
    queueTail = next.finally(() => {});
    return next as Promise<T>;
  }

  const fi: FaultInjector = {
    id: "mock-cross-read",
    async injectCrossRead(attacker: string, target: string) {
      // Same structure as coforge: the "application's" own code reads the
      // shared store directly — the per-agent boundary is advisory.
      const row = store.filter((m) => m.agent === target).slice(-1)[0];
      const crossed = !!row;
      return {
        crossed,
        detail: crossed
          ? `mock attacker read target '${target}' memory via shared store`
          : `no target memory found`,
      };
    },
  };

  const obs: StorageObserver = {
    id: "mock-storage",
    async countAgentMemory(agent: string) {
      return store.filter((m) => m.agent === agent).length;
    },
  };

  return {
    name: "mock",
    async sendMention(agent: string, text: string): Promise<MentionResult> {
      // Simulate work proportional to history (prompt-replay wall) + a
      // fixed per-turn latency (serial-queue wall under concurrency).
      const history = store.filter((m) => m.agent === agent);
      const promptTokens = 40 + history.length * 35; // grows with history
      return enqueue(async () => {
        await new Promise((r) => setTimeout(r, 1500)); // per-turn cost
        const reply = `(mock ${agent}) ok`;
        store = [...store, { agent, role: "user", content: text, ts: Date.now() }];
        store = [...store, { agent, role: "assistant", content: reply, ts: Date.now() }];
        return { reply, latencyMs: 1500, promptTokens, completionTokens: 10 };
      });
    },
    async resetWorkspace() {
      store = [];
      queueTail = Promise.resolve();
    },
    faultInjection: fi,
    storageObserver: obs,
  };
}
