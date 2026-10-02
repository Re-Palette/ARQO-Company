import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Walk up from cwd to the monorepo root (the folder containing pnpm-workspace.yaml). */
export function repoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function vaultPath(env: Record<string, string | undefined> = process.env): string {
  return env.VAULT_PATH ? resolve(env.VAULT_PATH) : join(repoRoot(), ".data", "vault");
}
