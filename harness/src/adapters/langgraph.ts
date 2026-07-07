import { DatabaseSync } from "node:sqlite";
import type { MentionResult, WorkspaceAdapter, FaultInjector, StorageObserver } from "../types.js";

// Drives a running langgraph-ws (langgraph-ws/server.py) over HTTP. The
// third adapter — a real third-party framework (LangGraph), not a mock.
// Like coforge, it has a shared SQLite store the probes attack; unlike
// coforge, the agent runs through LangGraph's checkpointer.
export function langgraphAdapter(baseUrl: string): WorkspaceAdapter {
  const fi: FaultInjector = {
    id: "langgraph-cross-read",
    async injectCrossRead(attacker: string, target: string) {
      const res = await fetch(
        `${baseUrl}/crossread?attacker=${encodeURIComponent(attacker)}&target=${encodeURIComponent(target)}`,
      );
      if (!res.ok) throw new Error(`langgraph /crossread ${res.status}`);
      return (await res.json()) as { crossed: boolean; detail: string };
    },
  };

  const obs: StorageObserver = {
    id: "langgraph-storage",
    async countAgentMemory(agent: string) {
      const res = await fetch(`${baseUrl}/memory?agent=${encodeURIComponent(agent)}`);
      if (!res.ok) throw new Error(`langgraph /memory ${res.status}`);
      const d = (await res.json()) as { rows: number };
      return d.rows;
    },
  };

  return {
    name: "langgraph",
    async sendMention(agent: string, text: string): Promise<MentionResult> {
      const t0 = Date.now();
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, text }),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) throw new Error(`langgraph /chat ${res.status}: ${await res.text()}`);
      const d = (await res.json()) as {
        reply?: string;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      return {
        reply: d.reply ?? "",
        latencyMs,
        promptTokens: d.usage?.prompt_tokens ?? 0,
        completionTokens: d.usage?.completion_tokens ?? 0,
      };
    },
    async resetWorkspace() {
      const res = await fetch(`${baseUrl}/reset`, { method: "POST" });
      if (!res.ok) throw new Error(`langgraph /reset ${res.status}`);
    },
    faultInjection: fi,
    storageObserver: obs,
  };
}

void DatabaseSync; // keep import resolvable if the adapter later opens the db directly
