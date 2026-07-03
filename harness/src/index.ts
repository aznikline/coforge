import { coforgeAdapter } from "./adapters/coforge.js";
import { concurrencyProbe } from "./probes/concurrency.js";
import { historyProbe } from "./probes/history.js";
import { managedStateProbe } from "./probes/managed-state.js";
import { isolationProbe } from "./probes/isolation.js";
import { skillsProbe } from "./probes/skills.js";
import { routingProbe } from "./probes/routing.js";
import { formatReport } from "./analyze.js";
import type { Probe, WorkspaceAdapter } from "./types.js";

async function runHarness(adapter: WorkspaceAdapter, probes: readonly Probe[]): Promise<void> {
  console.log(`coforge harness — adapter: ${adapter.name}\n`);
  await adapter.resetWorkspace();
  for (const p of probes) {
    const result = await p.run(adapter);
    console.log(formatReport(result));
    console.log();
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.ROUTER_URL ?? "http://localhost:8787";
  const dbPath = process.env.DB_PATH ?? "coforge.db";
  const channel = `harness-${Date.now()}`;
  const adapter = coforgeAdapter(baseUrl, channel, dbPath);
  await runHarness(adapter, [
    concurrencyProbe,
    historyProbe,
    managedStateProbe,
    isolationProbe,
    skillsProbe,
    routingProbe,
  ]);
}

main().catch((e) => {
  console.error("harness failed:", e);
  process.exit(1);
});
