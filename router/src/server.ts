import Fastify from "fastify";
import { config } from "./config.js";
import { loadRegistry, parseMention, talkToAgent } from "./agents.js";
import { enqueue } from "./queue.js";
import { saveMessage, listMessages } from "./store.js";

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
  const replyText = await enqueue(channel, () => talkToAgent(agent, parsed.body));
  const agentMsg = saveMessage(channel, agent.name, replyText);
  return { user: userMsg, reply: agentMsg };
});

try {
  await app.listen({ port: config.routerPort, host: "0.0.0.0" });
  console.log(`coforge-router ready on :${config.routerPort}`);
  console.log(`agents: ${[...registry.values()].map((a) => `@${a.name}`).join(", ")}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
