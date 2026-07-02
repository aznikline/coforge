import { DatabaseSync } from "node:sqlite";
import type { MentionResult, WorkspaceAdapter, FaultInjector } from "../types.js";

// Drives a running coforge-router over HTTP. The router must surface token
// usage in its /api/chat response (see router/src/llm.ts).
//
// The fault injector opens the router's SQLite file directly — which is the
// attack: coforge's isolation boundary is "per-agent rows in a shared DB,"
// and any code holding the DB handle (i.e. the application's own code, which
// a buggy or subverted agent can influence) can read across it. This is the
// §4 enforcer==enforced-upon argument made executable: the application that
// drew the boundary is the application that can cross it.
export function coforgeAdapter(
  baseUrl: string,
  channel: string,
  dbPath: string,
): WorkspaceAdapter {
  return {
    name: "coforge",
    async sendMention(agent: string, text: string): Promise<MentionResult> {
      const t0 = Date.now();
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, text: `@${agent} ${text}` }),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) throw new Error(`coforge /api/chat ${res.status}: ${await res.text()}`);
      const d = (await res.json()) as {
        reply?: { text: string };
        usage?: { promptTokens: number; completionTokens: number };
      };
      return {
        reply: d.reply?.text ?? "",
        latencyMs,
        promptTokens: d.usage?.promptTokens ?? 0,
        completionTokens: d.usage?.completionTokens ?? 0,
      };
    },
    async resetWorkspace(): Promise<void> {
      const res = await fetch(`${baseUrl}/api/reset`, { method: "POST" });
      if (!res.ok) throw new Error(`coforge /api/reset ${res.status}`);
    },
    faultInjection: {
      id: "coforge-cross-read",
      async injectCrossRead(attacker: string, target: string) {
        // The "attacker" here is the application's own code path (a buggy
        // agent, a misconfigured tool, a prompt-injected agent that can
        // influence which query runs). It opens the shared DB — the very
        // file the router writes — and reads the target's rows directly.
        // The boundary the app drew (per-agent rows) does not hold against
        // the app's own DB handle.
        const db = new DatabaseSync(dbPath, { readOnly: true });
        let crossed = false;
        let detail = "";
        try {
          const row = db.prepare(
            "SELECT content FROM agent_memory WHERE agent = ? ORDER BY ts DESC LIMIT 1",
          ).get(target) as { content?: string } | undefined;
          crossed = !!row?.content;
          detail = crossed
            ? `attacker code read target '${target}' memory via shared DB handle`
            : `no target memory found (target may not have stored anything yet)`;
        } catch (e) {
          detail = `cross-read attempt errored: ${(e as Error).message}`;
        } finally {
          db.close();
        }
        return { crossed, detail };
      },
    },
  };
}
