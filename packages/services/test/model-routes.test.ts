import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema, type Db } from "@friday/db";
import { runMigrations } from "@friday/db/migrate";
import { seed } from "@friday/db/seed";
import { eq } from "drizzle-orm";
import { createAIClient } from "../src";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://friday:friday@localhost:5432/friday_test";
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  const admin = postgres(URL, { max: 1, onnotice: () => {} });
  await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await admin.end();
  ({ db, close } = createDb(URL));
  await runMigrations(db);
  await seed(db, "system");
});

afterAll(async () => close?.());

const chain = async (ai: ReturnType<typeof createAIClient>, tier: string) =>
  (await ai.plan(tier)).chain.map((c) => c.route.modelId);

describe("seeded model routes (cost policy)", () => {
  it("runs every tier on Flash-Lite and keeps Flash for escalation only", async () => {
    const ai = createAIClient(db, { GEMINI_API_KEY: "k" });
    for (const tier of ["fast", "standard", "deep"]) expect(await chain(ai, tier)).toEqual(["gemini-3.5-flash-lite"]);
    expect(await chain(ai, "escalation")).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
    expect(await ai.decideEscalation({ tier: "deep", purpose: "t", messages: [{ role: "user", content: "hi" }] })).toBeNull();
    expect(await ai.decideEscalation({ tier: "fast", purpose: "t", messages: [{ role: "user", content: "x".repeat(40_001) }] }))
      .toBe("long_document");
  });

  it("re-seeding never overwrites a model the CEO changed in the DB", async () => {
    await db.update(schema.modelRoutes).set({ modelId: "custom-model" }).where(eq(schema.modelRoutes.id, "route_gemini_fast"));
    await seed(db, "system");
    const [row] = await db.select().from(schema.modelRoutes).where(eq(schema.modelRoutes.id, "route_gemini_fast"));
    expect(row!.modelId).toBe("custom-model");
  });
});
