import { NextResponse } from "next/server";
import { route, body } from "@/lib/api";
import { createDirective } from "@friday/services";
import { schema } from "@friday/db";
import { desc, eq } from "drizzle-orm";

/** Instructions from the CEO (Command Center) or external clients (Universal AI). */
export const POST = route({ auth: "ceo_or_key", scope: "write:directives" }, async ({ req, ctx, caller }) => {
  const key = req.headers.get("idempotency-key") ?? undefined;
  if (caller.kind === "client" && !key) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Idempotency-Key header is required" } }, { status: 400 });
  }
  const { response } = await createDirective(ctx, await body(req), { client: caller.client, idempotencyKey: key });
  return NextResponse.json(response, { status: 202 });
});

export const GET = route({ auth: "ceo_or_key", scope: "read:directives" }, async ({ ctx, caller }) => ({
  data: await ctx.db.select().from(schema.directives)
    .where(caller.client ? eq(schema.directives.apiClientId, caller.client.id) : undefined)
    .orderBy(desc(schema.directives.createdAt)).limit(50),
}));
