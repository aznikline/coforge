import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { StageTemplate, StageDefinition, StageTransition, PipelineRun, WorkItem } from "./types.js";

// === Template CRUD ===

const insertTemplateStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO stage_templates (id, name, description) VALUES (?, ?, ?)`
);

const listTemplatesStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stage_templates ORDER BY created_at DESC`
);

const getTemplateStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stage_templates WHERE id = ?`
);

export function createTemplate(
  db: DatabaseSync,
  name: string,
  description: string,
): StageTemplate {
  const id = randomUUID();
  insertTemplateStmt(db).run(id, name, description);
  return {
    id,
    name,
    description,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function listTemplates(db: DatabaseSync): StageTemplate[] {
  return (listTemplatesStmt(db).all() as Record<string, unknown>[]).map(rowToTemplate);
}

export function getTemplate(db: DatabaseSync, id: string): StageTemplate | null {
  const row = getTemplateStmt(db).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToTemplate(row);
}

function rowToTemplate(row: Record<string, unknown>): StageTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// === Stage CRUD ===

const insertStageStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO stages (id, template_id, name, "order", gate_condition, reviewer_policy, status)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const listStagesStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stages WHERE template_id = ? ORDER BY "order" ASC`
);

const getStageStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stages WHERE id = ?`
);

const updateStageStatusStmt = (db: DatabaseSync) => db.prepare(
  `UPDATE stages SET status = ? WHERE id = ?`
);

export function createStage(
  db: DatabaseSync,
  template_id: string,
  name: string,
  order: number,
  gate_condition: string,
  reviewer_policy: string,
): StageDefinition {
  const id = randomUUID();
  insertStageStmt(db).run(id, template_id, name, order, gate_condition, reviewer_policy, "pending");
  return {
    id,
    template_id,
    name,
    order,
    gate_condition,
    reviewer_policy,
    status: "pending",
  };
}

export function listStages(db: DatabaseSync, template_id: string): StageDefinition[] {
  return (listStagesStmt(db).all(template_id) as Record<string, unknown>[]).map(rowToStage);
}

export function getStage(db: DatabaseSync, id: string): StageDefinition | null {
  const row = getStageStmt(db).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToStage(row);
}

export function updateStageStatus(
  db: DatabaseSync,
  id: string,
  status: StageDefinition["status"],
): boolean {
  const result = updateStageStatusStmt(db).run(status, id);
  return result.changes > 0;
}

function rowToStage(row: Record<string, unknown>): StageDefinition {
  return {
    id: row.id as string,
    template_id: row.template_id as string,
    name: row.name as string,
    order: row.order as number,
    gate_condition: row.gate_condition as string,
    reviewer_policy: row.reviewer_policy as string,
    status: row.status as StageDefinition["status"],
  };
}

// === Stage Transition CRUD ===

const insertTransitionStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO stage_transitions (id, from_stage_id, to_stage_id, gate_condition, reviewer_policy, transition_action)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const listTransitionsStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stage_transitions WHERE from_stage_id = ?`
);

export function createTransition(
  db: DatabaseSync,
  from_stage_id: string,
  to_stage_id: string,
  gate_condition: string,
  reviewer_policy: string,
  transition_action: StageTransition["transition_action"],
): StageTransition {
  const id = randomUUID();
  insertTransitionStmt(db).run(id, from_stage_id, to_stage_id, gate_condition, reviewer_policy, transition_action);
  return { id, from_stage_id, to_stage_id, gate_condition, reviewer_policy, transition_action };
}

export function listTransitions(db: DatabaseSync, from_stage_id: string): StageTransition[] {
  return (listTransitionsStmt(db).all(from_stage_id) as Record<string, unknown>[]).map(rowToTransition);
}

function rowToTransition(row: Record<string, unknown>): StageTransition {
  return {
    id: row.id as string,
    from_stage_id: row.from_stage_id as string,
    to_stage_id: row.to_stage_id as string,
    gate_condition: row.gate_condition as string,
    reviewer_policy: row.reviewer_policy as string,
    transition_action: row.transition_action as StageTransition["transition_action"],
  };
}

// === Pipeline Run CRUD ===

const insertRunStmt = (db: DatabaseSync) => db.prepare(
  `INSERT INTO pipeline_runs (id, template_id, current_stage_id, status) VALUES (?, ?, ?, ?)`
);

const getRunStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM pipeline_runs WHERE id = ?`
);

const listRunsStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM pipeline_runs ORDER BY created_at DESC`
);

const updateRunStmt = (db: DatabaseSync) => db.prepare(
  `UPDATE pipeline_runs SET current_stage_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
);

export function createRun(
  db: DatabaseSync,
  template_id: string,
  current_stage_id: string,
): PipelineRun {
  const id = randomUUID();
  insertRunStmt(db).run(id, template_id, current_stage_id, "active");
  return {
    id,
    template_id,
    current_stage_id,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getRun(db: DatabaseSync, id: string): PipelineRun | null {
  const row = getRunStmt(db).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToRun(row);
}

export function listRuns(db: DatabaseSync): PipelineRun[] {
  return (listRunsStmt(db).all() as Record<string, unknown>[]).map(rowToRun);
}

export function updateRun(
  db: DatabaseSync,
  id: string,
  current_stage_id: string,
  status: PipelineRun["status"],
): boolean {
  const result = updateRunStmt(db).run(current_stage_id, status, id);
  return result.changes > 0;
}

function rowToRun(row: Record<string, unknown>): PipelineRun {
  return {
    id: row.id as string,
    template_id: row.template_id as string,
    current_stage_id: row.current_stage_id as string,
    status: row.status as PipelineRun["status"],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// === Convenience: create template with stages and transitions ===

export interface CreateTemplateInput {
  name: string;
  description: string;
  stages: {
    name: string;
    order: number;
    gate_condition?: string;
    reviewer_policy?: string;
  }[];
  transitions?: {
    from_stage_order: number;
    to_stage_order: number;
    gate_condition?: string;
    reviewer_policy?: string;
    transition_action?: StageTransition["transition_action"];
  }[];
}

export function createTemplateWithStages(
  db: DatabaseSync,
  input: CreateTemplateInput,
): { template: StageTemplate; stages: StageDefinition[]; transitions: StageTransition[] } {
  const template = createTemplate(db, input.name, input.description);

  const stages = input.stages.map(s =>
    createStage(
      db,
      template.id,
      s.name,
      s.order,
      s.gate_condition || JSON.stringify({ type: "all_tasks_done" }),
      s.reviewer_policy || JSON.stringify({ type: "human" }),
    ),
  );

  const transitions: StageTransition[] = [];
  if (input.transitions) {
    for (const t of input.transitions) {
      const fromStage = stages.find(s => s.order === t.from_stage_order);
      const toStage = stages.find(s => s.order === t.to_stage_order);
      if (fromStage && toStage) {
        transitions.push(
          createTransition(
            db,
            fromStage.id,
            toStage.id,
            t.gate_condition || JSON.stringify({ type: "all_tasks_done" }),
            t.reviewer_policy || JSON.stringify({ type: "human" }),
            t.transition_action || "advance",
          ),
        );
      }
    }
  }

  return { template, stages, transitions };
}

// === Seed: built-in templates ===

const SEEDED_TEMPLATES = [
  {
    name: "SWE Pipeline",
    description: "Standard software engineering pipeline: spec → impl → review → merge",
    stages: [
      { name: "spec", order: 0, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"human"}' },
      { name: "impl", order: 1, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"agent"}' },
      { name: "review", order: 2, gate_condition: '{"type":"reviewer_approved"}', reviewer_policy: '{"type":"panel","config":{"quorum":2,"agents":["Noel","Pat","Sam"]}}' },
      { name: "merge", order: 3, gate_condition: '{"type":"reviewer_approved"}', reviewer_policy: '{"type":"human"}' },
    ],
    transitions: [
      { from: 0, to: 1, action: "advance" as const },
      { from: 1, to: 2, action: "advance" as const },
      { from: 2, to: 3, action: "advance" as const },
      { from: 2, to: 1, action: "reject" as const },
    ],
  },
  {
    name: "Paper Pipeline",
    description: "Academic paper pipeline: idea → lit review → method → experiment → draft → revise → submit",
    stages: [
      { name: "idea", order: 0, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"human"}' },
      { name: "lit_review", order: 1, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"agent"}' },
      { name: "method", order: 2, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"human"}' },
      { name: "experiment", order: 3, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"agent"}' },
      { name: "draft", order: 4, gate_condition: '{"type":"all_tasks_done"}', reviewer_policy: '{"type":"agent"}' },
      { name: "revise", order: 5, gate_condition: '{"type":"reviewer_approved"}', reviewer_policy: '{"type":"human"}' },
      { name: "submit", order: 6, gate_condition: '{"type":"reviewer_approved"}', reviewer_policy: '{"type":"human"}' },
    ],
    transitions: [
      { from: 0, to: 1, action: "advance" as const },
      { from: 1, to: 2, action: "advance" as const },
      { from: 2, to: 3, action: "advance" as const },
      { from: 3, to: 4, action: "advance" as const },
      { from: 4, to: 5, action: "advance" as const },
      { from: 5, to: 6, action: "advance" as const },
      { from: 5, to: 4, action: "reject" as const },
    ],
  },
];

/** Seed built-in templates if none exist. Idempotent — skips if templates already present. */
export function seedTemplates(db: DatabaseSync): StageTemplate[] {
  const existing = listTemplates(db);
  if (existing.length > 0) return existing;

  const created: StageTemplate[] = [];
  for (const tpl of SEEDED_TEMPLATES) {
    const stagesInput = tpl.stages.map((s, i) => ({
      name: s.name,
      order: i,
      gate_condition: s.gate_condition,
      reviewer_policy: s.reviewer_policy,
    }));
    const transitionsInput = tpl.transitions.map(t => ({
      from_stage_order: t.from,
      to_stage_order: t.to,
      transition_action: t.action,
    }));

    const result = createTemplateWithStages(db, {
      name: tpl.name,
      description: tpl.description,
      stages: stagesInput,
      transitions: transitionsInput,
    });
    created.push(result.template);
  }
  return created;
}

// === Stage State Machine (Phase 7c) ===

const VALID_STAGE_TRANSITIONS: Record<string, string[]> = {
  pending: ["active"],
  active: ["completed"],
  completed: [],
};

export function isValidStageTransition(from: string, to: string): boolean {
  return (VALID_STAGE_TRANSITIONS[from] || []).includes(to);
}

// === Gate Evaluation ===

interface GateCondition {
  type: "all_tasks_done" | "reviewer_approved" | "quorum";
  config?: Record<string, unknown>;
}

interface GateResult {
  passed: boolean;
  reason: string;
}

const allTasksByStageStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM work_items WHERE stage_id = ? AND type = 'task'`
);

const signedEvidenceStmt = (db: DatabaseSync) => db.prepare(
  `SELECT COUNT(*) as count FROM evidence_events WHERE stage_id = ? AND event_type = 'reviewer_signoff' AND signature IS NOT NULL`
);

/**
 * Evaluate a gate condition against the current state.
 * Supported types:
 * - "all_tasks_done": all tasks in the stage must be in "done" status
 * - "reviewer_approved": at least one signed reviewer_signoff evidence event exists
 * - "quorum": N of M reviewers have signed off
 */
export function evaluateGate(
  db: DatabaseSync,
  stage: StageDefinition,
): GateResult {
  const condition: GateCondition = JSON.parse(stage.gate_condition);

  switch (condition.type) {
    case "all_tasks_done": {
      const tasks = (allTasksByStageStmt(db).all(stage.id) as Record<string, unknown>[])
        .map(row => ({ status: row.status as string }));
      if (tasks.length === 0) {
        return { passed: true, reason: "no tasks in stage — gate passes vacuously" };
      }
      const done = tasks.filter(t => t.status === "done").length;
      if (done === tasks.length) {
        return { passed: true, reason: `all ${done} tasks completed` };
      }
      return { passed: false, reason: `${done}/${tasks.length} tasks done` };
    }

    case "reviewer_approved": {
      const row = signedEvidenceStmt(db).get(stage.id) as { count: number };
      if (row.count > 0) {
        return { passed: true, reason: `${row.count} signed reviewer signoff(s)` };
      }
      return { passed: false, reason: "no signed reviewer signoff" };
    }

    case "quorum": {
      const quorum = (condition.config?.quorum as number) || 2;
      const row = signedEvidenceStmt(db).get(stage.id) as { count: number };
      if (row.count >= quorum) {
        return { passed: true, reason: `quorum met: ${row.count}/${quorum} signed` };
      }
      return { passed: false, reason: `quorum not met: ${row.count}/${quorum} signed` };
    }

    default:
      return { passed: false, reason: `unknown gate condition type: ${(condition as { type: string }).type}` };
  }
}

// === Transition Execution ===

export interface TransitionResult {
  run: PipelineRun;
  from_stage: StageDefinition;
  to_stage: StageDefinition;
  transition: StageTransition;
  gate_result: GateResult;
  evidence_id?: string;
}

/**
 * Execute a stage transition on a pipeline run.
 * 1. Validates the transition exists and is valid
 * 2. Evaluates the gate condition
 * 3. If passed: updates stage statuses + run current_stage
 * 4. Records 4W evidence event (who/what/when/why)
 *
 * The evidence recording is imported lazily to avoid circular deps.
 */
export async function executeTransition(
  db: DatabaseSync,
  run_id: string,
  transition_id: string,
  reviewer: string,
): Promise<TransitionResult> {
  // Load run
  const run = getRun(db, run_id);
  if (!run) throw new Error(`run ${run_id} not found`);
  if (run.status === "completed" || run.status === "rejected") {
    throw new Error(`run ${run_id} is already ${run.status}`);
  }

  // Load transition
  const tRow = db.prepare("SELECT * FROM stage_transitions WHERE id = ?").get(transition_id) as Record<string, unknown> | undefined;
  if (!tRow) throw new Error(`transition ${transition_id} not found`);

  const fromStage = getStage(db, run.current_stage_id);
  if (!fromStage) throw new Error(`current stage ${run.current_stage_id} not found`);
  if (tRow.from_stage_id !== fromStage.id) {
    throw new Error(`transition ${transition_id} is not from current stage ${fromStage.name}`);
  }

  const toStage = getStage(db, tRow.to_stage_id as string);
  if (!toStage) throw new Error(`target stage ${tRow.to_stage_id} not found`);

  // Validate stage-level state machine
  if (!isValidStageTransition(fromStage.status, "completed")) {
    // Allow transition if stage is pending or active
    if (fromStage.status === "completed") {
      throw new Error(`stage ${fromStage.name} is already completed`);
    }
  }

  // Evaluate gate
  const gateResult = evaluateGate(db, fromStage);
  if (!gateResult.passed) {
    throw new Error(`gate check failed: ${gateResult.reason}`);
  }

  // Execute transition
  const action = tRow.transition_action as StageTransition["transition_action"];

  if (action === "advance") {
    updateStageStatus(db, fromStage.id, "completed");
    updateStageStatus(db, toStage.id, "active");
    updateRun(db, run_id, toStage.id, "active");
  } else if (action === "reject") {
    updateStageStatus(db, fromStage.id, "completed");
    updateStageStatus(db, toStage.id, "active");
    updateRun(db, run_id, toStage.id, "active");
  } else if (action === "branch") {
    updateStageStatus(db, toStage.id, "active");
  }

  // Record 4W evidence
  let evidenceId: string | undefined;
  try {
    const { recordTransitionEvidence } = await import("./evidence.js");
    const ev = recordTransitionEvidence(db, {
      run_id,
      stage_id: fromStage.id,
      transition_id,
      from_stage_name: fromStage.name,
      to_stage_name: toStage.name,
      reviewer,
      gate_result: gateResult,
    });
    evidenceId = ev.id;
  } catch {
    // evidence module may not be available; non-fatal for transition
  }

  const updatedRun = getRun(db, run_id)!;

  return {
    run: updatedRun,
    from_stage: fromStage,
    to_stage: toStage,
    transition: {
      id: tRow.id as string,
      from_stage_id: tRow.from_stage_id as string,
      to_stage_id: tRow.to_stage_id as string,
      gate_condition: tRow.gate_condition as string,
      reviewer_policy: tRow.reviewer_policy as string,
      transition_action: action,
    },
    gate_result: gateResult,
    evidence_id: evidenceId,
  };
}

// === Available Transitions ===

const transitionsFromStageStmt = (db: DatabaseSync) => db.prepare(
  `SELECT * FROM stage_transitions WHERE from_stage_id = ?`
);

/** Get all transitions available from a given stage. */
export function getTransitionsFromStage(db: DatabaseSync, stage_id: string): StageTransition[] {
  return (transitionsFromStageStmt(db).all(stage_id) as Record<string, unknown>[]).map(rowToTransition);
}
