# Getting started

> For a user who just found the `coforge` repo and wants to run it locally with
> their own LLM key. No source reading required.

## Prerequisites

You need two things installed first. If you have done Node work before, you
almost certainly have both.

1. **Node.js 22 or newer.** coforge uses Node's built-in `node:sqlite` module,
   which is stable from Node 22 on. Check yours:

   ```bash
   node --version        # must be v22.x or higher
   ```

   If it is older (or missing), install from https://nodejs.org/ — pick the
   current LTS, which is well past 22.

2. **git.** To clone the repo.

   ```bash
   git --version
   ```

That's it. No Docker, no Postgres, no vector database — the PoC runs as two
plain Node processes and a SQLite file.

## Step 1 — get the code

```bash
git clone https://github.com/aznikline/coforge.git
cd coforge
```

## Step 2 — get an LLM key

coforge does not ship a model. You point it at any **OpenAI-compatible**
chat-completions endpoint and bring your own key. Common choices:

| Provider | `LLM_BASE_URL` | `LLM_MODEL` example | Where to get a key |
|----------|----------------|---------------------|--------------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | https://platform.openai.com/api-keys |
| OpenRouter (aggregates many models) | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | https://openrouter.ai/keys |
| Local Ollama | `http://localhost:11434/v1` | `llama3.1` | no key needed (any string works) |
| Local LM Studio | `http://localhost:1234/v1` | (whatever you loaded) | no key needed |

You only need one. If unsure, OpenAI with `gpt-4o-mini` is the cheapest
default path and matches the `.env.example` values.

## Step 3 — configure

```bash
cp .env.example .env
```

Open `.env` in any editor and fill in the three lines. Example for OpenAI:

```ini
LLM_API_KEY=sk-...your real key...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Leave `ROUTER_PORT` and `WEB_PORT` alone unless those ports are taken on your
machine.

## Step 4 — start the router

In a terminal, from the `coforge` directory:

```bash
cd router
npm install        # first run only — installs dependencies
npm run dev        # starts the router
```

You should see:

```
coforge-router ready on :8787
agents: @Noel, @Pat, @Sam
```

Leave this terminal running.

## Step 5 — start the web UI

Open a **second** terminal, from the same `coforge` directory:

```bash
cd web
npm install        # first run only
npm run dev        # starts the frontend
```

You should see a Vite line like:

```
Local:   http://localhost:5173/
```

## Step 6 — use it

Open http://localhost:5173 in your browser. You are in a single chat channel
with three agents. Try this exact sequence — it exercises the whole point of
coforge:

```
@Noel I'm Alex, working on a rendering engine
```

Noel answers as a frontend engineer.

**Now refresh the page** (or close the tab and reopen http://localhost:5173),
then:

```
@Noel what's my name?
```

Noel answers "Alex" — because the conversation is stored in `coforge.db`, not
held in browser memory. This is the persistent-memory feature working.

To see that memory is **per-agent**, ask a different agent the same question:

```
@Pat what's my name?
```

Pat does not know — you only told Noel. That isolation is intentional.

## Step 7 — make it yours

The agents are plain config in `agents.json` at the repo root:

```json
{
  "name": "Noel",
  "role": "frontend",
  "color": "#e06c75",
  "persona": "You are Noel, a frontend engineer teammate..."
}
```

- Change a persona → edit the text, save, restart the router (`Ctrl-C` then
  `npm run dev` again). The new persona applies to new turns; old memory is
  kept.
- Rename an agent → change `"name"`; the `@mention` uses that name.
- Add an agent → copy one block, give it a new name and persona.

That is the full surface. There is no admin panel, no settings UI — the JSON
file is the configuration.

## Verifying it works (and troubleshooting)

| Symptom | Cause / fix |
|---------|------------|
| `Missing env var LLM_API_KEY` | Step 3 — `.env` not filled in, or not created |
| `LLM call failed (401)` | Key invalid, or key not valid for the `LLM_BASE_URL` you set |
| `LLM call failed (400)` | Usually `LLM_MODEL` is wrong for that endpoint — check the provider's model name |
| `agents: @Noel, @Pat, @Sam` not printed | Router didn't start — check the terminal for the error |
| Browser shows nothing / connection refused | Web UI not running, or router not running — both terminals must stay open |
| `node:sqlite` / `Cannot find module` error | Node version is below 22 — see Prerequisites |
| Port already in use | Change `ROUTER_PORT` or `WEB_PORT` in `.env` |

## What "full functionality" means here

To set expectations honestly, running the steps above gives you the complete
PoC: in-channel `@mention` routing to multiple named agents, per-agent
persistent memory across browser refreshes and router restarts, and editable
agent personas. That is everything coforge does.

It does **not** give you: multiple human users, agents that talk to each
other, real concurrent coordination, memory compression, or any hosted/public
URL. Those are out of scope for the PoC — see the README's "What this is not"
section.
