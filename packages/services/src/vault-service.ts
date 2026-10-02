import { companyDate, companyTime } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import {
  FileSystemVaultStore, GitSync, parseNote, renderNote, scaffoldVault, upsertManagedBlock, VAULT_DIRS, yearMonth,
  type CommitResult, type VaultStore,
} from "@friday/vault";
import { newId } from "@friday/core";

/**
 * Company memory writer. All writes go through one promise chain so git
 * operations are serialized (design: vault.sync queue, concurrency 1).
 */
export class VaultService {
  readonly store: VaultStore;
  readonly git: GitSync;
  private chain: Promise<unknown> = Promise.resolve();
  private initialized: Promise<void> | null = null;

  /**
   * @param crossProcessLock serializes vault work across processes (web + worker),
   *   e.g. a Postgres advisory lock. In-process work is serialized by a promise chain.
   */
  constructor(root: string, remote?: string, private readonly crossProcessLock?: <T>(fn: () => Promise<T>) => Promise<T>) {
    this.store = new FileSystemVaultStore(root);
    this.git = new GitSync({ root, remote });
  }

  private repoReady: Promise<void> | null = null;

  /** The vault's own git repository must exist before any write or commit. */
  private ensureRepo(): Promise<void> {
    this.repoReady ??= (async () => {
      await this.store.ensureDir(".");
      await this.git.init();
    })().catch((e) => {
      this.repoReady = null;
      throw e;
    });
    return this.repoReady;
  }

  /** Serialize a unit of vault work. */
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const work = async () => {
      await this.ensureRepo();
      return fn();
    };
    const locked = this.crossProcessLock ? () => this.crossProcessLock!(work) : work;
    const next = this.chain.then(locked, locked);
    this.chain = next.catch(() => undefined);
    return next;
  }

  ensureInitialized(companyName: string): Promise<void> {
    this.initialized ??= this.exclusive(async () => {
      await scaffoldVault(this.store, companyName);
    });
    return this.initialized;
  }

  /**
   * Create or update a note. Frontmatter is merged, named managed blocks are
   * replaced, and anything the CEO wrote outside the markers is kept.
   */
  async upsertNote(
    path: string,
    frontmatter: Record<string, unknown>,
    blocks: Record<string, string>,
    initialBody: (blocks: Record<string, string>) => string,
  ): Promise<void> {
    const existing = await this.store.read(path);
    if (existing === null) {
      await this.store.write(path, renderNote({ frontmatter: { ...frontmatter, friday_managed: true }, body: initialBody(blocks) }));
      return;
    }
    const note = parseNote(existing);
    let body = note.body;
    for (const [name, content] of Object.entries(blocks)) body = upsertManagedBlock(body, name, content);
    await this.store.write(path, renderNote({ frontmatter: { ...note.frontmatter, ...frontmatter }, body }));
  }

  /** Write a note only if it does not exist (append-only areas such as Approved Reports). */
  async createOnce(path: string, content: string): Promise<boolean> {
    if (await this.store.exists(path)) return false;
    await this.store.write(path, content);
    return true;
  }

  async appendActivity(lines: { at: Date; text: string }[]): Promise<void> {
    const byDate = new Map<string, string[]>();
    for (const l of lines) {
      const d = companyDate(l.at);
      byDate.set(d, [...(byDate.get(d) ?? []), `- ${companyTime(l.at)} ${l.text}`]);
    }
    for (const [date, entries] of byDate) {
      const { year, month } = yearMonth(date);
      const path = `${VAULT_DIRS.activity}/${year}/${month}/${date}.md`;
      const current = (await this.store.read(path)) ?? renderNote({
        frontmatter: { type: "activity", date, friday_managed: true },
        body: `# Company Timeline ${date}\n`,
      });
      await this.store.write(path, `${current.trimEnd()}\n${entries.join("\n")}\n`);
    }
  }

  async commit(db: DbOrTx, message: string): Promise<CommitResult> {
    const result = await this.git.commitAll(message);
    if (result.committed) {
      await db.insert(schema.vaultSyncLog).values({
        id: newId(), direction: "out", commitSha: result.commitSha, filesChanged: result.filesChanged,
        pushed: result.pushed, status: result.pushError ? "push_failed" : "ok", error: result.pushError,
      });
    }
    return result;
  }
}
