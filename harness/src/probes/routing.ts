import type { Probe, ProbeResult, WorkspaceAdapter, CliffProbeResult } from "../types.js";
import { detectCliff } from "../analyze.js";
import { judgeConfigFromEnv, judgeRefused } from "../llm.js";

// Capability-routing cliff: when an agent is @mentioned for work outside its
// role, a workspace with a routing abstraction would hand off to the right
// agent (or refuse). coforge's parseMention routes by @name regex with zero
// capability matching — so the wrong agent always attempts the task. We
// measure hand-off/refuse rate: over N mismatched tasks, did the agent
// refuse or hand off, or attempt anyway?
//
// Judge is an LLM (same model the workspace uses), binary REFUSE/ATTEMPT.
// Single pass, binary verdict — low subjectivity. Cliff confirmed when
// hand-off rate ~0% (no routing abstraction).
export const routingProbe: Probe = {
  id: "routing",
  description: "N role-mismatched tasks, report hand-off/refuse rate",
  async run(adapter: WorkspaceAdapter): Promise<ProbeResult> {
    let cfg;
    try {
      cfg = judgeConfigFromEnv();
    } catch (e) {
      return {
        kind: "cliff",
        probeId: "routing",
        wall: "routing-cliff",
        trials: 0,
        crossedRate: 0,
        note: `judge LLM unavailable — probe skipped: ${(e as Error).message}`,
      } satisfies CliffProbeResult;
    }

    await adapter.resetWorkspace();
    // Noel = frontend. All tasks are backend work — Noel should hand off to
    // Pat (backend), not attempt.
    const tasks = [
      "write a SQL query to join users and orders",
      "design a Postgres schema for the catalog",
      "explain how to index this table",
      "write a migration to add a column",
      "diagnose a slow query",
      "design the connection pool config",
      "write a backup script",
      "explain the replication setup",
      "write a stored procedure",
      "audit the indexes",
      "write a data seed script",
      "explain the foreign keys",
      "design a partitioning scheme",
      "write a rollback migration",
      "diagnose a deadlock",
      "design the read replica config",
      "write a vacuum schedule",
      "explain the query planner",
      "write a transaction wrapper",
      "design the schema for audit logs",
    ];

    const N = tasks.length;
    let refused = 0;
    for (const task of tasks) {
      const r = await adapter.sendMention("Noel", task);
      const didRefuse = await judgeRefused(cfg, task, r.reply);
      if (didRefuse) refused++;
    }
    const refusedRate = refused / N;
    // The wall is "no routing abstraction," so FAILURE to hand off IS the
    // cliff present. crossedRate = rate at which the agent attempted a
    // mismatched task (did NOT refuse).
    const attemptedRate = 1 - refusedRate;
    const confirmed = detectCliff(attemptedRate);
    return {
      kind: "cliff",
      probeId: "routing",
      wall: "routing-cliff",
      trials: N,
      crossedRate: attemptedRate,
      note: confirmed
        ? `agent refused/handed-off on ${refused}/${N} mismatched tasks — no capability routing (regex @name only)`
        : `agent refused on ${refused}/${N} — some routing behavior detected`,
    } satisfies CliffProbeResult;
  },
};
