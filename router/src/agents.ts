import { readFileSync, existsSync } from "node:fs";
import type { AgentConfig, AgentRegistry } from "./types.js";
import { callLLM, type ChatTurn } from "./llm.js";
import { appendMemory, loadMemory } from "./memory.js";

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

export async function talkToAgent(
  agent: AgentConfig,
  userText: string,
): Promise<string> {
  appendMemory(agent.name, "user", userText);

  const history = loadMemory(agent.name);
  const turns: ChatTurn[] = [
    { role: "system", content: agent.persona ?? `You are ${agent.name}.` },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatTurn),
  ];

  const reply = await callLLM(turns);
  appendMemory(agent.name, "assistant", reply);
  return reply;
}
