import Fastify from "fastify";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { loadRegistry, parseMention, talkToAgent, agentInitiate } from "./agents.js";
import { enqueue } from "./queue.js";
import { saveMessage, listMessages, clearMessages } from "./store.js";
import { clearMemory, loadMemory, appendMemory } from "./memory.js";
import { scheduleReminder, dueReminders, markFired, parseReminder, parseWhen } from "./reminders.js";
import type { WorkItem } from "./types.js";
import { ensureWorkGraphTables, createWorkItem, getWorkGraph, parseWorkItems, ensureStageTables, ensureEvidenceTables } from "./workgraph.js";
import { ensureTaskTables, claimTask, transitionTask, listTasks, getTaskEvents } from "./tasks.js";
import { createTemplateWithStages, listTemplates, getTemplate, listStages, createRun, listRuns, getRun, seedTemplates, evaluateGate, executeTransition, getTransitionsFromStage } from "./stages.js";
import { recordEvidence, signEvidence, listEvidence, verifyChain, recordTransitionEvidence } from "./evidence.js";

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
// Phase 5: ensure channels table
wgDb.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    name TEXT PRIMARY KEY,
    agents TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO channels (name, agents) VALUES ('general', '["Noel","Pat","Sam"]');
`);

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

// Phase 4: Task system
ensureTaskTables(wgDb);

// Phase 7a: Stage system
ensureStageTables(wgDb);
seedTemplates(wgDb);

// Phase 7b: Evidence Chain
ensureEvidenceTables(wgDb);

app.get("/api/tasks", async (req) => {
  const { status, assignee } = (req.query || {}) as Record<string, string>;
  return { tasks: listTasks(wgDb, { status, assignee }) };
});

app.get("/api/tasks/:id", async (req) => {
  const { id } = req.params as { id: string };
  const task = (await import("./tasks.js")).getTask(wgDb, id);
  if (!task) return { error: "not found" };
  return { task, events: getTaskEvents(wgDb, id) };
});

app.post("/api/tasks/:id/claim", async (req) => {
  const { id } = req.params as { id: string };
  const { agent } = (req.body || {}) as { agent?: string };
  if (!agent) return { error: "agent required" };
  try {
    return claimTask(wgDb, id, agent);
  } catch (e) { return { error: String(e) }; }
});

app.post("/api/tasks/:id/transition", async (req) => {
  const { id } = req.params as { id: string };
  const { action, actor, reason } = (req.body || {}) as { action?: string; actor?: string; reason?: string };
  if (!action || !actor) return { error: "action and actor required" };
  try {
    return transitionTask(wgDb, id, action, actor, reason);
  } catch (e) { return { error: String(e) }; }
});

// Phase 7a: Stage Graph API
app.get("/api/templates", async () => {
  return { templates: listTemplates(wgDb) };
});

app.get("/api/templates/:id", async (req) => {
  const { id } = req.params as { id: string };
  const template = getTemplate(wgDb, id);
  if (!template) return { error: "not found" };
  const stages = listStages(wgDb, id);
  return { template, stages };
});

app.post("/api/templates", async (req) => {
  const { name, description, stages, transitions } = (req.body || {}) as {
    name?: string;
    description?: string;
    stages?: { name: string; order: number; gate_condition?: string; reviewer_policy?: string }[];
    transitions?: { from_stage_order: number; to_stage_order: number; gate_condition?: string; reviewer_policy?: string; transition_action?: string }[];
  };
  if (!name) return { error: "name required" };
  if (!stages || stages.length === 0) return { error: "stages required" };
  try {
    const result = createTemplateWithStages(wgDb, {
      name,
      description: description || "",
      stages,
      transitions: transitions?.map(t => ({
        from_stage_order: t.from_stage_order,
        to_stage_order: t.to_stage_order,
        gate_condition: t.gate_condition,
        reviewer_policy: t.reviewer_policy,
        transition_action: t.transition_action as "advance" | "reject" | "branch" | undefined,
      })),
    });
    return result;
  } catch (e) { return { error: String(e) }; }
});

app.get("/api/stages/:template_id", async (req) => {
  const { template_id } = req.params as { template_id: string };
  return { stages: listStages(wgDb, template_id) };
});

// Phase 7a: Pipeline Run API
app.get("/api/runs", async () => {
  return { runs: listRuns(wgDb) };
});

app.get("/api/runs/:id", async (req) => {
  const { id } = req.params as { id: string };
  const run = getRun(wgDb, id);
  if (!run) return { error: "not found" };
  return { run };
});

app.post("/api/runs", async (req) => {
  const { template_id } = (req.body || {}) as { template_id?: string };
  if (!template_id) return { error: "template_id required" };
  const template = getTemplate(wgDb, template_id);
  if (!template) return { error: "template not found" };
  const stages = listStages(wgDb, template_id);
  if (stages.length === 0) return { error: "template has no stages" };
  const firstStage = stages[0]; // sorted by order ASC
  try {
    const run = createRun(wgDb, template_id, firstStage.id);
    return { run, current_stage: firstStage };
  } catch (e) { return { error: String(e) }; }
});

// Phase 7b: Evidence Chain API
app.get("/api/runs/:run_id/evidence", async (req) => {
  const { run_id } = req.params as { run_id: string };
  return { events: listEvidence(wgDb, run_id) };
});

app.get("/api/runs/:run_id/evidence/verify", async (req) => {
  const { run_id } = req.params as { run_id: string };
  return verifyChain(wgDb, run_id);
});

app.post("/api/runs/:run_id/evidence", async (req) => {
  const { run_id } = req.params as { run_id: string };
  const { event_type, actor, payload, stage_id, transition_id, task_id } = (req.body || {}) as {
    event_type?: string;
    actor?: string;
    payload?: Record<string, unknown>;
    stage_id?: string;
    transition_id?: string;
    task_id?: string;
  };
  if (!event_type || !actor || !payload) return { error: "event_type, actor, and payload required" };
  try {
    const event = recordEvidence(wgDb, {
      run_id,
      stage_id,
      transition_id,
      task_id,
      event_type: event_type as "gate_check" | "reviewer_signoff" | "artifact_hash" | "transition_executed",
      actor,
      payload,
    });
    return { event };
  } catch (e) { return { error: String(e) }; }
});

app.post("/api/evidence/:id/sign", async (req) => {
  const { id } = req.params as { id: string };
  const { actor } = (req.body || {}) as { actor?: string };
  if (!actor) return { error: "actor required" };
  const signed = signEvidence(wgDb, id, actor);
  if (!signed) return { error: "evidence not found" };
  return { event: signed };
});

// Phase 7c: Stage State Machine API
app.get("/api/runs/:id/transitions", async (req) => {
  const { id } = req.params as { id: string };
  const run = getRun(wgDb, id);
  if (!run) return { error: "run not found" };
  const transitions = getTransitionsFromStage(wgDb, run.current_stage_id);
  return { transitions };
});

app.get("/api/runs/:id/gate", async (req) => {
  const { id } = req.params as { id: string };
  const run = getRun(wgDb, id);
  if (!run) return { error: "run not found" };
  const stage = (await import("./stages.js")).getStage(wgDb, run.current_stage_id);
  if (!stage) return { error: "stage not found" };
  const result = evaluateGate(wgDb, stage);
  return { stage: stage.name, ...result };
});

app.post("/api/runs/:id/transition", async (req) => {
  const { id } = req.params as { id: string };
  const { transition_id, reviewer } = (req.body || {}) as { transition_id?: string; reviewer?: string };
  if (!transition_id || !reviewer) return { error: "transition_id and reviewer required" };
  try {
    const result = await executeTransition(wgDb, id, transition_id, reviewer);
    return result;
  } catch (e) { return { error: String(e) }; }
});

// Phase 5: Channel isolation
app.get("/api/channels", async () => {
  const rows = wgDb.prepare("SELECT * FROM channels ORDER BY name").all() as { name: string; agents: string; created_at: string }[];
  return rows.map(r => ({
    name: r.name,
    agents: JSON.parse(r.agents || "[]"),
    created_at: r.created_at,
    message_count: (wgDb.prepare("SELECT COUNT(*) as c FROM messages WHERE channel=?").get(r.name) as { c: number }).c,
  }));
});

app.post("/api/channels", async (req) => {
  const { name, agents } = (req.body || {}) as { name?: string; agents?: string[] };
  if (!name) return { error: "name required" };
  try {
    wgDb.prepare("INSERT INTO channels (name, agents) VALUES (?, ?)").run(name, JSON.stringify(agents || ["Noel","Pat","Sam"]));
    return { channel: { name, agents: agents || ["Noel","Pat","Sam"], created_at: new Date().toISOString() } };
  } catch (e) { return { error: String(e) }; }
});

// Phase 6: Memory inspection
app.get("/api/memory/:agent/search", async (req) => {
  const { agent } = req.params as { agent: string };
  const { q } = (req.query || {}) as { q?: string };
  if (!q) return { results: [] };
  const all = loadMemory(agent);
  const lower = q.toLowerCase();
  return { results: all.filter(t => t.content.toLowerCase().includes(lower)).slice(0, 20) };
});

app.get("/api/memory/:agent/messages", async (req) => {
  const { agent } = req.params as { agent: string };
  const all = loadMemory(agent);
  const compressed = all.filter(t => t.role === "system").length;
  return { messages: all, total: all.length, compressed_count: compressed };
});

app.delete("/api/memory/:agent/messages/:ts", async (req) => {
  const { agent, ts } = req.params as { agent: string; ts: string };
  wgDb.prepare("DELETE FROM agent_memory WHERE agent=? AND ts=?").run(agent, parseInt(ts));
  return { ok: true };
});

app.post("/api/memory/:agent/inject", async (req) => {
  const { agent } = req.params as { agent: string };
  const { content } = (req.body || {}) as { content?: string };
  if (!content) return { error: "content required" };
  appendMemory(agent, "system", content);
  return { ok: true };
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

  const result = await enqueue(channel, () => talkToAgent(agent, parsed.body, channel));
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
