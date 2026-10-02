import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface GitSyncOptions {
  root: string;
  /** Private GitHub remote, e.g. git@github.com:owner/friday-vault.git. Optional in development. */
  remote?: string;
  branch?: string;
  authorName?: string;
  authorEmail?: string;
}

export interface CommitResult {
  committed: boolean;
  commitSha?: string;
  filesChanged: number;
  pushed: boolean;
  pushError?: string;
}

/**
 * Vault → Git → Private GitHub. Commits are serialized by the caller
 * (vault.sync queue); this class never force-pushes.
 */
export class GitSync {
  private readonly branch: string;

  constructor(private readonly opts: GitSyncOptions) {
    this.branch = opts.branch ?? "main";
  }

  private git(args: string[]) {
    return run("git", args, { cwd: this.opts.root, maxBuffer: 16 * 1024 * 1024 });
  }

  async init(): Promise<void> {
    try {
      await this.git(["rev-parse", "--is-inside-work-tree"]);
    } catch {
      await this.git(["init", "-b", this.branch]);
    }
    await this.git(["config", "user.name", this.opts.authorName ?? "F.R.I.D.A.Y."]);
    await this.git(["config", "user.email", this.opts.authorEmail ?? "friday@localhost"]);
    if (this.opts.remote) {
      const { stdout } = await this.git(["remote"]);
      if (!stdout.split("\n").includes("origin")) await this.git(["remote", "add", "origin", this.opts.remote]);
      else await this.git(["remote", "set-url", "origin", this.opts.remote]);
    }
    if (await this.hasLfs()) {
      await this.git(["lfs", "install", "--local"]);
      await this.git(["lfs", "track", "*.pdf", "*.png", "*.jpg"]);
    }
  }

  async hasLfs(): Promise<boolean> {
    try {
      await this.git(["lfs", "version"]);
      return true;
    } catch {
      return false;
    }
  }

  async commitAll(message: string): Promise<CommitResult> {
    await this.git(["add", "-A"]);
    const { stdout: status } = await this.git(["status", "--porcelain"]);
    const filesChanged = status.split("\n").filter(Boolean).length;
    if (filesChanged === 0) return { committed: false, filesChanged: 0, pushed: false };
    await this.git(["commit", "-m", message]);
    const { stdout: sha } = await this.git(["rev-parse", "HEAD"]);
    const push = await this.push();
    return { committed: true, commitSha: sha.trim(), filesChanged, ...push };
  }

  async push(): Promise<{ pushed: boolean; pushError?: string }> {
    if (!this.opts.remote) return { pushed: false };
    try {
      try {
        await this.git(["pull", "--rebase", "origin", this.branch]);
      } catch {
        // First push to an empty remote has nothing to pull.
      }
      await this.git(["push", "-u", "origin", this.branch]);
      return { pushed: true };
    } catch (e) {
      return { pushed: false, pushError: (e as Error).message.slice(0, 500) };
    }
  }

  async head(): Promise<string | null> {
    try {
      const { stdout } = await this.git(["rev-parse", "HEAD"]);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /** Full-history bundle for Daily Backup. */
  async bundle(outFile: string): Promise<void> {
    await this.git(["bundle", "create", outFile, "--all"]);
  }
}
