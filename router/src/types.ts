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
