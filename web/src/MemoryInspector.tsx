import { useState, useEffect } from "react";

const AGENTS = ["Noel", "Pat", "Sam"];

interface MemoryTurn {
  role: string;
  content: string;
  ts: number;
}

export function MemoryInspector({ onClose }: { onClose: () => void }) {
  const [agent, setAgent] = useState("Noel");
  const [messages, setMessages] = useState<MemoryTurn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryTurn[]>([]);
  const [stats, setStats] = useState({ total: 0, compressed_count: 0 });
  const [injectText, setInjectText] = useState("");

  const loadMessages = async (a: string) => {
    const r = await fetch(`/api/memory/${a}/messages`).then(r => r.json());
    setMessages(r.messages || []);
    setStats({ total: r.total || 0, compressed_count: r.compressed_count || 0 });
  };

  useEffect(() => { loadMessages(agent); }, [agent]);

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    const r = await fetch(`/api/memory/${agent}/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
    setSearchResults(r.results || []);
  };

  const doDelete = async (ts: number) => {
    await fetch(`/api/memory/${agent}/messages/${ts}`, { method: "DELETE" });
    loadMessages(agent);
  };

  const doInject = async () => {
    if (!injectText.trim()) return;
    await fetch(`/api/memory/${agent}/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: injectText }),
    });
    setInjectText("");
    loadMessages(agent);
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString("zh-CN");

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>🧠 记忆检视</h2>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 12px", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {AGENTS.map(a => (
          <button key={a} onClick={() => setAgent(a)}
            style={{ padding: "4px 14px", background: agent === a ? "#333" : "#f0f0f0", color: agent === a ? "#fff" : "#333", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>
            {a}
          </button>
        ))}
      </div>

      <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 12 }}>
        总计 {stats.total} 条 · 已压缩 {stats.compressed_count} 条
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          placeholder="搜索记忆..." style={{ flex: 1, padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.85rem" }} />
        <button onClick={doSearch} style={{ padding: "6px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>搜索</button>
      </div>

      {searchResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.9rem" }}>搜索结果 ({searchResults.length})</div>
          {searchResults.map((m, i) => (
            <div key={i} style={{ padding: "8px", background: "#fffbe6", borderRadius: 4, marginBottom: 4, fontSize: "0.82rem" }}>
              <span style={{ color: m.role === "user" ? "#e06c75" : m.role === "assistant" ? "#61afef" : "#888" }}>[{m.role}]</span>{" "}
              {m.content.slice(0, 200)}
              <span style={{ color: "#aaa", marginLeft: 8, fontSize: "0.7rem" }}>{formatTime(m.ts)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.9rem" }}>注入记忆</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={injectText} onChange={e => setInjectText(e.target.value)}
            placeholder="User prefers..." style={{ flex: 1, padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.85rem" }} />
          <button onClick={doInject} style={{ padding: "6px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>注入</button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.9rem" }}>最近消息</div>
        {messages.slice(-30).reverse().map((m, i) => (
          <div key={i} style={{
            padding: "8px", background: m.role === "system" ? "#f0f0ff" : "#fafafa",
            borderRadius: 4, marginBottom: 4, fontSize: "0.8rem",
            borderLeft: `3px solid ${m.role === "user" ? "#e06c75" : m.role === "assistant" ? "#61afef" : "#ccc"}`,
            display: "flex", justifyContent: "space-between", alignItems: "flex-start"
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ color: "#888", fontSize: "0.7rem" }}>[{m.role}]</span>{" "}
              {m.content.slice(0, 200)}
            </div>
            <button onClick={() => doDelete(m.ts)}
              style={{ background: "none", border: "none", color: "#e06c75", cursor: "pointer", fontSize: "0.75rem", padding: "0 4px" }}
              title="删除此记忆">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
