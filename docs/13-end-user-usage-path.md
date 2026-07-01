# 13 · How non-technical users would use coforge

> Question: how does a non-technical end user use coforge?
>
> **Short answer: they can't — not from the current repo.** coforge is a PoC
> that assumes a developer environment (Node, clone, two processes, a personal
> LLM API key). Reaching a non-technical user requires a hosted service that
> does not exist yet. This file is the honest breakdown of what it would take.

---

## Why the current repo is unusable for non-technical users

Three blockers, each fundamental to the PoC's shape:

1. **They must install Node and clone the repo.** A non-technical user has
   neither. `npm install` is already past their cliff.
2. **They must supply an LLM API key.** The whole point of "bring your own
   key" is that coforge does not pay for inference. A non-technical user does
   not have an OpenAI/Anthropic key and should not be expected to get one.
3. **There is no hosted endpoint.** No domain, no deployed frontend, no
   running router. Nothing for them to type into a browser.

These are not documentation gaps. You cannot write a README good enough to
make a non-technical user run a local Node service with their own API key.
The only honest fix is a hosted service.

## The only path that works: a hosted deployment

A non-technical user's experience must be:

```
1. open https://coforge.example  (a URL, nothing to install)
2. talk to @Noel / @Pat / @Sam in the browser
3. leave, come back days later, agents still remember
```

That requires coforge to run as a service, not as a repo. Concretely:

| What the repo has | What a hosted service needs |
|-------------------|------------------------------|
| Vite dev server on :5173 | Built static frontend served by a CDN or static host |
| `npm run dev` router process | A long-running router process (container) |
| SQLite file in the repo dir | A real database (Postgres) or per-user SQLite isolation |
| Single user, no auth | User accounts, per-user data isolation |
| BYO LLM key | A platform LLM key (you pay) **or** a settings page where users enter their own |
| `localhost` | A domain + TLS |

## Three ways to get there, by who pays for inference

The LLM cost is the real decision. Someone has to pay for every token the
agents generate. Three models:

### A. You pay for inference (true "just open the URL" experience)

- You deploy the service with your own LLM key in the environment.
- Users pay nothing, type nothing — they just use it.
- **Cost to you**: every user's tokens billed to your account. This scales
  badly — one heavy user can burn through real money. You need rate limits,
  free-tier caps, or a usage budget that cuts off.
- **Honest fit**: good for a closed beta with friends; dangerous as an open
  public service without spending caps.

### B. Users bring their own key (BYOK, but in the UI)

- User signs up, pastes their own LLM key into a settings page (encrypted at
  rest, never sent to the browser).
- You pay nothing for inference; you only pay for hosting the (small) service.
- **Friction**: the user still needs to obtain an API key from OpenAI /
   Anthropic / etc. For a true non-technical user this is still a cliff — but
   a smaller one than running Node.
- **Honest fit**: the realistic middle ground for a public service you don't
  want to fund.

### C. Freemium: you pay a small quota, users bring a key for more

- Free tier with a hard daily token quota (you fund a capped amount).
- Users who want more paste their own key.
- **Honest fit**: the most user-friendly model that still has a ceiling on
  your cost. Most production AI products land here.

## What it would take to build (honest effort)

To go from the current PoC to a hosted service a non-technical user can open,
in the smallest useful shape (single-region, BYOK model B):

| Work | Why | Effort |
|------|-----|--------|
| Build the frontend (`vite build`) and serve the static bundle from the router | No separate dev server in prod | small |
| Replace `node:sqlite` file with per-user-isolated storage (Postgres, or a sqlite file per user) | Multi-user can't share one sqlite | medium |
| Add user accounts (signup/login, sessions) | Per-user memory isolation | medium |
| Add a settings page where users paste an LLM key, encrypt it, and route each user's agents through their own key | BYOK model | medium |
| Add a per-agent "remember across sessions" path that works per-user | Memory is already per-agent; needs per-user scoping | small |
| Deploy (container on a host) + domain + TLS | A URL people can open | small-medium |
| Rate limiting + abuse guards (if model A) | If you pay for inference, you must cap | medium |

Rough total for the BYOK shape: a few days of focused work on top of the
current PoC. The free-tier (model C) adds the spending-cap engineering on top.

## What the repo should say today

Until a hosted service exists, the README must be honest that coforge is a
developer-run PoC, not an end-user product. The right move is:

- Keep the README aimed at developers who run it locally.
- Add a short "Status" line stating plainly: no hosted service yet;
  non-technical users cannot use coforge today; a hosted BYOK deployment is
  the path to change that, and it is not built.
- Do **not** write a fake "easy guide for everyone" — that would be dishonest
  about a cliff that is real.

When/if a hosted deployment is built, the end-user instructions collapse to:
"open the URL, sign up, optionally paste an LLM key, talk to the agents."
That is a one-paragraph README for end users — but only after the service
exists.

## One-line answer

> A non-technical user uses coforge by opening a hosted URL — which does not
> exist yet. Building it means deploying the PoC with accounts, per-user
> storage, and either a platform LLM key (you pay, with caps) or a UI for
> users to paste their own (BYOK). Until then, coforge is runnable only by
> developers, and the README should say so plainly.
