import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

loadDotenv({ path: join(PROJECT_ROOT, ".env") });

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
} as const;
