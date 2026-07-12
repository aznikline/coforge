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
