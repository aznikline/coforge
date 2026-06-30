import { config } from "./config.js";

export interface ChatTurn {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export async function callLLM(messages: readonly ChatTurn[]): Promise<string> {
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
  };
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error("LLM returned no content");
  }
  return reply.trim();
}
