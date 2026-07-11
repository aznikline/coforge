import { DatabaseSync } from "node:sqlite";
import type { ChatMessage } from "./types.js";
import { config } from "./config.js";

// Use config.dbPath (PROJECT_ROOT absolute) so store, memory, and reminders
// share ONE db file — not three. Was a path bug: store used cwd-relative
// "coforge.db" while others used config.dbPath, splitting state across files.
const db = new DatabaseSync(config.dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel, id);
`);

const insertStmt = db.prepare(
  "INSERT INTO messages (channel, author, text, ts) VALUES (?, ?, ?, ?) RETURNING id",
);
const listStmt = db.prepare(
  "SELECT id, channel, author, text, ts FROM messages WHERE channel = ? ORDER BY id ASC",
);

export function saveMessage(
  channel: string,
  author: string,
  text: string,
): ChatMessage {
  const ts = Date.now();
  const row = insertStmt.get(channel, author, text, ts) as { id: number };
  return { id: row.id, channel, author, text, ts };
}

export function listMessages(channel: string): readonly ChatMessage[] {
  return listStmt.all(channel) as unknown as ChatMessage[];
}

const deleteAllStmt = db.prepare("DELETE FROM messages");

export function clearMessages(): void {
  deleteAllStmt.run();
}
