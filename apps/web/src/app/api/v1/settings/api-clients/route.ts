import { route, body } from "@/lib/api";
import { bridgeStatus, createApiClient } from "@friday/services";
import type { Scope } from "@friday/contracts";

export const GET = route({ auth: "ceo" }, ({ ctx }) => bridgeStatus(ctx.db));

/** Issues a key. The plaintext key is returned exactly once. */
export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => {
  const b = (await body(req)) as { name?: string; scopes?: Scope[] };
  const { client, apiKey } = await createApiClient(ctx.db, b.name ?? "Universal AI", b.scopes);
  return { id: client.id, name: client.name, scopes: client.scopes, api_key: apiKey };
});
