export interface AgentConfig {
  readonly name: string;
  readonly color: string;
  readonly role: string;
  readonly persona: string;
  readonly skills: readonly string[];
}

export interface ChatMessage {
  readonly id: number;
  readonly channel: string;
  readonly author: string;
  readonly text: string;
  readonly ts: number;
}

export interface ChatRequest {
  readonly channel: string;
  readonly text: string;
}

export interface ChatResponse {
  readonly messages: readonly ChatMessage[];
}

export interface AgentRegistry {
  readonly agents: readonly AgentConfig[];
}

// === Work Graph (Phase 3: multi-view) ===

export interface WorkItem {
  readonly id: string;
  readonly type: "task" | "decision" | "note";
  readonly title: string;
  readonly status: string;
  readonly assignee?: string;
  readonly parent_id?: string;
  readonly source_msg_id?: number;
  readonly tags: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly claimed_by?: string;
  readonly claimed_at?: string;
  readonly completed_at?: string;
  readonly reviewer?: string;
  readonly stage_id?: string;
}

export interface WorkEdge {
  readonly id: string;
  readonly from_id: string;
  readonly to_id: string;
  readonly relation: string;
}

export interface WorkGraph {
  readonly items: readonly WorkItem[];
  readonly edges: readonly WorkEdge[];
}

// === Stage Graph (Phase 7a: Stage Foundation) ===

export interface StageTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface StageDefinition {
  readonly id: string;
  readonly template_id: string;
  readonly name: string;
  readonly order: number;
  readonly gate_condition: string;   // JSON: { type, config }
  readonly reviewer_policy: string;  // JSON: { type, config }
  readonly status: "pending" | "active" | "completed";
}

export interface StageTransition {
  readonly id: string;
  readonly from_stage_id: string;
  readonly to_stage_id: string;
  readonly gate_condition: string;   // JSON: evaluated at transition time
  readonly reviewer_policy: string;  // JSON
  readonly transition_action: "advance" | "reject" | "branch";
}

export interface PipelineRun {
  readonly id: string;
  readonly template_id: string;
  readonly current_stage_id: string;
  readonly status: "active" | "completed" | "rejected";
  readonly created_at: string;
  readonly updated_at: string;
}

// === Evidence Chain (Phase 7b: Cryptographic Audit) ===

export interface EvidenceEvent {
  readonly id: string;
  readonly run_id?: string;
  readonly task_id?: string;
  readonly stage_id?: string;
  readonly transition_id?: string;
  readonly event_type: "gate_check" | "reviewer_signoff" | "artifact_hash" | "transition_executed";
  readonly actor: string;
  readonly payload: string;         // JSON: event details
  readonly payload_hash: string;    // SHA-256 of payload
  readonly prev_hash: string;       // chain link (previous event's payload_hash)
  readonly signature?: string;      // Ed25519 signature
  readonly ts: number;
}
