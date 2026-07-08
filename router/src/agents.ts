import { readFileSync, existsSync } from "node:fs";
import type { AgentConfig, AgentRegistry } from "./types.js";
import { callLLM, type ChatTurn, type LLMResult } from "./llm.js";
import { appendMemory, loadMemory, summarizeOld, type MemoryTurn, type Summarizer } from "./memory.js";
import { config } from "./config.js";

// A summarizer that turns old conversation turns into one paragraph, via the
// same LLM the agent uses. Used by summarizeOld when compression is on.
const summarizeTurns: Summarizer = async (turns: readonly MemoryTurn[]) => {
  const transcript = turns
    .map((t) => {
      if (t.role === "system") return t.content;
      return `${t.role === "user" ? "User" : "Agent"}: ${t.content}`;
    })
    .join("\n");
  const result = await callLLM([
    { role: "system", content: "Summarize the conversation below into a concise paragraph preserving key facts, names, and decisions. Do not add anything not in the conversation." },
    { role: "user", content: transcript },
  ]);
  return result.reply;
};

export function loadRegistry(path: string): ReadonlyMap<string, AgentConfig> {
  if (!existsSync(path)) {
    throw new Error(`agents config not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  const registry = JSON.parse(raw) as AgentRegistry;
  const map = new Map<string, AgentConfig>();
  for (const a of registry.agents) {
    map.set(a.name.toLowerCase(), a);
  }
  return map;
}

// Non-goal: capability routing. parseMention is a regex — it routes by name,
// not by matching work to the agent best suited for it, and there is no
// delegation between agents. Deliberately best-effort, not a TODO: it is a
// measured wall (correctness-cliff at the first capability mismatch). See
// docs/18 §4 and paper Table 1. The fix is an agent-facing interface/IPC
// the runtime provides, not a smarter parser here.

const MENTION_RE = /@([A-Za-z][A-Za-z0-9_-]*)/;

export interface ParsedMention {
  readonly agentName: string;
  readonly body: string;
}

export function parseMention(
  text: string,
  registry: ReadonlyMap<string, AgentConfig>,
): ParsedMention | null {
  const match = MENTION_RE.exec(text);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (!registry.has(name)) return null;
  const body = text.slice(match.index! + match[0].length).trim();
  return { agentName: name, body: body || "(no body)" };
}

// Non-goal: inter-agent isolation. All agents share this one process and one
// SQLite DB; nothing prevents one agent's logic (or a prompt-injected agent)
// from reading another's rows. Deliberately best-effort, not a TODO: it is a
// measured wall (correctness-cliff). See docs/18 §4, paper §4, and
// router/src/isolation-stub.ts for a runnable proof that user-space isolation
// is structurally best-effort. The fix is runtime-enforced boundaries
// (execute-only / attested channels), which an application cannot provide for
// itself because it is both the enforcer and the enforced-upon.
export async function talkToAgent(
  agent: AgentConfig,
  userText: string,
): Promise<LLMResult> {
  appendMemory(agent.name, "user", userText);

  // B2: if compression is on and history exceeds the threshold, fold the
  // oldest turns into a summary row. With COMPRESS_MEMORY=false this path is
  // skipped entirely (paper's prompt-replay wall reproduces).
  if (config.compressMemory) {
    const all = loadMemory(agent.name);
    const nonSummary = all.filter((t) => t.role !== "system");
    if (nonSummary.length > config.compressThresholdRows + config.compressKeepRows) {
      await summarizeOld(agent.name, config.compressKeepRows, summarizeTurns);
    }
  }

  const history = loadMemory(agent.name);
  const summary = history.find((t) => t.role === "system");
  const recent = history.filter((t) => t.role !== "system");
  const turns: ChatTurn[] = [
    { role: "system", content: agent.persona ?? `You are ${agent.name}.` },
    ...(summary ? [{ role: "system" as const, content: summary.content }] : []),
    ...recent.map((h) => ({ role: h.role as "user" | "assistant", content: h.content }) as ChatTurn),
  ];

  const result = await callLLM(turns);
  appendMemory(agent.name, "assistant", result.reply);
  return result;
}
