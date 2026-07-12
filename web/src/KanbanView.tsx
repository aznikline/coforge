import { useState, useEffect } from "react";
import type { WorkItem, WorkGraph } from "./types";

interface Props {
  onClose: () => void;
}

const STATUSES = ["todo", "in_progress", "in_review", "done", "blocked"];
const STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  in_progress: "进行中",
  in_review: "审查中",
  done: "完成",
  blocked: "阻塞",
};

export function KanbanView({ onClose }: Props) {
  const [graph, setGraph] = useState<WorkGraph>({ items: [], edges: [] });

  useEffect(() => {
    fetch("/api/workgraph")
      .then((r) => r.json())
      .then(setGraph)
      .catch(console.error);
    const interval = setInterval(() => {
      fetch("/api/workgraph")
        .then((r) => r.json())
        .then(setGraph)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const itemsByStatus = (status: string) =>
    graph.items.filter((i) => i.status === status);

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>📋 工作看板</h2>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {STATUSES.map((status) => (
          <div
            key={status}
            style={{
              background: "#f5f5f5",
              borderRadius: "8px",
              padding: "12px",
              minHeight: "200px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: "8px",
                fontSize: "0.85rem",
                color: "#555",
              }}
            >
              {STATUS_LABELS[status] || status} ({itemsByStatus(status).length})
            </div>
            {itemsByStatus(status).map((item) => (
              <KanbanCard key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ item }: { item: WorkItem }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "6px",
        padding: "10px",
        marginBottom: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        fontSize: "0.82rem",
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: "4px" }}>{item.title}</div>
      <div style={{ fontSize: "0.7rem", color: "#888" }}>
        {item.assignee && `@${item.assignee}`}
        {item.tags.length > 0 && ` · ${item.tags.join(", ")}`}
      </div>
    </div>
  );
}
