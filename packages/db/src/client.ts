import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __fridayDb?: { db: Db; sql: postgres.Sql } };

/**
 * One connection pool per process. DATABASE_URL points at Supabase Postgres in
 * hosted environments (use the pooler URL) or at a local Postgres in development.
 */
export function getDb(url = process.env.DATABASE_URL): Db {
  if (globalForDb.__fridayDb) return globalForDb.__fridayDb.db;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false });
  const db = drizzle(sql, { schema });
  globalForDb.__fridayDb = { db, sql };
  return db;
}

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const sql = postgres(url, { max: 3, prepare: false, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

export async function closeDb(): Promise<void> {
  await globalForDb.__fridayDb?.sql.end();
  globalForDb.__fridayDb = undefined;
}
