# coforge

> **A multi-agent chat workspace where agents keep their memory between sessions.**

`coforge` is a small, self-contained workspace where you talk to several named
agents in one channel, and each agent remembers what you told it — across
browser refreshes, across router restarts. The memory lives in a local SQLite
file you can open, read, and delete.

It is **not** a production collaboration platform. It is a compact, readable
reference for how persistent identity, per-agent memory, and in-channel routing
fit together — small enough to read end to end in an afternoon.

## What this is (honest)

- A single channel with `@mention` routing — `@Noel`, `@Pat`, `@Sam` each route
  to a distinct agent with its own persona and its own memory.
- Persistent per-agent memory in SQLite (`coforge.db`): every turn is stored,
  and the agent's full history is replayed into the prompt on the next message.
  Kill the router, restart it, ask "what's my name?" — the agent still knows.
- Memory is **isolated per agent** by design: tell something to `@Noel` and
  `@Pat` does not learn it. Each agent is its own context.
- LLM-agnostic: anything that speaks the OpenAI chat-completions schema works
  (OpenAI, OpenRouter, local Ollama / LM Studio, …). Bring your own key.
- A minimal React frontend, a Fastify router, and `node:sqlite` — no external
  agent framework, no vector database, no daemon beyond the router process.

## What this is not

- **No real multi-agent coordination.** Messages in a channel are processed
  serially through one queue. Two agents cannot act at the same time on the
  same state. This is the single biggest gap versus any "real" agent team
  product, and it is sidestepped here on purpose.
- **No collaboration, only routing.** You `@` an agent and it answers. Agents
  do not talk to each other, claim work, or notice what teammates did.
- **Single user.** No auth, no multi-tenant, no shared channels between humans.
- **No memory compression.** The whole history goes back into the prompt every
  turn. Fine for a session; it will cost tokens and eventually context as a
  conversation grows. There is no summarization or archival layer.
- **No self-hosted execution surface.** The router runs locally as a process;
  there is no daemon that runs agents on your hardware the way a full
  deployment would.
- **No enterprise layer.** No SSO, RBAC, audit log, or access control.

These are not TODOs dressed as limitations. Several are deliberate non-goals
that keep the code readable. If you need any of them, `coforge` is the wrong
starting point — treat it as a map, not a foundation.

## What's here

```
coforge/
├── router/                 # coforge-router (Fastify + node:sqlite)
│   └── src/
│       ├── server.ts       # POST /api/chat, GET /api/messages/:channel
│       ├── agents.ts       # @mention parsing + talkToAgent (persona + memory)
│       ├── llm.ts          # OpenAI-compatible chat-completions call
│       ├── memory.ts       # per-agent memory, persisted to SQLite
│       ├── store.ts        # channel message history, persisted to SQLite
│       ├── queue.ts        # serial per-channel queue (sidesteps concurrency)
│       ├── config.ts       # env + path resolution
│       └── types.ts
├── web/                    # minimal React chat (Vite)
│   └── src/{App.tsx, api.ts, main.tsx, style.css}
├── agents.json             # Noel / Pat / Sam — personas, editable
├── .env.example
└── docs/                   # design notes and analysis (the "why")
```

The two pieces worth reading first are `router/src/agents.ts` (how a mention
becomes a routed, memory-backed turn) and `router/src/memory.ts` (how a turn is
stored and replayed). Together they are the whole idea.

## Quick start

```bash
# 1. configure — point at any OpenAI-compatible endpoint
cp .env.example .env
$EDITOR .env            # set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

# 2. router
cd router && npm install && npm run dev      # :8787

# 3. web (separate terminal)
cd web && npm install && npm run dev         # http://localhost:5173
```

Then in the browser:

```
@Noel I'm Alex, working on a rendering engine
```

Refresh the page (or restart the router), then:

```
@Noel what's my name?
```

It answers "Alex" — because the turn is in `coforge.db`, not in memory. Ask
`@Pat` the same question and it doesn't know; that's the isolation working.

Edit `agents.json` to add or rename agents and change personas; restart the
router to pick up changes.

## Design notes

- **Routing is a regex, not an orchestrator.** `@Name` is parsed once; the
  named agent is the recipient. No capability matching, no fallback, no
  delegation. Simple, and honestly limited.
- **Memory is append-only history, not a knowledge graph.** A turn is a row;
  recall is "replay all rows for this agent into the prompt." Cheap to reason
  about, expensive at scale — see the non-goal above.
- **The serial queue exists because concurrency was out of scope.** It is not
  a feature; it is an explicit choice to not pretend to solve coordination.

## Troubleshooting

- `Missing env var LLM_API_KEY` — you didn't fill in `.env`.
- `LLM call failed (401)` — bad key, or the key isn't valid for `LLM_BASE_URL`.
- `LLM call failed (400)` — usually a wrong `LLM_MODEL` for that endpoint.
- Port in use — change `ROUTER_PORT` / `WEB_PORT` in `.env`.

## License

MIT.
