import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Cron } from "croner";
import { COMPANY_TIMEZONE } from "@friday/core";
import { getContext } from "@friday/services";
import { JOBS } from "./jobs";

// Env: apps/worker/.env, else the web app's .env.local (same variables).
for (const rel of ["../.env", "../../web/.env.local"]) {
  const file = fileURLToPath(new URL(rel, import.meta.url));
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const ctx = getContext();
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

async function runJob(name: string) {
  const job = JOBS.find((j) => j.name === name);
  if (!job) throw new Error(`unknown job ${name}`);
  const started = Date.now();
  try {
    const result = await job.run(ctx);
    log("job.ok", { job: name, ms: Date.now() - started, result: summarize(result) });
  } catch (e) {
    log("job.failed", { job: name, ms: Date.now() - started, error: (e as Error).message });
  }
}

function summarize(v: unknown) {
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== "object").slice(0, 6));
  return v;
}

const onceIdx = process.argv.indexOf("--once");
if (onceIdx !== -1) {
  // pnpm worker --once <job>
  await runJob(process.argv[onceIdx + 1] ?? "heartbeat");
  process.exit(0);
}

for (const job of JOBS) {
  // protect: never run the same job concurrently with itself.
  new Cron(job.cron, { timezone: COMPANY_TIMEZONE, protect: true, name: job.name }, () => runJob(job.name));
  log("job.scheduled", { job: job.name, cron: job.cron, tz: COMPANY_TIMEZONE });
}
await runJob("heartbeat");
log("worker.started");
