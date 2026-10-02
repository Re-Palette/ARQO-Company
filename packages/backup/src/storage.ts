import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";
import { AwsClient } from "aws4fetch";

/** Off-site storage for Daily Backup (separate system from GitHub). */
export interface BackupStorage {
  readonly name: "r2" | "supabase" | "local";
  put(key: string, body: Uint8Array<ArrayBuffer>, contentType?: string): Promise<{ location: string }>;
  get(key: string): Promise<Uint8Array>;
}

export class R2BackupStorage implements BackupStorage {
  readonly name = "r2";
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(cfg: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
    this.base = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`;
  }

  async put(key: string, body: Uint8Array<ArrayBuffer>, contentType = "application/octet-stream") {
    const url = `${this.base}/${encodeKey(key)}`;
    // If-None-Match: * — never overwrite an existing backup object.
    const res = await this.client.fetch(url, { method: "PUT", body, headers: { "content-type": contentType, "if-none-match": "*" } });
    if (!res.ok) throw new Error(`R2 put failed: HTTP ${res.status} ${await res.text()}`);
    return { location: `r2://${key}` };
  }

  async get(key: string) {
    const res = await this.client.fetch(`${this.base}/${encodeKey(key)}`);
    if (!res.ok) throw new Error(`R2 get failed: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

export class SupabaseBackupStorage implements BackupStorage {
  readonly name = "supabase";

  constructor(private readonly cfg: { url: string; serviceRoleKey: string; bucket: string }) {}

  async put(key: string, body: Uint8Array<ArrayBuffer>, contentType = "application/octet-stream") {
    const res = await fetch(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${encodeKey(key)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.cfg.serviceRoleKey}`, "content-type": contentType, "x-upsert": "false" },
      body,
    });
    if (!res.ok) throw new Error(`Supabase Storage put failed: HTTP ${res.status} ${await res.text()}`);
    return { location: `supabase://${this.cfg.bucket}/${key}` };
  }

  async get(key: string) {
    const res = await fetch(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${encodeKey(key)}`, {
      headers: { authorization: `Bearer ${this.cfg.serviceRoleKey}` },
    });
    if (!res.ok) throw new Error(`Supabase Storage get failed: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

/** Development only: a local directory. */
export class LocalBackupStorage implements BackupStorage {
  readonly name = "local";

  constructor(private readonly root: string) {}

  private path(key: string): string {
    const full = normalize(join(this.root, key));
    if (relative(this.root, full).startsWith("..")) throw new Error(`invalid backup key: ${key}`);
    return full;
  }

  async put(key: string, body: Uint8Array<ArrayBuffer>) {
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body, { flag: "wx" });
    return { location: `file://${full}` };
  }

  async get(key: string) {
    return new Uint8Array(await readFile(this.path(key)));
  }
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export type BackupEnv = Record<string, string | undefined>;

/**
 * R2 when configured; otherwise Supabase Storage; otherwise (outside
 * production, or when BACKUP_LOCAL_DIR is explicit) a local directory.
 */
export function selectBackupStorage(env: BackupEnv = process.env): BackupStorage {
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    return new R2BackupStorage({
      accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET,
    });
  }
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBackupStorage({
      url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, bucket: env.SUPABASE_BACKUP_BUCKET ?? "backups",
    });
  }
  if (env.BACKUP_LOCAL_DIR || env.NODE_ENV !== "production") {
    return new LocalBackupStorage(env.BACKUP_LOCAL_DIR ?? join(process.cwd(), ".data", "backups"));
  }
  throw new Error("No backup storage configured (set R2_* or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
}
