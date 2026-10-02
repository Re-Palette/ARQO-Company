import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { selectBackupStorage, type BackupStorage } from "@friday/backup";
import { companyDate, newId, sha256 } from "@friday/core";
import { schema } from "@friday/db";
import { desc, eq } from "drizzle-orm";
import { SYSTEM } from "./actors";
import type { ServiceContext } from "./context";
import { emitEvent } from "./events";
import { notify } from "./notifications";

const run = promisify(execFile);

async function countMarkdown(cwd: string): Promise<number> {
  const { stdout } = await run("git", ["ls-files", "*.md"], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout.split("\n").filter(Boolean).length;
}

/**
 * Daily Backup: Vault (full git history) → off-site storage (R2, or the
 * Supabase Storage fallback), then restore-test the uploaded copy.
 */
export async function runVaultBackup(ctx: ServiceContext, storage: BackupStorage = selectBackupStorage(ctx.env)) {
  const db = ctx.db;
  const [runRow] = await db.insert(schema.backupRuns).values({ id: newId(), kind: "vault", storage: storage.name }).returning();
  const tmp = await mkdtemp(join(tmpdir(), "friday-backup-"));
  try {
    const { head, files } = await ctx.vault.exclusive(async () => {
      await ctx.vault.commit(db, "friday: pre-backup snapshot");
      const bundle = join(tmp, "vault.bundle");
      await ctx.vault.git.bundle(bundle);
      return { head: await ctx.vault.git.head(), files: await countMarkdown(ctx.vault.store.root) };
    });
    const bytes = new Uint8Array(await readFile(join(tmp, "vault.bundle")));
    const digest = sha256(bytes);
    const date = companyDate();
    const key = `vault/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}/vault-${new Date().toISOString().replace(/[:.]/g, "")}.bundle`;
    const { location } = await storage.put(key, bytes, "application/x-git-bundle");

    // Restore test: download what we stored, clone it, compare.
    const restored = await storage.get(key);
    const restoredFile = join(tmp, "restored.bundle");
    await writeFile(restoredFile, restored);
    await run("git", ["clone", "--quiet", restoredFile, join(tmp, "restore")]);
    await run("git", ["fsck", "--no-progress"], { cwd: join(tmp, "restore") });
    const restoredFiles = await countMarkdown(join(tmp, "restore"));
    const verified = sha256(restored) === digest && restoredFiles === files;

    const [done] = await db.update(schema.backupRuns).set({
      status: verified ? "ok" : "verify_failed", finishedAt: new Date(), artifactPath: location, sizeBytes: bytes.length,
      sha256: digest, commitSha: head, verified,
    }).where(eq(schema.backupRuns.id, runRow!.id)).returning();
    await emitEvent(db, {
      type: verified ? "backup.completed" : "backup.failed", actor: SYSTEM, subjectType: "backup_run", subjectId: runRow!.id,
      importance: verified ? 2 : 5, data: { storage: storage.name, files, sha256: digest, error: verified ? null : "restore verification failed" },
    });
    if (!verified) await notify(ctx, db, { category: "alert", severity: "critical", title: "バックアップ検証に失敗しました", link: "/settings" });
    return done!;
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    await db.update(schema.backupRuns).set({ status: "failed", finishedAt: new Date(), error: message }).where(eq(schema.backupRuns.id, runRow!.id));
    await emitEvent(db, { type: "backup.failed", actor: SYSTEM, subjectType: "backup_run", subjectId: runRow!.id, importance: 5, data: { error: message } });
    await notify(ctx, db, { category: "alert", severity: "critical", title: "バックアップに失敗しました", body: message, link: "/settings" });
    throw e;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function listBackupRuns(ctx: ServiceContext, limit = 10) {
  return ctx.db.select().from(schema.backupRuns).orderBy(desc(schema.backupRuns.startedAt)).limit(limit);
}
