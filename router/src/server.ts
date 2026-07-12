import Fastify from "fastify";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { loadRegistry, parseMention, talkToAgent, agentInitiate } from "./agents.js";
import { enqueue } from "./queue.js";
import { saveMessage, listMessages, clearMessages } from "./store.js";
import { clearMemory } from "./memory.js";
import { scheduleReminder, dueReminders, markFired, parseReminder, parseWhen } from "./reminders.js";
import type { WorkItem } from "./types.js";
import { ensureWorkGraphTables, createWorkItem, getWorkGraph, parseWorkItems } from "./workgraph.js";

function clearAll(): void {
  clearMessages();
  clearMemory();
}

const registry = loadRegistry(config.agentsFile);

const app = Fastify({ logger: true });
await app.register(import("@fastify/cors"), {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
});

app.get("/api/messages/:channel", async (req) => {
  const { channel } = req.params as { channel: string };
  return { messages: listMessages(channel) };
});

// Test-infrastructure endpoint: clears all agent memory and channel history.
// Used by the harness to get a clean baseline before probing. Not a user
// feature — do not expose in the UI.
// Phase 3: Work Graph API
const wgDb = new DatabaseSync(config.dbPath);
ensureWorkGraphTables(wgDb);

app.get("/api/workgraph", async () => {
  return getWorkGraph(wgDb);
});

app.post("/api/workgraph/items", async (req) => {
  const { title, type, status, assignee } = (req.body || {}) as Record<string, string>;
  if (!title) return { error: "title required" };
  const item = createWorkItem(wgDb, {
    type: (type as WorkItem["type"]) || "task",
    title,
    status: status || "todo",
    assignee,
    tags: [],
  });
  return { item };
});

app.post("/api/reset", async () => {
  clearAll();
  return { ok: true };
});

app.post("/api/chat", async (req, reply) => {
  const { channel, text } = req.body as { channel?: string; text?: string };
  if (!channel || !text) {
    return reply.code(400).send({ error: "channel and text required" });
  }

  const userMsg = saveMessage(channel, config.userName, text);
  // Auto-extract WorkItems from chat messages (Phase 3)
  const extracted = parseWorkItems(text, config.userName);
  for (const item of extracted) {
    createWorkItem(wgDb, {
      type: item.type,
      title: item.title,
      status: item.status || "todo",
      assignee: item.assignee,
      tags: [],
      source_msg_id: userMsg.id,
    });
  }
  const parsed = parseMention(text, registry);

  if (!parsed) {
    return {
      user: userMsg,
      reply: null,
      error: "no @mention found. Try @Noel, @Pat, or @Sam.",
    };
  }

  const agent = registry.get(parsed.agentName)!;

  // M2: "@Agent remind me to X in Ns" schedules an agent-initiated reminder
  // instead of a normal reply. The agent posts to the channel at fire_at.
  const reminder = parseReminder(parsed.body);
  if (reminder) {
    const fireAt = parseWhen(reminder.whenText, Date.now());
    if (!fireAt) {
      return {
        user: userMsg,
        reply: null,
        error: "could not parse when (use 'in Ns' / 'in Nm' / 'in Nh')",
      };
    }
    const id = scheduleReminder(agent.name, channel, reminder.reminderBody, fireAt);
    const ackMsg = saveMessage(channel, agent.name, `Scheduled. I'll remind "${reminder.reminderBody}" (id ${id}).`);
    return { user: userMsg, reply: ackMsg, scheduled: { id, fireAt } };
  }

  // B5: if capability routing handed off to a better-matched agent, post a
  // hand-off note to the channel before the agent answers.
  if (parsed.handOffNote) {
    saveMessage(channel, "system", parsed.handOffNote);
  }

  const result = await enqueue(channel, () => talkToAgent(agent, parsed.body));
  const agentMsg = saveMessage(channel, agent.name, result.reply);
  return {
    user: userMsg,
    reply: agentMsg,
    handOff: parsed.handOffTo ?? null,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    },
  };
});

// M2: reminder scheduler. Polls due reminders every 2s; for each, the agent
// initiates a message to the channel (not @-invoked). Application-layer
// timer — within the OS-taboo safe zone (single-agent timer, no multi-agent
// coordination correctness).
async function fireDueReminders(): Promise<void> {
  const due = dueReminders(Date.now());
  for (const r of due) {
    // Mark fired FIRST so the next poll cycle doesn't re-grab it while the
    // (slow) LLM call is generating the agent's message.
    markFired(r.id);
    const agent = [...registry.values()].find((a) => a.name.toLowerCase() === r.agent.toLowerCase());
    if (!agent) continue;
    try {
      const post = await agentInitiate(agent, r.text);
      saveMessage(r.channel, agent.name, post);
    } catch (e) {
      app.log.error({ err: e, reminderId: r.id }, "agent initiate failed");
    }
  }
}

setInterval(() => {
  void fireDueReminders().catch((e) => app.log.error({ err: e }, "reminder scheduler error"));
}, 2000);

try {
  await app.listen({ port: config.routerPort, host: "0.0.0.0" });
  console.log(`coforge-router ready on :${config.routerPort}`);
  console.log(`agents: ${[...registry.values()].map((a) => `@${a.name}`).join(", ")}`);
  console.log(`user: ${config.userName}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
