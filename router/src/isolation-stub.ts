// isolation-stub.ts — a runnable proof that user-space agent isolation is
// structurally best-effort. NOT a feature; a demonstration of the wall.
//
// See docs/18 §4, paper §4, and the comment on talkToAgent in agents.ts.
// The paper argues isolation cannot be done correctly in user space because
// the application is both the enforcer (it draws the boundary) and the
// enforced-upon (its own bugs / prompt-injected agents cross the boundary,
// and it has no vantage point to detect the crossing). This file makes that
// argument executable: each attempt below is shown to hold or fail, and the
// reason is always the enforcer==enforced-upon structure.
//
// Run:  npx tsx src/isolation-stub.ts
//
// Each attempt prints:
//   ATTEMPT <n>: <name>
//   holds: <yes/no>
//   reason: <why — always traceable to the app being on both sides>

import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

interface AttemptResult {
  readonly name: string;
  readonly holds: boolean;
  readonly reason: string;
}

function report(r: AttemptResult): void {
  console.log(`ATTEMPT: ${r.name}`);
  console.log(`  holds: ${r.holds ? "yes" : "no"}`);
  console.log(`  reason: ${r.reason}`);
  console.log();
}

// --- Attempt 1: per-agent table separation in a shared SQLite file -------
// "Isolation" by giving each agent its own table in the same DB. The boundary
// is a query (WHERE agent = ?), enforced by... the same application code that
// a buggy or injected agent can simply not use.
function attempt1_tableSeparation(): AttemptResult {
  const dir = mkdtempSync(join(tmpdir(), "coforge-iso1-"));
  const dbPath = join(dir, "shared.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS agent_memory (agent TEXT, role TEXT, content TEXT)`);

  // Agent A stores a secret.
  const SECRET = "A's secret: the launch code is 0000";
  db.prepare("INSERT INTO agent_memory VALUES (?, ?, ?)").run("AgentA", "user", SECRET);

  // "Isolated" agent B is *supposed* to see only its own rows.
  const bRows = db.prepare("SELECT content FROM agent_memory WHERE agent = ?").all("AgentB");

  // But the DB handle B holds can read A's rows directly — the boundary is
  // advisory, bypassable by any query B's code chooses to run.
  const aRowsViaBHandle = db.prepare("SELECT content FROM agent_memory WHERE agent = ?").all("AgentA");

  db.close();
  rmSync(dir, { recursive: true, force: true });

  void bRows;
  const crossed = aRowsViaBHandle.length > 0;
  return {
    name: "1. per-agent table separation in a shared DB",
    holds: !crossed,
    reason: "boundary is a WHERE clause; B's DB handle reads A's rows directly — the application that draws the boundary (the query) is the same application that can run a different query (enforcer==enforced-upon)",
  };
}

// --- Attempt 2: file-permission restriction (chmod 0600 on A's DB) -------
// Try to use the OS file system to enforce that only A's process opens A's
// DB. Shows the two failure modes: either the restriction is too coarse
// (same-uid processes both read it) or the app re-opens the file and bypasses
// whatever it set.
function attempt2_filePermissions(): AttemptResult {
  const dir = mkdtempSync(join(tmpdir(), "coforge-iso2-"));
  const aDbPath = join(dir, "agentA.db");
  const db = new DatabaseSync(aDbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS mem (content TEXT)`);
  db.prepare("INSERT INTO mem VALUES (?)").run("A's secret: the launch code is 0000");
  db.close();

  // "Enforce" — restrict the file to owner-only.
  chmodSync(aDbPath, 0o600);

  // The same application, same uid, opens the file anyway. The OS permission
  // does not stop the app that set the permission from reading the file it
  // restricted. To actually block same-uid access you'd need a different OS
  // uid per agent — which the application cannot provision for itself.
  let bypassed = false;
  try {
    const attacker = new DatabaseSync(aDbPath);
    const row = attacker.prepare("SELECT content FROM mem").get() as { content: string };
    bypassed = row.content.includes("launch code");
    attacker.close();
  } catch {
    bypassed = false;
  }

  // Cleanup — write a placeholder if chmod blocked delete (it won't, same uid).
  writeFileSync(aDbPath, "", { flag: "a" });
  rmSync(dir, { recursive: true, force: true });

  return {
    name: "2. file permission (chmod 600) on A's DB",
    holds: !bypassed,
    reason: bypassed
      ? "same-uid process (the app itself) re-opens the file it restricted; OS file perms cannot distinguish the app's 'A side' from its 'B side' without per-agent uids the app cannot self-provision"
      : "restriction held only because the opener failed for another reason; structurally still bypassable by any same-uid process",
  };
}

// --- Attempt 3: subprocess isolation (agent B in a child process) --------
// Spawn B as a separate process. Shows the boundary *can* be drawn at the OS
// process level — but the shared DB file remains cross-readable, so the
// boundary is incomplete unless the runtime mediates *every* DB access,
// which is exactly the OS abstraction the paper says is missing.
function attempt3_subprocess(): Promise<AttemptResult> {
  const dir = mkdtempSync(join(tmpdir(), "coforge-iso3-"));
  const sharedDbPath = join(dir, "shared.db");
  const db = new DatabaseSync(sharedDbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS agent_memory (agent TEXT, content TEXT)`);
  db.prepare("INSERT INTO agent_memory VALUES (?, ?)").run("AgentA", "A's secret: the launch code is 0000");
  db.close();

  // Child process (agent B) tries to read agent A's memory from the shared file.
  const childSrc = `
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync(${JSON.stringify(sharedDbPath)});
    const row = db.prepare("SELECT content FROM agent_memory WHERE agent = 'AgentA'").get();
    process.stdout.write(row ? row.content : "(nothing)");
    db.close();
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", childSrc], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (c) => (out += c.toString()));

  return new Promise<AttemptResult>((resolve) => {
    child.on("close", () => {
      rmSync(dir, { recursive: true, force: true });
      const crossed = out.includes("launch code");
      resolve({
        name: "3. subprocess isolation (B as a child process)",
        holds: !crossed,
        reason: crossed
          ? "process boundary holds for memory, but the SHARED db file is cross-readable by the child — isolation is incomplete unless a runtime mediates every DB access, which is the OS abstraction the app cannot provide for itself (enforcer==enforced-upon)"
          : "child could not read the shared file (unexpected); structurally the shared-file hole remains",
      });
    });
  });
}

async function main(): Promise<void> {
  console.log("coforge isolation-stub: proving user-space isolation is best-effort\n");
  report(attempt1_tableSeparation());
  report(attempt2_filePermissions());
  report(await attempt3_subprocess());
  console.log("CONCLUSION: every user-space isolation attempt either fails outright or");
  console.log("holds only partially, and the failure is always the same structure — the");
  console.log("application that draws the boundary is the application that can cross it.");
  console.log("The fix is runtime-enforced boundaries (execute-only / attested), one layer down.");
}

main().catch((e) => {
  console.error("stub failed to run:", e);
  process.exit(1);
});
