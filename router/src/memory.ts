import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

// Memory store. With compressMemory on (default), old history is folded
// into a single `system` summary row to bound prompt-token growth (B2, the
// one honest in-user-space wall fix per docs/19 §4). With it off, the full
// history replays every turn — the paper's prompt-replay wall (§3.2),
// reproduced for measurement.

const db = new DatabaseSync(config.dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_memory (
    agent TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_agent ON agent_memory(agent, ts);
`);

const insertStmt = db.prepare(
  "INSERT INTO agent_memory (agent, role, content, ts) VALUES (?, ?, ?, ?)",
);
const listStmt = db.prepare(
  "SELECT role, content, ts FROM agent_memory WHERE agent = ? ORDER BY ts ASC",
);
const deleteRowsBeforeStmt = db.prepare(
  "DELETE FROM agent_memory WHERE agent = ? AND ts <= ?",
);
const deleteSummaryStmt = db.prepare(
  "DELETE FROM agent_memory WHERE agent = ? AND role = 'system'",
);

export type MemoryRole = "user" | "assistant" | "system";

export interface MemoryTurn {
  readonly role: MemoryRole;
  readonly content: string;
  readonly ts: number;
}

export function appendMemory(agent: string, role: MemoryRole, content: string): void {
  insertStmt.run(agent, role, content, Date.now());
}

export function loadMemory(agent: string): readonly MemoryTurn[] {
  return listStmt.all(agent).map((r) => {
    const row = r as { role: string; content: string; ts: number };
    return { role: row.role as MemoryRole, content: row.content, ts: row.ts };
  });
}

// A summarizer is passed in (from agents.ts) to avoid a circular dep on
// llm.ts. It takes the turns to summarize and returns a one-paragraph
// summary string.
export type Summarizer = (turns: readonly MemoryTurn[]) => Promise<string>;

// Fold the oldest rows beyond `keepRows` into a single `system` summary.
// If a prior summary exists, it is included in the input and replaced.
export async function summarizeOld(agent: string, keepRows: number, summarize: Summarizer): Promise<void> {
  const all = loadMemory(agent);
  if (all.length <= keepRows) return;

  const priorSummary = all.filter((t) => t.role === "system");
  const toFold = all.filter((t) => t.role !== "system").slice(0, all.filter((t) => t.role !== "system").length - keepRows);
  if (toFold.length === 0) return;

  const lastTsToFold = toFold[toFold.length - 1].ts;
  const summary = await summarize([...priorSummary, ...toFold]);

  // Remove the old summary (if any) and the folded rows, then write the new
  // summary with a ts at the fold boundary so it stays ordered before the
  // kept recent rows.
  deleteSummaryStmt.run(agent);
  deleteRowsBeforeStmt.run(agent, lastTsToFold);
  insertStmt.run(agent, "system", `Summary of earlier conversation: ${summary}`, lastTsToFold);
}

const deleteAllMemStmt = db.prepare("DELETE FROM agent_memory");

export function clearMemory(): void {
  deleteAllMemStmt.run();
}

