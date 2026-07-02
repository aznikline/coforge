#!/usr/bin/env python3
"""
coforge benchmark — gather real numbers for the AgenticOS vision paper.

Two measurements, each substantiating a row of the workaround→OS-abstraction
mapping in docs/18:

  1. SERIAL-QUEUE LATENCY (coforge's "no agent scheduling" workaround)
     Fire N @mentions at one channel concurrently. coforge's serial queue
     processes them one at a time, so request i waits for i-1 predecessors.
     Measures end-to-end latency per request as N grows.

  2. PROMPT-REPLAY TOKEN COST (coforge's "no memory abstraction" workaround)
     Talk to one agent for M turns. coforge replays the FULL history into the
     prompt each turn, so input tokens grow ~linearly with history length.
     Calls the LLM directly (same OpenAI-compatible endpoint coforge uses) to
     read the real usage.prompt_tokens per turn.

Outputs JSON to stdout. No fabrication — every number is measured.
"""
import json, time, urllib.request, urllib.error, os, sys, http.client
from concurrent.futures import ThreadPoolExecutor, as_completed

ROUTER = "http://localhost:8787"
LLM_URL = os.environ.get("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1") + "/chat/completions"
LLM_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "glm-5.1")

def post_router(channel, text):
    body = json.dumps({"channel": channel, "text": text}).encode()
    req = urllib.request.Request(f"{ROUTER}/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read())
    return time.time() - t0, d

def call_llm(messages):
    body = json.dumps({"model": LLM_MODEL, "messages": messages, "temperature": 0.7}).encode()
    last_err = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(LLM_URL, data=body, headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {LLM_KEY}",
            })
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
            usage = d.get("usage", {})
            return time.time() - t0, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), d["choices"][0]["message"]["content"]
        except (urllib.error.URLError, http.client.RemoteDisconnected, ConnectionResetError) as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err

# ---- Measurement 1: serial-queue latency ----
def bench_queue():
    results = []
    for n in [1, 2, 4, 8]:
        ch = f"qbench-{n}-{int(time.time())}"
        texts = [f"@Noel say only the number {i}" for i in range(n)]
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=n) as ex:
            futs = [ex.submit(post_router, ch, t) for t in texts]
            lats = [f.result()[0] for f in as_completed(futs)]
        wall = time.time() - t0
        results.append({
            "concurrent_requests": n,
            "per_request_latency_s": sorted(round(x, 2) for x in lats),
            "wall_clock_s": round(wall, 2),
            "note": "serial queue: requests processed one-at-a-time, latency stacks",
        })
    return results

# ---- Measurement 2: prompt-replay token cost ----
def bench_replay():
    persona = ("You are Noel, a frontend engineer teammate. Speak concisely. "
               "Remember what the user tells you.")
    history = [{"role": "system", "content": persona}]
    results = []
    user_turns = [
        "I'm Alex, working on a rendering engine called forge.",
        "It uses WebGPU for the frontend.",
        "We hit a problem with buffer recycling.",
        "The team has 3 engineers.",
        "Our staging environment is on fly.io.",
        "I prefer dark themes for dashboards.",
        "We ship every Thursday.",
        "Our p99 latency target is 200ms.",
    ]
    for i, turn in enumerate(user_turns, 1):
        history.append({"role": "user", "content": turn})
        dt, ptokens, ctokens, reply = call_llm(history)
        history.append({"role": "assistant", "content": reply})
        results.append({
            "turn": i,
            "history_turns_in_prompt": len(history),
            "prompt_tokens": ptokens,
            "completion_tokens": ctokens,
            "latency_s": round(dt, 2),
            "note": "full history replayed into prompt every turn",
        })
    return results

def main():
    out = {"llm_model": LLM_MODEL}
    try:
        out["measurement_1_serial_queue"] = bench_queue()
        print("M1_DONE", file=sys.stderr); sys.stderr.flush()
    except Exception as e:
        out["measurement_1_error"] = str(e)
    try:
        out["measurement_2_prompt_replay"] = bench_replay()
        print("M2_DONE", file=sys.stderr); sys.stderr.flush()
    except Exception as e:
        out["measurement_2_error"] = str(e)
    print(json.dumps(out, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
