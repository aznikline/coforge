import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

// M2: agent-initiated messages. A reminder lets an agent post to a channel
// at a scheduled time — not in response to an @mention. This is an
// application-layer timer (a per-reminder setTimeout polling), NOT multi-
// agent coordination, so it stays within the docs/19 §4 OS-taboo safe zone.

const db = new DatabaseSync(config.dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    channel TEXT NOT NULL,
    text TEXT NOT NULL,
    fire_at INTEGER NOT NULL,
    fired INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_fire ON reminders(fire_at, fired);
`);

const insertStmt = db.prepare(
  "INSERT INTO reminders (agent, channel, text, fire_at) VALUES (?, ?, ?, ?) RETURNING id",
);
const dueStmt = db.prepare(
  "SELECT id, agent, channel, text FROM reminders WHERE fired = 0 AND fire_at <= ? ORDER BY fire_at ASC",
);
const markFiredStmt = db.prepare("UPDATE reminders SET fired = 1 WHERE id = ?");

export interface Reminder {
  readonly id: number;
  readonly agent: string;
  readonly channel: string;
  readonly text: string;
}

export function scheduleReminder(agent: string, channel: string, text: string, fireAt: number): number {
  const row = insertStmt.get(agent, channel, text, fireAt) as { id: number };
  return row.id;
}

export function dueReminders(now: number): readonly Reminder[] {
  return dueStmt.all(now).map((r) => r as unknown as Reminder);
}

export function markFired(id: number): void {
  markFiredStmt.run(id);
}

// Parse "in Ns" / "in Nm" / "in Nh" (or bare "Ns"/"Nm"/"Nh") → fireAt ms.
// MVP: relative only. Returns null if not parseable.
export function parseWhen(text: string, now: number): number | null {
  const m = text.match(/(?:^in\s+)?(\d+)\s*([smh])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000;
  return now + n * mult;
}

// Strip the "remind me to X in Ns" wrapper, return the reminder body and
// the time clause. MVP shape: "@Agent remind me to <body> in <N><unit>".
export function parseReminder(body: string): { reminderBody: string; whenText: string } | null {
  const m = body.match(/^remind me to\s+(.+?)\s+in\s+(\d+\s*[smh])$/i);
  if (!m) return null;
  return { reminderBody: m[1], whenText: m[2] };
}
