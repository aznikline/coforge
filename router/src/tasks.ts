import { DatabaseSync } from "node:sqlite";
import type { WorkItem } from "./types.js";

// === Database ===

export function ensureTaskTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      comment TEXT,
      ts INTEGER NOT NULL,
      FOREIGN KEY(task_id) REFERENCES work_items(id)
    );
    CREATE INDEX IF NOT EXISTS idx_task_events ON task_events(task_id);
  `);
}

// === State Machine ===

const VALID_TRANSITIONS: Record<string, string[]> = {
  todo: ["claimed", "in_progress"],  // can skip claim and go straight to in_progress
  claimed: ["in_progress", "todo"],
  in_progress: ["in_review", "blocked", "todo"],
  in_review: ["done", "in_progress"],
  done: [],
  blocked: ["in_progress", "todo"],
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// === CRUD ===

interface TaskClaimResult {
  task: WorkItem;
  event: { id: number; task_id: string; event_type: string; actor: string; ts: number };
}

export function claimTask(db: DatabaseSync, taskId: string, agent: string): TaskClaimResult {
  const row = (db.prepare("SELECT * FROM work_items WHERE id = ?").get(taskId) as Record<string, unknown> | undefined);
  if (!row) throw new Error(`task ${taskId} not found`);
  if (row.claimed_by && row.claimed_by !== agent) {
    throw new Error(`task ${taskId} already claimed by ${row.claimed_by}`);
  }

  db.prepare("UPDATE work_items SET status='claimed', claimed_by=?, claimed_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
    .run(agent, taskId);

  const eventId = logEvent(db, taskId, "claimed", agent, "");
  const task = getTask(db, taskId)!;
  return { task, event: { id: eventId, task_id: taskId, event_type: "claimed", actor: agent, ts: Date.now() } };
}

export function transitionTask(
  db: DatabaseSync,
  taskId: string,
  action: string,
  actor: string,
  reason?: string,
): TaskClaimResult {
  const row = (db.prepare("SELECT * FROM work_items WHERE id = ?").get(taskId) as Record<string, unknown> | undefined);
  if (!row) throw new Error(`task ${taskId} not found`);

  const currentStatus = row.status as string;
  const targetStatus = action === "start" ? "in_progress"
    : action === "complete" ? "in_review"
    : action === "approve" ? "done"
    : action === "reject" ? "in_progress"
    : action === "block" ? "blocked"
    : action === "unblock" ? (row.claimed_by ? "in_progress" : "todo")
    : action;

  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new Error(`invalid transition: ${currentStatus} → ${targetStatus}`);
  }

  const updates: Record<string, string | null> = { status: targetStatus };
  if (targetStatus === "done") updates.completed_at = new Date().toISOString();
  if (action === "approve") updates.reviewer = actor;

  const setClauses = Object.entries(updates)
    .map(([k]) => `${k}=?`)
    .join(", ");
  const values = Object.values(updates);
  values.push(taskId);
  db.prepare(`UPDATE work_items SET ${setClauses}, updated_at=datetime('now') WHERE id=?`).run(...values);

  const eventId = logEvent(db, taskId, action, actor, reason || "");
  const task = getTask(db, taskId)!;
  return { task, event: { id: eventId, task_id: taskId, event_type: action, actor, ts: Date.now() } };
}

export function getTask(db: DatabaseSync, taskId: string): WorkItem | null {
  const row = db.prepare("SELECT * FROM work_items WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToItem(row);
}

export function listTasks(db: DatabaseSync, filters?: { status?: string; assignee?: string }): WorkItem[] {
  let sql = "SELECT * FROM work_items WHERE type='task'";
  const params: (string | null)[] = [];
  if (filters?.status) { sql += " AND status=?"; params.push(filters.status); }
  if (filters?.assignee) { sql += " AND claimed_by=?"; params.push(filters.assignee); }
  sql += " ORDER BY created_at DESC";
  const stmt = db.prepare(sql);
  const rows = params.length ? stmt.all(...params) : stmt.all();
  return (rows as Record<string, unknown>[]).map(rowToItem);
}

function logEvent(db: DatabaseSync, taskId: string, eventType: string, actor: string, comment: string): number {
  const row = db.prepare(
    "INSERT INTO task_events (task_id, event_type, actor, comment, ts) VALUES (?,?,?,?,?) RETURNING id"
  ).get(taskId, eventType, actor, comment, Date.now()) as { id: number };
  return row.id;
}

export function getTaskEvents(db: DatabaseSync, taskId: string): Record<string, unknown>[] {
  return db.prepare("SELECT * FROM task_events WHERE task_id=? ORDER BY ts ASC").all(taskId) as Record<string, unknown>[];
}

function rowToItem(row: Record<string, unknown>): WorkItem {
  return {
    id: row.id as string,
    type: (row.type as WorkItem["type"]) || "task",
    title: row.title as string,
    status: row.status as string,
    assignee: (row.assignee as string) || undefined,
    parent_id: (row.parent_id as string) || undefined,
    source_msg_id: row.source_msg_id as number | undefined,
    tags: JSON.parse((row.tags as string) || "[]"),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    claimed_by: (row.claimed_by as string) || undefined,
    claimed_at: (row.claimed_at as string) || undefined,
    completed_at: (row.completed_at as string) || undefined,
    reviewer: (row.reviewer as string) || undefined,
  };
}
