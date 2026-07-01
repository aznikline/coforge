# Deploying all of coforge on one platform

> Question: which platform can host the **whole** coforge — frontend + router +
> the persistent SQLite memory — without splitting it across vendors?
>
> Short answer: **Fly.io, Railway, and Render all can.** Vercel cannot (no
> persistent filesystem — see `docs/15`). The choice is about free tiers and
> how much ops you want to touch.

## Why these three and not Vercel

coforge needs three things from a host:

1. **A long-running Node process** for the Fastify router (not serverless).
2. **A persistent writable filesystem** so `coforge.db` survives restarts and
   deploys — this is the C2 memory feature; lose the file and agents forget.
3. **Serving the built static frontend** (optionally from the same process).

Vercel fails on (2): its execution model is ephemeral, so a SQLite file
written at runtime disappears when the instance is recycled. The three below
all offer a real persistent volume/disk mounted into a long-lived process.

## Platform comparison

| Platform | Long Node process | Persistent storage | Free tier usable for coforge? | Static files | Effort |
|----------|-------------------|---------------------|-------------------------------|--------------|--------|
| **Fly.io** | Yes (Fly Machines are long-lived VMs) | Yes — Fly Volumes (NVMe, local to one server; daily snapshots, 5-day default; recommend ≥2 volumes for redundancy) | Free trial / free allowance exists; volumes are free up to a small size | Yes — serve from the app or a volume | Medium — needs a Dockerfile + `fly.toml` |
| **Railway** | Yes (long-running services) | Yes — volumes persist across restarts and redeployments (single volume per service; small downtime on redeploy) | Yes — Free/Trial plans include **0.5 GB** volume storage | Yes (via Docker image) | Low — push-to-deploy, volume is a CLI/config toggle |
| **Render** | Yes (web services) | Yes — persistent disk, survives deploys/restarts, SSD + daily snapshots retained 7 days | **No for memory** — persistent disks are paid-only; the free plan has no disk, so `coforge.db` would not persist | Yes (separate Static Site type) | Low-Medium — git deploys, but disk needs a paid plan |

## What "all on one platform" looks like

The shape is the same on all three:

```
┌─────────────────────────────────────────────┐
│  one long-running Node process (container)  │
│  ├── serves built static frontend (web/dist)│
│  ├── Fastify router on the same process     │
│  └── coforge.db on a persistent volume      │
│       (survives restart + redeploy)         │
└─────────────────────────────────────────────┘
```

Concretely, the router's `server.ts` also serves the built `web/dist/` as
static files, and `coforge.db` is written to a path that is a mounted volume.
One process, one deploy, one URL. No Vercel split, no external database.

## Recommendation by what you want

- **Want the easiest, with a usable free tier → Railway.** Free plan includes
  0.5 GB volume storage (enough for a PoC), push-to-deploy, and a volume is a
  config toggle. Lowest ops. This is the default recommendation.
- **Want the most control / cheapest at scale → Fly.io.** Long-lived VMs,
  generous free allowance, but you write a Dockerfile + `fly.toml` and should
  provision two volumes for redundancy. Best if you're comfortable with a
  little ops.
- **Already on Render / like its model → Render, on a paid plan.** Clean git
  deploys and good disk snapshots, but the free plan has no persistent disk,
  so coforge's memory won't survive. Only worth it if you're paying anyway.

## What changes in the codebase to support this

Small, same on all three:

1. **Build the frontend and have the router serve it.** Add a static-file
   route in `server.ts` pointing at `web/dist/`, and a build step that runs
   `vite build` before the router starts. (In dev, keep the current two-process
   setup; in prod, collapse to one.)
2. **Point `coforge.db` at the volume mount path.** `config.ts` already reads
   `DB_PATH` from env — set it to the volume mount (e.g. `/data/coforge.db`).
   Zero code change, just env.
3. **Add a Dockerfile** that builds `web/`, installs `router/`, and runs the
   router. Plus the platform's config file (`fly.toml` / `railway.toml` /
   `render.yaml`) declaring the volume and the `DB_PATH` env var.
4. **Set the LLM env vars** (`LLM_API_KEY` etc.) in the platform's secret
   config — same as the local `.env`, just entered in their dashboard.

That's the entire delta. coforge's design (env-driven config, SQLite at a
configurable path, no external DB) was chosen so this step would be small.

## One-line answer

> Fly.io, Railway, and Render can each host all of coforge in one process with
> a persistent volume for `coforge.db`. **Railway is the easiest** (free tier
> has 0.5 GB volume, push-to-deploy). **Fly.io** is the most flexible. **Render
> works but only on a paid plan** (free has no persistent disk). Vercel can't —
> no persistent filesystem.
