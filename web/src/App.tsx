import { useEffect, useState, useRef, useCallback } from "react";
import { fetchMessages, sendChat, type ChatMessage } from "./api";
import { KanbanView } from "./KanbanView";

const CHANNEL = "general";
const AGENT_COLORS: Record<string, string> = {
  you: "var(--c-you)",
  Noel: "var(--c-noel)",
  Pat: "var(--c-pat)",
  Sam: "var(--c-sam)",
};

export function App(): JSX.Element {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "kanban">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessages(CHANNEL));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      await sendChat(CHANNEL, text);
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
          single channel · try @Noel @Pat @Sam
        </span>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button
            onClick={() => setView("chat")}
            style={{
              padding: "4px 14px",
              background: view === "chat" ? "#333" : "transparent",
              color: view === "chat" ? "#fff" : "#888",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setView("kanban")}
            style={{
              padding: "4px 14px",
              background: view === "kanban" ? "#333" : "transparent",
              color: view === "kanban" ? "#fff" : "#888",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            📋 Kanban
          </button>
        </div>
      </header>
      {view === "kanban" ? (
        <KanbanView onClose={() => setView("chat")} />
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
