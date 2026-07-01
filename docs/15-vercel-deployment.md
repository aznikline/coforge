# Can coforge deploy on Vercel?

> Short answer: **the frontend yes, the router no — not as-is.** Vercel can host
> the static React UI, but it cannot host coforge's Fastify router with its
> SQLite memory file, because Vercel's execution model has no persistent
> writable filesystem. The memory layer must move off the local file before
> Vercel is an option for the backend.

## Why the split

coforge has two parts with opposite hosting needs:

| Part | What it is | Vercel fit |
|------|------------|-----------|
| `web/` | Vite static frontend | ✅ Perfect — Vercel's core competency |
| `router/` | Fastify process + `node:sqlite` writing `coforge.db` | ❌ Breaks on Vercel |

The router is the problem. Vercel does support a `server.ts` entrypoint and
will route requests to a Node HTTP server (so Fastify can technically boot),
and `node:sqlite` is part of the Node API surface Vercel exposes. **But**
Vercel's execution model is:

- **Ephemeral filesystem.** The filesystem is built at deploy time and is
  read-only at runtime; any file you write (like `coforge.db`) does not
  survive the instance being recycled, and is not shared across instances.
- **Instances are recycled.** Even with warm compute, an instance is not a
  long-lived process you can rely on to hold state between requests.
- **No persistent local disk.** This is the hard wall.

coforge's entire C2 feature (persistent memory across sessions) is "the agent's
history is in `coforge.db`, and the file is still there next time." On Vercel
the file is **not** still there next time. The feature silently breaks.

## Three honest options

### Option 1 — Split deploy: Vercel (frontend) + a real host (router)

Keep Vercel for what it is good at, and put the router somewhere with a
persistent filesystem.

- `web/` → Vercel (static build, free, git-push deploys, global CDN).
- `router/` → A small VM or container host with persistent disk: Fly.io,
  Render, Railway, a $5 VPS, etc. Attach a persistent volume so `coforge.db`
  survives.
- Point the frontend at the router's public URL (replace the Vite dev proxy
  with a `VITE_ROUTER_URL` env var the frontend reads at build time, or a
  runtime config).

**Cost**: Vercel free tier + a ~$0-5/mo small host. **Effort**: small — add a
CORS-safe public URL to the router, teach the frontend to call it, deploy the
router container. This is the lowest-friction path that keeps coforge intact.

### Option 2 — Move memory off the filesystem, then Vercel can host the router

If you specifically want everything on Vercel, the blocker is the local
`coforge.db`. Replace it with a managed database Vercel integrates with:

- **Turso** (libSQL/SQLite over the network) — closest to current code; the
  schema stays SQL. Or **Neon** (Postgres) if you want Postgres.
- Swap `node:sqlite` writes in `memory.ts` / `store.ts` for a network DB
  client. The logic is nearly identical; the storage calls change.
- Then the router is stateless and Vercel-eligible: `server.ts` boots Fastify,
  Vercel routes requests to it, state lives in Turso/Neon.

**Cost**: Turso/Neon free tiers cover a PoC. **Effort**: medium — rewrite two
files' storage layer against a network DB, test, deploy. This is the path that
gets you to "everything on Vercel," at the cost of coforge no longer being
zero-dependency-local-SQLite.

### Option 3 — Don't use Vercel; one-host everything

A single small host (Fly.io / Render / Railway / VPS) runs both the built
frontend (served as static files by the router or a CDN in front) and the
router, with `coforge.db` on a persistent volume. No split, no Vercel.

**Cost**: ~$0-5/mo. **Effort**: small-medium — one Dockerfile, one volume, one
deploy. This is the simplest topology and keeps the zero-external-DB property
the PoC currently has.

## Recommendation

- If you just want a public URL fast and cheap: **Option 1** (Vercel for the
  UI + Fly/Render for the router with a volume). Vercel stays in the stack
  for the part it's good at, and you don't rewrite the memory layer.
- If you want a single vendor and don't mind a network DB: **Option 2**
  (Turso on Vercel). Cleanest "all-Vercel" answer.
- If you want the simplest topology and to keep local-SQLite purity:
  **Option 3** (one small host, no Vercel).

None of these is a one-click `vercel deploy`. coforge was built as a local
two-process PoC; making it a public service is a real (small) deployment
project, and the memory layer is the part that decides the topology.

## One-line answer

> Vercel can host coforge's frontend, but not its router-as-is — the SQLite
> memory file won't persist on Vercel's ephemeral filesystem. Either split
> (Vercel + a host with a disk for the router) or move memory to a network DB
> like Turso and then the whole thing can live on Vercel.
