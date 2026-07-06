#!/usr/bin/env node
// coforge-harness CLI — run the 6 wall probes against a workspace adapter.
//
// Usage:
//   npx coforge-harness probe --adapter mock
//   npx coforge-harness probe --adapter coforge --router http://localhost:8787 --db ./coforge.db
//
// Adapters:
//   mock    — pure local, no LLM/server (good for CI / demo)
//   coforge — drives a running coforge-router over HTTP
//
// Output: one block per probe, with the verdict (wall confirmed / no).

import { mockAdapter } from "./adapters/mock.js";
import { coforgeAdapter } from "./adapters/coforge.js";
import { concurrencyProbe } from "./probes/concurrency.js";
import { historyProbe } from "./probes/history.js";
import { managedStateProbe } from "./probes/managed-state.js";
import { isolationProbe } from "./probes/isolation.js";
import { skillsProbe } from "./probes/skills.js";
import { routingProbe } from "./probes/routing.js";
import { formatReport } from "./analyze.js";
import type { Probe, WorkspaceAdapter } from "./types.js";

const PROBES: readonly Probe[] = [
  concurrencyProbe,
  historyProbe,
  managedStateProbe,
  isolationProbe,
  skillsProbe,
  routingProbe,
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function buildAdapter(): Promise<WorkspaceAdapter> {
  const which = arg("adapter") ?? "mock";
  if (which === "mock") return mockAdapter();
  if (which === "coforge") {
    const router = arg("router") ?? process.env.ROUTER_URL ?? "http://localhost:8787";
    const db = arg("db") ?? process.env.DB_PATH ?? "coforge.db";
    const channel = `harness-${Date.now()}`;
    return coforgeAdapter(router, channel, db);
  }
  throw new Error(`unknown adapter '${which}' (try: mock, coforge)`);
}

async function main(): Promise<void> {
  const adapter = await buildAdapter();
  console.log(`coforge-harness — adapter: ${adapter.name}\n`);
  await adapter.resetWorkspace();
  for (const p of PROBES) {
    const result = await p.run(adapter);
    console.log(formatReport(result));
    console.log();
  }
}

main().catch((e) => {
  console.error("harness failed:", e);
  process.exit(1);
});
