import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, sep } from "node:path";

/** Storage abstraction for the vault. Phase 0 ships the filesystem implementation. */
export interface VaultStore {
  readonly root: string;
  read(path: string): Promise<string | null>;
  write(path: string, content: string | Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
}

export class FileSystemVaultStore implements VaultStore {
  constructor(readonly root: string) {}

  /** Resolve a vault-relative path and refuse anything that escapes the vault. */
  private resolve(path: string): string {
    const full = normalize(join(this.root, path));
    const rel = relative(this.root, full);
    if (rel.startsWith("..") || rel.split(sep).includes("..")) throw new Error(`path escapes vault: ${path}`);
    return full;
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(this.resolve(path), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async write(path: string, content: string | Uint8Array): Promise<void> {
    const full = this.resolve(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(this.resolve(path), { recursive: true });
  }

  async list(dir: string): Promise<string[]> {
    try {
      return (await readdir(this.resolve(dir))).sort();
    } catch {
      return [];
    }
  }
}
