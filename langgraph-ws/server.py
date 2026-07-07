"""Minimal LangGraph stateful agent as an HTTP service — a third workspace
for the harness to probe.

This is a real third-party framework (LangGraph), not a mock. It uses
glm-5.1 via the OpenAI-compatible bailian endpoint (BYOK — same key coforge
uses), so no Letta credits / Docker needed.

Implements the four surfaces the harness adapter contract needs:
  - POST /chat        {agent, text} -> {reply, usage}      (sendMention)
  - POST /reset       -> {ok}                              (resetWorkspace)
  - GET  /memory?agent=... -> {rows}                       (storageObserver)
  - GET  /crossread?attacker=&target= -> {crossed, detail} (faultInjection)

The agent is stateful via LangGraph's MemorySaver checkpointer — so unlike
coforge's full-replay, this one *has* a managed-state layer. The comparison
report should show whether that actually avoids the managed-state wall.
"""
from __future__ import annotations
import os, json, sqlite3, sys
from pathlib import Path
from typing import Annotated, TypedDict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from langgraph.graph import StateGraph, START
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI

# --- config from env (same as coforge router) ---
LLM_API_KEY = os.environ["LLM_API_KEY"]
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "glm-5.1")
DB_PATH = os.environ.get("LANGGRAPH_DB_PATH", str(Path(__file__).resolve().parent.parent / "langgraph-ws.db"))
PORT = int(os.environ.get("LANGGRAPH_WS_PORT", "8788"))

# --- a shared SQLite store, mirroring coforge's per-agent rows, so the
#     isolation/fault-injection probe has the same surface to attack ---
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS agent_memory (agent TEXT, role TEXT, content TEXT, ts INTEGER)")
    conn.commit()
    return conn

# --- LangGraph state + agent ---
class State(TypedDict):
    agent: str
    user_text: str
    reply: str

llm = ChatOpenAI(model=LLM_MODEL, api_key=LLM_API_KEY, base_url=LLM_BASE_URL, temperature=0.7, max_retries=6)

PERSONAS = {
    "Noel": "You are Noel, a frontend engineer teammate. Speak concisely. Remember what the user tells you.",
    "Pat": "You are Pat, a backend engineer teammate. Speak concisely. Remember what the user tells you.",
    "Sam": "You are Sam, a technical writer. Speak concisely. Remember what the user tells you.",
}

def call_model(state: State) -> dict:
    persona = PERSONAS.get(state["agent"], f"You are {state['agent']}.")
    # Store the user turn in the shared SQLite (so storage/cross-read probes work)
    conn = db()
    conn.execute("INSERT INTO agent_memory VALUES (?,?,?,?)", (state["agent"], "user", state["user_text"], int(__import__("time").time())))
    # Build history from stored rows (this workspace DOES replay — so the
    # prompt-replay wall should appear, like coforge)
    rows = conn.execute("SELECT role, content FROM agent_memory WHERE agent=? ORDER BY ts ASC", (state["agent"],)).fetchall()
    conn.close()
    msgs = [{"role": "system", "content": persona}] + [
        {"role": r[0], "content": r[1]} for r in rows
    ]
    resp = llm.invoke(msgs)
    reply = (resp.content or "").strip()
    conn = db()
    conn.execute("INSERT INTO agent_memory VALUES (?,?,?,?)", (state["agent"], "assistant", reply, int(__import__("time").time())))
    conn.commit()
    conn.close()
    # usage — langchain hides it; read from resp.response_metadata
    md = getattr(resp, "response_metadata", {}) or {}
    token_usage = (md.get("token_usage") or {}) if isinstance(md, dict) else {}
    return {"reply": reply, "_usage": {
        "prompt_tokens": token_usage.get("prompt_tokens", token_usage.get("promptTokens", 0)),
        "completion_tokens": token_usage.get("completion_tokens", token_usage.get("completionTokens", 0)),
    }}

graph_builder = StateGraph(State)
graph_builder.add_node("call", call_model)
graph_builder.add_edge(START, "call")
graph = graph_builder.compile(checkpointer=MemorySaver())

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/chat")
async def chat(body: dict):
    agent = body.get("agent", "Noel")
    text = body.get("text", "")
    # run through langgraph (thread per agent, so state accumulates)
    config = {"configurable": {"thread_id": agent}}
    result = await graph.ainvoke({"agent": agent, "user_text": text, "reply": ""}, config=config)
    return {"reply": result.get("reply", ""), "usage": result.get("_usage", {"prompt_tokens": 0, "completion_tokens": 0})}

@app.post("/reset")
async def reset():
    conn = db()
    conn.execute("DELETE FROM agent_memory")
    conn.commit()
    conn.close()
    # MemorySaver is in-memory; restarting the process clears it. For
    # cross-run reset within a process, we can't easily clear MemorySaver's
    # dict, so note it — but our SQLite history is the source of truth for
    # probes (history is rebuilt from SQLite each turn), so clearing it
    # suffices.
    return {"ok": True}

@app.get("/memory")
async def memory(agent: str):
    conn = db()
    n = conn.execute("SELECT COUNT(*) FROM agent_memory WHERE agent=?", (agent,)).fetchone()[0]
    conn.close()
    return {"rows": n}

@app.get("/crossread")
async def crossread(attacker: str, target: str):
    # The "application's own code" reads the shared SQLite directly — the
    # per-agent boundary is advisory, same structure as coforge.
    conn = db()
    row = conn.execute("SELECT content FROM agent_memory WHERE agent=? ORDER BY ts DESC LIMIT 1", (target,)).fetchone()
    conn.close()
    crossed = row is not None and row[0] is not None
    return {"crossed": crossed, "detail": f"langgraph-ws attacker read target '{target}' via shared SQLite" if crossed else f"no {target} memory"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
