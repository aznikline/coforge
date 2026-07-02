import type { MentionResult, WorkspaceAdapter } from "../types.js";

// Drives a running coforge-router over HTTP. The router must surface token
// usage in its /api/chat response (see router/src/llm.ts).
export function coforgeAdapter(baseUrl: string, channel: string): WorkspaceAdapter {
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
  };
}
