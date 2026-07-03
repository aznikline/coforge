import { config } from "./config.js";

export interface ChatTurn {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LLMUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface LLMResult {
  readonly reply: string;
  readonly usage: LLMUsage;
}

export async function callLLM(messages: readonly ChatTurn[]): Promise<LLMResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llmApiKey}`,
        },
        body: JSON.stringify({
          model: config.llmModel,
          messages,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM call failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error("LLM returned no content");
      }
      return {
        reply: reply.trim(),
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (e) {
      lastErr = e;
      // Retry on transient network/socket errors (the LLM endpoint drops
      // connections under load). Non-transient errors (4xx) fail fast.
      const msg = (e as Error).message ?? "";
      const transient = msg.includes("fetch failed") || msg.includes("socket") ||
        msg.includes("Socket") || msg.includes("closed") || msg.includes("ECONNRESET");
      if (!transient) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}
