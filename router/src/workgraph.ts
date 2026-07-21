import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { WorkItem, WorkEdge, WorkGraph } from "./types.js";

// === Database ===

export function ensureWorkGraphTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'task',
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      assignee TEXT,
      parent_id TEXT,
      source_msg_id INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      claimed_by TEXT,
      claimed_at TEXT,
      completed_at TEXT,
      reviewer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Migration: add task columns if upgrading from old schema (ignore errors if they already exist)
  for (const col of ["claimed_by", "claimed_at", "completed_at", "reviewer"]) {
    try { db.exec(`ALTER TABLE work_items ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_edges (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      FOREIGN KEY(from_id) REFERENCES work_items(id),
      FOREIGN KEY(to_id) REFERENCES work_items(id)
    );
  `);
  // Idempotent migration: older coforge.db files were created by the prior
  // schema (no claimed_by/completed_at/reviewer). CREATE IF NOT EXISTS is a
  // no-op on an existing table, so backfill the columns tasks.ts needs. The
  // guard around each ALTER mirrors SQLite's "column already exists" failure
  // on re-run — wrapped so a present column is a silent no-op, not a crash.
  const cols = ["claimed_by", "claimed_at", "completed_at", "reviewer"] as const;
  for (const col of cols) {
    const existing = db.prepare(
      "SELECT name FROM pragma_table_info('work_items') WHERE name = ?",
    ).get(col);
    if (!existing) {
      db.exec(`ALTER TABLE work_items ADD COLUMN ${col} TEXT`);
    }
  }
}

const insertItemStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO work_items (id, type, title, status, assignee, parent_id, source_msg_id, tags)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const updateItemStmt = (db: DatabaseSync) => db.prepare(
  `UPDATE work_items SET status=?, assignee=?, updated_at=datetime('now') WHERE id=?`
);

const listItemsStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM work_items ORDER BY created_at DESC`
);

const insertEdgeStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO work_edges (id, from_id, to_id, relation) VALUES (?, ?, ?, ?)`
);

const listEdgesStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM work_edges`
);

// === Parser: extract WorkItems from chat messages ===

const TASK_RE = /\[task\s*(?:#(\w+))?\s*(?:(\w+))?\]/i;
const DECISION_RE = /\[decision\]/i;
const BLOCKED_RE = /\[blocked\s+by\s+#(\w+)\]/i;

export interface ParsedWorkItem {
  type: "task" | "decision";
  title: string;
  status?: string;
  assignee?: string;
  parent_id?: string;
  blocked_by?: string;
}

export function parseWorkItems(text: string, author: string): ParsedWorkItem[] {
  const items: ParsedWorkItem[] = [];

  // [task #id status] or [task status]
  const taskMatch = TASK_RE.exec(text);
  if (taskMatch) {
    items.push({
      type: "task",
      title: text.replace(TASK_RE, "").trim().slice(0, 120) || `Task from ${author}`,
      status: taskMatch[2] || "todo",
      assignee: author,
      parent_id: taskMatch[1] || undefined,
    });
  }

  // [decision]
  if (DECISION_RE.test(text)) {
    items.push({
      type: "decision",
      title: text.replace(DECISION_RE, "").trim().slice(0, 120) || `Decision from ${author}`,
    });
  }

  return items;
}

export function parseDependencies(text: string): { from_id: string; to_id: string }[] {
  const edges: { from_id: string; to_id: string }[] = [];
  const taskMatch = TASK_RE.exec(text);
  const blockedMatch = BLOCKED_RE.exec(text);

  if (taskMatch && blockedMatch) {
    edges.push({
      from_id: `task-${taskMatch[1] || "unknown"}`,
      to_id: `task-${blockedMatch[1]}`,
    });
  }

  return edges;
}

// === CRUD ===

export function createWorkItem(db: DatabaseSync, item: Omit<WorkItem, "id" | "created_at" | "updated_at">): WorkItem {
  const id = randomUUID();
  insertItemStmt(db).run(
    id, item.type, item.title, item.status,
    item.assignee || null, item.parent_id || null,
    item.source_msg_id || null, JSON.stringify(item.tags || [])
  );
  return { id, ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

export function updateWorkItem(db: DatabaseSync, id: string, updates: { status?: string; assignee?: string }): boolean {
  const result = updateItemStmt(db).run(
    updates.status || null,
    updates.assignee || null,
    id
  );
  return result.changes > 0;
}

export function listWorkItems(db: DatabaseSync): WorkItem[] {
  return listItemsStmt(db).all().map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      type: r.type as WorkItem["type"],
      title: r.title as string,
      status: r.status as string,
      assignee: (r.assignee as string) || undefined,
      parent_id: (r.parent_id as string) || undefined,
      source_msg_id: r.source_msg_id as number | undefined,
      tags: JSON.parse(r.tags as string || "[]"),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      claimed_by: (r.claimed_by as string) || undefined,
      claimed_at: (r.claimed_at as string) || undefined,
      completed_at: (r.completed_at as string) || undefined,
      reviewer: (r.reviewer as string) || undefined,
      stage_id: (r.stage_id as string) || undefined,
    };
  });
}

export function createWorkEdge(db: DatabaseSync, from_id: string, to_id: string, relation: string): WorkEdge {
  const id = randomUUID();
  insertEdgeStmt(db).run(id, from_id, to_id, relation);
  return { id, from_id, to_id, relation };
}

export function listWorkEdges(db: DatabaseSync): WorkEdge[] {
  return listEdgesStmt(db).all().map((row: unknown) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      from_id: r.from_id as string,
      to_id: r.to_id as string,
      relation: r.relation as string,
    };
  });
}

export function getWorkGraph(db: DatabaseSync): WorkGraph {
  return {
    items: listWorkItems(db),
    edges: listWorkEdges(db),
  };
}

// === Stage Graph Tables (Phase 7a: Stage Foundation) ===

export function ensureStageTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stage_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stages (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      gate_condition TEXT NOT NULL DEFAULT '{}',
      reviewer_policy TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY(template_id) REFERENCES stage_templates(id)
    );

    CREATE TABLE IF NOT EXISTS stage_transitions (
      id TEXT PRIMARY KEY,
      from_stage_id TEXT NOT NULL,
      to_stage_id TEXT NOT NULL,
      gate_condition TEXT NOT NULL DEFAULT '{}',
      reviewer_policy TEXT NOT NULL DEFAULT '{}',
      transition_action TEXT NOT NULL DEFAULT 'advance',
      FOREIGN KEY(from_stage_id) REFERENCES stages(id),
      FOREIGN KEY(to_stage_id) REFERENCES stages(id)
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      current_stage_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(template_id) REFERENCES stage_templates(id),
      FOREIGN KEY(current_stage_id) REFERENCES stages(id)
    );
  `);

  // Migration: add stage_id to work_items (nullable, backward-compatible)
  try {
    db.exec(`ALTER TABLE work_items ADD COLUMN stage_id TEXT`);
  } catch { /* column already exists */ }
}

// === Evidence Chain Tables (Phase 7b: Cryptographic Audit) ===

export function ensureEvidenceTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence_events (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      task_id TEXT,
      stage_id TEXT,
      transition_id TEXT,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      payload TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      prev_hash TEXT NOT NULL DEFAULT '',
      signature TEXT,
      ts INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES pipeline_runs(id),
      FOREIGN KEY(task_id) REFERENCES work_items(id),
      FOREIGN KEY(stage_id) REFERENCES stages(id),
      FOREIGN KEY(transition_id) REFERENCES stage_transitions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_run ON evidence_events(run_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_prev ON evidence_events(prev_hash);
  `);
}
