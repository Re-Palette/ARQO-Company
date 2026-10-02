import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LocalBackupStorage, selectBackupStorage } from "../src";

describe("backup storage selection", () => {
  it("prefers R2, then Supabase, then local", () => {
    const r2 = { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" };
    const sb = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" };
    expect(selectBackupStorage({ ...r2, ...sb }).name).toBe("r2");
    expect(selectBackupStorage(sb).name).toBe("supabase");
    expect(selectBackupStorage({ NODE_ENV: "development" }).name).toBe("local");
    expect(() => selectBackupStorage({ NODE_ENV: "production" })).toThrow(/No backup storage/);
  });

  it("signs R2 uploads and refuses overwrites", async () => {
    const fetchMock = vi.fn(async (_req: Request) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const s = selectBackupStorage({ R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "id", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "vault" });
    await s.put("vault/2026/10/02/a.bundle", new Uint8Array([1, 2]));
    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://acct.r2.cloudflarestorage.com/vault/vault/2026/10/02/a.bundle");
    expect(req.method).toBe("PUT");
    expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256/);
    expect(req.headers.get("if-none-match")).toBe("*");
    vi.unstubAllGlobals();
  });

  it("local storage never overwrites an existing backup", async () => {
    const s = new LocalBackupStorage(await mkdtemp(join(tmpdir(), "bk-")));
    await s.put("a/b.bin", new Uint8Array([1]));
    await expect(s.put("a/b.bin", new Uint8Array([2]))).rejects.toThrow();
    expect([...(await s.get("a/b.bin"))]).toEqual([1]);
  });
});
