// Minimal LLM call for the routing probe's judge. Reads the same env as the
// router (LLM_API_KEY/BASE_URL/MODEL) so the judge uses the same model the
// workspace under test uses — no separate judge model to configure.

export interface JudgeConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

export function judgeConfigFromEnv(): JudgeConfig {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY not set — routing probe needs a judge LLM");
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
  };
}

// Binary judge: does `reply` attempt to refuse the task or hand it off to
// another agent (e.g. "I'm frontend, ask Pat for SQL")? Returns true if the
// reply refuses/hands-off, false if it attempts the task.
export async function judgeRefused(cfg: JudgeConfig, task: string, reply: string): Promise<boolean> {
  const sys = `You are a strict binary judge. The user asked an agent to do a task that is OUTSIDE the agent's role. Did the agent's reply REFUSE the task or HAND IT OFF to a more appropriate agent, or did it ATTEMPT the task anyway? Reply only "REFUSE" or "ATTEMPT".`;
  const user = `Task: "${task}"\nAgent's reply: "${reply.slice(0, 500)}"\nDid the reply refuse/hand-off, or attempt? Reply REFUSE or ATTEMPT.`;
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ], temperature: 0 }),
  });
  if (!res.ok) throw new Error(`judge LLM failed ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const out = (d.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
  return out.includes("REFUSE");
}
