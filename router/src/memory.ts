import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

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
  "SELECT role, content FROM agent_memory WHERE agent = ? ORDER BY ts ASC",
);

export interface MemoryTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export function appendMemory(agent: string, role: "user" | "assistant", content: string): void {
  insertStmt.run(agent, role, content, Date.now());
}

export function loadMemory(agent: string): readonly MemoryTurn[] {
  return listStmt.all(agent).map((r) => {
    const row = r as { role: string; content: string };
    return { role: row.role as "user" | "assistant", content: row.content };
  });
}
