import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { FileSystemVaultStore, GitSync, parseNote, renderNote, scaffoldVault, upsertManagedBlock } from "../src";

describe("markdown", () => {
  it("round-trips frontmatter", () => {
    const text = renderNote({ frontmatter: { id: "01X", title: "テスト", tags: ["a"] }, body: "# 本文" });
    expect(parseNote(text)).toEqual({ frontmatter: { id: "01X", title: "テスト", tags: ["a"] }, body: "# 本文\n" });
  });

  it("rewrites only the managed block and keeps CEO notes", () => {
    const body = "# PJ\n\n<!-- friday:begin summary -->\nold\n<!-- friday:end summary -->\n\n## CEOメモ\n大事なメモ\n";
    const next = upsertManagedBlock(body, "summary", "new");
    expect(next).toContain("new");
    expect(next).not.toContain("old");
    expect(next).toContain("大事なメモ");
  });
});

describe("filesystem store", () => {
  it("refuses paths outside the vault", async () => {
    const store = new FileSystemVaultStore(await mkdtemp(join(tmpdir(), "vault-")));
    await expect(store.write("../escape.md", "x")).rejects.toThrow(/escapes vault/);
  });
});

describe("scaffold + git", () => {
  it("creates the folder structure and commits it to a remote", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-"));
    const remote = await mkdtemp(join(tmpdir(), "remote-"));
    execFileSync("git", ["init", "--bare", "-b", "main", remote]);
    const store = new FileSystemVaultStore(root);
    const git = new GitSync({ root, remote });
    await git.init();
    const created = await scaffoldVault(store, "ARQO");
    expect(created).toContain("99_System/schema.md");
    expect(await scaffoldVault(store, "ARQO")).toEqual([]);
    const result = await git.commitAll("friday: scaffold");
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    const log = execFileSync("git", ["--git-dir", remote, "log", "--oneline"]).toString();
    expect(log).toContain("friday: scaffold");
    expect(await readFile(join(root, "README.md"), "utf8")).toContain("ARQO");
  });
});
