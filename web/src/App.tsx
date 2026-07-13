import { useEffect, useState, useRef, useCallback } from "react";
import { fetchMessages, sendChat, type ChatMessage } from "./api";
import { KanbanView } from "./KanbanView";
import { MemoryInspector } from "./MemoryInspector";

const AGENT_COLORS: Record<string, string> = {
  you: "var(--c-you)",
  Noel: "var(--c-noel)",
  Pat: "var(--c-pat)",
  Sam: "var(--c-sam)",
};

interface Channel {
  name: string;
  agents: string[];
  message_count: number;
}

export function App(): JSX.Element {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState("general");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "kanban" | "memory">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    try { setChannels(await fetch("/api/channels").then(r => r.json())); } catch {}
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessages(activeChannel));
    } catch (e) { setError(String(e)); }
  }, [activeChannel]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      await sendChat(activeChannel, text);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>coforge</h1>
        <span className="subtitle">
          {channels.length} channel{channels.length !== 1 ? "s" : ""} · try @Noel @Pat @Sam
        </span>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {channels.map(c => (
            <button key={c.name} onClick={() => { setActiveChannel(c.name); setView("chat"); }}
              style={{ padding: "3px 12px", background: activeChannel === c.name ? "#333" : "#f0f0f0", color: activeChannel === c.name ? "#fff" : "#666", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.78rem" }}>
              # {c.name} <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>{c.message_count}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          {(["chat", "kanban", "memory"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "4px 14px", background: view === v ? "#333" : "transparent", color: view === v ? "#fff" : "#888", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}>
              {v === "chat" ? "💬 Chat" : v === "kanban" ? "📋 Kanban" : "🧠 Memory"}
            </button>
          ))}
        </div>
      </header>
      {view === "kanban" ? (
        <KanbanView onClose={() => setView("chat")} />
      ) : view === "memory" ? (
        <MemoryInspector onClose={() => setView("chat")} />
      ) : (
        <>
      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">say hi to an agent — @Noel I&apos;m wizout</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="msg">
            <span className="author" style={{ color: AGENT_COLORS[m.author] ?? "var(--c-other)" }}>
              {m.author}
            </span>
            <span className="text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="input-row" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="@Noel …"
          disabled={busy}
          autoFocus
        />
        <button type="submit" disabled={busy}>
          {busy ? "…" : "send"}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
        </>
      )}
    </div>
  );
}
