import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

loadDotenv({ path: join(PROJECT_ROOT, ".env"), override: true });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v;
}

export const config = {
  llmApiKey: required("LLM_API_KEY"),
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  routerPort: Number(process.env.ROUTER_PORT ?? 8787),
  agentsFile: process.env.AGENTS_FILE ?? join(PROJECT_ROOT, "agents.json"),
  dbPath: process.env.DB_PATH ?? join(PROJECT_ROOT, "coforge.db"),
  // M1: the human has a name (not the literal "you"). Single user for now;
  // B4 adds accounts. Set USER_NAME in .env.
  userName: process.env.USER_NAME ?? "wizout",
  // B2 memory compression: on by default (coforge as usable workspace).
  // Set COMPRESS_MEMORY=false to reproduce the paper's prompt-replay wall.
  compressMemory: process.env.COMPRESS_MEMORY !== "false",
  // summarize when history (rows) exceeds N+K; keep the K most recent turns.
  compressThresholdRows: 20, // N*2 (10 turns)
  compressKeepRows: 8,       // K*2 (4 turns)
} as const;
