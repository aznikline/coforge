import Fastify from "fastify";
import { config } from "./config.js";
import { loadRegistry, parseMention, talkToAgent } from "./agents.js";
import { enqueue } from "./queue.js";
import { saveMessage, listMessages, clearMessages } from "./store.js";
import { clearMemory } from "./memory.js";

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
app.post("/api/reset", async () => {
  clearAll();
  return { ok: true };
});

app.post("/api/chat", async (req, reply) => {
  const { channel, text } = req.body as { channel?: string; text?: string };
  if (!channel || !text) {
    return reply.code(400).send({ error: "channel and text required" });
  }

  const userMsg = saveMessage(channel, "you", text);
  const parsed = parseMention(text, registry);

  if (!parsed) {
    return {
      user: userMsg,
      reply: null,
      error: "no @mention found. Try @Noel, @Pat, or @Sam.",
    };
  }

  const agent = registry.get(parsed.agentName)!;
  const result = await enqueue(channel, () => talkToAgent(agent, parsed.body));
  const agentMsg = saveMessage(channel, agent.name, result.reply);
  return {
    user: userMsg,
    reply: agentMsg,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    },
  };
});

try {
  await app.listen({ port: config.routerPort, host: "0.0.0.0" });
  console.log(`coforge-router ready on :${config.routerPort}`);
  console.log(`agents: ${[...registry.values()].map((a) => `@${a.name}`).join(", ")}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
