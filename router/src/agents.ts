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

// B5: capability routing. @Noel routes by name (always). With
// CAPABILITY_ROUTING on, @frontend/@backend/@docs route by capability word
// to the agent whose role/skills match; and a @name message whose body
// strongly matches another agent's skills gets handed off (with a note).
// Off = paper's routing cliff reproduces (regex @name only, no hand-off).

const MENTION_RE = /@([A-Za-z][A-Za-z0-9_-]*)/;

export interface ParsedMention {
  readonly agentName: string;
  readonly body: string;
  readonly handOffTo?: string; // set when the system reroutes to a better-matched agent
  readonly handOffNote?: string;
}

// Find the agent whose skills/role best match a capability word.
function findAgentByCapability(
  registry: ReadonlyMap<string, AgentConfig>,
  cap: string,
): AgentConfig | undefined {
  const c = cap.toLowerCase();
  for (const a of registry.values()) {
    if (a.role.toLowerCase() === c) return a;
    if (a.skills.some((s) => s.toLowerCase() === c)) return a;
  }
  return undefined;
}

// Detect a strong capability keyword in the body that belongs to an agent
// other than `agent`. Returns that agent if a mismatch is found.
function detectMismatch(
  agent: AgentConfig,
  body: string,
  registry: ReadonlyMap<string, AgentConfig>,
): AgentConfig | undefined {
  const lower = body.toLowerCase();
  for (const other of registry.values()) {
    if (other.name === agent.name) continue;
    for (const skill of other.skills) {
      if (lower.includes(skill.toLowerCase())) {
        // only a mismatch if the @-mentioned agent does NOT have this skill
        if (!agent.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
          return other;
        }
      }
    }
  }
  return undefined;
}

export function parseMention(
  text: string,
  registry: ReadonlyMap<string, AgentConfig>,
): ParsedMention | null {
  const match = MENTION_RE.exec(text);
  if (!match) return null;
  const token = match[1].toLowerCase();
  const body = text.slice(match.index! + match[0].length).trim() || "(no body)";

  // B5: @capability addressing — @frontend / @backend / @docs route to the
  // matching agent regardless of name.
  if (config.capabilityRouting) {
    const byCap = findAgentByCapability(registry, token);
    if (byCap) {
      return { agentName: byCap.name.toLowerCase(), body };
    }
  }

  // Otherwise @name (existing). If no agent by that name, not a mention.
  const agent = registry.get(token);
  if (!agent) return null;

  // B5: mismatch hand-off — @Noel but body strongly matches Pat's skills.
  if (config.capabilityRouting) {
    const better = detectMismatch(agent, body, registry);
    if (better) {
      return {
        agentName: better.name.toLowerCase(),
        body,
        handOffTo: better.name.toLowerCase(),
        handOffNote: `routed to ${better.name} — this looks like ${better.role} work`,
      };
    }
  }

  return { agentName: token, body };
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

// M2: an agent-initiated message — the agent posts to a channel on its own
// schedule (a fired reminder), not in response to an @mention. This is the
// "agent presence" that makes a channel a collaboration surface, not a
// help-desk queue. Single-agent timer path; does not touch multi-agent
// coordination (the OS-taboo line).
export async function agentInitiate(agent: AgentConfig, reminderBody: string): Promise<string> {
  const turns: ChatTurn[] = [
    { role: "system", content: agent.persona ?? `You are ${agent.name}.` },
    { role: "system", content: "A reminder you set is now due. Post a short, in-character message to the channel about it. Do not prefix with your name." },
    { role: "user", content: `Reminder due: ${reminderBody}` },
  ];
  const result = await callLLM(turns);
  appendMemory(agent.name, "assistant", result.reply);
  return result.reply;
}
